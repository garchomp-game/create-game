import type { GameEvent, SimulationConfig, WorldState } from "../../domain/types";
import { composeBuild } from "../buildComposer";
import { isExtraUpgradeId } from "../extraProgression";
import { applyExtraUpgrade } from "./extraUpgradeSystem";
import { completeBuild, getAvailableUpgradeIds, getRemainingUpgradeIds } from "./levelSystem";

export function chooseUpgrade(
  world: WorldState,
  choiceIndex: number,
  config: SimulationConfig,
  events: GameEvent[],
): void {
  const choiceId = world.progression.pendingUpgradeChoices[choiceIndex];
  if (!choiceId) return;
  if (isExtraUpgradeId(choiceId)) {
    applyExtraUpgrade(world, choiceId, config, events);
    return;
  }

  const upgradeId = choiceId;

  const upgrade = config.upgrades[upgradeId];
  if (
    !getAvailableUpgradeIds(
      config,
      world.progression.upgradeRanks,
      world.state.weaponType,
    ).includes(upgradeId)
  ) {
    return;
  }
  const nextRank = world.progression.upgradeRanks[upgradeId] + 1;
  if (nextRank > upgrade.maxRank) return;

  world.progression.upgradeRanks[upgradeId] = nextRank;
  const maxHpBonusBefore = world.runtime.maxHpBonus;
  const composition = composeBuild(
    config,
    world.state.weaponType,
    world.progression.upgradeRanks,
    [],
    world.progression.extraUpgradeRanks,
  );
  Object.assign(world.runtime, composition.modifiers);
  world.state.hp += Math.max(0, world.runtime.maxHpBonus - maxHpBonusBefore);
  world.state.hp = Math.min(world.state.hp, config.player.maxHp + world.runtime.maxHpBonus);
  world.progression.pendingUpgradeChoices = [];
  world.state.status = "playing";
  events.push({
    type: "upgrade.selected",
    upgradeId,
    rank: nextRank,
    level: world.progression.level,
    effect: upgrade.effect,
  });
  if (
    getRemainingUpgradeIds(
      config,
      world.progression.upgradeRanks,
      world.state.weaponType,
    ).length === 0
  ) {
    completeBuild(world, config, events);
  }
}
