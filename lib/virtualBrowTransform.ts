import type { BrowAnchor, BrowSide, CustomBrowSideTransform, Point } from "@/types/brow";

export function mirrorBrowTransform(transform: CustomBrowSideTransform): CustomBrowSideTransform {
  return { ...transform, rotation: -transform.rotation };
}

export function transformVirtualBrow(anchor: BrowAnchor, transform: CustomBrowSideTransform, eyeDistance: number, faceAngle: number, side: BrowSide): BrowAnchor {
  const center = { x: (anchor.start.x + anchor.tail.x) / 2, y: (anchor.start.y + anchor.tail.y) / 2 };
  const angle = Math.atan2(anchor.tail.y - anchor.start.y, anchor.tail.x - anchor.start.x);
  const c = Math.cos(angle), s = Math.sin(angle);
  const r = transform.rotation * 0.22, cr = Math.cos(r), sr = Math.sin(r);
  const direction = side === "left" ? -1 : 1;
  const dx = Math.cos(faceAngle) * direction * transform.offsetX * eyeDistance * 0.16 + Math.sin(faceAngle) * transform.offsetY * eyeDistance * 0.16;
  const dy = Math.sin(faceAngle) * direction * transform.offsetX * eyeDistance * 0.16 - Math.cos(faceAngle) * transform.offsetY * eyeDistance * 0.16;
  const move = (p: Point): Point => {
    const x = p.x - center.x, y = p.y - center.y;
    const u = (x * c + y * s) * transform.scaleX;
    const v = (-x * s + y * c) * transform.scaleY;
    const px = u * c - v * s, py = u * s + v * c;
    return { x: center.x + px * cr - py * sr + dx, y: center.y + px * sr + py * cr + dy };
  };
  return { start: move(anchor.start), arch: move(anchor.arch), tail: move(anchor.tail), contour: anchor.contour?.map(move) };
}
