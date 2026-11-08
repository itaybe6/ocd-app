const test = require('node:test');
const assert = require('node:assert/strict');
const { runtime } = require('./helpers/hook-runtime.cjs');
const frames = require('../src/lib/productImageFrames.json');
const load = data => runtime().load('src/lib/productImageFraming.ts', { './productImageFrames.json': data }).productImageFraming;

test('every measured catalog product stays inside the square with padding and unchanged proportions', () => {
  const framing = load(frames);
  let enlarged = 0;
  for (const [url, [x, y, w, h, aspect]] of Object.entries(frames)) {
    const style = framing(url);
    if (!style) continue;
    enlarged++;
    const width = parseFloat(style.width) / 100, height = parseFloat(style.height) / 100;
    const left = parseFloat(style.start) / 100, top = parseFloat(style.top) / 100;
    assert.ok(Math.abs(width / height - aspect) < 0.00001, url);
    assert.ok(left + x * width >= 0.01999 && top + y * height >= 0.01999, url);
    assert.ok(left + (x + w) * width <= 0.98001 && top + (y + h) * height <= 0.98001, url);
    assert.ok(Math.max(width, height) <= 1.80001, url);
  }
  assert.ok(enlarged > 0);
});

test('unknown images and changed image versions are never blindly zoomed', () => {
  const url = Object.keys(frames)[0], framing = load(frames);
  assert.equal(framing('https://example.com/new-image.jpg'), null);
  assert.equal(framing(url + '&v=replaced'), null);
});

test('wide and tall product photos preserve their aspect ratio while centering off-center subjects', () => {
  const data = { wide: [0.4, 0.2, 0.3, 0.6, 2], tall: [0.2, 0.3, 0.6, 0.4, 0.5] };
  const framing = load(data);
  for (const [key, [x, y, w, h, aspect]] of Object.entries(data)) {
    const style = framing(key);
    assert.ok(style);
    const width = parseFloat(style.width) / 100, height = parseFloat(style.height) / 100;
    assert.ok(Math.abs(width / height - aspect) < 0.00001);
    assert.ok(Math.abs(parseFloat(style.start) / 100 + (x + w / 2) * width - 0.5) < 0.00001);
    assert.ok(Math.abs(parseFloat(style.top) / 100 + (y + h / 2) * height - 0.5) < 0.00001);
  }
});

test('invalid and already tightly framed images fall back to contain', () => {
  const framing = load({ edge: [0, 0, 1, 1, 1], invalid: [-1, 0, 1, 1, 1], zero: [0, 0, 0, 1, 1] });
  for (const url of ['edge', 'invalid', 'zero']) assert.equal(framing(url), null);
});
