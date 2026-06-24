import { UPGRADE_IDS } from "../../domain/types";
import type {
  GameEvent,
  RandomSource,
  SimulationConfig,
  UpgradeId,
  WorldState,
} from "../../domain/types";

export function updateLevelProgression(
  world: WorldState,
  random: RandomSource,
  config: SimulationConfig,
  events: GameEvent[],
): void {
  if (world.state.status !== "playing") return;
  if (world.progression.xp < world.progression.xpToNext) return;

  world.progression.xp -= world.progression.xpToNext;
  world.progression.level += 1;
  world.progression.xpToNext = getXpToNextLevel(world.progression.level, config);
  world.progression.pendingUpgradeChoices = selectUpgradeChoices(
    config,
    random,
    world.progression.upgradeRanks,
  );
  events.push({
    type: "player.level_up",
    level: world.progression.level,
    choices: [...world.progression.pendingUpgradeChoices],
  });
  if (world.progression.pendingUpgradeChoices.length === 0) return;

  world.state.status = "upgradeSelect";
  events.push({
    type: "upgrade.offered",
    level: world.progression.level,
    choices: [...world.progression.pendingUpgradeChoices],
  });
}

export function getXpToNextLevel(level: number, config: SimulationConfig): number {
  return Math.max(1, Math.floor(config.leveling.baseXp * config.leveling.growth ** (level - 1)));
}

export function selectUpgradeChoices(
  config: SimulationConfig,
  random: RandomSource,
  upgradeRanks: Record<UpgradeId, number>,
): UpgradeId[] {
  const available = [...UPGRADE_IDS].filter((upgradeId) => {
    const definition = config.upgrades[upgradeId];
    return definition && upgradeRanks[upgradeId] < definition.maxRank;
  });
  const choices: UpgradeId[] = [];
  while (available.length > 0 && choices.length < config.leveling.upgradeChoiceCount) {
    const totalWeight = available.reduce(
      (sum, upgradeId) => sum + config.upgrades[upgradeId].weight,
      0,
    );
    let roll = random() * totalWeight;
    let index = available.length - 1;
    for (let candidateIndex = 0; candidateIndex < available.length; candidateIndex += 1) {
      const upgradeId = available[candidateIndex]!;
      roll -= config.upgrades[upgradeId].weight;
      if (roll <= 0) {
        index = candidateIndex;
        break;
      }
    }
    const [choice] = available.splice(index, 1);
    choices.push(choice!);
  }
  return choices;
}
