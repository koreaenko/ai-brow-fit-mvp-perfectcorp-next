import type { BrowAnchor, BrowPlacement, Point } from "@/types/brow";

export type WarpControls = { arch: number; thickness: number; length: number };
export const NEUTRAL_WARP: WarpControls = { arch: 0, thickness: 0, length: 0 };
const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));
const smooth = (n: number) => { const t = clamp(n, 0, 1); return t * t * (3 - 2 * t); };

// A bounded, continuous local warp of the photograph, NOT hair segmentation/inpainting.
// Surrounding skin moves slightly too; this is deliberately isolated as an experiment.
export function browDisplacement(point: Point, brow: BrowAnchor, eyeDistance: number, controls: WarpControls): Point {
  const dx = brow.tail.x - brow.start.x, dy = brow.tail.y - brow.start.y;
  const length = Math.hypot(dx, dy);
  if (length < 1 || eyeDistance <= 0) return { x: 0, y: 0 };
  const ux = dx / length, uy = dy / length;
  const sign = dx < 0 ? -1 : 1;
  const nx = uy * sign, ny = -ux * sign;
  const px = point.x - brow.start.x, py = point.y - brow.start.y;
  const t = (px * ux + py * uy) / length;
  const v = px * nx + py * ny;
  const arch = (brow.arch.x - brow.start.x) * nx + (brow.arch.y - brow.start.y) * ny;
  const center = 4 * t * (1 - t) * arch;
  const offset = v - center;
  const span = eyeDistance * 0.22;
  const weight = smooth((t + 0.25) / 0.25) * smooth((1.25 - t) / 0.25)
    * smooth((span - Math.abs(offset)) / (span * 0.7));
  const peak = Math.sin(Math.PI * clamp(t, 0, 1));
  const vertical = clamp(controls.arch, -1, 1) * eyeDistance * 0.035 * peak
    + clamp(controls.thickness, -1, 1) * 0.18 * offset;
  const horizontal = clamp(controls.length, -1, 1) * length * 0.07 * (t - 0.2);
  return { x: (ux * horizontal + nx * vertical) * weight, y: (uy * horizontal + ny * vertical) * weight };
}

export function warpBrowPixels(source: Uint8ClampedArray, width: number, height: number,
  placement: BrowPlacement, controls: WarpControls): Uint8ClampedArray {
  const result = new Uint8ClampedArray(source);
  if (!controls.arch && !controls.thickness && !controls.length) return result;
  for (const brow of [placement.left, placement.right]) {
    const points = [brow.start, brow.arch, brow.tail];
    const pad = placement.eyeDistance * 0.4;
    const x0 = Math.max(0, Math.floor(Math.min(...points.map(p => p.x)) - pad));
    const x1 = Math.min(width, Math.ceil(Math.max(...points.map(p => p.x)) + pad));
    const y0 = Math.max(0, Math.floor(Math.min(...points.map(p => p.y)) - pad));
    const y1 = Math.min(height, Math.ceil(Math.max(...points.map(p => p.y)) + pad));
    for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
      const initial = browDisplacement({ x, y }, brow, placement.eyeDistance, controls);
      if (Math.abs(initial.x) + Math.abs(initial.y) < 1e-8) continue;
      // Inverse sampling avoids gaps and never composites a second eyebrow over the first.
      let sx = x, sy = y;
      for (let step = 0; step < 7; step++) {
        const d = browDisplacement({ x: sx, y: sy }, brow, placement.eyeDistance, controls);
        sx = x - d.x; sy = y - d.y;
      }
      sx = clamp(sx, 0, width - 1); sy = clamp(sy, 0, height - 1);
      const ix = Math.floor(sx), iy = Math.floor(sy);
      const jx = Math.min(width - 1, ix + 1), jy = Math.min(height - 1, iy + 1);
      const fx = sx - ix, fy = sy - iy;
      for (let c = 0; c < 4; c++) {
        const top = source[(iy * width + ix) * 4 + c] * (1 - fx) + source[(iy * width + jx) * 4 + c] * fx;
        const bottom = source[(jy * width + ix) * 4 + c] * (1 - fx) + source[(jy * width + jx) * 4 + c] * fx;
        result[(y * width + x) * 4 + c] = top * (1 - fy) + bottom * fy;
      }
    }
  }
  return result;
}
