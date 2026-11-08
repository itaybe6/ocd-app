const test = require('node:test');
const assert = require('node:assert/strict');
const { runtime } = require('./helpers/hook-runtime.cjs');

const { selectEntryProducts, productDiscount } = runtime().load('src/components/HomeCompactIntro.tsx', {
  'react-native': { StyleSheet: { create: styles => styles } },
  'lucide-react-native': {},
});
const product = (id, overrides = {}) => ({ id, price: 90, compareAtPrice: 100, availableForSale: true, imageUrl: 'product.jpg', ...overrides });

test('offers use real reductions without overclaiming or floating-point undercounting', () => {
  assert.equal(productDiscount(product('a')), 10);
  assert.equal(productDiscount(product('b', { price: 39.9, compareAtPrice: 46 })), 13);
  for (const compareAtPrice of [null, 0, 80, 90, Infinity, NaN]) {
    assert.equal(productDiscount(product('c', { compareAtPrice })), 0);
  }
  assert.equal(productDiscount(product('d', { price: 0 })), 0);
});

test('empty sale collection can showcase actual discounted catalog products', () => {
  const catalog = [product('regular', { compareAtPrice: null }), product('offer-a'), product('offer-b')];
  assert.deepEqual(Array.from(selectEntryProducts([], catalog), p => p.id), ['offer-a', 'offer-b']);
  assert.equal(catalog[0].id, 'regular', 'do not reorder the shared catalog');
});

test('duplicates, sold-out and invalid prices do not take promotional slots', () => {
  const sale = [product('sold', { availableForSale: false }), product('first'), product('invalid', { price: NaN })];
  const catalog = [product('first'), product('free', { price: 0 }), product('second')];
  assert.deepEqual(Array.from(selectEntryProducts(sale, catalog), p => p.id), ['first', 'second']);
});

test('ordinary available products remain reachable when there are no discounts', () => {
  const selected = selectEntryProducts([], [product('a', { compareAtPrice: null }), product('b', { compareAtPrice: 90 })]);
  assert.equal(selected.length, 2);
  assert.ok(selected.every(p => productDiscount(p) === 0));
  assert.equal(selectEntryProducts([], []).length, 0);
});
