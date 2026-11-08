// Real React + React Query render: the hook mocks in the screen tests cannot catch
// development warnings emitted by useBaseQuery (such as the missing queryFn bug).
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const React = require('react');
const { renderToString } = require('react-dom/server');
const query = require('@tanstack/react-query');

function load(file, dependencies) {
  const module = { exports: {} };
  const code = ts.transpileModule(fs.readFileSync(path.join(__dirname, '..', file), 'utf8'), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
  }).outputText;
  vm.runInNewContext(code, { module, exports: module.exports, require: name => {
    if (name in dependencies) return dependencies[name];
    throw Error('Unexpected dependency: ' + name);
  } });
  return module.exports;
}

function setup(t) {
  const client = new query.QueryClient({ defaultOptions: { queries: { gcTime: Infinity, retry: false } } });
  t.after(() => client.clear());
  let requests = 0;
  const catalog = load('src/lib/storeCatalog.ts', { './shopify': { fetchProducts: async () => { requests++; return []; } } });
  const { useStoreCatalog } = load('src/hooks/useStoreCatalog.ts', {
    '@tanstack/react-query': query,
    '../lib/storeCatalog': catalog,
  });
  let result;
  function Screen() {
    result = useStoreCatalog();
    return React.createElement('main', null, result.products.map(product => product.id).join(','));
  }
  const render = () => renderToString(React.createElement(query.QueryClientProvider, { client }, React.createElement(Screen)));
  return { client, catalog, render, result: () => result, requests: () => requests };
}

test('real React Query renders cold, partial and cached catalog without the missing queryFn warning', t => {
  const error = t.mock.method(console, 'error', () => {});
  const warn = t.mock.method(console, 'warn', () => {});
  const s = setup(t);
  assert.equal(s.render(), '<main></main>');
  assert.equal(s.result().products.length, 0);
  s.client.setQueryData(s.catalog.STORE_CATALOG_PREVIEW_KEY, [{ id: 'first-page' }]);
  assert.equal(s.render(), '<main>first-page</main>');
  s.client.setQueryData(s.catalog.STORE_CATALOG_KEY, [{ id: 'complete' }]);
  assert.equal(s.render(), '<main>complete</main>');
  s.render();
  assert.equal(error.mock.callCount(), 0, 'no development errors, including on repeated renders');
  assert.equal(warn.mock.callCount(), 0);
});

test('cache-only preview observer receives live pages but never fetches on mount or invalidation', async t => {
  const s = setup(t);
  s.render();
  const cachedQuery = s.client.getQueryCache().find({ queryKey: s.catalog.STORE_CATALOG_PREVIEW_KEY });
  const observer = new query.QueryObserver(s.client, cachedQuery.options);
  const updates = [];
  const unsubscribe = observer.subscribe(result => updates.push(result.data));
  t.after(() => { unsubscribe(); observer.destroy(); cachedQuery.destroy(); });
  s.client.setQueryData(s.catalog.STORE_CATALOG_PREVIEW_KEY, [{ id: 'page-one' }]);
  assert.equal(observer.getCurrentResult().data[0].id, 'page-one');
  s.client.setQueryData(s.catalog.STORE_CATALOG_PREVIEW_KEY, [{ id: 'page-one' }, { id: 'page-two' }]);
  assert.equal(observer.getCurrentResult().data.length, 2);
  await s.client.invalidateQueries({ queryKey: s.catalog.STORE_CATALOG_PREVIEW_KEY });
  assert.equal(observer.getCurrentResult().fetchStatus, 'idle');
  assert.equal(observer.getCurrentResult().isError, false);
  assert.equal(s.requests(), 0);
  assert.ok(updates.some(products => products?.length === 2));
});

test('a failed full catalog still displays its partial products on a real hook render', async t => {
  const error = t.mock.method(console, 'error', () => {});
  const s = setup(t);
  s.client.setQueryData(s.catalog.STORE_CATALOG_PREVIEW_KEY, [{ id: 'still-visible' }]);
  await assert.rejects(s.client.fetchQuery({
    queryKey: s.catalog.STORE_CATALOG_KEY,
    queryFn: async () => { throw Error('offline'); },
    retry: false,
  }));
  assert.equal(s.render(), '<main>still-visible</main>');
  assert.equal(error.mock.callCount(), 0);
});
