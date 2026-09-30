export function thickenStrokePixels(source: Uint8ClampedArray, width: number, height: number, radius: number) {
  const output = new Uint8ClampedArray(source);
  const amount = Number.isFinite(radius) ? Math.max(0, Math.min(4, radius)) : 0;
  if (!amount) return output;
  const reach = Math.ceil(amount);
  const offsets: { dx: number; dy: number; weight: number }[] = [];
  for (let dy = -reach; dy <= reach; dy++) for (let dx = -reach; dx <= reach; dx++) {
    const weight = Math.min(1, Math.max(0, amount + 1 - Math.hypot(dx, dy)));
    if (weight) offsets.push({ dx, dy, weight });
  }
  // Expand coverage, not opacity: repeated overlapping draws would darken intersections.
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const index = (y * width + x) * 4;
    let alpha = source[index + 3];
    let pigment = index;
    for (const { dx, dy, weight } of offsets) {
      if (x + dx < 0 || x + dx >= width || y + dy < 0 || y + dy >= height) continue;
      const neighbor = ((y + dy) * width + x + dx) * 4;
      const coverage = source[neighbor + 3] * weight;
      if (coverage > alpha) { alpha = coverage; pigment = neighbor; }
    }
    output[index] = source[pigment];
    output[index + 1] = source[pigment + 1];
    output[index + 2] = source[pigment + 2];
    output[index + 3] = alpha;
  }
  return output;
}

const cache = new Map<string, Promise<HTMLImageElement>>();
export function prepareStrokeWidth(image: HTMLImageElement, amount: number, maxWidth = image.naturalWidth): Promise<HTMLImageElement> {
  if (amount <= 0) return Promise.resolve(image);
  const key = `${image.src}:${amount}:${maxWidth}`;
  const cached = cache.get(key);
  if (cached) return cached;
  const canvas = document.createElement("canvas");
  canvas.width = Math.min(maxWidth, image.naturalWidth); canvas.height = Math.round(image.naturalHeight * canvas.width / image.naturalWidth);
  const ctx = canvas.getContext("2d");
  if (!ctx) return Promise.reject(new Error("Canvas unavailable"));
  ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
  const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height);
  pixels.data.set(thickenStrokePixels(pixels.data, canvas.width, canvas.height, amount * 4 * canvas.width / 1600));
  ctx.putImageData(pixels, 0, 0);
  const prepared = new Promise<HTMLImageElement>((resolve, reject) => {
    canvas.toBlob(blob => {
      if (!blob) { reject(new Error("Texture encoding failed")); return; }
      const url = URL.createObjectURL(blob);
      const result = new Image();
      result.onload = () => { URL.revokeObjectURL(url); resolve(result); };
      result.onerror = () => { URL.revokeObjectURL(url); reject(new Error("Texture decoding failed")); };
      result.src = url;
    }, "image/png");
  });
  cache.set(key, prepared);
  if (cache.size > 6) cache.delete(cache.keys().next().value!);
  prepared.catch(() => cache.delete(key));
  return prepared;
}
