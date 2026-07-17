import { describe, expect, it } from "vitest";
import { SIMULATION_CONFIG } from "../config/gameConfig";
import type { Enemy, WeaponTypeId } from "../domain/types";
import { createWorld } from "./createWorld";
import {
  getAutoPilotReachableLaneHits,
  getAutoPilotWeaponStrategy,
} from "./autoPilotWeaponStrategy";

describe("getAutoPilotWeaponStrategy", () => {
  it("uses identical survival coefficients for every fair-profile weapon", () => {
    const strategies = (["pulse", "spread", "pierce"] as const).map((weaponType) =>
      getStrategy(weaponType, "fair")
    );
    const survivalKeys = [
      "openSpaceWeight",
      "healPriorityHpRatio",
      "criticalHpRatio",
      "projectileRiskMultiplier",
      "enemyRiskMultiplier",
      "rangedExposureMultiplier",
    ] as const;

    for (const key of survivalKeys) {
      expect(strategies.map((strategy) => strategy[key])).toEqual([
        strategies[0]![key],
        strategies[0]![key],
        strategies[0]![key],
      ]);
    }
    expect(strategies[0]!.preferredRange).not.toBe(strategies[1]!.preferredRange);
  });

  it("retains weapon-specific survival behavior for the ceiling profile", () => {
    const pulse = getStrategy("pulse", "ceiling");
    const spread = getStrategy("spread", "ceiling");

    expect(pulse.projectileRiskMultiplier).toBeGreaterThan(
      spread.projectileRiskMultiplier,
    );
    expect(pulse.healPriorityHpRatio).toBeGreaterThan(spread.healPriorityHpRatio);
  });

  it("counts only entered, in-range, unobstructed enemies in a firing lane", () => {
    const world = createWorld(SIMULATION_CONFIG);
    world.player.position = { x: 100, y: 270 };
    world.runtime.hitCapacityBonus = 1;
    const target = createEnemy("target", 300, true);
    const lined = createEnemy("lined", 430, true);
    const offscreen = createEnemy("offscreen", 360, false);
    const outOfRange = createEnemy("out-of-range", 800, true);
    world.enemies.push(target, lined, offscreen, outOfRange);
    const frame = createFrame(world, "ceiling");

    expect(
      getAutoPilotReachableLaneHits(frame, world.player.position, target),
    ).toBe(2);

    world.obstacles = [{ id: "cover", x: 350, y: 240, width: 35, height: 60 }];
    expect(
      getAutoPilotReachableLaneHits(frame, world.player.position, target),
    ).toBe(1);
  });
});

function getStrategy(
  weaponType: WeaponTypeId,
  profile: "fair" | "ceiling",
) {
  const world = createWorld(SIMULATION_CONFIG);
  world.state.weaponType = weaponType;
  return getAutoPilotWeaponStrategy(createFrame(world, profile));
}

function createFrame(
  world: ReturnType<typeof createWorld>,
  profile: "fair" | "ceiling",
) {
  return {
    world,
    config: SIMULATION_CONFIG,
    previousMove: { x: 0, y: 0 },
    previousAimTargetId: null,
    profile,
  };
}

function createEnemy(id: string, x: number, enteredArena: boolean): Enemy {
  const definition = SIMULATION_CONFIG.enemies.chaser;
  return {
    id,
    typeId: "chaser",
    position: { x, y: 270 },
    radius: definition.radius,
    hp: definition.hp,
    damage: definition.damage,
    speed: definition.speed,
    score: definition.score,
    xpValue: definition.xpValue,
    behavior: definition.behavior,
    attackTimer: 0,
    enteredArena,
  };
}
