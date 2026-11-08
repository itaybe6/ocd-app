import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { appendCheckoutDiscountCode, normalizeCheckoutUrl } from '../lib/checkoutUrl';
import {
  createCart,
  updateCartBuyerIdentity,
  updateCartDiscountCodes,
  type ShopifyCart,
  type ShopifyCartAttributeInput,
  type ShopifyCreateCartOptions,
  type ShopifyCartLineInput,
} from '../lib/shopify';

/**
 * Member discount codes (Shopify Admin). Both must be limited to the
 * OCD+ Members customer segment, so typing the code does nothing for anyone else.
 * The app attaches the member's phone before applying them, which is how
 * Shopify recognizes that customer at checkout.
 *
 * OCDPLUS  — 8% off the order
 * OCDSHIP  — free shipping when the order is over 149₪
 */
const OCD_PLUS_DISCOUNT_CODE =
  process.env.EXPO_PUBLIC_OCD_PLUS_DISCOUNT_CODE?.trim() || 'OCDPLUS';
const OCD_PLUS_SHIPPING_CODE =
  process.env.EXPO_PUBLIC_OCD_PLUS_SHIPPING_CODE?.trim() || 'OCDSHIP';

export function getOcdPlusDiscountCode(): string {
  return OCD_PLUS_DISCOUNT_CODE;
}

function memberDiscountCodes(): string[] {
  return [OCD_PLUS_DISCOUNT_CODE, OCD_PLUS_SHIPPING_CODE];
}

/** Shopify matches a segment discount to the phone stored on the customer. */
function toE164Israel(input: string): string | null {
  const digits = input.replace(/\D+/g, '');
  if (!digits) return null;
  if (digits.startsWith('972')) return `+${digits}`;
  if (digits.startsWith('0')) return `+972${digits.slice(1)}`;
  return `+${digits}`;
}

/**
 * Line item for creating a hosted checkout session.
 * `variantId` must be the Storefront API ProductVariant GID (same value used as `merchandiseId` on cart lines).
 */
export type CheckoutLineItem = {
  variantId: string;
  quantity: number;
};

export type CreateCheckoutResult = {
  /** Shopify-hosted checkout URL to open in a WebView */
  checkoutUrl: string;
  /** Storefront Cart ID (GID) for reference or future cart operations */
  cartId: string;
};

/**
 * Identifier we attach to every cart that originates from this mobile app so
 * that the merchant can distinguish app-originated orders from web-originated
 * orders inside Shopify Admin (visible under the order's "Additional details"
 * panel, and queryable via the Shopify Admin API / Shopify Flow).
 */
const MOBILE_APP_SOURCE_VALUE = 'mobile_app';
const MOBILE_APP_SOURCE_NOTE = 'הזמנה מאפליקציית OCD (Mobile App)';

function getAppVersion(): string {
  const expoVersion =
    (Constants?.expoConfig as { version?: string } | undefined)?.version ??
    (Constants as unknown as { manifest?: { version?: string } })?.manifest?.version ??
    null;
  return expoVersion?.trim() || 'unknown';
}

/**
 * Build the canonical set of cart attributes that mark an order as having
 * originated from the mobile app. The web storefront does NOT add these, so
 * their presence (or absence) on an order is the source-of-truth signal in
 * Shopify Admin.
 *
 * Keys used:
 *  - `source`         → primary identifier ("mobile_app" vs missing == web)
 *  - `app_platform`   → "ios" | "android" | other
 *  - `app_version`    → app version string (from app.json/expoConfig)
 */
export function buildMobileAppCartAttributes(
  extra: ShopifyCartAttributeInput[] = [],
): ShopifyCartAttributeInput[] {
  return [
    { key: 'source', value: MOBILE_APP_SOURCE_VALUE },
    { key: 'app_platform', value: Platform.OS },
    { key: 'app_version', value: getAppVersion() },
    ...extra,
  ];
}

/**
 * Returns options ready to be passed to `createCart` so that every mobile-app
 * cart is tagged with the source attributes + a human-readable note.
 */
export function buildMobileAppCartOptions(
  overrides?: Partial<ShopifyCreateCartOptions>,
): ShopifyCreateCartOptions {
  return {
    attributes: buildMobileAppCartAttributes(overrides?.attributes),
    note: overrides?.note ?? MOBILE_APP_SOURCE_NOTE,
  };
}

/**
 * Creates a new cart via the Storefront Cart API (`cartCreate`) and returns the checkout URL.
 * Payment always happens on Shopify’s pages — no card data touches the app.
 *
 * Every cart created here is tagged with `source: mobile_app` (plus platform
 * and app version) so that the merchant can identify in Shopify Admin which
 * orders came from the app vs from the web storefront.
 */
export async function createCheckout(lineItems: CheckoutLineItem[]): Promise<CreateCheckoutResult> {
  if (!lineItems.length) {
    throw new Error('No line items provided for checkout');
  }

  const lines: ShopifyCartLineInput[] = lineItems.map((item) => {
    const quantity = Math.max(1, Math.floor(Number(item.quantity)) || 1);
    return { merchandiseId: item.variantId, quantity };
  });

  const cart = await createCart(lines, buildMobileAppCartOptions());
  const checkoutUrl = normalizeCheckoutUrl(cart.checkoutUrl?.trim() ?? '');

  if (!checkoutUrl) {
    throw new Error('Shopify did not return a checkout URL');
  }

  return { checkoutUrl, cartId: cart.id };
}

/**
 * Apply OCD+ member discounts on the live cart.
 * Attach contact information first. Segment eligibility is enforced by Shopify
 * at checkout; this does not create a Shopify Customer Account login session.
 */
export async function prepareMemberCart(args: {
  cartId: string;
  phone?: string | null;
  email?: string | null;
}): Promise<ShopifyCart | null> {
  const phone = toE164Israel(args.phone ?? '');
  const email = args.email?.trim() || null;
  if (phone || email) {
    try {
      await updateCartBuyerIdentity(args.cartId, {
        ...(phone ? { phone, countryCode: 'IL' } : {}),
        ...(email ? { email } : {}),
      });
    } catch {
      // Identity is best-effort. Checkout can still match the phone the member types.
    }
  }

  try {
    return await updateCartDiscountCodes(args.cartId, memberDiscountCodes());
  } catch {
    return null;
  }
}

/**
 * Prepare a cart for an ACTIVE OCD+ member before opening checkout.
 * Returns a fresh checkoutUrl (with discount when Shopify accepts the code).
 */
export async function applyOcdPlusMemberCheckout(args: {
  cartId: string;
  fallbackCheckoutUrl: string;
  phone?: string | null;
  email?: string | null;
}): Promise<string> {
  const cart = await prepareMemberCart({
    cartId: args.cartId,
    phone: args.phone,
    email: args.email,
  });
  const url = cart?.checkoutUrl?.trim() || args.fallbackCheckoutUrl;
  return appendCheckoutDiscountCode(normalizeCheckoutUrl(url), memberDiscountCodes().join(','));
}
