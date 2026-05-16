"use client";

import { BROW_STYLES } from "@/lib/browStyles";
import type { BrowStyleId } from "@/types/brow";

type BrowStyleSelectorProps = {
  selectedStyle: BrowStyleId;
  onStyleChange: (style: BrowStyleId) => void;
};

export default function BrowStyleSelector({
  selectedStyle,
  onStyleChange,
}: BrowStyleSelectorProps) {
  return (
    <div>
      <div className="flex items-end justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-cocoa/50">
            Brow Design
          </p>
          <h2 className="mt-1 text-lg font-semibold text-ink">눈썹 모양</h2>
        </div>
        <span className="text-xs font-medium text-cocoa/52">6 styles</span>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2">
        {BROW_STYLES.map((style) => {
          const selected = selectedStyle === style.id;

          return (
            <button
              key={style.id}
              type="button"
              onClick={() => onStyleChange(style.id)}
              className={`group min-h-[132px] rounded-[18px] border p-3 text-left transition active:scale-[0.98] ${
                selected
                  ? "border-champagne bg-gradient-to-br from-cocoa to-[#6b4a3f] text-white shadow-lg shadow-cocoa/20"
                  : "border-cocoa/10 bg-[#fbf7f0] text-cocoa hover:border-champagne/70"
              }`}
            >
              <svg
                viewBox="0 0 104 72"
                className={`h-14 w-full rounded-2xl border ${
                  selected
                    ? "border-white/15 bg-white/12"
                    : "border-cocoa/8 bg-white"
                }`}
                aria-hidden="true"
              >
                <defs>
                  <linearGradient id={`brow-preview-${style.id}`} x1="0" x2="1">
                    <stop offset="0%" stopColor={selected ? "#f6e6cf" : "#5b4037"} stopOpacity="0.3" />
                    <stop offset="42%" stopColor={selected ? "#fff6e9" : "#2b211d"} stopOpacity="0.92" />
                    <stop offset="100%" stopColor={selected ? "#e6c99d" : "#2b211d"} stopOpacity="0.28" />
                  </linearGradient>
                </defs>
                <path
                  d={style.preview.path}
                  fill={`url(#brow-preview-${style.id})`}
                  stroke={selected ? "rgba(255,255,255,0.54)" : "rgba(43,33,29,0.18)"}
                  strokeWidth="1"
                />
                {style.preview.strokePaths?.map((path, index) => (
                  <path
                    key={path}
                    d={path}
                    fill="none"
                    stroke={selected ? "rgba(255,255,255,0.58)" : "rgba(43,33,29,0.42)"}
                    strokeWidth={index === 0 ? 1.5 : 1}
                    strokeLinecap="round"
                  />
                ))}
              </svg>
              <span className="mt-3 block text-sm font-semibold leading-5">{style.name}</span>
              <span className={`mt-1 block text-xs leading-4 ${selected ? "text-white/72" : "text-cocoa/58"}`}>
                {style.description}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
