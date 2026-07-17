import { describe, expect, it } from "vitest";
import { SIMULATION_CONFIG } from "../config/gameConfig";
import type { EnemyProjectile } from "../domain/types";
import { createWorld } from "./createWorld";
import { ROT_AUTO_PILOT_NAVIGATION } from "./autoPilotNavigation";
import {
  assessProjectileThreat,
  estimateEnemyVelocity,
  getTimeToCircleCollision,
} from "./autoPilotThreat";

describe("assessProjectileThreat", () => {
  it("assigns no future risk to a projectile moving away", () => {
    const world = createWorld(SIMULATION_CONFIG);
    const projectile = createProjectile(world.player.position.x + 45, 180);
    const threat = assessProjectileThreat(
      createFrame(world),
      projectile,
      { x: 0, y: 0 },
    );

    expect(threat.approaching).toBe(false);
    expect(threat.collisionTime).toBeNull();
    expect(threat.minimumClearance).toBe(Number.POSITIVE_INFINITY);
    expect(threat.risk).toBe(0);
  });

  it("uses player velocity when determining relative approach", () => {
    const world = createWorld(SIMULATION_CONFIG);
    const projectile = createProjectile(world.player.position.x + 80, 100);
    const threat = assessProjectileThreat(
      createFrame(world),
      projectile,
      { x: 220, y: 0 },
    );

    expect(threat.approaching).toBe(true);
    expect(threat.collisionTime).not.toBeNull();
    expect(threat.risk).toBeGreaterThan(0);
  });

  it("predicts a blocked enemy along the navigation path", () => {
    const world = createWorld(SIMULATION_CONFIG);
    world.player.position = { x: 180, y: 270 };
    world.obstacles = [{ id: "wall", x: 220, y: 150, width: 120, height: 240 }];
    const definition = SIMULATION_CONFIG.enemies.chaser;
    const enemy = {
      id: "blocked-enemy",
      typeId: "chaser" as const,
      position: { x: 420, y: 270 },
      radius: definition.radius,
      hp: definition.hp,
      damage: definition.damage,
      speed: definition.speed,
      score: definition.score,
      xpValue: definition.xpValue,
      behavior: definition.behavior,
      attackTimer: 0,
      enteredArena: true,
    };

    const velocity = estimateEnemyVelocity(
      createFrame(world),
      enemy,
      world.player.position,
      ROT_AUTO_PILOT_NAVIGATION,
    );

    expect(velocity.x).toBeLessThan(0);
    expect(Math.abs(velocity.y)).toBeGreaterThan(1);
  });

  it("detects a fast crossing collision analytically between samples", () => {
    expect(
      getTimeToCircleCollision(
        { x: 100, y: -100 },
        { x: -200, y: 200 },
        20,
        1,
      ),
    ).not.toBeNull();
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

function createProjectile(x: number, velocityX: number): EnemyProjectile {
  return {
    id: "projectile",
    position: { x, y: SIMULATION_CONFIG.arena.height / 2 },
    radius: 5,
    velocity: { x: velocityX, y: 0 },
    lifetime: 2,
    damage: 8,
  };
}
