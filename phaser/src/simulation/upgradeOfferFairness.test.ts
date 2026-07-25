import { describe, expect, it } from "vitest";
import { SIMULATION_CONFIG } from "../config/gameConfig";
import type {
  UpgradeId,
  UpgradeOfferRunStat,
} from "../domain/types";
import {
  applyUpgradeCategoryFloor,
  UPGRADE_CATEGORY_FLOOR_INTERVENTION_LIMIT,
  UPGRADE_CATEGORY_FLOOR_MISS_LIMIT,
} from "./upgradeOfferFairness";

const candidateConfig = {
  ...SIMULATION_CONFIG,
  features: {
    ...SIMULATION_CONFIG.features,
    upgradeCategoryFloor: true,
  },
};
const available: UpgradeId[] = [
  "rapidFire",
  "swiftStep",
  "vitalCore",
  "overdriveRounds",
  "pulseFocus",
  "piercingRounds",
];

describe("upgrade offer category floor", () => {
  it("replaces the final non-capstone slot after four eligible misses", () => {
    const result = applyUpgradeCategoryFloor(
      candidateConfig,
      () => 0,
      available,
      ["rapidFire", "swiftStep", "piercingRounds"],
      createMissHistory("survival", UPGRADE_CATEGORY_FLOOR_MISS_LIMIT),
    );

    expect(result).toEqual({
      choices: ["rapidFire", "swiftStep", "vitalCore"],
      intervention: {
        kind: "category-floor",
        category: "survival",
        replacedUpgradeId: "piercingRounds",
        guaranteedUpgradeId: "vitalCore",
        eligibleMissGap: 4,
      },
    });
  });

  it("leaves the normal weighted choices byte-for-byte compatible when disabled", () => {
    const choices: UpgradeId[] = [
      "rapidFire",
      "swiftStep",
      "piercingRounds",
    ];
    const result = applyUpgradeCategoryFloor(
      SIMULATION_CONFIG,
      () => {
        throw new Error("disabled fairness must not consume random values");
      },
      available,
      choices,
      createMissHistory("survival", UPGRADE_CATEGORY_FLOOR_MISS_LIMIT),
    );

    expect(result).toEqual({ choices });
    expect(result.choices).not.toBe(choices);
  });

  it("never replaces an unlocked capstone", () => {
    const result = applyUpgradeCategoryFloor(
      candidateConfig,
      () => 0,
      [...available, "pulseRicochet"],
      ["pulseRicochet", "rapidFire", "swiftStep"],
      createMissHistory("survival", UPGRADE_CATEGORY_FLOOR_MISS_LIMIT),
    );

    expect(result.choices).toEqual([
      "pulseRicochet",
      "rapidFire",
      "vitalCore",
    ]);
    expect(result.intervention?.replacedUpgradeId).toBe("swiftStep");
  });

  it("does not intervene when the normal draw already covers the starved category", () => {
    const result = applyUpgradeCategoryFloor(
      candidateConfig,
      () => {
        throw new Error("covered category must not consume another draw");
      },
      available,
      ["rapidFire", "swiftStep", "vitalCore"],
      createMissHistory("survival", UPGRADE_CATEGORY_FLOOR_MISS_LIMIT),
    );

    expect(result).toEqual({
      choices: ["rapidFire", "swiftStep", "vitalCore"],
    });
  });

  it("stops after the preregistered four interventions", () => {
    const history = [
      ...createInterventionHistory(UPGRADE_CATEGORY_FLOOR_INTERVENTION_LIMIT),
      ...createMissHistory("survival", UPGRADE_CATEGORY_FLOOR_MISS_LIMIT),
    ];
    const initialChoices: UpgradeId[] = [
      "rapidFire",
      "swiftStep",
      "piercingRounds",
    ];
    const result = applyUpgradeCategoryFloor(
      candidateConfig,
      () => {
        throw new Error("capped fairness must not consume random values");
      },
      available,
      initialChoices,
      history,
    );

    expect(result).toEqual({ choices: initialChoices });
  });
});

function createMissHistory(
  missingCategory: "weapon" | "mobility" | "survival" | "support",
  count: number,
): UpgradeOfferRunStat[] {
  const choicesByMissingCategory: Record<
    typeof missingCategory,
    UpgradeId[]
  > = {
    weapon: ["swiftStep", "vitalCore", "piercingRounds"],
    mobility: ["rapidFire", "vitalCore", "piercingRounds"],
    survival: ["rapidFire", "swiftStep", "piercingRounds"],
    support: ["rapidFire", "swiftStep", "vitalCore"],
  };
  return Array.from({ length: count }, (_, index) => ({
    elapsed: index * 8,
    level: index + 2,
    choices: [...choicesByMissingCategory[missingCategory]],
    availableUpgradeIds: [...available],
    lockedUpgradeIds: ["pulseRicochet"],
    maxedUpgradeIds: [],
  }));
}

function createInterventionHistory(count: number): UpgradeOfferRunStat[] {
  return Array.from({ length: count }, (_, index) => ({
    elapsed: index * 8,
    level: index + 2,
    choices: ["rapidFire", "swiftStep", "vitalCore"],
    availableUpgradeIds: [...available],
    lockedUpgradeIds: ["pulseRicochet"],
    maxedUpgradeIds: [],
    fairnessIntervention: {
      kind: "category-floor",
      category: "survival",
      replacedUpgradeId: "piercingRounds",
      guaranteedUpgradeId: "vitalCore",
      eligibleMissGap: UPGRADE_CATEGORY_FLOOR_MISS_LIMIT,
    },
  }));
}

