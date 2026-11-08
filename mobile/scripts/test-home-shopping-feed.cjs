const test = require('node:test');
const assert = require('node:assert/strict');
const { runtime } = require('./helpers/hook-runtime.cjs');
const helpers = runtime().load('src/lib/homeShoppingFeed.ts', {});
const product = (id, extra = {}) => ({ id, name: id, price: 40, currencyCode: 'ILS', availableForSale: true, variantId: `v-${id}`, variantCount: 1, ...extra });
const ids = items => Array.from(items, p => p.id);
const nodes = node => !node || typeof node !== 'object' || (node.type === 'ModalSheet' && !node.props.visible) ? [] : [node, ...(node.props?.children ?? []).flat(Infinity).flatMap(nodes)];

test('feed includes the catalog, deduplicates offers and moves sold-out items down without mutating inputs', () => {
  const catalog = [product('regular'), product('offer', { compareAtPrice: 60 }), product('sold', { availableForSale: false })];
  const sale = [catalog[2], catalog[1]];
  assert.deepEqual(ids(helpers.selectHomeFeedProducts('all', catalog, sale, [], [])), ['offer', 'regular', 'sold']);
  assert.deepEqual(ids(catalog), ['regular', 'offer', 'sold']);
  assert.deepEqual(ids(helpers.selectHomeFeedProducts('sale', catalog, [], [], [])), ['offer']);
});

test('best-selling and newest preserve provider order, excluding invalid prices', () => {
  const catalog = [product('a'), product('b'), product('c')];
  assert.deepEqual(ids(helpers.selectHomeFeedProducts('popular', catalog, [], [catalog[1], catalog[0]], [])), ['b', 'a', 'c']);
  assert.deepEqual(ids(helpers.selectHomeFeedProducts('new', catalog, [], [], [catalog[2], product('bad', { price: NaN }), catalog[0]])), ['c', 'a']);
});

test('multiple and unknown variants require selection, including an available alternative to a sold-out first variant', () => {
  for (const variantCount of [undefined, 0, 2, 20]) assert.equal(helpers.needsVariantSelection(product('a', { variantCount })), true);
  assert.equal(helpers.needsVariantSelection(product('a')), false);
  assert.equal(helpers.isPurchasable(product('a', { availableForSale: false, hasAvailableVariant: true })), true);
});

function harness({ popular = [] } = {}) {
  const h = runtime(), opened = [];
  const exports = h.load('src/components/HomeShoppingFeed.tsx', {
    'react-native': { ...Object.fromEntries(['View', 'Text', 'Image', 'Pressable', 'ScrollView', 'FlatList', 'ActivityIndicator'].map(n => [n, n])), StyleSheet: { create: x => x } },
    'lucide-react-native': {},
    'react-native-safe-area-context': { useSafeAreaInsets: () => ({ top: 59, bottom: 34 }) },
    './ModalSheet': { ModalSheet: 'ModalSheet' },
    './HomeCategoryIcon': { HomeCategoryIcon: 'CategoryIcon' },
    './HomePromotionBanner': { HomePromotionBanner: 'PromotionBanner' },
    '../lib/homeShoppingFeed': helpers,
  });
  const catalog = Array.from({ length: 25 }, (_, i) => product(String(i)));
  const collection = products => ({ id: 'collection', title: 'collection', products });
  h.mount(() => exports.HomeShoppingFeed({ catalog, sale: collection([]), popular: collection(popular), newest: collection([catalog[24]]), categories: [], loading: false, onRetry() {}, onOpenProduct: p => opened.push(p.id), onOpenCollection() {}, renderProduct: (product, onOpen) => h.react.createElement('CategoryCard', { product, onPress: onOpen }) }));
  return { ...h, opened, cards: () => nodes(h.tree()).filter(n => n.type === 'CategoryCard'), button: label => nodes(h.tree()).find(n => n.type === 'Pressable' && (n.props.accessibilityLabel === label || nodes(n).some(c => c.type === 'Text' && c.props.children.includes(label)))) };
}

test('grid starts with eight products, expands by eight and resets after choosing a filter', async () => {
  const h = harness();
  assert.equal(h.cards().length, 8);
  assert.equal(h.button('חדש אצלנו'), undefined, 'filter options are hidden until the sheet opens');
  h.button('עוד מוצרים').props.onPress(); await h.flush();
  assert.equal(h.cards().length, 16);
  h.button('מיון וסינון').props.onPress(); await h.flush();
  h.button('חדש אצלנו').props.onPress(); await h.flush();
  assert.deepEqual(ids(h.cards().map(n => n.props.product)), ['24']);
  assert.equal(h.button('מיון וסינון').props.accessibilityState.expanded, false);
  assert.ok(nodes(h.tree()).some(n => n.props.accessibilityRole === 'header' && n.props.children.includes('חדש אצלנו')));
  h.button('מיון וסינון').props.onPress(); await h.flush();
  h.button('הכל').props.onPress(); await h.flush();
  assert.equal(h.cards().length, 8);
  assert.ok(nodes(h.tree()).some(n => n.props.accessibilityRole === 'header' && n.props.children.includes('כל המוצרים')));
});

test('best-selling uses the ranked catalog when the short collection is unavailable', async () => {
  const h = harness();
  assert.deepEqual(ids(h.cards().map(n => n.props.product)), ['0', '1', '2', '3', '4', '5', '6', '7']);
  assert.ok(nodes(h.tree()).some(n => n.props.accessibilityRole === 'header' && n.props.children.includes('הכי נמכרים')));
  h.button('מיון וסינון').props.onPress(); await h.flush();
  assert.equal(h.button('הכי נמכרים').props.accessibilityState.checked, true);
});

test('closing the filter sheet preserves the selected mode and expanded product count', async () => {
  const h = harness();
  h.button('עוד מוצרים').props.onPress(); await h.flush();
  h.button('מיון וסינון').props.onPress(); await h.flush();
  assert.equal(h.button('הכי נמכרים').props.accessibilityState.checked, true);
  h.button('סגירת מיון וסינון').props.onPress(); await h.flush();
  assert.equal(h.cards().length, 16);
  assert.equal(h.button('מיון וסינון').props.accessibilityState.expanded, false);
  assert.equal(h.button('הכל'), undefined);
});

test('the shared card renderer receives each product and its detail-page action', () => {
  const h = harness();
  h.cards()[0].props.onPress(); h.cards()[7].props.onPress();
  assert.deepEqual(h.opened, ['0', '7']);
});

test('default best sellers keep provider order across four rows and load more without duplicates', async () => {
  const popular = [product('12'), product('3'), product('7')];
  const h = harness({ popular });
  assert.deepEqual(ids(h.cards().map(n => n.props.product)), ['12', '3', '7', '0', '1', '2', '4', '5']);
  h.button('עוד מוצרים').props.onPress(); await h.flush();
  assert.equal(h.cards().length, 16);
  h.button('עוד מוצרים').props.onPress(); await h.flush();
  assert.equal(h.cards().length, 24);
  h.button('עוד מוצרים').props.onPress(); await h.flush();
  const shown = ids(h.cards().map(n => n.props.product));
  assert.equal(shown.length, 25);
  assert.equal(new Set(shown).size, 25);
  assert.equal(h.button('עוד מוצרים'), undefined);
  h.button('מיון וסינון').props.onPress(); await h.flush();
  h.button('חדש אצלנו').props.onPress(); await h.flush();
  assert.deepEqual(ids(h.cards().map(n => n.props.product)), ['24']);
  h.button('מיון וסינון').props.onPress(); await h.flush();
  h.button('הכי נמכרים').props.onPress(); await h.flush();
  assert.equal(h.cards().length, 8);
  assert.equal(h.cards()[0].props.product.id, '12');
});
