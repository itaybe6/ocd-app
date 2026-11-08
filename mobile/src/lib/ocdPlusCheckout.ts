export function isHypPaymentUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.origin === 'https://pay.hyp.co.il' && /^\/p\/?$/.test(url.pathname)
      && !url.username && !url.password;
  } catch { return false; }
}

export function isHypReturnUrl(value: string, backendUrl: string): boolean {
  if (!backendUrl) return false;
  try {
    const url = new URL(value);
    const expected = new URL('/functions/v1/ocd-plus-hyp-callback', backendUrl);
    return url.origin === expected.origin && url.pathname === expected.pathname;
  } catch { return false; }
}

// HTTPS bank/3DS redirects stay inside the WebView; never hand unknown schemes
// to the OS. about:blank is used by payment-frame initialization.
export function allowPaymentNavigation(value: string): boolean {
  if (value === 'about:blank') return true;
  try { return new URL(value).protocol === 'https:'; } catch { return false; }
}
