import { removalMask } from "@/lib/browRemoval";
import type { BrowPlacement } from "@/types/brow";

export function repairBrowSkin(pixels: ImageData, placement: BrowPlacement, mode: "tail" | "all", padding: number, signal: AbortSignal): Promise<ImageData> {
  return new Promise((resolve, reject) => {
    const worker = new Worker('/workers/brow-repair.js');
    const cleanup = () => { worker.terminate(); clearTimeout(timer); signal.removeEventListener('abort', abort); };
    const abort = () => { cleanup(); reject(new DOMException('Cancelled', 'AbortError')); };
    const timer = setTimeout(() => { cleanup(); reject(Error('복원 시간이 초과되었습니다. 다시 시도해 주세요.')); }, 45000);
    signal.addEventListener('abort', abort, { once: true });
    if (signal.aborted) { abort(); return; }
    worker.onerror = () => { cleanup(); reject(Error('피부 복원 엔진을 불러오지 못했습니다.')); };
    worker.onmessage = ({ data }) => {
      cleanup();
      if (data.error) reject(Error('피부 복원에 실패했습니다.'));
      else resolve(new ImageData(new Uint8ClampedArray(data.pixels), pixels.width, pixels.height));
    };
    const region = removalMask(pixels.width, pixels.height, placement, { mode, padding });
    const copy = pixels.data.slice();
    worker.postMessage({ pixels: copy.buffer, region: region.buffer, width: pixels.width, height: pixels.height, distance: placement.eyeDistance }, [copy.buffer, region.buffer]);
  });
}

export function blendRepair(original: ImageData, repaired: ImageData, strength: number) {
  const output = new Uint8ClampedArray(original.data);
  const amount = Math.min(1, Math.max(0, strength));
  for (let i = 0; i < output.length; i += 4) for (let c = 0; c < 3; c++) output[i+c] = original.data[i+c] + (repaired.data[i+c] - original.data[i+c]) * amount;
  return new ImageData(output, original.width, original.height);
}
