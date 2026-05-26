"use client";

import { ArrowDown, ArrowUp, Focus, Minus, Plus, ScanFace } from "lucide-react";

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
    "flex h-10 min-w-10 items-center justify-center rounded-2xl border border-white/12 bg-ink/58 px-3 text-sm font-semibold text-white backdrop-blur transition active:scale-[0.97]";

  return (
    <div className="pointer-events-auto flex items-center gap-2">
      <button type="button" onClick={onZoomOut} className={buttonClass} aria-label="축소">
        <Minus className="h-4 w-4" aria-hidden="true" />
      </button>
      <button type="button" onClick={onReset} className={buttonClass} aria-label="100% 보기">
        {zoomLabel}
      </button>
      <button type="button" onClick={onZoomIn} className={buttonClass} aria-label="확대">
        <Plus className="h-4 w-4" aria-hidden="true" />
      </button>
      <button type="button" onClick={onFocusBrows} className={buttonClass} aria-label="눈썹 초점">
        <ScanFace className="mr-1 h-4 w-4" aria-hidden="true" />
        초점
      </button>
      <button type="button" onClick={onMoveUp} className={buttonClass} aria-label="사진 위로 이동">
        <ArrowUp className="h-4 w-4" aria-hidden="true" />
      </button>
      <button type="button" onClick={onMoveDown} className={buttonClass} aria-label="사진 아래로 이동">
        <ArrowDown className="h-4 w-4" aria-hidden="true" />
      </button>
      <Focus className="hidden" aria-hidden="true" />
    </div>
  );
}
