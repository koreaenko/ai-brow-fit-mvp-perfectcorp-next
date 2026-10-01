import BrowRemovalTest from "@/components/BrowRemovalTest";
import { Suspense } from "react";

export const metadata = { title: "눈썹 명암 낮추기 테스트 | AI Brow Fit", robots: { index: false, follow: false } };

export default function RemovalTestPage() { return <Suspense fallback={<p role="status">사진 준비 중...</p>}><BrowRemovalTest /></Suspense>; }
