import { describe, expect, it } from "vitest";
import { SIMULATION_CONFIG } from "../config/gameConfig";
import { getThreatMultipliers, getThreatTier } from "./threatDirector";

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
});
