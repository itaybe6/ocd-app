const test = require('node:test');
const assert = require('node:assert/strict');
const { runtime } = require('./helpers/hook-runtime.cjs');
const product = (id, name = id) => ({ id, name });
const ids = products => Array.from(products, p => p.id);

function setup() {
  const h = runtime();
  const logic = h.load('src/lib/catalogSearch.ts', { './brands': {} });
  let query = '', options, fetched = 0;
  const catalog = { products: [product('partial', 'מארז תרסיס חלונות'), product('exact', 'תרסיס חלונות'), product('other', 'מטלית')], isPending: false, isError: false, refetch: async () => {} };
  const remote = { data: [], isFetching: false, isError: false, refetch: async () => {} };
  const { useHomeProductSearch } = h.load('src/hooks/useHomeProductSearch.ts', {
    '@tanstack/react-query': { useQuery: value => { options = value; return remote; } },
    './useStoreCatalog': { useStoreCatalog: () => catalog },
    '../lib/shopify': { searchProducts: async () => { fetched++; return [product('remote', 'חלונות')]; } },
    '../lib/catalogSearch': logic,
  });
  const map = (...args) => { assert.equal(args.length, 2, 'mapper must not receive the array as a category title'); return args[0]; };
  h.mount(() => useHomeProductSearch(query, map));
  return { ...h, catalog, remote, options: () => options, fetched: () => fetched, type: async value => { query = value; h.render(); await h.flush(); } };
}

test('home search immediately ranks partial name matches and debounces only the network', async () => {
  const h = setup();
  assert.equal(h.options().enabled, false);
  await h.type('תרסיס חלונות');
  assert.deepEqual(ids(h.tree().products), ['exact', 'partial']);
  assert.equal(h.options().enabled, false);
  await h.tick(299); assert.equal(h.options().enabled, false);
  await h.tick(1); assert.equal(h.options().enabled, true);
  await h.options().queryFn(); assert.equal(h.fetched(), 1);
  h.unmount(); assert.equal(h.pendingTimers(), 0);
});

test('typing another query or clearing cannot show stale remote results or issue the old request', async () => {
  const h = setup();
  await h.type('חלונ'); await h.tick(300);
  h.remote.data = [product('extra', 'תרסיס חלונות נוסף'), product('exact', 'תרסיס חלונות')];
  h.render(); await h.flush();
  assert.equal(h.tree().products.length, 3, 'remote and local results deduplicate');
  await h.type('מטל');
  assert.deepEqual(ids(h.tree().products), ['other']);
  assert.equal(h.options().enabled, false);
  await h.tick(100); await h.type('   '); await h.tick(300);
  assert.equal(h.tree().needle, '');
  assert.equal(h.tree().products.length, 0);
  assert.equal(h.options().enabled, false);
  h.unmount();
});

test('partial catalog updates appear live and cached matches remain usable during a network failure', async () => {
  const h = setup();
  h.catalog.isPending = true;
  await h.type('חלונ');
  assert.equal(h.tree().loading, true);
  h.catalog.products = [...h.catalog.products, product('new-page', 'תרסיס חלונות 750')];
  h.render(); await h.flush();
  assert.equal(h.tree().products.length, 3);
  await h.tick(300);
  h.catalog.isPending = false; h.remote.isError = true;
  h.render(); await h.flush();
  assert.equal(h.tree().loading, false);
  assert.equal(h.tree().error, true);
  assert.equal(h.tree().products.length, 3);
  h.unmount();
});

const nodes = n => !n || typeof n !== 'object' ? [] : [n, ...(n.props?.children ?? []).flat(Infinity).flatMap(nodes)];
function results() {
  const h = runtime();
  const { HomeSearchResults } = h.load('src/components/HomeSearchResults.tsx', {
    'react-native': { View: 'View', Text: 'Text', Pressable: 'Button', ActivityIndicator: 'Spinner', StyleSheet: { create: x => x } },
  });
  let cleared = 0, retried = 0;
  const props = { query: 'חלונות', products: Array.from({ length: 25 }, (_, i) => product(String(i))), loading: false, error: false,
    onClear: () => cleared++, onRetry: () => retried++, renderProduct: p => h.react.createElement('Card', { product: p }) };
  h.mount(() => HomeSearchResults(props));
  return { ...h, props, cleared: () => cleared, retried: () => retried, all: () => nodes(h.tree()), cards: () => nodes(h.tree()).filter(n => n.type === 'Card') };
}

test('home results render two cards per row, load eight at a time and reset the batch for a new query', async () => {
  const h = results();
  assert.equal(h.cards().length, 8);
  const rows = h.all().filter(n => n.props.style?.flexDirection === 'row-reverse' && n.props.style?.gap === 10);
  assert.equal(rows.length, 4);
  assert.ok(rows.every(row => nodes(row).filter(n => n.type === 'Card').length === 2));
  h.all().find(n => n.props.accessibilityLabel === 'עוד תוצאות').props.onPress(); await h.flush();
  assert.equal(h.cards().length, 16);
  h.props.query = 'מטלית'; h.render(); await h.flush();
  assert.equal(h.cards().length, 8);
  h.unmount();
});

test('empty results offer clearing, errors offer retry, and loading is not reported as no matches', async () => {
  const h = results(); h.props.products = []; h.props.loading = true; h.render(); await h.flush();
  assert.equal(h.all().filter(n => n.type === 'Button').length, 0);
  assert.ok(h.all().some(n => n.type === 'Spinner'));
  h.props.loading = false; h.render(); await h.flush();
  h.all().find(n => n.type === 'Button').props.onPress(); assert.equal(h.cleared(), 1);
  h.props.error = true; h.render(); await h.flush();
  h.all().find(n => n.type === 'Button').props.onPress(); assert.equal(h.retried(), 1);
  h.unmount();
});
