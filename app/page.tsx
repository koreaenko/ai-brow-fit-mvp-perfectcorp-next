import HomeEngagement from "@/components/HomeEngagement";
import {
  Camera,
  ChevronRight,
  ImagePlus,
  LockKeyhole,
  ScanFace,
  ShieldCheck,
  TimerReset,
} from "lucide-react";
import Link from "next/link";

const HERO_IMAGE =
  "https://images.unsplash.com/photo-1616683693504-3ea7e9ad6fec?auto=format&fit=crop&w=1200&q=90";

const featureRows = [
  {
    icon: ScanFace,
    title: "Real-time",
    label: "AI Analysis",
  },
  {
    icon: TimerReset,
    title: "3-sec",
    label: "Brow Simulation",
  },
  {
    icon: ShieldCheck,
    title: "Privacy",
    label: "Protected",
  },
];

export default function HomePage() {
  return (
    <main className="min-h-dvh overflow-hidden bg-[#eee1d6] px-4 py-5 text-white sm:px-6">
      <section className="relative mx-auto flex min-h-[calc(100dvh-40px)] w-full max-w-md flex-col justify-between overflow-hidden rounded-[38px] bg-[#211713] shadow-[0_34px_90px_rgba(55,36,28,0.28)] ring-1 ring-white/35">
        <div
          className="absolute inset-0 bg-cover bg-[58%_center]"
          style={{ backgroundImage: `url(${HERO_IMAGE})` }}
          aria-hidden="true"
        />
        <div
          className="absolute inset-0 bg-[linear-gradient(90deg,rgba(30,20,16,0.9)_0%,rgba(42,27,21,0.68)_34%,rgba(50,29,19,0.18)_72%),linear-gradient(180deg,rgba(18,12,10,0.2)_0%,rgba(18,12,10,0.08)_47%,rgba(18,12,10,0.86)_100%)]"
          aria-hidden="true"
        />
        <div
          className="absolute inset-0 bg-[radial-gradient(circle_at_78%_28%,rgba(255,244,222,0.38),transparent_9%),radial-gradient(circle_at_61%_42%,rgba(255,214,162,0.18),transparent_16%),radial-gradient(circle_at_74%_87%,rgba(255,217,174,0.24),transparent_14%)]"
          aria-hidden="true"
        />

        <div className="relative z-10 p-6 pb-0">
          <div className="flex items-center justify-between">
            <div className="text-4xl font-light tracking-[-0.06em] text-[#f4e7d7]">
              AI
            </div>
            <div className="flex items-center gap-2 rounded-full border border-white/20 bg-white/12 px-4 py-2 text-sm font-medium text-white/86 shadow-[0_16px_42px_rgba(18,10,6,0.22)] backdrop-blur-md">
              <ShieldCheck className="h-4 w-4" aria-hidden="true" />
              프라이버시 보호
            </div>
          </div>
        </div>

        <div className="relative z-10 px-6 pt-20">
          <h1 className="max-w-[18rem] font-serif text-[4.4rem] font-medium leading-[0.86] tracking-[-0.04em] text-[#fff3e2] drop-shadow-[0_8px_26px_rgba(0,0,0,0.28)]">
            AI
            <br />
            Brow Fit
          </h1>
          <p className="mt-7 max-w-[15rem] text-[1.42rem] font-light leading-[1.34] text-white/84">
            AI 얼굴형 분석 기반
            <br />
            맞춤 눈썹 추천
          </p>
          <div className="mt-7 h-px w-14 bg-white/32" />

          <div className="mt-8 space-y-3">
            {featureRows.map((item) => {
              const Icon = item.icon;

              return (
                <div
                  key={item.title}
                  className="grid w-[15.5rem] grid-cols-[3.25rem_1fr] items-center gap-3 rounded-[22px] border border-white/20 bg-white/10 px-4 py-3 shadow-[0_16px_45px_rgba(17,9,5,0.2)] backdrop-blur-md"
                >
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/24 text-white">
                    <Icon className="h-6 w-6" aria-hidden="true" />
                  </div>
                  <div className="text-sm leading-5 text-white/82">
                    <span className="mr-2 text-white">✓</span>
                    <span>{item.title}</span>
                    <br />
                    <span className="ml-6">{item.label}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="relative z-10 px-6 pb-7 pt-7">
          <div className="mb-5 text-center">
            <p className="text-sm leading-6 text-white/70">
              당신에게 가장 잘 어울리는 눈썹을
              <br />
              <span className="text-lg font-medium text-[#f2d4ae]">AI가 찾아드립니다</span>
            </p>
          </div>

          <div className="mb-3">
            <HomeEngagement />
          </div>

          <div className="space-y-3">
            <Link
              href="/editor?source=photo"
              className="group flex h-[4.65rem] w-full items-center justify-between rounded-[24px] border border-white/20 bg-[#21140f]/90 px-6 text-[1.45rem] font-semibold text-[#fff0de] shadow-[0_22px_50px_rgba(8,4,2,0.36)] transition active:scale-[0.98]"
            >
              <span className="flex items-center gap-4">
                <ImagePlus className="h-7 w-7" aria-hidden="true" />
                사진으로 시작하기
              </span>
              <ChevronRight
                className="h-7 w-7 transition group-hover:translate-x-1"
                aria-hidden="true"
              />
            </Link>
            <Link
              href="/editor?source=camera"
              className="group flex h-[4.65rem] w-full items-center justify-between rounded-[24px] border border-white/24 bg-white/26 px-6 text-[1.35rem] font-semibold text-white shadow-[0_18px_45px_rgba(25,13,7,0.16)] backdrop-blur-md transition active:scale-[0.98]"
            >
              <span className="flex items-center gap-4">
                <Camera className="h-7 w-7" aria-hidden="true" />
                실시간 카메라 분석
              </span>
              <ChevronRight
                className="h-7 w-7 transition group-hover:translate-x-1"
                aria-hidden="true"
              />
            </Link>
          </div>

          <p className="mt-5 flex items-center justify-center gap-2 text-xs text-white/42">
            <LockKeyhole className="h-3.5 w-3.5" aria-hidden="true" />
            모든 데이터는 안전하게 보호됩니다
          </p>
        </div>
      </section>
    </main>
  );
}
