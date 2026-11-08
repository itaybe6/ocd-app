const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('fs'), ts = require('typescript'), vm = require('vm');
const { runtime } = require('./helpers/hook-runtime.cjs');
const code = ts.transpileModule(fs.readFileSync('src/screens/store/StoreHomeScreen.tsx', 'utf8'), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React } }).outputText;
const home = { exports: {} };
vm.runInNewContext(code, { module: home, exports: home.exports, require: name => name === 'react-native' ? { StyleSheet: { create: x => x } } : name === '../../theme/radii' ? { radii: {} } : name === '../../theme/storeAccent' ? { storeAccent: {} } : {} });
const r = runtime(), favorites = r.load('src/lib/favorites.ts', {}), feed = r.load('src/lib/homeShoppingFeed.ts', {});
const nodes = n => !n || typeof n !== 'object' ? [] : [n, ...(n.props?.children ?? []).flat(Infinity).flatMap(nodes)];
const live = (extra = {}) => ({ id: 'p', title: 'תרסיס חדש', handle: 'spray', description: '', productType: 'ניקיון', price: 39.9, currencyCode: 'ILS', imageUrl: 'photo', tags: [], collectionHandles: [], collectionTitles: [], availableForSale: true, variantId: 'real-variant', variants: [{ id: 'real-variant', availableForSale: true }], ...extra });
function setup(liveProduct, details = {}) {
  const h = runtime(); let options, opened = 0, removed = 0, retries = 0;
  const { FavoriteCatalogCard } = h.load('src/components/FavoriteCatalogCard.tsx', {
    'react-native': { View: 'View', Text: 'Text', Pressable: 'Button', Keyboard: { dismiss() {} }, StyleSheet: { create: x => x } },
    '@tanstack/react-query': { useQuery: value => { options = value; return { isPending: false, refetch: () => retries++, ...details }; } },
    '../lib/shopify': { fetchProductByHandle: async () => live() },
    '../lib/storeResources': { STORE_RESOURCES_KEY: ['store-resources', 'v1'] },
    '../lib/favorites': favorites, '../lib/homeShoppingFeed': feed,
    '../screens/store/StoreHomeScreen': { HomeHighlightRailCard: 'HomeCard', toStoreProduct: home.exports.toStoreProduct },
  });
  h.mount(() => FavoriteCatalogCard({ favorite: { product_id: 'p', product_handle: 'spray', product_title: 'ישן', price: 1, currency_code: 'ILS' }, liveProduct, width: 174, brands: [], isSubscriber: true, pending: false, onRemove: () => removed++, onOpenProduct: () => opened++, onOpenMembership() {} }));
  return { ...h, card: () => nodes(h.tree()).find(n => n.type === 'HomeCard'), options: () => options, opened: () => opened, removed: () => removed, retries: () => retries };
}
test('single-variant favorite uses the real home card with current price, stock and cart variant', () => {
  const h = setup(live()), p = h.card().props;
  assert.equal(p.product.variantId, 'real-variant'); assert.equal(p.product.price, 39.9);
  assert.equal(p.product.availableForSale, true); assert.equal(p.onChooseVariant, undefined);
  assert.equal(p.isOcdPlusSubscriber, true); assert.equal(p.favorite, true); assert.equal(h.options().enabled, false);
  p.onToggleFavorite(); assert.equal(h.removed(), 1); h.unmount();
});
test('multiple options require selection and sold-out products cannot add', () => {
  const h = setup(live({ variants: [{ availableForSale: true }, { availableForSale: false }] }));
  h.card().props.onChooseVariant(); assert.equal(h.opened(), 1);
  const sold = setup(live({ availableForSale: false, variants: [{ availableForSale: false }] }));
  assert.equal(sold.card().props.product.availableForSale, false); assert.equal(sold.card().props.canChooseVariant, false);
  h.unmount(); sold.unmount();
});
test('missing catalog entries use shared details cache; saved snapshots alone cannot add', () => {
  const h = setup(undefined, { isPending: true });
  assert.equal(h.options().enabled, true);
  assert.deepEqual(Array.from(h.options().queryKey), ['store-resources', 'v1', 'product', 'spray']);
  assert.equal(h.card().props.product.variantId, ''); assert.equal(h.card().props.product.availableForSale, false);
  const loaded = setup(undefined, { data: live() });
  assert.equal(loaded.card().props.product.variantId, 'real-variant'); assert.equal(loaded.card().props.onChooseVariant, undefined);
  h.unmount(); loaded.unmount();
});
test('failed and removed products remain removable, with retry on errors', () => {
  for (const details of [{ isError: true }, { data: null }]) {
    const h = setup(undefined, details);
    assert.equal(h.card().props.product.availableForSale, false);
    h.card().props.onToggleFavorite(); assert.equal(h.removed(), 1);
    if (details.isError) { nodes(h.tree()).find(n => n.type === 'Button').props.onPress(); assert.equal(h.retries(), 1); }
    h.unmount();
  }
});
