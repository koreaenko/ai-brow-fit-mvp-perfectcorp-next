"use client";

import BeforeAfterView from "@/components/BeforeAfterView";
import BrowCanvas, { type BrowCanvasHandle } from "@/components/BrowCanvas";
import BrowControlsPanel from "@/components/BrowControls";
import ImageUploader from "@/components/ImageUploader";
import { DEFAULT_CONTROLS, getBrowStyle } from "@/lib/browStyles";
import { detectFacePlacement } from "@/lib/faceLandmarks";
import { mirrorBrowPlacement } from "@/lib/browGeometry";
import type {
  BrowControls,
  BrowPlacement,
  BrowStyleId,
  DetectionResult,
} from "@/types/brow";
import { ArrowLeft, Download, Eye, Loader2 } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = src;
  });
}

export default function EditorShell() {
  const searchParams = useSearchParams();
  const preferCamera = searchParams.get("source") === "camera";
  const canvasRef = useRef<BrowCanvasHandle>(null);
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [resultSrc, setResultSrc] = useState<string | null>(null);
  const [placement, setPlacement] = useState<BrowPlacement | undefined>();
  const [selectedStyle, setSelectedStyle] = useState<BrowStyleId>("soft-semi-arch");
  const [controls, setControls] = useState<BrowControls>(DEFAULT_CONTROLS);
  const [compareMode, setCompareMode] = useState(false);
  const [fadedOnly, setFadedOnly] = useState(false);
  const [controlSheetOpen, setControlSheetOpen] = useState(true);
  const sheetDragStart = useRef<number | null>(null);
  const [detection, setDetection] = useState<DetectionResult>({
    status: "idle",
    message: "사진을 올리면 얼굴형 기반 자동 맞춤을 시작합니다.",
  });

  const runDetection = useCallback(async (src: string) => {
    setDetection({
      status: "loading",
      message: "얼굴 특징을 분석하고 눈썹 위치를 맞추는 중입니다.",
    });

    try {
      const image = await loadImage(src);
      const nextPlacement = await detectFacePlacement(image);
      setPlacement(nextPlacement);
      setDetection({
        status: "ready",
        message: "자동 맞춤이 완료되었습니다. 아래에서 편하게 보정해보세요.",
        placement: nextPlacement,
      });
    } catch {
      setPlacement(undefined);
      setDetection({
        status: "failed",
        message: "얼굴을 정면에 가깝게 올려주세요. 임시 위치로 수동 보정은 가능합니다.",
      });
    }
  }, []);

  const handleImageSelected = useCallback(
    (file: File) => {
      const nextSrc = URL.createObjectURL(file);
      setImageSrc((previous) => {
        if (previous?.startsWith("blob:")) {
          URL.revokeObjectURL(previous);
        }
        return nextSrc;
      });
      setResultSrc(null);
      setPlacement(undefined);
      setControls(DEFAULT_CONTROLS);
      setCompareMode(false);
      setFadedOnly(false);
      void runDetection(nextSrc);
    },
    [runDetection],
  );

  useEffect(() => {
    return () => {
      if (imageSrc?.startsWith("blob:")) {
        URL.revokeObjectURL(imageSrc);
      }
    };
  }, [imageSrc]);

  const handleRendered = useCallback((dataUrl: string) => {
    setResultSrc(dataUrl);
  }, []);

  const handleSave = () => {
    canvasRef.current?.saveResult();
  };

  const handleSaveStyle = () => {
    window.localStorage.setItem(
      "ai-brow-fit-saved-style",
      JSON.stringify({
        selectedStyle,
        controls,
        savedAt: new Date().toISOString(),
      }),
    );
    setDetection((current) => ({
      ...current,
      message: "현재 눈썹 스타일을 이 브라우저에 저장했습니다.",
    }));
  };

  const handleRecommend = () => {
    const recommended: BrowStyleId =
      placement && placement.eyeDistance > 260 ? "lifting-arch" : "soft-semi-arch";
    setSelectedStyle(recommended);
    setControls({
      ...DEFAULT_CONTROLS,
      arch: recommended === "lifting-arch" ? 0.08 : 0,
      intensity: 0.74,
      definition: 0.72,
    });
    setCompareMode(false);
    setFadedOnly(false);
    setDetection((current) => ({
      ...current,
      message: "가장 무난하게 어울리는 상담용 스타일을 적용했습니다.",
    }));
  };

  const handleSymmetry = () => {
    setPlacement((current) => (current ? mirrorBrowPlacement(current) : current));
  };

  const handleRefit = () => {
    if (imageSrc) {
      void runDetection(imageSrc);
    }
  };

  const activeStyle = getBrowStyle(selectedStyle);

  return (
    <main className="min-h-dvh px-4 py-4 text-ink">
      <div className="mx-auto max-w-md space-y-4 pb-[calc(72dvh+32px)] lg:max-w-7xl lg:pb-8">
        <header className="sticky top-0 z-20 -mx-4 border-b border-cocoa/10 bg-cream/88 px-4 py-3 backdrop-blur">
          <div className="mx-auto flex max-w-6xl items-center justify-between gap-3">
            <Link
              href="/"
              className="flex h-10 w-10 items-center justify-center rounded-2xl border border-cocoa/12 bg-white/70 text-cocoa"
              aria-label="홈으로 돌아가기"
            >
              <ArrowLeft className="h-5 w-5" aria-hidden="true" />
            </Link>
            <div className="min-w-0 text-center">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cocoa/54">
                AI Brow Fit
              </p>
              <h1 className="truncate text-lg font-semibold">눈썹 맞춤 편집</h1>
            </div>
            <button
              type="button"
              onClick={handleSave}
              disabled={!imageSrc}
              className="flex h-10 w-10 items-center justify-center rounded-2xl bg-cocoa text-white disabled:cursor-not-allowed disabled:bg-cocoa/30"
              aria-label="결과 저장"
            >
              <Download className="h-5 w-5" aria-hidden="true" />
            </button>
          </div>
        </header>

        {!imageSrc ? (
          <ImageUploader preferCamera={preferCamera} onImageSelected={handleImageSelected} />
        ) : (
          <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_440px] lg:items-start">
            <section className="space-y-3">
              <BrowCanvas
                ref={canvasRef}
                imageSrc={imageSrc}
                placement={placement}
                controls={controls}
                style={activeStyle}
                compareMode={compareMode}
                fadedOnly={fadedOnly}
                onRendered={handleRendered}
              />

              <div className="rounded-[20px] border border-cocoa/10 bg-white/82 p-4 shadow-soft">
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-blush/45 text-cocoa">
                    {detection.status === "loading" ? (
                      <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                    ) : (
                      <Eye className="h-4 w-4" aria-hidden="true" />
                    )}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-ink">
                      {detection.status === "ready"
                        ? "자동 맞춤 완료"
                        : detection.status === "failed"
                          ? "자동 감지 안내"
                          : detection.status === "loading"
                            ? "분석 중"
                            : "사진 대기"}
                    </p>
                    <p className="mt-1 text-sm leading-5 text-cocoa/62">{detection.message}</p>
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setImageSrc(null);
                      setResultSrc(null);
                      setPlacement(undefined);
                      setCompareMode(false);
                      setFadedOnly(false);
                      setDetection({
                        status: "idle",
                        message: "사진을 올리면 얼굴형 기반 자동 맞춤을 시작합니다.",
                      });
                    }}
                    className="flex h-12 items-center justify-center rounded-2xl bg-cocoa text-sm font-semibold text-white transition active:scale-[0.98]"
                  >
                    사진 바꾸기
                  </button>
                  <button
                    type="button"
                    onClick={handleSave}
                    className="flex h-12 items-center justify-center rounded-2xl bg-[#d7b98f] text-sm font-semibold text-ink transition active:scale-[0.98]"
                  >
                    상담용 이미지 저장
                  </button>
                </div>
              </div>

              <BeforeAfterView
                originalSrc={imageSrc}
                resultSrc={resultSrc}
                onSave={handleSave}
              />
            </section>

            <div
              onPointerDown={(event) => {
                sheetDragStart.current = event.clientY;
              }}
              onPointerUp={(event) => {
                if (sheetDragStart.current === null) {
                  return;
                }

                const delta = event.clientY - sheetDragStart.current;
                if (delta > 48) {
                  setControlSheetOpen(false);
                }
                if (delta < -48) {
                  setControlSheetOpen(true);
                }
                sheetDragStart.current = null;
              }}
              className={`fixed inset-x-0 bottom-0 z-30 max-h-[72dvh] overflow-y-auto px-3 pb-3 transition-transform duration-300 lg:static lg:max-h-none lg:translate-y-0 lg:overflow-visible lg:px-0 lg:pb-0 ${
                controlSheetOpen ? "translate-y-0" : "translate-y-[calc(100%-88px)]"
              }`}
            >
              <BrowControlsPanel
                controls={controls}
                selectedStyle={selectedStyle}
                compareMode={compareMode}
                fadedOnly={fadedOnly}
                onControlsChange={setControls}
                onStyleChange={(styleId) => {
                  setSelectedStyle(styleId);
                  setFadedOnly(false);
                }}
                onSymmetry={handleSymmetry}
                onRefit={handleRefit}
                onCompareToggle={() => {
                  setCompareMode((current) => !current);
                  setFadedOnly(false);
                }}
                onFadedOnlyToggle={() => {
                  setFadedOnly((current) => !current);
                  setCompareMode(false);
                }}
                onRecommend={handleRecommend}
                onSaveStyle={handleSaveStyle}
                onSaveImage={handleSave}
              />
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
