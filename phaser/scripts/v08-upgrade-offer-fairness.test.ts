import { describe, expect, it } from "vitest";
import { SIMULATION_CONFIG } from "../src/config/gameConfig";
import {
  UPGRADE_CATEGORIES,
  UPGRADE_IDS,
  type UpgradeCategory,
  type UpgradeId,
  type WeaponTypeId,
} from "../src/domain/types";
import { createRandomStreams } from "../src/math/random";
import { createWorld } from "../src/simulation/createWorld";
import {
  getAvailableUpgradeIds,
  getRemainingUpgradeIds,
  selectUpgradeChoices,
} from "../src/simulation/systems/levelSystem";

declare const process: { env: Record<string, string | undefined> };

type ProbeWeapon = Extract<WeaponTypeId, "pulse" | "spread">;
type SelectionPolicy = "observer-priority" | "first-card";
type GapState = {
  current: number;
  maximum: number;
  firstOfferLevel: number | null;
};

type OfferProbeRun = {
  seed: number;
  weaponId: ProbeWeapon;
  selectionPolicy: SelectionPolicy;
  offerCount: number;
  selectionCount: number;
  capstoneOffer: number | null;
  capstoneSelection: number | null;
  offerSequence: UpgradeId[][];
  upgradeGaps: Record<UpgradeId, GapState>;
  categoryGaps: Record<UpgradeCategory, GapState>;
};

const FULL_PROBE =
  process.env.ARENA_V08_UPGRADE_FAIRNESS_FULL === "1";
const SEEDS = Array.from(
  { length: FULL_PROBE ? 64 : 8 },
  (_, index) => 20260725 + index,
);
const WEAPONS: ProbeWeapon[] = ["pulse", "spread"];
const POLICIES: SelectionPolicy[] = ["observer-priority", "first-card"];
const BASE_CATEGORIES = UPGRADE_CATEGORIES.filter(
  (category) => category !== "capstone",
);
const OBSERVER_PRIORITY: readonly UpgradeId[] = [
  "pulseRicochet",
  "spreadSweep",
  "pulseFocus",
  "splitShot",
  "swiftStep",
  "rapidFire",
  "overdriveRounds",
  "piercingRounds",
  "vitalCore",
];

describe("v0.8 normal upgrade offer fairness control", () => {
  it(
    FULL_PROBE
      ? "reports the 64-seed control by weapon and fixed selection policy"
      : "keeps the short control deterministic and completes every build",
    () => {
      const first = runMatrix();
      const replay = runMatrix();

      expect(replay).toEqual(first);
      expect(first.every((run) => run.offerCount === 25)).toBe(true);
      expect(first.every((run) => run.selectionCount === 25)).toBe(true);
      expect(first.every((run) => run.capstoneOffer !== null)).toBe(true);
      expect(first.every((run) => run.capstoneSelection !== null)).toBe(true);

      console.log(JSON.stringify(summarize(first), null, 2));
    },
    120_000,
  );
});

function runMatrix(): OfferProbeRun[] {
  return SEEDS.flatMap((seed) =>
    WEAPONS.flatMap((weaponId) =>
      POLICIES.map((selectionPolicy) =>
        runOfferProbe(seed, weaponId, selectionPolicy),
      ),
    ),
  );
}

function runOfferProbe(
  seed: number,
  weaponId: ProbeWeapon,
  selectionPolicy: SelectionPolicy,
): OfferProbeRun {
  const world = createWorld(SIMULATION_CONFIG);
  world.state.weaponType = weaponId;
  const random = createRandomStreams(seed).upgrade;
  const upgradeGaps = createGapRecord(UPGRADE_IDS);
  const categoryGaps = createGapRecord(UPGRADE_CATEGORIES);
  const offerSequence: UpgradeId[][] = [];
  let capstoneOffer: number | null = null;
  let capstoneSelection: number | null = null;

  for (let offerIndex = 0; offerIndex < 40; offerIndex += 1) {
    const remaining = getRemainingUpgradeIds(
      SIMULATION_CONFIG,
      world.progression.upgradeRanks,
      weaponId,
    );
    if (remaining.length === 0) break;
    const available = getAvailableUpgradeIds(
      SIMULATION_CONFIG,
      world.progression.upgradeRanks,
      weaponId,
    );
    const choices = selectUpgradeChoices(
      SIMULATION_CONFIG,
      random,
      world.progression.upgradeRanks,
      weaponId,
    );
    const level = offerIndex + 2;
    expect(choices.length).toBeGreaterThan(0);
    offerSequence.push([...choices]);
    recordUpgradeGaps(upgradeGaps, available, choices, level);
    recordCategoryGaps(categoryGaps, available, choices, level);
    if (
      capstoneOffer === null &&
      choices.some(
        (upgradeId) =>
          SIMULATION_CONFIG.upgrades[upgradeId].category === "capstone",
      )
    ) {
      capstoneOffer = offerIndex + 1;
    }

    const selectedId = selectUpgrade(
      choices,
      world.progression.upgradeRanks,
      selectionPolicy,
    );
    world.progression.upgradeRanks[selectedId] += 1;
    if (
      capstoneSelection === null &&
      SIMULATION_CONFIG.upgrades[selectedId].category === "capstone"
    ) {
      capstoneSelection = offerIndex + 1;
    }
  }

  return {
    seed,
    weaponId,
    selectionPolicy,
    offerCount: offerSequence.length,
    selectionCount: Object.values(world.progression.upgradeRanks).reduce(
      (sum, rank) => sum + rank,
      0,
    ),
    capstoneOffer,
    capstoneSelection,
    offerSequence,
    upgradeGaps,
    categoryGaps,
  };
}

function selectUpgrade(
  choices: UpgradeId[],
  ranks: Record<UpgradeId, number>,
  policy: SelectionPolicy,
): UpgradeId {
  if (policy === "first-card") return choices[0]!;
  let selected = choices[0]!;
  let selectedPriority = Number.POSITIVE_INFINITY;
  let selectedRank = Number.POSITIVE_INFINITY;
  for (const upgradeId of choices) {
    const priority = OBSERVER_PRIORITY.indexOf(upgradeId);
    const rank = ranks[upgradeId];
    if (
      rank < selectedRank ||
      (rank === selectedRank && priority < selectedPriority)
    ) {
      selected = upgradeId;
      selectedRank = rank;
      selectedPriority = priority;
    }
  }
  return selected;
}

function createGapRecord<Key extends string>(
  keys: readonly Key[],
): Record<Key, GapState> {
  return Object.fromEntries(
    keys.map((key) => [
      key,
      { current: 0, maximum: 0, firstOfferLevel: null },
    ]),
  ) as Record<Key, GapState>;
}

function recordUpgradeGaps(
  gaps: Record<UpgradeId, GapState>,
  available: UpgradeId[],
  choices: UpgradeId[],
  level: number,
): void {
  const availableSet = new Set(available);
  const choiceSet = new Set(choices);
  for (const upgradeId of UPGRADE_IDS) {
    if (!availableSet.has(upgradeId)) continue;
    updateGap(gaps[upgradeId], choiceSet.has(upgradeId), level);
  }
}

function recordCategoryGaps(
  gaps: Record<UpgradeCategory, GapState>,
  available: UpgradeId[],
  choices: UpgradeId[],
  level: number,
): void {
  const availableCategories = new Set(
    available.map(
      (upgradeId) => SIMULATION_CONFIG.upgrades[upgradeId].category,
    ),
  );
  const offeredCategories = new Set(
    choices.map(
      (upgradeId) => SIMULATION_CONFIG.upgrades[upgradeId].category,
    ),
  );
  for (const category of UPGRADE_CATEGORIES) {
    if (!availableCategories.has(category)) continue;
    updateGap(gaps[category], offeredCategories.has(category), level);
  }
}

function updateGap(
  state: GapState,
  offered: boolean,
  level: number,
): void {
  if (offered) {
    state.firstOfferLevel ??= level;
    state.current = 0;
    return;
  }
  state.current += 1;
  state.maximum = Math.max(state.maximum, state.current);
}

function summarize(runs: OfferProbeRun[]) {
  return {
    seeds: SEEDS,
    runs: runs.length,
    groups: WEAPONS.flatMap((weaponId) =>
      POLICIES.map((selectionPolicy) => {
        const group = runs.filter(
          (run) =>
            run.weaponId === weaponId &&
            run.selectionPolicy === selectionPolicy,
        );
        return {
          weaponId,
          selectionPolicy,
          runs: group.length,
          capstoneOffer: summarizeValues(
            group.map((run) => run.capstoneOffer ?? 0),
          ),
          upgrades: Object.fromEntries(
            getRelevantUpgradeIds(weaponId).map((upgradeId) => [
              upgradeId,
              {
                firstOfferLevel: summarizeValues(
                  group.map(
                    (run) =>
                      run.upgradeGaps[upgradeId].firstOfferLevel ?? 0,
                  ),
                ),
                maximumEligibleGap: summarizeValues(
                  group.map(
                    (run) => run.upgradeGaps[upgradeId].maximum,
                  ),
                ),
              },
            ]),
          ),
          categories: Object.fromEntries(
            BASE_CATEGORIES.map((category) => [
              category,
              {
                firstOfferLevel: summarizeValues(
                  group.map(
                    (run) =>
                      run.categoryGaps[category].firstOfferLevel ?? 0,
                  ),
                ),
                maximumEligibleGap: summarizeValues(
                  group.map(
                    (run) => run.categoryGaps[category].maximum,
                  ),
                ),
              },
            ]),
          ),
        };
      }),
    ),
  };
}

function getRelevantUpgradeIds(weaponId: ProbeWeapon): UpgradeId[] {
  const world = createWorld(SIMULATION_CONFIG);
  return getRemainingUpgradeIds(
    SIMULATION_CONFIG,
    world.progression.upgradeRanks,
    weaponId,
  );
}

function summarizeValues(values: number[]) {
  const sorted = [...values].sort((left, right) => left - right);
  return {
    p50: percentile(sorted, 0.5),
    p95: percentile(sorted, 0.95),
    max: sorted.at(-1) ?? 0,
  };
}

function percentile(sorted: number[], quantile: number): number {
  if (sorted.length === 0) return 0;
  return sorted[Math.ceil((sorted.length - 1) * quantile)]!;
}
