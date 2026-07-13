import { EXTRA_UPGRADE_IDS } from "../domain/types";
import type {
  ExtraUpgradeId,
  ProgressionChoiceId,
  RandomSource,
  SimulationConfig,
} from "../domain/types";

const EXTRA_UPGRADE_SET = new Set<string>(EXTRA_UPGRADE_IDS);

export function isExtraUpgradeId(value: ProgressionChoiceId): value is ExtraUpgradeId {
  return EXTRA_UPGRADE_SET.has(value);
}

export function createEmptyExtraUpgradeRanks(): Record<ExtraUpgradeId, number> {
  return Object.fromEntries(EXTRA_UPGRADE_IDS.map((id) => [id, 0])) as Record<
    ExtraUpgradeId,
    number
  >;
}

export function getExtraXpToNextLevel(
  extraLevel: number,
  config: SimulationConfig,
): number {
  const extra = config.leveling.extra;
  return Math.min(
    extra.maxXp,
    Math.max(1, Math.floor(extra.baseXp * extra.growth ** Math.max(0, extraLevel))),
  );
}

export function selectExtraUpgradeChoices(
  config: SimulationConfig,
  random: RandomSource,
  ranks: Record<ExtraUpgradeId, number> = createEmptyExtraUpgradeRanks(),
): ExtraUpgradeId[] {
  const available = EXTRA_UPGRADE_IDS.filter((id) => canIncreaseExtraUpgrade(config, id, ranks[id]));
  const choices: ExtraUpgradeId[] = [];
  while (
    available.length > 0 &&
    choices.length < config.leveling.extra.upgradeChoiceCount
  ) {
    const totalWeight = available.reduce(
      (sum, id) => sum + config.extraUpgrades[id].weight,
      0,
    );
    let roll = random() * totalWeight;
    let selectedIndex = available.length - 1;
    for (let index = 0; index < available.length; index += 1) {
      roll -= config.extraUpgrades[available[index]!].weight;
      if (roll <= 0) {
        selectedIndex = index;
        break;
      }
    }
    const [selected] = available.splice(selectedIndex, 1);
    choices.push(selected!);
  }
  return choices;
}

export function canIncreaseExtraUpgrade(
  config: SimulationConfig,
  id: ExtraUpgradeId,
  rank: number,
): boolean {
  const effect = config.extraUpgrades[id].effect;
  if (effect.type !== "fireRate" && effect.type !== "moveSpeed") return true;
  return effect.amountPerRank * rank < effect.maximumBonus;
}
