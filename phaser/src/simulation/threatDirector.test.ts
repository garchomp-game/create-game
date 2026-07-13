import { describe, expect, it } from "vitest";
import { SIMULATION_CONFIG } from "../config/gameConfig";
import {
  getEnemyHpMultiplier,
  getThreatMultipliers,
  getThreatTier,
} from "./threatDirector";

describe("threatDirector", () => {
  it("starts at 240 seconds and continues increasing without a tier cap", () => {
    expect(getThreatTier(SIMULATION_CONFIG, 239.999)).toBe(0);
    expect(getThreatTier(SIMULATION_CONFIG, 240)).toBe(1);
    expect(getThreatTier(SIMULATION_CONFIG, 285)).toBe(2);
    expect(getThreatTier(SIMULATION_CONFIG, 3_600)).toBeGreaterThan(70);
  });

  it("keeps HP and damage unbounded while capping readability-sensitive multipliers", () => {
    const middle = getThreatMultipliers(SIMULATION_CONFIG, 900);
    const late = getThreatMultipliers(SIMULATION_CONFIG, 3_600);

    expect(late.hp).toBeGreaterThan(middle.hp);
    expect(late.damage).toBeGreaterThan(middle.damage);
    expect(late.score).toBeGreaterThan(middle.score);
    expect(late.projectileSpeed).toBe(SIMULATION_CONFIG.threat.maximumProjectileSpeedMultiplier);
    expect(late.attackSpeed).toBe(SIMULATION_CONFIG.threat.maximumAttackSpeedMultiplier);
    expect(late.healDrop).toBe(SIMULATION_CONFIG.threat.minimumHealDropMultiplier);
  });

  it("scales late HP by enemy role without changing the opening values", () => {
    for (const enemyType of ["chaser", "brute", "fast", "ranged"] as const) {
      expect(getEnemyHpMultiplier(SIMULATION_CONFIG, 240, enemyType)).toBe(1);
    }

    const elapsed = 600;
    const fast = getEnemyHpMultiplier(SIMULATION_CONFIG, elapsed, "fast");
    const chaser = getEnemyHpMultiplier(SIMULATION_CONFIG, elapsed, "chaser");
    const ranged = getEnemyHpMultiplier(SIMULATION_CONFIG, elapsed, "ranged");
    const brute = getEnemyHpMultiplier(SIMULATION_CONFIG, elapsed, "brute");
    expect(Math.ceil(SIMULATION_CONFIG.enemies.ranged.hp * ranged)).toBe(7);
    expect(Math.ceil(SIMULATION_CONFIG.enemies.brute.hp * brute)).toBe(11);
    expect(brute).toBeGreaterThan(ranged);
    expect(ranged).toBeGreaterThan(chaser);
    expect(chaser).toBeGreaterThan(fast);
  });
});
