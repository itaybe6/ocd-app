const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

function harness(overrides = {}) {
  const row = { id: 'sub', user_id: 'user', status: 'active', current_period_end: new Date(Date.now()+86400000).toISOString(),
    hyp_subscription_id: '123', shopify_customer_id: 'customer', sync_version: 1, synced_version: 0,
    sync_token: null, cancel_requested_at: null, provider_cancelled_at: null, ...overrides.row };
  const calls = [];
  const db = {
    async rpc(name) {
      assert.equal(name, 'ocd_claim_sync');
      if (row.sync_token || row.sync_version === row.synced_version) return {data: []};
      row.sync_token = 'lease';
      return {data: [{...row}]};
    },
    from(table) {
      let patch, filters = [];
      const builder = {
        update(value) { patch = value; return this; },
        eq(key, value) { filters.push([key,value]); return this; },
        then(resolve, reject) {
          try {
            if (table === 'ocd_plus_subscriptions' && filters.every(([key,value]) => row[key] === value)) Object.assign(row, patch);
            return Promise.resolve({error: null}).then(resolve,reject);
          } catch (e) { return Promise.reject(e).then(resolve,reject); }
        },
      };
      return builder;
    },
  };
  const mod = {exports:{}};
  const source = fs.readFileSync(path.resolve(__dirname, '../../supabase/functions/_shared/ocdPlusLifecycle.ts'),'utf8');
  const code = ts.transpileModule(source, { compilerOptions: { target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS } }).outputText;
  vm.runInNewContext(code, {exports:mod.exports,module:mod,Date,require(name) {
    if (name === './hyp.ts') return {cancelHypSubscription: async () => {calls.push('cancel'); if(overrides.cancelFails) throw Error('Unconfirmed'); return {ok:true};}};
    if (name === './shopifyAdmin.ts') return {
      addOcdPlusTag: async () => { calls.push('add'); if(overrides.tagFails) throw Error('Unavailable'); if(overrides.newRevision) row.sync_version++; },
      removeOcdPlusTag: async () => {calls.push('remove');},
      findOrCreateCustomerByPhone: () => {throw Error('Unexpected customer creation');},
    };
    throw Error(`Unexpected import ${name}`);
  }});
  return {...mod.exports,row,db,calls};
}

test('successful tag update acknowledges the exact revision and releases the lease',async()=>{
  const h = harness(); assert.equal(await h.syncMembership(h.db),'synced');
  assert.deepEqual(h.calls,['add']); assert.equal(h.row.synced_version,1); assert.equal(h.row.sync_token,null);
  assert.equal(await h.syncMembership(h.db),'idle');
});
test('Shopify outage retains unsynced work with a retry timestamp',async()=>{
  const h = harness({tagFails:true}); assert.equal(await h.syncMembership(h.db),'retry');
  assert.equal(h.row.synced_version,0); assert.equal(h.row.sync_error,'shopify_tag');
  assert.ok(Date.parse(h.row.sync_retry_at)>Date.now()); assert.equal(h.row.sync_token,null);
});
test('a newer payment revision is not acknowledged by an older worker',async()=>{
  const h = harness({newRevision:true}); await h.syncMembership(h.db);
  assert.equal(h.row.sync_version,2); assert.equal(h.row.synced_version,0);
});
test('unconfirmed HYP cancellation is not reported as cancelled',async()=>{
  const h = harness({cancelFails:true,row:{cancel_requested_at:new Date().toISOString()}});
  assert.equal(await h.syncMembership(h.db),'retry'); assert.deepEqual(h.calls,['cancel']);
  assert.equal(h.row.provider_cancelled_at,null); assert.equal(h.row.status,'active');
  assert.equal(h.row.sync_error,'cancel');
});
test('confirmed cancellation preserves paid access; expired membership loses the tag',async()=>{
  const h = harness({row:{cancel_requested_at:new Date().toISOString()}});
  await h.syncMembership(h.db); assert.deepEqual(h.calls,['cancel','add']);
  assert.equal(h.row.cancel_at_period_end,true); assert.ok(h.row.provider_cancelled_at);
  const expired = harness({row:{current_period_end:new Date(Date.now()-1000).toISOString()}});
  await expired.syncMembership(expired.db); assert.deepEqual(expired.calls,['remove']);
});
test('paid-through failed renewal retains access while legacy manual memberships stay unchanged',()=>{
  const h = harness(); assert.equal(h.membershipIsActive({...h.row,status:'past_due'}),true);
  assert.equal(h.membershipIsActive({...h.row,current_period_end:'2020-01-01'}),false);
  assert.equal(h.membershipIsActive({...h.row,current_period_end:'2020-01-01',hyp_subscription_id:null}),true);
});
