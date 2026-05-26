"use client";

import BeforeAfterView from "@/components/BeforeAfterView";
import BrowCanvas, { type BrowCanvasHandle } from "@/components/BrowCanvas";
import BrowControlsPanel from "@/components/BrowControls";
import ImageUploader from "@/components/ImageUploader";
import { DEFAULT_CONTROLS, getBrowStyle } from "@/lib/browStyles";
import { detectFacePlacement } from "@/lib/faceLandmarks";
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
  const [resultSrc, setResultSrc] = useState<string | null>(null);
  const [placement, setPlacement] = useState<BrowPlacement | undefined>();
  const [selectedStyle, setSelectedStyle] = useState<BrowStyleId>("natural-arch");
  const [designMode, setDesignMode] = useState<BrowDesignMode>("auto");
  const [customBrowSrc, setCustomBrowSrc] = useState<string | null>(null);
  const [savedCustomBrows, setSavedCustomBrows] =
    useState<SavedCustomBrow[]>(() => readSavedCustomBrows());
  const [selectedCustomSide, setSelectedCustomSide] = useState<SelectedBrowSide>("right");
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
      setDetection({
        status: "loading",
        message: "사진을 편집에 맞는 크기로 준비하고 있습니다.",
      });

      try {
        const prepared = await prepareImageForEditing(file);
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
          message: "사진을 불러오지 못했습니다. 다른 이미지를 선택해 주세요.",
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
      setSelectedCustomSide("right");
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
    setSelectedCustomSide("right");
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

  const activeStyle = getBrowStyle(selectedStyle);

  return (
    <main className="min-h-dvh px-4 py-4 text-ink">
      <div className="mx-auto max-w-md space-y-4 pb-28 lg:max-w-7xl lg:pb-8">
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
                showGuides={guideMode}
                designMode={designMode}
                customBrowSrc={customBrowSrc}
                customTransform={customTransform}
                selectedCustomSide={selectedCustomSide}
                onCustomSideSelect={setSelectedCustomSide}
                onCustomTransformChange={handleCustomTransformChange}
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
              className={`fixed inset-x-0 bottom-0 z-30 max-h-[58dvh] overflow-y-auto px-3 pb-3 transition-transform duration-300 lg:static lg:max-h-none lg:translate-y-0 lg:overflow-visible lg:px-0 lg:pb-0 ${
                controlSheetOpen ? "translate-y-0" : "translate-y-[calc(100%-64px)]"
              }`}
            >
              <button
                type="button"
                onClick={() => setControlSheetOpen((current) => !current)}
                className="mb-2 flex h-12 w-full items-center justify-center rounded-t-[24px] border border-cocoa/10 bg-white/92 text-sm font-semibold text-cocoa shadow-soft backdrop-blur lg:hidden"
                aria-expanded={controlSheetOpen}
              >
                <span className="mr-2 h-1.5 w-12 rounded-full bg-cocoa/24" aria-hidden="true" />
                {controlSheetOpen ? "사진 크게 보기" : "조정 패널 열기"}
              </button>
              <BrowControlsPanel
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
                onDesignModeChange={setDesignMode}
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
