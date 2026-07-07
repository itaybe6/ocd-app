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
      cartCreate(input: $input) { cart { checkoutUrl } userErrors { message } }
    }`,
    variables: {
      input: { lines: [{ merchandiseId: 'gid://shopify/ProductVariant/45559212146851', quantity: 1 }] },
    },
  }),
}).then((r) => r.json());

const startUrl = cart.data?.cartCreate?.cart?.checkoutUrl;
if (!startUrl) {
  console.log(JSON.stringify(cart, null, 2));
  process.exit(1);
}

const wwwUrl = startUrl.replace('://ocd-online.co.il', '://www.ocd-online.co.il');

for (const label of ['api url', 'www url']) {
  const url = label === 'api url' ? startUrl : wwwUrl;
  console.log(`\n=== follow (${label}) ===`);
  console.log(url.slice(0, 100));

  const res = await fetch(url, {
    redirect: 'follow',
    headers: {
      'User-Agent':
        'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
  });

  console.log('final status:', res.status);
  console.log('final url:', res.url);
  const snippet = (await res.text()).slice(0, 400).replace(/\s+/g, ' ');
  console.log('body:', snippet);
}
