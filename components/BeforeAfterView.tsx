"use client";

import { Download } from "lucide-react";

type BeforeAfterViewProps = {
  originalSrc: string;
  resultSrc: string | null;
  onSave: () => void;
};

export default function BeforeAfterView({
  originalSrc,
  resultSrc,
  onSave,
}: BeforeAfterViewProps) {
  if (!resultSrc) {
    return null;
  }

  return (
    <section className="rounded-[28px] border border-cocoa/10 bg-white/86 p-5 shadow-soft">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-cocoa/50">
            Consulting Preview
          </p>
          <h2 className="mt-1 text-lg font-semibold text-ink">상담용 전후 이미지</h2>
          <p className="mt-1 text-sm text-cocoa/60">고객 상담 전 공유하기 좋은 형태로 저장됩니다.</p>
        </div>
        <button
          type="button"
          onClick={onSave}
          className="flex h-11 shrink-0 items-center justify-center gap-2 rounded-2xl bg-cocoa px-4 text-sm font-semibold text-white transition active:scale-[0.98]"
        >
          <Download className="h-4 w-4" aria-hidden="true" />
          저장
        </button>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <figure className="overflow-hidden rounded-[22px] bg-ink ring-1 ring-cocoa/10">
          <img src={originalSrc} alt="원본 얼굴 사진" className="h-full w-full object-contain" />
          <figcaption className="bg-ink px-3 py-2 text-center text-sm font-semibold text-white/82">
            원본
          </figcaption>
        </figure>
        <figure className="overflow-hidden rounded-[22px] bg-ink ring-1 ring-cocoa/10">
          <img src={resultSrc} alt="눈썹 적용 후 사진" className="h-full w-full object-contain" />
          <figcaption className="bg-ink px-3 py-2 text-center text-sm font-semibold text-white/82">
            적용 후
          </figcaption>
        </figure>
      </div>

      <button
        type="button"
        onClick={onSave}
        className="mt-4 flex h-12 w-full items-center justify-center gap-2 rounded-2xl border border-cocoa/15 bg-cream text-sm font-semibold text-cocoa transition active:scale-[0.98]"
      >
        <Download className="h-4 w-4" aria-hidden="true" />
        상담용 이미지로 저장하기
      </button>
    </section>
  );
}
