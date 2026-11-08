const test = require('node:test');
const assert = require('node:assert/strict');
const { runtime } = require('./helpers/hook-runtime.cjs');
const logic = runtime().load('src/lib/catalogFilters.ts', {});
const { EMPTY_CATALOG_FILTERS: defaults, filterCatalogProducts: filter, catalogPriceError, countCatalogFilters } = logic;
const products = [
  { id: 'a', name: 'תרסיס ניקוי', subtitle: 'מטבח', description: 'לניקוי הבית', price: 25.5, compareAtPrice: 40, availableForSale: true, vendor: ' Sucitesa ' },
  { id: 'b', name: 'נוזל כביסה', subtitle: 'כביסה', description: '', price: 55, compareAtPrice: 55, availableForSale: false, vendor: 'סנו' },
  { id: 'c', name: 'מטלית', subtitle: 'אביזרים', description: 'למטבח', price: 0, compareAtPrice: null, availableForSale: true, vendor: null },
  { id: 'd', name: 'תרסיס לניקוי חלונות', subtitle: 'ניקיון', description: '', price: 25.5, compareAtPrice: 20, availableForSale: true, vendor: 'סנו' },
];
const ids = values => Array.from(values, p => p.id);

test('price boundaries include zero and decimal values; independent filters combine correctly', () => {
  assert.deepEqual(ids(filter(products, '', { ...defaults, minPrice: '0', maxPrice: '25,50' })), ['a', 'c', 'd']);
  assert.deepEqual(ids(filter(products, '', { ...defaults, inStock: true, saleOnly: true, vendors: ['Sucitesa'] })), ['a']);
  assert.deepEqual(ids(filter(products, '', { ...defaults, vendors: ['סנו'], inStock: true })), ['d']);
});

test('search matches all words across fields and brands, ignoring case and extra spaces', () => {
  assert.deepEqual(ids(filter(products, '  SUCITESA   מטבח ', defaults)), ['a']);
  assert.deepEqual(ids(filter(products, 'לא קיים', defaults)), []);
});

test('sorting is stable, does not mutate source, and reset restores original category order', () => {
  assert.deepEqual(ids(filter(products, '', { ...defaults, sort: 'price-asc' })), ['c', 'a', 'd', 'b']);
  assert.deepEqual(ids(filter(products, '', { ...defaults, sort: 'price-desc' })), ['b', 'a', 'd', 'c']);
  assert.deepEqual(ids(filter(products, '', defaults)), ['a', 'b', 'c', 'd']);
  assert.deepEqual(ids(products), ['a', 'b', 'c', 'd']);
  assert.equal(countCatalogFilters({ ...defaults, minPrice: '0', maxPrice: '40', saleOnly: true, vendors: ['סנו'], sort: 'price-asc' }), 4);
});

test('invalid prices and inverted ranges are rejected; empty and equal bounds are allowed', () => {
  for (const patch of [{ minPrice: '-1' }, { maxPrice: 'abc' }, { maxPrice: 'Infinity' }, { minPrice: '50', maxPrice: '10' }]) assert.ok(catalogPriceError({ ...defaults, ...patch }));
  assert.equal(catalogPriceError(defaults), null);
  assert.equal(catalogPriceError({ ...defaults, minPrice: '25.5', maxPrice: '25,50' }), null);
});

test('filters include products beyond a first page and handle empty categories', () => {
  const full = Array.from({ length: 600 }, (_, i) => ({ ...products[0], id: String(i), price: i }));
  assert.deepEqual(ids(filter(full, '', { ...defaults, minPrice: '599' })), ['599']);
  assert.deepEqual(ids(filter([], '', defaults)), []);
});

function nodes(node) { return !node || typeof node !== 'object' ? [] : [node, ...(node.props?.children ?? []).flat(Infinity).flatMap(nodes)]; }
async function sheet() {
  const h = runtime(); let visible = true, applied = defaults, closes = 0, saved = 0;
  const { CatalogFilterSheet } = h.load('src/components/CatalogFilterSheet.tsx', {
    'react-native': { Keyboard: { dismiss() {} }, KeyboardAvoidingView: 'KeyboardAvoidingView', Platform: { OS: 'ios' }, Pressable: 'Pressable', Switch: 'Switch', Text: 'Text', TextInput: 'TextInput', View: 'View', StyleSheet: { create: x => x }, useWindowDimensions: () => ({ height: 800 }) },
    '@expo/vector-icons': { Ionicons: 'Icon' },
    'react-native-safe-area-context': { useSafeAreaInsets: () => ({ bottom: 20 }) },
    './ModalSheet': { ModalSheet: 'ModalSheet', SheetScrollView: 'ScrollView' },
    '../lib/catalogFilters': logic,
  });
  h.mount(() => CatalogFilterSheet({ visible, filters: applied, products, query: '', onClose: () => { closes++; visible = false; }, onApply: next => { applied = next; saved++; visible = false; } }));
  await h.flush();
  return { ...h, find: label => nodes(h.tree()).find(n => n.props?.accessibilityLabel === label),
    apply: () => nodes(h.tree()).find(n => n.type === 'Pressable' && n.props?.children?.some(c => c?.type === 'Text' && String(c.props.children).includes('הצגת'))),
    reopen: async () => { h.render(); visible = true; h.render(); await h.flush(); },
    values: () => ({ applied, saved, closes }) };
}

test('filter edits remain draft on close and reopen restores applied settings', async () => {
  const h = await sheet(); h.find('מחיר מינימלי').props.onChangeText('20'); await h.flush();
  assert.equal(h.values().applied.minPrice, '');
  h.find('סגירת הסינון').props.onPress(); await h.reopen();
  assert.equal(h.find('מחיר מינימלי').props.value, ''); assert.equal(h.values().saved, 0);
});

test('invalid drafts disable apply; valid zero-result filters can be applied', async () => {
  const h = await sheet(); h.find('מחיר מינימלי').props.onChangeText('100'); h.find('מחיר מקסימלי').props.onChangeText('10'); await h.flush();
  assert.equal(h.apply().props.disabled, true);
  h.find('מחיר מקסימלי').props.onChangeText(''); await h.flush();
  assert.equal(h.apply().props.disabled, false);
  assert.ok(nodes(h.apply()).some(n => n.type === 'Text' && String(n.props.children).includes('הצגת 0 מוצרים')));
  h.apply().props.onPress(); assert.equal(h.values().applied.minPrice, '100'); assert.equal(h.values().saved, 1);
});
