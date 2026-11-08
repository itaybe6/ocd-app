const test = require('node:test');
const assert = require('node:assert/strict');
const { runtime } = require('./helpers/hook-runtime.cjs');

const nodes = node => !node || typeof node !== 'object' ? [] : [node, ...(node.props?.children ?? []).flat(Infinity).flatMap(nodes)];
const text = node => typeof node === 'string' || typeof node === 'number' ? String(node) : node?.props?.children?.flat(Infinity).map(text).join('') ?? '';
const fixture = {
  id: 'p', handle: 'cleaner', title: 'תרסיס חלונות', price: 37.9, compareAtPrice: 47,
  currencyCode: 'ILS', availableForSale: true, variantId: 'v1', variantTitle: '750 מל',
  description: 'פרטי המוצר', descriptionHtml: '<p>פרטי המוצר</p>', productType: 'ניקיון',
  tags: [], media: [], imageUrl: 'https://example.test/a.png', imageAltText: 'ראשית',
  images: [{ url: 'https://example.test/a.png' }, { url: 'https://example.test/b.png' }],
  variants: [
    { id: 'v1', title: '750 מל', price: 37.9, compareAtPrice: 47, currencyCode: 'ILS', availableForSale: true, imageUrl: 'https://example.test/a.png' },
    { id: 'v2', title: 'ליטר', price: 49.5, compareAtPrice: null, currencyCode: 'ILS', availableForSale: true, imageUrl: 'https://example.test/b.png' },
    { id: 'v3', title: 'לא זמין', price: 69, currencyCode: 'ILS', availableForSale: false },
  ],
};

function setup({ product = fixture, quantity = 0, member = false, tiers = [], fail = false, cached, fetchProduct } = {}) {
  const r = runtime(), added = [], updated = [], navigation = [];
  const resources = { fetchProductByHandle: fetchProduct ?? (async () => { if (fail) throw Error('offline'); return product; }), fetchProductBundleTiers: async () => tiers, readProduct: () => cached };
  const catalog = r.load('src/screens/store/ProductScreen.tsx', {
    'react-native': { View: 'View', Text: 'Text', Image: 'Image', FlatList: 'List', ScrollView: 'Scroll', Pressable: 'Button', Modal: 'Modal', StatusBar: 'StatusBar', ActivityIndicator: 'Spinner', StyleSheet: { create: x => x, hairlineWidth: 1 }, useWindowDimensions: () => ({ width: 390, height: 844 }), Share: { share: async () => {} } },
    '@expo/vector-icons': { Ionicons: 'Icon' },
    'expo': { useEvent() {} },
    'expo-video': { useVideoPlayer() {}, VideoView: 'Video' },
    'react-native-safe-area-context': { useSafeAreaInsets: () => ({ top: 44, bottom: 34 }) },
    '../../lib/favorites': { favoriteInputFromShopify: x => x },
    '../../lib/shopify': { fetchProductByHandle: async () => { if (fail) throw Error('offline'); return product; }, fetchProductBundleTiers: async () => tiers },
    '../../hooks/useStoreResources': { useStoreResources: () => resources },
    '../../hooks/useProductViewTracking': { useProductViewTracking() {} },
    '../../lib/productBundles': { bundleTiersForVariant: tiers => tiers, isCatalogBundleProduct: () => false },
    '../../state/CartContext': { useCart: () => ({ addItem: (...args) => added.push(args), updateQuantity: (...args) => updated.push(args), getQuantity: () => quantity, isMutating: false }) },
    '../../state/FavoritesContext': { useFavorites: () => ({ isFavorite: () => false, isFavoritePending: () => false, toggleFavorite() {} }) },
    '../../hooks/useBrands': { useBrands: () => ({ data: [] }) },
    '../../lib/brands': { findProductBrand: () => null, normalizeBrandImageUrl: value => value ?? null },
    '../../components/ProductDescription': { ProductDescription: 'Description' },
    '../../components/FavoriteToggleButton': { FavoriteToggleButton: 'FavoriteButton' },
    '../../components/ProductReviews': { ProductReviews: 'Reviews' },
    '../../components/ProductBundlePicker': { ProductBundlePicker: 'Bundles' },
    '../../components/OcdPlusProductPriceBlock': { computeOcdPlusPrice: price => Math.round(price * 0.87 * 100) / 100 },
    '../../components/OcdPlusMark': { OcdPlusMark: 'Mark' },
    '../../context/OcdPlusSubscribeSheetContext': { useOcdPlusSubscribeSheet: () => ({ openOcdPlusSubscribeSheet() {} }) },
    '../../state/useOcdPlusMembership': { useOcdPlusMembership: () => ({ isActiveMember: member }) },
    '../../components/BottomSheetScreen': { useInBottomSheet: () => true },
  });
  r.mount(() => catalog.ProductScreen({ navigation: { goBack: () => navigation.push('back'), navigate: (...args) => navigation.push(args) }, route: { params: { handle: product?.handle ?? 'missing' } } }));
  const all = () => nodes(r.tree());
  const button = label => all().find(node => node.props.accessibilityLabel === label);
  const click = async label => { const b = button(label); assert.ok(b, 'Missing action: ' + label); assert.ok(!b.props.disabled); b.props.onPress(); await r.flush(); };
  return { r, added, updated, navigation, all, button, click, content: () => text(r.tree()) };
}

test('decimal prices render correctly; quantity and chosen variant reach the cart', async () => {
  const s = setup(); await s.r.flush();
  assert.ok(s.content().includes('₪37.90'));
  assert.ok(!s.content().includes('37.9.00'));
  const gallery = s.all().find(node => node.type === 'List');
  const slide = gallery.props.renderItem({ item: gallery.props.data[0], index: 0 });
  assert.equal(nodes(slide).find(node => node.type === 'Image').props.resizeMode, 'contain');
  await s.click('ליטר');
  assert.ok(s.content().includes('₪49.50'));
  assert.equal(s.button('לא זמין, לא במלאי').props.disabled, true);
  await s.click('הוסף כמות');
  await s.click('הוסף לעגלה');
  assert.equal(s.added[0][0].variantId, 'v2');
  assert.equal(s.added[0][0].price, 49.5);
  assert.equal(s.added[0][1], 2);
  s.r.unmount(); assert.equal(s.r.pendingTimers(), 0);
});

test('existing cart quantity can still be updated or removed', async () => {
  const s = setup({ quantity: 2 }); await s.r.flush();
  await s.click('הוסף כמות');
  await s.click('עדכן כמות בעגלה');
  assert.deepEqual(s.updated[0], ['p', 3]);
  await s.click('הפחת כמות');
  await s.click('הסר מוצר מהעגלה');
  assert.deepEqual(s.updated[1], ['p', 0]);
  s.r.unmount();
});

test('bundle selection retains bundle variant and total pricing', async () => {
  const s = setup({ tiers: [{ qty: 3, price: 90, variantId: 'bundle-v', label: 'שלישייה', availableForSale: true }] }); await s.r.flush();
  s.all().find(node => node.type === 'Bundles').props.onSelect(3);
  await s.r.flush();
  await s.click('הוסף לעגלה');
  assert.equal(s.added[0][0].variantId, 'bundle-v');
  assert.equal(s.added[0][0].price, 90);
  assert.equal(s.added[0][1], 1);
  s.r.unmount();
});

test('member pricing and out-of-stock states remain accurate', async () => {
  const s = setup({ member: true }); await s.r.flush();
  assert.ok(s.content().includes('₪32.97'));
  assert.ok(s.content().includes('מחיר חבר'));
  s.r.unmount();
  const sold = setup({ product: { ...fixture, availableForSale: false, variants: [{ ...fixture.variants[0], availableForSale: false }] } });
  await sold.r.flush();
  assert.equal(sold.button('לא זמין').props.disabled, true);
  assert.equal(sold.button('הוסף כמות').props.disabled, true);
  sold.r.unmount();
});

test('gallery opens and closes the correct full-screen image, with back available on load failure', async () => {
  const s = setup(); await s.r.flush();
  const gallery = s.all().find(node => node.type === 'List');
  gallery.props.renderItem({ item: gallery.props.data[1], index: 1 }).props.onPress();
  await s.r.flush();
  const modal = s.all().find(node => node.type === 'Modal');
  assert.equal(modal.props.visible, true);
  assert.equal(nodes(modal).find(node => node.type === 'List').props.initialScrollIndex, 1);
  await s.click('סגירת התמונה המוגדלת');
  assert.equal(s.all().find(node => node.type === 'Modal').props.visible, false);
  s.r.unmount();
  const failed = setup({ fail: true }); await failed.r.flush();
  assert.ok(failed.content().includes('ניסיון נוסף'));
  const back = failed.all().find(node => node.props.label === 'חזרה');
  back.props.onPress();
  assert.deepEqual(failed.navigation, ['back']);
  failed.r.unmount();
});

test('reopening a cached product displays it before a background refresh resolves', async () => {
  let resolve;
  const pending = new Promise(done => { resolve = done; });
  const s = setup({ cached: fixture, fetchProduct: () => pending });
  assert.ok(s.content().includes('₪37.90'));
  assert.equal(s.all().some(node => node.type === 'Spinner'), false);
  resolve({ ...fixture, price: 40, variants: [{ ...fixture.variants[0], price: 40 }] });
  await s.r.flush();
  assert.ok(s.content().includes('₪40.00'));
  await s.click('הוסף לעגלה');
  assert.equal(s.added[0][0].price, 40);
  s.r.unmount();
});

test('long galleries keep a bounded RTL dot window around the actual image index', async () => {
  const images = Array.from({ length: 40 }, (_, i) => ({ url: `https://example.test/${i}.png` }));
  const s = setup({ product: { ...fixture, images, variants: [{ ...fixture.variants[0], imageUrl: images[0].url }] } });
  await s.r.flush();
  const dots = () => s.all().filter(node => /^תמונה \d+$/.test(node.props.accessibilityLabel ?? ''));
  const labels = () => dots().map(node => node.props.accessibilityLabel);
  assert.deepEqual(labels(), ['תמונה 1', 'תמונה 2', 'תמונה 3', 'תמונה 4', 'תמונה 5']);
  const row = s.all().find(node => node.props.children?.flat(Infinity).includes(dots()[0]));
  assert.equal(row.props.style.direction, 'ltr');
  assert.equal(row.props.style.flexDirection, 'row-reverse');
  const gallery = s.all().find(node => node.type === 'List');
  const swipe = async index => {
    gallery.props.onMomentumScrollEnd({ nativeEvent: { contentOffset: { x: index * 358 } } });
    await s.r.flush();
  };
  await swipe(19);
  assert.deepEqual(labels(), ['תמונה 18', 'תמונה 19', 'תמונה 20', 'תמונה 21', 'תמונה 22']);
  assert.equal(s.button('תמונה 20').props.accessibilityState.selected, true);
  await s.click('תמונה 22');
  assert.equal(s.button('תמונה 22').props.accessibilityState.selected, true);
  assert.ok(s.content().includes('22 / 40'));
  await swipe(39);
  assert.deepEqual(labels(), ['תמונה 36', 'תמונה 37', 'תמונה 38', 'תמונה 39', 'תמונה 40']);
  assert.equal(s.button('תמונה 40').props.accessibilityState.selected, true);
  await swipe(0);
  assert.equal(s.button('תמונה 1').props.accessibilityState.selected, true);
  s.r.unmount();
});

test('small galleries show all dots and single-image products need no pagination', async () => {
  const s = setup(); await s.r.flush();
  assert.ok(s.button('תמונה 1'));
  assert.ok(s.button('תמונה 2'));
  assert.equal(s.button('תמונה 3'), undefined);
  s.r.unmount();
  const single = setup({ product: { ...fixture, images: [fixture.images[0]], variants: [fixture.variants[0]] } });
  await single.r.flush();
  assert.equal(single.button('תמונה 1'), undefined);
  single.r.unmount();
});
