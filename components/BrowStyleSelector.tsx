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
        <span className="text-xs font-medium text-cocoa/52">
          {BROW_STYLES.length} styles
        </span>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2">
        {BROW_STYLES.map((style) => {
          const selected = selectedStyle === style.id;

          return (
            <button
              key={style.id}
              type="button"
              onClick={() => onStyleChange(style.id)}
              className={`group min-h-[144px] rounded-[18px] border p-3 text-left transition active:scale-[0.98] ${
                selected
                  ? "border-champagne bg-gradient-to-br from-cocoa to-[#6b4a3f] text-white shadow-lg shadow-cocoa/20"
                  : "border-cocoa/10 bg-[#fbf7f0] text-cocoa hover:border-champagne/70"
              }`}
            >
              <div
                className={`flex h-16 w-full items-center justify-center rounded-2xl border px-2 ${
                  selected
                    ? "border-white/15 bg-white/12"
                    : "border-cocoa/8 bg-white"
                }`}
              >
                <img
                  src={style.imageSrc}
                  alt=""
                  className={`max-h-full max-w-full object-contain transition ${
                    selected ? "brightness-125 contrast-90 invert" : ""
                  }`}
                  aria-hidden="true"
                />
              </div>
              <span className="mt-3 block text-sm font-semibold leading-5">
                {style.name}
              </span>
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
