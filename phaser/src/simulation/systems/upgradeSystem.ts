import type { GameEvent, SimulationConfig, WorldState } from "../../domain/types";
import { composeBuild } from "../buildComposer";
import { isExtraUpgradeId } from "../extraProgression";
import { applyExtraUpgrade } from "./extraUpgradeSystem";
import { completeBuild, getAvailableUpgradeIds, getRemainingUpgradeIds } from "./levelSystem";
import {
  clearProgressionChoice,
  getPendingLimitBreakChoices,
  getPendingUpgradeChoices,
} from "../progressionChoices";
import {
  applyCapacityIncrease,
  getPlayerEffectiveMaxHp,
} from "./playerHealthSystem";

export function chooseUpgrade(
  world: WorldState,
  choiceIndex: number,
  config: SimulationConfig,
  events: GameEvent[],
): void {
  const limitBreakId = getPendingLimitBreakChoices(world)[choiceIndex];
  if (limitBreakId) {
    applyExtraUpgrade(world, limitBreakId, config, events);
    return;
  }

  const upgradeId = getPendingUpgradeChoices(world)[choiceIndex];
  if (!upgradeId || isExtraUpgradeId(upgradeId)) return;

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
  const effectiveMaxHpBefore = getPlayerEffectiveMaxHp(world, config);
  const composition = composeBuild(
    config,
    world.state.weaponType,
    world.progression.upgradeRanks,
    [],
    world.progression.extraUpgradeRanks,
  );
  Object.assign(world.runtime, composition.modifiers);
  applyCapacityIncrease(world, config, effectiveMaxHpBefore, true);
  clearProgressionChoice(world, config);
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
