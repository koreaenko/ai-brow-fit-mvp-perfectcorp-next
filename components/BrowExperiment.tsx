"use client";

import Link from "next/link";
import NextImage from "next/image";
import { ArrowLeft, Download, RotateCcw, Upload } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { detectFacePlacement } from "@/lib/faceLandmarks";
import { prepareImageForEditing } from "@/lib/imageProcessing";
import { BROW_STYLES, DEFAULT_CONTROLS } from "@/lib/browStyles";
import { NEUTRAL_WARP, browDisplacement, warpBrowPixels, type WarpControls } from "@/lib/browWarp";
import { drawNaturalBrow } from "@/lib/naturalBrow";
import { prepareStrokeWidth } from "@/lib/browStrokeWidth";
import { drawApplied } from "@/components/BrowCanvas";
import { downloadCanvasAsPng } from "@/lib/exportImage";
import type { BrowAnchor, BrowPlacement, Point } from "@/types/brow";

type Photo = { image: HTMLImageElement; pixels: ImageData; placement: BrowPlacement };
const load = (src: string) => new Promise<HTMLImageElement>((resolve, reject) => {
  const image = new Image(); image.onload = () => resolve(image); image.onerror = reject; image.src = src;
});
async function previewPhoto(photo: Photo): Promise<Photo> {
  const scale = Math.min(1, 640 / photo.pixels.width);
  if (scale === 1) return photo;
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(photo.pixels.width * scale);
  canvas.height = Math.round(photo.pixels.height * scale);
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(photo.image, 0, 0, canvas.width, canvas.height);
  const point = (p: Point): Point => ({ x: p.x * scale, y: p.y * scale });
  const brow = (b: BrowAnchor): BrowAnchor => ({ start: point(b.start), arch: point(b.arch), tail: point(b.tail), contour: b.contour?.map(point) });
  return { image: await load(canvas.toDataURL()), pixels: ctx.getImageData(0, 0, canvas.width, canvas.height),
    placement: { ...photo.placement, left: brow(photo.placement.left), right: brow(photo.placement.right), eyeDistance: photo.placement.eyeDistance * scale,
      guides: photo.placement.guides ? Object.fromEntries(Object.entries(photo.placement.guides).map(([key, value]) => [key, point(value)])) as BrowPlacement["guides"] : undefined } };
}
const sliders: { key: keyof WarpControls; label: string }[] = [
  { key: "arch", label: "아치" }, { key: "thickness", label: "눈썹 전체 두께" }, { key: "length", label: "길이" },
];
const EXPERIMENT_STYLES = BROW_STYLES;

export default function BrowExperiment() {
  const [photo, setPhoto] = useState<Photo | null>(null);
  const [preview, setPreview] = useState<Photo | null>(null);
  const [interacting, setInteracting] = useState(false);
  const [renderedKey, setRenderedKey] = useState("");
  const settleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [controls, setControls] = useState<WarpControls>(NEUTRAL_WARP);
  const [styleIndex, setStyleIndex] = useState(EXPERIMENT_STYLES.findIndex(style => style.id === "airy-hair"));
  const [fillAmount, setFillAmount] = useState(0);
  const [strokeWidth, setStrokeWidth] = useState(0);
  const renderKey = JSON.stringify([controls, styleIndex, fillAmount, strokeWidth]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [zoom, setZoom] = useState(false);
  const original = useRef<HTMLCanvasElement>(null);
  const layer = useRef<HTMLCanvasElement>(null);
  const warped = useRef<HTMLCanvasElement>(null);
  const picker = useRef<HTMLInputElement>(null);
  const sequence = useRef(0);
  const warpCache = useRef<{ photo: Photo; controls: WarpControls; pixels: ImageData } | null>(null);
  const layerCache = useRef<{ photo: Photo; controls: WarpControls; template: HTMLImageElement } | null>(null);
  const templateCache = useRef(new Map<string, Promise<HTMLImageElement>>());
  useEffect(() => () => { sequence.current++; if (settleTimer.current) clearTimeout(settleTimer.current); }, []);
  function startPreview() {
    setInteracting(true);
    if (settleTimer.current) clearTimeout(settleTimer.current);
    settleTimer.current = setTimeout(() => setInteracting(false), 180);
  }

  async function upload(file: File) {
    const id = ++sequence.current;
    setBusy(true); setError(""); setPhoto(null); setPreview(null); setRenderedKey(""); setControls(NEUTRAL_WARP); setFillAmount(0); setStrokeWidth(0);
    let src: string | undefined;
    try {
      const prepared = await prepareImageForEditing(file); src = prepared.src;
      const image = await load(src);
      const placement = await detectFacePlacement(image);
      const canvas = document.createElement("canvas");
      canvas.width = image.naturalWidth; canvas.height = image.naturalHeight;
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      if (!ctx) throw Error("canvas");
      ctx.drawImage(image, 0, 0);
      const full = { image, placement, pixels: ctx.getImageData(0, 0, canvas.width, canvas.height) };
      const small = await previewPhoto(full);
      if (id === sequence.current) { setPhoto(full); setPreview(small); }
    } catch {
      if (id === sequence.current) setError("얼굴을 확인하지 못했습니다. 다른 정면 사진으로 다시 시도해 주세요.");
    } finally {
      if (src?.startsWith("blob:")) URL.revokeObjectURL(src);
      if (id === sequence.current) setBusy(false);
    }
  }

  useEffect(() => {
    if (!photo) return;
    const fullPhoto = photo;
    const activePhoto = interacting && preview ? preview : photo;
    let cancelled = false;
    let frame = 0;
    const render = async () => {
    const photo = activePhoto;
    const src = EXPERIMENT_STYLES[styleIndex].imageSrc;
    let source = templateCache.current.get(src);
    if (!source) {
      source = load(src);
      templateCache.current.set(src, source);
      source.catch(() => templateCache.current.delete(src));
    }
    let template: HTMLImageElement;
    try {
      const image = await source;
      if (cancelled) return;
      template = await prepareStrokeWidth(image, strokeWidth, interacting ? 512 : undefined);
    } catch { if (!cancelled) setError("털결 이미지를 불러오지 못했습니다. 다시 시도해 주세요."); return; }
    if (cancelled || !layer.current) return;
    if (warpCache.current?.photo !== photo || warpCache.current.controls !== controls) {
      const result = warpBrowPixels(photo.pixels.data, photo.pixels.width, photo.pixels.height, photo.placement, controls);
      warpCache.current = { photo, controls, pixels: new ImageData(new Uint8ClampedArray(result), photo.pixels.width, photo.pixels.height) };
    }
    const result = warpCache.current.pixels;
    const drawBase = () => {
      for (const canvas of [warped.current]) {
        if (canvas && (canvas.width !== photo.pixels.width || canvas.height !== photo.pixels.height)) { canvas.width = photo.pixels.width; canvas.height = photo.pixels.height; }
      }
      if (original.current && original.current.dataset.photo !== String(sequence.current)) {
        original.current.width = fullPhoto.pixels.width; original.current.height = fullPhoto.pixels.height;
        original.current.getContext("2d")?.putImageData(fullPhoto.pixels, 0, 0);
        original.current.dataset.photo = String(sequence.current);
      }
      warped.current?.getContext("2d")?.putImageData(result, 0, 0);
    };
      drawBase();
      if (layerCache.current?.photo !== photo || layerCache.current.controls !== controls || layerCache.current.template !== template) {
      layer.current.width = photo.pixels.width; layer.current.height = photo.pixels.height;
      const ctx = layer.current.getContext("2d");
      if (ctx) drawApplied(ctx, photo.image, photo.placement,
        { ...DEFAULT_CONTROLS, renderMode: "simulation", ...controls }, EXPERIMENT_STYLES[styleIndex], template);
      layerCache.current = { photo, controls, template };
      }
      const output = warped.current?.getContext("2d");
      if (output && fillAmount > 0) {
        for (const brow of [photo.placement.left, photo.placement.right]) {
          const move = (point: Point): Point => {
            const delta = browDisplacement(point, brow, photo.placement.eyeDistance, controls);
            return { x: point.x + delta.x, y: point.y + delta.y };
          };
          const moved: BrowAnchor = { start: move(brow.start), arch: move(brow.arch), tail: move(brow.tail), contour: brow.contour?.map(move) };
          drawNaturalBrow(output, moved, moved, template, photo.placement.eyeDistance,
            { ...DEFAULT_CONTROLS, thickness: 0, intensity: fillAmount }, true);
        }
      }
      if (!interacting) setRenderedKey(renderKey);
    };
    frame = requestAnimationFrame(() => { void render(); });
    return () => { cancelled = true; cancelAnimationFrame(frame); };
  }, [photo, preview, interacting, controls, styleIndex, fillAmount, strokeWidth, renderKey]);

  const points = photo ? [photo.placement.left.start, photo.placement.right.start, photo.placement.left.tail, photo.placement.right.tail] : [];
  const centerY = points.length ? points.reduce((n, p) => n + p.y, 0) / points.length / photo!.pixels.height * 100 : 50;
  const centerX = points.length ? points.reduce((n, p) => n + p.x, 0) / points.length / photo!.pixels.width * 100 : 50;
  const focusScale = photo ? Math.min(2, photo.pixels.width / (Math.max(...points.map(p => p.x)) - Math.min(...points.map(p => p.x)) + photo.placement.eyeDistance * 0.6)) : 1;
  return <main className="min-h-screen bg-neutral-100 p-4 text-neutral-900 md:p-8">
    <header className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 border-b border-neutral-300 pb-4">
      <div className="flex items-center gap-3"><Link href="/editor?source=photo" title="기존 편집기" aria-label="기존 편집기"><ArrowLeft size={20} /></Link><h1 className="text-xl font-semibold">눈썹 비교 실험</h1><span className="text-xs text-neutral-500">실험 버전</span></div>
      <button type="button" onClick={() => picker.current?.click()} className="flex items-center gap-2 rounded-md bg-neutral-900 px-4 py-2 text-white"><Upload size={16} />사진 선택</button>
      <input ref={picker} type="file" accept="image/*" className="hidden" onChange={e => { const file = e.target.files?.[0]; if (file) void upload(file); e.target.value = ""; }} />
    </header>
    {busy && <p role="status" className="mx-auto mt-5 max-w-7xl">얼굴 분석 중…</p>}
    {error && <p role="alert" className="mx-auto mt-5 max-w-7xl text-red-700">{error}</p>}
    <section className="mx-auto mt-5 grid max-w-7xl gap-4 md:grid-cols-3">
      {([{ title: "원본", ref: original }, { title: "A · 기존 레이어", ref: layer }, { title: "B · 원본 변형", ref: warped }]).map(item => <figure key={item.title}>
        <figcaption className="mb-2 text-sm font-semibold">{item.title}</figcaption>
        <div className="relative aspect-[4/3] overflow-hidden bg-neutral-200">
          {!photo && <div className="absolute inset-0 grid place-items-center text-sm text-neutral-500">사진 없음</div>}
          <canvas ref={item.ref} aria-label={item.title} className={`h-full w-full object-contain ${photo ? "" : "invisible"}`} style={{ transform: zoom ? `scale(${Math.max(1, focusScale)})` : undefined, transformOrigin: `${centerX}% ${centerY}%` }} />
        </div>
      </figure>)}
    </section>
    <section onInputCapture={e => { if ((e.target as HTMLInputElement).type === "range") startPreview(); }} className="mx-auto mt-6 max-w-7xl border-t border-neutral-300 pt-4">
      <div className="mb-5 flex flex-wrap items-center gap-5">
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={zoom} onChange={e => setZoom(e.target.checked)} />눈썹 확대</label>
        <label className="text-sm">디자인 <select className="ml-2 max-w-full rounded border border-neutral-300 bg-white p-2" value={styleIndex} onChange={e => setStyleIndex(Number(e.target.value))}>{EXPERIMENT_STYLES.map((style, index) => <option key={style.imageSrc} value={index}>{style.name}</option>)}</select></label>
        <NextImage src={EXPERIMENT_STYLES[styleIndex].imageSrc} alt="선택한 눈썹 털결" width={160} height={80} unoptimized className="h-20 w-40 object-contain bg-white" />
        <button type="button" title="변형 초기화" aria-label="변형 초기화" onClick={() => { setControls(NEUTRAL_WARP); setFillAmount(0); setStrokeWidth(0); }}><RotateCcw size={18} /></button>
        <button type="button" disabled={!photo || busy || interacting || renderedKey !== renderKey} className="flex items-center gap-2 text-sm disabled:opacity-40" onClick={() => { if (warped.current) downloadCanvasAsPng(warped.current, "brow-original-warp.png"); }}><Download size={18} />B 결과 저장</button>
      </div>
      <div className="grid gap-5 md:grid-cols-3">{sliders.map(({ key, label }) => <label key={key} className="text-sm"><span className="flex justify-between">{label}<output>{Math.round(controls[key] * 100)}%</output></span><input className="mt-3 w-full accent-emerald-700" type="range" min="-1" max="1" step="0.05" disabled={!photo || busy} value={controls[key]} onChange={e => setControls(previous => ({ ...previous, [key]: Number(e.target.value) }))} /></label>)}</div>
      <label className="mt-6 block max-w-md text-sm"><span className="flex justify-between">B · 빈 곳 보충량<output>{Math.round(fillAmount * 100)}%</output></span><input aria-label="빈 곳 보충량" className="mt-3 w-full" type="range" min="0" max="1" step="0.05" disabled={!photo || busy} value={fillAmount} onChange={e => setFillAmount(Number(e.target.value))} /></label>
      <label className="mt-6 block max-w-md text-sm"><span className="flex justify-between">털 한 올 굵기 · A/B<output>+{Math.round(strokeWidth * 100)}%</output></span><input aria-label="털 한 올 굵기" className="mt-3 w-full" type="range" min="0" max="1" step="0.05" disabled={!photo || busy} value={strokeWidth} onChange={e => setStrokeWidth(Number(e.target.value))} /></label>
    </section>
  </main>;
}
