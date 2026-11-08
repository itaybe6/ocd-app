const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const source = fs.readFileSync(path.resolve(__dirname, '../src/lib/localDemoAccount.ts'), 'utf8');
function load(dev) {
  const module = { exports: {} };
  vm.runInNewContext(ts.transpileModule(source, {compilerOptions: {module: ts.ModuleKind.CommonJS}}).outputText,
    {module, exports: module.exports, __DEV__: dev});
  return module.exports;
}
test('local demo accepts only Adir phone and the requested code, without issuing server tokens', () => {
  const demo = load(true);
  for (const phone of ['0521234567', '+972521234567', '972521234567', '052-123-4567']) {
    const user = demo.verifyLocalDemoAccount(phone, '123456');
    assert.equal(user.name, 'אדיר'); assert.equal(user.role, 'customer');
    assert.equal(user.ocd_plus_subscriber, false); assert.equal(user.shopify_customer_id, null);
    assert.equal(user.session, undefined); assert.equal(user.password, undefined);
  }
});
test('wrong codes and other customers cannot use the demo identity', () => {
  const demo = load(true);
  assert.throws(() => demo.verifyLocalDemoAccount('0521234567', '000000'));
  assert.throws(() => demo.verifyLocalDemoAccount('0521234568', '123456'));
  assert.equal(demo.isLocalDemoPhone('text0521234567'), false);
});
test('release builds reject the demo even with the correct code or cached id', () => {
  const demo = load(false);
  assert.equal(demo.isLocalDemoPhone('0521234567'), false);
  assert.equal(demo.isLocalDemoUser(demo.LOCAL_DEMO_USER_ID), false);
  assert.throws(() => demo.verifyLocalDemoAccount('0521234567', '123456'));
});
