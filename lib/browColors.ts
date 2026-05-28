import type { BrowColorId } from "@/types/brow";

export type BrowColor = {
  id: BrowColorId;
  name: string;
  description: string;
  hex: string;
  rgb: {
    r: number;
    g: number;
    b: number;
  };
};

export const BROW_COLORS: BrowColor[] = [
  {
    id: "ash-brown",
    name: "밝은 애쉬",
    description: "붉은기 적은 회갈색",
    hex: "#5f5149",
    rgb: { r: 95, g: 81, b: 73 },
  },
  {
    id: "natural-brown",
    name: "자연 브라운",
    description: "가장 무난한 기본 갈색",
    hex: "#6b4a38",
    rgb: { r: 107, g: 74, b: 56 },
  },
  {
    id: "dark-brown",
    name: "진한 브라운",
    description: "흑발에도 자연스러운 진갈색",
    hex: "#3f2b24",
    rgb: { r: 63, g: 43, b: 36 },
  },
  {
    id: "soft-black",
    name: "소프트 블랙",
    description: "또렷하지만 과하지 않은 검정",
    hex: "#24201f",
    rgb: { r: 36, g: 32, b: 31 },
  },
];

export function getBrowColor(id: BrowColorId) {
  return BROW_COLORS.find((color) => color.id === id) ?? BROW_COLORS[2];
}
