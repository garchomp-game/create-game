import { describe, expect, it } from "vitest";
import { SIMULATION_CONFIG } from "../config/gameConfig";
import type { Enemy, Vec2 } from "../domain/types";
import { segmentCircleFirstIntersection } from "../math/geometry";
import { EnemySpatialIndex } from "./EnemySpatialIndex";

describe("EnemySpatialIndex", () => {
  it("never excludes an exact segment-circle hit", () => {
    const enemies = Array.from({ length: 96 }, (_, index) =>
      createEnemy(
        index,
        {
          x: -32 + (index % 12) * 92,
          y: -24 + Math.floor(index / 12) * 82,
        },
        6 + (index % 4) * 4,
      ),
    );
    const index = new EnemySpatialIndex(enemies);
    const segments = [
      [{ x: -40, y: 20 }, { x: 1_000, y: 520 }],
      [{ x: 480, y: -40 }, { x: 480, y: 600 }],
      [{ x: 950, y: 50 }, { x: -20, y: 50 }],
      [{ x: 200, y: 200 }, { x: 200, y: 200 }],
    ] satisfies [Vec2, Vec2][];

    for (const [start, end] of segments) {
      const candidates = new Set(
        index.querySegment(start, end, 7).map(({ enemy }) => enemy.id),
      );
      const exactHits = enemies.filter(
        (enemy) =>
          segmentCircleFirstIntersection(start, end, enemy, 7) !== null,
      );
      for (const enemy of exactHits) expect(candidates.has(enemy.id)).toBe(true);
    }
  });

  it("keeps original enemy indexes for deterministic hit tie-breaking", () => {
    const enemies = [
      createEnemy(0, { x: 100, y: 100 }, 10),
      createEnemy(1, { x: 110, y: 100 }, 10),
      createEnemy(2, { x: 120, y: 100 }, 10),
    ];

    expect(
      new EnemySpatialIndex(enemies, 32)
        .querySegment({ x: 80, y: 100 }, { x: 140, y: 100 }, 2)
        .map(({ index }) => index)
        .sort((left, right) => left - right),
    ).toEqual([0, 1, 2]);
  });
});

function createEnemy(index: number, position: Vec2, radius: number): Enemy {
  const definition = SIMULATION_CONFIG.enemies.chaser;
  return {
    id: `spatial-enemy-${index}`,
    typeId: "chaser",
    position,
    radius,
    hp: definition.hp,
    damage: definition.damage,
    speed: definition.speed,
    score: definition.score,
    xpValue: definition.xpValue,
    behavior: definition.behavior,
    attackTimer: 0,
    enteredArena: true,
  };
}
