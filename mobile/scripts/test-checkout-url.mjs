const domain = process.env.EXPO_PUBLIC_SHOPIFY_DOMAIN?.trim();
const token = process.env.EXPO_PUBLIC_SHOPIFY_STOREFRONT_TOKEN?.trim();

if (!domain || !token) {
  console.error('Missing EXPO_PUBLIC_SHOPIFY_DOMAIN or EXPO_PUBLIC_SHOPIFY_STOREFRONT_TOKEN');
  process.exit(1);
}

async function gql(query, variables) {
  const res = await fetch(`https://${domain}/api/2026-04/graphql.json`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Shopify-Storefront-Access-Token': token,
    },
    body: JSON.stringify({ query, variables }),
  });
  const json = await res.json();
  return { status: res.status, json };
}

const products = await gql(
  `query { products(first: 1) { edges { node { title variants(first: 1) { edges { node { id availableForSale title } } } } } } }`,
);
console.log('products', products.status, JSON.stringify(products.json, null, 2));

const variantId = products.json.data?.products?.edges?.[0]?.node?.variants?.edges?.[0]?.node?.id;
if (!variantId) process.exit(0);

const cart = await gql(
  `mutation CreateCart($input: CartInput!) {
    cartCreate(input: $input) {
      cart { id checkoutUrl totalQuantity }
      userErrors { message }
    }
  }`,
  { input: { lines: [{ merchandiseId: variantId, quantity: 1 }] } },
);
console.log('cart', cart.status, JSON.stringify(cart.json, null, 2));

const checkoutUrl = cart.json.data?.cartCreate?.cart?.checkoutUrl;
if (!checkoutUrl) process.exit(0);

console.log('\ncheckoutUrl:', checkoutUrl);

const parsed = new URL(checkoutUrl);
const myshopifyUrl = `https://${domain}${parsed.pathname}${parsed.search}`;
console.log('myshopify rewrite:', myshopifyUrl);

for (const testUrl of [checkoutUrl, myshopifyUrl]) {
  console.log('\n--- testing:', testUrl.slice(0, 100));
  const head = await fetch(testUrl, { method: 'GET', redirect: 'manual' });
  console.log('HEAD status:', head.status);
  console.log('HEAD location:', head.headers.get('location'));
  const get = await fetch(testUrl, { redirect: 'follow' });
  console.log('GET final status:', get.status);
  console.log('GET final url:', get.url);
}
