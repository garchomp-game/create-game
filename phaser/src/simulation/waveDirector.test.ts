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
      speedMultiplier: 1.02,
      maxEnemies: 32,
    });
    expect(getWaveDifficulty(SIMULATION_CONFIG, 45)).toEqual({
      spawnInterval: 1.3,
      speedMultiplier: 1.04,
      maxEnemies: 36,
    });
    expect(getWaveDifficulty(SIMULATION_CONFIG, 60)).toEqual({
      spawnInterval: 0.95,
      speedMultiplier: 1.1,
      maxEnemies: 42,
    });
    expect(getWaveDifficulty(SIMULATION_CONFIG, 75)).toEqual({
      spawnInterval: 0.78,
      speedMultiplier: 1.18,
      maxEnemies: 50,
    });
    expect(getWaveDifficulty(SIMULATION_CONFIG, 90)).toEqual({
      spawnInterval: 0.55,
      speedMultiplier: 1.35,
      maxEnemies: 60,
    });
    expect(getWaveDifficulty(SIMULATION_CONFIG, 150)).toEqual({
      spawnInterval: 0.535,
      speedMultiplier: 1.39,
      maxEnemies: 62,
    });
    expect(getWaveDifficulty(SIMULATION_CONFIG, 570)).toEqual({
      spawnInterval: 0.43,
      speedMultiplier: 1.67,
      maxEnemies: 76,
    });
    expect(getWaveBand(SIMULATION_CONFIG, 900)).toMatchObject({
      spawnInterval: 0.355,
      speedMultiplier: 1.87,
      maxEnemies: 86,
      spawnBudget: 7,
    });
    expect(getWaveBand(SIMULATION_CONFIG, 3_600)).toMatchObject({
      spawnInterval: SIMULATION_CONFIG.threat.minimumSpawnInterval,
      speedMultiplier: SIMULATION_CONFIG.threat.maximumSpeedMultiplier,
      maxEnemies: SIMULATION_CONFIG.threat.maximumEnemies,
      spawnBudget: SIMULATION_CONFIG.threat.maximumSpawnBudget,
    });
  });

  it("uses wave weights and spawn budget when choosing enemy types", () => {
    const early = getWaveBand(SIMULATION_CONFIG, 0);
    const densityIntroduction = getWaveBand(SIMULATION_CONFIG, 35);
    const bruteIntroduction = getWaveBand(SIMULATION_CONFIG, 50);
    const fastIntroduction = getWaveBand(SIMULATION_CONFIG, 65);
    const rangedIntroduction = getWaveBand(SIMULATION_CONFIG, 80);

    expect(selectEnemyTypeForWave(SIMULATION_CONFIG, early, 1, () => 0.99)).toBe("chaser");
    expect(
      selectEnemyTypeForWave(
        SIMULATION_CONFIG,
        densityIntroduction,
        densityIntroduction.spawnBudget,
        () => 0.99,
      ),
    ).toBe("chaser");
    expect(densityIntroduction.enemyWeights.brute).toBeUndefined();
    expect(
      selectEnemyTypeForWave(
        SIMULATION_CONFIG,
        bruteIntroduction,
        bruteIntroduction.spawnBudget,
        () => 0.99,
      ),
    ).toBe("brute");
    expect(bruteIntroduction.enemyWeights.fast).toBeUndefined();
    expect(
      selectEnemyTypeForWave(
        SIMULATION_CONFIG,
        fastIntroduction,
        fastIntroduction.spawnBudget,
        () => 0.99,
      ),
    ).toBe("fast");
    expect(fastIntroduction.enemyWeights.ranged).toBeUndefined();
    expect(
      selectEnemyTypeForWave(
        SIMULATION_CONFIG,
        rangedIntroduction,
        rangedIntroduction.spawnBudget,
        () => 0.99,
      ),
    ).toBe("ranged");
  });
});
