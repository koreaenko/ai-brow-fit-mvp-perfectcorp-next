/* global importScripts, cv */
let engine;
async function getEngine() {
  if (!engine) {
    importScripts('/vendor/opencv/opencv.js');
    engine = Promise.resolve(cv);
  }
  return engine;
}
self.onmessage = async ({ data }) => {
  const mats = [];
  try {
    const cv = await getEngine();
    const keep = mat => { mats.push(mat); return mat; };
    const { width, height, distance } = data;
    const rgba = keep(cv.matFromArray(height, width, cv.CV_8UC4, new Uint8Array(data.pixels)));
    const rgb = keep(new cv.Mat()), gray = keep(new cv.Mat()), closed = keep(new cv.Mat());
    const mask = keep(cv.Mat.zeros(height, width, cv.CV_8UC1));
    cv.cvtColor(rgba, rgb, cv.COLOR_RGBA2RGB);
    cv.cvtColor(rgb, gray, cv.COLOR_RGB2GRAY);
    const size = Math.max(9, Math.round(distance * .2) | 1);
    const kernel = keep(cv.getStructuringElement(cv.MORPH_ELLIPSE, new cv.Size(size, size)));
    cv.morphologyEx(gray, closed, cv.MORPH_CLOSE, kernel);
    const region = new Float32Array(data.region);
    for (let i = 0; i < region.length; i++) {
      if (region[i] > .08 || (region[i] > .02 && closed.data[i] - gray.data[i] > 9)) mask.data[i] = 255;
    }
    const expand = keep(cv.getStructuringElement(cv.MORPH_ELLIPSE, new cv.Size(9, 9)));
    cv.dilate(mask, mask, expand);
    for (let i = 0; i < region.length; i++) if (region[i] <= .02) mask.data[i] = 0;
    const restored = keep(new cv.Mat());
    cv.inpaint(rgb, mask, restored, 5, cv.INPAINT_TELEA);
    // Remove propagation ridges before feathering the repair into untouched skin.
    cv.GaussianBlur(restored, restored, new cv.Size(31, 31), 0);
    const feather = keep(new cv.Mat());
    cv.GaussianBlur(mask, feather, new cv.Size(11, 11), 0);
    const output = new Uint8ClampedArray(data.pixels.slice(0));
    const applied = new Uint8Array(region.length);
    for (let i = 0; i < region.length; i++) {
      if (!feather.data[i] || region[i] <= .02) continue;
      const weight = Math.min(1, region[i] * 5) * feather.data[i] / 255;
      for (let c = 0; c < 3; c++) output[i * 4 + c] = output[i * 4 + c] * (1 - weight) + restored.data[i * 3 + c] * weight;
      applied[i] = Math.round(weight * 255);
    }
    self.postMessage({ pixels: output.buffer, mask: applied.buffer }, [output.buffer, applied.buffer]);
  } catch (error) { self.postMessage({ error: String(error) }); }
  finally { for (const mat of mats.reverse()) mat.delete(); }
};
