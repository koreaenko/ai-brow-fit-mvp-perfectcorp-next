export type BrowStyleId =
  | "natural-arch"
  | "straight"
  | "soft-arch"
  | "angular-arch"
  | "flat"
  | "full-hair"
  | "men-straight"
  | "men-natural";

export type Point = {
  x: number;
  y: number;
};

export type BrowSide = "left" | "right";
export type SelectedBrowSide = BrowSide | null;

export type BrowAnchor = {
  start: Point;
  arch: Point;
  tail: Point;
};

export type BrowGuidePoints = {
  faceCenter: Point;
  noseBridge: Point;
  noseTip: Point;
  mouthCenter: Point;
  leftNostril: Point;
  rightNostril: Point;
  leftEyeOuter: Point;
  rightEyeOuter: Point;
};

export type BrowPlacement = {
  left: BrowAnchor;
  right: BrowAnchor;
  angle: number;
  eyeDistance: number;
  guides?: BrowGuidePoints;
};

export type BrowControls = {
  color: BrowColorId;
  arch: number;
  thickness: number;
  length: number;
  height: number;
  gap: number;
  intensity: number;
  definition: number;
  baseMode: BrowBaseMode;
  renderMode: BrowRenderMode;
};

export type BrowDesignMode = "auto" | "custom";
export type BrowBaseMode = "keep" | "natural" | "strong";
export type BrowRenderMode = "auto" | "reshape" | "simulation";
export type BrowColorId = "ash-brown" | "natural-brown" | "dark-brown" | "soft-black";

export type CustomBrowSideTransform = {
  offsetX: number;
  offsetY: number;
  scaleX: number;
  scaleY: number;
  rotation: number;
  darkness: number;
  clarity: number;
};

export type CustomBrowTransform = Record<BrowSide, CustomBrowSideTransform>;

export type SavedCustomBrow = {
  id: string;
  name: string;
  src: string;
  savedAt: string;
};

export type BrowPreview = {
  path: string;
  strokePaths?: string[];
};

export type BrowStyle = {
  id: BrowStyleId;
  name: string;
  description: string;
  imageSrc: string;
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
