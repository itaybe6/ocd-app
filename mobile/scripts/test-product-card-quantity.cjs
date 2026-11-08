const test = require('node:test');
const assert = require('node:assert/strict');
const { runtime } = require('./helpers/hook-runtime.cjs');

const product = { id: 'p1', variantId: 'v1', availableForSale: true, name: 'מוצר בדיקה', price: 10, currencyCode: 'ILS' };

async function cartHarness() {
  const h = runtime(), writes = [], errors = [];
  let serverQuantity = 0, gate, fail = false;
  const snapshot = () => ({ id: 'cart1', checkoutUrl: '', cost: { subtotalAmount: serverQuantity * 10, currencyCode: 'ILS' }, lines: serverQuantity ? [{ id: 'line1', product, quantity: serverQuantity, cost: { amountPerQuantity: 10, totalAmount: serverQuantity * 10 } }] : [] });
  const write = async (kind, qty) => { writes.push({ kind, qty }); if (gate) await gate; if (fail) throw Error('Test network error'); serverQuantity = qty; return snapshot(); };
  const { CartProvider } = h.load('src/state/CartContext.tsx', {
    '../lib/cartQuantityStore': h.load('src/lib/cartQuantityStore.ts', {}),
    '@react-native-async-storage/async-storage': { getItem: async () => null, setItem: async () => {}, removeItem: async () => {} },
    '../components/toast/Toast': { show: (value) => errors.push(value) },
    '../services/shopify': { buildMobileAppCartOptions: () => ({}) },
    '../lib/shopify': {
      createCart: (lines) => write('create', lines[0].quantity),
      addCartLines: (_id, lines) => write('add', serverQuantity + lines[0].quantity),
      updateCartLines: (_id, lines) => write('update', lines[0].quantity),
      removeCartLines: () => write('remove', 0), fetchCart: async () => snapshot(),
    },
  });
  h.mount(() => CartProvider({ children: null })); await h.flush();
  return { ...h, context: () => h.tree().props.value, quantityStore: () => h.tree().props.children[0].props.value.store, writes, errors, server: () => serverQuantity,
    hold: () => { let release; gate = new Promise(resolve => { release = resolve; }); return () => { release(); gate = null; }; },
    fail: () => { fail = true; },
  };
}

test('rapid add / subtract coalesces to one exact initial cart quantity', async () => {
  const h = await cartHarness();
  for (const qty of [1, 2, 3, 2]) await h.context().updateQuantity(product.id, qty, product);
  await h.flush(); assert.equal(h.context().getQuantity(product.id), 2);
  await h.tick(350);
  assert.deepEqual(h.writes, [{ kind: 'create', qty: 2 }]);
  assert.equal(h.server(), 2); assert.equal(h.context().itemCount, 2);
});

test('removing before the first debounce does not create a cart', async () => {
  const h = await cartHarness();
  await h.context().updateQuantity(product.id, 1, product);
  await h.context().updateQuantity(product.id, 0, product);
  await h.tick(350); assert.equal(h.writes.length, 0); assert.equal(h.context().getQuantity(product.id), 0);
});

test('a later change survives an in-flight first add and is applied after it', async () => {
  const h = await cartHarness(), release = h.hold();
  await h.context().updateQuantity(product.id, 1, product); await h.tick(350);
  await h.context().updateQuantity(product.id, 3, product); await h.tick(350);
  assert.equal(h.context().getQuantity(product.id), 3);
  release(); await h.flush();
  assert.deepEqual(h.writes, [{ kind: 'create', qty: 1 }, { kind: 'update', qty: 3 }]);
  assert.equal(h.server(), 3); assert.equal(h.context().getQuantity(product.id), 3);
});

test('remove and then re-add restores the product even if its old line was deleted', async () => {
  const h = await cartHarness();
  await h.context().updateQuantity(product.id, 1, product); await h.tick(350);
  const release = h.hold();
  await h.context().updateQuantity(product.id, 0, product); await h.tick(350);
  await h.context().updateQuantity(product.id, 2, product); await h.tick(350);
  release(); await h.flush();
  assert.equal(h.server(), 2); assert.equal(h.context().itemCount, 2);
  assert.deepEqual(h.writes.map(x => x.kind), ['create', 'remove', 'add']);
});

test('failed initial save rolls back the optimistic quantity and reports an error', async () => {
  const h = await cartHarness(); h.fail();
  await h.context().updateQuantity(product.id, 2, product); await h.tick(350);
  assert.equal(h.context().getQuantity(product.id), 0); assert.equal(h.errors.length, 1);
});

test('missing variant or unavailable product cannot create a cart', async () => {
  for (const patch of [{ variantId: '' }, { availableForSale: false }]) {
    const h = await cartHarness();
    await h.context().updateQuantity(product.id, 1, { ...product, ...patch }); await h.tick(350);
    assert.equal(h.writes.length, 0); assert.equal(h.context().getQuantity(product.id), 0);
  }
});

test('slow network coalesces queued edits and publishes the quantity before any server response', async () => {
  const h = await cartHarness(), release = h.hold();
  const store = h.quantityStore();
  let changed = 0, unrelated = 0;
  store.read(product.id); store.read('other-product');
  const off = store.subscribe(product.id, () => changed++);
  const otherOff = store.subscribe('other-product', () => unrelated++);
  await h.context().updateQuantity(product.id, 1, product); await h.tick(350);
  for (const qty of [2, 3, 4, 3, 2]) {
    await h.context().updateQuantity(product.id, qty, product); await h.tick(350);
    assert.equal(store.read(product.id).quantity, qty, 'UI does not wait for the held request');
  }
  assert.equal(h.writes.length, 1, 'first request is still in flight');
  assert.equal(unrelated, 0, 'other product subscribers never redraw');
  assert.equal(changed, 6);
  release(); await h.flush(); await h.flush();
  assert.deepEqual(h.writes, [{ kind: 'create', qty: 1 }, { kind: 'update', qty: 2 }]);
  assert.equal(store.read(product.id).quantity, 2);
  assert.equal(h.server(), 2);
  off(); otherOff(); h.unmount();
});

test('server failure rolls back the isolated product subscription too', async () => {
  const h = await cartHarness(); h.fail();
  const store = h.quantityStore();
  store.read(product.id);
  const seen = [], off = store.subscribe(product.id, () => seen.push(store.read(product.id).quantity));
  await h.context().updateQuantity(product.id, 2, product); await h.flush();
  assert.equal(store.read(product.id).quantity, 2);
  await h.tick(350);
  assert.deepEqual(seen, [2, 0]);
  off(); h.unmount();
});

test('quantity snapshots are stable and bootstrap/unsubscribe are respected', () => {
  const { createCartQuantityStore } = runtime().load('src/lib/cartQuantityStore.ts', {});
  const store = createCartQuantityStore();
  const initial = store.read('p1');
  assert.equal(initial, store.read('p1'));
  let calls = 0;
  const off = store.subscribe('p1', () => calls++);
  store.publish({}, false);
  assert.equal(calls, 1);
  assert.equal(store.read('p1').isBootstrapping, false);
  const ready = store.read('p1');
  store.publish({ other: 20 }, false);
  assert.equal(store.read('p1'), ready);
  assert.equal(calls, 1);
  off(); store.publish({ p1: 3 }, false);
  assert.equal(calls, 1);
});

function nodes(node) { return !node || typeof node !== 'object' ? [] : [node, ...(node.props?.children ?? []).flat(Infinity).flatMap(nodes)]; }
async function controlHarness({ qty = 0, reader = false, available = true, reducedMotion = false, choose = false, variantAvailable = true } = {}) {
  const h = runtime(), changes = [], animations = []; let quantity = qty, stopped = 0, choices = 0;
  const { ProductCardQuantityControl } = h.load('src/components/ProductCardQuantityControl.tsx', {
    'react-native': { AccessibilityInfo: { isScreenReaderEnabled: async () => reader, addEventListener: () => ({ remove() {} }) }, Pressable: 'Pressable', Text: 'Text', View: 'View', StyleSheet: { create: x => x, absoluteFill: {} } },
    '@expo/vector-icons': { Ionicons: 'Icon' },
    'expo-haptics': { impactAsync: async () => {}, ImpactFeedbackStyle: { Light: 'Light' } },
    'react-native-reanimated': { __esModule: true, default: { View: 'AnimatedView' }, Easing: { out: x => x, cubic: null }, useReducedMotion: () => reducedMotion, useSharedValue: (v) => h.react.useRef({ value: v }).current, withTiming: (v, options) => { animations.push({ value: v, ...options }); return v; }, useAnimatedStyle: fn => fn() },
    '../state/CartContext': { useProductCartQuantity: () => ({ quantity, isBootstrapping: false, updateQuantity: async (_id, next) => { quantity = next; changes.push(next); } }) },
  });
  h.mount(() => ProductCardQuantityControl({ product: { ...product, availableForSale: available }, ...(choose ? { onChooseVariant: () => choices++, canChooseVariant: variantAvailable } : {}) })); await h.flush();
  const press = async (label) => {
    const button = nodes(h.tree()).find(n => n.type === 'Pressable' && n.props.accessibilityLabel?.includes(label));
    assert.ok(button, 'Missing control ' + label); if (button.props.disabled) return;
    button.props.onPress({ stopPropagation: () => stopped++ }); h.render(); await h.flush();
  };
  const expanded = () => nodes(h.tree()).find(n => n.type === 'Pressable' && n.props.accessibilityState?.expanded !== undefined).props.accessibilityState.expanded;
  return { ...h, press, expanded, changes, animations, quantity: () => quantity, stopped: () => stopped, choices: () => choices };
}

test('first tap adds one, opens editor, resets idle timer, then collapses without changing quantity', async () => {
  const h = await controlHarness();
  await h.press('לעגלה'); assert.equal(h.quantity(), 1); assert.equal(h.expanded(), true);
  await h.tick(2500); await h.press('הוספת יחידה'); assert.equal(h.quantity(), 2);
  await h.tick(2500); assert.equal(h.expanded(), true);
  await h.tick(500); assert.equal(h.expanded(), false); assert.equal(h.quantity(), 2); assert.equal(h.stopped(), 2);
});

test('quantity badge reopens without adding; minus removes last unit; close and unmount clear timers', async () => {
  const h = await controlHarness({ qty: 1 });
  await h.press('שינוי כמות'); assert.deepEqual(h.changes, []);
  await h.press('הסרת'); assert.equal(h.quantity(), 0);
  await h.press('סגירת'); assert.equal(h.expanded(), false); assert.equal(h.pendingTimers(), 0);
  await h.press('לעגלה'); h.unmount(); assert.equal(h.pendingTimers(), 0);
});

test('unavailable products are disabled and screen readers keep editor open until explicitly closed', async () => {
  const unavailable = await controlHarness({ available: false }); await unavailable.press('אינו זמין'); assert.deepEqual(unavailable.changes, []);
  const h = await controlHarness({ reader: true }); await h.press('לעגלה'); await h.tick(10000);
  assert.equal(h.expanded(), true); await h.press('סגירת'); assert.equal(h.expanded(), false);
});

test('shared card opens variant selection without adding or changing an existing variant quantity', async () => {
  for (const qty of [0, 3]) {
    const h = await controlHarness({ choose: true, qty, available: false, variantAvailable: true });
    await h.press('בחירת אפשרות');
    assert.equal(h.choices(), 1);
    assert.deepEqual(h.changes, []);
    assert.equal(h.quantity(), qty);
    assert.equal(h.pendingTimers(), 0);
  }
  const unavailable = await controlHarness({ choose: true, variantAvailable: false });
  await unavailable.press('בחירת אפשרות');
  assert.equal(unavailable.choices(), 0);
  assert.deepEqual(unavailable.changes, []);
});

test('rapid repeated taps retain every increment, without restarting the opening animation', async () => {
  const h = await controlHarness();
  await h.press('לעגלה');
  const plus = nodes(h.tree()).find(n => n.type === 'Pressable' && n.props.accessibilityLabel?.includes('הוספת יחידה'));
  for (let i = 0; i < 10; i++) plus.props.onPress({ stopPropagation() {} });
  h.render(); await h.flush();
  assert.equal(h.quantity(), 11);
  assert.deepEqual(h.changes, Array.from({ length: 11 }, (_, i) => i + 1));
  assert.equal(h.animations.length, 1);
  assert.equal(h.animations[0].duration, 160);
  await h.press('הפחתת'); assert.equal(h.quantity(), 10);
  await h.tick(3000); assert.equal(h.expanded(), false);
  h.unmount();
});

test('corner reveal uses a transform with a square top-right and bottom-left; reduced motion is instant', async () => {
  const h = await controlHarness({ reducedMotion: true });
  const backdrop = nodes(h.tree()).find(n => n.props.style?.[0]?.left === -104);
  assert.equal(backdrop.props.style[0].borderBottomRightRadius, 32);
  assert.equal(backdrop.props.style[0].borderBottomLeftRadius ?? 0, 0);
  assert.equal(backdrop.props.style[0].borderTopRightRadius ?? 0, 0);
  assert.equal(backdrop.props.style[1].transform[0].translateX, 0);
  await h.press('לעגלה');
  assert.equal(h.animations[0].duration, 0);
  const openBackdrop = nodes(h.tree()).find(n => n.props.style?.[0]?.left === -104);
  assert.equal(openBackdrop.props.style[1].transform[0].translateX, 104);
  assert.equal(openBackdrop.props.style[1].width, undefined, 'animation never recalculates layout width');
  h.unmount();
});
