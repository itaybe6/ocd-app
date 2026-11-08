const test = require('node:test');
const assert = require('node:assert/strict');
const { runtime } = require('./helpers/hook-runtime.cjs');
const logic = runtime().load('src/lib/homeProductMarquee.ts', {});
const product = (id, overrides = {}) => ({ id, name: id, price: 25, currencyCode: 'ILS', availableForSale: true, imageUrl: 'photo.jpg', ...overrides });

test('marquee excludes entry offers, duplicates, unavailable items and missing photos', () => {
  const items = [product('entry'), product('a'), product('a'), product('sold', { availableForSale: false }), product('no-photo', { imageUrl: null }), product('invalid', { price: NaN }), product('b')];
  assert.deepEqual(Array.from(logic.selectMarqueeProducts(items, ['entry']), p => p.id), ['a', 'b']);
  assert.equal(logic.selectMarqueeProducts(items, ['entry'], 1).length, 1);
});

test('loop rebasing preserves the same visual position in the middle copy', () => {
  for (const x of [-75, 0, 150, 448, 895, 896, 1000]) {
    const wrapped = logic.wrapMarqueeOffset(x, 448);
    assert.ok(wrapped >= 448 && wrapped < 896);
    assert.equal(((wrapped - x) % 448 + 448) % 448, 0);
  }
  assert.equal(logic.wrapMarqueeOffset(20, 0), 0);
});

async function setup({ reduced = false, screenReader = false, focused = true, foreground = true } = {}) {
  const r = runtime();
  let callback, active = false;
  const scrolls = [], opens = [];
  const events = {};
  const accessibility = {
    addEventListener: (name, fn) => { events[name] = fn; return { remove() {} }; },
    isReduceMotionEnabled: async () => reduced,
    isScreenReaderEnabled: async () => screenReader,
  };
  const { HomeProductMarquee } = r.load('src/components/HomeProductMarquee.tsx', {
    'react-native': { AccessibilityInfo: accessibility, AppState: { currentState: foreground ? 'active' : 'background', addEventListener: () => ({ remove() {} }) }, View: 'View', Pressable: 'Pressable', Image: 'Image', Text: 'Text', StyleSheet: { create: x => x }, useWindowDimensions: () => ({ width: 375 }) },
    '@react-navigation/native': { useIsFocused: () => focused },
    'react-native-reanimated': {
      __esModule: true, default: { ScrollView: 'ScrollView' },
      useReducedMotion: () => reduced,
      useSharedValue: value => r.react.useRef({ value }).current,
      useAnimatedRef: () => r.react.useRef(null),
      useAnimatedScrollHandler: handlers => handlers,
      useFrameCallback: fn => { callback = fn; return { setActive: value => { active = value; } }; },
      scrollTo: (_, x) => scrolls.push(x),
    },
    './HomeCompactIntro': { productDiscount: () => 0 },
    '../lib/homeProductMarquee': logic,
  });
  const props = { products: [product('a'), product('b')], onOpenProduct: p => opens.push(p.id), scrollY: { value: 0 }, viewportHeight: { value: 700 } };
  r.mount(() => HomeProductMarquee(props));
  await r.flush();
  const trackElement = r.tree();
  r.mount(() => trackElement.type(trackElement.props));
  const row = r.tree();
  const scroll = row.props.children[0];
  row.props.onLayout({ nativeEvent: { layout: { y: 400 } } });
  scroll.props.onContentSizeChange();
  return { r, row, scroll, props, scrolls, opens, track: trackElement.props, active: () => active, frame: () => { if (active) callback({ timeSincePreviousFrame: 50 }); } };
}

test('auto motion pauses for touch and momentum, resumes gently, and stops outside viewport', async () => {
  const s = await setup();
  s.frame();
  assert.equal(s.scrolls.length, 1);
  s.scroll.props.onTouchStart();
  s.frame();
  assert.equal(s.scrolls.length, 1);
  s.scroll.props.onTouchEnd();
  s.scroll.props.onScroll.onMomentumBegin();
  for (let i = 0; i < 40; i++) s.frame();
  assert.equal(s.scrolls.length, 1);
  s.scroll.props.onScroll.onScroll({ contentOffset: { x: 600 } });
  s.scroll.props.onScroll.onMomentumEnd();
  for (let i = 0; i < 28; i++) s.frame();
  assert.equal(s.scrolls.length, 1);
  s.frame();
  assert.equal(s.scrolls.at(-1), 601);
  s.props.scrollY.value = 800;
  s.frame();
  assert.equal(s.scrolls.length, 2);
  s.r.unmount();
  assert.equal(s.active(), false);
});

test('screen reader and reduced motion use a single static manually scrollable copy', async () => {
  for (const options of [{ reduced: true }, { screenReader: true }]) {
    const s = await setup(options);
    assert.equal(s.track.loop, false);
    assert.equal(s.active(), false);
    assert.equal(s.scroll.props.children[0].length, 1);
    assert.equal(s.scroll.props.horizontal, true);
    s.r.unmount();
  }
});

test('off-screen navigation and background app never auto-scroll', async () => {
  for (const options of [{ focused: false }, { foreground: false }]) {
    const s = await setup(options);
    s.frame();
    assert.equal(s.scrolls.length, 0);
    s.r.unmount();
  }
});

test('every copy opens the correct product', async () => {
  const s = await setup();
  const segments = s.scroll.props.children[0];
  for (const segment of segments) {
    const slots = segment.props.children[0].flat();
    slots[0].props.children[0].props.onPress();
    slots[1].props.children[0].props.onPress();
  }
  assert.deepEqual(s.opens, ['a', 'b', 'a', 'b', 'a', 'b']);
  s.r.unmount();
});
