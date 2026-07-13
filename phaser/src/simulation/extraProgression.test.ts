import { describe, expect, it } from "vitest";
import { SIMULATION_CONFIG } from "../config/gameConfig";
import { EXTRA_UPGRADE_IDS } from "../domain/types";
import { createWorld } from "./createWorld";
import {
  canIncreaseExtraUpgrade,
  getExtraXpToNextLevel,
  selectExtraUpgradeChoices,
} from "./extraProgression";

describe("extra progression", () => {
  it("grows its XP requirement up to a stable cap", () => {
    expect(getExtraXpToNextLevel(0, SIMULATION_CONFIG)).toBe(180);
    expect(getExtraXpToNextLevel(1, SIMULATION_CONFIG)).toBe(201);
    expect(getExtraXpToNextLevel(100, SIMULATION_CONFIG)).toBe(900);
  });

  it("offers deterministic unique choices and removes capped no-op upgrades", () => {
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

    world.progression.extraUpgradeRanks.limitCycle = 20;
    world.progression.extraUpgradeRanks.limitDrive = 20;
    expect(canIncreaseExtraUpgrade(SIMULATION_CONFIG, "limitCycle", 20)).toBe(false);
    expect(canIncreaseExtraUpgrade(SIMULATION_CONFIG, "limitDrive", 20)).toBe(false);
    expect(
      selectExtraUpgradeChoices(
        SIMULATION_CONFIG,
        () => 0,
        world.progression.extraUpgradeRanks,
      ),
    ).toEqual(["limitPower", "limitCore"]);
  });
});
