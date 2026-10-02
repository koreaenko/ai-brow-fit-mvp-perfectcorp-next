"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { readBrowDesign, stageBrowDesign } from "@/lib/browDesignHandoff";
import { ArrowLeft, Download, Eraser, RotateCcw, Upload } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { detectFacePlacement } from "@/lib/faceLandmarks";
import { prepareImageForEditing } from "@/lib/imageProcessing";
import { downloadCanvasAsPng } from "@/lib/exportImage";
import { removalMask } from "@/lib/browRemoval";
import { repairBrowSkin, blendRepair } from "@/lib/browRepair";
import { lightenBrowPixels, LIGHTENING_DEFAULTS, type LighteningOptions } from "@/lib/browLightening";
import type { BrowPlacement } from "@/types/brow";

type Photo = { pixels: ImageData; placement: BrowPlacement };

export default function BrowRemovalTest() {
  const router = useRouter();
  const handoffId = useSearchParams().get("handoff");
  const [photo, setPhoto] = useState<Photo | null>(null);
  const [result, setResult] = useState<ImageData | null>(null);
  const [method, setMethod] = useState<"repair" | "lighten">("repair");
  const [repair, setRepair] = useState<{ photo: Photo; mode: string; padding: number; pixels: ImageData } | null>(null);
  const [repairing, setRepairing] = useState(false);
  const [options, setOptions] = useState<LighteningOptions>(LIGHTENING_DEFAULTS);
  const [maskVisible, setMaskVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const original = useRef<HTMLCanvasElement>(null);
  const after = useRef<HTMLCanvasElement>(null);
  const picker = useRef<HTMLInputElement>(null);
  const sequence = useRef(0);
  useEffect(() => () => { sequence.current++; }, []);
  useEffect(() => {
    if (!handoffId) return;
    let cancelled = false;
    const id = ++sequence.current;
    async function restore() {
      try {
        const data = readBrowDesign(handoffId!);
        if (!data) throw Error("expired");
        const image = new Image(); image.src = data.original; await image.decode();
        if (cancelled || id !== sequence.current) return;
        const canvas = document.createElement("canvas"); canvas.width = image.naturalWidth; canvas.height = image.naturalHeight;
        const ctx = canvas.getContext("2d")!; ctx.drawImage(image, 0, 0);
        setPhoto({ pixels: ctx.getImageData(0, 0, canvas.width, canvas.height), placement: data.placement });
        setMessage("현재 사진을 불러왔습니다.");
      } catch { if (!cancelled && id === sequence.current) setMessage("임시 사진이 만료되었습니다. 사진을 다시 선택해 주세요."); }
    }
    void restore();
    return () => { cancelled = true; };
  }, [handoffId]);

  async function upload(file: File) {
    const id = ++sequence.current;
    setBusy(true); setMessage("사진과 눈썹 위치를 확인하고 있습니다."); setPhoto(null); setResult(null);
    let src = "";
    try {
      if (!file.type.startsWith("image/")) throw Error("image");
      const prepared = await prepareImageForEditing(file); src = prepared.src;
      const image = new Image(); image.src = src; await image.decode();
      const placement = await detectFacePlacement(image);
      if (!placement.left.contour || !placement.right.contour) throw Error("contour");
      const canvas = document.createElement("canvas"); canvas.width = image.naturalWidth; canvas.height = image.naturalHeight;
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      if (!ctx) throw Error("canvas");
      ctx.drawImage(image, 0, 0);
      if (id !== sequence.current) return;
      setPhoto({ pixels: ctx.getImageData(0, 0, canvas.width, canvas.height), placement });
      setOptions(LIGHTENING_DEFAULTS); setMessage("사진 준비 완료");
    } catch {
      if (id === sequence.current) setMessage("사진을 확인하지 못했습니다. 눈썹과 이마가 보이는 정면 사진을 선택해 주세요.");
    } finally {
      if (src.startsWith("blob:")) URL.revokeObjectURL(src);
      if (id === sequence.current) setBusy(false);
    }
  }

  useEffect(() => {
    if (!photo) return;
    const { pixels, placement } = photo;
    for (const [canvas, data] of [[original.current, pixels], [after.current, result ?? pixels]] as const) {
      if (!canvas) continue;
      canvas.width = pixels.width; canvas.height = pixels.height;
      canvas.getContext("2d")?.putImageData(data, 0, 0);
    }
    if (maskVisible && original.current) {
      const ctx = original.current.getContext("2d")!;
      const mask = removalMask(pixels.width, pixels.height, placement, options);
      const overlay = new ImageData(pixels.width, pixels.height);
      for (let i = 0; i < mask.length; i++) {
        overlay.data[i * 4] = 244; overlay.data[i * 4 + 1] = 100;
        overlay.data[i * 4 + 2] = 35; overlay.data[i * 4 + 3] = mask[i] * 100;
      }
      const layer = document.createElement("canvas"); layer.width = pixels.width; layer.height = pixels.height;
      layer.getContext("2d")!.putImageData(overlay, 0, 0); ctx.drawImage(layer, 0, 0);
    }
  }, [photo, result, options, maskVisible]);

  useEffect(() => {
    if (!photo || method !== "repair") return;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      setRepairing(true);
      setMessage("눈썹 피부 복원 중…");
      void repairBrowSkin(photo.pixels, photo.placement, options.mode, options.padding, controller.signal)
        .then(pixels => {
          if (controller.signal.aborted) return;
          setRepair({ photo, mode: options.mode, padding: options.padding, pixels });
          setRepairing(false); setMessage("피부 복원 준비 완료");
        }).catch(error => {
          if (controller.signal.aborted) return;
          setRepairing(false); setMessage(`피부 복원 실패: ${String(error)}`);
        });
    }, 120);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [photo, method, options.mode, options.padding]);

  const repairReady = repair?.photo === photo && repair?.mode === options.mode && repair?.padding === options.padding;
  const ready = method === "lighten" || (repairReady && !repairing);
  useEffect(() => {
    if (!photo) return;
    const frame = requestAnimationFrame(() => {
      const { pixels, placement } = photo;
      setResult(method === "repair"
        ? repairReady && repair ? blendRepair(pixels, repair.pixels, options.strength) : pixels
        : new ImageData(lightenBrowPixels(pixels.data, pixels.width, pixels.height, placement, options), pixels.width, pixels.height));
    });
    return () => cancelAnimationFrame(frame);
  }, [photo, options, method, repair, repairReady]);
  function change(next: LighteningOptions) { setOptions(next); }

  function startDesign() {
    if (!photo || !result || !ready) return;
    try {
      const { pixels, placement } = photo;
      const canvas = document.createElement("canvas");
      canvas.width = pixels.width; canvas.height = pixels.height;
      const ctx = canvas.getContext("2d")!;
      ctx.putImageData(pixels, 0, 0);
      const original = canvas.toDataURL("image/png");
      ctx.putImageData(result, 0, 0);
      const id = stageBrowDesign({ original, softened: canvas.toDataURL("image/png"), placement });
      router.push(`/editor?source=lightened&handoff=${id}`);
    } catch { setMessage("사진을 전달하지 못했습니다. 다시 시도해 주세요."); }
  }

  return <main className="min-h-screen bg-[#f5f6f4] px-4 py-6 text-ink">
    <div className="mx-auto max-w-6xl">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-4 border-b border-cocoa/15 pb-4">
        <div className="flex items-center gap-3"><Link href="/" className="studio-icon-button" aria-label="홈으로"><ArrowLeft size={18} /></Link><h1 className="text-lg font-semibold">내 눈썹 연하게 하기</h1></div>
        <button className="studio-button studio-button-secondary" disabled={busy} onClick={() => picker.current?.click()}><Upload size={16} />사진 선택</button>
        <input ref={picker} type="file" accept="image/*" hidden onChange={e => { const file = e.target.files?.[0]; e.target.value = ""; if (file) void upload(file); }} />
      </header>
      <p className="mb-4 text-sm text-cocoa">실험 결과는 실제 피부와 다를 수 있습니다. 원본 사진은 변경되지 않습니다.</p>
      <p role="status" className="mb-4 min-h-5 text-sm">{message}</p>
      {!photo ? <div className="upload-surface"><Eraser size={36} className="mb-5 text-[#c94715]" /><button disabled={busy} className="studio-button studio-button-primary" onClick={() => picker.current?.click()}>{busy ? "사진 확인 중…" : "테스트 사진 선택"}</button></div> : <>
        <div className="grid gap-5 md:grid-cols-2">
          <figure><figcaption className="mb-2 text-sm font-semibold">{maskVisible ? "원본 · 적용 영역" : "원본"}</figcaption><canvas ref={original} className="aspect-[4/3] w-full rounded-lg bg-[#e5e8e2] object-contain" /></figure>
          <figure><figcaption className="mb-2 text-sm font-semibold">{result ? method === "repair" ? "피부 복원 결과 · 실험" : "명암 조정 결과" : "적용 전"}</figcaption><canvas ref={after} className="aspect-[4/3] w-full rounded-lg bg-[#e5e8e2] object-contain" /></figure>
        </div>
        <section className="mt-6 border-t border-cocoa/15 pt-5">
          <div className="mb-4 flex gap-2" role="group" aria-label="처리 방식">
            {([['repair', '피부 복원'], ['lighten', '기존 명암']] as const).map(([value, label]) => <button key={value} aria-pressed={method === value} className={`studio-button ${method === value ? 'studio-button-primary' : 'studio-button-secondary'}`} onClick={() => setMethod(value)}>{label}</button>)}
          </div>
          <div className="mb-5 flex flex-wrap items-center gap-3">
            <div className="flex gap-2" role="group" aria-label="적용 범위">{([['tail', '앞머리 남기기'], ['all', '전체 연하게']] as const).map(([mode, label]) => <button key={mode} aria-pressed={options.mode === mode} className={`studio-button ${options.mode === mode ? 'studio-button-primary' : 'studio-button-secondary'}`} onClick={() => change({ ...options, mode })}>{label}</button>)}</div>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={maskVisible} onChange={e => setMaskVisible(e.target.checked)} />적용 영역 표시</label>
          </div>
          <div className="grid gap-5 md:grid-cols-2">{([{ key: 'strength', label: '연하게 하는 강도', min: 0, max: 1 }, { key: 'padding', label: '적용 범위 여유', min: 0, max: .07 }] as const).map(s => <label key={s.key} className="text-sm"><span className="flex justify-between">{s.label}<span>{Math.round(options[s.key] * 100)}%</span></span><input className="mt-3 w-full accent-[#c94715]" type="range" min={s.min} max={s.max} step="0.005" value={options[s.key]} onChange={e => change({ ...options, [s.key]: Number(e.target.value) })} /></label>)}</div>
          <div className="mt-6 flex flex-wrap gap-3">
            <button disabled={!ready} className="studio-button studio-button-primary disabled:opacity-40" onClick={startDesign}><Eraser size={16} />눈썹 연하게 하고 새 디자인</button>
            <button className="studio-button studio-button-secondary" onClick={() => { setOptions({ ...LIGHTENING_DEFAULTS, strength: 0 }); setMessage("원본으로 복원했습니다."); }}><RotateCcw size={16} />원본 복원</button>
            <button disabled={!result || !ready} className="studio-button studio-button-secondary disabled:opacity-40" onClick={() => { if (after.current && result) downloadCanvasAsPng(after.current, "brow-removal-test.png"); }}><Download size={16} />테스트 이미지 저장</button>
          </div>
        </section>
      </>}
    </div>
  </main>;
}
