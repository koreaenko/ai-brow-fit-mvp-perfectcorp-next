export type BrowStyleId =
  | "natural-straight"
  | "soft-semi-arch"
  | "lifting-arch"
  | "mens-natural"
  | "mature-lift"
  | "hair-stroke";

export type Point = {
  x: number;
  y: number;
};

export type BrowSide = "left" | "right";

export type BrowAnchor = {
  start: Point;
  arch: Point;
  tail: Point;
};

export type BrowPlacement = {
  left: BrowAnchor;
  right: BrowAnchor;
  angle: number;
  eyeDistance: number;
};

export type BrowControls = {
  arch: number;
  thickness: number;
  length: number;
  height: number;
  gap: number;
  intensity: number;
  definition: number;
};

export type BrowPreview = {
  path: string;
  strokePaths?: string[];
};

export type BrowStyle = {
  id: BrowStyleId;
  name: string;
  description: string;
  preview: BrowPreview;
  archBias: number;
  thicknessBias: number;
  lengthBias: number;
  softness: number;
  taper: number;
  density: number;
  edgeFade: number;
  strokeCount: number;
  hairStrokes: boolean;
};

export type DetectionStatus = "idle" | "loading" | "ready" | "failed";

export type DetectionResult = {
  status: DetectionStatus;
  message: string;
  placement?: BrowPlacement;
};
