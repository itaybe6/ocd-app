const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

const compile = name => ts.transpileModule(fs.readFileSync(path.join(__dirname, '../src/lib', name + '.ts'), 'utf8'), {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
}).outputText;
const bundles = { exports: {} };
vm.runInNewContext(compile('productBundles'), bundles);
const code = compile('shopify');
const node = (id, tags = ['molla']) => ({
  id, title: id, handle: id, tags, description: '',
  priceRange: { minVariantPrice: { amount: '99', currencyCode: 'ILS' } },
  variants: { edges: [] },
});
const connection = (items, next = null) => ({ edges: items.map(node => ({ node })), pageInfo: { hasNextPage: !!next, endCursor: next } });
function setup(responses) {
  const calls = [], context = {
    exports: {}, process: { env: { EXPO_PUBLIC_SHOPIFY_DOMAIN: 'example.test', EXPO_PUBLIC_SHOPIFY_STOREFRONT_TOKEN: 'test' } },
    require: name => name === './productBundles' ? bundles.exports : { normalizeCheckoutUrl: x => x },
    fetch: async (_url, init) => {
      calls.push(JSON.parse(init.body));
      assert.ok(responses.length, 'Unexpected request');
      const result = responses.shift();
      if (result instanceof Error) throw result;
      return { ok: true, json: async () => result };
    },
  };
  vm.runInNewContext(code, context);
  return { api: context.exports, calls };
}

test('missing Cereria collection uses the website vendor/tag query with pagination and excludes bundle products', async () => {
  const s = setup([
    { data: { collection: null } },
    { data: { products: connection([node('candle'), node('hidden', ['bundle'])], 'next') } },
    { data: { products: connection([node('diffuser')]) } },
  ]);
  const products = await s.api.fetchCollectionProducts('cereria-molla');
  assert.equal(products.map(p => p.id).join(','), 'candle,diffuser');
  assert.equal(products[0].price, 99);
  assert.equal(s.calls[1].variables.query, 'vendor:"Cereria Mollá" OR tag:"molla"');
  assert.equal(s.calls[2].variables.after, 'next');
});

test('brand fallback respects limits and requested sort order', async () => {
  const s = setup([{ data: { collection: null } }, { data: { products: connection([node('a'), node('b')], 'next') } }]);
  assert.equal((await s.api.fetchCollectionProducts('cereria-molla', 1, { sortKey: 'CREATED', reverse: true })).length, 1);
  assert.equal(s.calls[1].variables.first, 1);
  assert.equal(s.calls[1].variables.sortKey, 'CREATED_AT');
  assert.equal(s.calls[1].variables.reverse, true);
  assert.equal(s.calls.length, 2);
});

test('real collections retain their own products, including an intentionally empty collection', async () => {
  for (const items of [[], [node('collection-product')]]) {
    const s = setup([{ data: { collection: { products: connection(items) } } }]);
    assert.equal((await s.api.fetchCollectionProducts('cereria-molla')).length, items.length);
    assert.equal(s.calls.length, 1);
  }
});

test('unknown missing categories stay empty and never load the entire catalog', async () => {
  const s = setup([{ data: { collection: null } }]);
  assert.equal((await s.api.fetchCollectionProducts('unknown')).length, 0);
  assert.equal(s.calls.length, 1);
});

test('request failures remain errors instead of being presented as an empty brand', async () => {
  const s = setup([{ data: { collection: null } }, { errors: [{ message: 'Unavailable' }] }]);
  await assert.rejects(s.api.fetchCollectionProducts('cereria-molla'), /Unavailable/);
  const failedCollection = setup([new Error('offline')]);
  await assert.rejects(failedCollection.api.fetchCollectionProducts('cereria-molla'), /offline/);
  assert.equal(failedCollection.calls.length, 1);
});

test('ordinary catalog requests retain best-selling order with no brand filter', async () => {
  const s = setup([{ data: { products: connection([node('a')]) } }]);
  await s.api.fetchProducts();
  assert.equal(s.calls[0].variables.query, undefined);
  assert.equal(s.calls[0].variables.sortKey, 'BEST_SELLING');
  assert.equal(s.calls[0].variables.reverse, false);
});
