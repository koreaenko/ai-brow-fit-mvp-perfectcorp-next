import HomeEngagement from "@/components/HomeEngagement";
import { Camera, ArrowUpRight, ImagePlus, ShieldCheck } from "lucide-react";
import Image from "next/image";
import Link from "next/link";

export default function HomePage() {
  return (
    <main className="min-h-dvh bg-white">
      <header className="home-header">
        <Link href="/" className="studio-brand" aria-label="AI Brow Fit 홈">AI Brow Fit<span className="brand-dot" /></Link>
        <span className="privacy-mark"><ShieldCheck size={15} aria-hidden="true" /> 브라우저에서 사진 처리</span>
      </header>
      <section className="home-hero">
        <Image src="/images/brow-studio-editorial.png" alt="자연스러운 눈썹과 털결이 드러난 뷰티 포트레이트" fill priority sizes="(max-width: 1440px) 100vw, 1440px" className="home-hero-image" />
        <div className="home-copy">
          <p className="studio-eyebrow">YOUR PERSONAL BROW STUDIO</p>
          <h1>AI<br /><span>Brow Fit</span></h1>
          <p className="home-subtitle">나다운 인상,<br />눈썹에서 시작하다.</p>
          <div className="home-start">
            <HomeEngagement />
            <Link href="/editor?source=photo" className="studio-button studio-button-primary">
              <span className="flex items-center gap-3"><ImagePlus size={19} aria-hidden="true" />사진으로 시작하기</span><ArrowUpRight size={18} aria-hidden="true" />
            </Link>
            <Link href="/editor?source=camera" className="studio-button studio-button-secondary">
              <span className="flex items-center gap-3"><Camera size={19} aria-hidden="true" />사진 촬영하기</span><ArrowUpRight size={18} aria-hidden="true" />
            </Link>
          </div>
        </div>
      </section>
      <footer className="home-footer"><span>AI BROW FIT / BEAUTY STUDIO</span><span>시뮬레이션 결과는 실제 시술 결과와 다를 수 있습니다.</span></footer>
    </main>
  );
}
