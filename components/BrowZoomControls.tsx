"use client";

import { ArrowDown, ArrowUp, Minus, Plus, ScanFace } from "lucide-react";

type BrowZoomControlsProps = {
  zoomLabel: string;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onReset: () => void;
  onFocusBrows: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
};

export default function BrowZoomControls({
  zoomLabel,
  onZoomIn,
  onZoomOut,
  onReset,
  onFocusBrows,
  onMoveUp,
  onMoveDown,
}: BrowZoomControlsProps) {
  const buttonClass =
    "studio-zoom-button";

  return (
    <div className="studio-zoom pointer-events-auto flex items-center gap-1">
      <button type="button" onClick={onZoomOut} className={buttonClass} aria-label="축소" title="축소">
        <Minus className="h-4 w-4" aria-hidden="true" />
      </button>
      <button type="button" onClick={onReset} className={`${buttonClass} zoom-value`} aria-label="100% 보기" title="확대 초기화">
        {zoomLabel}
      </button>
      <button type="button" onClick={onZoomIn} className={buttonClass} aria-label="확대" title="확대">
        <Plus className="h-4 w-4" aria-hidden="true" />
      </button>
      <button type="button" onClick={onFocusBrows} className={buttonClass} aria-label="눈썹 초점" title="눈썹 초점">
        <ScanFace className="h-4 w-4" aria-hidden="true" />
      </button>
      <button type="button" onClick={onMoveUp} className={buttonClass} aria-label="사진 위로 이동" title="사진 위로 이동">
        <ArrowUp className="h-4 w-4" aria-hidden="true" />
      </button>
      <button type="button" onClick={onMoveDown} className={buttonClass} aria-label="사진 아래로 이동" title="사진 아래로 이동">
        <ArrowDown className="h-4 w-4" aria-hidden="true" />
      </button>
    </div>
  );
}
