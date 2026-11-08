const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const { runtime } = require('./helpers/hook-runtime.cjs');
const moduleUnderTest = { exports: {} };
vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.resolve(__dirname, '../src/lib/ocdPlusCheckout.ts'), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS },
}).outputText, { module: moduleUnderTest, exports: moduleUnderTest.exports, URL });
const urls = moduleUnderTest.exports;
const backend = 'https://example.supabase.co';
const callback = backend + '/functions/v1/ocd-plus-hyp-callback';

test('payment entry validates exact HYP host and HTTPS; callback recognition is exact', () => {
  assert.ok(urls.isHypPaymentUrl('https://pay.hyp.co.il/p/?signature=signed'));
  for (const url of ['http://pay.hyp.co.il/p/', 'https://pay.hyp.co.il.fake.test/p/', 'https://user@pay.hyp.co.il/p/', 'javascript:alert(1)']) assert.equal(urls.isHypPaymentUrl(url), false);
  assert.ok(urls.isHypReturnUrl(callback + '?CCode=0', backend));
  for (const url of [callback + '/fake', callback.replace('example.supabase.co', 'fake.test'), 'https://pay.hyp.co.il/p/?CCode=0']) assert.equal(urls.isHypReturnUrl(url, backend), false);
  assert.ok(urls.allowPaymentNavigation('https://bank.example/3ds'));
  assert.ok(urls.allowPaymentNavigation('about:blank'));
  assert.equal(urls.allowPaymentNavigation('intent://external-browser'), false);
});

function find(tree, type) {
  if (!tree || typeof tree !== 'object') return undefined;
  if (tree.type === type) return tree;
  for (const child of [tree.props?.children ?? []].flat(Infinity)) { const result = find(child, type); if (result) return result; }
}
function screen() {
  const rt = runtime(); let checks = 0, backs = 0, active = false;
  const refresh = async () => { checks++; };
  const { OcdPlusCheckoutScreen } = rt.load('src/screens/customer/OcdPlusCheckoutScreen.tsx', {
    'react-native': { View: 'View', Text: 'Text', ActivityIndicator: 'Spinner', Pressable: 'Pressable', Platform: { OS: 'ios' }, StyleSheet: { create: x => x, hairlineWidth: 1, absoluteFillObject: {} } },
    '@expo/vector-icons': { Ionicons: 'Icon' },
    'react-native-safe-area-context': { useSafeAreaInsets: () => ({ top: 44, bottom: 34 }) },
    'react-native-webview': { WebView: 'WebView' },
    '../../state/useOcdPlusMembership': { useOcdPlusMembership: () => ({ isActiveMember: active, loading: false, refresh }) },
    '../../lib/supabase': { supabaseUrl: backend },
    '../../lib/ocdPlusCheckout': urls,
    './AccountUI': { AccountButton: 'AccountButton' },
  });
  rt.mount(() => OcdPlusCheckoutScreen({ navigation: { goBack: () => { backs++; } }, route: { params: { paymentUrl: 'https://pay.hyp.co.il/p/?signature=signed' } } }));
  return { rt, checks: () => checks, backs: () => backs, activate: () => { active = true; rt.render(); } };
}

test('native page embeds actual payment URL and header back stays in navigation', () => {
  const h = screen();
  assert.equal(find(h.rt.tree(), 'WebView').props.source.uri, 'https://pay.hyp.co.il/p/?signature=signed');
  find(h.rt.tree(), 'Pressable').props.onPress();
  assert.equal(h.backs(), 1);
  h.rt.unmount();
});

test('callback is allowed to reach server before refresh; success requires server membership', async () => {
  const h = screen(); const view = find(h.rt.tree(), 'WebView');
  assert.equal(view.props.onShouldStartLoadWithRequest({ url: callback }), true);
  assert.equal(h.checks(), 0);
  view.props.onLoadEnd({ nativeEvent: { url: callback + '?CCode=0' } });
  await h.rt.flush();
  assert.equal(h.checks(), 1);
  assert.ok(!JSON.stringify(h.rt.tree()).includes('התשלום אושר והמנוי שלכם פעיל.'));
  h.activate();
  assert.ok(JSON.stringify(h.rt.tree()).includes('התשלום אושר והמנוי שלכם פעיל.'));
  h.rt.unmount();
  assert.equal(h.rt.pendingTimers(), 0);
});

test('load failure gives a recovery screen and does not report paid membership', async () => {
  const h = screen();
  find(h.rt.tree(), 'WebView').props.onError(); await h.rt.flush();
  assert.ok(JSON.stringify(h.rt.tree()).includes('לא הצלחנו לטעון את התשלום'));
  assert.equal(find(h.rt.tree(), 'WebView'), undefined);
  assert.equal(h.checks(), 0);
  h.rt.unmount();
});
