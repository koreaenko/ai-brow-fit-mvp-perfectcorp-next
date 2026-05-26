import type { BrowAnchor, BrowGuidePoints, BrowPlacement, Point } from "@/types/brow";

const EDIT_IMAGE_MAX_EDGE = 1800;
const FACE_IMAGE_MAX_EDGE = 1400;
const FACE_IMAGE_MIN_WIDTH = 920;
const JPEG_QUALITY = 0.92;
const CUSTOM_BROW_MAX_EDGE = 900;

type PreparedImage = {
  src: string;
  width: number;
  height: number;
  originalWidth: number;
  originalHeight: number;
  resized: boolean;
};

type FaceFocusedImage = PreparedImage & {
  placement: BrowPlacement;
};

function loadImageFromObjectUrl(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = src;
  });
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality?: number) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) {
        resolve(blob);
      } else {
        reject(new Error("Failed to prepare image."));
      }
    }, type, quality);
  });
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function smoothStep(edge0: number, edge1: number, value: number) {
  const t = clamp((value - edge0) / Math.max(edge1 - edge0, 0.001), 0, 1);

  return t * t * (3 - 2 * t);
}

function luminance(red: number, green: number, blue: number) {
  return red * 0.299 + green * 0.587 + blue * 0.114;
}

function transformPoint(point: Point, cropX: number, cropY: number, scale: number): Point {
  return {
    x: (point.x - cropX) * scale,
    y: (point.y - cropY) * scale,
  };
}

function transformAnchor(anchor: BrowAnchor, cropX: number, cropY: number, scale: number): BrowAnchor {
  return {
    start: transformPoint(anchor.start, cropX, cropY, scale),
    arch: transformPoint(anchor.arch, cropX, cropY, scale),
    tail: transformPoint(anchor.tail, cropX, cropY, scale),
  };
}

function transformGuides(
  guides: BrowGuidePoints | undefined,
  cropX: number,
  cropY: number,
  scale: number,
): BrowGuidePoints | undefined {
  if (!guides) {
    return undefined;
  }

  return {
    faceCenter: transformPoint(guides.faceCenter, cropX, cropY, scale),
    noseBridge: transformPoint(guides.noseBridge, cropX, cropY, scale),
    noseTip: transformPoint(guides.noseTip, cropX, cropY, scale),
    mouthCenter: transformPoint(guides.mouthCenter, cropX, cropY, scale),
    leftNostril: transformPoint(guides.leftNostril, cropX, cropY, scale),
    rightNostril: transformPoint(guides.rightNostril, cropX, cropY, scale),
    leftEyeOuter: transformPoint(guides.leftEyeOuter, cropX, cropY, scale),
    rightEyeOuter: transformPoint(guides.rightEyeOuter, cropX, cropY, scale),
  };
}

export async function prepareImageForEditing(file: File): Promise<PreparedImage> {
  const originalSrc = URL.createObjectURL(file);

  try {
    const image = await loadImageFromObjectUrl(originalSrc);
    const originalWidth = image.naturalWidth;
    const originalHeight = image.naturalHeight;
    const maxEdge = Math.max(originalWidth, originalHeight);

    if (maxEdge <= EDIT_IMAGE_MAX_EDGE) {
      return {
        src: originalSrc,
        width: originalWidth,
        height: originalHeight,
        originalWidth,
        originalHeight,
        resized: false,
      };
    }

    const scale = EDIT_IMAGE_MAX_EDGE / maxEdge;
    const width = Math.round(originalWidth * scale);
    const height = Math.round(originalHeight * scale);
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d", { alpha: false });

    if (!ctx) {
      return {
        src: originalSrc,
        width: originalWidth,
        height: originalHeight,
        originalWidth,
        originalHeight,
        resized: false,
      };
    }

    canvas.width = width;
    canvas.height = height;
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(image, 0, 0, width, height);

    const blob = await canvasToBlob(canvas, "image/jpeg", JPEG_QUALITY);
    const resizedSrc = URL.createObjectURL(blob);
    URL.revokeObjectURL(originalSrc);

    return {
      src: resizedSrc,
      width,
      height,
      originalWidth,
      originalHeight,
      resized: true,
    };
  } catch (error) {
    URL.revokeObjectURL(originalSrc);
    throw error;
  }
}

export async function prepareFaceFocusedImage(
  src: string,
  placement: BrowPlacement,
  originalWidth: number,
  originalHeight: number,
): Promise<FaceFocusedImage> {
  const image = await loadImageFromObjectUrl(src);
  const browPoints = [
    placement.left.start,
    placement.left.arch,
    placement.left.tail,
    placement.right.start,
    placement.right.arch,
    placement.right.tail,
  ];
  const browCenter = {
    x: browPoints.reduce((sum, point) => sum + point.x, 0) / browPoints.length,
    y: browPoints.reduce((sum, point) => sum + point.y, 0) / browPoints.length,
  };
  const idealWidth = placement.eyeDistance * 4.5;
  const idealHeight = placement.eyeDistance * 5.25;
  const cropWidth = Math.min(image.naturalWidth, Math.max(idealWidth, placement.eyeDistance * 3.4));
  const cropHeight = Math.min(image.naturalHeight, Math.max(idealHeight, cropWidth * 1.05));
  const desiredX = browCenter.x - cropWidth / 2;
  const desiredY = browCenter.y - placement.eyeDistance * 1.45;
  const cropX = clamp(desiredX, 0, Math.max(0, image.naturalWidth - cropWidth));
  const cropY = clamp(desiredY, 0, Math.max(0, image.naturalHeight - cropHeight));
  const maxScale = FACE_IMAGE_MAX_EDGE / Math.max(cropWidth, cropHeight);
  const minReadableScale = FACE_IMAGE_MIN_WIDTH / cropWidth;
  const scale = Math.min(maxScale, Math.max(1, minReadableScale));
  const width = Math.round(cropWidth * scale);
  const height = Math.round(cropHeight * scale);
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d", { alpha: false });

  if (!ctx) {
    return {
      src,
      width: image.naturalWidth,
      height: image.naturalHeight,
      originalWidth,
      originalHeight,
      resized: false,
      placement,
    };
  }

  canvas.width = width;
  canvas.height = height;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(image, cropX, cropY, cropWidth, cropHeight, 0, 0, width, height);

  const blob = await canvasToBlob(canvas, "image/jpeg", JPEG_QUALITY);
  const focusedSrc = URL.createObjectURL(blob);

  return {
    src: focusedSrc,
    width,
    height,
    originalWidth,
    originalHeight,
    resized: true,
    placement: {
      left: transformAnchor(placement.left, cropX, cropY, scale),
      right: transformAnchor(placement.right, cropX, cropY, scale),
      angle: placement.angle,
      eyeDistance: placement.eyeDistance * scale,
      guides: transformGuides(placement.guides, cropX, cropY, scale),
    },
  };
}

export async function prepareCustomBrowTexture(file: File): Promise<PreparedImage> {
  const originalSrc = URL.createObjectURL(file);

  try {
    const image = await loadImageFromObjectUrl(originalSrc);
    const maxEdge = Math.max(image.naturalWidth, image.naturalHeight);
    const scale = Math.min(1, CUSTOM_BROW_MAX_EDGE / Math.max(maxEdge, 1));
    const width = Math.max(1, Math.round(image.naturalWidth * scale));
    const height = Math.max(1, Math.round(image.naturalHeight * scale));
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d", { willReadFrequently: true });

    if (!ctx) {
      return {
        src: originalSrc,
        width: image.naturalWidth,
        height: image.naturalHeight,
        originalWidth: image.naturalWidth,
        originalHeight: image.naturalHeight,
        resized: false,
      };
    }

    canvas.width = width;
    canvas.height = height;
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.clearRect(0, 0, width, height);
    ctx.drawImage(image, 0, 0, width, height);

    const imageData = ctx.getImageData(0, 0, width, height);
    const data = imageData.data;
    let minX = width;
    let minY = height;
    let maxX = 0;
    let maxY = 0;

    for (let index = 0; index < data.length; index += 4) {
      const red = data[index];
      const green = data[index + 1];
      const blue = data[index + 2];
      const originalAlpha = data[index + 3] / 255;
      const lum = luminance(red, green, blue);
      const darkness = clamp((232 - lum) / 150, 0, 1);
      const colorSpread = (Math.max(red, green, blue) - Math.min(red, green, blue)) / 255;
      const hairSignal = Math.max(darkness, colorSpread * 0.32);
      const alpha = originalAlpha * smoothStep(0.14, 0.52, hairSignal);

      if (alpha < 0.035) {
        data[index + 3] = 0;
        continue;
      }

      const contrast = 1.34;
      const darken = 26 + alpha * 34;
      data[index] = clamp((red - 128) * contrast + 128 - darken, 0, 255);
      data[index + 1] = clamp((green - 128) * contrast + 128 - darken, 0, 255);
      data[index + 2] = clamp((blue - 128) * contrast + 128 - darken, 0, 255);
      data[index + 3] = Math.round(clamp(alpha * 1.38, 0, 1) * 255);

      const pixel = index / 4;
      const x = pixel % width;
      const y = Math.floor(pixel / width);
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    }

    ctx.putImageData(imageData, 0, 0);

    const padding = Math.max(10, Math.round(Math.min(width, height) * 0.08));
    const cropX = clamp(minX - padding, 0, width - 1);
    const cropY = clamp(minY - padding, 0, height - 1);
    const cropRight = clamp(maxX + padding, cropX + 1, width);
    const cropBottom = clamp(maxY + padding, cropY + 1, height);
    const outputWidth = Math.round(cropRight - cropX);
    const outputHeight = Math.round(cropBottom - cropY);
    const output = document.createElement("canvas");
    const outputCtx = output.getContext("2d");

    if (!outputCtx || minX > maxX || minY > maxY) {
      const blob = await canvasToBlob(canvas, "image/png");
      const processedSrc = URL.createObjectURL(blob);
      URL.revokeObjectURL(originalSrc);

      return {
        src: processedSrc,
        width,
        height,
        originalWidth: image.naturalWidth,
        originalHeight: image.naturalHeight,
        resized: true,
      };
    }

    output.width = outputWidth;
    output.height = outputHeight;
    outputCtx.drawImage(canvas, cropX, cropY, outputWidth, outputHeight, 0, 0, outputWidth, outputHeight);

    const blob = await canvasToBlob(output, "image/png");
    const processedSrc = URL.createObjectURL(blob);
    URL.revokeObjectURL(originalSrc);

    return {
      src: processedSrc,
      width: outputWidth,
      height: outputHeight,
      originalWidth: image.naturalWidth,
      originalHeight: image.naturalHeight,
      resized: true,
    };
  } catch (error) {
    URL.revokeObjectURL(originalSrc);
    throw error;
  }
}
