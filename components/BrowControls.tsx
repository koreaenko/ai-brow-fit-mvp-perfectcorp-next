"use client";

import BrowStyleSelector from "@/components/BrowStyleSelector";
import { Bookmark, Download, Eye, EyeOff, RotateCcw, Sparkles, Wand2 } from "lucide-react";
import type { BrowControls, BrowStyleId } from "@/types/brow";

type BrowControlsProps = {
  controls: BrowControls;
  selectedStyle: BrowStyleId;
  compareMode: boolean;
  fadedOnly: boolean;
  onControlsChange: (controls: BrowControls) => void;
  onStyleChange: (style: BrowStyleId) => void;
  onSymmetry: () => void;
  onRefit: () => void;
  onCompareToggle: () => void;
  onFadedOnlyToggle: () => void;
  onRecommend: () => void;
  onSaveStyle: () => void;
  onSaveImage: () => void;
};

const SLIDERS: Array<{
  key: keyof BrowControls;
  label: string;
  minText: string;
  maxText: string;
  min: number;
  max: number;
  step: number;
}> = [
  { key: "arch", label: "아치", minText: "낮음", maxText: "높음", min: -1, max: 1, step: 0.01 },
  { key: "thickness", label: "두께", minText: "얇음", maxText: "두꺼움", min: -1, max: 1, step: 0.01 },
  { key: "length", label: "길이", minText: "짧음", maxText: "김", min: -1, max: 1, step: 0.01 },
  { key: "height", label: "높이", minText: "아래", maxText: "위", min: -1, max: 1, step: 0.01 },
  { key: "gap", label: "간격", minText: "좁음", maxText: "넓음", min: -1, max: 1, step: 0.01 },
  { key: "intensity", label: "진하기", minText: "연함", maxText: "진함", min: 0, max: 1, step: 0.01 },
  { key: "definition", label: "선명도", minText: "부드러움", maxText: "또렷함", min: 0, max: 1, step: 0.01 },
];

export default function BrowControlsPanel({
  controls,
  selectedStyle,
  compareMode,
  fadedOnly,
  onControlsChange,
  onStyleChange,
  onSymmetry,
  onRefit,
  onCompareToggle,
  onFadedOnlyToggle,
  onRecommend,
  onSaveStyle,
  onSaveImage,
}: BrowControlsProps) {
  const update = (key: keyof BrowControls, value: number) => {
    onControlsChange({ ...controls, [key]: value });
  };

  return (
    <section className="space-y-5 rounded-t-[28px] border border-cocoa/10 bg-white/92 p-5 shadow-[0_-18px_60px_rgba(49,34,27,0.16)] backdrop-blur lg:sticky lg:top-20 lg:max-h-[calc(100dvh-104px)] lg:overflow-y-auto lg:rounded-[28px] lg:shadow-soft">
      <div className="mx-auto h-1.5 w-12 rounded-full bg-cocoa/18 lg:hidden" />

      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cocoa/50">
            Consultation
          </p>
          <h2 className="mt-1 text-xl font-semibold text-ink">디자인 조정</h2>
          <p className="mt-1 text-sm leading-5 text-cocoa/58">
            사진을 보면서 눈썹의 위치와 인상을 바로 맞춰보세요.
          </p>
        </div>
        <button
          type="button"
          onClick={onRecommend}
          className="flex h-11 shrink-0 items-center justify-center gap-2 rounded-2xl bg-[#e8d3b1] px-3 text-sm font-semibold text-cocoa transition active:scale-[0.98]"
        >
          <Sparkles className="h-4 w-4" aria-hidden="true" />
          추천
        </button>
      </div>

      <BrowStyleSelector selectedStyle={selectedStyle} onStyleChange={onStyleChange} />

      <div className="space-y-4">
        {SLIDERS.map((slider) => (
          <label key={slider.key} className="block">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-ink">{slider.label}</span>
              <span className="text-xs text-cocoa/58">
                {Math.round(controls[slider.key] * 100)}%
              </span>
            </div>
            <input
              type="range"
              min={slider.min}
              max={slider.max}
              step={slider.step}
              value={controls[slider.key]}
              onChange={(event) => update(slider.key, Number(event.target.value))}
              className="mt-2 w-full"
            />
            <div className="mt-1 flex justify-between text-xs text-cocoa/50">
              <span>{slider.minText}</span>
              <span>{slider.maxText}</span>
            </div>
          </label>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={onSymmetry}
          className="flex h-12 items-center justify-center gap-2 rounded-2xl border border-cocoa/15 bg-cream text-sm font-semibold text-cocoa transition active:scale-[0.98]"
        >
          <RotateCcw className="h-4 w-4" aria-hidden="true" />
          대칭 보정
        </button>
        <button
          type="button"
          onClick={onRefit}
          className="flex h-12 items-center justify-center gap-2 rounded-2xl bg-cocoa text-sm font-semibold text-white transition active:scale-[0.98]"
        >
          <Wand2 className="h-4 w-4" aria-hidden="true" />
          자동 맞춤
        </button>
        <button
          type="button"
          onClick={onCompareToggle}
          className={`flex h-12 items-center justify-center gap-2 rounded-2xl text-sm font-semibold transition active:scale-[0.98] ${
            compareMode ? "bg-ink text-white" : "border border-cocoa/15 bg-cream text-cocoa"
          }`}
        >
          <Eye className="h-4 w-4" aria-hidden="true" />
          전후 비교
        </button>
        <button
          type="button"
          onClick={onFadedOnlyToggle}
          className={`flex h-12 items-center justify-center gap-2 rounded-2xl text-sm font-semibold transition active:scale-[0.98] ${
            fadedOnly ? "bg-ink text-white" : "border border-cocoa/15 bg-cream text-cocoa"
          }`}
        >
          {fadedOnly ? <EyeOff className="h-4 w-4" aria-hidden="true" /> : <Eye className="h-4 w-4" aria-hidden="true" />}
          눈썹 없는 원본
        </button>
        <button
          type="button"
          onClick={onSaveStyle}
          className="flex h-12 items-center justify-center gap-2 rounded-2xl border border-cocoa/15 bg-cream text-sm font-semibold text-cocoa transition active:scale-[0.98]"
        >
          <Bookmark className="h-4 w-4" aria-hidden="true" />
          스타일 저장
        </button>
        <button
          type="button"
          onClick={onSaveImage}
          className="flex h-12 items-center justify-center gap-2 rounded-2xl bg-[#d7b98f] text-sm font-semibold text-ink transition active:scale-[0.98]"
        >
          <Download className="h-4 w-4" aria-hidden="true" />
          상담용 저장
        </button>
      </div>
    </section>
  );
}
