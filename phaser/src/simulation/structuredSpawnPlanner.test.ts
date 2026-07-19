import { describe, expect, it } from "vitest";
import type { EncounterDirection } from "../domain/encounterDirector";
import type { StructuredSpawnRequest } from "../domain/structuredSpawning";
import { createRandom } from "../math/random";
import {
  getGeometryDirections,
  hasTelegraphLeadTime,
  planStructuredSpawn,
} from "./structuredSpawnPlanner";

describe("structuredSpawnPlanner", () => {
  it.each(["arc", "pincer", "escort"] as const)(
    "creates deterministic safe placements for %s geometry",
    (geometryId) => {
      const first = planStructuredSpawn(createRequest({ geometryId }), createRandom(402));
      const second = planStructuredSpawn(createRequest({ geometryId }), createRandom(402));

      expect(second).toEqual(first);
      expect(first.status).toBe("ready");
      expect(first.placements).toHaveLength(6);
      expect(first.metrics.acceptedCount).toBe(6);
      expect(first.placements.every((placement) => isOutsideArena(placement.position))).toBe(true);
      expect(first.placements.every((placement) => isInsideArena(placement.entryPoint))).toBe(true);
      expect(new Set(first.telegraph.directions).size).toBeLessThanOrEqual(2);
      expect(hasTelegraphLeadTime(first)).toBe(true);
    },
  );

  it("keeps a perpendicular escape axis for pincer formations", () => {
    for (const direction of ["north", "east", "south", "west"] as EncounterDirection[]) {
      const directions = getGeometryDirections("pincer", direction);
      expect(directions).toHaveLength(2);
      expect(new Set(directions).size).toBe(2);
      expect(directions).not.toContain(
        direction === "north" || direction === "south" ? "east" : "north",
      );
    }
  });

  it("rejects obstacle and unreachable entry paths independently", () => {
    const blockedByObstacle = planStructuredSpawn(
      createRequest({
        geometryId: "arc",
        direction: "north",
        count: 5,
        minimumPlayerDistance: 0,
        obstacles: [{ id: "north-wall", x: 0, y: 0, width: 960, height: 90 }],
        fallbackGeometryId: undefined,
      }),
      createRandom(19),
    );
    expect(blockedByObstacle.status).toBe("deferred");
    expect(blockedByObstacle.metrics.rejectedByReason.obstacle).toBeGreaterThan(0);

    const unreachable = planStructuredSpawn(
      createRequest({
        minimumPlayerDistance: 0,
        obstacles: [],
        isReachable: () => false,
      }),
      createRandom(19),
    );
    expect(unreachable.status).toBe("deferred");
    expect(unreachable.metrics.rejectedByReason.unreachable).toBeGreaterThan(0);
  });

  it("never accepts points inside the collapse inset or minimum player distance", () => {
    const collapsed = planStructuredSpawn(
      createRequest({ collapseInset: 270, minimumPlayerDistance: 0 }),
      createRandom(31),
    );
    expect(collapsed.status).toBe("deferred");
    expect(collapsed.metrics.rejectedByReason.outsideActiveArea).toBeGreaterThan(0);

    const distanceLimited = planStructuredSpawn(
      createRequest({
        direction: "north",
        playerPosition: { x: 480, y: 30 },
        minimumPlayerDistance: 300,
        fallbackGeometryId: undefined,
      }),
      createRandom(31),
    );
    expect(distanceLimited.placements.every((placement) =>
      Math.hypot(
        placement.entryPoint.x - 480,
        placement.entryPoint.y - 30,
      ) >= 300
    )).toBe(true);
    expect(distanceLimited.metrics.rejectedByReason.playerDistance).toBeGreaterThan(0);
  });

  it("never changes the warned direction when a fallback geometry is attempted", () => {
    const plan = planStructuredSpawn(
      createRequest({
        geometryId: "arc",
        fallbackGeometryId: "perimeter-random",
        direction: "north",
        obstacles: [{ id: "north-wall", x: 0, y: 0, width: 960, height: 80 }],
        isReachable: (point) => point.y > 100,
      }),
      createRandom(75),
    );

    expect(plan.status).toBe("deferred");
    expect(plan.metrics.fallbackUsed).toBe(true);
    expect(plan.telegraph.directions).toEqual(["north"]);
    expect(plan.placements).toEqual([]);
  });

  it("uses the primary enemy radius for safety without shifting its spawn position", () => {
    const base = planStructuredSpawn(
      createRequest({ count: 1, obstacles: [], minimumPlayerDistance: 0 }),
      createRandom(91),
    );
    const primary = planStructuredSpawn(
      createRequest({
        count: 1,
        obstacles: [],
        minimumPlayerDistance: 0,
        primaryEnemyRadius: 20,
      }),
      createRandom(91),
    );

    expect(primary.status).toBe("ready");
    expect(primary.placements[0]!.position).toEqual(base.placements[0]!.position);
    expect(primary.placements[0]!.entryPoint.x).toBeLessThan(
      base.placements[0]!.entryPoint.x,
    );

    const overlapping = planStructuredSpawn(
      createRequest({
        count: 1,
        obstacles: [],
        minimumPlayerDistance: 0,
        fallbackGeometryId: undefined,
        primaryEnemyRadius: 48,
      }),
      createRandom(91),
    );
    expect(overlapping.status).toBe("deferred");
    expect(overlapping.metrics.rejectedByReason.insideArena).toBeGreaterThan(0);
  });

  it("shrinks to the existing enemy cap without exceeding it", () => {
    const plan = planStructuredSpawn(
      createRequest({ count: 12, existingEnemyCount: 58, maximumEnemies: 60 }),
      createRandom(8),
    );

    expect(plan.status).toBe("ready");
    expect(plan.metrics.capacity).toBe(2);
    expect(plan.placements).toHaveLength(2);
    expect(58 + plan.placements.length).toBeLessThanOrEqual(60);

    const capped = planStructuredSpawn(
      createRequest({ existingEnemyCount: 60, maximumEnemies: 60 }),
      createRandom(8),
    );
    expect(capped.status).toBe("deferred");
    expect(capped.deferReason).toBe("enemyCap");
  });

  it("marks short warning windows as unsafe for presentation", () => {
    const plan = planStructuredSpawn(
      createRequest({ telegraphStartedAt: 10, spawnAt: 10.4 }),
      createRandom(1),
    );
    expect(plan.status).toBe("deferred");
    expect(plan.deferReason).toBe("insufficientTelegraph");
    expect(hasTelegraphLeadTime(plan)).toBe(false);
  });
});

function createRequest(
  overrides: Partial<StructuredSpawnRequest> = {},
): StructuredSpawnRequest {
  return {
    geometryId: "arc",
    fallbackGeometryId: "perimeter-random",
    direction: "east",
    count: 6,
    arena: {
      width: 960,
      height: 540,
      playerStart: { x: 480, y: 270 },
    },
    obstacles: [
      { id: "block-a", x: 220, y: 148, width: 120, height: 32 },
      { id: "block-b", x: 620, y: 148, width: 120, height: 32 },
    ],
    playerPosition: { x: 480, y: 270 },
    enemyRadius: 14,
    minimumPlayerDistance: 180,
    spawnMargin: 32,
    collapseInset: 0,
    existingEnemyCount: 10,
    maximumEnemies: 60,
    telegraphStartedAt: 20,
    spawnAt: 21,
    ...overrides,
  };
}

function isOutsideArena(position: { x: number; y: number }): boolean {
  return position.x < 0 || position.x > 960 || position.y < 0 || position.y > 540;
}

function isInsideArena(position: { x: number; y: number }): boolean {
  return position.x >= 0 && position.x <= 960 && position.y >= 0 && position.y <= 540;
}
