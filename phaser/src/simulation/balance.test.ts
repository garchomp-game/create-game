import { describe, expect, it } from "vitest";
import { SIMULATION_CONFIG } from "../config/gameConfig";
import { createRandom } from "../math/random";
import { createWorld } from "./createWorld";
import { stepWorld } from "./stepWorld";

const neutralInput = {
  move: { x: 0, y: 0 },
  aimWorld: null,
  startPressed: false,
  shootHeld: false,
  restartPressed: false,
  pausePressed: false,
  quitToTitlePressed: false,
  upgradeChoicePressed: null,
};

describe("balance simulation", () => {
  it("keeps a fixed 60 second run within population budgets", () => {
    const world = createWorld(SIMULATION_CONFIG);
    world.state.hp = 100_000;
    const random = createRandom(SIMULATION_CONFIG.seed);
    let spawnEvents = 0;
    let maxEnemyCount = 0;
    let maxBulletCount = 0;
    let frames = 0;
    let lateWaveSpawnEvents = 0;

    while ((world.state.elapsed < 60 || lateWaveSpawnEvents === 0) && frames < 60 * 75) {
      const result = stepWorld(world, neutralInput, 1 / 60, random, SIMULATION_CONFIG);
      frames += 1;
      const spawnedThisFrame = result.events.filter((event) => event.type === "enemy.spawned").length;
      spawnEvents += spawnedThisFrame;
      if (world.state.elapsed >= 60) {
        lateWaveSpawnEvents += spawnedThisFrame;
      }
      maxEnemyCount = Math.max(maxEnemyCount, world.enemies.length);
      maxBulletCount = Math.max(maxBulletCount, world.bullets.length + world.enemyProjectiles.length);

      if (world.state.status === "gameOver") break;
      if (world.state.status === "upgradeSelect") {
        stepWorld(
          world,
          { ...neutralInput, upgradeChoicePressed: 0 },
          1 / 60,
          random,
          SIMULATION_CONFIG,
        );
      }
    }

    expect(world.state.elapsed).toBeGreaterThanOrEqual(60);
    expect(lateWaveSpawnEvents).toBeGreaterThan(0);
    expect(maxEnemyCount).toBeLessThanOrEqual(60);
    expect(maxBulletCount).toBeLessThanOrEqual(80);
    expect(spawnEvents).toBeLessThanOrEqual(180);
  });
});
