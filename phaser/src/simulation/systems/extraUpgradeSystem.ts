import type {
  ExtraUpgradeId,
  GameEvent,
  SimulationConfig,
  WorldState,
} from "../../domain/types";
import { composeBuild } from "../buildComposer";
import { canIncreaseExtraUpgrade } from "../extraProgression";

export function applyExtraUpgrade(
  world: WorldState,
  extraUpgradeId: ExtraUpgradeId,
  config: SimulationConfig,
  events: GameEvent[],
  automatic = false,
): boolean {
  if (world.progression.buildCompletedAt === null) return false;
  if (!world.progression.pendingUpgradeChoices.includes(extraUpgradeId)) return false;
  if (
    !canIncreaseExtraUpgrade(
      config,
      extraUpgradeId,
      world.progression.extraUpgradeRanks[extraUpgradeId],
    )
  ) {
    return false;
  }

  const nextRank = world.progression.extraUpgradeRanks[extraUpgradeId] + 1;
  world.progression.extraUpgradeRanks[extraUpgradeId] = nextRank;
  world.progression.extraCycleRemaining = world.progression.extraCycleRemaining.filter(
    (id) => id !== extraUpgradeId,
  );

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
    type: "extra.upgrade.selected",
    extraUpgradeId,
    rank: nextRank,
    level: world.progression.level,
    extraLevel: world.progression.extraLevel,
    cycle: world.progression.extraCycle,
    automatic,
    effect: config.extraUpgrades[extraUpgradeId].effect,
  });
  if (world.progression.extraCycleRemaining.length === 0) {
    events.push({
      type: "extra.cycle.completed",
      cycle: world.progression.extraCycle,
      extraLevel: world.progression.extraLevel,
    });
  }
  return true;
}
