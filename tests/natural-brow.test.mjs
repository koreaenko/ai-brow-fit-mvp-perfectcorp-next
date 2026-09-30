import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import ts from 'typescript';
const nativeRequire = createRequire(import.meta.url);
const root = path.resolve(import.meta.dirname, '..');
const cache = new Map();
function load(relative) {
  const filename = path.join(root, relative);
  if (cache.has(filename)) return cache.get(filename).exports;
  const compiledModule = { exports: {} };
  cache.set(filename, compiledModule);
  const code = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  new Function('require', 'module', 'exports', code)(
    (id) => id.startsWith('@/') ? load(id.slice(2) + '.ts') : nativeRequire(id), compiledModule, compiledModule.exports,
  );
  return compiledModule.exports;
}
const { enhanceNaturalPixels, boxMean } = load('lib/naturalBrow.ts');
const { getAxis, getUpNormal, mirrorBrowPlacement } = load('lib/browGeometry.ts');
const { browsFromLandmarks } = load('lib/faceLandmarks.ts');
const { warpBrowPixels, browDisplacement } = load('lib/browWarp.ts');
const color = { r: 63, g: 43, b: 36 };
const { removeWhiteMatte } = load('lib/browTemplate.ts');
test('white matte removal preserves dark hair and soft alpha without a white fringe', () => {
  const input = new Uint8ClampedArray([255,255,255,255, 0,0,0,180, 128,128,128,255]);
  const result = removeWhiteMatte(input);
  assert.deepEqual([...result], [0,0,0,0, 0,0,0,180, 0,0,0,127]);
  assert.equal(input[0], 255);
});
const { thickenStrokePixels } = load('lib/browStrokeWidth.ts');
test('stroke width preserves source, pigment and soft coverage without whitening', () => {
  const source = new Uint8ClampedArray(9 * 9 * 4);
  source.set([30, 20, 10, 180], (4 * 9 + 4) * 4);
  const original = source.slice();
  assert.deepEqual(thickenStrokePixels(source, 9, 9, 0), source);
  const half = thickenStrokePixels(source, 9, 9, 0.5);
  const full = thickenStrokePixels(source, 9, 9, 1);
  assert.equal(half[(4 * 9 + 5) * 4 + 3], 90);
  assert.deepEqual([...full.slice((4 * 9 + 5) * 4, (4 * 9 + 5) * 4 + 4)], [30, 20, 10, 180]);
  assert.equal(full[3], 0);
  assert.deepEqual(source, original);
});
test('fill-only preserves existing dark strands and supplies bare skin', () => {
  const source = pixels(81, 180);
  source[160] = source[161] = source[162] = 40;
  const out = enhanceNaturalPixels(source, pixels(81, 0), pixels(81, 0), 9, 9, 180, 1, color, 2, true);
  assert.equal(out[160], 40);
  assert.ok(out[0] < 180);
  assert.deepEqual(enhanceNaturalPixels(source, pixels(81, 0), pixels(81, 0), 9, 9, 180, 0, color, 2, true), source);
});
function pixels(n, value, alpha = 255) {
  return Uint8ClampedArray.from({ length: n * 4 }, (_, i) => i % 4 === 3 ? alpha : value);
}
test('zero intensity is exactly original, including alpha', () => {
  const original = pixels(81, 170);
  assert.deepEqual(enhanceNaturalPixels(original, pixels(81, 0), pixels(81, 0), 9, 9, 180, 0, color, 2), original);
});
test('unmasked skin stays unchanged and no pixel is whitened', () => {
  const source = pixels(81, 150);
  const blank = pixels(81, 0, 0);
  assert.deepEqual(enhanceNaturalPixels(source, blank, blank, 9, 9, 160, 1, color, 2), source);
  const result = enhanceNaturalPixels(source, pixels(81, 0), pixels(81, 0), 9, 9, 180, 1, color, 2);
  for (let i = 0; i < result.length; i++) assert.ok(result[i] <= source[i]);
});
test('existing faint strands darken without darkening surrounding skin', () => {
  const source = pixels(81, 180);
  source[40 * 4] = source[40 * 4 + 1] = source[40 * 4 + 2] = 135;
  const result = enhanceNaturalPixels(source, pixels(81, 0), pixels(81, 0, 0), 9, 9, 180, 1, color, 2);
  assert.ok(result[160] < source[160]);
  assert.equal(result[0], source[0]);
  assert.equal(source[160], 135);
});
test('dense original suppresses additional texture, bare region receives it', () => {
  const mask = pixels(81, 0), texture = pixels(81, 40);
  const dense = enhanceNaturalPixels(pixels(81, 55), mask, texture, 9, 9, 180, 1, color, 2);
  const bare = enhanceNaturalPixels(pixels(81, 180), mask, texture, 9, 9, 180, 1, color, 2);
  assert.equal(dense[160], 55);
  assert.ok(bare[160] < 180);
});
test('soft texture alpha stays soft, not boosted into a fringe', () => {
  const source = pixels(81, 180), mask = pixels(81, 0, 0);
  const faint = enhanceNaturalPixels(source, mask, pixels(81, 0, 25), 9, 9, 180, 1, color, 2);
  const full = enhanceNaturalPixels(source, mask, pixels(81, 0), 9, 9, 180, 1, color, 2);
  assert.ok(180 - faint[160] < (180 - full[160]) * 0.13);
});
test('neighborhood mean is correct at borders', () => {
  const out = boxMean(new Float32Array([1,2,3,4,5,6,7,8,9]), 3, 3, 1);
  assert.equal(out[0], 3); assert.equal(out[4], 5); assert.equal(out[8], 7);
});
test('face axis and normal are perpendicular for tilted faces', () => {
  for (const angle of [-0.8,-0.3,0,0.4,0.9]) {
    const a = getAxis(angle), n = getUpNormal(angle);
    assert.ok(Math.abs(a.x * n.x + a.y * n.y) < 1e-10);
  }
});
test('eyebrow landmarks supply original contour and survive symmetry', () => {
  const landmarks = Array.from({ length: 478 }, (_, i) => ({ x: i < 200 ? 0.3 : 0.7, y: 0.3 }));
  const [left, right] = browsFromLandmarks(landmarks, 100, 100);
  assert.equal(left.contour.length, 10); assert.equal(right.contour.length, 10);
  assert.equal(left.start.x, 30); assert.equal(right.start.x, 70);
  const mirrored = mirrorBrowPlacement({ left, right, angle: 0.3, eyeDistance: 40 });
  assert.deepEqual(mirrored.right.contour, right.contour);
  assert.deepEqual(browsFromLandmarks([], 100, 100), []);
});

const warpPlacement = {
  left: { start: { x: 40, y: 30 }, arch: { x: 30, y: 27 }, tail: { x: 20, y: 30 } },
  right: { start: { x: 60, y: 30 }, arch: { x: 70, y: 27 }, tail: { x: 80, y: 30 } },
  angle: 0, eyeDistance: 40,
};
test('neutral warp returns an exact independent copy', () => {
  const source = pixels(10000, 170);
  const out = warpBrowPixels(source, 100, 100, warpPlacement, { arch: 0, thickness: 0, length: 0 });
  assert.deepEqual(out, source); assert.notEqual(out, source);
});
test('warp keeps distant skin identical and never leaves transparent holes', () => {
  const source = pixels(10000, 170);
  for (let x = 20; x < 40; x++) source[(29 * 100 + x) * 4] = 20;
  const saved = new Uint8ClampedArray(source);
  const out = warpBrowPixels(source, 100, 100, warpPlacement, { arch: 1, thickness: -1, length: 1 });
  assert.notDeepEqual(out, source); assert.deepEqual(source, saved);
  for (let i = 0; i < 10000; i++) assert.equal(out[i * 4 + 3], 255);
  assert.deepEqual(out.slice(60 * 100 * 4), source.slice(60 * 100 * 4));
});
test('both eyebrows arch upward, despite opposite start-to-tail directions', () => {
  for (const brow of [warpPlacement.left, warpPlacement.right]) {
    assert.ok(browDisplacement(brow.arch, brow, 40, { arch: 1, thickness: 0, length: 0 }).y < 0);
  }
});
