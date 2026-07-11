const SHOPIFY_STORE_DOMAIN =
  process.env.EXPO_PUBLIC_SHOPIFY_DOMAIN?.trim() ||
  process.env.EXPO_PUBLIC_SHOPIFY_STORE_DOMAIN?.trim() ||
  'ocdonlinee.myshopify.com';

const CHECKOUT_SITE_HOST = 'www.ocd-online.co.il';

const MOBILE_SAFARI_UA =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';

/** Append a discount code so Shopify checkout applies it on landing (cart permalink). */
export function appendCheckoutDiscountCode(checkoutUrl: string, discountCode: string): string {
  const normalized = normalizeCheckoutUrl(checkoutUrl);
  const code = discountCode.trim();
  if (!code) return normalized;

  try {
    const parsed = new URL(normalized);
    parsed.searchParams.set('discount', code);
    return parsed.toString();
  } catch {
    const separator = normalized.includes('?') ? '&' : '?';
    return `${normalized}${separator}discount=${encodeURIComponent(code)}`;
  }
}

/** Storefront carts return checkout on the bare domain; Lovable route lives on www. */
export function normalizeCheckoutUrl(checkoutUrl: string): string {
  const trimmed = checkoutUrl.trim();
  if (!trimmed) return trimmed;

  try {
    const parsed = new URL(trimmed);
    if (parsed.hostname === 'ocd-online.co.il') {
      parsed.hostname = CHECKOUT_SITE_HOST;
    }
    return parsed.toString();
  } catch {
    return trimmed.replace('://ocd-online.co.il/', `://${CHECKOUT_SITE_HOST}/`);
  }
}

function isShopifyCheckoutDestination(url: string): boolean {
  const lower = url.toLowerCase();
  return (
    lower.includes('checkout.shopify.com') ||
    lower.includes('/checkouts/cn/') ||
    lower.includes('/checkouts/')
  );
}

/**
 * Follows Shopify checkout redirects server-side so the WebView opens the final
 * checkout page directly (avoids SPA 404s on /cart/c/* during redirect chains).
 */
export async function resolveCheckoutLaunchUrl(checkoutUrl: string): Promise<string> {
  const normalized = normalizeCheckoutUrl(checkoutUrl);
  let discountCode: string | null = null;
  try {
    discountCode = new URL(normalized).searchParams.get('discount');
  } catch {
    discountCode = null;
  }

  let current = normalized;

  for (let hop = 0; hop < 12; hop++) {
    const response = await fetch(current, {
      method: 'GET',
      redirect: 'manual',
      headers: {
        'User-Agent': MOBILE_SAFARI_UA,
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
    });

    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get('Location') ?? response.headers.get('location');
      if (!location) break;

      const next = new URL(location, current).href;
      if (isShopifyCheckoutDestination(next)) {
        return discountCode ? appendCheckoutDiscountCode(next, discountCode) : next;
      }
      current = next;
      continue;
    }

    if (response.status === 403 && isShopifyCheckoutDestination(current)) {
      return discountCode ? appendCheckoutDiscountCode(current, discountCode) : current;
    }

    break;
  }

  const fallback = isShopifyCheckoutDestination(current) ? current : normalized;
  return discountCode ? appendCheckoutDiscountCode(fallback, discountCode) : fallback;
}

export function isCheckoutHttpErrorBlocking(statusCode: number, url?: string | null): boolean {
  if (!url) return statusCode >= 400;
  const lower = url.toLowerCase();

  if (isShopifyCheckoutDestination(lower)) {
    return false;
  }

  if (statusCode === 404 && lower.includes('ocd-online.co.il') && lower.includes('/cart/c/')) {
    return true;
  }

  return statusCode >= 500;
}

export { MOBILE_SAFARI_UA, SHOPIFY_STORE_DOMAIN };
