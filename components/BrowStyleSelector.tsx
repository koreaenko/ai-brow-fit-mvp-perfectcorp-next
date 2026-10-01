"use client";

import { BROW_STYLES } from "@/lib/browStyles";
import type { BrowStyle, BrowStyleId } from "@/types/brow";
import { Check } from "lucide-react";
import { useEffect, useRef } from "react";
import { loadBrowTemplate } from "@/lib/browTemplate";

function BrowThumbnail({ style }: { style: BrowStyle }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    let active = true;
    loadBrowTemplate(style.imageSrc).then(image => {
      if (!active || !ref.current) return;
      const canvas = ref.current;
      canvas.width = 240; canvas.height = 96;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      const h = 88 * (1 + style.thicknessBias * 0.3);
      for (let i = 0; i < 48; i++) {
        const t = (i + .5) / 48;
        const lift = -style.archBias * Math.sin(t * Math.PI) * 14;
        ctx.drawImage(image, image.naturalWidth * i / 48, 0, image.naturalWidth / 48, image.naturalHeight, i * 5, (96-h)/2+lift, 5.1, h);
      }
    }).catch(() => {});
    return () => { active = false; };
  }, [style]);
  return <canvas ref={ref} aria-hidden="true" className="max-h-full max-w-full object-contain" />;
}

type BrowStyleSelectorProps = {
  selectedStyle: BrowStyleId;
  onStyleChange: (style: BrowStyleId) => void;
};

export default function BrowStyleSelector({
  selectedStyle,
  onStyleChange,
}: BrowStyleSelectorProps) {
  return (
    <div className="studio-section">
      <div className="flex items-end justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-ink">눈썹 모양</h2>
        </div>
        <span className="text-xs font-medium text-cocoa/52">
          {BROW_STYLES.length} styles
        </span>
      </div>

      <div className="mt-3 grid grid-cols-3 gap-2">
        {BROW_STYLES.map((style) => {
          const selected = selectedStyle === style.id;

          return (
            <button
              key={style.id}
              type="button"
              onClick={() => onStyleChange(style.id)}
              className={`brow-style ${selected ? "is-selected" : ""}`}
              aria-pressed={selected}
              title={style.description}
            >
              <div
                className="brow-thumbnail"
              >
                <BrowThumbnail style={style} />
              </div>
              <span className="block text-xs font-medium leading-5">
                {style.name}
              </span>
              {selected && <Check className="brow-style-check" size={12} aria-hidden="true" />}
            </button>
          );
        })}
      </div>
    </div>
  );
}
