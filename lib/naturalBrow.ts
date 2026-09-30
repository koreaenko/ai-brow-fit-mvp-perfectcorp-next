import type { BrowAnchor, BrowControls, Point } from "@/types/brow";
import { getBrowColor } from "@/lib/browColors";

const clamp = (n: number, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, n));
const lum = (r: number, g: number, b: number) => r * 0.299 + g * 0.587 + b * 0.114;

// Linear-time neighborhood means keep the cost proportional to the eyebrow ROI.
export function boxMean(values: Float32Array, width: number, height: number, radius: number) {
  const stride = width + 1;
  const integral = new Float64Array(stride * (height + 1));
  for (let y = 0; y < height; y++) {
    let sum = 0;
    for (let x = 0; x < width; x++) {
      sum += values[y * width + x];
      integral[(y + 1) * stride + x + 1] = integral[y * stride + x + 1] + sum;
    }
  }
  const result = new Float32Array(values.length);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const x0 = Math.max(0, x - radius), x1 = Math.min(width, x + radius + 1);
    const y0 = Math.max(0, y - radius), y1 = Math.min(height, y + radius + 1);
    result[y * width + x] = (integral[y1 * stride + x1] - integral[y0 * stride + x1]
      - integral[y1 * stride + x0] + integral[y0 * stride + x0]) / ((x1 - x0) * (y1 - y0));
  }
  return result;
}

export function enhanceNaturalPixels(
  source: Uint8ClampedArray, mask: Uint8ClampedArray, texture: Uint8ClampedArray,
  width: number, height: number, skinLum: number, intensity: number,
  color: { r: number; g: number; b: number }, radius: number,
  fillOnly = false,
) {
  const output = new Uint8ClampedArray(source);
  const darkness = new Float32Array(width * height);
  const gray = new Float32Array(width * height);
  for (let i = 0; i < gray.length; i++) {
    gray[i] = lum(source[i * 4], source[i * 4 + 1], source[i * 4 + 2]);
    darkness[i] = clamp((skinLum - gray[i] - 5) / Math.max(30, skinLum * 0.5));
  }
  const coverage = boxMean(darkness, width, height, radius);
  const localLight = boxMean(gray, width, height, Math.max(1, Math.round(radius / 3)));
  const amount = clamp(intensity);
  for (let i = 0; i < gray.length; i++) {
    const p = i * 4;
    const originalMask = mask[p + 3] / 255;
    // Require local strand contrast as well as skin-relative darkness, not skin tone alone.
    const strand = darkness[i] * clamp((localLight[i] - gray[i] - 1) / 14);
    const deepen = fillOnly ? 0 : originalMask * strand * amount * 0.24;
    const missing = Math.pow(1 - clamp(coverage[i] * 2.4), 2);
    const alpha = texture[p + 3] / 255;
    const fill = alpha * missing * amount * 0.48 * (fillOnly ? 1 - darkness[i] : 1);
    for (let c = 0; c < 3; c++) {
      const original = source[p + c];
      const tint = c === 0 ? color.r : c === 1 ? color.g : color.b;
      // Multiplicative attenuation retains the photo's lighting and fine texture.
      const shaded = original * (1 - deepen);
      const pigment = 0.42 + tint / 255 * 0.4;
      output[p + c] = shaded * (1 - fill * (1 - pigment));
    }
  }
  return output;
}

type TemplateProfile = { left: number; right: number; centers: number[]; height: number };
const profiles = new WeakMap<HTMLImageElement, TemplateProfile>();
function profileFor(image: HTMLImageElement): TemplateProfile | null {
  const cached = profiles.get(image);
  if (cached) return cached;
  const canvas = document.createElement("canvas");
  canvas.width = image.naturalWidth; canvas.height = image.naturalHeight;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx || !canvas.width || !canvas.height) return null;
  ctx.drawImage(image, 0, 0);
  const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
  const centers: number[] = [];
  let left = canvas.width, right = 0, top = canvas.height, bottom = 0;
  for (let x = 0; x < canvas.width; x++) {
    let sum = 0, weighted = 0;
    for (let y = 0; y < canvas.height; y++) {
      const alpha = data[(y * canvas.width + x) * 4 + 3] / 255;
      sum += alpha; weighted += y * alpha;
      if (alpha > 0.08) { left = Math.min(left, x); right = Math.max(right, x); top = Math.min(top, y); bottom = Math.max(bottom, y); }
    }
    centers[x] = sum > 0 ? weighted / sum : canvas.height / 2;
  }
  if (right <= left) return null;
  const profile = { left, right, centers, height: Math.max(1, bottom - top) };
  profiles.set(image, profile);
  return profile;
}

export function drawNaturalBrow(
  ctx: CanvasRenderingContext2D, original: BrowAnchor, target: BrowAnchor,
  template: HTMLImageElement | null | undefined, eyeDistance: number, controls: BrowControls,
  fillOnly = false,
) {
  if (controls.intensity <= 0 || !original.contour?.length) return;
  const points = [...original.contour, target.start, target.arch, target.tail];
  const padding = eyeDistance * 0.13;
  const x = Math.max(0, Math.floor(Math.min(...points.map(p => p.x)) - padding));
  const y = Math.max(0, Math.floor(Math.min(...points.map(p => p.y)) - padding));
  const width = Math.min(ctx.canvas.width, Math.ceil(Math.max(...points.map(p => p.x)) + padding)) - x;
  const height = Math.min(ctx.canvas.height, Math.ceil(Math.max(...points.map(p => p.y)) + padding)) - y;
  if (width <= 0 || height <= 0) return;
  const source = ctx.getImageData(x, y, width, height);
  const maskCanvas = document.createElement("canvas");
  maskCanvas.width = width; maskCanvas.height = height;
  const mask = maskCanvas.getContext("2d", { willReadFrequently: true });
  const textureCanvas = document.createElement("canvas");
  textureCanvas.width = width; textureCanvas.height = height;
  const texture = textureCanvas.getContext("2d", { willReadFrequently: true });
  if (!mask || !texture) return;
  mask.filter = `blur(${Math.max(0.6, eyeDistance * 0.007)}px)`;
  mask.fillStyle = "white";
  mask.beginPath();
  original.contour.forEach((p, i) => i ? mask.lineTo(p.x - x, p.y - y) : mask.moveTo(p.x - x, p.y - y));
  mask.closePath(); mask.fill();
  const maskData = mask.getImageData(0, 0, width, height).data;
  const skinSamples: number[] = [];
  for (let i = 0; i < width * height; i++) {
    if (maskData[i * 4 + 3] < 8) skinSamples.push(lum(source.data[i * 4], source.data[i * 4 + 1], source.data[i * 4 + 2]));
  }
  skinSamples.sort((a, b) => a - b);
  const skinLum = skinSamples[Math.floor(skinSamples.length * 0.6)] ?? 160;
  const profile = template ? profileFor(template) : null;
  if (template && profile) {
    const dx = target.tail.x - target.start.x, dy = target.tail.y - target.start.y;
    const length = Math.max(1, Math.hypot(dx, dy));
    const direction = dx < 0 ? -1 : 1;
    const angle = Math.atan2(dy * direction, dx * direction);
    const normal: Point = { x: -Math.sin(angle), y: Math.cos(angle) };
    const midpoint = { x: (target.start.x + target.tail.x) / 2, y: (target.start.y + target.tail.y) / 2 };
    const lift = (target.arch.x - midpoint.x) * normal.x + (target.arch.y - midpoint.y) * normal.y;
    const contour = original.contour;
    const measuredThickness = contour.slice(0, 5).reduce((sum, p, i) => sum + Math.hypot(p.x - contour[9 - i].x, p.y - contour[9 - i].y), 0) / 5;
    const thickness = clamp(measuredThickness, eyeDistance * 0.04, eyeDistance * 0.15) * (1 + controls.thickness * 0.3);
    const scaleY = thickness / profile.height;
    texture.filter = `blur(${(1 - controls.definition) * 0.65}px)`;
    const count = Math.min(160, Math.max(32, Math.round(length)));
    for (let i = 0; i < count; i++) {
      const t = (i + 0.5) / count;
      const sx = profile.left + (profile.right - profile.left) * i / count;
      const sw = (profile.right - profile.left + 1) / count;
      const centerY = profile.centers[Math.min(template.naturalWidth - 1, Math.round(sx + sw / 2))];
      texture.save();
      texture.translate(target.start.x + dx * t - x + normal.x * 4 * t * (1 - t) * lift,
        target.start.y + dy * t - y + normal.y * 4 * t * (1 - t) * lift);
      texture.rotate(angle); texture.scale(direction, 1);
      texture.drawImage(template, sx, 0, sw, template.naturalHeight, -length / count / 2,
        -centerY * scaleY, length / count + 0.2, template.naturalHeight * scaleY);
      texture.restore();
    }
  }
  const textureData = texture.getImageData(0, 0, width, height).data;
  source.data.set(enhanceNaturalPixels(source.data, maskData, textureData, width, height,
    skinLum, controls.intensity, getBrowColor(controls.color).rgb, Math.max(2, Math.round(eyeDistance * 0.022)), fillOnly));
  ctx.putImageData(source, x, y);
}
