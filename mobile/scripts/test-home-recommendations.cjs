const test = require('node:test');
const assert = require('node:assert/strict');
const { runtime } = require('./helpers/hook-runtime.cjs');
const logic = runtime().load('src/lib/homeRecommendations.ts', {});
const product = (id, productType = 'cleaning', extra = {}) => ({ id, productType, price: 40, availableForSale: true, collectionHandles: [], ...extra });
const ids = products => Array.from(products, p => p.id);
const catalog = () => Array.from({ length: 24 }, (_, i) => product(String(i), i < 12 ? 'cleaning' : 'fragrance'));
function rng(seed) { return () => ((seed = (seed * 1664525 + 1013904223) >>> 0) + 1) / 4294967297; }

test('new visitors get different random orders without duplicates or invalid prices; sold out goes last', () => {
  const products = [...catalog(), product('0'), product('invalid', '', { price: 0 }), product('sold', '', { availableForSale: false })];
  const a = logic.recommendHomeProducts(products, [], [], rng(1));
  const b = logic.recommendHomeProducts(products, [], [], rng(2));
  assert.notDeepEqual(ids(a.slice(0, 8)), ids(b.slice(0, 8)));
  assert.equal(a.length, 25);
  assert.equal(new Set(ids(a)).size, 25);
  assert.equal(a.at(-1).id, 'sold');
  assert.equal(products[0].id, '0');
});

test('interest favors unseen products of the same family with three discovery positions in the first eight', () => {
  const history = [{ ...product('viewed'), viewedAt: 1000 }];
  const a = logic.recommendHomeProducts(catalog(), history, [], rng(3), 1000).slice(0, 8);
  assert.equal(a.filter(p => p.productType === 'cleaning').length, 5);
  assert.equal(a.filter(p => p.productType === 'fragrance').length, 3);
  assert.equal(a[2].productType, 'fragrance');
});

test('specific collection links families while brand and promotion collections do not', () => {
  const products = Array.from({ length: 20 }, (_, i) => product(String(i), '', {
    collectionHandles: [i < 10 ? 'laundry' : 'candles', 'brand', 'sale', 'all'],
  }));
  const history = [{ id: 'viewed', collectionHandles: ['laundry', 'brand', 'sale', 'all'], viewedAt: 1000 }];
  const a = logic.recommendHomeProducts(products, history, ['brand'], rng(4), 1000).slice(0, 8);
  assert.equal(a.filter(p => p.collectionHandles.includes('laundry')).length, 5);
});

test('history expires, validates persisted data, caps size and deduplicates repeated views', () => {
  const now = 2 * logic.VIEW_HISTORY_TTL;
  const history = logic.cleanViewHistory([
    null, { id: 'bad', viewedAt: 'today' }, { id: 'future', viewedAt: now + 1 },
    { id: 'old', viewedAt: 0 }, ...Array.from({ length: 80 }, (_, i) => ({ id: String(i), viewedAt: now })),
  ], now);
  assert.equal(history.length, 60);
  const next = logic.rememberProductView(history, product('12'), now);
  assert.equal(next[0].id, '12');
  assert.equal(next.filter(p => p.id === '12').length, 1);
});

test('persisted history stays separate for accounts and guest; concurrent views are not lost', async () => {
  const data = new Map();
  const history = runtime().load('src/lib/productViewHistory.ts', {
    '@react-native-async-storage/async-storage': { getItem: async key => data.get(key) ?? null, setItem: async (key, value) => { data.set(key, value); } },
    './homeRecommendations': logic,
  });
  await Promise.all([history.recordProductView('alice', product('a')), history.recordProductView('alice', product('b'))]);
  await history.recordProductView('bob', product('c'));
  await history.recordProductView(undefined, product('guest'));
  assert.deepEqual(ids(await history.readProductViews('alice')), ['b', 'a']);
  assert.deepEqual(ids(await history.readProductViews('bob')), ['c']);
  assert.deepEqual(ids(await history.readProductViews()), ['guest']);
});

test('bad or unavailable storage gracefully falls back to an empty history', async () => {
  for (const getItem of [async () => '{broken', async () => { throw Error('offline'); }]) {
    const history = runtime().load('src/lib/productViewHistory.ts', {
      '@react-native-async-storage/async-storage': { getItem, setItem: async () => { throw Error('full'); } },
      './homeRecommendations': logic,
    });
    assert.deepEqual(ids(await history.readProductViews('a')), []);
    assert.deepEqual(ids(await history.recordProductView('a', product('saved'))), ['saved']);
  }
});

test('home keeps order on catalog updates, refreshes on request and clears prior account immediately', async () => {
  const h = runtime();
  let products = catalog(), user = 'alice';
  const api = h.load('src/hooks/usePersonalizedHomeProducts.ts', {
    '@react-navigation/native': { useFocusEffect: callback => h.react.useEffect(callback, [callback]) },
    '../lib/homeRecommendations': logic,
    '../lib/productViewHistory': { readProductViews: async id => [{ ...product('viewed', id === 'alice' ? 'cleaning' : 'fragrance'), viewedAt: Date.now() }] },
  });
  h.mount(() => api.usePersonalizedHomeProducts(products, [], user));
  await h.flush();
  const before = ids(h.tree().products);
  products = [...products.map(p => ({ ...p, price: 45 })), product('new')];
  h.render(); await h.flush();
  assert.deepEqual(ids(h.tree().products).slice(0, 24), before);
  assert.equal(h.tree().products[0].price, 45);
  const revision = h.tree().revision;
  await h.tree().refresh(); await h.flush();
  assert.equal(h.tree().revision, revision + 1);
  user = 'bob';
  h.render();
  assert.equal(h.tree().products.length, 0);
  await h.flush();
  assert.equal(h.tree().products.slice(0, 8).filter(p => p.productType === 'fragrance').length, 5);
});

test('tracking requires two seconds on a loaded focused product and cancels on navigation', async () => {
  const h = runtime(), calls = [];
  let current = product('one');
  const api = h.load('src/hooks/useProductViewTracking.ts', {
    '@react-navigation/native': { useFocusEffect: callback => h.react.useEffect(callback, [callback]) },
    '../state/AuthContext': { useAuth: () => ({ user: { id: 'alice' } }) },
    '../lib/productViewHistory': { recordProductView: async (...args) => calls.push(args) },
  });
  h.mount(() => api.useProductViewTracking(current));
  await h.tick(1000);
  current = product('two'); h.render();
  await h.tick(1999); assert.equal(calls.length, 0);
  await h.tick(1); assert.equal(calls.length, 1);
  assert.equal(calls[0][0], 'alice'); assert.equal(calls[0][1].id, 'two');
  current = product('three'); h.render(); h.unmount();
  await h.tick(3000); assert.equal(calls.length, 1);
});

test('late history from the previous account cannot replace the current account feed', async () => {
  const h = runtime(), resolvers = {};
  let user = 'alice';
  const products = catalog();
  const api = h.load('src/hooks/usePersonalizedHomeProducts.ts', {
    '@react-navigation/native': { useFocusEffect: callback => h.react.useEffect(callback, [callback]) },
    '../lib/homeRecommendations': logic,
    '../lib/productViewHistory': { readProductViews: id => new Promise(resolve => { resolvers[id] = resolve; }) },
  });
  h.mount(() => api.usePersonalizedHomeProducts(products, [], user));
  user = 'bob'; h.render();
  resolvers.bob([{ ...product('seen', 'fragrance'), viewedAt: Date.now() }]); await h.flush();
  const before = ids(h.tree().products);
  resolvers.alice([{ ...product('seen', 'cleaning'), viewedAt: Date.now() }]); await h.flush();
  assert.deepEqual(ids(h.tree().products), before);
  assert.equal(h.tree().products.slice(0, 8).filter(p => p.productType === 'fragrance').length, 5);
});
