const templates = new Map<string, Promise<HTMLImageElement>>();

// Convert white-matted artwork to dark pigment with soft alpha, without a white fringe.
export function removeWhiteMatte(pixels: Uint8ClampedArray) {
  const result = new Uint8ClampedArray(pixels);
  for (let i = 0; i < result.length; i += 4) {
    const coverage = 1 - Math.max(result[i], result[i + 1], result[i + 2]) / 255;
    result[i + 3] = Math.round(result[i + 3] * coverage);
    result[i] = result[i + 1] = result[i + 2] = 0;
  }
  return result;
}

export function loadBrowTemplate(src: string): Promise<HTMLImageElement> {
  const hit = templates.get(src);
  if (hit) return hit;
  const pending = new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onerror = reject;
    image.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = image.naturalWidth; canvas.height = image.naturalHeight;
        const ctx = canvas.getContext("2d")!;
        ctx.drawImage(image, 0, 0);
        const data = ctx.getImageData(0, 0, canvas.width, canvas.height);
        data.data.set(removeWhiteMatte(data.data));
        ctx.putImageData(data, 0, 0);
        canvas.toBlob(blob => {
          if (!blob) { reject(new Error("Texture encoding failed")); return; }
          const url = URL.createObjectURL(blob);
          const clean = new Image();
          clean.onload = () => { URL.revokeObjectURL(url); resolve(clean); };
          clean.onerror = () => { URL.revokeObjectURL(url); reject(new Error("Texture decoding failed")); };
          clean.src = url;
        });
      } catch (error) { reject(error); }
    };
    image.src = src;
  });
  templates.set(src, pending);
  if (templates.size > 12) templates.delete(templates.keys().next().value!);
  pending.catch(() => templates.delete(src));
  return pending;
}
