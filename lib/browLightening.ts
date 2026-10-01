import type { BrowPlacement } from "@/types/brow";
import { removalMask } from "@/lib/browRemoval";

export type LighteningOptions = { mode: "tail" | "all"; strength: number; padding: number };
export const LIGHTENING_DEFAULTS: LighteningOptions = { mode: "all", strength: 0.5, padding: 0.05 };
const cache = new WeakMap<Uint8ClampedArray, { placement: BrowPlacement; width: number; height: number; lift: Float32Array; mask?: Float32Array; key?: string }>();

// Estimate local dark-detail contrast without copying pixels or replacing skin color.
export function lightenBrowPixels(source: Uint8ClampedArray, width: number, height: number, placement: BrowPlacement, options: LighteningOptions) {
  const output = new Uint8ClampedArray(source);
  const strength = Math.max(0, Math.min(1, options.strength));
  if (!strength) return output;
  let prepared = cache.get(source);
  if (!prepared || prepared.placement !== placement || prepared.width !== width || prepared.height !== height) {
  const mask = removalMask(width, height, placement, { mode: "all", padding: .1 });
  const liftMap = new Float32Array(width * height);
  const luminance = (x: number, y: number) => {
    const i = (Math.max(0, Math.min(height - 1, y)) * width + Math.max(0, Math.min(width - 1, x))) * 4;
    return source[i] * .2126 + source[i + 1] * .7152 + source[i + 2] * .0722;
  };
  const radius = Math.max(2, Math.round(placement.eyeDistance * .018));
  const neighbors: number[] = [];
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const index = y * width + x;
    if (!mask[index]) continue;
    neighbors.length = 0;
    for (const distance of [radius, radius * 2, radius * 5, radius * 8]) for (let k = 0; k < 8; k++) {
      const angle = k * Math.PI / 4;
      neighbors.push(luminance(x + Math.round(Math.cos(angle) * distance), y + Math.round(Math.sin(angle) * distance)));
    }
    neighbors.sort((a, b) => a - b);
    const contrast = neighbors[24] - luminance(x, y);
    const t = Math.max(0, Math.min(1, (contrast - 12) / 24));
    const confidence = t * t * (3 - 2 * t);
    liftMap[index] = Math.min(150, Math.max(0, contrast) * .98) * confidence;
  }
  prepared = { placement, width, height, lift: liftMap };
  cache.set(source, prepared);
  }
  const key = `${options.mode}:${options.padding}`;
  if (prepared.key !== key) {
    prepared.mask = removalMask(width, height, placement, options);
    prepared.key = key;
  }
  const mask = prepared.mask!;
  for (let index = 0; index < mask.length; index++) {
    if (!mask[index]) continue;
    const lift = prepared.lift[index] * mask[index] * strength;
    // Equal RGB lift retains existing channel differences and never exceeds the local highlight.
    const boundedLift = Math.min(lift, 255 - Math.max(source[index * 4], source[index * 4 + 1], source[index * 4 + 2]));
    for (let c = 0; c < 3; c++) output[index * 4 + c] = source[index * 4 + c] + boundedLift;
  }
  return output;
}
