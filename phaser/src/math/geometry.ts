import type { CircleBody, Obstacle } from "../domain/types";

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
  return dx * dx + dy * dy <= circle.radius * circle.radius;
}
