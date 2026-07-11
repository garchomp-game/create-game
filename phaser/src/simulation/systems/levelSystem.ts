import { UPGRADE_IDS } from "../../domain/types";
import type {
  GameEvent,
  RandomSource,
  SimulationConfig,
  UpgradeId,
  WorldState,
} from "../../domain/types";
import {
  isUpgradeRelevant,
  meetsUpgradeRequirements,
} from "../buildComposer";

export function updateLevelProgression(
  world: WorldState,
  random: RandomSource,
  config: SimulationConfig,
  events: GameEvent[],
): void {
  if (world.state.status !== "playing") return;
  if (world.progression.buildCompletedAt !== null) return;
  if (
    getRemainingUpgradeIds(
      config,
      world.progression.upgradeRanks,
      world.state.weaponType,
    ).length === 0
  ) {
    world.progression.buildCompletedAt = world.state.elapsed;
    world.progression.xp = 0;
    world.progression.xpToNext = 0;
    events.push({
      type: "build.completed",
      level: world.progression.level,
      elapsed: world.state.elapsed,
    });
    return;
  }
  if (world.progression.xp < world.progression.xpToNext) return;

  world.progression.xp -= world.progression.xpToNext;
  world.progression.level += 1;
  world.progression.xpToNext = getXpToNextLevel(world.progression.level, config);
  const availableUpgradeIds = getAvailableUpgradeIds(
    config,
    world.progression.upgradeRanks,
    world.state.weaponType,
  );
  world.progression.pendingUpgradeChoices = selectUpgradeChoices(
    config,
    random,
    world.progression.upgradeRanks,
    world.state.weaponType,
  );
  events.push({
    type: "player.level_up",
    level: world.progression.level,
    choices: [...world.progression.pendingUpgradeChoices],
  });
  if (world.progression.pendingUpgradeChoices.length === 0) {
    completeBuild(world, events);
    return;
  }

  world.state.status = "upgradeSelect";
  events.push({
    type: "upgrade.offered",
    level: world.progression.level,
    choices: [...world.progression.pendingUpgradeChoices],
    availableUpgradeIds,
    lockedUpgradeIds: getLockedUpgradeIds(
      config,
      world.progression.upgradeRanks,
      world.state.weaponType,
    ),
    maxedUpgradeIds: getMaxedUpgradeIds(
      config,
      world.progression.upgradeRanks,
      world.state.weaponType,
    ),
  });
}

export function getXpToNextLevel(level: number, config: SimulationConfig): number {
  return Math.min(
    config.leveling.maxXp,
    Math.max(1, Math.floor(config.leveling.baseXp * config.leveling.growth ** (level - 1))),
  );
}

export function selectUpgradeChoices(
  config: SimulationConfig,
  random: RandomSource,
  upgradeRanks: Record<UpgradeId, number>,
  weaponType = config.defaultWeapon,
): UpgradeId[] {
  const available = getAvailableUpgradeIds(config, upgradeRanks, weaponType);
  const capstones = available.filter((id) => config.upgrades[id].category === "capstone");
  const choices: UpgradeId[] = capstones.slice(0, config.leveling.upgradeChoiceCount);
  for (const capstone of choices) {
    available.splice(available.indexOf(capstone), 1);
  }
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

export function getAvailableUpgradeIds(
  config: SimulationConfig,
  upgradeRanks: Record<UpgradeId, number>,
  weaponType = config.defaultWeapon,
): UpgradeId[] {
  return [...UPGRADE_IDS].filter((upgradeId) => {
    const definition = config.upgrades[upgradeId];
    return (
      definition &&
      upgradeRanks[upgradeId] < definition.maxRank &&
      meetsUpgradeRequirements(config, upgradeId, weaponType, upgradeRanks)
    );
  });
}

export function getRemainingUpgradeIds(
  config: SimulationConfig,
  upgradeRanks: Record<UpgradeId, number>,
  weaponType = config.defaultWeapon,
): UpgradeId[] {
  return [...UPGRADE_IDS].filter((upgradeId) => {
    const definition = config.upgrades[upgradeId];
    return (
      isUpgradeRelevant(config, upgradeId, weaponType) &&
      upgradeRanks[upgradeId] < definition.maxRank
    );
  });
}

export function getLockedUpgradeIds(
  config: SimulationConfig,
  upgradeRanks: Record<UpgradeId, number>,
  weaponType = config.defaultWeapon,
): UpgradeId[] {
  const available = new Set(getAvailableUpgradeIds(config, upgradeRanks, weaponType));
  return getRemainingUpgradeIds(config, upgradeRanks, weaponType).filter(
    (upgradeId) => !available.has(upgradeId),
  );
}

export function getMaxedUpgradeIds(
  config: SimulationConfig,
  upgradeRanks: Record<UpgradeId, number>,
  weaponType = config.defaultWeapon,
): UpgradeId[] {
  return [...UPGRADE_IDS].filter(
    (upgradeId) =>
      isUpgradeRelevant(config, upgradeId, weaponType) &&
      upgradeRanks[upgradeId] >= config.upgrades[upgradeId].maxRank,
  );
}

function completeBuild(world: WorldState, events: GameEvent[]): void {
  world.progression.buildCompletedAt = world.state.elapsed;
  world.progression.xp = 0;
  world.progression.xpToNext = 0;
  events.push({
    type: "build.completed",
    level: world.progression.level,
    elapsed: world.state.elapsed,
  });
}
