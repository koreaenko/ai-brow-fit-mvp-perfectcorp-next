import { adjustBrowAnchor, getAxis, getUpNormal } from "@/lib/browGeometry";
import type { BrowAnchor, BrowControls, BrowPlacement, BrowSide, BrowStyle, Point } from "@/types/brow";

function distance(a: Point, b: Point) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function getFadeBox(anchor: BrowAnchor, eyeDistance: number) {
  const points = [anchor.start, anchor.arch, anchor.tail];
  const paddingX = eyeDistance * 0.16;
  const paddingY = eyeDistance * 0.16;
  const minX = Math.min(...points.map((point) => point.x)) - paddingX;
  const maxX = Math.max(...points.map((point) => point.x)) + paddingX;
  const minY = Math.min(...points.map((point) => point.y)) - paddingY;
  const maxY = Math.max(...points.map((point) => point.y)) + paddingY;

  return { minX, minY, maxX, maxY };
}

function isInsideRotatedBrowMask(
  x: number,
  y: number,
  anchor: BrowAnchor,
  angle: number,
  eyeDistance: number,
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
  const width = distance(anchor.start, anchor.tail) * 0.68;
  const height = eyeDistance * 0.12;
  const value = (localX * localX) / (width * width) + (localY * localY) / (height * height);

  return value <= 1;
}

function fadeAnchorPixels(
  ctx: CanvasRenderingContext2D,
  anchor: BrowAnchor,
  angle: number,
  eyeDistance: number,
) {
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

  for (let row = 0; row < height; row += 1) {
    for (let col = 0; col < width; col += 1) {
      const px = x + col;
      const py = y + row;

      if (!isInsideRotatedBrowMask(px, py, anchor, angle, eyeDistance)) {
        continue;
      }

      const offset = (row * width + col) * 4;
      const red = data[offset];
      const green = data[offset + 1];
      const blue = data[offset + 2];
      const luminance = red * 0.299 + green * 0.587 + blue * 0.114;

      data[offset] = red * 0.58 + luminance * 0.2 + 235 * 0.22;
      data[offset + 1] = green * 0.58 + luminance * 0.22 + 220 * 0.2;
      data[offset + 2] = blue * 0.58 + luminance * 0.24 + 205 * 0.18;
    }
  }

  ctx.putImageData(imageData, x, y);
}

function softenBrowRegion(
  ctx: CanvasRenderingContext2D,
  image: HTMLImageElement,
  anchor: BrowAnchor,
  angle: number,
  eyeDistance: number,
) {
  const { minX, minY, maxX, maxY } = getFadeBox(anchor, eyeDistance);
  const width = maxX - minX;
  const height = maxY - minY;

  ctx.save();
  ctx.beginPath();
  ctx.ellipse(
    (minX + maxX) / 2,
    (minY + maxY) / 2,
    Math.max(width / 2, 1),
    Math.max(height / 2, 1),
    angle,
    0,
    Math.PI * 2,
  );
  ctx.clip();
  ctx.globalAlpha = 0.26;
  ctx.filter = "blur(6px) brightness(1.2) saturate(0.52)";
  ctx.drawImage(image, 0, 0, image.naturalWidth, image.naturalHeight);
  ctx.globalAlpha = 0.14;
  ctx.filter = "blur(10px)";
  ctx.fillStyle = "#ead5bf";
  ctx.fillRect(minX, minY, width, height);
  ctx.restore();
}

export function eyebrowFadeLayer(
  ctx: CanvasRenderingContext2D,
  image: HTMLImageElement,
  placement: BrowPlacement,
  controls: BrowControls,
  style: BrowStyle,
) {
  const drawOne = (base: BrowAnchor, side: BrowSide) => {
    const anchor = adjustBrowAnchor(
      base,
      side,
      placement.angle,
      placement.eyeDistance,
      controls,
      style,
    );
    fadeAnchorPixels(ctx, anchor, placement.angle, placement.eyeDistance);
    softenBrowRegion(ctx, image, anchor, placement.angle, placement.eyeDistance);
  };

  drawOne(placement.left, "left");
  drawOne(placement.right, "right");
}
