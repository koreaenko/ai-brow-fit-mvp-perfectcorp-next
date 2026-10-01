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
    <section className="mt-6 border-t border-cocoa/15 py-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-cocoa/50">
            Consulting Preview
          </p>
          <h2 className="mt-1 text-lg font-semibold text-ink">상담용 전후 이미지</h2>
        </div>
        <button
          type="button"
          onClick={onSave}
          className="studio-button studio-button-primary shrink-0"
        >
          <Download className="h-4 w-4" aria-hidden="true" />
          저장
        </button>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <figure className="overflow-hidden rounded-lg bg-white ring-1 ring-cocoa/10">
          <img src={originalSrc} alt="원본 얼굴 사진" className="aspect-[4/3] w-full object-contain" />
          <figcaption className="px-3 py-2 text-center text-xs font-semibold text-ink">
            원본
          </figcaption>
        </figure>
        <figure className="overflow-hidden rounded-lg bg-white ring-1 ring-cocoa/10">
          <img src={resultSrc} alt="눈썹 적용 후 사진" className="aspect-[4/3] w-full object-contain" />
          <figcaption className="px-3 py-2 text-center text-xs font-semibold text-ink">
            적용 후
          </figcaption>
        </figure>
      </div>

      <button
        type="button"
        onClick={onSave}
        className="studio-button studio-button-secondary mt-4 w-full"
      >
        <Download className="h-4 w-4" aria-hidden="true" />
        상담용 이미지로 저장하기
      </button>
    </section>
  );
}
