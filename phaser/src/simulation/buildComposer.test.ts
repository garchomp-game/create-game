import { describe, expect, it } from "vitest";
import { SIMULATION_CONFIG } from "../config/gameConfig";
import { createWorld } from "./createWorld";
import {
  composeBuild,
  getUpgradeRequirementProgress,
  isUpgradeRelevant,
} from "./buildComposer";

describe("build composition", () => {
  it("applies normal upgrades, capstones, then temporary effects in a fixed order", () => {
    const world = createWorld(SIMULATION_CONFIG);
    Object.assign(world.progression.upgradeRanks, {
      rapidFire: 2,
      swiftStep: 1,
      vitalCore: 1,
      overdriveRounds: 1,
      pulseFocus: 1,
      piercingRounds: 1,
      pulseRicochet: 1,
    });

    const result = composeBuild(
      SIMULATION_CONFIG,
      "pulse",
      world.progression.upgradeRanks,
      [{ type: "moveSpeedMultiplier", multiplier: 1.1 }],
    );

    expect(result.modifiers).toEqual({
      playerSpeedMultiplier: 1.12 * 1.1,
      fireIntervalMultiplier: 0.85 ** 2,
      projectileSpeedMultiplier: 1.15,
      projectileDamageMultiplier: 1,
      maxHpBonus: 20,
      projectileCountBonus: 0,
      hitCapacityBonus: 1,
      ricochetBonus: 1,
      pulseFocusBonusPerStack: 0.15,
      pulseFocusMaxStacks: 2,
      pulseFocusDuration: 0.9,
      spreadSweepDistinctTargets: 0,
      spreadSweepNextIntervalMultiplier: 1,
    });
    expect(result.categoryRanks).toEqual({
      weapon: 4,
      mobility: 1,
      survival: 1,
      support: 1,
      capstone: 1,
    });
    expect(result.contributions.at(-2)?.source).toBe("capstone");
    expect(result.contributions.at(-1)?.source).toBe("temporary");
  });

  it("exposes capstone unlock progress and excludes Pulse-only effects from Spread", () => {
    const world = createWorld(SIMULATION_CONFIG);
    world.progression.upgradeRanks.rapidFire = 5;
    world.progression.upgradeRanks.splitShot = 2;
    world.progression.upgradeRanks.pulseRicochet = 1;

    expect(
      getUpgradeRequirementProgress(
        SIMULATION_CONFIG,
        "pulseRicochet",
        world.progression.upgradeRanks,
      ),
    ).toEqual([{ category: "weapon", current: 7, required: 7 }]);
    expect(isUpgradeRelevant(SIMULATION_CONFIG, "pulseRicochet", "pulse")).toBe(true);
    expect(isUpgradeRelevant(SIMULATION_CONFIG, "pulseRicochet", "spread")).toBe(false);
    expect(
      composeBuild(SIMULATION_CONFIG, "spread", world.progression.upgradeRanks).modifiers
        .ricochetBonus,
    ).toBe(0);
  });

  it("keeps power and core scaling while capping fire-rate and movement extras", () => {
    const world = createWorld(SIMULATION_CONFIG);
    Object.assign(world.progression.extraUpgradeRanks, {
      limitPower: 2,
      limitCycle: 5,
      limitDrive: 5,
      limitCore: 3,
    });

    const result = composeBuild(
      SIMULATION_CONFIG,
      "pulse",
      world.progression.upgradeRanks,
      [],
      world.progression.extraUpgradeRanks,
    );

    expect(result.modifiers).toMatchObject({
      projectileDamageMultiplier: 1.16,
      fireIntervalMultiplier: 1 / 1.5,
      playerSpeedMultiplier: 1.3,
      maxHpBonus: 24,
    });
    expect(result.contributions.filter((entry) => entry.source === "extra")).toHaveLength(4);
  });
});
