"use client";

import BrowStyleSelector from "@/components/BrowStyleSelector";
import { BROW_COLORS } from "@/lib/browColors";
import {
  Bookmark,
  Download,
  Eye,
  EyeOff,
  ImagePlus,
  RotateCcw,
  Ruler,
  Sparkles,
  Wand2,
} from "lucide-react";
import type {
  BrowBaseMode,
  BrowControls,
  BrowDesignMode,
  BrowRenderMode,
  BrowSide,
  BrowStyleId,
  CustomBrowSideTransform,
  CustomBrowTransform,
  SavedCustomBrow,
  SelectedBrowSide,
} from "@/types/brow";

type NumericControlKey = Exclude<keyof BrowControls, "baseMode" | "renderMode" | "color">;
type CustomTransformKey = keyof CustomBrowSideTransform;

type BrowControlsProps = {
  controls: BrowControls;
  selectedStyle: BrowStyleId;
  designMode: BrowDesignMode;
  compareMode: boolean;
  fadedOnly: boolean;
  guideMode: boolean;
  customBrowSrc: string | null;
  savedCustomBrows: SavedCustomBrow[];
  selectedCustomSide: SelectedBrowSide;
  customTransform: CustomBrowTransform;
  onDesignModeChange: (mode: BrowDesignMode) => void;
  onControlsChange: (controls: BrowControls) => void;
  onStyleChange: (style: BrowStyleId) => void;
  onCustomImageSelected: (file: File) => void;
  onSavedCustomBrowSelect: (item: SavedCustomBrow) => void;
  onSavedCustomBrowDelete: (id: string) => void;
  onCustomSideChange: (side: BrowSide) => void;
  onCustomTransformChange: (side: BrowSide, transform: CustomBrowSideTransform) => void;
  onSymmetry: () => void;
  onRefit: () => void;
  onCompareToggle: () => void;
  onFadedOnlyToggle: () => void;
  onGuideToggle: () => void;
  onRecommend: () => void;
  onSaveStyle: () => void;
  onSaveImage: () => void;
};

const RENDER_MODES: Array<{
  value: BrowRenderMode;
  label: string;
  description: string;
}> = [
  { value: "auto", label: "자동 추천", description: "기존 눈썹 밀도를 분석해 리셰이프와 시뮬레이션을 자동 조절" },
  { value: "reshape", label: "자연 리셰이프", description: "원래 눈썹 결을 더 살리고 부족한 부분만 보충" },
  { value: "simulation", label: "완성형 시뮬레이션", description: "눈썹 텍스처를 더 적극적으로 합성" },
];

const BASE_MODES: Array<{
  value: BrowBaseMode;
  label: string;
  description: string;
}> = [
  { value: "keep", label: "원본 유지", description: "기존 눈썹을 거의 건드리지 않음" },
  { value: "natural", label: "자연 정리 추천", description: "명암과 채도만 부드럽게 약화" },
  { value: "strong", label: "강하게 정리", description: "진한 눈썹을 조금 더 낮춤" },
];

const SLIDERS: Array<{
  key: NumericControlKey;
  label: string;
  minText: string;
  maxText: string;
  min: number;
  max: number;
  step: number;
}> = [
  { key: "arch", label: "아치", minText: "낮게", maxText: "높게", min: -1, max: 1, step: 0.01 },
  { key: "thickness", label: "두께", minText: "얇게", maxText: "두껍게", min: -1, max: 1, step: 0.01 },
  { key: "length", label: "길이", minText: "짧게", maxText: "길게", min: -1, max: 1, step: 0.01 },
  { key: "height", label: "높이", minText: "아래", maxText: "위", min: -1, max: 1, step: 0.01 },
  { key: "gap", label: "간격", minText: "좁게", maxText: "넓게", min: -1, max: 1, step: 0.01 },
  { key: "intensity", label: "진하기", minText: "연하게", maxText: "진하게", min: 0, max: 1, step: 0.01 },
  { key: "definition", label: "선명도", minText: "부드럽게", maxText: "또렷하게", min: 0, max: 1, step: 0.01 },
];

export default function BrowControlsPanel({
  controls,
  selectedStyle,
  designMode,
  compareMode,
  fadedOnly,
  guideMode,
  customBrowSrc,
  savedCustomBrows,
  selectedCustomSide,
  customTransform,
  onDesignModeChange,
  onControlsChange,
  onStyleChange,
  onCustomImageSelected,
  onSavedCustomBrowSelect,
  onSavedCustomBrowDelete,
  onCustomSideChange,
  onCustomTransformChange,
  onSymmetry,
  onRefit,
  onCompareToggle,
  onFadedOnlyToggle,
  onGuideToggle,
  onRecommend,
  onSaveStyle,
  onSaveImage,
}: BrowControlsProps) {
  const update = (key: NumericControlKey, value: number) => {
    onControlsChange({ ...controls, [key]: value });
  };
  const updateCustom = (key: CustomTransformKey, value: number) => {
    if (!selectedCustomSide) {
      return;
    }

    onCustomTransformChange(selectedCustomSide, {
      ...customTransform[selectedCustomSide],
      [key]: value,
    });
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
            기존 눈썹 밀도를 분석해 자연 리셰이프와 완성형 시뮬레이션을 자동 조절합니다.
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

      <OptionGroup
        title="디자인 모드"
        hint={designMode === "auto" ? "기본 디자인" : "직접 올린 눈썹"}
        options={[
          { value: "auto", label: "자동 모드", description: "앱에 저장된 디자인을 얼굴에 자동 맞춤" },
          { value: "custom", label: "커스텀 모드", description: "내가 만든 한쪽 눈썹 이미지를 좌우에 배치" },
        ]}
        value={designMode}
        onChange={onDesignModeChange}
      />

      {designMode === "auto" ? (
        <BrowStyleSelector selectedStyle={selectedStyle} onStyleChange={onStyleChange} />
      ) : (
        <CustomBrowPanel
          hasImage={Boolean(customBrowSrc)}
          savedBrows={savedCustomBrows}
          selectedSide={selectedCustomSide}
          transform={selectedCustomSide ? customTransform[selectedCustomSide] : null}
          onImageSelected={onCustomImageSelected}
          onSavedBrowSelect={onSavedCustomBrowSelect}
          onSavedBrowDelete={onSavedCustomBrowDelete}
          onSideChange={onCustomSideChange}
          onTransformChange={updateCustom}
        />
      )}

      <div>
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-sm font-semibold text-ink">눈썹 컬러</h3>
          <span className="text-xs text-cocoa/52">
            {BROW_COLORS.find((color) => color.id === controls.color)?.name}
          </span>
        </div>
        <div className="mt-2 grid grid-cols-4 gap-2">
          {BROW_COLORS.map((color) => {
            const selected = controls.color === color.id;

            return (
              <button
                key={color.id}
                type="button"
                onClick={() => onControlsChange({ ...controls, color: color.id })}
                className={`min-h-[76px] rounded-2xl border p-2 text-left transition active:scale-[0.98] ${
                  selected
                    ? "border-cocoa bg-cocoa text-white"
                    : "border-cocoa/12 bg-cream text-cocoa"
                }`}
                title={color.description}
              >
                <span
                  className={`block h-7 w-7 rounded-full ring-2 ${
                    selected ? "ring-white/70" : "ring-white"
                  }`}
                  style={{ backgroundColor: color.hex }}
                  aria-hidden="true"
                />
                <span className="mt-2 block text-[11px] font-semibold leading-4">
                  {color.name}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <OptionGroup
        title="눈썹 표현 방식"
        hint="기본값: 자동 추천"
        options={RENDER_MODES}
        value={controls.renderMode}
        onChange={(renderMode) => onControlsChange({ ...controls, renderMode })}
      />

      <OptionGroup
        title="눈썹 베이스 처리"
        hint="기본값: 자연 정리"
        options={BASE_MODES}
        value={controls.baseMode}
        onChange={(baseMode) => onControlsChange({ ...controls, baseMode })}
      />

      <div className="space-y-4">
        <div>
          <h3 className="text-sm font-semibold text-ink">수동 미세 보정</h3>
          <p className="mt-1 text-xs leading-4 text-cocoa/52">
            아치, 두께, 길이, 높이, 간격을 직접 조정합니다.
          </p>
        </div>
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
          원본만 보기
        </button>
        <button
          type="button"
          onClick={onGuideToggle}
          className={`col-span-2 flex h-12 items-center justify-center gap-2 rounded-2xl text-sm font-semibold transition active:scale-[0.98] ${
            guideMode ? "bg-[#e8d3b1] text-ink" : "border border-cocoa/15 bg-cream text-cocoa"
          }`}
        >
          <Ruler className="h-4 w-4" aria-hidden="true" />
          {guideMode ? "가이드라인 해지" : "가이드라인 생성"}
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

type CustomBrowPanelProps = {
  hasImage: boolean;
  savedBrows: SavedCustomBrow[];
  selectedSide: SelectedBrowSide;
  transform: CustomBrowSideTransform | null;
  onImageSelected: (file: File) => void;
  onSavedBrowSelect: (item: SavedCustomBrow) => void;
  onSavedBrowDelete: (id: string) => void;
  onSideChange: (side: BrowSide) => void;
  onTransformChange: (key: CustomTransformKey, value: number) => void;
};

const CUSTOM_SLIDERS: Array<{
  key: CustomTransformKey;
  label: string;
  minText: string;
  maxText: string;
  min: number;
  max: number;
  step: number;
}> = [
  { key: "offsetX", label: "좌우 위치", minText: "안쪽", maxText: "바깥쪽", min: -1, max: 1, step: 0.01 },
  { key: "offsetY", label: "상하 위치", minText: "아래", maxText: "위", min: -1, max: 1, step: 0.01 },
  { key: "scaleX", label: "가로 크기", minText: "짧게", maxText: "길게", min: 0.65, max: 1.45, step: 0.01 },
  { key: "scaleY", label: "세로 크기", minText: "얇게", maxText: "두껍게", min: 0.65, max: 1.45, step: 0.01 },
  { key: "rotation", label: "각도", minText: "내림", maxText: "올림", min: -1, max: 1, step: 0.01 },
  { key: "darkness", label: "진하기", minText: "연하게", maxText: "검게", min: -1, max: 1, step: 0.01 },
  { key: "clarity", label: "선명도", minText: "부드럽게", maxText: "또렷하게", min: -1, max: 1, step: 0.01 },
];

function CustomBrowPanel({
  hasImage,
  savedBrows,
  selectedSide,
  transform,
  onImageSelected,
  onSavedBrowSelect,
  onSavedBrowDelete,
  onSideChange,
  onTransformChange,
}: CustomBrowPanelProps) {
  return (
    <div className="space-y-4 rounded-2xl border border-cocoa/12 bg-cream p-3">
      <label className="flex min-h-24 cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-cocoa/24 bg-white/72 px-3 py-4 text-center transition active:scale-[0.99]">
        <ImagePlus className="h-5 w-5 text-cocoa" aria-hidden="true" />
        <span className="text-sm font-semibold text-ink">
          {hasImage ? "커스텀 눈썹 다시 올리기" : "한쪽 눈썹 이미지 올리기"}
        </span>
        <span className="text-xs leading-4 text-cocoa/54">
          투명 배경 PNG가 가장 좋고, JPG도 사용할 수 있습니다.
        </span>
        <input
          type="file"
          accept="image/png,image/jpeg,image/webp"
          className="sr-only"
          onChange={(event) => {
            const file = event.currentTarget.files?.[0];
            if (file) {
              onImageSelected(file);
            }
            event.currentTarget.value = "";
          }}
        />
      </label>

      <div>
        <div className="mb-2 flex items-center justify-between gap-3">
          <h3 className="text-sm font-semibold text-ink">나의 눈썹 리스트</h3>
          <span className="text-xs text-cocoa/52">{savedBrows.length}개 저장됨</span>
        </div>
        {savedBrows.length > 0 ? (
          <div className="grid grid-cols-1 gap-2">
            {savedBrows.map((item) => (
              <div
                key={item.id}
                className="grid grid-cols-[72px_minmax(0,1fr)_auto] items-center gap-2 rounded-2xl border border-cocoa/12 bg-white p-2"
              >
                <button
                  type="button"
                  onClick={() => onSavedBrowSelect(item)}
                  className="flex h-12 items-center justify-center overflow-hidden rounded-xl border border-cocoa/10 bg-cream"
                  aria-label={`${item.name} 불러오기`}
                >
                  <img src={item.src} alt="" className="max-h-full max-w-full object-contain" />
                </button>
                <button
                  type="button"
                  onClick={() => onSavedBrowSelect(item)}
                  className="min-w-0 text-left"
                >
                  <span className="block truncate text-sm font-semibold text-ink">{item.name}</span>
                  <span className="block text-xs text-cocoa/50">눌러서 불러오기</span>
                </button>
                <button
                  type="button"
                  onClick={() => onSavedBrowDelete(item.id)}
                  className="h-9 rounded-xl border border-cocoa/12 px-3 text-xs font-semibold text-cocoa transition active:scale-[0.98]"
                >
                  삭제
                </button>
              </div>
            ))}
          </div>
        ) : (
          <p className="rounded-2xl border border-cocoa/10 bg-white/70 px-3 py-3 text-xs leading-5 text-cocoa/56">
            저장된 커스텀 눈썹이 없습니다. 이미지를 올린 뒤 저장을 선택하면 여기에 표시됩니다.
          </p>
        )}
      </div>

      <div>
        <div className="mb-2 flex items-center justify-between gap-3">
          <h3 className="text-sm font-semibold text-ink">선택 눈썹 보정</h3>
          <span className="text-xs text-cocoa/52">
            사진 위 눈썹을 눌러도 선택됩니다.
          </span>
        </div>
        <div className="grid grid-cols-2 gap-2">
          {(["left", "right"] as BrowSide[]).map((side) => (
            <button
              key={side}
              type="button"
              onClick={() => onSideChange(side)}
              className={`h-10 rounded-2xl text-sm font-semibold transition active:scale-[0.98] ${
                selectedSide === side ? "bg-cocoa text-white" : "border border-cocoa/15 bg-white text-cocoa"
              }`}
            >
              {side === "left" ? "왼쪽 눈썹" : "오른쪽 눈썹"}
            </button>
          ))}
        </div>
        <p className="mt-2 text-xs leading-4 text-cocoa/52">
          같은 버튼을 한 번 더 누르면 사각틀이 숨겨집니다.
        </p>
      </div>

      {transform ? (
        <div className="space-y-3">
          {CUSTOM_SLIDERS.map((slider) => (
          <label key={slider.key} className="block">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-ink">{slider.label}</span>
              <span className="text-xs text-cocoa/58">
                {slider.key === "scaleX" || slider.key === "scaleY"
                  ? `${Math.round(transform[slider.key] * 100)}%`
                  : `${Math.round(transform[slider.key] * 100)}%`}
              </span>
            </div>
            <input
              type="range"
              min={slider.min}
              max={slider.max}
              step={slider.step}
              value={transform[slider.key]}
              onChange={(event) => onTransformChange(slider.key, Number(event.target.value))}
              className="mt-2 w-full"
            />
            <div className="mt-1 flex justify-between text-xs text-cocoa/50">
              <span>{slider.minText}</span>
              <span>{slider.maxText}</span>
            </div>
          </label>
          ))}
        </div>
      ) : (
        <p className="rounded-2xl border border-cocoa/10 bg-white/70 px-3 py-3 text-xs leading-5 text-cocoa/56">
          조정 사각틀이 숨겨졌습니다. 왼쪽 또는 오른쪽 눈썹을 다시 누르면 편집할 수 있습니다.
        </p>
      )}
    </div>
  );
}

type OptionGroupProps<T extends string> = {
  title: string;
  hint: string;
  options: Array<{
    value: T;
    label: string;
    description: string;
  }>;
  value: T;
  onChange: (value: T) => void;
};

function OptionGroup<T extends string>({
  title,
  hint,
  options,
  value,
  onChange,
}: OptionGroupProps<T>) {
  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold text-ink">{title}</h3>
        <span className="text-xs text-cocoa/52">{hint}</span>
      </div>
      <div className="mt-2 grid grid-cols-1 gap-2">
        {options.map((option) => {
          const selected = value === option.value;

          return (
            <button
              key={option.value}
              type="button"
              onClick={() => onChange(option.value)}
              className={`rounded-2xl border px-3 py-2 text-left transition active:scale-[0.99] ${
                selected
                  ? "border-cocoa bg-cocoa text-white"
                  : "border-cocoa/12 bg-cream text-cocoa"
              }`}
            >
              <span className="block text-sm font-semibold">{option.label}</span>
              <span className={`mt-0.5 block text-xs ${selected ? "text-white/70" : "text-cocoa/54"}`}>
                {option.description}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
