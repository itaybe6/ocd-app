import Constants from 'expo-constants';
import { Platform } from 'react-native';
import {
  createCart,
  type ShopifyCartAttributeInput,
  type ShopifyCreateCartOptions,
  type ShopifyCartLineInput,
} from '../lib/shopify';

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
  const checkoutUrl = cart.checkoutUrl?.trim();

  if (!checkoutUrl) {
    throw new Error('Shopify did not return a checkout URL');
  }

  return { checkoutUrl, cartId: cart.id };
}
