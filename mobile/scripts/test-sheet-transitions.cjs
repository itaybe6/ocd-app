const test = require('node:test');
const assert = require('node:assert/strict');
const { runtime } = require('./helpers/hook-runtime.cjs');

function nodes(node) { return !node || typeof node !== 'object' ? [] : [node, ...(node.props?.children ?? []).flat(Infinity).flatMap(nodes)]; }
function environment(platform = 'ios') {
  const h = runtime(), shared = [], pans = [];
  h.react.useContext = (context) => context.value;
  const gesture = () => {
    const handlers = {};
    const proxy = new Proxy({ handlers }, { get: (target, key) => key === 'handlers' ? handlers : (...args) => { handlers[key] = args[0]; return proxy; } });
    pans.push(proxy); return proxy;
  };
  const reanimated = {
    __esModule: true, default: { View: 'AnimatedView', ScrollView: 'ScrollView' },
    Easing: { bezier: () => 'easing' },
    runOnJS: (fn) => fn,
    useAnimatedStyle: (fn) => fn(), useAnimatedScrollHandler: (fn) => fn,
    withTiming: (to, config, callback) => ({ animation: true, to, config, callback }),
    withSpring: (to, config, callback) => ({ animation: true, to, config, callback }),
    cancelAnimation: (value) => { const a = value.animation; value.animation = null; a?.callback?.(false); },
    useSharedValue: (initial) => {
      const ref = h.react.useRef(null);
      if (!ref.current) {
        let current = initial;
        const value = { animation: null, get value() { return current; }, set value(next) {
          reanimated.cancelAnimation(value);
          if (next?.animation) value.animation = next;
          else current = next;
        }, finish() {
          const a = value.animation; value.animation = null;
          if (a) { current = a.to; a.callback?.(true); }
        } };
        shared.push(value); ref.current = value;
      }
      return ref.current;
    },
  };
  const motion = h.load('src/theme/sheetMotion.ts', { 'react-native-reanimated': reanimated });
  const mocks = {
    'react-native': { Modal: 'Modal', Platform: { OS: platform }, View: 'View', Pressable: 'Pressable', Image: 'Image', ScrollView: 'ScrollView', Text: 'Text', StyleSheet: { create: x => x, absoluteFill: {} }, useWindowDimensions: () => ({ height: 800, width: 390 }) },
    'react-native-reanimated': reanimated,
    'react-native-gesture-handler': { Gesture: { Native: gesture, Pan: gesture }, GestureDetector: 'GestureDetector', GestureHandlerRootView: 'GestureRoot' },
    '../theme/sheetMotion': motion, '../theme/colors': { colors: { card: '#fff' } },
    'expo-haptics': { impactAsync: async () => {}, ImpactFeedbackStyle: { Light: 0 } },
  };
  return { ...h, mocks, motion, shared, pans, find: (type) => nodes(h.tree()).find(n => n.type === type), layout: () => nodes(h.tree()).find(n => n.props?.onLayout).props.onLayout({ nativeEvent: { layout: { height: 500 } } }) };
}

async function modal(platform) {
  const h = environment(platform); let visible = true, closeCalls = 0, dismissCalls = 0;
  const { ModalSheet } = h.load('src/components/ModalSheet.tsx', h.mocks);
  h.mount(() => ModalSheet({ visible, onClose: () => { closeCalls++; visible = false; h.render(); }, onAfterClose: () => dismissCalls++, children: null }));
  return { ...h, visible: (value) => { visible = value; h.render(); }, calls: () => ({ closeCalls, dismissCalls }) };
}

test('modal starts at measured height only after native onShow and layout, with no timer delay', async () => {
  const h = await modal('ios');
  h.layout(); assert.equal(h.shared[0].animation, null);
  h.find('Modal').props.onShow();
  assert.equal(h.shared[0].value, 500); assert.equal(h.shared[0].animation.to, 0);
  assert.equal(h.pendingTimers(), 0);
});

test('cancelled close cannot hide a reopened modal or run deferred navigation', async () => {
  const h = await modal('ios'); h.layout(); h.find('Modal').props.onShow(); h.shared[0].finish();
  h.visible(false); assert.equal(h.shared[0].animation.to, 508);
  h.shared[0].value = 190; h.visible(true); await h.flush();
  assert.equal(h.shared[0].animation.to, 0); assert.equal(h.shared[0].value, 190);
  h.shared[0].finish(); await h.flush();
  assert.equal(h.find('Modal').props.visible, true); assert.equal(h.calls().dismissCalls, 0);
});

test('iOS navigation waits for native dismissal; double close calls are coalesced', async () => {
  const h = await modal('ios'); h.layout(); h.find('Modal').props.onShow(); h.shared[0].finish();
  h.find('Pressable').props.onPress(); h.find('Pressable').props.onPress();
  assert.equal(h.calls().closeCalls, 1); h.shared[0].finish(); await h.flush();
  assert.equal(h.find('Modal').props.visible, false); assert.equal(h.calls().dismissCalls, 0);
  h.find('Modal').props.onDismiss(); h.find('Modal').props.onDismiss();
  assert.equal(h.calls().dismissCalls, 1);
});

test('Android runs the deferred action after the modal is hidden', async () => {
  const h = await modal('android'); h.layout(); h.find('Modal').props.onShow(); h.shared[0].finish();
  h.find('Modal').props.onRequestClose(); h.shared[0].finish(); await h.flush();
  assert.equal(h.find('Modal').props.visible, false); assert.equal(h.calls().dismissCalls, 1);
});

test('drag interrupted mid-opening keeps its position; cancelled drag returns to rest', async () => {
  const h = await modal('ios'); h.layout(); h.find('Modal').props.onShow();
  h.shared[0].value = 90;
  const pan = h.pans.find(p => p.handlers.activeOffsetY);
  pan.handlers.onStart(); pan.handlers.onUpdate({ translationY: 20 });
  assert.equal(h.shared[0].value, 110);
  pan.handlers.onFinalize({}, false); assert.equal(h.shared[0].animation.to, 0);
});

test('cart back commits the original navigation action once after animation', async () => {
  const h = environment(); let prevent, opened = 0; const actions = [], back = { type: 'GO_BACK' };
  const navigation = { dispatch: action => actions.push(action), goBack: () => prevent({ data: { action: back } }) };
  const { BottomSheetScreen } = h.load('src/components/BottomSheetScreen.tsx', { ...h.mocks, '@react-navigation/native': { usePreventRemove: (_enabled, callback) => { prevent = callback; } } });
  h.mount(() => BottomSheetScreen({ navigation, children: null, onOpened: () => opened++ }));
  h.layout(); assert.equal(h.shared[0].value, 592); h.shared[0].finish(); await h.flush();
  assert.equal(opened, 1);
  h.find('Pressable').props.onPress(); h.find('Pressable').props.onPress();
  assert.equal(actions.length, 0); h.shared[0].finish(); await h.flush();
  assert.equal(actions.length, 1); assert.equal(actions[0], back);
});

test('dismiss thresholds honor release direction and ignore tiny fast gestures', () => {
  const { motion } = environment();
  assert.equal(motion.shouldDismissSheet(150, -500, 600), false);
  assert.equal(motion.shouldDismissSheet(3, 1400, 600), false);
  assert.equal(motion.shouldDismissSheet(30, 1000, 600), true);
  assert.equal(motion.shouldDismissSheet(130, 0, 600), true);
  assert.equal(motion.shouldDismissSheet(70, 0, 600), false);
});

test('checkout replacement waits for the cart to close and commits only once', async () => {
  const h = environment(); let prevent; const actions = [];
  const checkout = { type: 'REPLACE', source: 'cart-route', target: 'root-stack', payload: { name: 'StoreCheckout', params: { checkoutUrl: 'https://example.test/checkout' } } };
  const navigation = { dispatch: action => actions.push(action), goBack: () => prevent({ data: { action: { type: 'GO_BACK' } } }) };
  const { BottomSheetScreen } = h.load('src/components/BottomSheetScreen.tsx', { ...h.mocks, '@react-navigation/native': { usePreventRemove: (_enabled, callback) => { prevent = callback; } } });
  h.mount(() => BottomSheetScreen({ navigation, children: null }));
  h.layout(); h.shared[0].finish(); await h.flush();
  prevent({ data: { action: checkout } });
  prevent({ data: { action: checkout } });
  assert.equal(actions.length, 0, 'checkout must not open over a visible cart');
  h.shared[0].finish(); await h.flush();
  assert.deepEqual(actions, [checkout]);
  assert.ok(h.shared[0].value > 592, 'cart is offscreen before route replacement');
  h.shared[0].finish(); await h.flush();
  assert.equal(actions.length, 1);
});

test('drawer pages fade on first visit and return, cancelling interrupted animations', async () => {
  const h = environment(); let focused = true;
  const { ScreenFade } = h.load('src/components/ScreenFade.tsx', {
    ...h.mocks,
    '@react-navigation/native': { useIsFocused: () => focused, useRoute: () => ({ key: 'store' }), useNavigationState: select => select({ index: focused ? 0 : 1, routes: [{ key: 'store' }, { key: 'profile' }] }) },
  });
  const content = { persistentForm: true };
  h.mount(() => ScreenFade({ children: content }));
  assert.equal(h.shared[0].animation.config.duration, h.motion.PAGE_TRANSITION.animationDuration);
  assert.equal(h.shared[0].value, 0);
  const interrupted = h.shared[0].animation;
  focused = false; h.render(); await h.flush();
  assert.equal(h.shared[0].animation, null);
  assert.equal(h.shared[0].value, 0);
  assert.equal(h.tree().props.pointerEvents, 'none');
  focused = true; h.render(); await h.flush();
  assert.notEqual(h.shared[0].animation, interrupted);
  h.shared[0].finish(); await h.flush();
  assert.equal(h.shared[0].value, 1);
  assert.equal(h.tree().props.children[0], content, 'screen contents must not remount');
  assert.equal(h.tree().props.pointerEvents, 'auto');
  h.unmount();
  assert.equal(h.shared[0].animation, null);
});

test('initial drawer page avoids a double fade but animates when returning', async () => {
  const h = environment(); let focused = true;
  const { ScreenFade } = h.load('src/components/ScreenFade.tsx', {
    ...h.mocks,
    '@react-navigation/native': { useIsFocused: () => focused, useRoute: () => ({ key: 'store' }), useNavigationState: select => select({ index: focused ? 0 : 1, routes: [{ key: 'store' }, { key: 'profile' }] }) },
  });
  h.mount(() => ScreenFade({ children: null, skipInitialAnimation: true }));
  assert.equal(h.shared[0].value, 1);
  assert.equal(h.shared[0].animation, null);
  focused = false; h.render(); await h.flush();
  focused = true; h.render(); await h.flush();
  assert.equal(h.shared[0].animation.to, 1);
  h.unmount();
});

test('opening and closing a cart overlay keeps the selected drawer page visible without replaying its fade', async () => {
  for (const skipInitialAnimation of [true, false]) {
    const h = environment(); let focused = true;
    const { ScreenFade } = h.load('src/components/ScreenFade.tsx', {
      ...h.mocks,
      '@react-navigation/native': {
        useIsFocused: () => focused,
        useRoute: () => ({ key: 'store' }),
        useNavigationState: select => select({ index: 0, routes: [{ key: 'store' }, { key: 'profile' }] }),
      },
    });
    const content = { catalog: true };
    h.mount(() => ScreenFade({ children: content, skipInitialAnimation }));
    // Opening a cart mid-fade must also let the underlying page finish appearing.
    const entrance = h.shared[0].animation;
    focused = false; h.render(); await h.flush();
    assert.equal(h.shared[0].animation, entrance);
    h.shared[0].finish(); await h.flush();
    assert.equal(h.shared[0].value, 1);
    assert.equal(h.tree().props.pointerEvents, 'none');
    assert.equal(h.tree().props.children[0], content);
    focused = true; h.render(); await h.flush();
    assert.equal(h.shared[0].value, 1);
    assert.equal(h.shared[0].animation, null, 'closing the cart must not flash or fade the underlying page');
    assert.equal(h.tree().props.pointerEvents, 'auto');
    h.unmount();
  }
});

test('menu state stays local and selected destination runs only after dismissal', async () => {
  const h = environment();
  h.react.forwardRef = fn => fn;
  h.react.useImperativeHandle = (ref, create) => { ref.current = create(); };
  let navigationCalls = 0;
  const { StoreSideMenu } = h.load('src/components/StoreSideMenu.tsx', {
    ...h.mocks,
    './ModalSheet': { ModalSheet: 'MenuModal', SheetScrollView: 'SheetScrollView' },
    'react-native-safe-area-context': { useSafeAreaInsets: () => ({ bottom: 0 }) },
    'lucide-react-native': { Search: 'Search', ChevronDown: 'ChevronDown', Heart: 'Heart', Phone: 'Phone', User: 'User' },
    '../lib/brands': { normalizeBrandImageUrl: x => x },
  });
  const ref = { current: null };
  const props = { sections: [], brands: [], onSearchPress: () => navigationCalls++, onProfilePress: () => {}, onPressSection: () => {}, onPressChild: () => {} };
  h.mount(() => StoreSideMenu(props, ref));
  assert.equal(h.tree().props.visible, false);
  ref.current.open(); await h.flush();
  assert.equal(h.tree().props.visible, true);
  const Content = h.tree().type;
  // Give the content its own hook lifecycle, just as React does beneath the controller.
  const childProps = h.tree().props;
  h.mount(() => Content({ ...childProps, onClose: () => {} }));
  const search = nodes(h.tree()).find(n => n.props?.accessibilityLabel === 'חיפוש מוצרים');
  search.props.onPress(); search.props.onPress();
  assert.equal(navigationCalls, 0);
  h.find('MenuModal').props.onAfterClose(); h.find('MenuModal').props.onAfterClose();
  assert.equal(navigationCalls, 1);
});
