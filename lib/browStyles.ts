import type { BrowControls, BrowStyle, BrowStyleId } from "@/types/brow";

const base: Omit<BrowStyle, "id" | "name" | "description"> = {
  imageSrc: "/brows/09-airy-hair-strokes.png",
  preview: { path: "M12 45 C31 34 62 31 92 39 C75 51 38 54 12 45 Z" },
  archBias: 0, thicknessBias: 0, lengthBias: 0,
  softness: 0.68, taper: 0.62, density: 0.72, edgeFade: 0.76,
  strokeCount: 18, hairStrokes: true,
};

export const BROW_STYLES: BrowStyle[] = [
  { ...base, id: "natural-arch", name: "내추럴", description: "자연스러운 기본형" },
  { ...base, id: "straight", name: "일자형", description: "낮고 차분한 아치", archBias: -0.65 },
  { ...base, id: "soft-arch", name: "아치형", description: "부드럽게 올라가는 아치", archBias: 0.65 },
  { ...base, id: "angular-arch", name: "리프팅형", description: "높고 또렷한 아치", archBias: 0.95, lengthBias: 0.08 },
  { ...base, id: "men-straight", name: "남성 일자형", description: "넓고 낮은 자연형", imageSrc: "/brows/10-men-airy-straight.png", archBias: -0.4, thicknessBias: 0.22 },
  { ...base, id: "men-natural", name: "남성 내추럴", description: "풍성한 자연 아치", imageSrc: "/brows/10-men-airy-straight.png", archBias: 0.15, thicknessBias: 0.18 },
];

export const DEFAULT_CONTROLS: BrowControls = {
  strokeWidth: 0, color: "dark-brown", arch: 0, thickness: 0, length: 0,
  height: 0, gap: 0, intensity: 0.86, definition: 0.88,
  baseMode: "keep", renderMode: "original-warp",
};

export function getBrowStyle(id: BrowStyleId): BrowStyle {
  if (id === "men-airy-straight") return BROW_STYLES[4];
  return BROW_STYLES.find(style => style.id === id) ?? BROW_STYLES[0];
}
