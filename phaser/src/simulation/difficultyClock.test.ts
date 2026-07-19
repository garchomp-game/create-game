import { describe, expect, it } from "vitest";
import { SIMULATION_CONFIG } from "../config/gameConfig";
import { FINAL_EXPEDITION_STAGE_DEFINITION } from "../content/gameContentCatalog";
import type { WorldState } from "../domain/types";
import { getDifficultyElapsed } from "./difficultyClock";
import { createWorld } from "./createWorld";
import { getSpawnWave, spawnEnemyAtPosition } from "./systems/spawnSystem";

describe("getDifficultyElapsed", () => {
  it("uses run elapsed outside Expedition", () => {
    expect(getDifficultyElapsed(createClockWorld(512.25))).toBe(512.25);
  });

  it("advances with the pending run delta while the Act clock is active", () => {
    expect(getDifficultyElapsed(createClockWorld(430.033, {
      runElapsed: 430,
      actElapsed: 392.4,
      actClockBlocked: false,
    }))).toBe(392.433);
  });

  it("does not add Commander time while the Act clock is blocked", () => {
    expect(getDifficultyElapsed(createClockWorld(430.033, {
      runElapsed: 430,
      actElapsed: 356.8,
      actClockBlocked: true,
    }))).toBe(356.8);
  });

  it("keeps Expedition waves and enemy growth on the blocked Act timeline", () => {
    const stageDifficulty = FINAL_EXPEDITION_STAGE_DEFINITION.difficulty;
    const config = {
      ...SIMULATION_CONFIG,
      waves: stageDifficulty.waves,
      threat: {
        ...SIMULATION_CONFIG.threat,
        ...stageDifficulty.threat,
      },
    };
    const world = createWorld(config);
    world.state.elapsed = 540;
    world.expedition = {
      director: {
        runElapsed: 540,
        actElapsed: 394,
        actClockBlocked: true,
      },
    } as WorldState["expedition"];

    const wave = getSpawnWave(world, config);
    const enemy = spawnEnemyAtPosition(
      world,
      "chaser",
      wave,
      { x: 100, y: 100 },
      config,
    );

    expect(wave).toMatchObject({
      start: 390,
      spawnInterval: 0.32,
      speedMultiplier: 1.3,
      maxEnemies: 64,
    });
    expect(enemy.hp).toBe(config.enemies.chaser.hp);
    expect(enemy.damage).toBe(config.enemies.chaser.damage);
  });
});

function createClockWorld(
  elapsed: number,
  director?: {
    runElapsed: number;
    actElapsed: number;
    actClockBlocked: boolean;
  },
): Pick<WorldState, "state" | "expedition"> {
  return {
    state: { elapsed } as WorldState["state"],
    expedition: director
      ? {
          director,
        } as WorldState["expedition"]
      : undefined,
  };
}
