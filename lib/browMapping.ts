import type { BrowPlacement, Point } from "@/types/brow";

// ABH mapping: nostril vertical, nose-tip through iris, nostril through outer eye.
// https://www.anastasiabeverlyhills.com/pages/the-golden-ratio
// Photo landmarks are estimates; these are reference points, not clinical measurements.
export function mapBrowGuides(placement: BrowPlacement) {
  const g = placement.guides;
  if (!g?.leftIris || !g.rightIris) return null;
  const down = { x: -Math.sin(placement.angle), y: Math.cos(placement.angle) };
  const axis = { x: Math.cos(placement.angle), y: Math.sin(placement.angle) };
  const dot = (p: Point) => p.x * down.x + p.y * down.y;
  const intersect = (base: Point, through: Point, level: Point): Point => {
    const d = { x: through.x - base.x, y: through.y - base.y };
    const denominator = dot(d);
    if (Math.abs(denominator) < 1e-6) return level;
    const t = (dot(level) - dot(base)) / denominator;
    return { x: base.x + t * d.x, y: base.y + t * d.y };
  };
  const sides = (["left", "right"] as const).map(side => {
    const brow = placement[side];
    const base = side === "left" ? g.leftNostril : g.rightNostril;
    const startBase = (side === "left" ? g.leftNostrilCenter : g.rightNostrilCenter) ?? base;
    const iris = side === "left" ? g.leftIris! : g.rightIris!;
    const outer = side === "left" ? g.leftEyeOuter : g.rightEyeOuter;
    return { side, base, startBase, start: intersect(startBase, { x: startBase.x - down.x, y: startBase.y - down.y }, brow.start),
      arch: intersect(g.noseTip, iris, brow.arch), tail: intersect(base, outer, brow.tail) };
  });
  const length = Math.hypot(g.noseTip.x - g.noseBridge.x, g.noseTip.y - g.noseBridge.y);
  const centerDirection = length > 1 ? { x: (g.noseTip.x - g.noseBridge.x) / length, y: (g.noseTip.y - g.noseBridge.y) / length } : down;
  const centerTop = { x: g.noseBridge.x - centerDirection.x * placement.eyeDistance * 0.65, y: g.noseBridge.y - centerDirection.y * placement.eyeDistance * 0.65 };
  const centerBottom = g.noseTip;
  const level = { x: (placement.left.start.x + placement.right.start.x) / 2, y: (placement.left.start.y + placement.right.start.y) / 2 };
  const baselineCenter = intersect(g.noseBridge, g.noseTip, level);
  return { sides, centerTop, centerBottom, baselineCenter, axis, noseTip: g.noseTip };
}
