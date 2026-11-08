const test = require('node:test');
const assert = require('node:assert/strict');
const { runtime } = require('./helpers/hook-runtime.cjs');
const nodes = node => !node || typeof node !== 'object' ? [] : [node, ...(node.props?.children ?? []).flat(Infinity).flatMap(nodes)];
function setup({ guest = false } = {}) {
  const r = runtime(), opened = [], removed = [], tabs = [];
  const favorites = Array.from({ length: 100 }, (_, i) => ({ id: String(i), product_id: `p${i}`, product_handle: `product-${i}`, product_title: i === 0 ? 'חלונות' : 'רצפה' }));
  const state = { favorites, isHydrating: false, isFavoritePending: () => false, removeFavorite: id => removed.push(id), refreshFavorites: async () => {} };
  const catalog = { products: [{ id: 'p0', handle: 'product-0', title: 'תרסיס חלונות חדש' }], refetch: async () => {} };
  const screen = r.load('src/screens/store/StoreFavoritesScreen.tsx', {
    'react-native': { View: 'View', Text: 'Text', FlatList: 'List', TextInput: 'Input', Pressable: 'Button', ActivityIndicator: 'Spinner', RefreshControl: 'Refresh', Keyboard: { dismiss() {} }, useWindowDimensions: () => ({ width: 390 }), StyleSheet: { create: x => x } },
    '@expo/vector-icons': { Ionicons: 'Icon' },
    'react-native-safe-area-context': { useSafeAreaInsets: () => ({ top: 44, bottom: 34 }) },
    '../../components/FavoriteCatalogCard': { FavoriteCatalogCard: 'Card' },
    '../../state/FavoritesContext': { useFavorites: () => state },
    '../../state/AuthContext': { useAuth: () => ({ user: guest ? null : { role: 'customer' } }) },
    '../../hooks/useStoreCatalog': { useStoreCatalog: () => catalog },
    '../../hooks/useBrands': { useBrands: () => ({ data: [] }) },
    '../../state/useOcdPlusMembership': { useOcdPlusMembership: () => ({ isActiveMember: true }) },
    '../../context/OcdPlusSubscribeSheetContext': { useOcdPlusSubscribeSheet: () => ({ openOcdPlusSubscribeSheet() {} }) },
    '../../lib/catalogSearch': { normalizeSearchQuery: s => s.toLowerCase().trim() },
    './StoreHomeScreen': { getStoreBottomBarMetrics: () => ({ contentPaddingBottom: 90 }), StoreFloatingTabBar: 'Tabs' },
  });
  let logins = 0;
  r.mount(() => screen.StoreFavoritesScreen({ onOpenProduct: handle => opened.push(handle), onTabPress: tab => tabs.push(tab), onLoginPress: () => logins++ }));
  return { ...r, opened, removed, tabs, state, catalog, logins: () => logins, all: () => nodes(r.tree()), list: () => nodes(r.tree()).find(n => n.type === 'List') };
}

test('favorites retain virtualized two-column layout, current-name search, live data, product navigation and removal', async () => {
  const h = setup();
  assert.equal(h.list().props.data.length, 100);
  assert.equal(h.list().props.numColumns, 2);
  assert.ok(h.list().props.initialNumToRender < 100);
  assert.equal(h.all().filter(n => n.type === 'Card').length, 0);
  h.all().find(n => n.type === 'Input').props.onChangeText('חדש חלונות'); await h.flush();
  assert.equal(h.list().props.data.length, 1);
  const card = h.list().props.renderItem({ item: h.list().props.data[0] });
  assert.equal(card.props.liveProduct, h.catalog.products[0]);
  assert.equal(card.props.width, 174);
  assert.equal(card.props.isSubscriber, true);
  card.props.onOpenProduct(card.props.favorite.product_handle); card.props.onRemove();
  assert.deepEqual(h.opened, ['product-0']); assert.deepEqual(h.removed, ['p0']);
  h.state.favorites = h.state.favorites.slice(1); h.render();
  assert.equal(h.list().props.data.length, 0);
  assert.ok(nodes(h.list().props.ListEmptyComponent).some(n => n.props.children?.includes('לא מצאנו התאמה')));
  h.unmount();
});

test('guest sees login action, and no saved customer products', () => {
  const h = setup({ guest: true }); assert.equal(h.list(), undefined);
  const login = h.all().find(n => n.type === 'Button' && nodes(n).some(c => c.props.children?.includes('כניסה לחשבון')));
  login.props.onPress(); assert.equal(h.logins(), 1);
  h.unmount();
});

test('loading and empty states keep home navigation and the favorites tab', async () => {
  const h = setup(); h.state.isHydrating = true; h.render();
  assert.equal(h.list().props.data.length, 0);
  assert.ok(nodes(h.list().props.ListEmptyComponent).some(n => n.type === 'Spinner'));
  h.state.isHydrating = false; h.state.favorites = []; h.render(); await h.flush();
  nodes(h.list().props.ListEmptyComponent).find(n => n.type === 'Button').props.onPress();
  assert.deepEqual(h.tabs, ['home']);
  assert.equal(h.all().find(n => n.type === 'Tabs').props.activeTab, 'favorites'); h.unmount();
});

test('customer route shares the same favorites screen and navigation', () => {
  const h = runtime(), routes = [];
  const { CustomerFavoritesScreen } = h.load('src/screens/customer/FavoritesScreen.tsx', {
    '../../navigation/navigationRef': { safeNavigate: (...args) => routes.push(args) },
    '../store/StoreFavoritesScreen': { StoreFavoritesScreen: 'SharedFavorites' },
  });
  const onTabPress = () => {};
  h.mount(() => CustomerFavoritesScreen({ onTabPress }));
  assert.equal(h.tree().type, 'SharedFavorites');
  assert.equal(h.tree().props.onTabPress, onTabPress);
  h.tree().props.onOpenProduct('spray'); h.tree().props.onLoginPress();
  assert.deepEqual(JSON.parse(JSON.stringify(routes)), [['Product', { handle: 'spray' }], ['Login']]);
  h.unmount();
});
