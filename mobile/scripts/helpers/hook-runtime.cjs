const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const root = path.resolve(__dirname, '../..');

function runtime() {
  let now = 0, nextTimer = 0, index = 0, dirty = false, tree, component;
  const timers = new Map(), slots = [], effects = [];
  const clock = {
    setTimeout: (fn, ms) => { const id = ++nextTimer; timers.set(id, { at: now + ms, fn }); return id; },
    clearTimeout: (id) => timers.delete(id),
  };
  const react = {
    createContext: () => ({ Provider: 'Provider' }),
    createElement: (type, props, ...children) => ({ type, props: { ...props, children } }),
    useState: (initial) => { const i = index++; if (!(i in slots)) slots[i] = typeof initial === 'function' ? initial() : initial; return [slots[i], (next) => { slots[i] = typeof next === 'function' ? next(slots[i]) : next; dirty = true; }]; },
    useRef: (initial) => { const i = index++; if (!(i in slots)) slots[i] = { current: initial }; return slots[i]; },
    useEffect: (fn, deps) => {
      const i = index++, old = slots[i];
      if (!old || !deps || deps.some((dep, n) => !Object.is(dep, old.deps[n]))) {
        slots[i] = { deps, cleanup: old?.cleanup };
        effects.push(() => { slots[i].cleanup?.(); slots[i].cleanup = fn(); });
      }
    },
    useCallback: (fn, deps) => react.useMemo(() => fn, deps),
    useMemo: (fn, deps) => {
      const i = index++, old = slots[i];
      if (!old || !deps || deps.some((dep, n) => !Object.is(dep, old.deps[n]))) slots[i] = { deps, value: fn() };
      return slots[i].value;
    },
  };
  react.useLayoutEffect = react.useEffect;
  react.default = react;
  const render = () => { dirty = false; index = 0; tree = component(); effects.splice(0).forEach(fn => fn()); return tree; };
  const flush = async () => { for (let i = 0; i < 30; i++) { await Promise.resolve(); if (dirty) render(); } };
  return {
    react, clock, flush,
    load: (file, mocks) => {
      const module = { exports: {} };
      const code = ts.transpileModule(fs.readFileSync(path.join(root, file), 'utf8'), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React } }).outputText;
      vm.runInNewContext(code, { module, exports: module.exports, ...clock,
        requestAnimationFrame: fn => clock.setTimeout(fn, 16), cancelAnimationFrame: clock.clearTimeout,
        require: (name) => {
        if (name === 'react') return react;
        if (name.endsWith('/theme/radii') || name.endsWith('/theme/storeAccent')) {
          const theme = { exports: {} };
          const themeCode = ts.transpileModule(fs.readFileSync(path.join(root, 'src/theme/' + name.split('/').pop() + '.ts'), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
          vm.runInNewContext(themeCode, { exports: theme.exports, module: theme });
          return theme.exports;
        }
        if (name in mocks) { const value = mocks[name]; return { ...value, default: value.default ?? value }; }
        throw Error('Unmocked import ' + name);
      } });
      return module.exports;
    },
    mount: (fn) => {
      if (component) { slots.forEach(slot => slot?.cleanup?.()); slots.length = 0; effects.length = 0; }
      component = fn; return render();
    },
    tree: () => tree, render,
    tick: async (ms) => { now += ms; for (const [id, timer] of [...timers]) { if (timer.at <= now) { timers.delete(id); timer.fn(); } } await flush(); },
    unmount: () => slots.forEach(slot => slot?.cleanup?.()),
    pendingTimers: () => timers.size,
  };
}

module.exports = { runtime };
