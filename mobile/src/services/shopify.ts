import { createCart, type ShopifyCartLineInput } from '../lib/shopify';

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
 * Creates a new cart via the Storefront Cart API (`cartCreate`) and returns the checkout URL.
 * Payment always happens on Shopify’s pages — no card data touches the app.
 */
export async function createCheckout(lineItems: CheckoutLineItem[]): Promise<CreateCheckoutResult> {
  if (!lineItems.length) {
    throw new Error('No line items provided for checkout');
  }

  const lines: ShopifyCartLineInput[] = lineItems.map((item) => {
    const quantity = Math.max(1, Math.floor(Number(item.quantity)) || 1);
    return { merchandiseId: item.variantId, quantity };
  });

  const cart = await createCart(lines);
  const checkoutUrl = cart.checkoutUrl?.trim();

  if (!checkoutUrl) {
    throw new Error('Shopify did not return a checkout URL');
  }

  return { checkoutUrl, cartId: cart.id };
}
