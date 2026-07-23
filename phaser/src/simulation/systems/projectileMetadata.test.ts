import { describe, expect, it } from "vitest";
import { SIMULATION_CONFIG } from "../../config/gameConfig";
import type { GameEvent, SimulationConfig } from "../../domain/types";
import { createWorld } from "../createWorld";
import {
  getProjectileRole,
  updateShooting,
} from "./shootingSystem";

const CANDIDATE_CONFIG: SimulationConfig = {
  ...SIMULATION_CONFIG,
  features: {
    ...SIMULATION_CONFIG.features,
    exProtocols: true,
  },
  exProtocolOfferPolicy: "fixed-compatible",
};

describe("candidate projectile metadata", () => {
  it("keeps legacy bullets on their exact field shape when the feature is off", () => {
    const world = createWorld(SIMULATION_CONFIG);
    const events: GameEvent[] = [];

    updateShooting(world, true, SIMULATION_CONFIG, events);

    expect(world.bullets).toHaveLength(1);
    expect(world.bullets[0]).not.toHaveProperty("candidate");
  });

  it("assigns deterministic role and capacity metadata to candidate volleys", () => {
    const world = createWorld(CANDIDATE_CONFIG);
    world.state.weaponType = "spread";
    world.runtime.projectileCountBonus = 2;
    world.runtime.hitCapacityBonus = 3;
    const events: GameEvent[] = [];

    updateShooting(world, true, CANDIDATE_CONFIG, events);

    expect(world.bullets.map((bullet) => bullet.candidate)).toEqual([
      expect.objectContaining({
        creationOrdinal: 1,
        hitCapacityAtFire: 4,
        projectileIndex: 0,
        projectileCount: 5,
        projectileRole: "edge",
        volleyKind: "normal",
      }),
      expect.objectContaining({
        creationOrdinal: 2,
        projectileIndex: 1,
        projectileRole: "inner",
      }),
      expect.objectContaining({
        creationOrdinal: 3,
        projectileIndex: 2,
        projectileRole: "center",
      }),
      expect.objectContaining({
        creationOrdinal: 4,
        projectileIndex: 3,
        projectileRole: "inner",
      }),
      expect.objectContaining({
        creationOrdinal: 5,
        projectileIndex: 4,
        projectileRole: "edge",
      }),
    ]);
  });

  it("classifies roles without assuming a five-projectile Spread volley", () => {
    expect([0, 1, 2, 3].map((index) => getProjectileRole(index, 4))).toEqual([
      "edge",
      "inner",
      "inner",
      "edge",
    ]);
    expect(getProjectileRole(0, 1)).toBe("center");
  });
});
