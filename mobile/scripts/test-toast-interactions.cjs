const test = require('node:test');
const assert = require('node:assert/strict');
const { runtime } = require('./helpers/hook-runtime.cjs');

const nodes = node => !node || typeof node !== 'object' ? [] : [node, ...(node.props?.children ?? []).flat(Infinity).flatMap(nodes)];

function setup() {
  const r = runtime();
  const shared = [];
  const transition = { duration() { return this; }, reduceMotion() { return this; } };
  const mocks = {
    'react-native': { View: 'View', Text: 'Text', Pressable: 'Button', StyleSheet: { create: x => x } },
    'react-native-safe-area-context': { useSafeAreaInsets: () => ({ top: 44 }) },
    'lucide-react-native': { Heart: 'Heart' },
    'react-native-reanimated': {
      default: { View: 'AnimatedView' }, FadeInUp: transition, LinearTransition: transition, ReduceMotion: { System: 'system' },
      cancelAnimation() {}, runOnJS: fn => fn,
      useSharedValue: value => {
        const ref = r.react.useRef(null);
        if (!ref.current) { ref.current = { value }; shared.push(ref.current); }
        return ref.current;
      },
      useAnimatedStyle: fn => fn(), withSpring: value => value,
      withTiming: (value, _config, done) => { done?.(true); return value; },
    },
    'react-native-gesture-handler': {
      GestureDetector: 'GestureDetector',
      Gesture: { Pan: () => {
        const gesture = { callbacks: {} };
        for (const method of ['activeOffsetY', 'failOffsetX', 'onBegin', 'onStart', 'onUpdate', 'onEnd', 'onFinalize']) {
          gesture[method] = value => { gesture.callbacks[method] = value; return gesture; };
        }
        return gesture;
      } },
    },
  };
  const api = r.load('src/components/toast/Toast.tsx', mocks);
  r.mount(() => api.ToastProvider({ children: null }));
  const cards = () => nodes(r.tree()).filter(node => node.props.toast);
  const mountCard = async input => {
    api.showToast(input); await r.flush();
    const card = cards()[0], dismissed = [];
    r.mount(() => card.type({ ...card.props, onDismiss: id => dismissed.push(id) }));
    const gesture = nodes(r.tree()).find(node => node.type === 'GestureDetector').props.gesture.callbacks;
    const button = nodes(r.tree()).find(node => node.type === 'Button');
    return { dismissed, gesture, button, offset: shared[0] };
  };
  return { r, api, cards, mountCard };
}

test('replacing a confirmation keeps one card and an old dismissal cannot remove its replacement', async () => {
  const s = setup();
  const oldId = s.api.showToast({ title: 'saved', key: 'favorite', duration: 1600 });
  await s.r.flush();
  const oldCard = s.cards()[0];
  const newId = s.api.showToast({ title: 'removed', key: 'favorite', duration: 1600 });
  await s.r.flush();
  assert.notEqual(oldId, newId);
  assert.equal(s.cards().length, 1);
  oldCard.props.onDismiss(oldId); await s.r.flush();
  assert.equal(s.cards()[0].props.toast.id, newId);
  s.r.unmount();
});

test('favorite confirmation expires after its short duration; legacy visibilityTime is retained', async () => {
  const s = setup();
  const card = await s.mountCard({ title: 'saved', favorite: 'added', duration: 1600 });
  await s.r.tick(1599); assert.equal(card.dismissed.length, 0);
  await s.r.tick(1); assert.equal(card.dismissed.length, 1);
  s.r.unmount(); assert.equal(s.r.pendingTimers(), 0);

  const legacy = setup();
  legacy.api.default.show({ text1: 'message', visibilityTime: 5000, autoHide: false });
  await legacy.r.flush();
  assert.equal(legacy.cards()[0].props.toast.duration, 5000);
  assert.equal(legacy.cards()[0].props.toast.autodismiss, false);
  legacy.r.unmount();
});

test('touch pauses expiry; a short drag returns to rest and restarts the timer', async () => {
  const s = setup();
  const { gesture, offset, dismissed } = await s.mountCard({ title: 'saved', duration: 1600 });
  await s.r.tick(1500);
  gesture.onBegin(); gesture.onStart();
  gesture.onUpdate({ translationY: -18 });
  assert.equal(offset.value, -18);
  await s.r.tick(2000); assert.equal(dismissed.length, 0);
  gesture.onEnd({ translationY: -18, velocityY: -40 }); gesture.onFinalize();
  assert.equal(offset.value, 0);
  await s.r.tick(1599); assert.equal(dismissed.length, 0);
  await s.r.tick(1); assert.equal(dismissed.length, 1);
  s.r.unmount();
});

for (const [name, translationY, velocityY] of [['upward drag', -45, -100], ['quick upward flick', -12, -600]]) {
  test(`${name} dismisses once without waiting for expiry`, async () => {
    const s = setup();
    const { gesture, dismissed, button } = await s.mountCard({ title: 'removed', duration: 1600 });
    gesture.onBegin(); gesture.onStart(); gesture.onUpdate({ translationY });
    gesture.onEnd({ translationY, velocityY }); gesture.onFinalize();
    button.props.onPress();
    await s.r.tick(3000);
    assert.equal(dismissed.length, 1);
    s.r.unmount();
  });
}

test('downward and cancelled gestures preserve the notification; persistent cards still dismiss by tap', async () => {
  const s = setup();
  const { gesture, offset, dismissed, button } = await s.mountCard({ title: 'message', autodismiss: false });
  gesture.onBegin(); gesture.onStart(); gesture.onUpdate({ translationY: 50 });
  assert.equal(offset.value, 0);
  gesture.onEnd({ translationY: 50, velocityY: 800 }); gesture.onFinalize();
  gesture.onBegin(); gesture.onStart(); gesture.onUpdate({ translationY: -15 }); gesture.onFinalize();
  assert.equal(offset.value, 0);
  await s.r.tick(10000); assert.equal(dismissed.length, 0);
  button.props.onPress(); assert.equal(dismissed.length, 1);
  s.r.unmount();
});
