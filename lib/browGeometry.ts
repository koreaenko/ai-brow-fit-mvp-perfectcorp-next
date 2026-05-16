import type {
  BrowAnchor,
  BrowControls,
  BrowPlacement,
  BrowSide,
  BrowStyle,
  Point,
} from "@/types/brow";

function add(point: Point, delta: Point): Point {
  return { x: point.x + delta.x, y: point.y + delta.y };
}

function scale(vector: Point, amount: number): Point {
  return { x: vector.x * amount, y: vector.y * amount };
}

export function getAxis(angle: number): Point {
  return { x: Math.cos(angle), y: Math.sin(angle) };
}

export function getUpNormal(angle: number): Point {
  return { x: -Math.sin(angle), y: -Math.cos(angle) };
}

export function adjustBrowAnchor(
  base: BrowAnchor,
  side: BrowSide,
  angle: number,
  eyeDistance: number,
  controls: BrowControls,
  style: BrowStyle,
): BrowAnchor {
  const axis = getAxis(angle);
  const up = getUpNormal(angle);
  const outward = side === "left" ? scale(axis, -1) : axis;

  const heightShift = scale(up, controls.height * eyeDistance * 0.065);
  const gapShift = scale(outward, controls.gap * eyeDistance * 0.04);
  const lengthShift = scale(outward, (controls.length + style.lengthBias) * eyeDistance * 0.09);
  const archShift = scale(
    up,
    (controls.arch + style.archBias) * eyeDistance * 0.08,
  );

  return {
    start: add(add(base.start, heightShift), gapShift),
    arch: add(add(base.arch, heightShift), archShift),
    tail: add(add(add(base.tail, heightShift), lengthShift), scale(up, style.archBias * eyeDistance * 0.018)),
  };
}

export function createFallbackPlacement(width: number, height: number): BrowPlacement {
  const eyeDistance = width * 0.24;
  const angle = 0;
  const y = height * 0.42;
  const leftCenter = { x: width * 0.38, y };
  const rightCenter = { x: width * 0.62, y };
  const makeAnchor = (center: Point, side: BrowSide): BrowAnchor => {
    const direction = side === "left" ? -1 : 1;
    return {
      start: { x: center.x + direction * eyeDistance * 0.18, y: center.y - eyeDistance * 0.35 },
      arch: { x: center.x + direction * eyeDistance * 0.1, y: center.y - eyeDistance * 0.43 },
      tail: { x: center.x + direction * eyeDistance * 0.42, y: center.y - eyeDistance * 0.37 },
    };
  };

  return {
    left: makeAnchor(leftCenter, "left"),
    right: makeAnchor(rightCenter, "right"),
    angle,
    eyeDistance,
  };
}

export function mirrorBrowPlacement(placement: BrowPlacement): BrowPlacement {
  const centerX =
    (placement.left.start.x +
      placement.left.tail.x +
      placement.right.start.x +
      placement.right.tail.x) /
    4;

  const mirrorPoint = (point: Point): Point => ({
    x: centerX + (centerX - point.x),
    y: point.y,
  });

  // The left brow is used as a calm source of truth when the user asks for symmetry.
  return {
    ...placement,
    right: {
      start: mirrorPoint(placement.left.start),
      arch: mirrorPoint(placement.left.arch),
      tail: mirrorPoint(placement.left.tail),
    },
  };
}
