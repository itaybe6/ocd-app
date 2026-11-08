const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

function membership(user, dev = true) {
  const calls = [];
  const effects = [];
  const navigationListeners = new Set();
  let currentRoute = 'Main';
  function load(file, mocks = {}) {
    const module = { exports: {} };
    const source = fs.readFileSync(path.resolve(__dirname, '../src', file), 'utf8');
    vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, {
      module, exports: module.exports, __DEV__: dev,
      require(name) { if (name in mocks) return mocks[name]; throw Error(`Unexpected import: ${name}`); },
      setTimeout() { calls.push('timer'); },
    });
    return module.exports;
  }
  const demo = load('lib/localDemoAccount.ts');
  const hook = load('state/useOcdPlusMembership.ts', {
    react: { useState: value => [value, next => calls.push(['state', next])], useRef: value => ({ current: value }), useCallback: fn => fn, useEffect: fn => effects.push(fn) },
    'react-native': { AppState: { addEventListener: () => ({ remove() {} }) }, Linking: { canOpenURL: async () => true, openURL: async () => calls.push('external-url') } },
    '../components/toast/Toast': { __esModule: true, default: { show: () => calls.push('toast') } },
    '../lib/ocdPlus': {
      createOcdPlusPayment: async () => { calls.push('create-payment'); return { paymentUrl: 'https://example.invalid' }; },
      getOcdPlusStatus: async () => { calls.push('server-status'); return { status: 'none', subscription: null }; },
      OcdPlusNotConfiguredError: class extends Error {}, OcdPlusCancellationPendingError: class extends Error {},
    },
    './AuthContext': { useAuth: () => ({ user, setUser: async () => calls.push('update-user') }) },
    '../lib/localDemoAccount': demo,
    '../navigation/navigationRef': {
      safeNavigate: (route, params) => calls.push(['navigate', route, params]),
      navigationRef: {
        isReady: () => true,
        getCurrentRoute: () => ({ name: currentRoute }),
        addListener: (event, listener) => { navigationListeners.add(listener); return () => navigationListeners.delete(listener); },
      },
    },
  });
  return { state: hook.useOcdPlusMembership(), calls, effects,
    visit: name => { currentRoute = name; navigationListeners.forEach(fn => fn()); } };
}

test('demo join requires real sign-in without creating payment, opening live URL, or activating membership', async () => {
  const { state, calls, effects } = membership({ id: 'local-demo-adir', role: 'customer', ocd_plus_subscriber: false });
  effects.forEach(fn => fn());
  await state.startPurchase();
  assert.equal(state.isActiveMember, false);
  assert.ok(calls.some(c => Array.isArray(c) && c[0] === 'navigate' && c[1] === 'OcdPlusPaymentSignIn'));
  for (const forbidden of ['create-payment', 'external-url', 'server-status', 'update-user', 'timer']) assert.ok(!calls.includes(forbidden), forbidden);
});

test('real customer checkout navigates in-app and never launches an external browser or assumes payment', async () => {
  const { state, calls } = membership({ id: 'real-customer', role: 'customer' });
  await state.startPurchase();
  assert.ok(calls.includes('create-payment'));
  assert.ok(!calls.includes('external-url'));
  const navigation = calls.find(c => Array.isArray(c) && c[0] === 'navigate');
  assert.equal(navigation[1], 'OcdPlusCheckout');
  assert.equal(navigation[2].paymentUrl, 'https://example.invalid');
  assert.ok(!calls.includes('update-user'));
  assert.ok(!calls.includes('timer'));
});

test('closing in-app checkout refreshes membership; ordinary navigation does not', async () => {
  const h = membership({ id: 'real-customer', role: 'customer' });
  h.effects.forEach(fn => fn());
  h.calls.length = 0;
  h.visit('StoreFavorites');
  assert.ok(!h.calls.includes('server-status'));
  h.visit('OcdPlusCheckout');
  assert.ok(!h.calls.includes('server-status'));
  h.visit('Main');
  assert.equal(h.calls.filter(c => c === 'server-status').length, 1);
});

test('guests cannot open either checkout or preview', async () => {
  const { state, calls } = membership(null);
  await state.startPurchase();
  assert.deepEqual(calls, ['toast']);
});
