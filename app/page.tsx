import { Camera, ImagePlus, Sparkles } from "lucide-react";
import Link from "next/link";

export default function HomePage() {
  return (
    <main className="min-h-dvh px-5 py-6">
      <section className="mx-auto flex min-h-[calc(100dvh-48px)] w-full max-w-md flex-col justify-between overflow-hidden rounded-[28px] bg-cream shadow-soft ring-1 ring-cocoa/10">
        <div className="relative min-h-[54dvh] bg-[linear-gradient(160deg,rgba(74,51,44,0.88),rgba(113,129,109,0.72)),url('https://images.unsplash.com/photo-1595475884562-073c30d45670?auto=format&fit=crop&w=900&q=80')] bg-cover bg-center p-7 text-white">
          <div className="flex items-center justify-between">
            <div className="rounded-full bg-white/14 px-3 py-1 text-sm backdrop-blur">
              얼굴형 기반 맞춤
            </div>
            <Sparkles className="h-5 w-5" aria-hidden="true" />
          </div>
          <div className="absolute bottom-7 left-7 right-7">
            <p className="text-sm font-medium uppercase tracking-[0.2em] text-white/70">
              AI Brow Fit
            </p>
            <h1 className="mt-3 text-4xl font-semibold leading-tight">
              AI Brow Fit
            </h1>
            <p className="mt-4 max-w-[19rem] text-lg leading-7 text-white/88">
              시술 전에, 내 얼굴에 어울리는 눈썹을 먼저 확인하세요.
            </p>
          </div>
        </div>

        <div className="space-y-4 p-6">
          <Link
            href="/editor?source=photo"
            className="flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-cocoa text-base font-semibold text-white shadow-lg shadow-cocoa/20 transition active:scale-[0.98]"
          >
            <ImagePlus className="h-5 w-5" aria-hidden="true" />
            사진으로 시작하기
          </Link>
          <Link
            href="/editor?source=camera"
            className="flex h-14 w-full items-center justify-center gap-2 rounded-2xl border border-cocoa/15 bg-white/70 text-base font-semibold text-cocoa transition active:scale-[0.98]"
          >
            <Camera className="h-5 w-5" aria-hidden="true" />
            카메라로 시작하기
          </Link>
          <p className="text-center text-sm leading-6 text-cocoa/64">
            사진은 서버로 업로드하지 않고 브라우저 안에서만 처리합니다.
          </p>
        </div>
      </section>
    </main>
  );
}
