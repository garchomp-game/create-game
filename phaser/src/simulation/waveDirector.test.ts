import { describe, expect, it } from "vitest";
import { SIMULATION_CONFIG } from "../config/gameConfig";
import { getWaveBand, getWaveDifficulty, selectEnemyTypeForWave } from "./waveDirector";

describe("waveDirector", () => {
  it("selects wave bands by elapsed time", () => {
    expect(getWaveDifficulty(SIMULATION_CONFIG, 29.999)).toEqual({
      spawnInterval: 1,
      speedMultiplier: 1,
      maxEnemies: 30,
    });
    expect(getWaveDifficulty(SIMULATION_CONFIG, 30)).toEqual({
      spawnInterval: 0.75,
      speedMultiplier: 1.18,
      maxEnemies: 45,
    });
    expect(getWaveDifficulty(SIMULATION_CONFIG, 60)).toEqual({
      spawnInterval: 0.55,
      speedMultiplier: 1.35,
      maxEnemies: 60,
    });
  });

  it("uses wave weights and spawn budget when choosing enemy types", () => {
    const early = getWaveBand(SIMULATION_CONFIG, 0);
    const middle = getWaveBand(SIMULATION_CONFIG, 35);
    const late = getWaveBand(SIMULATION_CONFIG, 70);

    expect(selectEnemyTypeForWave(SIMULATION_CONFIG, early, 1, () => 0.99)).toBe("chaser");
    expect(selectEnemyTypeForWave(SIMULATION_CONFIG, middle, middle.spawnBudget, () => 0.5)).toBe(
      "brute",
    );
    expect(selectEnemyTypeForWave(SIMULATION_CONFIG, middle, 1, () => 0.99)).toBe("fast");
    expect(selectEnemyTypeForWave(SIMULATION_CONFIG, late, 2, () => 0.99)).toBe("ranged");
  });
});
