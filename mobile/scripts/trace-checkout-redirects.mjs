const domain = process.env.EXPO_PUBLIC_SHOPIFY_DOMAIN?.trim();
const token = process.env.EXPO_PUBLIC_SHOPIFY_STOREFRONT_TOKEN?.trim();

const cart = await fetch(`https://${domain}/api/2026-04/graphql.json`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-Shopify-Storefront-Access-Token': token,
  },
  body: JSON.stringify({
    query: `mutation CreateCart($input: CartInput!) {
      cartCreate(input: $input) {
        cart { checkoutUrl }
        userErrors { message }
      }
    }`,
    variables: {
      input: {
        lines: [{ merchandiseId: 'gid://shopify/ProductVariant/45559212146851', quantity: 1 }],
      },
    },
  }),
}).then((r) => r.json());

const apiUrl = cart.data?.cartCreate?.cart?.checkoutUrl;
if (!apiUrl) {
  console.log('cart error', JSON.stringify(cart, null, 2));
  process.exit(1);
}

const parsed = new URL(apiUrl);
const myshopify = `https://${domain}${parsed.pathname}${parsed.search}`;

console.log('API checkoutUrl:', apiUrl);
console.log('myshopify equivalent:', myshopify);

for (const startUrl of [apiUrl, myshopify]) {
  console.log('\n=== chain from:', startUrl.slice(0, 80), '===');
  let current = startUrl;
  for (let i = 0; i < 12; i++) {
    const res = await fetch(current, {
      redirect: 'manual',
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; OCDCheckoutTrace/1.0)' },
    });
    console.log(`step ${i}: ${res.status} ${current}`);
    const loc = res.headers.get('location');
    if (!loc || res.status < 300 || res.status >= 400) {
      console.log('stopped (no redirect)');
      break;
    }
    current = new URL(loc, current).href;
    console.log(`  -> ${current}`);
  }
}
