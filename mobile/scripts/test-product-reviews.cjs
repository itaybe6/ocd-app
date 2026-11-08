const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');
const vm = require('node:vm');
const { toCrossJSON, fromJSON, createPlugin } = require('seroval');
const { runtime } = require('./helpers/hook-runtime.cjs');

const compile = file => ts.transpileModule(fs.readFileSync(path.resolve(__dirname, '../src/lib', file + '.ts'), 'utf8'), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText;
function load(file, dependencies = {}) {
  const filename = path.resolve(__dirname, '../src/lib', file + '.ts');
  const loaded = new Module(filename, module);
  loaded.filename = filename;
  loaded.paths = Module._nodeModulePaths(path.dirname(filename));
  loaded.require = name => { if (name in dependencies) return dependencies[name]; throw Error('Unexpected runtime import: ' + name); };
  loaded._compile(compile(file), filename);
  return loaded.exports;
}
const wire = load('reviewWireFormat');
const api = load('productReviews', { './reviewWireFormat': wire });
const valid = { product_handle: 'cleaner', product_title: 'תרסיס', customer_name: '  דנה  ', city: ' תל אביב ', rating: 4, review_text: '  מוצר טוב מאוד  ', image_url: null };
const review = { id: 'r1', product_handle: 'cleaner', customer_name: 'דנה', city: 'תל אביב', review_text: 'מוצר טוב מאוד', rating: 4, created_at: '2026-11-07', active: true, image_url: 'https://example.test/photo.jpg', avatar_url: null };
const response = result => new Response(JSON.stringify(toCrossJSON({ result, error: undefined, context: {} }, {})), { headers: { 'content-type': 'application/json', 'x-tss-serialized': 'true' } });

test('native adapter loads when well-known Symbols are missing, reproducing the previous crash', () => {
  function HermesSymbol(description) { return Symbol(description); }
  for (const key of Object.getOwnPropertyNames(Symbol)) {
    if (!['prototype', 'name', 'length', 'asyncIterator', 'matchAll'].includes(key)) Object.defineProperty(HermesSymbol, key, Object.getOwnPropertyDescriptor(Symbol, key));
  }
  const previous = { exports: {}, module: { exports: {} }, Symbol: HermesSymbol };
  assert.throws(() => vm.runInNewContext(fs.readFileSync(require.resolve('seroval'), 'utf8'), previous), /description/);
  const codec = { exports: {}, Symbol: HermesSymbol };
  vm.runInNewContext(compile('reviewWireFormat'), codec);
  const adapter = { exports: {}, Symbol: HermesSymbol, process: { env: {} }, require: name => { assert.equal(name, './reviewWireFormat'); return codec.exports; } };
  vm.runInNewContext(compile('productReviews'), adapter);
  assert.equal(typeof adapter.exports.fetchProductReviews, 'function');
  const decoded = codec.exports.decodeReviewResponse(toCrossJSON({ result: { reviews: [review] } }, {}));
  assert.equal(decoded.result.reviews[0].customer_name, review.customer_name);
});

test('wire format interoperates with the website serializer for Hebrew, escapes, controls and shared references', () => {
  const strings = ['עברית', 'שורה\nחדשה\tעם "מרכאות"', '<script> & \\x3C \\n', 'א'.repeat(80) + '\u2028\u2029', '\x00\x01\x0b\ud800', '🧼 תמונה'];
  for (const value of strings) {
    const input = { text: value, image_url: null, rating: 5, active: true, extra: undefined };
    assert.deepEqual(fromJSON(wire.encodeReviewRequest(input)), { data: input });
    assert.deepEqual(wire.decodeReviewResponse(toCrossJSON(input, {})), input);
  }
  const shared = { text: 'shared' };
  const result = wire.decodeReviewResponse(toCrossJSON([shared, shared, Object.create(null)], {}));
  assert.equal(result[0], result[1]);
  assert.throws(() => wire.decodeReviewResponse({ t: 25, c: 'unknown', s: {} }), /Unsupported/);
  assert.throws(() => wire.decodeReviewResponse({ t: 4, i: 42 }), /Unknown/);
  const dangerous = JSON.parse('{"__proto__":{"polluted":true}}');
  const safe = wire.decodeReviewResponse(toCrossJSON(dangerous, {}));
  assert.equal(Object.getPrototypeOf(safe), Object.prototype);
  assert.equal({}.polluted, undefined);
});

test('website protocol decodes reviews and excludes inactive, mismatched and malformed records', async t => {
  const requests = [];
  t.mock.method(globalThis, 'fetch', async (url, options) => { requests.push([url, options]); return response({ reviews: [review, { ...review, id: 'inactive', active: false }, { ...review, id: 'different', product_handle: 'another' }, { ...review, rating: 6 }, { ...review, id: 'unsafe', image_url: 'javascript:alert(1)' }] }); });
  const list = await api.fetchProductReviews('cleaner');
  assert.equal(list.length, 2);
  assert.equal(list[0].rating, 4);
  assert.equal(list[1].image_url, null);
  assert.deepEqual(fromJSON(JSON.parse(requests[0][1].body)), { data: { handle: 'cleaner' } });
  assert.equal(requests[0][1].headers.Accept, 'application/json');
  assert.match(requests[0][0], /\/_serverFn\//);
});

test('empty results differ from HTTP, malformed and website errors', async t => {
  const errorPlugin = createPlugin({ tag: '$TSR/Error', test: v => v instanceof Error, parse: { sync: (v, ctx) => ({ message: ctx.parse(v.message) }) }, serialize: () => '', deserialize: () => null });
  const replies = [response({ reviews: [] }), new Response('offline', { status: 503 }), response({ wrong: [] }), new Response(JSON.stringify(toCrossJSON(new Error('rejected'), { plugins: [errorPlugin] })), { status: 400, headers: { 'content-type': 'application/json', 'x-tss-serialized': 'true' } })];
  t.mock.method(globalThis, 'fetch', async () => replies.shift());
  assert.deepEqual(await api.fetchProductReviews('cleaner'), []);
  await assert.rejects(api.fetchProductReviews('cleaner'));
  await assert.rejects(api.fetchProductReviews('cleaner'), /Invalid review list/);
  await assert.rejects(api.fetchProductReviews('cleaner'), /rejected/);
});

test('submission trims only display fields and uses the same website payload including optional photo', async t => {
  let data, calls = 0;
  t.mock.method(globalThis, 'fetch', async (_url, options) => { calls++; data = fromJSON(JSON.parse(options.body)).data; return response({ success: true }); });
  await api.submitProductReview({ ...valid, image_url: 'data:image/jpeg;base64,YQ==' });
  assert.equal(calls, 1);
  assert.deepEqual(data, { ...valid, customer_name: 'דנה', city: 'תל אביב', review_text: 'מוצר טוב מאוד', image_url: 'data:image/jpeg;base64,YQ==' });
});

test('invalid input never makes a request, and network failure is never retried automatically', async t => {
  let calls = 0;
  t.mock.method(globalThis, 'fetch', async () => { calls++; throw new Error('offline'); });
  for (const change of [{ customer_name: ' ' }, { review_text: 'קצר' }, { rating: 0 }, { rating: 1.5 }, { rating: 6 }, { image_url: 'https://arbitrary.test/file' }]) await assert.rejects(api.submitProductReview({ ...valid, ...change }));
  assert.equal(calls, 0);
  await assert.rejects(api.submitProductReview(valid), /offline/);
  assert.equal(calls, 1);
});

test('cancelled product request propagates its abort signal', async t => {
  const abort = new AbortController();
  t.mock.method(globalThis, 'fetch', async (_url, options) => { assert.equal(options.signal.aborted, true); throw new Error('aborted'); });
  abort.abort();
  await assert.rejects(api.fetchProductReviews('cleaner', abort.signal), /aborted/);
});

const nodes = node => !node || typeof node !== 'object' ? [] : [node, ...(node.props?.children ?? []).flat(Infinity).flatMap(nodes)];
const text = node => typeof node === 'string' || typeof node === 'number' ? String(node) : node?.props?.children?.flat(Infinity).map(text).join('') ?? '';
function ui({ reviews = [], isError = false, submit = async () => {}, pick = async () => ({ canceled: true }) } = {}) {
  const r = runtime(), invalidated = [], sent = [];
  const query = { data: reviews, isPending: false, isError, isFetching: false, refetch: async () => {} };
  const component = r.load('src/components/ProductReviews.tsx', {
    'react-native': { View: 'View', Text: 'Text', TextInput: 'Input', Image: 'Image', Modal: 'Modal', KeyboardAvoidingView: 'Keyboard', Pressable: 'Button', ScrollView: 'Scroll', ActivityIndicator: 'Spinner', Linking: { openURL: async () => {} }, Platform: { OS: 'ios' }, StyleSheet: { create: x => x, hairlineWidth: 1 } },
    '@expo/vector-icons': { Ionicons: 'Icon' },
    '@tanstack/react-query': { useQuery: () => query, useQueryClient: () => ({ invalidateQueries: async data => invalidated.push(data) }) },
    'react-native-safe-area-context': { useSafeAreaInsets: () => ({ top: 44, bottom: 34 }) },
    'react-native-reanimated': { useReducedMotion: () => false },
    'expo-image-picker': { launchImageLibraryAsync: pick },
    'expo-image-manipulator': { manipulateAsync: async () => ({ base64: 'YQ==' }), SaveFormat: { JPEG: 'jpeg' } },
    '../lib/productReviews': { ...api, submitProductReview: submit },
    '../state/AuthContext': { useAuth: () => ({ user: { name: 'דנה', city: 'תל אביב' } }) },
  });
  r.mount(() => component.ProductReviews({ handle: 'cleaner', title: 'תרסיס' }));
  const all = () => nodes(r.tree());
  const button = label => all().find(n => n.type === 'Button' && (n.props.accessibilityLabel === label || text(n).includes(label)));
  const openForm = async () => { button('כתיבת ביקורת').props.onPress(); await r.flush(); const form = all().find(n => n.type?.name === 'ReviewForm'); r.mount(() => form.type({ ...form.props, onSent: () => sent.push(true) })); return form; };
  return { r, all, button, openForm, invalidated, sent, content: () => text(r.tree()) };
}

test('reviews initially render three entries, then expand without losing the product-specific cache', async () => {
  const s = ui({ reviews: Array.from({ length: 9 }, (_, i) => ({ ...review, id: String(i) })) });
  assert.equal(s.all().filter(n => n.type?.name === 'ReviewCard').length, 3);
  assert.match(s.content(), /מבוסס על 9 ביקורות/);
  s.button('עוד ביקורות').props.onPress(); await s.r.flush();
  assert.equal(s.all().filter(n => n.type?.name === 'ReviewCard').length, 8);
  const form = await s.openForm(); form.props.onSent();
  assert.deepEqual(s.invalidated[0].queryKey, ['product-reviews', 'cleaner']);
});

test('failed loading is not shown as an empty review list', () => {
  assert.match(ui().content(), /עדיין אין ביקורות/);
  const failed = ui({ isError: true });
  assert.match(failed.content(), /לא הצלחנו לעדכן/);
  assert.doesNotMatch(failed.content(), /עדיין אין ביקורות/);
});

test('form prefills customer name and blocks duplicate submission while pending', async () => {
  let resolve, calls = 0;
  const pending = new Promise(done => { resolve = done; });
  const s = ui({ submit: async () => { calls++; await pending; } });
  await s.openForm();
  assert.equal(s.all().find(n => n.props.accessibilityLabel === 'השם שיופיע בביקורת').props.value, 'דנה');
  assert.equal(s.button('שליחת ביקורת').props.disabled, true);
  s.all().find(n => n.props.accessibilityLabel === 'תוכן הביקורת').props.onChangeText('חוויה טובה מאוד'); await s.r.flush();
  const send = s.button('שליחת ביקורת').props.onPress;
  send(); send(); await s.r.flush();
  assert.equal(calls, 1);
  assert.equal(s.button('סגירת כתיבת ביקורת').props.disabled, true);
  resolve(); await s.r.flush();
  assert.equal(s.sent.length, 1);
});

test('failed submission retains the draft and photo cancellation does not submit', async () => {
  let calls = 0;
  const s = ui({ submit: async () => { calls++; throw new Error('offline'); } });
  await s.openForm();
  s.all().find(n => n.props.accessibilityLabel === 'תוכן הביקורת').props.onChangeText('חוויה טובה מאוד'); await s.r.flush();
  await s.button('יש לכם תמונה').props.onPress(); await s.r.flush(); assert.equal(calls, 0);
  await s.button('שליחת ביקורת').props.onPress(); await s.r.flush();
  assert.equal(calls, 1);
  assert.equal(s.invalidated.length, 0);
  assert.match(s.content(), /לא התקבל אישור/);
  assert.equal(s.all().find(n => n.props.accessibilityLabel === 'תוכן הביקורת').props.value, 'חוויה טובה מאוד');
});
