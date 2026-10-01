import type { BrowPlacement, Point } from "@/types/brow";

export type RemovalOptions = { mode: "tail" | "all"; strength: number; padding: number; donor: number };
export const REMOVAL_DEFAULTS: RemovalOptions = { mode: "tail", strength: 1, padding: 0.07, donor: 0.26 };
const clamp = (v: number, lo = 0, hi = 1) => Math.max(lo, Math.min(hi, v));
const smooth = (v: number) => { const t = clamp(v); return t * t * (3 - 2 * t); };

function segmentDistance(x: number, y: number, a: Point, b: Point) {
  const dx = b.x - a.x, dy = b.y - a.y;
  const t = clamp(((x - a.x) * dx + (y - a.y) * dy) / Math.max(1, dx * dx + dy * dy));
  return Math.hypot(x - a.x - t * dx, y - a.y - t * dy);
}

export function removalMask(width: number, height: number, placement: BrowPlacement, options: Pick<RemovalOptions, "mode" | "padding">) {
  const mask = new Float32Array(width * height);
  const padding = placement.eyeDistance * clamp(options.padding, 0, 0.1);
  const feather = Math.max(2, placement.eyeDistance * 0.07);
  for (const brow of [placement.left, placement.right]) {
    const polygon = brow.contour;
    if (!polygon || polygon.length < 3) continue;
    const xs = polygon.map(p => p.x), ys = polygon.map(p => p.y);
    const dx = brow.tail.x - brow.start.x, dy = brow.tail.y - brow.start.y;
    const length2 = Math.max(1, dx * dx + dy * dy);
    for (let y = Math.max(0, Math.floor(Math.min(...ys) - padding)); y <= Math.min(height - 1, Math.ceil(Math.max(...ys) + padding)); y++) {
      for (let x = Math.max(0, Math.floor(Math.min(...xs) - padding)); x <= Math.min(width - 1, Math.ceil(Math.max(...xs) + padding)); x++) {
        let inside = false, distance = Infinity;
        for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
          const a = polygon[i], b = polygon[j];
          if ((a.y > y) !== (b.y > y) && x < (b.x - a.x) * (y - a.y) / (b.y - a.y) + a.x) inside = !inside;
          distance = Math.min(distance, segmentDistance(x, y, a, b));
        }
        const t = ((x - brow.start.x) * dx + (y - brow.start.y) * dy) / length2;
        const preserveHead = options.mode === "tail" ? smooth((t - 0.25) / 0.15) : 1;
        const weight = smooth((padding + (inside ? distance : -distance)) / feather) * preserveHead;
        mask[y * width + x] = Math.max(mask[y * width + x], weight);
      }
    }
  }
  return mask;
}

// Clone a nearby skin patch, not a flat color. Pixels outside the feathered mask remain exact.
export function removeBrowPixels(source: Uint8ClampedArray, width: number, height: number, placement: BrowPlacement, options: RemovalOptions) {
  const output = new Uint8ClampedArray(source);
  const mask = removalMask(width, height, placement, options);
  const shift = placement.eyeDistance * clamp(options.donor, 0.14, 0.4);
  const offsetX = Math.sin(placement.angle) * shift;
  const offsetY = -Math.cos(placement.angle) * shift;
  const centerX = (placement.left.start.x + placement.right.start.x) / 2;
  const sample = (x: number, y: number, c: number) => {
    // Pull reference coordinates toward the central forehead to avoid temple hair.
    const sx = clamp(centerX + (x - centerX) * 0.45 + offsetX, 0, width - 1), sy = clamp(y + offsetY, 0, height - 1);
    const ix = Math.floor(sx), iy = Math.floor(sy), fx = sx - ix, fy = sy - iy;
    const right = Math.min(width - 1, ix + 1), bottom = Math.min(height - 1, iy + 1);
    return (source[(iy * width + ix) * 4 + c] * (1 - fx) + source[(iy * width + right) * 4 + c] * fx) * (1 - fy)
      + (source[(bottom * width + ix) * 4 + c] * (1 - fx) + source[(bottom * width + right) * 4 + c] * fx) * fy;
  };
  // Diffuse boundary color differences into each brow patch while retaining donor pores.
  const corrections = new Float32Array(width * height * 3);
  const active: number[] = [];
  for (let i = 0; i < mask.length; i++) if (mask[i] > 0) {
    const x = i % width, y = Math.floor(i / width);
    if (x < 1 || y < 1 || x >= width - 1 || y >= height - 1) continue;
    active.push(i);
    for (const j of [i - 1, i + 1, i - width, i + width]) if (!mask[j]) {
      for (let c = 0; c < 3; c++) corrections[j * 3 + c] = source[j * 4 + c] - sample(j % width, Math.floor(j / width), c);
    }
  }
  for (let iteration = 0; iteration < 100; iteration++) for (const i of active) {
    for (let c = 0; c < 3; c++) corrections[i * 3 + c] = (corrections[(i - 1) * 3 + c] + corrections[(i + 1) * 3 + c] + corrections[(i - width) * 3 + c] + corrections[(i + width) * 3 + c]) / 4;
  }
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const index = y * width + x;
    const weight = mask[index] * clamp(options.strength);
    if (!weight) continue;
    const sx = x + offsetX, sy = y + offsetY;
    // Do not repeat border pixels when a close crop leaves no source skin.
    if (sx < 0 || sy < 0 || sx >= width - 1 || sy >= height - 1) continue;
    for (let c = 0; c < 3; c++) {
      output[index * 4 + c] = source[index * 4 + c] * (1 - weight) + clamp(sample(x, y, c) + corrections[index * 3 + c], 0, 255) * weight;
    }
  }
  return output;
}
