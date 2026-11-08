const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');

const source = fs.readFileSync(path.join(__dirname, '../src/screens/store/StoreHomeScreen.tsx'), 'utf8');
const compiled = ts.transpileModule(source, {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React },
}).outputText;
const shopMenuCode = ts.transpileModule(fs.readFileSync(path.join(__dirname, '../src/lib/shopMenu.ts'), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS },
}).outputText;

function setup({ itemCount = 0, activeTab = 'home', homeOverrides = false, links } = {}) {
  const buttons = [], routes = [], tabs = [];
  let menu, opened = 0, customCart = 0;
  const host = tag => ({ children }) => React.createElement(tag, null, children);
  const native = {
    View: host('div'), Text: host('span'), Image: host('img'),
    Pressable: props => { buttons.push(props); return React.createElement('button', null, props.children); },
    StyleSheet: { create: value => value, absoluteFill: {} },
  };
  const menuModule = { exports: {} };
  vm.runInNewContext(shopMenuCode, { module: menuModule, exports: menuModule.exports, require: () => ({}) });
  const navigationLinks = links ?? [{ handle: 'cleaning', label: 'ניקיון', children: [{ handle: 'floors', label: 'רצפות' }] }];
  const icon = name => () => React.createElement('i', null, name);
  const mocks = {
    react: { ...React, default: React },
    'react-native': native,
    'react-native-reanimated': {
      default: { View: native.View, Text: native.Text },
      useSharedValue: value => React.useRef({ value }).current,
      useAnimatedStyle: fn => fn(),
      withTiming: value => value,
      interpolateColor: (value, _, colors) => colors[value ? 1 : 0],
    },
    'react-native-safe-area-context': { useSafeAreaInsets: () => ({ top: 44, bottom: 34 }) },
    'lucide-react-native': Object.fromEntries(['Heart', 'House', 'Menu', 'Search', 'ShoppingCart', 'UserRound'].map(name => [name, icon(name)])),
    '../../theme/storeAccent': { storeAccent: { primary: '#B99B82', onPrimary: '#2F251F', iconOnPrimary: '#FFFFFF' } },
    '../../theme/radii': { radii: { pill: 999, nested: 16, compact: 12 } },
    '../../state/CartContext': { useCart: () => ({ itemCount }) },
    '../../hooks/useShopMenu': { useShopMenu: () => ({ data: navigationLinks }) },
    '../../hooks/useBrands': { useBrands: () => ({ data: [] }) },
    '../../lib/shopMenu': menuModule.exports,
    '../../lib/shopify': { findMenuItemByCollectionHandle: (items, handle) => items.find(item => item.collectionHandle === handle) },
    '../../navigation/navigationRef': { safeNavigate: (...args) => routes.push(args) },
    '../../components/OcdPlusMark': { OcdPlusMark: icon('OCD+') },
    '../../components/StoreSideMenu': {
      StoreSideMenu: props => {
        menu = props;
        props.ref.current = { open: () => opened++, close() {} };
        return null;
      },
    },
  };
  const module = { exports: {} };
  vm.runInNewContext(compiled, { module, exports: module.exports, require: name => {
    if (name in mocks) return { __esModule: true, ...mocks[name] };
    // Other storefront imports are not rendered by these navigation tests.
    return {};
  } });
  const html = renderToStaticMarkup(React.createElement(module.exports.StoreFloatingTabBar, {
    activeTab, onTabPress: tab => tabs.push(tab),
    ...(homeOverrides ? { onMenuPress: () => opened++, onCartPress: () => customCart++ } : {}),
  }));
  return { buttons, routes, tabs, menu, html, opened: () => opened, customCart: () => customCart };
}

test('home, favorites and personal area open their routes; cart and menu work from every shared-bar screen', () => {
  for (const activeTab of ['home', 'search', 'profile', 'favorites', 'ocdPlus', null]) {
    const s = setup({ activeTab });
    assert.equal(s.buttons.length, 5);
    s.buttons[0].onPress();
    s.buttons[1].onPress();
    s.buttons[2].onPress();
    s.buttons[3].onPress();
    s.buttons[4].onPress();
    assert.deepEqual(s.tabs, ['home', 'favorites', 'profile']);
    assert.equal(s.buttons[1].accessibilityLabel, 'המועדפים שלי');
    assert.equal(s.buttons[1].accessibilityState.selected, activeTab === 'favorites');
    assert.equal(s.html.includes('<i>Heart</i>'), true);
    assert.equal(s.html.includes('<i>Search</i>'), false);
    assert.equal(s.buttons[4].accessibilityLabel, 'האזור האישי');
    assert.equal(s.buttons[4].accessibilityState.selected, activeTab === 'profile' || activeTab === 'ocdPlus');
    assert.deepEqual(s.routes, [['StoreCart']]);
    assert.equal(s.opened(), 1);
    assert.equal(s.buttons[2].accessibilityRole, 'button');
    assert.equal(s.buttons[3].accessibilityRole, 'button');
  }
});

test('home reuses its existing category menu and cart callback', () => {
  const s = setup({ homeOverrides: true });
  s.buttons[2].onPress();
  s.buttons[3].onPress();
  assert.equal(s.customCart(), 1);
  assert.equal(s.opened(), 1);
  assert.equal(s.menu, undefined, 'do not mount a duplicate menu over the home menu');
  assert.equal(s.routes.length, 0);
});

test('cart badge covers empty, normal and large counts, with full accessible count', () => {
  for (const itemCount of [0, 1, 7, 99, 120]) {
    const s = setup({ itemCount });
    assert.equal(s.buttons[2].accessibilityLabel, `עגלת קניות, ${itemCount} פריטים`);
    const badge = itemCount > 99 ? '99+' : String(itemCount);
    assert.equal(s.html.includes(`<span>${badge}</span>`), itemCount > 0);
  }
});

test('personal area and favorites remain reachable through the menu', () => {
  const s = setup({ activeTab: 'search' });
  s.menu.onProfilePress();
  s.menu.onFavoritesPress();
  s.menu.onSearchPress();
  assert.deepEqual(s.tabs, ['profile', 'favorites', 'search']);
});

test('menu opens categories, subcategories and brands with correct route data', () => {
  const s = setup();
  const section = s.menu.sections[0];
  s.menu.onPressSection(section);
  s.menu.onPressChild(section, section.children[0]);
  s.menu.onPressBrand({ handle: 'brand', label: 'מותג' });
  assert.equal(s.routes[0][0], 'StoreCategory');
  assert.equal(s.routes[0][1].categoryId, 'cleaning');
  assert.equal(s.routes[0][1].subcategories[0].id, 'floors');
  assert.equal(s.routes[1][1].categoryId, 'floors');
  assert.equal(s.routes[1][1].parentTitle, 'ניקיון');
  assert.equal(s.routes[2][1].categoryId, 'brand');
});

test('an unavailable remote menu still offers the full catalog and account links', () => {
  const s = setup({ links: [] });
  s.menu.onPressSection(s.menu.sections[0]);
  assert.equal(s.routes[0][1].categoryId, 'all');
  s.menu.onProfilePress();
  s.menu.onFavoritesPress();
  assert.deepEqual(s.tabs, ['profile', 'favorites']);
});
