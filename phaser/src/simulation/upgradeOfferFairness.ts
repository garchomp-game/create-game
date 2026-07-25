import { UPGRADE_CATEGORIES } from "../domain/types";
import type {
  RandomSource,
  SimulationConfig,
  UpgradeCategory,
  UpgradeId,
  UpgradeOfferFairnessIntervention,
  UpgradeOfferRunStat,
} from "../domain/types";

export const UPGRADE_CATEGORY_FLOOR_MISS_LIMIT = 4;
export const UPGRADE_CATEGORY_FLOOR_INTERVENTION_LIMIT = 4;

type BaseUpgradeCategory = Exclude<UpgradeCategory, "capstone">;

export type UpgradeOfferFairnessResult = {
  choices: UpgradeId[];
  intervention?: UpgradeOfferFairnessIntervention;
};

const BASE_CATEGORIES = UPGRADE_CATEGORIES.filter(
  (category): category is BaseUpgradeCategory => category !== "capstone",
);

export function applyUpgradeCategoryFloor(
  config: SimulationConfig,
  random: RandomSource,
  availableUpgradeIds: readonly UpgradeId[],
  initialChoices: readonly UpgradeId[],
  offerHistory: readonly UpgradeOfferRunStat[],
): UpgradeOfferFairnessResult {
  const choices = [...initialChoices];
  if (
    !config.features.upgradeCategoryFloor ||
    choices.length === 0 ||
    countInterventions(offerHistory) >=
      UPGRADE_CATEGORY_FLOOR_INTERVENTION_LIMIT
  ) {
    return { choices };
  }

  const target = findFloorTarget(
    config,
    availableUpgradeIds,
    offerHistory,
  );
  if (!target || choices.some((id) => config.upgrades[id].category === target.category)) {
    return { choices };
  }

  const replacementIndex = findLastNonCapstoneIndex(config, choices);
  if (replacementIndex < 0) return { choices };

  const guaranteedPool = availableUpgradeIds.filter(
    (id) =>
      config.upgrades[id].category === target.category &&
      !choices.includes(id),
  );
  const guaranteedUpgradeId = drawWeightedUpgrade(
    config,
    random,
    guaranteedPool,
  );
  if (!guaranteedUpgradeId) return { choices };

  const replacedUpgradeId = choices[replacementIndex]!;
  choices[replacementIndex] = guaranteedUpgradeId;
  return {
    choices,
    intervention: {
      kind: "category-floor",
      category: target.category,
      replacedUpgradeId,
      guaranteedUpgradeId,
      eligibleMissGap: target.gap,
    },
  };
}

function findFloorTarget(
  config: SimulationConfig,
  availableUpgradeIds: readonly UpgradeId[],
  offerHistory: readonly UpgradeOfferRunStat[],
): { category: BaseUpgradeCategory; gap: number } | null {
  const availableCategories = new Set(
    availableUpgradeIds.map((id) => config.upgrades[id].category),
  );
  let target: { category: BaseUpgradeCategory; gap: number } | null = null;

  for (const category of BASE_CATEGORIES) {
    if (!availableCategories.has(category)) continue;
    const gap = getEligibleMissGap(config, category, offerHistory);
    if (gap < UPGRADE_CATEGORY_FLOOR_MISS_LIMIT) continue;
    if (!target || gap > target.gap) target = { category, gap };
  }
  return target;
}

function getEligibleMissGap(
  config: SimulationConfig,
  category: BaseUpgradeCategory,
  offerHistory: readonly UpgradeOfferRunStat[],
): number {
  let gap = 0;
  for (let index = offerHistory.length - 1; index >= 0; index -= 1) {
    const offer = offerHistory[index]!;
    const wasEligible = offer.availableUpgradeIds.some(
      (id) => config.upgrades[id].category === category,
    );
    if (!wasEligible) continue;
    const wasOffered = offer.choices.some(
      (id) => config.upgrades[id].category === category,
    );
    if (wasOffered) break;
    gap += 1;
  }
  return gap;
}

function countInterventions(
  offerHistory: readonly UpgradeOfferRunStat[],
): number {
  return offerHistory.reduce(
    (count, offer) => count + (offer.fairnessIntervention ? 1 : 0),
    0,
  );
}

function findLastNonCapstoneIndex(
  config: SimulationConfig,
  choices: readonly UpgradeId[],
): number {
  for (let index = choices.length - 1; index >= 0; index -= 1) {
    if (config.upgrades[choices[index]!].category !== "capstone") return index;
  }
  return -1;
}

function drawWeightedUpgrade(
  config: SimulationConfig,
  random: RandomSource,
  candidates: readonly UpgradeId[],
): UpgradeId | null {
  if (candidates.length === 0) return null;
  const totalWeight = candidates.reduce(
    (sum, id) => sum + config.upgrades[id].weight,
    0,
  );
  let roll = random() * totalWeight;
  for (const id of candidates) {
    roll -= config.upgrades[id].weight;
    if (roll <= 0) return id;
  }
  return candidates.at(-1) ?? null;
}

