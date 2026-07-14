import { describe, expect, it } from "vitest";
import { SIMULATION_CONFIG } from "../config/gameConfig";
import type { Enemy, GameEvent, SimulationConfig } from "../domain/types";
import { circleRect } from "../math/geometry";
import { createWorld } from "./createWorld";
import {
  getEnemyApproachNavigation,
  getPointNavigation,
  hasClearNavigationPath,
} from "./navigationField";
import { updateEnemies } from "./systems/enemySystem";

describe("enemy navigation field", () => {
  it("keeps direct pursuit when the player is visible", () => {
    const world = createWorld(SIMULATION_CONFIG);
    world.obstacles = [];
    world.player.position = { x: 480, y: 270 };
    const enemy = createEnemy({ x: 240, y: 270 });

    const result = getEnemyApproachNavigation(
      world,
      enemy,
      SIMULATION_CONFIG,
    );

    expect(result).toMatchObject({ direction: { x: 1, y: 0 }, mode: "direct" });
    expect(result.fieldBuilt).toBe(false);
  });

  it("selects a deterministic detour when a wall blocks the direct route", () => {
    const first = createBlockedWorld();
    const second = createBlockedWorld();
    const firstEnemy = createEnemy({ x: 180, y: 270 });
    const secondEnemy = createEnemy({ x: 180, y: 270 });

    expect(
      hasClearNavigationPath(
        firstEnemy.position,
        first.player.position,
        firstEnemy.radius,
        first.obstacles,
      ),
    ).toBe(false);
    const firstResult = getEnemyApproachNavigation(
      first,
      firstEnemy,
      SIMULATION_CONFIG,
    );
    const secondResult = getEnemyApproachNavigation(
      second,
      secondEnemy,
      SIMULATION_CONFIG,
    );

    expect(firstResult.mode).toBe("path");
    expect(Math.abs(firstResult.direction.y)).toBeGreaterThan(0.1);
    expect(firstResult.direction).toEqual(secondResult.direction);
  });

  it("routes the player toward an arbitrary point around cover", () => {
    const world = createBlockedWorld();
    const start = { x: 180, y: 270 };
    const target = { x: 380, y: 270 };

    const result = getPointNavigation(
      world,
      start,
      target,
      SIMULATION_CONFIG.player.radius,
      SIMULATION_CONFIG,
    );

    expect(result.mode).toBe("path");
    expect(Math.abs(result.direction.y)).toBeGreaterThan(0.1);
  });

  it("allows a tangent route while rejecting a route through the obstacle", () => {
    const obstacle = { id: "block", x: 80, y: 100, width: 40, height: 40 };

    expect(
      hasClearNavigationPath({ x: 20, y: 86 }, { x: 180, y: 86 }, 14, [obstacle]),
    ).toBe(true);
    expect(
      hasClearNavigationPath({ x: 20, y: 120 }, { x: 180, y: 120 }, 14, [obstacle]),
    ).toBe(false);
  });

  it("moves chasers around an obstacle without entering it", () => {
    const world = createBlockedWorld();
    world.enemies.push(createEnemy({ x: 180, y: 270 }));
    const events: GameEvent[] = [];

    for (let frame = 0; frame < 420; frame += 1) {
      updateEnemies(world, 1 / 60, SIMULATION_CONFIG, events);
      expect(world.obstacles.some((obstacle) => circleRect(world.enemies[0]!, obstacle))).toBe(false);
    }

    expect(world.enemies[0]!.position.x).toBeGreaterThan(340);
    expect(world.stats.navigationMetrics.pathFrames).toBeGreaterThan(0);
    expect(world.stats.navigationMetrics.fieldBuilds).toBeLessThan(12);
  });

  it("shares one field between enemies with the same radius", () => {
    const world = createBlockedWorld();
    world.enemies.push(
      createEnemy({ x: 180, y: 260 }),
      createEnemy({ x: 180, y: 280 }, "enemy-2"),
    );

    updateEnemies(world, 1 / 60, SIMULATION_CONFIG, []);

    expect(world.stats.navigationMetrics.pathFrames).toBe(2);
    expect(world.stats.navigationMetrics.fieldBuilds).toBe(1);
  });

  it("reuses a recently visited player target cell", () => {
    const world = createBlockedWorld();
    const enemy = createEnemy({ x: 180, y: 270 });

    const first = getEnemyApproachNavigation(
      world,
      enemy,
      SIMULATION_CONFIG,
    );
    world.player.position.y += SIMULATION_CONFIG.navigation.cellSize;
    const second = getEnemyApproachNavigation(
      world,
      enemy,
      SIMULATION_CONFIG,
    );
    world.player.position.y -= SIMULATION_CONFIG.navigation.cellSize;
    const revisited = getEnemyApproachNavigation(
      world,
      enemy,
      SIMULATION_CONFIG,
    );

    expect(first.fieldBuilt).toBe(true);
    expect(second.fieldBuilt).toBe(true);
    expect(revisited.fieldBuilt).toBe(false);
    expect(revisited.direction).toEqual(first.direction);
  });

  it("makes ranged enemies seek line of sight instead of firing through cover", () => {
    const world = createBlockedWorld();
    const definition = SIMULATION_CONFIG.enemies.ranged;
    world.enemies.push({
      ...createEnemy({ x: 180, y: 270 }),
      typeId: "ranged",
      radius: definition.radius,
      hp: definition.hp,
      damage: definition.damage,
      speed: definition.speed,
      score: definition.score,
      xpValue: definition.xpValue,
      behavior: "ranged",
      attackTimer: 0,
    });

    updateEnemies(world, 1 / 60, SIMULATION_CONFIG, []);

    expect(world.stats.navigationMetrics.pathFrames).toBe(1);
    expect(Math.abs(world.enemies[0]!.position.y - 270)).toBeGreaterThan(0);
    expect(world.enemyProjectiles).toHaveLength(0);
  });

  it("retains axis collision behavior when navigation is disabled", () => {
    const config: SimulationConfig = {
      ...SIMULATION_CONFIG,
      features: { ...SIMULATION_CONFIG.features, enemyNavigation: false },
    };
    const world = createBlockedWorld(config);
    world.enemies.push(createEnemy({ x: 180, y: 270 }));

    for (let frame = 0; frame < 240; frame += 1) {
      updateEnemies(world, 1 / 60, config, []);
    }

    expect(world.enemies[0]!.position.x).toBeLessThan(220);
    expect(world.enemies[0]!.position.y).toBe(270);
    expect(world.stats.navigationMetrics.pathFrames).toBe(0);
  });
});

function createBlockedWorld(config = SIMULATION_CONFIG) {
  const world = createWorld(config);
  world.player.position = { x: 380, y: 270 };
  world.obstacles = [{ id: "wall", x: 220, y: 150, width: 120, height: 240 }];
  return world;
}

function createEnemy(position: { x: number; y: number }, id = "enemy-1"): Enemy {
  const definition = SIMULATION_CONFIG.enemies.chaser;
  return {
    id,
    typeId: "chaser",
    position: { ...position },
    radius: definition.radius,
    hp: definition.hp,
    damage: definition.damage,
    speed: definition.speed,
    score: definition.score,
    xpValue: definition.xpValue,
    behavior: "chase",
    attackTimer: 0,
    enteredArena: true,
  };
}
