import { EXTRA_UPGRADE_IDS, UPGRADE_CATEGORIES, UPGRADE_IDS } from "../domain/types";
import type {
  ExtraUpgradeEffect,
  ExtraUpgradeId,
  RuntimeModifiers,
  SimulationConfig,
  UpgradeCategory,
  UpgradeEffect,
  UpgradeId,
  WeaponTypeId,
} from "../domain/types";

export type CombatModifiers = Pick<
  RuntimeModifiers,
  | "playerSpeedMultiplier"
  | "fireIntervalMultiplier"
  | "projectileSpeedMultiplier"
  | "projectileDamageMultiplier"
  | "maxHpBonus"
  | "projectileCountBonus"
  | "hitCapacityBonus"
  | "ricochetBonus"
  | "pulseFocusBonusPerStack"
  | "pulseFocusMaxStacks"
  | "pulseFocusDuration"
  | "spreadSweepDistinctTargets"
  | "spreadSweepNextIntervalMultiplier"
>;

export type BuildContribution = {
  source: "upgrade" | "capstone" | "extra" | "temporary";
  upgradeId: UpgradeId | null;
  extraUpgradeId?: ExtraUpgradeId;
  rank: number;
  effect: UpgradeEffect | ExtraUpgradeEffect;
};

export type BuildComposition = {
  weaponType: WeaponTypeId;
  modifiers: CombatModifiers;
  categoryRanks: Record<UpgradeCategory, number>;
  contributions: BuildContribution[];
};

export type UpgradeRequirementProgress = {
  category: UpgradeCategory;
  current: number;
  required: number;
};

export function composeBuild(
  config: SimulationConfig,
  weaponType: WeaponTypeId,
  upgradeRanks: Record<UpgradeId, number>,
  temporaryEffects: readonly UpgradeEffect[] = [],
  extraUpgradeRanks: Record<ExtraUpgradeId, number> = createEmptyExtraUpgradeRanks(),
): BuildComposition {
  const modifiers = createBaseCombatModifiers();
  const categoryRanks = getCategoryRanks(config, upgradeRanks);
  const contributions: BuildContribution[] = [];
  const orderedIds = [
    ...UPGRADE_IDS.filter((id) => config.upgrades[id].category !== "capstone"),
    ...UPGRADE_IDS.filter((id) => config.upgrades[id].category === "capstone"),
  ];

  for (const upgradeId of orderedIds) {
    const definition = config.upgrades[upgradeId];
    const rank = Math.min(definition.maxRank, Math.max(0, upgradeRanks[upgradeId]));
    if (rank === 0 || !isUpgradeRelevant(config, definition.id, weaponType)) continue;
    for (let index = 0; index < rank; index += 1) {
      applyEffect(modifiers, definition.effect, weaponType);
    }
    contributions.push({
      source: definition.category === "capstone" ? "capstone" : "upgrade",
      upgradeId,
      rank,
      effect: { ...definition.effect },
    });
  }

  for (const extraUpgradeId of EXTRA_UPGRADE_IDS) {
    const rank = Math.max(0, extraUpgradeRanks[extraUpgradeId]);
    if (rank === 0) continue;
    const definition = config.extraUpgrades[extraUpgradeId];
    applyExtraEffect(modifiers, definition.effect, rank);
    contributions.push({
      source: "extra",
      upgradeId: null,
      extraUpgradeId,
      rank,
      effect: { ...definition.effect },
    });
  }

  for (const effect of temporaryEffects) {
    applyEffect(modifiers, effect, weaponType);
    contributions.push({ source: "temporary", upgradeId: null, rank: 1, effect: { ...effect } });
  }

  return { weaponType, modifiers, categoryRanks, contributions };
}

export function getCategoryRanks(
  config: SimulationConfig,
  upgradeRanks: Record<UpgradeId, number>,
): Record<UpgradeCategory, number> {
  const ranks = Object.fromEntries(UPGRADE_CATEGORIES.map((category) => [category, 0])) as Record<
    UpgradeCategory,
    number
  >;
  for (const upgradeId of UPGRADE_IDS) {
    const definition = config.upgrades[upgradeId];
    ranks[definition.category] += Math.min(
      definition.maxRank,
      Math.max(0, upgradeRanks[upgradeId]),
    );
  }
  return ranks;
}

export function isUpgradeRelevant(
  config: SimulationConfig,
  upgradeId: UpgradeId,
  weaponType: WeaponTypeId,
): boolean {
  const requirements = config.upgrades[upgradeId].requirements;
  if (requirements?.weaponIds && !requirements.weaponIds.includes(weaponType)) return false;
  if (requirements?.featureFlag && !config.features[requirements.featureFlag]) return false;
  return true;
}

export function getUpgradeRequirementProgress(
  config: SimulationConfig,
  upgradeId: UpgradeId,
  upgradeRanks: Record<UpgradeId, number>,
): UpgradeRequirementProgress[] {
  const minimums = config.upgrades[upgradeId].requirements?.minimumCategoryRanks;
  if (!minimums) return [];
  const categoryRanks = getCategoryRanks(config, upgradeRanks);
  return UPGRADE_CATEGORIES.flatMap((category) => {
    const required = minimums[category];
    return required === undefined
      ? []
      : [{ category, current: categoryRanks[category], required }];
  });
}

export function meetsUpgradeRequirements(
  config: SimulationConfig,
  upgradeId: UpgradeId,
  weaponType: WeaponTypeId,
  upgradeRanks: Record<UpgradeId, number>,
): boolean {
  return (
    isUpgradeRelevant(config, upgradeId, weaponType) &&
    getUpgradeRequirementProgress(config, upgradeId, upgradeRanks).every(
      ({ current, required }) => current >= required,
    )
  );
}

function createBaseCombatModifiers(): CombatModifiers {
  return {
    playerSpeedMultiplier: 1,
    fireIntervalMultiplier: 1,
    projectileSpeedMultiplier: 1,
    projectileDamageMultiplier: 1,
    maxHpBonus: 0,
    projectileCountBonus: 0,
    hitCapacityBonus: 0,
    ricochetBonus: 0,
    pulseFocusBonusPerStack: 0,
    pulseFocusMaxStacks: 0,
    pulseFocusDuration: 0,
    spreadSweepDistinctTargets: 0,
    spreadSweepNextIntervalMultiplier: 1,
  };
}

function createEmptyExtraUpgradeRanks(): Record<ExtraUpgradeId, number> {
  return Object.fromEntries(EXTRA_UPGRADE_IDS.map((id) => [id, 0])) as Record<
    ExtraUpgradeId,
    number
  >;
}

function applyExtraEffect(
  modifiers: CombatModifiers,
  effect: ExtraUpgradeEffect,
  rank: number,
): void {
  if (effect.type === "projectileDamage") {
    modifiers.projectileDamageMultiplier *= 1 + effect.amountPerRank * rank;
  } else if (effect.type === "fireRate") {
    const bonus = Math.min(effect.maximumBonus, effect.amountPerRank * rank);
    modifiers.fireIntervalMultiplier /= 1 + bonus;
  } else if (effect.type === "moveSpeed") {
    const bonus = Math.min(effect.maximumBonus, effect.amountPerRank * rank);
    modifiers.playerSpeedMultiplier *= 1 + bonus;
  } else {
    modifiers.maxHpBonus += effect.amountPerRank * rank;
  }
}

export function getProjectileSpeedUpgradeMultiplier(
  effect: Extract<UpgradeEffect, { type: "projectileSpeedMultiplier" }>,
  weaponType: WeaponTypeId,
): number {
  return effect.weaponMultipliers?.[weaponType] ?? effect.multiplier;
}

function applyEffect(
  modifiers: CombatModifiers,
  effect: UpgradeEffect,
  weaponType: WeaponTypeId,
): void {
  if (effect.type === "fireIntervalMultiplier") {
    modifiers.fireIntervalMultiplier *= effect.multiplier;
  } else if (effect.type === "moveSpeedMultiplier") {
    modifiers.playerSpeedMultiplier *= effect.multiplier;
  } else if (effect.type === "projectileSpeedMultiplier") {
    modifiers.projectileSpeedMultiplier *= getProjectileSpeedUpgradeMultiplier(effect, weaponType);
  } else if (effect.type === "maxHp") {
    modifiers.maxHpBonus += effect.amount;
  } else if (effect.type === "projectileCount") {
    modifiers.projectileCountBonus += effect.amount;
  } else if (effect.type === "hitCapacity") {
    modifiers.hitCapacityBonus += effect.amount;
  } else if (effect.type === "ricochet") {
    modifiers.ricochetBonus += effect.amount;
  } else if (effect.type === "pulseFocus") {
    modifiers.pulseFocusBonusPerStack = Math.max(
      modifiers.pulseFocusBonusPerStack,
      effect.bonusPerStack,
    );
    modifiers.pulseFocusMaxStacks += effect.stacksPerRank;
    modifiers.pulseFocusDuration = Math.max(modifiers.pulseFocusDuration, effect.duration);
  } else {
    modifiers.spreadSweepDistinctTargets = effect.distinctTargets;
    modifiers.spreadSweepNextIntervalMultiplier = effect.nextIntervalMultiplier;
  }
}
