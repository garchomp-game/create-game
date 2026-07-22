import { describe, expect, it } from "vitest";
import { SIMULATION_CONFIG } from "../../config/gameConfig";
import { createWorld } from "../../simulation/createWorld";
import {
  applyEnemyVisualFixture,
  applyHealPickupFixture,
  applyObstacleFrictionFixture,
  applyOffscreenEnemyIndicatorFixture,
  createDebugInput,
} from "./ArenaDebugFixtures";

describe("ArenaDebugFixtures", () => {
  it("normalizes partial debug input", () => {
    expect(createDebugInput({ shootHeld: true })).toEqual({
      move: { x: 0, y: 0 },
      aimWorld: null,
      startPressed: false,
      shootHeld: true,
      restartPressed: false,
      pausePressed: false,
      quitToTitlePressed: false,
      upgradeChoicePressed: null,
      contractChoicePressed: null,
      tutorialContinuePressed: false,
    });
  });

  it("creates deterministic enemy visual fixtures", () => {
    const world = createWorld(SIMULATION_CONFIG);
    applyEnemyVisualFixture(world, SIMULATION_CONFIG, "wave3");

    expect(world.enemies.map((enemy) => enemy.typeId)).toEqual([
      "chaser",
      "brute",
      "fast",
      "ranged",
    ]);
    expect(world.enemyProjectiles).toHaveLength(1);
    expect(world.pickups).toEqual([]);
  });

  it("creates obstacle, heal, and offscreen fixtures without Phaser", () => {
    const world = createWorld(SIMULATION_CONFIG);
    expect(applyObstacleFrictionFixture(world, SIMULATION_CONFIG)).toBe(true);
    expect(world.enemies).toEqual([]);

    applyHealPickupFixture(world, SIMULATION_CONFIG, "visual");
    expect(world.pickups.map((pickup) => pickup.kind)).toEqual(["xp", "heal"]);
    expect(world.enemyProjectiles).toHaveLength(1);

    applyOffscreenEnemyIndicatorFixture(world, SIMULATION_CONFIG);
    expect(world.enemies).toHaveLength(4);
    expect(world.enemies.every((enemy) => !enemy.enteredArena)).toBe(true);
  });
});
