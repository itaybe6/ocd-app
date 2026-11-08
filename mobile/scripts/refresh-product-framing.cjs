// Windows maintenance tool: analyze the current catalog without changing any source images.
// Run from mobile: node scripts/refresh-product-framing.cjs
const fs = require('node:fs');
const path = require('node:path');
const { parseEnv } = require('node:util');
const { spawnSync } = require('node:child_process');

async function main() {
  const env = {};
  for (const file of ['.env', '.env.local']) if (fs.existsSync(file)) Object.assign(env, parseEnv(fs.readFileSync(file, 'utf8')));
  Object.assign(env, process.env);
  const domain = env.EXPO_PUBLIC_SHOPIFY_DOMAIN || env.EXPO_PUBLIC_SHOPIFY_STORE_DOMAIN || env.SHOPIFY_STORE_DOMAIN;
  const token = env.EXPO_PUBLIC_SHOPIFY_STOREFRONT_TOKEN || env.EXPO_PUBLIC_SHOPIFY_STOREFRONT_ACCESS_TOKEN || env.SHOPIFY_STOREFRONT_ACCESS_TOKEN;
  if (!domain || !token) throw Error('Shopify storefront configuration is missing');
  const version = fs.readFileSync('src/lib/shopify.ts', 'utf8').match(/const SHOPIFY_API_VERSION = '([^']+)'/)[1];
  const products = [];
  let after = null;
  do {
    const response = await fetch(`https://${domain}/api/${version}/graphql.json`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Shopify-Storefront-Access-Token': token },
      body: JSON.stringify({ query: 'query($after:String){products(first:250,after:$after,sortKey:BEST_SELLING){nodes{featuredImage{url width height}} pageInfo{hasNextPage endCursor}}}', variables: { after } }),
      signal: AbortSignal.timeout(30000),
    });
    if (!response.ok) throw Error(`Catalog HTTP ${response.status}`);
    const data = await response.json();
    if (data.errors) throw Error('Catalog query failed');
    const page = data.data.products;
    products.push(...page.nodes);
    after = page.pageInfo.hasNextPage ? page.pageInfo.endCursor : null;
  } while (after);
  const dir = 'node_modules/.cache/product-framing';
  fs.mkdirSync(dir, { recursive: true });
  const images = [...new Map(products.filter(p => p.featuredImage).map(p => [p.featuredImage.url, p.featuredImage])).values()];
  let cursor = 0;
  await Promise.all(Array.from({ length: 12 }, async () => {
    while (cursor < images.length) {
      const index = cursor++, image = images[index];
      try {
        const url = new URL(image.url);
        url.searchParams.set('width', '256'); url.searchParams.set('format', 'jpg');
        const response = await fetch(url, { signal: AbortSignal.timeout(20000) });
        if (!response.ok) throw Error();
        image.file = path.join(dir, `${index}.img`);
        fs.writeFileSync(image.file, Buffer.from(await response.arrayBuffer()));
      } catch { image.file = null; }
    }
  }));
  fs.writeFileSync(`${dir}/images.json`, JSON.stringify(images));
  const result = spawnSync('pwsh', ['-NoProfile', '-File', 'scripts/measure-product-framing.ps1'], { stdio: 'inherit', windowsHide: true });
  if (result.error || result.status !== 0) throw Error('Image measurement failed');
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
