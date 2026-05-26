import { adjustBrowAnchor, getAxis, getUpNormal } from "@/lib/browGeometry";
import type {
  BrowAnchor,
  BrowBaseMode,
  BrowControls,
  BrowPlacement,
  BrowRenderMode,
  BrowSide,
  BrowStyle,
  Point,
} from "@/types/brow";

type Rgb = {
  r: number;
  g: number;
  b: number;
};

export type BrowRenderPlan = {
  browDensity: number;
  originalRetention: number;
  textureOpacity: number;
  edgeFade: number;
  contrast: number;
};

export type BrowRenderPlans = {
  left: BrowRenderPlan;
  right: BrowRenderPlan;
};

export type BrowTargetMasks = {
  left?: HTMLCanvasElement | null;
  right?: HTMLCanvasElement | null;
};

const DEFAULT_PLAN: BrowRenderPlan = {
  browDensity: 0.35,
  originalRetention: 0.35,
  textureOpacity: 0.6,
  edgeFade: 0.72,
  contrast: 1.08,
};

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function distance(a: Point, b: Point) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function luminance(red: number, green: number, blue: number) {
  return red * 0.299 + green * 0.587 + blue * 0.114;
}

function getFadeBox(anchor: BrowAnchor, eyeDistance: number) {
  const points = [anchor.start, anchor.arch, anchor.tail];
  const paddingX = eyeDistance * 0.28;
  const paddingY = eyeDistance * 0.24;
  const minX = Math.min(...points.map((point) => point.x)) - paddingX;
  const maxX = Math.max(...points.map((point) => point.x)) + paddingX;
  const minY = Math.min(...points.map((point) => point.y)) - paddingY;
  const maxY = Math.max(...points.map((point) => point.y)) + paddingY;

  return { minX, minY, maxX, maxY };
}

function maskWeight(
  x: number,
  y: number,
  anchor: BrowAnchor,
  angle: number,
  eyeDistance: number,
  scale = 1,
) {
  const axis = getAxis(angle);
  const up = getUpNormal(angle);
  const center = {
    x: (anchor.start.x + anchor.arch.x + anchor.tail.x) / 3,
    y: (anchor.start.y + anchor.arch.y + anchor.tail.y) / 3,
  };
  const dx = x - center.x;
  const dy = y - center.y;
  const localX = dx * axis.x + dy * axis.y;
  const localY = dx * up.x + dy * up.y;
  const radiusX = Math.max(distance(anchor.start, anchor.tail) * 0.72 * scale, eyeDistance * 0.16);
  const radiusY = eyeDistance * 0.135 * scale;
  const normalized = Math.sqrt(
    (localX * localX) / (radiusX * radiusX) + (localY * localY) / (radiusY * radiusY),
  );

  return clamp((1 - normalized) / 0.28, 0, 1);
}

function sampleSkinTone(
  ctx: CanvasRenderingContext2D,
  anchor: BrowAnchor,
  angle: number,
  eyeDistance: number,
): Rgb {
  const axis = getAxis(angle);
  const up = getUpNormal(angle);
  const center = {
    x: (anchor.start.x + anchor.arch.x + anchor.tail.x) / 3,
    y: (anchor.start.y + anchor.arch.y + anchor.tail.y) / 3,
  };
  const samples: Rgb[] = [];
  const offsets = [
    { along: -0.22, lift: -0.25 },
    { along: 0, lift: -0.28 },
    { along: 0.22, lift: -0.25 },
    { along: -0.28, lift: 0.24 },
    { along: 0.28, lift: 0.24 },
  ];

  for (const offset of offsets) {
    const x = Math.round(center.x + axis.x * eyeDistance * offset.along + up.x * eyeDistance * offset.lift);
    const y = Math.round(center.y + axis.y * eyeDistance * offset.along + up.y * eyeDistance * offset.lift);

    if (x < 0 || y < 0 || x >= ctx.canvas.width || y >= ctx.canvas.height) {
      continue;
    }

    const pixel = ctx.getImageData(x, y, 1, 1).data;
    samples.push({ r: pixel[0], g: pixel[1], b: pixel[2] });
  }

  if (samples.length === 0) {
    return { r: 214, g: 185, b: 163 };
  }

  samples.sort((a, b) => luminance(a.r, a.g, a.b) - luminance(b.r, b.g, b.b));
  return samples[Math.floor(samples.length / 2)];
}

function planFromDensity(
  browDensity: number,
  mode: BrowRenderMode,
  baseMode: BrowBaseMode,
): BrowRenderPlan {
  const resolvedMode =
    mode === "auto"
      ? browDensity > 0.65
        ? "reshape"
        : browDensity > 0.3
          ? "auto"
          : "simulation"
      : mode;

  let originalRetention =
    browDensity > 0.65 ? 0.6 : browDensity > 0.3 ? 0.35 : 0.1;
  let textureOpacity =
    browDensity > 0.65 ? 0.45 : browDensity > 0.3 ? 0.72 : 0.92;
  let edgeFade = browDensity > 0.65 ? 0.82 : browDensity > 0.3 ? 0.74 : 0.64;
  let contrast = browDensity > 0.65 ? 1.04 : browDensity > 0.3 ? 1.16 : 1.26;

  if (resolvedMode === "reshape") {
    originalRetention = Math.max(originalRetention, 0.58);
    textureOpacity = Math.min(textureOpacity, 0.56);
    edgeFade = Math.max(edgeFade, 0.82);
    contrast = Math.min(contrast, 1.1);
  }

  if (resolvedMode === "simulation") {
    originalRetention = Math.min(originalRetention, 0.22);
    textureOpacity = Math.max(textureOpacity, 0.78);
    edgeFade = Math.min(edgeFade, 0.68);
    contrast = Math.max(contrast, 1.16);
  }

  if (baseMode === "keep") {
    originalRetention = Math.max(originalRetention, 0.82);
  } else if (baseMode === "strong") {
    originalRetention = Math.max(0.08, originalRetention - 0.14);
    textureOpacity = Math.min(0.92, textureOpacity + 0.06);
  }

  return {
    browDensity,
    originalRetention,
    textureOpacity,
    edgeFade,
    contrast,
  };
}

function analyzeBrowDensity(
  ctx: CanvasRenderingContext2D,
  anchor: BrowAnchor,
  angle: number,
  eyeDistance: number,
  skin: Rgb,
) {
  const { minX, minY, maxX, maxY } = getFadeBox(anchor, eyeDistance);
  const x = Math.max(0, Math.floor(minX));
  const y = Math.max(0, Math.floor(minY));
  const width = Math.min(ctx.canvas.width - x, Math.ceil(maxX - minX));
  const height = Math.min(ctx.canvas.height - y, Math.ceil(maxY - minY));

  if (width <= 0 || height <= 0) {
    return 0;
  }

  const imageData = ctx.getImageData(x, y, width, height);
  const data = imageData.data;
  const skinLum = luminance(skin.r, skin.g, skin.b);
  let weightedDark = 0;
  let weightTotal = 0;

  for (let row = 0; row < height; row += 1) {
    for (let col = 0; col < width; col += 1) {
      const px = x + col;
      const py = y + row;
      const weight = maskWeight(px, py, anchor, angle, eyeDistance, 1.12);

      if (weight <= 0) {
        continue;
      }

      const offset = (row * width + col) * 4;
      const lum = luminance(data[offset], data[offset + 1], data[offset + 2]);
      const darkScore = clamp((skinLum - lum - 12) / 92, 0, 1);

      weightedDark += darkScore * weight;
      weightTotal += weight;
    }
  }

  return weightTotal > 0 ? clamp(weightedDark / weightTotal, 0, 1) : 0;
}

function softenAnchorPixels(
  ctx: CanvasRenderingContext2D,
  anchor: BrowAnchor,
  angle: number,
  eyeDistance: number,
  skin: Rgb,
  plan: BrowRenderPlan,
  targetMask?: HTMLCanvasElement | null,
) {
  const strength = clamp(1 - plan.originalRetention, 0, 1);

  if (strength <= 0.02) {
    return;
  }

  const { minX, minY, maxX, maxY } = getFadeBox(anchor, eyeDistance);
  const x = Math.max(0, Math.floor(minX));
  const y = Math.max(0, Math.floor(minY));
  const width = Math.min(ctx.canvas.width - x, Math.ceil(maxX - minX));
  const height = Math.min(ctx.canvas.height - y, Math.ceil(maxY - minY));

  if (width <= 0 || height <= 0) {
    return;
  }

  const imageData = ctx.getImageData(x, y, width, height);
  const data = imageData.data;
  const targetCtx = targetMask?.getContext("2d");
  const targetData = targetCtx?.getImageData(x, y, width, height).data;

  for (let row = 0; row < height; row += 1) {
    for (let col = 0; col < width; col += 1) {
      const px = x + col;
      const py = y + row;
      const outer = maskWeight(px, py, anchor, angle, eyeDistance, 1.18);

      if (outer <= 0) {
        continue;
      }

      const offset = (row * width + col) * 4;
      const targetAlpha = targetData
        ? targetData[offset + 3] / 255
        : maskWeight(px, py, anchor, angle, eyeDistance, 0.86);
      const red = data[offset];
      const green = data[offset + 1];
      const blue = data[offset + 2];
      const lum = luminance(red, green, blue);
      const chromaR = red - lum;
      const chromaG = green - lum;
      const chromaB = blue - lum;
      const darkPixelWeight = clamp((188 - lum) / 105, 0.12, 1);
      const outsideTarget = 1 - targetAlpha;
      const insideTargetRetention = 0.18 + targetAlpha * plan.originalRetention * 0.54;
      const outsideTargetBoost = outsideTarget * (0.72 + strength * 0.52);
      const blend = clamp(
        outer * darkPixelWeight * (strength * insideTargetRetention + outsideTargetBoost),
        0,
        0.86,
      );
      const desaturated = {
        r: lum + chromaR * 0.48,
        g: lum + chromaG * 0.48,
        b: lum + chromaB * 0.48,
      };
      const softened = {
        r: desaturated.r * 0.78 + skin.r * 0.22,
        g: desaturated.g * 0.78 + skin.g * 0.22,
        b: desaturated.b * 0.78 + skin.b * 0.22,
      };

      data[offset] = clamp(red * (1 - blend) + softened.r * blend, 0, 255);
      data[offset + 1] = clamp(green * (1 - blend) + softened.g * blend, 0, 255);
      data[offset + 2] = clamp(blue * (1 - blend) + softened.b * blend, 0, 255);
    }
  }

  ctx.putImageData(imageData, x, y);
}

export function eyebrowFadeLayer(
  ctx: CanvasRenderingContext2D,
  placement: BrowPlacement,
  controls: BrowControls,
  style: BrowStyle,
  targetMasks?: BrowTargetMasks,
): BrowRenderPlans {
  const processOne = (base: BrowAnchor, side: BrowSide) => {
    const anchor = adjustBrowAnchor(
      base,
      side,
      placement.angle,
      placement.eyeDistance,
      controls,
      style,
    );
    const skin = sampleSkinTone(ctx, anchor, placement.angle, placement.eyeDistance);
    const density = analyzeBrowDensity(ctx, anchor, placement.angle, placement.eyeDistance, skin);
    const plan = planFromDensity(density, controls.renderMode, controls.baseMode);

    softenAnchorPixels(
      ctx,
      anchor,
      placement.angle,
      placement.eyeDistance,
      skin,
      plan,
      side === "left" ? targetMasks?.left : targetMasks?.right,
    );

    return plan;
  };

  return {
    left: processOne(placement.left, "left"),
    right: processOne(placement.right, "right"),
  };
}

export function getDefaultBrowRenderPlans(): BrowRenderPlans {
  return {
    left: DEFAULT_PLAN,
    right: DEFAULT_PLAN,
  };
}
