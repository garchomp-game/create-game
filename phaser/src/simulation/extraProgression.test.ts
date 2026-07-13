import { describe, expect, it } from "vitest";
import { SIMULATION_CONFIG } from "../config/gameConfig";
import { EXTRA_UPGRADE_IDS } from "../domain/types";
import { createWorld } from "./createWorld";
import {
  canIncreaseExtraUpgrade,
  getAvailableExtraUpgradeIds,
  getExtraXpToNextLevel,
  selectExtraUpgradeChoices,
} from "./extraProgression";

describe("extra progression", () => {
  it("grows its XP requirement up to a stable cap", () => {
    expect(getExtraXpToNextLevel(0, SIMULATION_CONFIG)).toBe(180);
    expect(getExtraXpToNextLevel(1, SIMULATION_CONFIG)).toBe(201);
    expect(getExtraXpToNextLevel(100, SIMULATION_CONFIG)).toBe(900);
  });

  it("offers deterministic unique choices from the current cycle", () => {
    const world = createWorld(SIMULATION_CONFIG);
    const first = selectExtraUpgradeChoices(
      SIMULATION_CONFIG,
      () => 0,
      world.progression.extraUpgradeRanks,
    );
    const second = selectExtraUpgradeChoices(
      SIMULATION_CONFIG,
      () => 0,
      world.progression.extraUpgradeRanks,
    );

    expect(first).toEqual(second);
    expect(first).toHaveLength(SIMULATION_CONFIG.leveling.extra.upgradeChoiceCount);
    expect(new Set(first).size).toBe(first.length);
    expect(first.every((id) => EXTRA_UPGRADE_IDS.includes(id))).toBe(true);

    const withoutPower = selectExtraUpgradeChoices(
      SIMULATION_CONFIG,
      () => 0,
      world.progression.extraUpgradeRanks,
      EXTRA_UPGRADE_IDS.filter((id) => id !== "limitPower"),
    );
    expect(withoutPower).not.toContain("limitPower");
  });

  it("removes capped upgrades while keeping unlimited upgrades available", () => {
    const world = createWorld(SIMULATION_CONFIG);

    world.progression.extraUpgradeRanks.limitCycle = 5;
    world.progression.extraUpgradeRanks.limitDrive = 5;
    world.progression.extraUpgradeRanks.limitPower = 30;
    world.progression.extraUpgradeRanks.limitCore = 30;
    expect(canIncreaseExtraUpgrade(SIMULATION_CONFIG, "limitCycle", 5)).toBe(false);
    expect(canIncreaseExtraUpgrade(SIMULATION_CONFIG, "limitDrive", 5)).toBe(false);
    expect(canIncreaseExtraUpgrade(SIMULATION_CONFIG, "limitPower", 30)).toBe(true);
    expect(getAvailableExtraUpgradeIds(SIMULATION_CONFIG, world.progression.extraUpgradeRanks)).toEqual([
      "limitPower",
      "limitCore",
    ]);
  });
});
