import type { GameEvent, SimulationConfig, UpgradeDefinition, WorldState } from "../../domain/types";

export function chooseUpgrade(
  world: WorldState,
  choiceIndex: number,
  config: SimulationConfig,
  events: GameEvent[],
): void {
  const upgradeId = world.progression.pendingUpgradeChoices[choiceIndex];
  if (!upgradeId) return;

  const upgrade = config.upgrades[upgradeId];
  const nextRank = world.progression.upgradeRanks[upgradeId] + 1;
  if (nextRank > upgrade.maxRank) return;

  world.progression.upgradeRanks[upgradeId] = nextRank;
  applyUpgrade(world, upgrade, config);
  world.progression.pendingUpgradeChoices = [];
  world.state.status = "playing";
  events.push({
    type: "upgrade.selected",
    upgradeId,
    rank: nextRank,
    level: world.progression.level,
    effect: upgrade.effect,
  });
}

function applyUpgrade(
  world: WorldState,
  upgrade: UpgradeDefinition,
  config: SimulationConfig,
): void {
  const effect = upgrade.effect;
  if (effect.type === "fireIntervalMultiplier") {
    world.runtime.fireIntervalMultiplier *= effect.multiplier;
  } else if (effect.type === "moveSpeedMultiplier") {
    world.runtime.playerSpeedMultiplier *= effect.multiplier;
  } else if (effect.type === "projectileSpeedMultiplier") {
    world.runtime.projectileSpeedMultiplier *= effect.multiplier;
  } else if (effect.type === "maxHp") {
    world.runtime.maxHpBonus += effect.amount;
    world.state.hp += effect.amount;
    const maxHp = config.player.maxHp + world.runtime.maxHpBonus;
    world.state.hp = Math.min(world.state.hp, maxHp);
  } else if (effect.type === "projectileCount") {
    world.runtime.projectileCountBonus += effect.amount;
  } else if (effect.type === "pierce") {
    world.runtime.pierceBonus += effect.amount;
  }
}
