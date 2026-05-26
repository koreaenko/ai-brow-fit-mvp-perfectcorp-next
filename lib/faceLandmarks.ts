import type { BrowAnchor, BrowPlacement, Point } from "@/types/brow";

type Landmark = {
  x: number;
  y: number;
  z?: number;
};

type FaceLandmarkerLike = {
  detect: (image: HTMLImageElement | HTMLCanvasElement | HTMLVideoElement) => {
    faceLandmarks: Landmark[][];
  };
};

let landmarkerPromise: Promise<FaceLandmarkerLike> | null = null;

function getImageSize(image: HTMLImageElement | HTMLCanvasElement | HTMLVideoElement) {
  if (image instanceof HTMLVideoElement) {
    return { width: image.videoWidth, height: image.videoHeight };
  }

  if (image instanceof HTMLImageElement) {
    return { width: image.naturalWidth, height: image.naturalHeight };
  }

  return { width: image.width, height: image.height };
}

function toPoint(landmark: Landmark, width: number, height: number): Point {
  return {
    x: landmark.x * width,
    y: landmark.y * height,
  };
}

function pointAt(landmarks: Landmark[], index: number, width: number, height: number): Point | null {
  const landmark = landmarks[index];
  return landmark ? toPoint(landmark, width, height) : null;
}

function distance(a: Point, b: Point) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

async function getFaceLandmarker(): Promise<FaceLandmarkerLike> {
  if (!landmarkerPromise) {
    landmarkerPromise = import("@mediapipe/tasks-vision").then(
      async ({ FaceLandmarker, FilesetResolver }) => {
        const fileset = await FilesetResolver.forVisionTasks(
          "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.22-rc.20250304/wasm",
        );
        const options = {
          baseOptions: {
            modelAssetPath:
              "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/latest/face_landmarker.task",
            delegate: "GPU",
          },
          runningMode: "IMAGE",
          numFaces: 1,
        } as const;

        try {
          return await FaceLandmarker.createFromOptions(fileset, options);
        } catch {
          // Some mobile browsers expose WebGL in ways MediaPipe cannot use for GPU
          // delegation. CPU mode is slower, but keeps the MVP usable.
          return FaceLandmarker.createFromOptions(fileset, {
            ...options,
            baseOptions: {
              ...options.baseOptions,
              delegate: "CPU",
            },
          });
        }
      },
    );
  }

  return landmarkerPromise;
}

function buildEyePairs(landmarks: Landmark[], width: number, height: number) {
  // MediaPipe Face Mesh eye-corner indices. Each pair is normalized again below so
  // "inner" always means the point closer to the nose bridge in the displayed image.
  const first = [33, 133].map((index) => toPoint(landmarks[index], width, height));
  const second = [263, 362].map((index) => toPoint(landmarks[index], width, height));
  const centerX =
    [...first, ...second].reduce((sum, point) => sum + point.x, 0) / 4;

  return [first, second].map((pair) => {
    const [a, b] = pair;
    const inner = Math.abs(a.x - centerX) < Math.abs(b.x - centerX) ? a : b;
    const outer = inner === a ? b : a;
    const center = {
      x: (inner.x + outer.x) / 2,
      y: (inner.y + outer.y) / 2,
    };

    return { inner, outer, center, width: distance(inner, outer) };
  });
}

function createBrowForEye(
  eye: ReturnType<typeof buildEyePairs>[number],
  side: "left" | "right",
  angle: number,
  eyeDistance: number,
): BrowAnchor {
  const axis = { x: Math.cos(angle), y: Math.sin(angle) };
  const up = { x: -Math.sin(angle), y: -Math.cos(angle) };
  const outwardSign = side === "left" ? -1 : 1;
  const browLift = eyeDistance * 0.265;
  const innerInset = eyeDistance * 0.055;
  const tailOut = eyeDistance * 0.17;

  const shift = (point: Point, along: number, lift: number): Point => ({
    x: point.x + axis.x * along + up.x * lift,
    y: point.y + axis.y * along + up.y * lift,
  });

  const start = shift(eye.inner, outwardSign * -innerInset, browLift);
  const tail = shift(eye.outer, outwardSign * tailOut, browLift * 0.94);
  const archBase = {
    x: eye.center.x * 0.32 + eye.outer.x * 0.68,
    y: eye.center.y * 0.32 + eye.outer.y * 0.68,
  };
  const arch = shift(archBase, outwardSign * eyeDistance * 0.012, browLift * 1.12);

  return { start, arch, tail };
}

export async function detectFacePlacement(
  image: HTMLImageElement | HTMLCanvasElement | HTMLVideoElement,
): Promise<BrowPlacement> {
  const landmarker = await getFaceLandmarker();
  const { width, height } = getImageSize(image);
  const result = landmarker.detect(image);
  const landmarks = result.faceLandmarks[0];

  if (!landmarks) {
    throw new Error("얼굴을 정면에 가깝게 올려주세요.");
  }

  const [eyeA, eyeB] = buildEyePairs(landmarks, width, height).sort(
    (a, b) => a.center.x - b.center.x,
  );
  const eyeDistance = distance(eyeA.center, eyeB.center);
  const angle = Math.atan2(eyeB.center.y - eyeA.center.y, eyeB.center.x - eyeA.center.x);
  const noseBridge = pointAt(landmarks, 168, width, height) ?? {
    x: (eyeA.inner.x + eyeB.inner.x) / 2,
    y: (eyeA.inner.y + eyeB.inner.y) / 2,
  };
  const noseTip = pointAt(landmarks, 1, width, height) ?? {
    x: noseBridge.x,
    y: noseBridge.y + eyeDistance * 0.95,
  };
  const upperLip = pointAt(landmarks, 13, width, height);
  const lowerLip = pointAt(landmarks, 14, width, height);
  const mouthCenter =
    upperLip && lowerLip
      ? { x: (upperLip.x + lowerLip.x) / 2, y: (upperLip.y + lowerLip.y) / 2 }
      : { x: noseTip.x, y: noseTip.y + eyeDistance * 0.62 };
  const nostrilA = pointAt(landmarks, 49, width, height) ?? {
    x: noseTip.x - eyeDistance * 0.18,
    y: noseTip.y + eyeDistance * 0.1,
  };
  const nostrilB = pointAt(landmarks, 279, width, height) ?? {
    x: noseTip.x + eyeDistance * 0.18,
    y: noseTip.y + eyeDistance * 0.1,
  };
  const [leftNostril, rightNostril] =
    nostrilA.x <= nostrilB.x ? [nostrilA, nostrilB] : [nostrilB, nostrilA];

  return {
    left: createBrowForEye(eyeA, "left", angle, eyeDistance),
    right: createBrowForEye(eyeB, "right", angle, eyeDistance),
    angle,
    eyeDistance,
    guides: {
      faceCenter: {
        x: (noseBridge.x + noseTip.x + mouthCenter.x) / 3,
        y: (noseBridge.y + noseTip.y + mouthCenter.y) / 3,
      },
      noseBridge,
      noseTip,
      mouthCenter,
      leftNostril,
      rightNostril,
      leftEyeOuter: eyeA.outer,
      rightEyeOuter: eyeB.outer,
    },
  };
}
