const test = require('node:test');
const assert = require('node:assert/strict');
const { runtime } = require('./helpers/hook-runtime.cjs');
const { homeStickySearchOffset: offset } = runtime().load('src/lib/homeStickySearch.ts', {});

test('search scrolls normally until it reaches the safe area, then stays there', () => {
  for (const safeTop of [0, 24, 59]) {
    const searchY = safeTop + 82;
    for (const scroll of [0, 20, 81]) assert.equal(offset(scroll, searchY, safeTop), 0);
    for (const scroll of [82, 100, 600, 3000]) {
      const screenY = searchY - scroll + offset(scroll, searchY, safeTop);
      assert.equal(screenY, safeTop);
    }
  }
});

test('returning to the top and pulling to refresh release the search without a jump', () => {
  const searchY = 141, safeTop = 59;
  const positions = [300, 83, 82, 81, 0, -40].map(scroll => searchY - scroll + offset(scroll, searchY, safeTop));
  assert.deepEqual(positions, [59, 59, 59, 60, 141, 181]);
});

test('layout is measured before sticking and safe-area changes take effect immediately', () => {
  assert.equal(offset(300, -1, 59), 0);
  assert.equal(141 - 300 + offset(300, 141, 24), 24);
  assert.equal(110 - 300 + offset(300, 110, 0), 0);
});
