"use client";
import { BROW_REMOVAL_ENABLED } from "@/lib/features";

import BeforeAfterView from "@/components/BeforeAfterView";
import BrowCanvas, { type BrowCanvasHandle } from "@/components/BrowCanvas";
import BrowControlsPanel from "@/components/BrowControls";
import ImageUploader from "@/components/ImageUploader";
import { DEFAULT_CONTROLS, getBrowStyle } from "@/lib/browStyles";
import { detectFacePlacement } from "@/lib/faceLandmarks";
import { readBrowDesign } from "@/lib/browDesignHandoff";
import { lightenBrowPixels, LIGHTENING_DEFAULTS } from "@/lib/browLightening";
import { mirrorBrowPlacement } from "@/lib/browGeometry";
import {
  prepareCustomBrowTexture,
  prepareFaceFocusedImage,
  prepareImageForEditing,
} from "@/lib/imageProcessing";
import type {
  BrowControls,
  BrowDesignMode,
  BrowPlacement,
  BrowSide,
  BrowStyleId,
  CustomBrowSideTransform,
  CustomBrowTransform,
  DetectionResult,
  SavedCustomBrow,
  SelectedBrowSide,
} from "@/types/brow";
import { ArrowLeft, Download, Loader2, ImagePlus, Check, SlidersHorizontal, ChevronDown } from "lucide-react";
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

const DEFAULT_CUSTOM_SIDE_TRANSFORM: CustomBrowSideTransform = {
  offsetX: 0,
  offsetY: 0,
  scaleX: 1,
  scaleY: 1,
  rotation: 0,
  darkness: 0.35,
  clarity: 0.25,
};

const DEFAULT_CUSTOM_TRANSFORM: CustomBrowTransform = {
  left: { ...DEFAULT_CUSTOM_SIDE_TRANSFORM },
  right: { ...DEFAULT_CUSTOM_SIDE_TRANSFORM },
};
const SAVED_CUSTOM_BROWS_KEY = "ai-brow-fit-custom-brows";

function readSavedCustomBrows(): SavedCustomBrow[] {
  if (typeof window === "undefined") {
    return [];
  }

  try {
    const raw = window.localStorage.getItem(SAVED_CUSTOM_BROWS_KEY);
    const parsed = raw ? JSON.parse(raw) : [];

    return Array.isArray(parsed)
      ? parsed.filter(
          (item): item is SavedCustomBrow =>
            typeof item?.id === "string" &&
            typeof item?.name === "string" &&
            typeof item?.src === "string" &&
            typeof item?.savedAt === "string",
        )
      : [];
  } catch {
    return [];
  }
}

function writeSavedCustomBrows(items: SavedCustomBrow[]) {
  window.localStorage.setItem(SAVED_CUSTOM_BROWS_KEY, JSON.stringify(items));
}

async function urlToDataUrl(src: string): Promise<string> {
  const response = await fetch(src);
  const blob = await response.blob();

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

export default function EditorShell() {
  const searchParams = useSearchParams();
  const preferCamera = searchParams.get("source") === "camera";
  const canvasRef = useRef<BrowCanvasHandle>(null);
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [beforeLightening, setBeforeLightening] = useState<string | null>(null);
  const [lighteningOpen, setLighteningOpen] = useState(false);
  const [lighteningAmount, setLighteningAmount] = useState(0);
  const lighteningBase = useRef<{ src: string; pixels: ImageData } | null>(null);
  const handoffId = BROW_REMOVAL_ENABLED ? searchParams.get("handoff") : null;
  const loadedHandoff = useRef<string | null>(null);
  const [resultSrc, setResultSrc] = useState<string | null>(null);
  const [placement, setPlacement] = useState<BrowPlacement | undefined>();
  const [selectedStyle, setSelectedStyle] = useState<BrowStyleId>("natural-arch");
  const [designMode, setDesignMode] = useState<BrowDesignMode>("auto");
  const [customBrowSrc, setCustomBrowSrc] = useState<string | null>(null);
  const [savedCustomBrows, setSavedCustomBrows] =
    useState<SavedCustomBrow[]>(() => readSavedCustomBrows());
  const [selectedCustomSide, setSelectedCustomSide] = useState<SelectedBrowSide>(null);
  const [customTransform, setCustomTransform] =
    useState<CustomBrowTransform>(DEFAULT_CUSTOM_TRANSFORM);
  const [controls, setControls] = useState<BrowControls>(DEFAULT_CONTROLS);
  const [compareMode, setCompareMode] = useState(false);
  const [fadedOnly, setFadedOnly] = useState(false);
  const [guideMode, setGuideMode] = useState(false);
  const [imageInfo, setImageInfo] = useState<string | null>(null);
  const [controlSheetOpen, setControlSheetOpen] = useState(false);
  const sheetDragStart = useRef<number | null>(null);
  const [detection, setDetection] = useState<DetectionResult>({
    status: "idle",
    message: "사진을 올리면 얼굴형 기반 자동 맞춤을 시작합니다.",
  });
  async function startLightening() {
    if (!BROW_REMOVAL_ENABLED) return;
    if (lighteningOpen) { setLighteningOpen(false); return; }
    if (!imageSrc || !placement) return;
    try {
      const original = beforeLightening ?? await urlToDataUrl(imageSrc);
      setBeforeLightening(original);
      setLighteningOpen(true);
    } catch { setDetection(current => ({ ...current, message: "사진 전달에 실패했습니다. 다시 시도해 주세요." })); }
  }
  useEffect(() => {
    if (!BROW_REMOVAL_ENABLED || !beforeLightening || !placement || !lighteningOpen) return;
    let cancelled = false;
    const frame = requestAnimationFrame(() => { void (async () => {
      try {
        if (lighteningBase.current?.src !== beforeLightening) {
          const image = await loadImage(beforeLightening);
          if (cancelled) return;
          const canvas = document.createElement("canvas"); canvas.width = image.naturalWidth; canvas.height = image.naturalHeight;
          const ctx = canvas.getContext("2d")!; ctx.drawImage(image, 0, 0);
          lighteningBase.current = { src: beforeLightening, pixels: ctx.getImageData(0, 0, canvas.width, canvas.height) };
        }
        const { pixels } = lighteningBase.current;
        const canvas = document.createElement("canvas"); canvas.width = pixels.width; canvas.height = pixels.height;
        canvas.getContext("2d")!.putImageData(new ImageData(lightenBrowPixels(pixels.data, pixels.width, pixels.height, placement, { ...LIGHTENING_DEFAULTS, strength: lighteningAmount }), pixels.width, pixels.height), 0, 0);
        if (!cancelled) { setImageSrc(lighteningAmount === 0 ? beforeLightening : canvas.toDataURL("image/png")); setResultSrc(null); }
      } catch { if (!cancelled) setDetection(current => ({ ...current, message: "눈썹 명암 조정에 실패했습니다." })); }
    })(); });
    return () => { cancelled = true; cancelAnimationFrame(frame); };
  }, [beforeLightening, placement, lighteningAmount, lighteningOpen]);

  useEffect(() => {
    if (!handoffId || loadedHandoff.current === handoffId) return;
    const frame = requestAnimationFrame(() => {
    loadedHandoff.current = handoffId;
    const data = readBrowDesign(handoffId);
    if (!data) {
      setDetection({ status: "failed", message: "임시 사진이 만료되었습니다. 테스트 페이지에서 다시 새 디자인을 시작해 주세요." });
      return;
    }
    setImageSrc(data.softened);
    setBeforeLightening(data.original);
    setPlacement(data.placement);
    setDesignMode("virtual");
    setControls({ ...DEFAULT_CONTROLS, renderMode: "virtual" });
    setDetection({ status: "ready", message: "눈썹 명암 조정 결과를 불러왔습니다.", placement: data.placement });
    });
    return () => cancelAnimationFrame(frame);
  }, [handoffId]);

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
    async (file: File) => {
      setBeforeLightening(null);
      setLighteningOpen(false);
      setLighteningAmount(0);
      lighteningBase.current = null;
      setDetection({
        status: "loading",
        message: "사진을 먼저 화면에 표시하고 있습니다.",
      });

      try {
        const prepared = await prepareImageForEditing(file);

        setImageSrc((previous) => {
          if (previous?.startsWith("blob:")) {
            URL.revokeObjectURL(previous);
          }
          return prepared.src;
        });
        setImageInfo(
          `사진 표시 완료. 분석용 ${prepared.width}x${prepared.height}px`,
        );
        setResultSrc(null);
        setPlacement(undefined);
        setControls(DEFAULT_CONTROLS);
        setCompareMode(false);
        setFadedOnly(false);
        setGuideMode(false);
        setControlSheetOpen(false);
        setDetection({
          status: "loading",
          message: "사진은 표시되었습니다. 얼굴과 눈썹 위치를 분석하는 중입니다.",
        });

        await new Promise((resolve) => window.requestAnimationFrame(resolve));

        const detectionImage = await loadImage(prepared.src);
        const detectedPlacement = await detectFacePlacement(detectionImage);
        const focused = await prepareFaceFocusedImage(
          prepared.src,
          detectedPlacement,
          prepared.originalWidth,
          prepared.originalHeight,
        );

        if (focused.src !== prepared.src && prepared.src.startsWith("blob:")) {
          URL.revokeObjectURL(prepared.src);
        }

        setImageSrc((previous) => {
          if (previous?.startsWith("blob:")) {
            URL.revokeObjectURL(previous);
          }
          return focused.src;
        });
        setImageInfo(
          `얼굴 영역을 자동으로 맞췄습니다. 편집용 ${focused.width}x${focused.height}px`,
        );
        setResultSrc(null);
        setPlacement(focused.placement);
        setControls(DEFAULT_CONTROLS);
        setCompareMode(false);
        setFadedOnly(false);
        setGuideMode(false);
        setControlSheetOpen(false);
        setDetection({
          status: "ready",
          message: "얼굴 영역을 자동으로 맞추고 눈썹 위치를 설정했습니다.",
          placement: focused.placement,
        });
      } catch {
        setDetection({
          status: "failed",
          message: "사진은 표시했지만 얼굴 자동 맞춤에 실패했습니다. 정면 사진이면 더 정확합니다.",
        });
      }
    },
    [],
  );

  useEffect(() => {
    return () => {
      if (imageSrc?.startsWith("blob:")) {
        URL.revokeObjectURL(imageSrc);
      }
    };
  }, [imageSrc]);

  useEffect(() => {
    return () => {
      if (customBrowSrc?.startsWith("blob:")) {
        URL.revokeObjectURL(customBrowSrc);
      }
    };
  }, [customBrowSrc]);

  const handleSave = () => {
    const nextResult = canvasRef.current?.saveResult();

    if (nextResult) {
      setResultSrc(nextResult);
    }
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
      placement && placement.eyeDistance > 260 ? "soft-arch" : "natural-arch";
    setSelectedStyle(recommended);
    setControls({
      ...DEFAULT_CONTROLS,
      arch: recommended === "soft-arch" ? 0.08 : 0,
      intensity: 0.74,
      definition: 0.72,
    });
    setCompareMode(false);
    setFadedOnly(false);
    setGuideMode(false);
    setDetection((current) => ({
      ...current,
      message: "가장 무난하게 어울리는 상담용 스타일을 적용했습니다.",
    }));
  };

  const handleCustomImageSelected = async (file: File) => {
    setDetection((current) => ({
      ...current,
      status: current.status === "idle" ? "loading" : current.status,
      message: "커스텀 눈썹의 배경을 정리하고 털결을 선명하게 준비하는 중입니다.",
    }));

    try {
      const prepared = await prepareCustomBrowTexture(file);
      const persistentSrc = await urlToDataUrl(prepared.src);
      const shouldSave = window.confirm("삽입한 커스텀 눈썹을 나의 눈썹 리스트에 저장하시겠어요?");

      if (shouldSave) {
        const name =
          window.prompt("저장할 눈썹 이름을 입력해 주세요.", file.name.replace(/\.[^.]+$/, ""))?.trim() ||
          `커스텀 눈썹 ${savedCustomBrows.length + 1}`;
        const nextItem: SavedCustomBrow = {
          id: `custom-${Date.now()}`,
          name,
          src: persistentSrc,
          savedAt: new Date().toISOString(),
        };
        const nextItems = [nextItem, ...savedCustomBrows].slice(0, 24);
        setSavedCustomBrows(nextItems);
        writeSavedCustomBrows(nextItems);
      }

      setCustomBrowSrc((previous) => {
        if (previous?.startsWith("blob:")) {
          URL.revokeObjectURL(previous);
        }
        return shouldSave ? persistentSrc : prepared.src;
      });
      setDesignMode("custom");
      setSelectedCustomSide(null);
      setCustomTransform({
        left: { ...DEFAULT_CUSTOM_SIDE_TRANSFORM },
        right: { ...DEFAULT_CUSTOM_SIDE_TRANSFORM },
      });
      setCompareMode(false);
      setFadedOnly(false);
      setDetection((current) => ({
        ...current,
        status: current.status === "loading" ? "ready" : current.status,
        message: shouldSave
          ? "나의 눈썹 리스트에 저장했습니다. 다음에도 리스트에서 바로 불러올 수 있습니다."
          : "저장하지 않은 커스텀 눈썹은 이번 사용 후 삭제됩니다.",
      }));
    } catch {
      setDetection((current) => ({
        ...current,
        status: current.status === "loading" ? "failed" : current.status,
        message: "커스텀 눈썹 이미지를 준비하지 못했습니다. 다른 PNG 또는 JPG를 올려주세요.",
      }));
    }
  };

  const handleSavedCustomBrowSelect = (item: SavedCustomBrow) => {
    setCustomBrowSrc((previous) => {
      if (previous?.startsWith("blob:")) {
        URL.revokeObjectURL(previous);
      }
      return item.src;
    });
    setDesignMode("custom");
    setSelectedCustomSide(null);
    setCustomTransform({
      left: { ...DEFAULT_CUSTOM_SIDE_TRANSFORM },
      right: { ...DEFAULT_CUSTOM_SIDE_TRANSFORM },
    });
    setCompareMode(false);
    setFadedOnly(false);
    setDetection((current) => ({
      ...current,
      message: `${item.name} 커스텀 눈썹을 불러왔습니다.`,
    }));
  };

  const handleSavedCustomBrowDelete = (id: string) => {
    const nextItems = savedCustomBrows.filter((item) => item.id !== id);
    setSavedCustomBrows(nextItems);
    writeSavedCustomBrows(nextItems);
    setDetection((current) => ({
      ...current,
      message: "나의 눈썹 리스트에서 삭제했습니다.",
    }));
  };

  const handleCustomTransformChange = (
    side: BrowSide,
    transform: CustomBrowSideTransform,
  ) => {
    setCustomTransform((current) => ({
      ...current,
      [side]: transform,
    }));
  };

  const handleCustomSideChange = (side: BrowSide) => {
    setSelectedCustomSide((current) => (current === side ? null : side));
  };

  const handleSymmetry = () => {
    setPlacement((current) => (current ? mirrorBrowPlacement(current) : current));
  };

  const handleRefit = () => {
    if (imageSrc) {
      void runDetection(imageSrc);
    }
  };

  const handleResetAdjustments = () => {
    setControls({ ...DEFAULT_CONTROLS, color: controls.color, renderMode: designMode === "virtual" ? "virtual" : "original-warp" });
    setCustomTransform({ left: { ...DEFAULT_CUSTOM_SIDE_TRANSFORM }, right: { ...DEFAULT_CUSTOM_SIDE_TRANSFORM } });
    setSelectedCustomSide(null);
    setResultSrc(null);
    setCompareMode(false);
    setFadedOnly(false);
    setDetection(current => ({ ...current, message: "조정값을 초기화했습니다." }));
  };

  const activeStyle = getBrowStyle(selectedStyle);

  return (
    <main className="studio-editor text-ink">
      <div className="studio-container">
        <header className="studio-header">
          <div className="flex items-center justify-between gap-3">
            <Link
              href="/"
              className="studio-icon-button"
              title="홈으로 돌아가기"
              aria-label="홈으로 돌아가기"
            >
              <ArrowLeft className="h-5 w-5" aria-hidden="true" />
            </Link>
            <div className="min-w-0 flex-1">
              <p className="studio-brand">AI Brow Fit<span className="brand-dot" /></p>
              <h1 className="text-xs text-neutral-500">눈썹 맞춤 편집</h1>
            </div>
            <button
              type="button"
              onClick={handleSave}
              disabled={!imageSrc}
              className="studio-button studio-button-primary"
              aria-label="결과 저장"
            >
              <Download className="h-5 w-5" aria-hidden="true" />
              <span>저장</span>
            </button>
          </div>
        </header>

        {handoffId && !imageSrc && <p role="status" className="mb-4 text-sm">{detection.message} <Link href="/removal-test" className="underline">눈썹 명암 테스트로 돌아가기</Link></p>}
        {beforeLightening && <div className="mb-4 flex flex-wrap gap-3">
          <button onClick={startLightening} className="studio-button studio-button-secondary">눈썹 명암 다시 조정</button>
          <a href={beforeLightening} download="brow-original.png" className="studio-button studio-button-secondary"><Download size={16} />보정 전 원본 저장</a>
        </div>}

        {!imageSrc ? (
          <ImageUploader preferCamera={preferCamera} onImageSelected={handleImageSelected} />
        ) : (
          <div className="studio-workspace">
            <section className="studio-photo-column">
              <BrowCanvas
                ref={canvasRef}
                imageSrc={imageSrc}
                placement={placement}
                controls={controls}
                style={activeStyle}
                compareMode={compareMode}
                fadedOnly={fadedOnly}
                showGuides={guideMode}
                designMode={designMode}
                customBrowSrc={customBrowSrc}
                customTransform={customTransform}
                selectedCustomSide={selectedCustomSide}
                onCustomSideSelect={setSelectedCustomSide}
                onCustomTransformChange={handleCustomTransformChange}
              />

              <div className="studio-photo-status">
                <div className="flex items-start gap-3">
                  <div className="studio-status-icon">
                    {detection.status === "loading" ? (
                      <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                    ) : (
                      <Check className="h-4 w-4" aria-hidden="true" />
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
                    <p role="status" className="mt-1 text-xs leading-5 text-cocoa/70">{detection.message}</p>
                    {imageInfo ? (
                      <p className="mt-1 text-xs leading-4 text-cocoa/45">{imageInfo}</p>
                    ) : null}
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setImageSrc(null);
                      setResultSrc(null);
                      setPlacement(undefined);
                      setImageInfo(null);
                      setCompareMode(false);
                      setFadedOnly(false);
                      setGuideMode(false);
                      setDesignMode("auto");
                      setDetection({
                        status: "idle",
                        message: "사진을 올리면 얼굴형 기반 자동 맞춤을 시작합니다.",
                      });
                    }}
                    className="studio-button studio-button-secondary"
                  >
                    <ImagePlus size={16} aria-hidden="true" />
                    사진 바꾸기
                  </button>
                  <button
                    type="button"
                    onClick={handleSave}
                    className="studio-button studio-button-secondary"
                  >
                    <Download size={16} aria-hidden="true" />
                    상담용 이미지 저장
                  </button>
                </div>
              </div>

              <BeforeAfterView
                originalSrc={beforeLightening ?? imageSrc}
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
              className={`studio-sheet fixed inset-x-0 bottom-0 z-30 max-h-[48dvh] overflow-y-auto transition-transform duration-300 lg:static lg:max-h-none lg:translate-y-0 lg:overflow-visible ${
                controlSheetOpen ? "translate-y-0" : "translate-y-[calc(100%-64px)]"
              }`}
            >
              <button
                type="button"
                onClick={() => setControlSheetOpen((current) => !current)}
                className="studio-sheet-handle lg:hidden"
                aria-expanded={controlSheetOpen}
              >
                <SlidersHorizontal size={17} aria-hidden="true" />
                {controlSheetOpen ? "사진 크게 보기" : "조정 패널 열기"}
                <ChevronDown size={16} className={controlSheetOpen ? "" : "rotate-180"} aria-hidden="true" />
              </button>
              <BrowControlsPanel
                onLighten={startLightening}
                lighteningOpen={lighteningOpen}
                lighteningAmount={lighteningAmount}
                onLighteningChange={setLighteningAmount}
                controls={controls}
                selectedStyle={selectedStyle}
                designMode={designMode}
                compareMode={compareMode}
                fadedOnly={fadedOnly}
                guideMode={guideMode}
                customBrowSrc={customBrowSrc}
                savedCustomBrows={savedCustomBrows}
                selectedCustomSide={selectedCustomSide}
                customTransform={customTransform}
                onDesignModeChange={(mode) => {
                  setSelectedCustomSide(null);
                  setDesignMode(mode);
                  setControls(current => ({ ...current, renderMode: mode === "virtual" ? "virtual" : "original-warp" }));
                  setFadedOnly(false);
                }}
                onControlsChange={setControls}
                onStyleChange={(styleId) => {
                  setSelectedStyle(styleId);
                  setFadedOnly(false);
                }}
                onCustomImageSelected={handleCustomImageSelected}
                onSavedCustomBrowSelect={handleSavedCustomBrowSelect}
                onSavedCustomBrowDelete={handleSavedCustomBrowDelete}
                onCustomSideChange={handleCustomSideChange}
                onCustomTransformChange={handleCustomTransformChange}
                onSymmetry={handleSymmetry}
                onRefit={handleRefit}
                onReset={handleResetAdjustments}
                onCompareToggle={() => {
                  setCompareMode((current) => !current);
                  setFadedOnly(false);
                }}
                onFadedOnlyToggle={() => {
                  setFadedOnly((current) => !current);
                  setCompareMode(false);
                }}
                onGuideToggle={() => setGuideMode((current) => !current)}
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
