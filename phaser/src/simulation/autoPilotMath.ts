import type { SimulationConfig, Vec2 } from "../domain/types";

export function isPointInsideArena(
  point: Vec2,
  clearance: number,
  config: SimulationConfig,
): boolean {
  return (
    point.x >= clearance &&
    point.x <= config.arena.width - clearance &&
    point.y >= clearance &&
    point.y <= config.arena.height - clearance
  );
}

export function clampPointToArena(
  point: Vec2,
  clearance: number,
  config: SimulationConfig,
): Vec2 {
  return {
    x: clamp(point.x, clearance, config.arena.width - clearance),
    y: clamp(point.y, clearance, config.arena.height - clearance),
  };
}

export function getArenaEdgeClearance(point: Vec2, config: SimulationConfig): number {
  return Math.min(
    point.x,
    config.arena.width - point.x,
    point.y,
    config.arena.height - point.y,
  );
}

export function distanceBetween(first: Vec2, second: Vec2): number {
  return Math.hypot(first.x - second.x, first.y - second.y);
}

export function dot(first: Vec2, second: Vec2): number {
  return first.x * second.x + first.y * second.y;
}

export function lengthSquared(vector: Vec2): number {
  return vector.x * vector.x + vector.y * vector.y;
}

export function clamp(value: number, minimum: number, maximum: number): number {
  return Math.max(minimum, Math.min(maximum, value));
}

export function hashParity(value: string): number {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) | 0;
  }
  return Math.abs(hash) % 2;
}
