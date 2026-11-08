const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const file = path.resolve(__dirname, '../../supabase/functions/_shared/hypPay.ts');
const moduleUnderTest = { exports: {} };
const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText;
vm.runInNewContext(code, { module: moduleUnderTest, exports: moduleUnderTest.exports, URLSearchParams, AbortSignal, fetch: () => { throw Error('Live network is forbidden in this test'); } });
const { createHypPayAgreement, verifyHypPayCompletion, stopHypPayAgreement } = moduleUnderTest.exports;
const config = { terminal: '0010000000', apiKey: 'test-key-not-real', passP: 'test-password-not-real' };
const args = { amount: 49, currency: 'ILS', reference: '12345678-1234-1234-1234-123456789abc', name: 'ישראל ישראלי', phone: '0501234567' };
const response = text => new Response(text);
const completion = `Id=123&CCode=0&Amount=49&Order=${args.reference}&HKId=456&Sign=${'a'.repeat(64)}`;
const signed = url => { const p = new URL(url).searchParams; p.delete('KEY'); p.delete('PassP'); p.delete('What'); p.set('action', 'pay'); p.append('signature', 'b'.repeat(64)); return p; };

test('49 ILS monthly agreement is signed on server, with no credentials in the public URL', async () => {
  let sent;
  const result = await createHypPayAgreement(config, args, async (url, init) => {
    sent = new URL(url).searchParams;
    assert.equal(init.redirect, 'error');
    assert.equal(sent.get('PassP'), config.passP);
    assert.equal(sent.get('KEY'), config.apiKey);
    assert.equal(sent.get('Amount'), '49.00');
    assert.equal(sent.get('Coin'), '1');
    assert.equal(sent.get('HK'), 'True');
    assert.equal(sent.get('freq'), '1');
    assert.equal(sent.get('Tash'), '999');
    assert.equal(sent.get('OnlyOnApprove'), 'True');
    return response(signed(url).toString());
  });
  assert.ok(result.startsWith('https://pay.hyp.co.il/p/?'));
  assert.ok(!result.includes(config.apiKey));
  assert.ok(!result.includes(config.passP));
  assert.equal(new URL(result).searchParams.get('Order'), args.reference);
});

test('unsigned, downgraded and secret-bearing payment-page responses are rejected', async () => {
  for (const mutate of [p => p.delete('signature'), p => p.set('HK', 'False'), p => p.set('Amount', '69.00'), p => p.set('Order', 'different'), p => p.set('KEY', config.apiKey)]) {
    await assert.rejects(createHypPayAgreement(config, args, async url => { const p = signed(url); mutate(p); return response(p.toString()); }));
  }
});

test('provider HTTP 200 errors, HTML and timeouts do not become payment links', async () => {
  for (const body of ['CCode=902', '<html>error</html>', '', 'action=pay&action=pay']) {
    await assert.rejects(createHypPayAgreement(config, args, async () => response(body)));
  }
  await assert.rejects(createHypPayAgreement(config, args, async url => { throw Error(url); }), error => !error.message.includes(config.apiKey) && !error.message.includes(config.passP));
});

test('verification uses provider VERIFY and persists only allowlisted metadata', async () => {
  const result = await verifyHypPayCompletion(config, completion + '&UserId=123456789&L4digit=1234', async url => {
    const p = new URL(url).searchParams;
    assert.equal(p.get('What'), 'VERIFY');
    assert.equal(p.get('Sign'), 'a'.repeat(64));
    assert.deepEqual([...p.keys()].slice(5), ['Id', 'CCode', 'Amount', 'Order', 'HKId', 'Sign', 'UserId', 'L4digit']);
    return response('CCode=0');
  });
  assert.equal(result.success, true);
  assert.equal(result.amount, 49);
  assert.equal(result.hypSubscriptionId, '456');
  assert.equal(result.subscriptionId, args.reference);
  assert.equal(result.raw.UserId, undefined);
  assert.equal(result.raw.Sign, undefined);
  assert.equal(result.raw.L4digit, undefined);
});

test('verification rejects unsigned callbacks, duplicate fields and auth overrides before network access', async () => {
  const never = async () => { assert.fail('must not call Hyp'); };
  for (const raw of [completion.replace(/&Sign=.*/, ''), completion + '&Amount=49', completion + '&amount=49', completion + '&KEY=attacker', completion + '&action=soft']) {
    await assert.rejects(verifyHypPayCompletion(config, raw, never));
  }
});

test('verified failed charges and authorization-only statuses do not activate membership', async () => {
  for (const status of ['1', '700', '800']) {
    const result = await verifyHypPayCompletion(config, completion.replace('CCode=0', `CCode=${status}`), async () => response('CCode=0'));
    assert.equal(result.success, false);
  }
  await assert.rejects(verifyHypPayCompletion(config, completion, async () => response('CCode=902')));
  await assert.rejects(verifyHypPayCompletion(config, completion, async () => response('OK=true')));
});

test('cancellation requires confirmation for the exact agreement', async () => {
  const result = await stopHypPayAgreement(config, '456', async url => {
    const p = new URL(url).searchParams;
    assert.equal(p.get('action'), 'HKStatus');
    assert.equal(p.get('NewStat'), '1');
    return response('HKId=456&CCode=0');
  });
  assert.equal(result.ok, true);
  for (const body of ['HKId=456&CCode=906', 'HKId=999&CCode=0', 'CCode=0']) {
    await assert.rejects(stopHypPayAgreement(config, '456', async () => response(body)));
  }
});

test('invalid config, amount and references never issue requests', async () => {
  const never = async () => { assert.fail('must not call Hyp'); };
  for (const input of [{ ...args, amount: -1 }, { ...args, amount: NaN }, { ...args, currency: 'USD' }, { ...args, reference: 'bad&Order=other' }]) {
    await assert.rejects(createHypPayAgreement(config, input, never));
  }
  await assert.rejects(createHypPayAgreement({ ...config, passP: '' }, args, never));
  await assert.rejects(stopHypPayAgreement(config, '456&NewStat=2', never));
});

test('credentials alone cannot enable checkout; verification and cancellation stay server-side', async () => {
  const wrapperFile = path.resolve(__dirname, '../../supabase/functions/_shared/hyp.ts');
  const compiled = ts.transpileModule(fs.readFileSync(wrapperFile, 'utf8'), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText;
  const mod = { exports: {} }, env = { HYP_MASOF: config.terminal, HYP_API_KEY: config.apiKey, HYP_PASS_P: config.passP };
  let creates = 0;
  vm.runInNewContext(compiled, { module: mod, exports: mod.exports, Deno: { env: { get: key => env[key] } }, require: name => {
    assert.equal(name, './hypPay.ts');
    return { createHypPayAgreement: async () => { creates++; return 'https://pay.hyp.co.il/p/?signed'; } };
  } });
  assert.equal(mod.exports.isHypConfigured(), true);
  assert.throws(() => mod.exports.assertHypCheckoutReady(), /not configured/);
  await assert.rejects(mod.exports.createHypPayment({ amount: 49, currency: 'ILS', subscriptionId: args.reference, userId: 'user', callbackUrl: 'https://example.test/return' }));
  assert.equal(creates, 0);
  env.HYP_CHECKOUT_CUSTOMER_IDS = args.reference + ', local-demo-adir';
  assert.doesNotThrow(() => mod.exports.assertHypCheckoutReady(args.reference));
  assert.throws(() => mod.exports.assertHypCheckoutReady('99999999-1234-1234-1234-123456789abc'));
  assert.throws(() => mod.exports.assertHypCheckoutReady('local-demo-adir'));
  assert.throws(() => mod.exports.assertHypCheckoutReady());
  await mod.exports.createHypPayment({ ...args, subscriptionId: args.reference, userId: args.reference });
  assert.equal(creates, 1);
  delete env.HYP_CHECKOUT_CUSTOMER_IDS;
  assert.throws(() => mod.exports.assertHypCheckoutReady(args.reference));
  env.HYP_CHECKOUT_ENABLED = 'true';
  assert.doesNotThrow(() => mod.exports.assertHypCheckoutReady());
  assert.equal(mod.exports.OCD_PLUS_PRICE_ILS, 49);
});
