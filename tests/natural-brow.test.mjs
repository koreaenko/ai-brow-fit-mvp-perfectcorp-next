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
const { virtualBrowThickness } = load('lib/naturalBrow.ts');
const { browTextureEffects } = load('lib/naturalBrow.ts');
const { lightenBrowPixels, LIGHTENING_DEFAULTS } = load('lib/browLightening.ts');
test('lightening changes dark strands only, retains RGB differences, is bounded and non-destructive', () => {
  const w=100,h=80,src=new Uint8ClampedArray(w*h*4);
  for(let i=0;i<w*h;i++) src.set([180,150,130,255],i*4);
  const brow={start:{x:20,y:44},arch:{x:40,y:40},tail:{x:60,y:44},contour:[{x:20,y:40},{x:60,y:40},{x:60,y:48},{x:20,y:48}]};
  const p={left:brow,right:brow,eyeDistance:50,angle:0};
  for(let x=30;x<50;x++) src.set([50,40,30,255],(44*w+x)*4);
  const snapshot=src.slice();
  const run=strength=>lightenBrowPixels(src,w,h,p,{...LIGHTENING_DEFAULTS,strength});
  const half=run(.5),full=run(1),i=(44*w+40)*4;
  assert.deepEqual(run(0),src); assert.deepEqual(src,snapshot);
  assert.ok(full[i]>half[i]&&half[i]>src[i]); assert.ok(full[i]<=src[i]+150);
  assert.ok(full[i]>src[i]+48,'maximum is stronger than the old cap');
  assert.equal(full[i]-full[i+1],src[i]-src[i+1]);
  for(let j=0;j<w*h;j++) {assert.equal(full[j*4+3],255);if(src[j*4]===180) assert.deepEqual(full.slice(j*4,j*4+4),src.slice(j*4,j*4+4));}
});
const { removeBrowPixels, removalMask, REMOVAL_DEFAULTS } = load('lib/browRemoval.ts');
test('removal preserves original, alpha and unmasked skin; zero restores exactly', () => {
  const w=100,h=80,src=new Uint8ClampedArray(w*h*4).fill(255);
  for(let y=0;y<h;y++) for(let x=0;x<w;x++) for(let c=0;c<3;c++) src[(y*w+x)*4+c]=y>=40&&y<=48?40:150+c*10;
  const brow={start:{x:20,y:44},arch:{x:40,y:40},tail:{x:60,y:44},contour:[{x:20,y:40},{x:60,y:40},{x:60,y:48},{x:20,y:48}]};
  const p={left:brow,right:brow,eyeDistance:50,angle:0};
  const opts={...REMOVAL_DEFAULTS,mode:'all'};
  const copy=src.slice(),out=removeBrowPixels(src,w,h,p,opts),mask=removalMask(w,h,p,opts);
  assert.deepEqual(src,copy);
  assert.deepEqual(removeBrowPixels(src,w,h,p,{...opts,strength:0}),src);
  assert.ok(out[(44*w+40)*4]>src[(44*w+40)*4]);
  for(let i=0;i<w*h;i++) { assert.equal(out[i*4+3],255); if(!mask[i]) assert.deepEqual(out.slice(i*4,i*4+4),src.slice(i*4,i*4+4)); }
  const tail=removeBrowPixels(src,w,h,p,{...opts,mode:'tail'});
  assert.equal(tail[(44*w+24)*4],src[(44*w+24)*4]);
  assert.ok(tail[(44*w+50)*4]>src[(44*w+50)*4]);
});
test('clarity spans visible face-relative softness and density adds 20 percent strand width', () => {
  const soft = browTextureEffects(300,0,1,1);
  const sharp = browTextureEffects(300,1,1,1);
  assert.equal(sharp.blur,0);
  assert.ok(soft.blur >= 3);
  assert.ok(Math.abs(sharp.radius / browTextureEffects(300,1,1,0).radius - 1.2)<1e-8);
  assert.ok(browTextureEffects(300,1,0,1).radius>0);
  const half = browTextureEffects(150,0,1,1);
  assert.equal(half.blur,soft.blur/2);
  assert.equal(half.radius,soft.radius/2);
});
test('virtual 70 percent matches former maximum, 100 deepens only hair pixels', () => {
  const source = new Uint8ClampedArray([180,160,140,255,180,160,140,255]);
  const mask = new Uint8ClampedArray(8);
  const texture = new Uint8ClampedArray([0,0,0,100,0,0,0,0]);
  const color = {r:50,g:35,b:25};
  const render = amount => enhanceNaturalPixels(source, mask, texture, 2, 1, 180, amount, color, 1, true, true);
  const seventy = render(.7), full = render(1);
  const fill = 1-Math.pow(1-100/255,2.4);
  [50,35,25].forEach((tint,c) => {
    const old = new Uint8ClampedArray([source[c]*(1-fill*(1-(.18+tint/255*.6)))])[0];
    assert.equal(seventy[c],old);
    assert.ok(full[c]<seventy[c]);
  });
  assert.deepEqual(full.slice(4),source.slice(4));
  assert.deepEqual(render(0),source);
});
const { mapBrowGuides } = load('lib/browMapping.ts');
const { mirrorBrowTransform } = load('lib/virtualBrowTransform.ts');
test('opposite-side copy mirrors rotation, preserves local outward offset, and does not mutate', () => {
  const transform = { offsetX: .4, offsetY: -.2, scaleX: 1.4, scaleY: 1.2, rotation: .6, darkness: .1, clarity: .8 };
  const copy = mirrorBrowTransform(transform);
  assert.deepEqual(copy, { ...transform, rotation: -.6 });
  assert.deepEqual(mirrorBrowTransform(copy), transform);
  assert.notEqual(copy, transform);
});
test('mapping rays follow iris and outer eye and rotate with the face', () => {
  const placement = { angle: 0, eyeDistance: 60,
    left: { start:{x:40,y:20},arch:{x:25,y:15},tail:{x:10,y:20} },
    right: { start:{x:60,y:20},arch:{x:75,y:15},tail:{x:90,y:20} },
    guides:{faceCenter:{x:50,y:50},noseBridge:{x:50,y:35},noseTip:{x:50,y:80},mouthCenter:{x:50,y:110},
      leftNostril:{x:40,y:85},rightNostril:{x:60,y:85},leftIris:{x:25,y:45},rightIris:{x:75,y:45},leftEyeOuter:{x:10,y:45},rightEyeOuter:{x:90,y:45}} };
  const mapping = mapBrowGuides(placement);
  const side = mapping.sides[0];
  assert.equal(side.start.x,40);
  assert.ok(Math.abs((side.arch.x-50)/(side.arch.y-80) - (25-50)/(45-80))<1e-8);
  assert.ok(Math.abs((side.tail.x-40)/(side.tail.y-85) - (10-40)/(45-85))<1e-8);
  assert.equal(mapping.baselineCenter.y,20);
  const a=.3, turn=p=>({x:p.x*Math.cos(a)-p.y*Math.sin(a),y:p.x*Math.sin(a)+p.y*Math.cos(a)});
  const brow=b=>Object.fromEntries(Object.entries(b).map(([k,p])=>[k,turn(p)]));
  const tilted=mapBrowGuides({...placement,angle:a,left:brow(placement.left),right:brow(placement.right),guides:brow(placement.guides)});
  const expected=turn(side.arch);
  assert.ok(Math.hypot(tilted.sides[0].arch.x-expected.x,tilted.sides[0].arch.y-expected.y)<1e-8);
  assert.equal(mapBrowGuides({...placement,guides:undefined}),null);
});
test('virtual body thickness uses a useful floor for missing brows and a wide range', () => {
  assert.equal(virtualBrowThickness(1, 200, 0), 18);
  assert.ok(virtualBrowThickness(1, 200, 1) > 34);
  assert.ok(virtualBrowThickness(1, 200, -1) < 2);
});
test('virtual hairs remain visible over shadowed skin without drawing outside texture', () => {
  const source = pixels(81, 120);
  const result = enhanceNaturalPixels(source, pixels(81, 0), pixels(81, 0, 100), 9, 9, 180, 1, { r: 30, g: 30, b: 30 }, 2, true, true);
  assert.ok(result[0] < 70);
  assert.deepEqual(enhanceNaturalPixels(source, pixels(81, 0), pixels(81, 0, 0), 9, 9, 180, 1, color, 2, true, true), source);
});
const { getAxis, getUpNormal, mirrorBrowPlacement } = load('lib/browGeometry.ts');
const { browsFromLandmarks } = load('lib/faceLandmarks.ts');
const { warpBrowPixels, browDisplacement } = load('lib/browWarp.ts');
const color = { r: 63, g: 43, b: 36 };
const { transformVirtualBrow } = load('lib/virtualBrowTransform.ts');
test('virtual transforms independently resize rotate and translate without mutating anchors', () => {
  const brow = { start: {x:10,y:20}, arch:{x:30,y:15},tail:{x:50,y:20} };
  const transform = {scaleX:1,scaleY:1,rotation:0,offsetX:0,offsetY:0,darkness:0,clarity:0};
  assert.deepEqual(transformVirtualBrow(brow, transform, 100, 0, 'right'), { ...brow, contour: undefined });
  const wide = transformVirtualBrow(brow, {...transform,scaleX:2}, 100, 0, 'right');
  assert.equal(wide.tail.x-wide.start.x,80);
  const rotated = transformVirtualBrow(brow, {...transform,rotation:1}, 100, 0, 'right');
  assert.ok(rotated.tail.y>rotated.start.y);
  assert.equal(brow.start.x,10);
});
const { BROW_STYLES, DEFAULT_CONTROLS } = load('lib/browStyles.ts');
test('all live styles use new hair assets and reshape is the default', () => {
  assert.equal(DEFAULT_CONTROLS.renderMode, 'original-warp');
  assert.equal(BROW_STYLES.length, 6);
  assert.ok(BROW_STYLES.every(style => /\/(09|10)-/.test(style.imageSrc)));
  assert.equal(BROW_STYLES[0].archBias, 0);
  assert.ok(BROW_STYLES.find(style => style.id === 'soft-arch').archBias > 0);
});
test('virtual brow creation fills bare skin more visibly without whitening', () => {
  const source = pixels(81, 180);
  const normal = enhanceNaturalPixels(source, pixels(81, 0), pixels(81, 0, 180), 9, 9, 180, 1, color, 2, true);
  const virtual = enhanceNaturalPixels(source, pixels(81, 0), pixels(81, 0, 180), 9, 9, 180, 1, color, 2, true, true);
  assert.ok(virtual[0] < normal[0]);
  assert.equal(virtual[3], 255);
});
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
