"use client";

import BrowZoomControls from "@/components/BrowZoomControls";
import {
  adjustBrowAnchor,
  createFallbackPlacement,
  getAxis,
  getUpNormal,
} from "@/lib/browGeometry";
import { getBrowColor } from "@/lib/browColors";
import { downloadCanvasAsPng } from "@/lib/exportImage";
import { eyebrowFadeLayer, type BrowRenderPlan } from "@/lib/eyebrowFade";
import type {
  BrowAnchor,
  BrowControls,
  BrowDesignMode,
  BrowPlacement,
  BrowSide,
  BrowStyle,
  CustomBrowSideTransform,
  CustomBrowTransform,
  Point,
  SelectedBrowSide,
} from "@/types/brow";
import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";
import type {
  MouseEvent as ReactMouseEvent,
  PointerEvent as ReactPointerEvent,
  WheelEvent as ReactWheelEvent,
} from "react";

export type BrowCanvasHandle = {
  saveResult: () => string | null;
  getResultDataUrl: () => string | null;
  zoomIn: () => void;
  zoomOut: () => void;
  resetZoom: () => void;
  focusBrows: () => void;
};

type BrowCanvasProps = {
  imageSrc: string;
  placement?: BrowPlacement;
  controls: BrowControls;
  style: BrowStyle;
  compareMode: boolean;
  fadedOnly: boolean;
  showGuides: boolean;
  designMode: BrowDesignMode;
  customBrowSrc: string | null;
  customTransform: CustomBrowTransform;
  selectedCustomSide: SelectedBrowSide;
  onCustomSideSelect: (side: SelectedBrowSide) => void;
  onCustomTransformChange: (side: BrowSide, transform: CustomBrowSideTransform) => void;
};

type Viewport = {
  scale: number;
  x: number;
  y: number;
};

type PixelBounds = {
  x: number;
  y: number;
  width: number;
  height: number;
};

type BrowTextureLayer = {
  canvas: HTMLCanvasElement;
  bounds: PixelBounds;
  customOptions?: CustomBrowRenderOptions;
};

type CustomBrowRenderOptions = {
  offsetX: number;
  offsetY: number;
  scaleX: number;
  scaleY: number;
  rotation: number;
  darkness: number;
  clarity: number;
};

type CustomDragKind =
  | "move"
  | "scale-nw"
  | "scale-ne"
  | "scale-sw"
  | "scale-se"
  | "rotate";

type CustomDragState = {
  kind: CustomDragKind;
  side: BrowSide;
  startPoint: Point;
  startTransform: CustomBrowRenderOptions;
  startBounds: PixelBounds;
  center: Point;
};

const MIN_ZOOM = 0.75;
const MAX_ZOOM = 4.2;
const VERTICAL_NUDGE_RATIO = 0.075;

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = src;
  });
}

function clamp(value: number, min: number, max: number) {
  if (!Number.isFinite(value)) {
    return min;
  }

  return Math.min(max, Math.max(min, value));
}

function luminance(red: number, green: number, blue: number) {
  return red * 0.299 + green * 0.587 + blue * 0.114;
}

function rgbaFromBrowColor(controls: BrowControls, alpha: number) {
  const color = getBrowColor(controls.color).rgb;

  return `rgba(${color.r},${color.g},${color.b},${alpha})`;
}

function midpoint(a: Point, b: Point): Point {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

function normalize(vector: Point, fallback: Point): Point {
  const length = Math.hypot(vector.x, vector.y);

  if (length < 0.001) {
    return fallback;
  }

  return {
    x: vector.x / length,
    y: vector.y / length,
  };
}

function projectPointOnLine(point: Point, linePoint: Point, lineDirection: Point): Point {
  const dx = point.x - linePoint.x;
  const dy = point.y - linePoint.y;
  const amount = dx * lineDirection.x + dy * lineDirection.y;

  return {
    x: linePoint.x + lineDirection.x * amount,
    y: linePoint.y + lineDirection.y * amount,
  };
}

function quadratic(start: Point, control: Point, end: Point, t: number): Point {
  const one = 1 - t;
  return {
    x: one * one * start.x + 2 * one * t * control.x + t * t * end.x,
    y: one * one * start.y + 2 * one * t * control.y + t * t * end.y,
  };
}

function buildBrowShape(
  anchor: BrowAnchor,
  angle: number,
  eyeDistance: number,
  controls: BrowControls,
  style: BrowStyle,
) {
  const up = getUpNormal(angle);
  const axis = getAxis(angle);
  const baseThickness = eyeDistance * 0.052;
  const thickness = Math.max(
    eyeDistance * 0.03,
    baseThickness * (1 + controls.thickness * 0.54 + style.thicknessBias),
  );
  const tailLift = style.archBias * eyeDistance * 0.015;
  const startSoft = {
    x: anchor.start.x - axis.x * eyeDistance * 0.018 - up.x * thickness * 0.1,
    y: anchor.start.y - axis.y * eyeDistance * 0.018 - up.y * thickness * 0.1,
  };
  const upperArch = {
    x: anchor.arch.x + up.x * thickness * (1.06 + style.density * 0.08),
    y: anchor.arch.y + up.y * thickness * (1.06 + style.density * 0.08),
  };
  const tailFine = {
    x: anchor.tail.x + axis.x * eyeDistance * 0.015,
    y: anchor.tail.y + axis.y * eyeDistance * 0.015 + tailLift,
  };
  const lowerArch = {
    x: anchor.arch.x - up.x * thickness * (0.58 + style.edgeFade * 0.18),
    y: anchor.arch.y - up.y * thickness * (0.58 + style.edgeFade * 0.18),
  };
  const lowerStart = {
    x: anchor.start.x + up.x * thickness * (0.42 + style.taper * 0.2),
    y: anchor.start.y + up.y * thickness * (0.42 + style.taper * 0.2),
  };

  return { startSoft, upperArch, tailFine, lowerArch, lowerStart, thickness };
}

function traceBrowPath(
  ctx: CanvasRenderingContext2D,
  anchor: BrowAnchor,
  angle: number,
  eyeDistance: number,
  controls: BrowControls,
  style: BrowStyle,
) {
  const shape = buildBrowShape(anchor, angle, eyeDistance, controls, style);
  ctx.beginPath();
  ctx.moveTo(shape.startSoft.x, shape.startSoft.y);
  ctx.quadraticCurveTo(shape.upperArch.x, shape.upperArch.y, shape.tailFine.x, shape.tailFine.y);
  ctx.quadraticCurveTo(shape.lowerArch.x, shape.lowerArch.y, shape.lowerStart.x, shape.lowerStart.y);
  ctx.quadraticCurveTo(
    midpoint(shape.lowerStart, shape.startSoft).x,
    midpoint(shape.lowerStart, shape.startSoft).y,
    shape.startSoft.x,
    shape.startSoft.y,
  );
  ctx.closePath();

  return shape;
}

function drawHairTexture(
  ctx: CanvasRenderingContext2D,
  anchor: BrowAnchor,
  side: BrowSide,
  angle: number,
  eyeDistance: number,
  controls: BrowControls,
  style: BrowStyle,
) {
  const shape = buildBrowShape(anchor, angle, eyeDistance, controls, style);
  const up = getUpNormal(angle);
  const axis = getAxis(angle);
  const outward = side === "left" ? -1 : 1;
  const opacity = 0.12 + controls.intensity * 0.28;
  const count = Math.round(style.strokeCount + controls.definition * 6);

  ctx.save();
  ctx.strokeStyle = getBrowColor(controls.color).hex;
  ctx.globalAlpha = opacity;
  ctx.lineCap = "round";
  ctx.lineWidth = Math.max(0.75, eyeDistance * (style.hairStrokes ? 0.0046 : 0.0034));

  for (let index = 0; index < count; index += 1) {
    const t = (index + 0.5) / count;
    const upper = quadratic(shape.startSoft, shape.upperArch, shape.tailFine, t);
    const lower = quadratic(shape.lowerStart, shape.lowerArch, shape.tailFine, Math.min(1, t + 0.035));
    const root = {
      x: lower.x - up.x * shape.thickness * 0.12,
      y: lower.y - up.y * shape.thickness * 0.12,
    };
    const tip = {
      x: upper.x + axis.x * outward * eyeDistance * 0.012,
      y: upper.y + axis.y * outward * eyeDistance * 0.012,
    };
    const control = {
      x: midpoint(root, tip).x + axis.x * outward * eyeDistance * (style.hairStrokes ? 0.026 : 0.014),
      y: midpoint(root, tip).y + up.y * shape.thickness * 0.12,
    };

    ctx.beginPath();
    ctx.moveTo(root.x, root.y);
    ctx.quadraticCurveTo(control.x, control.y, tip.x, tip.y);
    ctx.stroke();
  }

  ctx.restore();
}

function drawBrowShape(
  ctx: CanvasRenderingContext2D,
  anchor: BrowAnchor,
  side: BrowSide,
  angle: number,
  eyeDistance: number,
  controls: BrowControls,
  style: BrowStyle,
) {
  const opacity = 0.3 + controls.intensity * 0.56;
  const blur = Math.max(0, (1 - controls.definition) * 2.2 + style.softness * 0.45);
  const axis = getAxis(angle);

  ctx.save();
  const shape = traceBrowPath(ctx, anchor, angle, eyeDistance, controls, style);
  ctx.globalAlpha = opacity * 0.48;
  ctx.filter = `blur(${blur + style.edgeFade * 1.35}px)`;
  ctx.fillStyle = getBrowColor(controls.color).hex;
  ctx.fill();

  ctx.restore();
  ctx.save();
  traceBrowPath(ctx, anchor, angle, eyeDistance, controls, style);
  const gradient = ctx.createLinearGradient(
    shape.startSoft.x - axis.x * eyeDistance * 0.08,
    shape.startSoft.y - axis.y * eyeDistance * 0.08,
    shape.tailFine.x + axis.x * eyeDistance * 0.05,
    shape.tailFine.y + axis.y * eyeDistance * 0.05,
  );
  gradient.addColorStop(0, rgbaFromBrowColor(controls, 0.18));
  gradient.addColorStop(0.22, rgbaFromBrowColor(controls, 0.56 + style.density * 0.2));
  gradient.addColorStop(0.62, rgbaFromBrowColor(controls, 0.78 + style.density * 0.14));
  gradient.addColorStop(1, rgbaFromBrowColor(controls, 0.24));
  ctx.globalAlpha = opacity;
  ctx.filter = `blur(${blur}px)`;
  ctx.fillStyle = gradient;
  ctx.fill();
  ctx.restore();

  drawHairTexture(ctx, anchor, side, angle, eyeDistance, controls, style);
}

function createBrowTextureLayer(
  ctx: CanvasRenderingContext2D,
  template: HTMLImageElement,
  anchor: BrowAnchor,
  side: BrowSide,
  angle: number,
  eyeDistance: number,
  controls: BrowControls,
  style: BrowStyle,
  plan?: BrowRenderPlan,
  customOptions?: CustomBrowRenderOptions,
): BrowTextureLayer | null {
  const isCustom = Boolean(customOptions);
  const sideDirection = side === "left" ? -1 : 1;
  const anchorWidth = Math.hypot(anchor.tail.x - anchor.start.x, anchor.tail.y - anchor.start.y);
  const width =
    Math.max(eyeDistance * 0.46, anchorWidth * (1.38 + controls.length * 0.22)) *
    (customOptions?.scaleX ?? 1);
  const aspect = template.naturalWidth / Math.max(template.naturalHeight, 1);
  const baseHeight = width / Math.max(aspect, 1);
  const height = Math.max(
    eyeDistance * 0.112,
    baseHeight * (1.12 + controls.thickness * 0.36 + style.thicknessBias * 0.42),
  ) * (customOptions?.scaleY ?? 1);
  const edgeFade = plan?.edgeFade ?? 0.72;
  const customClarity = clamp(customOptions?.clarity ?? 0.25, -1, 1);
  const definitionBlur = isCustom
    ? Math.max(0, (1 - controls.definition) * 0.18 + Math.max(0, -customClarity) * 1.15)
    : Math.max(0, (1 - controls.definition) * 0.9 + style.softness * 0.1 + (1 - edgeFade) * 0.5);
  const tempCanvas = document.createElement("canvas");
  tempCanvas.width = ctx.canvas.width;
  tempCanvas.height = ctx.canvas.height;
  const temp = tempCanvas.getContext("2d");

  if (!temp) {
    return null;
  }

  const axis = getAxis(angle);
  const up = getUpNormal(angle);
  const offsetX = (customOptions?.offsetX ?? 0) * eyeDistance * 0.16;
  const offsetY = (customOptions?.offsetY ?? 0) * eyeDistance * 0.16;
  const rotation = (customOptions?.rotation ?? 0) * 0.22;

  temp.save();
  temp.translate(
    anchor.start.x + axis.x * sideDirection * offsetX + up.x * offsetY,
    anchor.start.y + axis.y * sideDirection * offsetX + up.y * offsetY,
  );
  temp.rotate(angle + sideDirection * rotation);
  temp.scale(sideDirection, 1);
  temp.globalAlpha = 1;
  const customContrastBoost = isCustom ? 0.22 + Math.max(0, customClarity) * 0.52 : 0;
  temp.filter = `blur(${definitionBlur}px) contrast(${
    (plan?.contrast ?? 1.08) + controls.definition * (isCustom ? 0.36 : 0.16) + customContrastBoost
  }) saturate(${isCustom ? 1.08 : 1})`;
  drawWarpedBrowTemplate(temp, template, width, height, controls, style, eyeDistance);
  temp.restore();

  return {
    canvas: tempCanvas,
    bounds: getBrowPixelBounds(ctx.canvas, anchor, eyeDistance, customOptions),
    customOptions,
  };
}

function constrainViewportToShell(
  viewport: Viewport,
  shell: HTMLDivElement | null,
  canvas: HTMLCanvasElement | null,
  image?: HTMLImageElement | null,
  placement?: BrowPlacement,
): Viewport {
  if (!shell || !canvas) {
    return {
      scale: clamp(viewport.scale, MIN_ZOOM, MAX_ZOOM),
      x: Number.isFinite(viewport.x) ? viewport.x : 0,
      y: Number.isFinite(viewport.y) ? viewport.y : 0,
    };
  }

  const scale = clamp(viewport.scale, MIN_ZOOM, MAX_ZOOM);
  const shellWidth = shell.clientWidth;
  const shellHeight = shell.clientHeight;
  const canvasWidth = canvas.offsetWidth;
  const canvasHeight = canvas.offsetHeight;

  if (!shellWidth || !shellHeight || !canvasWidth || !canvasHeight) {
    return { scale, x: 0, y: 0 };
  }

  const scaledWidth = canvasWidth * scale;
  const scaledHeight = canvasHeight * scale;
  const maxX = Math.max(0, (scaledWidth - shellWidth) / 2);
  const maxY = Math.max(0, (scaledHeight - shellHeight) / 2);
  const lockPoint = placement
    ? placement.guides?.noseBridge ?? midpoint(placement.left.start, placement.right.start)
    : null;
  const imageToCanvasScale = image ? canvasWidth / Math.max(image.naturalWidth, 1) : 1;
  const lockedX = lockPoint
    ? -scale * (lockPoint.x * imageToCanvasScale - canvasWidth / 2)
    : 0;

  return {
    scale,
    x: clamp(lockedX, -maxX, maxX),
    y: clamp(viewport.y, -maxY, maxY),
  };
}

function getCenteredYForPoint(
  point: Point,
  image: HTMLImageElement,
  canvas: HTMLCanvasElement,
  scale: number,
) {
  const imageToCanvasScale = canvas.offsetHeight / Math.max(image.naturalHeight, 1);

  return -scale * (point.y * imageToCanvasScale - canvas.offsetHeight / 2);
}

function drawWarpedBrowTemplate(
  ctx: CanvasRenderingContext2D,
  template: HTMLImageElement,
  width: number,
  height: number,
  controls: BrowControls,
  style: BrowStyle,
  eyeDistance: number,
) {
  const sliceCount = 42;
  const sourceWidth = template.naturalWidth;
  const sourceHeight = template.naturalHeight;
  const arch = clamp(controls.arch + style.archBias * 0.55, -1, 1);
  const archLift = arch * eyeDistance * 0.055;
  const tailLift = arch * eyeDistance * 0.022;
  const baseX = -width * 0.12;
  const baseY = -height * 0.64;

  for (let index = 0; index < sliceCount; index += 1) {
    const t0 = index / sliceCount;
    const t1 = (index + 1) / sliceCount;
    const t = (t0 + t1) / 2;
    const sourceX = sourceWidth * t0;
    const sourceSliceWidth = sourceWidth * (t1 - t0);
    const destX = baseX + width * t0;
    const destSliceWidth = width * (t1 - t0) + 1;
    const archPeak = Math.sin(Math.PI * clamp((t - 0.08) / 0.84, 0, 1));
    const tailBias = Math.max(0, t - 0.58) / 0.42;
    const startBias = Math.max(0, 0.16 - t) / 0.16;
    const yWarp = -archLift * archPeak - tailLift * tailBias + archLift * 0.22 * startBias;

    ctx.drawImage(
      template,
      sourceX,
      0,
      sourceSliceWidth,
      sourceHeight,
      destX,
      baseY + yWarp,
      destSliceWidth,
      height,
    );
  }
}

function drawBrowTemplate(
  ctx: CanvasRenderingContext2D,
  textureLayer: BrowTextureLayer,
  controls: BrowControls,
  plan: BrowRenderPlan,
  isCustom = false,
) {
  const opacity = isCustom
    ? clamp(0.64 + controls.intensity * 0.46 + (textureLayer.customOptions?.darkness ?? 0.35) * 0.08, 0.5, 1)
    : clamp(plan.textureOpacity * (0.82 + controls.intensity * 0.42), 0.22, 0.98);

  blendBrowTexture(
    ctx,
    textureLayer.canvas,
    opacity,
    controls,
    plan,
    textureLayer.bounds,
    isCustom,
    textureLayer.customOptions,
  );
}

function getBrowPixelBounds(
  canvas: HTMLCanvasElement,
  anchor: BrowAnchor,
  eyeDistance: number,
  customOptions?: CustomBrowRenderOptions,
): PixelBounds {
  const points = [anchor.start, anchor.arch, anchor.tail];
  const scalePadding = Math.max(customOptions?.scaleX ?? 1, customOptions?.scaleY ?? 1);
  const paddingX = eyeDistance * 0.3 * scalePadding + Math.abs(customOptions?.offsetX ?? 0) * eyeDistance * 0.18;
  const paddingY = eyeDistance * 0.25 * scalePadding + Math.abs(customOptions?.offsetY ?? 0) * eyeDistance * 0.18;
  const minX = Math.min(...points.map((point) => point.x)) - paddingX;
  const maxX = Math.max(...points.map((point) => point.x)) + paddingX;
  const minY = Math.min(...points.map((point) => point.y)) - paddingY;
  const maxY = Math.max(...points.map((point) => point.y)) + paddingY;
  const x = Math.max(0, Math.floor(minX));
  const y = Math.max(0, Math.floor(minY));
  const width = Math.min(canvas.width - x, Math.ceil(maxX - minX));
  const height = Math.min(canvas.height - y, Math.ceil(maxY - minY));

  return { x, y, width, height };
}

function softLight(base: number, blend: number) {
  const b = base / 255;
  const s = blend / 255;
  const value = s < 0.5 ? b - (1 - 2 * s) * b * (1 - b) : b + (2 * s - 1) * (Math.sqrt(b) - b);

  return clamp(value * 255, 0, 255);
}

function blendBrowTexture(
  ctx: CanvasRenderingContext2D,
  textureCanvas: HTMLCanvasElement,
  opacity: number,
  controls: BrowControls,
  plan: BrowRenderPlan,
  bounds: PixelBounds,
  isCustom = false,
  customOptions?: CustomBrowRenderOptions,
) {
  const textureCtx = textureCanvas.getContext("2d");

  if (!textureCtx || bounds.width <= 0 || bounds.height <= 0) {
    return;
  }

  const base = ctx.getImageData(bounds.x, bounds.y, bounds.width, bounds.height);
  const texture = textureCtx.getImageData(bounds.x, bounds.y, bounds.width, bounds.height);
  const baseData = base.data;
  const textureData = texture.data;
  const customDarkness = clamp(customOptions?.darkness ?? 0.35, -1, 1);
  const customClarity = clamp(customOptions?.clarity ?? 0.25, -1, 1);
  const browColor = getBrowColor(controls.color).rgb;
  const darknessContrast = 1 + Math.max(0, customDarkness) * 0.75 + Math.max(0, customClarity) * 0.24;
  const darkenAmount = Math.max(0, customDarkness) * 64;
  const lightAmount = Math.max(0, -customDarkness) * 34;

  for (let index = 0; index < textureData.length; index += 4) {
    const alpha = (textureData[index + 3] / 255) * opacity;

    if (alpha <= 0.002) {
      continue;
    }

    const baseLum = luminance(baseData[index], baseData[index + 1], baseData[index + 2]);
    const existingBrow = clamp((145 - baseLum) / 95, 0, 1);
    const fillMissingBoost = isCustom
      ? 1 - existingBrow * plan.originalRetention * 0.18
      : 1 - existingBrow * plan.originalRetention * 0.48;
    const edgeAwareAlpha = Math.pow(
      alpha * fillMissingBoost,
      isCustom ? 0.68 : 0.74 + plan.edgeFade * 0.24,
    );

    for (let channel = 0; channel < 3; channel += 1) {
      const dst = baseData[index + channel];
      const rawSrc = textureData[index + channel];
      const rawLum = luminance(textureData[index], textureData[index + 1], textureData[index + 2]);
      const tintStrength = clamp((230 - rawLum) / 190, 0, 1);
      const tintTarget = channel === 0 ? browColor.r : channel === 1 ? browColor.g : browColor.b;
      const tintedRaw = rawSrc * (1 - tintStrength * 0.68) + tintTarget * tintStrength * 0.68;
      const src = isCustom
        ? clamp((tintedRaw - 128) * darknessContrast + 128 - darkenAmount + lightAmount, 0, 255)
        : clamp(tintedRaw, 0, 255);
      const multiply = (dst * src) / 255;
      const soft = softLight(dst, src);
      const direct = src * 0.92 + dst * 0.08;
      const directWeight = isCustom ? 0.48 + Math.max(0, customClarity) * 0.16 : 0;
      const blended = isCustom
        ? direct * directWeight + multiply * (0.36 - Math.max(0, customClarity) * 0.08) + soft * 0.16
        : multiply * 0.64 + soft * 0.36;

      baseData[index + channel] = clamp(dst * (1 - edgeAwareAlpha) + blended * edgeAwareAlpha, 0, 255);
    }
  }

  ctx.putImageData(base, bounds.x, bounds.y);
}

function drawImageBase(ctx: CanvasRenderingContext2D, image: HTMLImageElement) {
  ctx.clearRect(0, 0, image.naturalWidth, image.naturalHeight);
  ctx.drawImage(image, 0, 0, image.naturalWidth, image.naturalHeight);
}

function getAdjustedBrows(
  placement: BrowPlacement,
  controls: BrowControls,
  style: BrowStyle,
) {
  return {
    left: adjustBrowAnchor(placement.left, "left", placement.angle, placement.eyeDistance, controls, style),
    right: adjustBrowAnchor(placement.right, "right", placement.angle, placement.eyeDistance, controls, style),
  };
}

function drawApplied(
  ctx: CanvasRenderingContext2D,
  image: HTMLImageElement,
  placement: BrowPlacement,
  controls: BrowControls,
  style: BrowStyle,
  browTemplate?: HTMLImageElement | null,
  fadedOnly = false,
  customTransform?: CustomBrowTransform,
  selectedCustomSide?: SelectedBrowSide,
  showCustomSelection = false,
) {
  drawImageBase(ctx, image);
  const brows = getAdjustedBrows(placement, controls, style);
  const targetLayers = browTemplate
    ? {
        left: createBrowTextureLayer(
          ctx,
          browTemplate,
          brows.left,
          "left",
          placement.angle,
          placement.eyeDistance,
          controls,
          style,
          undefined,
          customTransform?.left,
        ),
        right: createBrowTextureLayer(
          ctx,
          browTemplate,
          brows.right,
          "right",
          placement.angle,
          placement.eyeDistance,
          controls,
          style,
          undefined,
          customTransform?.right,
        ),
      }
    : { left: null, right: null };
  const plans = eyebrowFadeLayer(ctx, placement, controls, style, {
    left: targetLayers.left?.canvas,
    right: targetLayers.right?.canvas,
  });

  if (fadedOnly) {
    return;
  }

  if (browTemplate) {
    const leftLayer = createBrowTextureLayer(
      ctx,
      browTemplate,
      brows.left,
      "left",
      placement.angle,
      placement.eyeDistance,
      controls,
      style,
      plans.left,
      customTransform?.left,
    );
    const rightLayer = createBrowTextureLayer(
      ctx,
      browTemplate,
      brows.right,
      "right",
      placement.angle,
      placement.eyeDistance,
      controls,
      style,
      plans.right,
      customTransform?.right,
    );

    if (leftLayer) {
      drawBrowTemplate(ctx, leftLayer, controls, plans.left, Boolean(customTransform));
    }

    if (rightLayer) {
      drawBrowTemplate(ctx, rightLayer, controls, plans.right, Boolean(customTransform));
    }

    if (showCustomSelection) {
      const selectedLayer =
        selectedCustomSide === "right" ? rightLayer : selectedCustomSide === "left" ? leftLayer : null;

      if (selectedLayer) {
        drawCustomSelectionBox(ctx, selectedLayer.bounds);
      }
    }
  } else {
    drawBrowShape(ctx, brows.left, "left", placement.angle, placement.eyeDistance, controls, style);
    drawBrowShape(ctx, brows.right, "right", placement.angle, placement.eyeDistance, controls, style);
  }
}

function drawCustomSelectionBox(ctx: CanvasRenderingContext2D, bounds: PixelBounds) {
  if (bounds.width <= 0 || bounds.height <= 0) {
    return;
  }

  ctx.save();
  ctx.strokeStyle = "rgba(255, 217, 132, 0.95)";
  ctx.lineWidth = Math.max(2, ctx.canvas.width * 0.0022);
  ctx.setLineDash([Math.max(8, ctx.canvas.width * 0.01), Math.max(5, ctx.canvas.width * 0.006)]);
  ctx.shadowColor = "rgba(24, 16, 12, 0.45)";
  ctx.shadowBlur = 8;
  ctx.strokeRect(bounds.x, bounds.y, bounds.width, bounds.height);
  ctx.setLineDash([]);
  ctx.fillStyle = "rgba(255, 217, 132, 0.96)";
  const handleSize = Math.max(8, ctx.canvas.width * 0.008);
  const rotatePoint = {
    x: bounds.x + bounds.width / 2,
    y: bounds.y - Math.max(18, ctx.canvas.width * 0.02),
  };
  ctx.beginPath();
  ctx.moveTo(bounds.x + bounds.width / 2, bounds.y);
  ctx.lineTo(rotatePoint.x, rotatePoint.y);
  ctx.stroke();
  [
    [bounds.x, bounds.y],
    [bounds.x + bounds.width, bounds.y],
    [bounds.x, bounds.y + bounds.height],
    [bounds.x + bounds.width, bounds.y + bounds.height],
  ].forEach(([x, y]) => {
    ctx.fillRect(x - handleSize / 2, y - handleSize / 2, handleSize, handleSize);
  });
  ctx.beginPath();
  ctx.arc(rotatePoint.x, rotatePoint.y, handleSize * 0.65, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function pointInBounds(point: Point, bounds: PixelBounds) {
  return (
    point.x >= bounds.x &&
    point.x <= bounds.x + bounds.width &&
    point.y >= bounds.y &&
    point.y <= bounds.y + bounds.height
  );
}

function canvasPointFromClient(
  event: { clientX: number; clientY: number },
  canvas: HTMLCanvasElement,
): Point {
  const rect = canvas.getBoundingClientRect();

  return {
    x: ((event.clientX - rect.left) / Math.max(rect.width, 1)) * canvas.width,
    y: ((event.clientY - rect.top) / Math.max(rect.height, 1)) * canvas.height,
  };
}

function getSelectionHandle(point: Point, bounds: PixelBounds): CustomDragKind | null {
  const handleRadius = Math.max(14, Math.max(bounds.width, bounds.height) * 0.09);
  const rotatePoint = {
    x: bounds.x + bounds.width / 2,
    y: bounds.y - Math.max(18, bounds.width * 0.12),
  };
  const handles: Array<{ kind: CustomDragKind; point: Point }> = [
    { kind: "scale-nw", point: { x: bounds.x, y: bounds.y } },
    { kind: "scale-ne", point: { x: bounds.x + bounds.width, y: bounds.y } },
    { kind: "scale-sw", point: { x: bounds.x, y: bounds.y + bounds.height } },
    { kind: "scale-se", point: { x: bounds.x + bounds.width, y: bounds.y + bounds.height } },
    { kind: "rotate", point: rotatePoint },
  ];

  const hitHandle = handles.find(
    (handle) => Math.hypot(point.x - handle.point.x, point.y - handle.point.y) <= handleRadius,
  );

  if (hitHandle) {
    return hitHandle.kind;
  }

  return pointInBounds(point, bounds) ? "move" : null;
}

function getBoundsCenter(bounds: PixelBounds): Point {
  return {
    x: bounds.x + bounds.width / 2,
    y: bounds.y + bounds.height / 2,
  };
}

function drawComparison(
  ctx: CanvasRenderingContext2D,
  image: HTMLImageElement,
  placement: BrowPlacement,
  controls: BrowControls,
  style: BrowStyle,
  browTemplate: HTMLImageElement | null,
  split: number,
  customTransform?: CustomBrowTransform,
) {
  drawApplied(ctx, image, placement, controls, style, browTemplate, false, customTransform);
  const splitX = image.naturalWidth * split;

  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, splitX, image.naturalHeight);
  ctx.clip();
  drawImageBase(ctx, image);
  ctx.restore();

  ctx.save();
  ctx.strokeStyle = "rgba(255,255,255,0.92)";
  ctx.lineWidth = Math.max(2, image.naturalWidth * 0.004);
  ctx.shadowColor = "rgba(23,19,18,0.36)";
  ctx.shadowBlur = 12;
  ctx.beginPath();
  ctx.moveTo(splitX, 0);
  ctx.lineTo(splitX, image.naturalHeight);
  ctx.stroke();
  ctx.restore();
}

function drawGuideLine(ctx: CanvasRenderingContext2D, from: Point, to: Point, dashed = false) {
  ctx.save();
  ctx.strokeStyle = "rgba(255, 244, 185, 0.9)";
  ctx.lineWidth = Math.max(1.4, ctx.canvas.width * 0.0022);
  ctx.shadowColor = "rgba(24, 16, 12, 0.42)";
  ctx.shadowBlur = Math.max(4, ctx.canvas.width * 0.006);
  if (dashed) {
    ctx.setLineDash([Math.max(8, ctx.canvas.width * 0.012), Math.max(6, ctx.canvas.width * 0.008)]);
  }
  ctx.beginPath();
  ctx.moveTo(from.x, from.y);
  ctx.lineTo(to.x, to.y);
  ctx.stroke();
  ctx.restore();
}

function drawGuidePoint(ctx: CanvasRenderingContext2D, point: Point, label: string, offset: Point) {
  const radius = Math.max(4, ctx.canvas.width * 0.006);
  const fontSize = Math.max(12, ctx.canvas.width * 0.018);

  ctx.save();
  ctx.fillStyle = "rgba(91, 44, 84, 0.95)";
  ctx.strokeStyle = "rgba(255, 244, 185, 0.95)";
  ctx.lineWidth = Math.max(1.5, ctx.canvas.width * 0.002);
  ctx.shadowColor = "rgba(24, 16, 12, 0.35)";
  ctx.shadowBlur = 8;
  ctx.beginPath();
  ctx.arc(point.x, point.y, radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  ctx.font = `700 ${fontSize}px sans-serif`;
  ctx.textBaseline = "middle";
  ctx.fillStyle = "rgba(255, 255, 255, 0.92)";
  ctx.strokeStyle = "rgba(42, 29, 24, 0.72)";
  ctx.lineWidth = Math.max(2, fontSize * 0.18);
  ctx.strokeText(label, point.x + offset.x, point.y + offset.y);
  ctx.fillText(label, point.x + offset.x, point.y + offset.y);
  ctx.restore();
}

function drawConsultationGuides(
  ctx: CanvasRenderingContext2D,
  image: HTMLImageElement,
  placement: BrowPlacement,
  controls: BrowControls,
  style: BrowStyle,
) {
  const brows = getAdjustedBrows(placement, controls, style);
  const guides = placement.guides;
  const axis = getAxis(placement.angle);
  const up = getUpNormal(placement.angle);
  const fallbackCenter = midpoint(brows.left.start, brows.right.start);
  const centerBase = guides?.noseBridge ?? fallbackCenter;
  const lowerFaceCenter = guides?.mouthCenter ?? {
    x: centerBase.x - up.x * placement.eyeDistance * 1.8,
    y: centerBase.y - up.y * placement.eyeDistance * 1.8,
  };
  const noseTip = guides?.noseTip ?? {
    x: centerBase.x + (lowerFaceCenter.x - centerBase.x) * 0.45,
    y: centerBase.y + (lowerFaceCenter.y - centerBase.y) * 0.45,
  };
  const faceDirection = normalize(
    {
      x: lowerFaceCenter.x - centerBase.x,
      y: lowerFaceCenter.y - centerBase.y,
    },
    { x: -up.x, y: -up.y },
  );
  const guideCenter = projectPointOnLine(noseTip, centerBase, faceDirection);
  const centerTop = {
    x: guideCenter.x - faceDirection.x * placement.eyeDistance * 1.25,
    y: guideCenter.y - faceDirection.y * placement.eyeDistance * 1.25,
  };
  const centerBottom = {
    x: guideCenter.x + faceDirection.x * placement.eyeDistance * 2.05,
    y: guideCenter.y + faceDirection.y * placement.eyeDistance * 2.05,
  };
  const leftBase = guides?.leftNostril ?? {
    x: centerBottom.x - placement.eyeDistance * 0.18,
    y: centerBottom.y - placement.eyeDistance * 0.62,
  };
  const rightBase = guides?.rightNostril ?? {
    x: centerBottom.x + placement.eyeDistance * 0.18,
    y: centerBottom.y - placement.eyeDistance * 0.62,
  };
  const guideWidth = placement.eyeDistance * 1.58;
  const horizontalY = (brows.left.arch.y + brows.right.arch.y) / 2;
  const centerOnBrowLine = projectPointOnLine({ x: guideCenter.x, y: horizontalY }, guideCenter, axis);

  ctx.save();
  ctx.globalAlpha = 0.96;

  drawGuideLine(ctx, centerTop, centerBottom, true);
  drawGuideLine(
    ctx,
    {
      x: centerOnBrowLine.x - axis.x * guideWidth,
      y: centerOnBrowLine.y - axis.y * guideWidth,
    },
    {
      x: centerOnBrowLine.x + axis.x * guideWidth,
      y: centerOnBrowLine.y + axis.y * guideWidth,
    },
  );

  [
    { anchor: brows.left, base: leftBase, labelOffset: { x: -placement.eyeDistance * 0.18, y: -placement.eyeDistance * 0.08 } },
    { anchor: brows.right, base: rightBase, labelOffset: { x: placement.eyeDistance * 0.06, y: -placement.eyeDistance * 0.08 } },
  ].forEach(({ anchor, base, labelOffset }) => {
    drawGuideLine(ctx, base, anchor.start);
    drawGuideLine(ctx, base, anchor.arch);
    drawGuideLine(ctx, base, anchor.tail);

    ctx.save();
    ctx.strokeStyle = "rgba(255, 244, 185, 0.78)";
    ctx.lineWidth = Math.max(1.6, ctx.canvas.width * 0.0024);
    ctx.beginPath();
    ctx.moveTo(anchor.start.x, anchor.start.y);
    ctx.quadraticCurveTo(anchor.arch.x, anchor.arch.y, anchor.tail.x, anchor.tail.y);
    ctx.stroke();
    ctx.restore();

    drawGuidePoint(ctx, anchor.start, "시작", labelOffset);
    drawGuidePoint(ctx, anchor.arch, "아치", {
      x: labelOffset.x * 0.75,
      y: -placement.eyeDistance * 0.18,
    });
    drawGuidePoint(ctx, anchor.tail, "끝", {
      x: labelOffset.x * 0.55,
      y: placement.eyeDistance * 0.02,
    });
  });

  drawGuidePoint(ctx, centerTop, "중앙", { x: placement.eyeDistance * 0.06, y: 0 });
  drawGuidePoint(ctx, centerBottom, "기준", { x: placement.eyeDistance * 0.06, y: 0 });
  ctx.restore();
}

function renderToCanvas(
  canvas: HTMLCanvasElement,
  image: HTMLImageElement,
  placement: BrowPlacement,
  controls: BrowControls,
  style: BrowStyle,
  browTemplate: HTMLImageElement | null,
  compareMode: boolean,
  fadedOnly: boolean,
  compareSplit: number,
  showGuides: boolean,
  customTransform?: CustomBrowTransform,
  selectedCustomSide?: SelectedBrowSide,
  showCustomSelection = false,
) {
  canvas.width = image.naturalWidth;
  canvas.height = image.naturalHeight;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });

  if (!ctx) {
    return;
  }

  if (compareMode) {
    drawComparison(ctx, image, placement, controls, style, browTemplate, compareSplit, customTransform);
  } else {
    drawApplied(
      ctx,
      image,
      placement,
      controls,
      style,
      browTemplate,
      fadedOnly,
      customTransform,
      selectedCustomSide,
      showCustomSelection,
    );
  }

  if (showGuides) {
    drawConsultationGuides(ctx, image, placement, controls, style);
  }
}

const BrowCanvas = forwardRef<BrowCanvasHandle, BrowCanvasProps>(function BrowCanvas(
  {
    imageSrc,
    placement,
    controls,
    style,
    compareMode,
    fadedOnly,
    showGuides,
    designMode,
    customBrowSrc,
    customTransform,
    selectedCustomSide,
    onCustomSideSelect,
    onCustomTransformChange,
  },
  ref,
) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const shellRef = useRef<HTMLDivElement>(null);
  const customDragRef = useRef<CustomDragState | null>(null);
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [browTemplate, setBrowTemplate] = useState<HTMLImageElement | null>(null);
  const [viewport, setViewport] = useState<Viewport>({ scale: 1, x: 0, y: 0 });
  const [compareSplit, setCompareSplit] = useState(0.5);
  const activeBrowSrc = designMode === "custom" && customBrowSrc ? customBrowSrc : style.imageSrc;

  useEffect(() => {
    let active = true;
    loadImage(imageSrc).then((loaded) => {
      if (active) {
        setImage(loaded);
      }
    });

    return () => {
      active = false;
    };
  }, [imageSrc]);

  useEffect(() => {
    let active = true;
    setBrowTemplate(null);
    loadImage(activeBrowSrc).then((loaded) => {
      if (active) {
        setBrowTemplate(loaded);
      }
    });

    return () => {
      active = false;
    };
  }, [activeBrowSrc]);

  const activePlacement = useMemo(() => {
    if (!image) {
      return placement;
    }

    return placement ?? createFallbackPlacement(image.naturalWidth, image.naturalHeight);
  }, [image, placement]);

  const applyZoom = useCallback((nextScale: number, center?: Point) => {
    if (!Number.isFinite(nextScale)) {
      return;
    }

    setViewport((current) => {
      const scale = clamp(nextScale, MIN_ZOOM, MAX_ZOOM);

      if (!center) {
        return constrainViewportToShell(
          { ...current, scale },
          shellRef.current,
          canvasRef.current,
          image,
          activePlacement,
        );
      }

      const ratio = scale / current.scale;

      if (!Number.isFinite(ratio)) {
        return constrainViewportToShell(
          { ...current, scale },
          shellRef.current,
          canvasRef.current,
          image,
          activePlacement,
        );
      }

      return constrainViewportToShell({
        scale,
        x: current.x,
        y: center.y - (center.y - current.y) * ratio,
      }, shellRef.current, canvasRef.current, image, activePlacement);
    });
  }, [activePlacement, image]);

  const zoomIn = useCallback(() => applyZoom(viewport.scale * 1.18), [applyZoom, viewport.scale]);
  const zoomOut = useCallback(() => applyZoom(viewport.scale / 1.18), [applyZoom, viewport.scale]);
  const nudgeVertical = useCallback((direction: -1 | 1) => {
    setViewport((current) => {
      const shellHeight = shellRef.current?.clientHeight ?? 0;
      const amount = Math.max(18, shellHeight * VERTICAL_NUDGE_RATIO);

      return constrainViewportToShell(
        {
          ...current,
          y: current.y + direction * amount,
        },
        shellRef.current,
        canvasRef.current,
        image,
        activePlacement,
      );
    });
  }, [activePlacement, image]);
  const moveUp = useCallback(() => nudgeVertical(-1), [nudgeVertical]);
  const moveDown = useCallback(() => nudgeVertical(1), [nudgeVertical]);
  const resetZoom = useCallback(() => {
    setViewport(constrainViewportToShell(
      { scale: 1, x: 0, y: 0 },
      shellRef.current,
      canvasRef.current,
      image,
      activePlacement,
    ));
  }, [activePlacement, image]);
  const focusBrows = useCallback(() => {
    if (!activePlacement || !image || !canvasRef.current) {
      return;
    }

    const center = {
      x:
        (activePlacement.left.arch.x +
          activePlacement.right.arch.x +
          activePlacement.left.tail.x +
          activePlacement.right.tail.x) /
        4,
      y: (activePlacement.left.arch.y + activePlacement.right.arch.y) / 2,
    };
    const scale = clamp(Math.min(3.2, image.naturalWidth / Math.max(activePlacement.eyeDistance * 2.5, 1)), 1.7, 3.2);

    setViewport(constrainViewportToShell({
      scale,
      x: 0,
      y: getCenteredYForPoint(center, image, canvasRef.current, scale),
    }, shellRef.current, canvasRef.current, image, activePlacement));
  }, [activePlacement, image]);

  useEffect(() => {
    const handleResize = () => {
      setViewport((current) =>
        constrainViewportToShell(current, shellRef.current, canvasRef.current, image, activePlacement),
      );
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [activePlacement, image]);

  useEffect(() => {
    if (!image || !activePlacement) {
      return;
    }

    const frame = window.requestAnimationFrame(() => {
      setViewport((current) =>
        constrainViewportToShell(current, shellRef.current, canvasRef.current, image, activePlacement),
      );
    });

    return () => window.cancelAnimationFrame(frame);
  }, [activePlacement, image]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !image || !activePlacement) {
      return;
    }

    const frame = window.requestAnimationFrame(() => {
      renderToCanvas(
        canvas,
        image,
        activePlacement,
        controls,
        style,
        browTemplate,
        compareMode,
        fadedOnly,
        compareSplit,
        showGuides,
        designMode === "custom" ? customTransform : undefined,
        selectedCustomSide,
        designMode === "custom" && selectedCustomSide !== null,
      );
    });

    return () => window.cancelAnimationFrame(frame);
  }, [
    activePlacement,
    browTemplate,
    compareMode,
    compareSplit,
    controls,
    customTransform,
    designMode,
    fadedOnly,
    image,
    selectedCustomSide,
    showGuides,
    style,
  ]);

  useImperativeHandle(ref, () => ({
    saveResult() {
      if (!image || !activePlacement) {
        return null;
      }

      const exportCanvas = document.createElement("canvas");
      renderToCanvas(
        exportCanvas,
        image,
        activePlacement,
        controls,
        style,
        browTemplate,
        false,
        false,
        0.5,
        showGuides,
        designMode === "custom" ? customTransform : undefined,
      );
      downloadCanvasAsPng(exportCanvas, "ai-brow-fit-consulting.png");
      return exportCanvas.toDataURL("image/png");
    },
    getResultDataUrl() {
      if (!image || !activePlacement) {
        return null;
      }

      const exportCanvas = document.createElement("canvas");
      renderToCanvas(
        exportCanvas,
        image,
        activePlacement,
        controls,
        style,
        browTemplate,
        false,
        false,
        0.5,
        showGuides,
        designMode === "custom" ? customTransform : undefined,
      );
      return exportCanvas.toDataURL("image/png");
    },
    zoomIn,
    zoomOut,
    resetZoom,
    focusBrows,
  }));

  const handleWheel = (event: ReactWheelEvent<HTMLDivElement>) => {
    event.preventDefault();
    const rect = event.currentTarget.getBoundingClientRect();
    const center = { x: event.clientX - rect.left, y: event.clientY - rect.top };
    const delta = event.deltaY > 0 ? 0.9 : 1.1;
    applyZoom(viewport.scale * delta, center);
  };

  const getCustomSideBounds = useCallback(
    (side: BrowSide) => {
      if (!canvasRef.current || !activePlacement) {
        return null;
      }

      const brows = getAdjustedBrows(activePlacement, controls, style);

      return getBrowPixelBounds(
        canvasRef.current,
        side === "left" ? brows.left : brows.right,
        activePlacement.eyeDistance,
        customTransform[side],
      );
    },
    [activePlacement, controls, customTransform, style],
  );

  const handleCanvasClick = (event: ReactMouseEvent<HTMLDivElement>) => {
    if (designMode !== "custom" || !canvasRef.current || !image || !activePlacement) {
      return;
    }

    const point = canvasPointFromClient(event, canvasRef.current);
    const leftBounds = getCustomSideBounds("left");
    const rightBounds = getCustomSideBounds("right");

    if (leftBounds && pointInBounds(point, leftBounds)) {
      onCustomSideSelect("left");
      return;
    }

    if (rightBounds && pointInBounds(point, rightBounds)) {
      onCustomSideSelect("right");
    }
  };

  const handleCustomPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (designMode !== "custom" || !canvasRef.current || !activePlacement) {
      return;
    }

    const point = canvasPointFromClient(event, canvasRef.current);
    const orderedSides: BrowSide[] =
      selectedCustomSide === "left" ? ["left", "right"] : ["right", "left"];

    for (const side of orderedSides) {
      const bounds = getCustomSideBounds(side);

      if (!bounds) {
        continue;
      }

      const kind = getSelectionHandle(point, bounds);

      if (kind) {
        event.preventDefault();
        onCustomSideSelect(side);
        customDragRef.current = {
          kind,
          side,
          startPoint: point,
          startTransform: { ...customTransform[side] },
          startBounds: bounds,
          center: getBoundsCenter(bounds),
        };

        try {
          event.currentTarget.setPointerCapture(event.pointerId);
        } catch {
          // If capture is unavailable, pointer move still works while the pointer
          // stays over the editor.
        }
        return;
      }
    }
  };

  const handleCustomPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const drag = customDragRef.current;

    if (!drag || !canvasRef.current || !activePlacement) {
      return;
    }

    event.preventDefault();
    const point = canvasPointFromClient(event, canvasRef.current);
    const delta = {
      x: point.x - drag.startPoint.x,
      y: point.y - drag.startPoint.y,
    };
    const axis = getAxis(activePlacement.angle);
    const up = getUpNormal(activePlacement.angle);
    const sideDirection = drag.side === "left" ? -1 : 1;
    const localX =
      ((delta.x * axis.x + delta.y * axis.y) * sideDirection) /
      Math.max(activePlacement.eyeDistance * 0.16, 1);
    const localY =
      (delta.x * up.x + delta.y * up.y) / Math.max(activePlacement.eyeDistance * 0.16, 1);
    const next = { ...drag.startTransform };

    if (drag.kind === "move") {
      next.offsetX = clamp(drag.startTransform.offsetX + localX, -1.6, 1.6);
      next.offsetY = clamp(drag.startTransform.offsetY + localY, -1.6, 1.6);
    } else if (drag.kind === "rotate") {
      const startAngle = Math.atan2(
        drag.startPoint.y - drag.center.y,
        drag.startPoint.x - drag.center.x,
      );
      const currentAngle = Math.atan2(point.y - drag.center.y, point.x - drag.center.x);
      next.rotation = clamp(drag.startTransform.rotation + (currentAngle - startAngle) / 0.22, -1, 1);
    } else {
      const xSign = drag.kind.endsWith("e") ? 1 : -1;
      const ySign = drag.kind.includes("n") ? -1 : 1;
      const scaleXDelta = (delta.x * xSign) / Math.max(drag.startBounds.width, 1);
      const scaleYDelta = (delta.y * ySign) / Math.max(drag.startBounds.height, 1);

      next.scaleX = clamp(drag.startTransform.scaleX + scaleXDelta, 0.35, 2.2);
      next.scaleY = clamp(drag.startTransform.scaleY + scaleYDelta, 0.35, 2.2);
    }

    onCustomTransformChange(drag.side, next);
  };

  const clearCustomDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!customDragRef.current) {
      return;
    }

    try {
      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }
    } catch {
      // Pointer may already be released by the browser.
    }

    customDragRef.current = null;
  };

  return (
    <div className="relative overflow-hidden rounded-[28px] bg-[#171312] shadow-soft ring-1 ring-cocoa/10">
      <div className="pointer-events-none absolute left-4 top-4 z-10 flex flex-wrap gap-2">
        <span className="rounded-full bg-ink/58 px-3 py-2 text-xs font-semibold text-white/88 backdrop-blur">
          {compareMode ? "Before / After" : fadedOnly ? "눈썹 없는 원본" : "실시간 맞춤"}
        </span>
        {showGuides ? (
          <span className="rounded-full bg-[#f3d48a]/82 px-3 py-2 text-xs font-semibold text-ink backdrop-blur">
            가이드라인 표시
          </span>
        ) : null}
        {activePlacement ? (
          <span className="rounded-full bg-white/14 px-3 py-2 text-xs font-semibold text-white/76 backdrop-blur">
            얼굴 각도 {Math.round((activePlacement.angle * 180) / Math.PI)}도
          </span>
        ) : null}
      </div>

      <div className="pointer-events-auto absolute right-4 top-4 z-20">
        <BrowZoomControls
          zoomLabel={`${Math.round(viewport.scale * 100)}%`}
          onZoomIn={zoomIn}
          onZoomOut={zoomOut}
          onReset={resetZoom}
          onFocusBrows={focusBrows}
          onMoveUp={moveUp}
          onMoveDown={moveDown}
        />
      </div>

      <div
        ref={shellRef}
        onWheel={handleWheel}
        onClick={handleCanvasClick}
        onPointerDown={handleCustomPointerDown}
        onPointerMove={handleCustomPointerMove}
        onPointerUp={clearCustomDrag}
        onPointerCancel={clearCustomDrag}
        className={`relative flex h-[58dvh] min-h-[440px] cursor-default items-center justify-center overflow-hidden bg-[radial-gradient(circle_at_top,#3c2a24,transparent_36%),#171312] lg:h-[calc(100dvh-144px)] ${
          designMode === "custom" ? "touch-none" : "touch-pan-y"
        }`}
      >
        <canvas
          ref={canvasRef}
          className="max-h-full max-w-full select-none object-contain will-change-transform"
          style={{
            transform: `translate3d(${viewport.x}px, ${viewport.y}px, 0) scale(${viewport.scale})`,
            transformOrigin: "center center",
          }}
          aria-label="눈썹 적용 미리보기"
        />
      </div>

      {compareMode ? (
        <div className="absolute bottom-4 left-4 right-4 z-20 rounded-2xl border border-white/12 bg-ink/62 p-3 backdrop-blur">
          <div className="mb-2 flex justify-between text-xs font-semibold text-white/78">
            <span>Before</span>
            <span>After</span>
          </div>
          <input
            type="range"
            min={0.05}
            max={0.95}
            step={0.01}
            value={compareSplit}
            onChange={(event) => setCompareSplit(Number(event.target.value))}
            className="w-full"
            aria-label="전후 비교 슬라이더"
          />
        </div>
      ) : null}
    </div>
  );
});

export default BrowCanvas;
