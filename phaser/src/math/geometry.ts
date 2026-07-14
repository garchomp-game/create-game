import type { CircleBody, Obstacle, Vec2 } from "../domain/types";

const GEOMETRY_EPSILON = 0.000001;

export type SegmentCircleIntersection = {
  t: number;
  position: Vec2;
};

export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function circleCircle(a: CircleBody, b: CircleBody): boolean {
  const dx = a.position.x - b.position.x;
  const dy = a.position.y - b.position.y;
  const rr = a.radius + b.radius;
  return dx * dx + dy * dy <= rr * rr;
}

export function circleRect(circle: CircleBody, rect: Obstacle): boolean {
  const closestX = clamp(circle.position.x, rect.x, rect.x + rect.width);
  const closestY = clamp(circle.position.y, rect.y, rect.y + rect.height);
  const dx = circle.position.x - closestX;
  const dy = circle.position.y - closestY;
  return dx * dx + dy * dy < circle.radius * circle.radius - 0.000001;
}

export function segmentCircleFirstIntersection(
  start: Vec2,
  end: Vec2,
  circle: CircleBody,
  movingRadius = 0,
): SegmentCircleIntersection | null {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const fx = start.x - circle.position.x;
  const fy = start.y - circle.position.y;
  const radius = circle.radius + movingRadius;
  const c = fx * fx + fy * fy - radius * radius;

  if (c <= GEOMETRY_EPSILON) {
    return { t: 0, position: { ...start } };
  }

  const a = dx * dx + dy * dy;
  if (a <= GEOMETRY_EPSILON) return null;

  const b = 2 * (fx * dx + fy * dy);
  const discriminant = b * b - 4 * a * c;
  if (discriminant < 0) return null;

  const root = Math.sqrt(discriminant);
  const first = (-b - root) / (2 * a);
  const second = (-b + root) / (2 * a);
  const t = first >= -GEOMETRY_EPSILON ? first : second;
  if (t < -GEOMETRY_EPSILON || t > 1 + GEOMETRY_EPSILON) return null;

  const clampedT = clamp(t, 0, 1);
  return {
    t: clampedT,
    position: {
      x: start.x + dx * clampedT,
      y: start.y + dy * clampedT,
    },
  };
}
