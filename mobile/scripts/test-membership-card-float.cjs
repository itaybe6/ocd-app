const test = require('node:test');
const assert = require('node:assert/strict');
const { runtime } = require('./helpers/hook-runtime.cjs');

async function setup({ reduced = false, active = true } = {}) {
  const r = runtime(), timings = [], repeats = [], shared = [], removed = [];
  const events = {};
  let focused = true, reaction;
  const viewport = { scrollY: { value: 0 }, height: { value: 600 }, contentY: { value: 1000 } };
  const { useMembershipCardFloat } = r.load('src/hooks/useMembershipCardFloat.ts', {
    'react-native': {
      AppState: { currentState: active ? 'active' : 'background', addEventListener: (_type, fn) => { events.app = fn; return { remove: () => removed.push('app') }; } },
      AccessibilityInfo: { isReduceMotionEnabled: async () => reduced, addEventListener: (_type, fn) => { events.motion = fn; return { remove: () => removed.push('motion') }; } },
    },
    '@react-navigation/native': { useIsFocused: () => focused },
    'react-native-reanimated': {
      useReducedMotion: () => reduced,
      Easing: { sin: 'sin', inOut: value => value }, ReduceMotion: { Never: 'never' },
      useSharedValue: value => r.react.useMemo(() => { const cell = { value }; shared.push(cell); return cell; }, []),
      useAnimatedStyle: fn => fn(),
      useAnimatedReaction: (prepare, respond) => {
        const previous = r.react.useRef(null);
        reaction = () => { const value = prepare(); respond(value, previous.current); previous.current = value; };
      },
      cancelAnimation: () => {},
      withTiming: (target, config) => { timings.push({ target, ...config }); return target; },
      withRepeat: (target, count, reverse) => { repeats.push({ target, count, reverse }); return target; },
    },
  });
  r.mount(() => useMembershipCardFloat(viewport, 13, 146));
  await r.flush(); reaction();
  const evaluate = async () => { await r.flush(); reaction(); };
  const layout = async () => { r.tree().onLayout({ nativeEvent: { layout: { y: 50, height: 300 } } }); await evaluate(); };
  const load = async () => { r.tree().onLoad(); await evaluate(); };
  const scroll = async y => { viewport.scrollY.value = y; await evaluate(); };
  return { r, timings, repeats, viewport, removed, layout, load, scroll,
    offset: () => shared[3].value,
    focus: async value => { focused = value; r.render(); await evaluate(); },
    app: async state => { events.app(state); await evaluate(); },
    motion: async value => { events.motion(value); await evaluate(); },
  };
}

test('float starts only for a loaded visible card, stays on UI values while scrolling, and stops offscreen', async () => {
  const s = await setup();
  await s.layout(); await s.scroll(600);
  assert.equal(s.repeats.length, 0, 'do not animate an unloaded image');
  await s.load();
  assert.equal(s.repeats.length, 1);
  assert.equal(s.timings[0].target, -5);
  assert.equal(s.timings[0].duration, 2400);
  assert.deepEqual(s.repeats[0], { target: -5, count: -1, reverse: true });
  for (const y of [610, 620, 700, 800]) await s.scroll(y);
  assert.equal(s.repeats.length, 1, 'scrolling within visibility must not restart motion');
  await s.scroll(1300);
  assert.equal(s.offset(), 0);
  assert.equal(s.r.pendingTimers(), 0, 'no JS frame loop or polling timer');
  await s.scroll(600); assert.equal(s.repeats.length, 2);
  s.r.unmount(); assert.equal(s.offset(), 0);
  assert.deepEqual(s.removed.sort(), ['app', 'motion']);
});

test('background, navigation and live reduced-motion changes stop and resume only when visible', async () => {
  const s = await setup();
  await s.layout(); await s.load(); await s.scroll(600);
  await s.app('inactive'); assert.equal(s.offset(), 0);
  await s.app('background'); assert.equal(s.repeats.length, 1);
  await s.app('active'); assert.equal(s.repeats.length, 2);
  await s.focus(false); assert.equal(s.offset(), 0);
  await s.focus(true); assert.equal(s.repeats.length, 3);
  await s.motion(true); assert.equal(s.offset(), 0);
  await s.scroll(700); assert.equal(s.repeats.length, 3);
  await s.motion(false); assert.equal(s.repeats.length, 4);
  await s.app('background'); await s.scroll(1400); await s.app('active');
  assert.equal(s.repeats.length, 4, 'foregrounding must not restart an offscreen card');
  s.r.unmount();
});

test('reduced motion at startup keeps the card static, even after image and viewport become ready', async () => {
  const s = await setup({ reduced: true });
  await s.layout(); await s.load(); await s.scroll(600);
  assert.equal(s.repeats.length, 0); assert.equal(s.offset(), 0);
  assert.equal(s.r.tree().reducedMotion, true);
  s.r.unmount();
});
