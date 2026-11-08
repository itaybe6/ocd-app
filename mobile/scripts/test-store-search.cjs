const test = require('node:test');
const assert = require('node:assert/strict');
const { QueryClient } = require('@tanstack/react-query');
const { runtime } = require('./helpers/hook-runtime.cjs');

function setup(t, fetchProducts) {
  const client = new QueryClient({ defaultOptions: { queries: { gcTime: Infinity, retry: false } } });
  t.after(() => client.clear());
  const logic = runtime().load('src/lib/storeCatalog.ts', { './shopify': { fetchProducts } });
  return { client, ...logic, options: () => ({ ...logic.storeCatalogOptions(client), retry: false, gcTime: Infinity }) };
}
const deferred = () => { let resolve; const promise = new Promise(r => { resolve = r; }); return { promise, resolve }; };

test('startup, home and search share one in-flight catalog; first page is available before completion', async t => {
  const gate = deferred();
  let requests = 0;
  const first = [{ id: 'first' }], full = [...first, { id: 'last' }];
  const s = setup(t, async (limit, options) => {
    requests++;
    assert.equal(limit, undefined);
    assert.equal(options.firstPageSize, 40);
    options.onPage(first);
    await gate.promise;
    options.onPage(full);
    return full;
  });
  const startup = s.client.prefetchQuery(s.options());
  const home = s.client.fetchQuery(s.options());
  const search = s.client.fetchQuery(s.options());
  assert.equal(requests, 1);
  assert.deepEqual(s.client.getQueryData(s.STORE_CATALOG_PREVIEW_KEY), first);
  assert.equal(s.client.getQueryData(s.STORE_CATALOG_KEY), undefined);
  gate.resolve();
  await startup;
  assert.deepEqual(await home, full);
  assert.deepEqual(await search, full);
  await s.client.fetchQuery(s.options());
  assert.equal(requests, 1, 'opening search again uses fresh cache');
});

test('a later page failure retains preview, without marking incomplete catalog fresh', async t => {
  let requests = 0;
  const s = setup(t, async (_, options) => {
    requests++;
    options.onPage([{ id: 'first' }, { id: 'second' }]);
    throw Error('offline on second page');
  });
  await assert.rejects(s.client.fetchQuery(s.options()), /offline/);
  assert.equal(s.client.getQueryData(s.STORE_CATALOG_PREVIEW_KEY).length, 2);
  assert.equal(s.client.getQueryData(s.STORE_CATALOG_KEY), undefined);
  await assert.rejects(s.client.fetchQuery(s.options()), /offline/);
  assert.equal(requests, 2, 'retry does not mistake preview for a complete response');
});

test('refresh retains full results while loading and replaces removed products on completion', async t => {
  let requests = 0;
  const gate = deferred();
  const s = setup(t, async (_, options) => {
    requests++;
    if (requests === 1) return [{ id: 'old' }, { id: 'removed' }];
    options.onPage([{ id: 'new' }]);
    await gate.promise;
    return [{ id: 'new' }];
  });
  await s.client.fetchQuery(s.options());
  await s.client.invalidateQueries({ queryKey: s.STORE_CATALOG_KEY, refetchType: 'none' });
  const refresh = s.client.fetchQuery(s.options());
  assert.equal(s.client.getQueryData(s.STORE_CATALOG_KEY).length, 2);
  gate.resolve();
  await refresh;
  assert.deepEqual(s.client.getQueryData(s.STORE_CATALOG_KEY), [{ id: 'new' }]);
  assert.deepEqual(s.client.getQueryData(s.STORE_CATALOG_PREVIEW_KEY), [{ id: 'new' }]);
  assert.equal(requests, 2);
});

const rt = runtime();
const brands = rt.load('src/lib/brands.ts', {});
const searchLogic = rt.load('src/lib/catalogSearch.ts', { './brands': brands });
const discoveryLogic = rt.load('src/lib/productDiscovery.ts', {});
const brand = { handle: 'sucitesa', label: 'סוסיטסא', short: 'Sucitesa', keywords: ['סוסיטסה'], tags: ['sucitesa'] };
const products = [
  { id: 'a', name: 'תרסיס חלונות', subtitle: 'ניקוי', description: '', tags: ['sucitesa'], vendor: 'Sucitesa' },
  { id: 'b', name: 'נוזל כביסה', subtitle: 'לבגדים', description: '', tags: [], vendor: 'סנו' },
];
const ids = values => Array.from(values, p => p.id);

test('brand-chip search retains Hebrew aliases and metadata matching', () => {
  const index = searchLogic.indexCatalog(products, [brand]);
  assert.deepEqual(ids(searchLogic.searchCatalog(index, '  SUCITESA   חלונות ', 'catalog')), ['a']);
  assert.deepEqual(ids(searchLogic.searchCatalog(index, 'סוסיטסה', 'catalog')), ['a']);
  assert.deepEqual(ids(searchLogic.searchCatalog(index, 'סנו כביסה', 'catalog')), ['b']);
  assert.deepEqual(ids(searchLogic.searchCatalog(index, '')), ['a', 'b']);
  assert.deepEqual(ids(searchLogic.searchCatalog(index, 'לא קיים')), []);
});

test('typed search matches partial names and ranks exact, prefix, phrase and separated words', () => {
  const source = [
    { ...products[0], id: 'metadata-only', name: 'מטלית', description: 'תרסיס חלונות' },
    { ...products[0], id: 'separated', name: 'תרסיס לניקוי חלונות' },
    { ...products[0], id: 'phrase', name: 'מארז תרסיס חלונות' },
    { ...products[0], id: 'prefix', name: 'תרסיס חלונות 750 מל' },
    { ...products[0], id: 'exact', name: 'תרסיס חלונות' },
  ];
  const index = searchLogic.indexCatalog(source, [brand]);
  assert.deepEqual(ids(searchLogic.searchCatalog(index, '  תרסיס   חלונות  ')), ['exact', 'prefix', 'phrase', 'separated']);
  assert.equal(searchLogic.searchCatalog(index, 'חלונ').length, 4, 'partial word matches immediately');
  assert.deepEqual(ids(searchLogic.searchCatalog(index, 'Sucitesa')), [], 'metadata alone does not match typed text');
  assert.deepEqual(ids(searchLogic.searchCatalog([...index, index[4]], 'תרסיס חלונות')), ['exact', 'prefix', 'phrase', 'separated']);
});

test('name-only indexing never resolves brands or reads full product descriptions', () => {
  const product = { id: 'fast', name: 'תרסיס חלונות', get description() { throw Error('Expensive metadata must not be read'); }, get tags() { throw Error('Brand matching must not run'); } };
  const index = searchLogic.indexCatalog([product], [brand], 'name');
  assert.deepEqual(ids(searchLogic.searchCatalog(index, 'חלונ')), ['fast']);
});

test('remote supplementation preserves local ranking and removes duplicates', () => {
  assert.deepEqual(ids(searchLogic.mergeSearchProducts(products, [{ ...products[0] }, { id: 'c' }])), ['a', 'b', 'c']);
  assert.deepEqual(ids(products), ['a', 'b']);
});

test('discovery shuffles without mutating catalog and keeps visible items in place as pages arrive', () => {
  const source = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];
  const first = discoveryLogic.updateDiscoveryProducts([], source, () => 0);
  assert.deepEqual(ids(first), ['b', 'c', 'a']);
  assert.deepEqual(ids(source), ['a', 'b', 'c']);
  const updatedA = { id: 'a', name: 'updated' };
  const next = discoveryLogic.updateDiscoveryProducts(first, [updatedA, source[1], source[2], { id: 'd' }, { id: 'e' }], () => 0);
  assert.deepEqual(ids(next), ['b', 'c', 'a', 'e', 'd']);
  assert.equal(next[2], updatedA, 'retain order but use the latest product details');
  assert.deepEqual(ids(discoveryLogic.updateDiscoveryProducts(next, [{ id: 'd' }, updatedA], () => 0)), ['a', 'd']);
});

const nodes = node => !node || typeof node !== 'object' ? [] : [node, ...(node.props?.children ?? []).flat(Infinity).flatMap(nodes)];

test('screen shows local matches before debounce/network; switching and clearing excludes late results', async () => {
  const r = runtime();
  const indexedScopes = [];
  const remoteData = new Map();
  const discoveryHook = r.load('src/hooks/useDiscoveryProducts.ts', { '../lib/productDiscovery': discoveryLogic });
  const screen = r.load('src/screens/store/StoreSearchScreen.tsx', {
    'react-native': { View: 'View', Text: 'Text', Image: 'Image', TextInput: 'Input', FlatList: 'List', Pressable: 'Button', RefreshControl: 'Refresh', ActivityIndicator: 'Spinner', Keyboard: { dismiss() {} }, StyleSheet: { create: x => x }, useWindowDimensions: () => ({ width: 390 }) },
    '@expo/vector-icons': { Ionicons: 'Icon' },
    '@tanstack/react-query': { useQuery: options => ({ data: remoteData.get(options.queryKey[1]), isFetching: false, isError: false, refetch: async () => {} }) },
    'react-native-safe-area-context': { SafeAreaView: 'SafeArea', useSafeAreaInsets: () => ({ bottom: 0 }) },
    '../../lib/shopify': { searchProducts: async () => [] },
    '../../lib/brands': brands,
    '../../lib/catalogSearch': { ...searchLogic, indexCatalog: (...args) => { indexedScopes.push(args[2]); return searchLogic.indexCatalog(...args); } },
    '../../lib/favorites': { favoriteInputFromStoreProduct: x => x },
    '../../hooks/useBrands': { useBrands: () => ({ data: [brand] }) },
    '../../hooks/useStoreCatalog': { useStoreCatalog: () => ({ products, isFetching: false, isError: false, refetch: async () => {} }) },
    '../../hooks/useDiscoveryProducts': discoveryHook,
    '../../state/FavoritesContext': { useFavorites: () => ({ isFavorite: () => false, isFavoritePending: () => false, toggleFavorite() {} }) },
    '../../state/CartContext': { useCart: () => ({ itemCount: 0 }) },
    '../../state/useOcdPlusMembership': { useOcdPlusMembership: () => ({ isActiveMember: false }) },
    '../../context/OcdPlusSubscribeSheetContext': { useOcdPlusSubscribeSheet: () => ({ openOcdPlusSubscribeSheet() {} }) },
    '../../theme/homeTypography': { homeTypography: {} },
    './StoreHomeScreen': { getStoreBottomBarMetrics: () => ({ contentPaddingBottom: 100 }), HomeHighlightRailCard: 'Card', StoreFloatingTabBar: 'Tabs', toStoreProduct: x => x },
  });
  let opened;
  r.mount(() => screen.StoreSearchScreen({ onBack() {}, onTabPress() {}, onOpenProduct(product) { opened = product; } }));
  const list = () => nodes(r.tree()).find(node => node.type === 'List').props;
  const type = async value => { nodes(r.tree()).find(node => node.type === 'Input').props.onChangeText(value); await r.flush(); };
  const discoveryIds = ids(list().data);
  assert.deepEqual([...discoveryIds].sort(), ['a', 'b']);
  assert.equal(list().numColumns, 4);
  assert.equal(indexedScopes.length, 0, 'opening search must not index the catalog');
  assert.ok(list().initialNumToRender * list().numColumns <= 24, 'initial render is rows, not individual tiles');
  const tile = list().renderItem({ item: products[0] });
  tile.props.onPress();
  assert.equal(opened, products[0]);
  assert.equal(nodes(tile).some(node => node.type === 'Text'), false, 'discovery tiles have no visible text');
  await type('חלונות');
  assert.ok(indexedScopes.every(scope => scope === 'name'), 'typing builds only the lightweight name index');
  assert.deepEqual(ids(list().data), ['a'], 'local results before the 300ms debounce');
  assert.equal(list().numColumns, 2);
  const resultCard = list().renderItem({ item: products[0] });
  assert.equal(resultCard.type, 'Card', 'search uses the shared category product card');
  assert.equal(resultCard.props.cardWidth, 174);
  await r.tick(300);
  remoteData.set('חלונות', [{ ...products[0], id: 'remote-old', name: 'תרסיס חלונות נוסף' }, { ...products[0], id: 'unrelated', name: 'מטלית', description: 'חלונות' }]);
  r.render();
  assert.deepEqual(ids(list().data), ['a', 'remote-old']);
  await type('כביסה');
  assert.deepEqual(ids(list().data), ['b'], 'previous remote response is excluded immediately');
  await r.tick(300);
  await type('');
  remoteData.set('כביסה', [{ ...products[1], id: 'late-laundry' }]);
  r.render();
  assert.deepEqual(ids(list().data), discoveryIds, 'clearing restores the same discovery order; late responses cannot replace it');
  assert.equal(list().numColumns, 4);
  const brandRail = nodes(list().ListHeaderComponent).find(node => node.type === 'List' && node.props.horizontal);
  brandRail.props.renderItem({ item: brand }).props.onPress();
  await r.flush();
  assert.deepEqual(ids(list().data), ['a'], 'brand chip still matches products whose title does not contain the brand');
  assert.equal(list().numColumns, 2);
  await type(brand.label);
  assert.deepEqual(ids(list().data), [], 'editing the input switches back to name-only matching');
  r.unmount();
  assert.equal(r.pendingTimers(), 0);
});
