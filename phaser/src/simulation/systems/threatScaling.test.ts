import { describe, expect, it } from "vitest";
import { SIMULATION_CONFIG } from "../../config/gameConfig";
import type { Enemy, GameEvent } from "../../domain/types";
import { createWorld } from "../createWorld";
import { updateEnemies } from "./enemySystem";
import { updateSpawner } from "./spawnSystem";

describe("threat scaling integration", () => {
  it("applies each stat tier to newly spawned enemies", () => {
    const baseline = createWorld(SIMULATION_CONFIG);
    baseline.state.elapsed = SIMULATION_CONFIG.threat.statStartAt;
    baseline.state.spawnTimer = 0;
    updateSpawner(baseline, 1 / 60, () => 0, SIMULATION_CONFIG, []);

    const scaled = createWorld(SIMULATION_CONFIG);
    scaled.state.elapsed =
      SIMULATION_CONFIG.threat.statStartAt + SIMULATION_CONFIG.threat.statStepSeconds;
    scaled.state.spawnTimer = 0;
    updateSpawner(scaled, 1 / 60, () => 0, SIMULATION_CONFIG, []);

    const baseDefinition = SIMULATION_CONFIG.enemies.chaser;
    expect(baseline.enemies[0]).toMatchObject({
      typeId: "chaser",
      hp: baseDefinition.hp,
      damage: baseDefinition.damage,
      score: baseDefinition.score,
    });
    expect(scaled.enemies[0]).toMatchObject({
      typeId: "chaser",
      hp: Math.ceil(baseDefinition.hp * SIMULATION_CONFIG.threat.enemyHpGrowth),
      damage: Math.ceil(baseDefinition.damage * SIMULATION_CONFIG.threat.enemyDamageGrowth),
      score: Math.round(baseDefinition.score * SIMULATION_CONFIG.threat.enemyScoreGrowth),
    });
  });

  it("scales ranged fire cadence, projectile speed, and damage", () => {
    const world = createWorld(SIMULATION_CONFIG);
    const ranged = SIMULATION_CONFIG.enemies.ranged.ranged!;
    world.state.elapsed =
      SIMULATION_CONFIG.threat.statStartAt + SIMULATION_CONFIG.threat.statStepSeconds;
    world.enemies.push(createRangedEnemy(world));
    const events: GameEvent[] = [];

    updateEnemies(world, 0, SIMULATION_CONFIG, events);

    const projectile = world.enemyProjectiles[0]!;
    expect(Math.hypot(projectile.velocity.x, projectile.velocity.y)).toBeCloseTo(
      ranged.projectileSpeed * SIMULATION_CONFIG.threat.rangedProjectileSpeedGrowth,
    );
    expect(projectile.damage).toBe(
      Math.ceil(ranged.projectileDamage * SIMULATION_CONFIG.threat.enemyDamageGrowth),
    );
    expect(world.enemies[0]!.attackTimer).toBeCloseTo(
      ranged.attackInterval / SIMULATION_CONFIG.threat.rangedAttackSpeedGrowth,
    );
    expect(events).toContainEqual(
      expect.objectContaining({ type: "enemy.projectile.fired", enemyType: "ranged" }),
    );
  });

  it("caps late-game enemy projectile density without banking a burst", () => {
    const world = createWorld(SIMULATION_CONFIG);
    const ranged = SIMULATION_CONFIG.enemies.ranged.ranged!;
    world.enemies.push(createRangedEnemy(world));
    world.enemyProjectiles = Array.from(
      { length: SIMULATION_CONFIG.threat.maximumEnemyProjectiles },
      (_, index) => ({
        id: `enemy-projectile-existing-${index}`,
        position: { x: 100, y: 100 },
        velocity: { x: 0, y: 0 },
        radius: ranged.projectileRadius,
        lifetime: ranged.projectileLifetime,
        damage: ranged.projectileDamage,
      }),
    );
    const events: GameEvent[] = [];

    updateEnemies(world, 0, SIMULATION_CONFIG, events);

    expect(world.enemyProjectiles).toHaveLength(
      SIMULATION_CONFIG.threat.maximumEnemyProjectiles,
    );
    expect(events.some((event) => event.type === "enemy.projectile.fired")).toBe(false);
    expect(world.enemies[0]?.attackTimer).toBe(ranged.attackInterval);
  });
});

function createRangedEnemy(world: ReturnType<typeof createWorld>): Enemy {
  const definition = SIMULATION_CONFIG.enemies.ranged;
  return {
    id: "enemy-ranged-test",
    typeId: "ranged",
    position: { x: world.player.position.x + 100, y: world.player.position.y },
    radius: definition.radius,
    hp: definition.hp,
    damage: definition.damage,
    speed: definition.speed,
    score: definition.score,
    xpValue: definition.xpValue,
    behavior: "ranged",
    attackTimer: 0,
    enteredArena: true,
  };
}
