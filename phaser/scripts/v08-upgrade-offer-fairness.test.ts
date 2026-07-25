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
  getRemainingUpgradeIds,
  updateLevelProgression,
} from "../src/simulation/systems/levelSystem";
import { chooseUpgrade } from "../src/simulation/systems/upgradeSystem";
import { updateRunStats } from "../src/simulation/systems/statsSystem";
import {
  UPGRADE_CATEGORY_FLOOR_INTERVENTION_LIMIT,
  UPGRADE_CATEGORY_FLOOR_MISS_LIMIT,
} from "../src/simulation/upgradeOfferFairness";

declare const process: { env: Record<string, string | undefined> };

type ProbeWeapon = Extract<WeaponTypeId, "pulse" | "spread">;
type SelectionPolicy = "observer-priority" | "first-card";
type OfferVariant = "control" | "category-floor-c1";
type GapState = {
  current: number;
  maximum: number;
  firstOfferLevel: number | null;
};

type OfferProbeRun = {
  seed: number;
  weaponId: ProbeWeapon;
  selectionPolicy: SelectionPolicy;
  variant: OfferVariant;
  offerCount: number;
  selectionCount: number;
  interventionCount: number;
  capstoneOffer: number | null;
  capstoneSelection: number | null;
  eventHash: string;
  worldHash: string;
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
const VARIANTS: OfferVariant[] = ["control", "category-floor-c1"];
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
      const candidates = first.filter(
        (run) => run.variant === "category-floor-c1",
      );
      expect(
        candidates.every(
          (run) =>
            run.interventionCount <=
            UPGRADE_CATEGORY_FLOOR_INTERVENTION_LIMIT,
        ),
      ).toBe(true);
      expect(
        candidates.every((run) =>
          BASE_CATEGORIES.every(
            (category) =>
              run.categoryGaps[category].maximum <=
              UPGRADE_CATEGORY_FLOOR_MISS_LIMIT,
          ),
        ),
      ).toBe(true);

      const summary = summarize(first);
      expect(summary.controlMatrixHash).toBe(
        FULL_PROBE ? "d14ba124" : "f81f9b61",
      );
      console.log(JSON.stringify(summary, null, 2));
    },
    120_000,
  );
});

function runMatrix(): OfferProbeRun[] {
  return SEEDS.flatMap((seed) =>
    WEAPONS.flatMap((weaponId) =>
      POLICIES.flatMap((selectionPolicy) =>
        VARIANTS.map((variant) =>
          runOfferProbe(seed, weaponId, selectionPolicy, variant),
        ),
      ),
    ),
  );
}

function runOfferProbe(
  seed: number,
  weaponId: ProbeWeapon,
  selectionPolicy: SelectionPolicy,
  variant: OfferVariant,
): OfferProbeRun {
  const config =
    variant === "category-floor-c1"
      ? {
          ...SIMULATION_CONFIG,
          features: {
            ...SIMULATION_CONFIG.features,
            upgradeCategoryFloor: true,
          },
        }
      : SIMULATION_CONFIG;
  const world = createWorld(config);
  world.state.weaponType = weaponId;
  const random = createRandomStreams(seed).upgrade;
  const upgradeGaps = createGapRecord(UPGRADE_IDS);
  const categoryGaps = createGapRecord(UPGRADE_CATEGORIES);
  const offerSequence: UpgradeId[][] = [];
  let capstoneOffer: number | null = null;
  let capstoneSelection: number | null = null;
  const eventSequence: unknown[] = [];

  for (let offerIndex = 0; offerIndex < 40; offerIndex += 1) {
    const remaining = getRemainingUpgradeIds(
      config,
      world.progression.upgradeRanks,
      weaponId,
    );
    if (remaining.length === 0) break;
    world.state.elapsed = (offerIndex + 1) * 8;
    world.progression.xp = world.progression.xpToNext;
    const offerEvents: Parameters<typeof updateRunStats>[1] = [];
    updateLevelProgression(world, random, config, offerEvents);
    updateRunStats(world, offerEvents);
    eventSequence.push(...offerEvents);
    const offer = offerEvents.find(
      (event) => event.type === "upgrade.offered",
    );
    expect(offer?.type).toBe("upgrade.offered");
    if (!offer || offer.type !== "upgrade.offered") break;
    const { choices, availableUpgradeIds: available, level } = offer;
    expect(choices.length).toBeGreaterThan(0);
    offerSequence.push([...choices]);
    recordUpgradeGaps(upgradeGaps, available, choices, level);
    recordCategoryGaps(categoryGaps, available, choices, level);
    if (
      capstoneOffer === null &&
      choices.some(
        (upgradeId) =>
          config.upgrades[upgradeId].category === "capstone",
      )
    ) {
      capstoneOffer = offerIndex + 1;
    }

    const selectedId = selectUpgrade(
      choices,
      world.progression.upgradeRanks,
      selectionPolicy,
    );
    const selectedIndex = choices.indexOf(selectedId);
    const selectionEvents: Parameters<typeof updateRunStats>[1] = [];
    chooseUpgrade(world, selectedIndex, config, selectionEvents);
    updateRunStats(world, selectionEvents);
    eventSequence.push(...selectionEvents);
    if (
      capstoneSelection === null &&
      config.upgrades[selectedId].category === "capstone"
    ) {
      capstoneSelection = offerIndex + 1;
    }
  }
  const completionEvents: Parameters<typeof updateRunStats>[1] = [];
  updateLevelProgression(world, random, config, completionEvents);
  updateRunStats(world, completionEvents);
  eventSequence.push(...completionEvents);

  return {
    seed,
    weaponId,
    selectionPolicy,
    variant,
    offerCount: offerSequence.length,
    selectionCount: Object.values(world.progression.upgradeRanks).reduce(
      (sum, rank) => sum + rank,
      0,
    ),
    capstoneOffer,
    capstoneSelection,
    interventionCount: world.stats.progressionMetrics.offers.filter(
      (offer) => offer.fairnessIntervention,
    ).length,
    eventHash: stableHash(JSON.stringify(eventSequence)),
    worldHash: stableHash(JSON.stringify(world)),
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
    controlMatrixHash: stableHash(
      JSON.stringify(
        runs
          .filter((run) => run.variant === "control")
          .map(toDigestInput),
      ),
    ),
    candidateMatrixHash: stableHash(
      JSON.stringify(
        runs
          .filter((run) => run.variant === "category-floor-c1")
          .map(toDigestInput),
      ),
    ),
    groups: VARIANTS.flatMap((variant) =>
      WEAPONS.flatMap((weaponId) =>
        POLICIES.map((selectionPolicy) => {
          const group = runs.filter(
            (run) =>
              run.variant === variant &&
              run.weaponId === weaponId &&
              run.selectionPolicy === selectionPolicy,
          );
          return {
            variant,
            weaponId,
            selectionPolicy,
            runs: group.length,
            interventions: summarizeValues(
              group.map((run) => run.interventionCount),
            ),
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
    ),
  };
}

function toDigestInput(run: OfferProbeRun) {
  return {
    seed: run.seed,
    weaponId: run.weaponId,
    selectionPolicy: run.selectionPolicy,
    offerSequence: run.offerSequence,
    interventionCount: run.interventionCount,
    capstoneOffer: run.capstoneOffer,
    eventHash: run.eventHash,
    worldHash: run.worldHash,
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

function stableHash(input: string): string {
  let hash = 0x811c9dc5;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}
