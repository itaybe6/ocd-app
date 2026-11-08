const test = require('node:test');
const assert = require('node:assert/strict');
const { QueryClient } = require('@tanstack/react-query');
const { runtime } = require('./helpers/hook-runtime.cjs');

function setup(t, fetchers = {}) {
  const calls = [];
  const defaults = Object.fromEntries(['fetchProducts', 'fetchCollectionProducts', 'fetchCollections', 'fetchCollectionImage', 'fetchNewestProducts', 'fetchProductByHandle', 'fetchProductBundleTiers', 'fetchCartRecommendations'].map(name => [name, async (...args) => { calls.push([name, ...args]); return name === 'fetchProductByHandle' ? { id: args[0], handle: args[0], price: 20 } : [{ id: 'p' }]; }]));
  const api = { ...defaults, ...fetchers };
  const r = runtime();
  const catalog = r.load('src/lib/storeCatalog.ts', { './shopify': api });
  const resources = r.load('src/lib/storeResources.ts', { './shopify': api, './storeCatalog': catalog });
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
  t.after(() => client.clear());
  return { client, calls, ...resources, reader: resources.createStoreResourceReader(client) };
}

test('reopening a collection/product and changing cart quantities reuse fresh public reads', async t => {
  const s = setup(t);
  await Promise.all([s.reader.fetchCollectionProducts('cleaning'), s.reader.fetchCollectionProducts('cleaning')]);
  await s.reader.fetchCollectionProducts('cleaning');
  assert.equal(s.calls.length, 1);
  const product = await s.reader.fetchProductByHandle('spray');
  assert.equal(s.reader.readProduct('spray'), product);
  const anotherScreen = s.createStoreResourceReader(s.client);
  await anotherScreen.fetchProductByHandle('spray');
  await Promise.all([s.reader.fetchCartRecommendations('p'), anotherScreen.fetchCartRecommendations('p')]);
  await s.reader.fetchCartRecommendations('p');
  assert.deepEqual(s.calls.map(x => x[0]), ['fetchCollectionProducts', 'fetchProductByHandle', 'fetchCartRecommendations']);
});

test('limits, collection handles, sort order and product handles keep independent cache entries', async t => {
  const s = setup(t);
  await s.reader.fetchCollectionProducts('cleaning', 10);
  await s.reader.fetchCollectionProducts('cleaning');
  await s.reader.fetchCollectionProducts('cleaning', 10, { sortKey: 'PRICE', reverse: true });
  await s.reader.fetchCollectionProducts('other', 10);
  await s.reader.fetchProductByHandle('a');
  await s.reader.fetchProductByHandle('b');
  assert.equal(s.calls.length, 6);
  assert.equal(s.reader.readProduct('a').handle, 'a');
  assert.equal(s.reader.readProduct('b').handle, 'b');
});

test('pull-to-refresh and stale reads fetch again, preserving fresh prices', async t => {
  let price = 20, calls = 0;
  const s = setup(t, { fetchProductByHandle: async () => { calls++; return { id: 'a', price }; } });
  await s.reader.fetchProductByHandle('a');
  price = 25;
  await s.reader.refresh();
  assert.equal((await s.reader.fetchProductByHandle('a')).price, 25);
  s.client.setQueryData([...s.STORE_RESOURCES_KEY, 'product', 'a'], { id: 'a', price: 10 }, { updatedAt: Date.now() - 61_000 });
  await s.reader.fetchProductByHandle('a');
  assert.equal(calls, 3);
});

test('a failed request is retryable immediately and never becomes a cached empty result', async t => {
  let attempts = 0;
  const s = setup(t, { fetchCollectionProducts: async () => { if (++attempts === 1) throw Error('offline'); return [{ id: 'recovered' }]; } });
  await assert.rejects(s.reader.fetchCollectionProducts('cleaning'), /offline/);
  assert.equal((await s.reader.fetchCollectionProducts('cleaning'))[0].id, 'recovered');
  assert.equal(attempts, 2);
});

test('full product reads share the startup/search catalog; limited home rails cannot overwrite it', async t => {
  const s = setup(t);
  await s.reader.fetchProducts();
  await s.reader.fetchProducts();
  await s.reader.fetchProducts(10);
  assert.equal(s.calls.filter(x => x[0] === 'fetchProducts').length, 2);
});
