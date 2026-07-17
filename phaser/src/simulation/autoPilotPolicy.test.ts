import { describe, expect, it } from "vitest";
import { SIMULATION_CONFIG } from "../config/gameConfig";
import type { Enemy, WeaponTypeId } from "../domain/types";
import type { AutoPilotEnemyTarget } from "./autoPilotContracts";
import { getExpectedTtk } from "./autoPilotPolicy";
import { createWorld } from "./createWorld";

describe("getExpectedTtk", () => {
  it("accounts for multiple Spread projectiles hitting a close target", () => {
    const world = createWorld(SIMULATION_CONFIG);
    world.state.weaponType = "spread";
    world.state.shotTimer = 0.2;
    const close = createTarget(world, "spread", 50, 3);
    const far = createTarget(world, "spread", 300, 3);

    expect(getExpectedTtk(createFrame(world), close)).toBeLessThan(
      getExpectedTtk(createFrame(world), far),
    );
  });

  it("accounts for Pulse focus damage and current firing delay", () => {
    const world = createWorld(SIMULATION_CONFIG);
    world.state.weaponType = "pulse";
    world.runtime.pulseFocusBonusPerStack = 0.25;
    const target = createTarget(world, "pulse", 200, 5);
    target.enemy.pulseFocusStacks = 2;
    target.enemy.pulseFocusExpiresAt = 10;
    world.state.shotTimer = 0.3;
    const focusedWithDelay = getExpectedTtk(createFrame(world), target);

    world.state.shotTimer = 0;
    const focusedReady = getExpectedTtk(createFrame(world), target);
    target.enemy.pulseFocusStacks = 0;
    const unfocusedReady = getExpectedTtk(createFrame(world), target);

    expect(focusedWithDelay - focusedReady).toBeCloseTo(0.3);
    expect(focusedReady).toBeLessThan(unfocusedReady);
  });
});

function createFrame(world: ReturnType<typeof createWorld>) {
  return {
    world,
    config: SIMULATION_CONFIG,
    previousMove: { x: 0, y: 0 },
    previousAimTargetId: null,
  };
}

function createTarget(
  world: ReturnType<typeof createWorld>,
  weaponType: WeaponTypeId,
  distance: number,
  hp: number,
): AutoPilotEnemyTarget {
  const definition = SIMULATION_CONFIG.enemies.chaser;
  const enemy: Enemy = {
    id: `${weaponType}-${distance}`,
    typeId: "chaser",
    position: {
      x: world.player.position.x + distance,
      y: world.player.position.y,
    },
    radius: definition.radius,
    hp,
    damage: definition.damage,
    speed: definition.speed,
    score: definition.score,
    xpValue: definition.xpValue,
    behavior: definition.behavior,
    attackTimer: 0,
    enteredArena: true,
  };
  return { enemy, distance, visible: true, inRange: true };
}
