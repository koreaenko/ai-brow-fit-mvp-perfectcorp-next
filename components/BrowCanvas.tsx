"use client";

import BrowZoomControls from "@/components/BrowZoomControls";
import {
  adjustBrowAnchor,
  createFallbackPlacement,
  getAxis,
  getUpNormal,
} from "@/lib/browGeometry";
import { downloadCanvasAsPng } from "@/lib/exportImage";
import { eyebrowFadeLayer } from "@/lib/eyebrowFade";
import type {
  BrowAnchor,
  BrowControls,
  BrowPlacement,
  BrowSide,
  BrowStyle,
  Point,
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
import type { PointerEvent as ReactPointerEvent, WheelEvent as ReactWheelEvent } from "react";

export type BrowCanvasHandle = {
  saveResult: () => void;
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
  onRendered?: (dataUrl: string) => void;
};

type Viewport = {
  scale: number;
  x: number;
  y: number;
};

const BROW_COLOR = "#2b211d";
const MIN_ZOOM = 0.75;
const MAX_ZOOM = 4.2;

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = src;
  });
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function midpoint(a: Point, b: Point): Point {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
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
  ctx.strokeStyle = BROW_COLOR;
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
  ctx.fillStyle = BROW_COLOR;
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
  gradient.addColorStop(0, "rgba(43,33,29,0.18)");
  gradient.addColorStop(0.22, `rgba(43,33,29,${0.56 + style.density * 0.2})`);
  gradient.addColorStop(0.62, `rgba(43,33,29,${0.78 + style.density * 0.14})`);
  gradient.addColorStop(1, "rgba(43,33,29,0.24)");
  ctx.globalAlpha = opacity;
  ctx.filter = `blur(${blur}px)`;
  ctx.fillStyle = gradient;
  ctx.fill();
  ctx.restore();

  drawHairTexture(ctx, anchor, side, angle, eyeDistance, controls, style);
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
  fadedOnly = false,
) {
  drawImageBase(ctx, image);
  eyebrowFadeLayer(ctx, image, placement, controls, style);

  if (fadedOnly) {
    return;
  }

  const brows = getAdjustedBrows(placement, controls, style);
  drawBrowShape(ctx, brows.left, "left", placement.angle, placement.eyeDistance, controls, style);
  drawBrowShape(ctx, brows.right, "right", placement.angle, placement.eyeDistance, controls, style);
}

function drawComparison(
  ctx: CanvasRenderingContext2D,
  image: HTMLImageElement,
  placement: BrowPlacement,
  controls: BrowControls,
  style: BrowStyle,
  split: number,
) {
  drawApplied(ctx, image, placement, controls, style, false);
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

function renderToCanvas(
  canvas: HTMLCanvasElement,
  image: HTMLImageElement,
  placement: BrowPlacement,
  controls: BrowControls,
  style: BrowStyle,
  compareMode: boolean,
  fadedOnly: boolean,
  compareSplit: number,
) {
  canvas.width = image.naturalWidth;
  canvas.height = image.naturalHeight;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });

  if (!ctx) {
    return;
  }

  if (compareMode) {
    drawComparison(ctx, image, placement, controls, style, compareSplit);
  } else {
    drawApplied(ctx, image, placement, controls, style, fadedOnly);
  }
}

const BrowCanvas = forwardRef<BrowCanvasHandle, BrowCanvasProps>(function BrowCanvas(
  { imageSrc, placement, controls, style, compareMode, fadedOnly, onRendered },
  ref,
) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const shellRef = useRef<HTMLDivElement>(null);
  const pointerMap = useRef(new Map<number, Point>());
  const lastPinchDistance = useRef<number | null>(null);
  const panStart = useRef<Point | null>(null);
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [viewport, setViewport] = useState<Viewport>({ scale: 1, x: 0, y: 0 });
  const [compareSplit, setCompareSplit] = useState(0.5);

  useEffect(() => {
    let active = true;
    loadImage(imageSrc).then((loaded) => {
      if (active) {
        setImage(loaded);
        setViewport({ scale: 1, x: 0, y: 0 });
      }
    });

    return () => {
      active = false;
    };
  }, [imageSrc]);

  const activePlacement = useMemo(() => {
    if (!image) {
      return placement;
    }

    return placement ?? createFallbackPlacement(image.naturalWidth, image.naturalHeight);
  }, [image, placement]);

  const applyZoom = useCallback((nextScale: number, center?: Point) => {
    setViewport((current) => {
      const scale = clamp(nextScale, MIN_ZOOM, MAX_ZOOM);

      if (!center) {
        return { ...current, scale };
      }

      const ratio = scale / current.scale;
      return {
        scale,
        x: center.x - (center.x - current.x) * ratio,
        y: center.y - (center.y - current.y) * ratio,
      };
    });
  }, []);

  const zoomIn = useCallback(() => applyZoom(viewport.scale * 1.18), [applyZoom, viewport.scale]);
  const zoomOut = useCallback(() => applyZoom(viewport.scale / 1.18), [applyZoom, viewport.scale]);
  const resetZoom = useCallback(() => setViewport({ scale: 1, x: 0, y: 0 }), []);
  const focusBrows = useCallback(() => {
    if (!activePlacement || !image || !shellRef.current) {
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
    const rect = shellRef.current.getBoundingClientRect();
    const scale = clamp(Math.min(3.2, image.naturalWidth / Math.max(activePlacement.eyeDistance * 2.5, 1)), 1.7, 3.2);

    setViewport({
      scale,
      x: rect.width / 2 - center.x * scale,
      y: rect.height / 2 - center.y * scale,
    });
  }, [activePlacement, image]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !image || !activePlacement) {
      return;
    }

    renderToCanvas(canvas, image, activePlacement, controls, style, compareMode, fadedOnly, compareSplit);

    const exportCanvas = document.createElement("canvas");
    renderToCanvas(exportCanvas, image, activePlacement, controls, style, false, false, 0.5);
    onRendered?.(exportCanvas.toDataURL("image/png"));
  }, [activePlacement, compareMode, compareSplit, controls, fadedOnly, image, onRendered, style]);

  useImperativeHandle(ref, () => ({
    saveResult() {
      if (!image || !activePlacement) {
        return;
      }

      const exportCanvas = document.createElement("canvas");
      renderToCanvas(exportCanvas, image, activePlacement, controls, style, false, false, 0.5);
      downloadCanvasAsPng(exportCanvas, "ai-brow-fit-consulting.png");
    },
    getResultDataUrl() {
      if (!image || !activePlacement) {
        return null;
      }

      const exportCanvas = document.createElement("canvas");
      renderToCanvas(exportCanvas, image, activePlacement, controls, style, false, false, 0.5);
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

  const handlePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    pointerMap.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    panStart.current = { x: event.clientX - viewport.x, y: event.clientY - viewport.y };
  };

  const handlePointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!pointerMap.current.has(event.pointerId)) {
      return;
    }

    pointerMap.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    const pointers = Array.from(pointerMap.current.values());

    if (pointers.length >= 2) {
      const [first, second] = pointers;
      const nextDistance = Math.hypot(first.x - second.x, first.y - second.y);
      const previousDistance = lastPinchDistance.current ?? nextDistance;
      const rect = event.currentTarget.getBoundingClientRect();
      const center = {
        x: (first.x + second.x) / 2 - rect.left,
        y: (first.y + second.y) / 2 - rect.top,
      };

      applyZoom(viewport.scale * (nextDistance / previousDistance), center);
      lastPinchDistance.current = nextDistance;
      return;
    }

    if (panStart.current) {
      setViewport((current) => ({
        ...current,
        x: event.clientX - panStart.current!.x,
        y: event.clientY - panStart.current!.y,
      }));
    }
  };

  const clearPointer = (event: ReactPointerEvent<HTMLDivElement>) => {
    pointerMap.current.delete(event.pointerId);
    lastPinchDistance.current = null;
    panStart.current = null;
  };

  return (
    <div className="relative overflow-hidden rounded-[28px] bg-[#171312] shadow-soft ring-1 ring-cocoa/10">
      <div className="pointer-events-none absolute left-4 top-4 z-10 flex flex-wrap gap-2">
        <span className="rounded-full bg-ink/58 px-3 py-2 text-xs font-semibold text-white/88 backdrop-blur">
          {compareMode ? "Before / After" : fadedOnly ? "눈썹 없는 원본" : "실시간 맞춤"}
        </span>
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
        />
      </div>

      <div
        ref={shellRef}
        onWheel={handleWheel}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={clearPointer}
        onPointerCancel={clearPointer}
        className="relative flex h-[58dvh] min-h-[440px] touch-none cursor-grab items-center justify-center overflow-hidden bg-[radial-gradient(circle_at_top,#3c2a24,transparent_36%),#171312] active:cursor-grabbing lg:h-[calc(100dvh-144px)]"
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
