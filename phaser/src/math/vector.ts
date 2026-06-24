import type { Vec2 } from "../domain/types";

export function normalize(x: number, y: number): Vec2 {
  const length = Math.hypot(x, y);
  if (length < 0.0001) return { x: 0, y: 0 };
  return { x: x / length, y: y / length };
}
