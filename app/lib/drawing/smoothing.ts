import type { DrawingPoint } from "./types";

// One-Euro-style low-pass: each new raw point is blended with the previous
// smoothed point. Higher alpha = more responsive, less smoothing. ~0.4 is a
// good default for finger/mouse input that doesn't introduce visible lag.
export function lowPass(
  prev: DrawingPoint | null,
  next: DrawingPoint,
  alpha: number,
): DrawingPoint {
  if (!prev) return next;
  return {
    x: prev.x + (next.x - prev.x) * alpha,
    y: prev.y + (next.y - prev.y) * alpha,
    p:
      typeof next.p === "number" || typeof prev.p === "number"
        ? (prev.p ?? next.p ?? 0.5) +
          ((next.p ?? prev.p ?? 0.5) - (prev.p ?? next.p ?? 0.5)) * alpha
        : undefined,
    t: next.t,
  };
}

// Sample a Catmull-Rom spline through (p1, p2) given context points (p0, p3).
// Tension 0.5 gives a centripetal curve that looks natural over jittery input.
export function catmullRom(
  p0: DrawingPoint,
  p1: DrawingPoint,
  p2: DrawingPoint,
  p3: DrawingPoint,
  steps: number,
): DrawingPoint[] {
  const out: DrawingPoint[] = [];
  for (let i = 1; i <= steps; i += 1) {
    const t = i / steps;
    const t2 = t * t;
    const t3 = t2 * t;
    const x =
      0.5 *
      (2 * p1.x +
        (-p0.x + p2.x) * t +
        (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 +
        (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3);
    const y =
      0.5 *
      (2 * p1.y +
        (-p0.y + p2.y) * t +
        (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2 +
        (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t3);
    const pressure = lerp(p1.p ?? 0.5, p2.p ?? 0.5, t);
    const time = lerp(p1.t ?? 0, p2.t ?? 0, t);
    out.push({ x, y, p: pressure, t: time });
  }
  return out;
}

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

// Total Euclidean length of a polyline.
export function pathLength(points: DrawingPoint[]): number {
  let length = 0;
  for (let i = 1; i < points.length; i += 1) {
    const dx = points[i].x - points[i - 1].x;
    const dy = points[i].y - points[i - 1].y;
    length += Math.hypot(dx, dy);
  }
  return length;
}

// Ramer-Douglas-Peucker simplification — drops points that don't change the
// shape much. We use it before serializing strokes for storage so payloads
// stay small. Returns a fresh array; preserves first and last points.
export function simplify(
  points: DrawingPoint[],
  tolerance: number,
): DrawingPoint[] {
  if (points.length <= 2) return points.slice();
  const result: DrawingPoint[] = [];
  rdp(points, 0, points.length - 1, tolerance * tolerance, result);
  result.push(points[points.length - 1]);
  return result;
}

function rdp(
  points: DrawingPoint[],
  first: number,
  last: number,
  tol2: number,
  out: DrawingPoint[],
) {
  let maxDist = 0;
  let index = first;
  const a = points[first];
  const b = points[last];

  for (let i = first + 1; i < last; i += 1) {
    const d2 = pointSegmentDist2(points[i], a, b);
    if (d2 > maxDist) {
      maxDist = d2;
      index = i;
    }
  }

  if (maxDist > tol2) {
    rdp(points, first, index, tol2, out);
    rdp(points, index, last, tol2, out);
  } else {
    out.push(a);
  }
}

function pointSegmentDist2(p: DrawingPoint, a: DrawingPoint, b: DrawingPoint) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len2 = dx * dx + dy * dy;
  if (len2 === 0) {
    const ex = p.x - a.x;
    const ey = p.y - a.y;
    return ex * ex + ey * ey;
  }
  let t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2;
  t = Math.max(0, Math.min(1, t));
  const sx = a.x + dx * t - p.x;
  const sy = a.y + dy * t - p.y;
  return sx * sx + sy * sy;
}
