// Runs the production TypeScript with an in-memory database and test-only JWT
// signing key. No real accounts, credentials or network requests are used.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { webcrypto } = require('node:crypto');
const ts = require('typescript');
const root = path.resolve(__dirname, '../..');

function loader(mocks = {}, globals = {}) {
  const cache = new Map();
  return function load(file) {
    file = path.resolve(file);
    if (cache.has(file)) return cache.get(file).exports;
    const mod = { exports: {} }; cache.set(file, mod);
    const source = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.React } }).outputText;
    vm.runInNewContext(source, {
      exports: mod.exports, module: mod, Request, Response, Headers, TextEncoder, TextDecoder, atob, btoa, crypto: webcrypto,
      require: (name) => {
        if (Object.hasOwn(mocks, name)) return mocks[name];
        if (!name.startsWith('.')) throw Error('Unexpected import: '+name);
        const target = path.resolve(path.dirname(file), name);
        return load(fs.existsSync(target) ? target : target + '.ts');
      },
      ...globals,
    }, { filename: file });
    return mod.exports;
  };
}

function backend() {
  let handler;
  const rows = new Map([['alice', { id:'alice',name:'Alice',phone:'0500000000',role:'customer' }], ['bob', { id:'bob',name:'Bob',phone:'0500000001',role:'customer' }]]);
  const writes = [];
  const db = { fail:false, from(table) {
    assert.equal(table, 'users');
    let id, patch;
    const builder = {
      select: () => builder,
      eq: (key,value) => { assert.equal(key,'id');id=value;return builder; },
      limit: async () => ({data:rows.has(id)?[rows.get(id)]:[],error:null}),
      update: (value) => {patch={...value};return builder;},
      single: async () => {
        if(db.fail || !rows.has(id)) return {data:null,error:{message:'private database detail'}};
        writes.push({id,patch}); rows.set(id,{...rows.get(id),...patch});
        return {data:{id,name:rows.get(id).name},error:null};
      },
    }; return builder;
  }};
  const load = loader({'../_shared/supabaseAdmin.ts':{createSupabaseAdmin:()=>db}}, {
    Deno:{env:{get:(key)=>key==='APP_JWT_SECRET'?'test-only-secret-never-used-in-production':undefined},serve:(fn)=>{handler=fn;}},
  });
  load(path.join(root,'supabase/functions/customer-profile/index.ts'));
  const {signAppSession}=load(path.join(root,'supabase/functions/_shared/appSession.ts'));
  return {rows,writes,db,sign:async(id,ttl)=>(await signAppSession(id,ttl)).token,
    call:(body,token,method='POST')=>handler(new Request('https://example.invalid/customer-profile',{method,headers:{'content-type':'application/json',...(token?{'x-app-session':token}:{})},...(method==='POST'?{body:typeof body==='string'?body:JSON.stringify(body)}:{})}))};
}

test('missing, invalid and expired sessions cannot update a profile', async()=>{
  const b=backend();
  for(const token of [undefined,'not-a-token',await b.sign('alice',-1)]) assert.equal((await b.call({name:'Changed Name'},token)).status,401);
  assert.equal(b.writes.length,0);
});
test('a verified session updates only its own name and returns confirmed server data',async()=>{
  const b=backend(); const res=await b.call({name:'  איתי   כהן  '},await b.sign('alice'));
  assert.equal(res.status,200);
  assert.deepEqual(await res.json(),{ok:true,profile:{id:'alice',name:'איתי כהן'}});
  assert.deepEqual(b.writes,[{id:'alice',patch:{name:'איתי כהן'}}]);
  assert.equal(b.rows.get('bob').name,'Bob');assert.equal(b.rows.get('alice').phone,'0500000000');
});
test('identity spoofing and phone/role/member changes are rejected',async()=>{
  const b=backend();const token=await b.sign('alice');
  for(const extra of [{userId:'bob'},{id:'bob'},{phone:'0511111111'},{role:'admin'},{ocd_plus_subscriber:true}]) {
    assert.equal((await b.call({name:'Valid Name',...extra},token)).status,400);
  }
  assert.equal(b.writes.length,0);
});
test('invalid input, oversized requests and removed accounts cannot write',async()=>{
  const b=backend();const token=await b.sign('alice');
  for(const body of ['{',null,[],{}, {name:3},{name:' '},{name:'a'},{name:'a'.repeat(81)},{name:'test\u0000name'}]) assert.equal((await b.call(body,token)).status,400);
  assert.equal((await b.call({name:'a'.repeat(3000)},token)).status,413);
  b.rows.delete('alice');assert.equal((await b.call({name:'Valid Name'},token)).status,401);
  assert.equal(b.writes.length,0);
});
test('database errors never report success or disclose database details',async()=>{
  const b=backend();b.db.fail=true;const res=await b.call({name:'Valid Name'},await b.sign('alice'));
  assert.equal(res.status,500);assert.equal((await res.json()).ok,false);assert.equal(b.writes.length,0);
});
test('CORS allows the app-session header and unsupported methods are rejected',async()=>{
  const b=backend();const res=await b.call(null,null,'OPTIONS');
  assert.equal(res.status,200);assert.match(res.headers.get('access-control-allow-headers'),/x-app-session/);
  assert.equal((await b.call(null,null,'GET')).status,405);
});

function client(tokens,responses) {
  const requests=[],refreshes=[];
  const load=loader({
    './appSession':{getAccessToken:async(force)=>{refreshes.push(!!force);return tokens.shift()??null;}},
    './supabase':{supabaseUrl:'https://example.invalid',supabaseAnonKey:'public-test-key'},
  },{fetch:async(url,options)=>{requests.push({url,...options});const next=responses.shift();if(next instanceof Error)throw next;return new Response(JSON.stringify(next.body),{status:next.status});}});
  return {...load(path.join(root,'mobile/src/lib/customerProfile.ts')),requests,refreshes};
}
test('client sends only normalized name and a signed session',async()=>{
  const c=client(['session'],[{status:200,body:{ok:true,profile:{id:'alice',name:'Alice Smith'}}}]);
  const data=await c.updateCustomerName('  Alice   Smith  ');
  assert.equal(data.name,'Alice Smith');assert.equal(c.requests.length,1);
  assert.deepEqual(JSON.parse(c.requests[0].body),{name:'Alice Smith'});
  assert.equal(c.requests[0].headers['x-app-session'],'session');
});
test('client refreshes once on 401 and never retries indefinitely',async()=>{
  const c=client(['old','new'],[{status:401,body:{}},{status:401,body:{}}]);
  await assert.rejects(c.updateCustomerName('Alice Smith'),/להתחבר מחדש/);
  assert.deepEqual(c.refreshes,[false,true]);assert.equal(c.requests.length,2);
  assert.equal(c.requests[1].headers['x-app-session'],'new');
});
test('missing session or invalid name do not send a request',async()=>{
  const c=client([],[]);await assert.rejects(c.updateCustomerName('Alice Smith'),/להתחבר מחדש/);
  await assert.rejects(c.updateCustomerName(' '),/2 עד 80/);assert.equal(c.requests.length,0);
});
test('network failures and malformed success responses stay failures',async()=>{
  const c=client(['token'],[new Error('offline')]);await assert.rejects(c.updateCustomerName('Alice Smith'),/offline/);
  const bad=client(['token'],[{status:200,body:{ok:true,profile:{name:'Alice'}}}]);await assert.rejects(bad.updateCustomerName('Alice Smith'),/לא התקבל אישור/);
});
test('phone display preserves local numbers and makes international format explicit',()=>{
  const c=client([],[]);
  assert.equal(c.displayAccountPhone('0501234567'),'0501234567');
  assert.equal(c.displayAccountPhone('972501234567'),'+972501234567');
  assert.equal(c.displayAccountPhone('+442012345678'),'+442012345678');
  assert.equal(c.isValidProfileName('איתי כהן'),true);
  assert.equal(c.isValidProfileName('a'.repeat(81)),false);
});

async function authHarness(updateCustomerName) {
  const initial = {id:'alice',name:'Alice',phone:'0500000000',role:'customer',address:'Old address'};
  const storage = new Map([['user',JSON.stringify(initial)]]);
  const hooks=[],effects=[];let index=0,first=true,value;
  const react = {
    createContext:()=>({Provider:'TestProvider'}),
    createElement:(_type,props)=>{if(props?.value)value=props.value;return null;},
    useState:(initialValue)=>{const slot=index++;if(!(slot in hooks))hooks[slot]=initialValue;return [hooks[slot],(next)=>{hooks[slot]=typeof next==='function'?next(hooks[slot]):next;}];},
    useRef:(initialValue)=>{const slot=index++;if(!(slot in hooks))hooks[slot]={current:initialValue};return hooks[slot];},
    useEffect:(fn)=>{if(first)effects.push(fn);},
    useCallback:(fn)=>fn,useMemo:(fn)=>fn(),
  };
  const load=loader({
    react,
    '@react-native-async-storage/async-storage':{getItem:async(k)=>storage.get(k)??null,setItem:async(k,v)=>storage.set(k,v),removeItem:async(k)=>storage.delete(k)},
    '../components/toast/Toast':{show:()=>{}},
    '../lib/authOtp':{},
    '../lib/appSession':{restoreSession:async()=>null,clearSession:async()=>{},getRefreshToken:async()=>null},
    '../lib/customerProfile':{updateCustomerName},
    '../navigation/navigationRef':{navigationRef:{isReady:()=>true,reset:()=>{}}},
  },{setTimeout});
  const {AuthProvider}=load(path.join(root,'mobile/src/state/AuthContext.tsx'));
  const render=()=>{index=0;AuthProvider({children:null});first=false;return value;};
  render();effects.forEach(fn=>fn());await new Promise(setImmediate);render();
  return {context:()=>value,render,stored:()=>JSON.parse(storage.get('user')??'null')};
}
test('confirmed names update the context and persisted user without losing other changes',async()=>{
  let finish;const h=await authHarness(()=>new Promise(resolve=>{finish=resolve;}));
  const saving=h.context().updateName('New Name');
  await h.context().setUser({...h.context().user,address:'Latest address'});
  finish({id:'alice',name:'New Name'});await saving;
  assert.equal(h.render().user.name,'New Name');
  assert.equal(h.stored().name,'New Name');assert.equal(h.stored().address,'Latest address');
  assert.equal(h.stored().phone,'0500000000');
});
test('a late save response cannot resurrect a signed-out user',async()=>{
  let finish;const h=await authHarness(()=>new Promise(resolve=>{finish=resolve;}));
  const saving=h.context().updateName('New Name');
  await h.context().setUser(null);finish({id:'alice',name:'New Name'});
  await assert.rejects(saving,/החשבון המחובר השתנה/);
  assert.equal(h.stored(),null);assert.equal(h.render().user,null);
});
test('a late save response cannot overwrite a different signed-in account',async()=>{
  let finish;const h=await authHarness(()=>new Promise(resolve=>{finish=resolve;}));
  const saving=h.context().updateName('New Name');
  await h.context().setUser({id:'bob',name:'Bob',phone:'0500000001',role:'customer'});
  finish({id:'alice',name:'New Name'});await assert.rejects(saving,/החשבון המחובר השתנה/);
  assert.equal(h.stored().id,'bob');assert.equal(h.stored().name,'Bob');
});
