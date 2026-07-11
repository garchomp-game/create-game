import type { GameEvent, SimulationConfig, WorldState } from "../../domain/types";
import { composeBuild } from "../buildComposer";
import { getAvailableUpgradeIds, getRemainingUpgradeIds } from "./levelSystem";

export function chooseUpgrade(
  world: WorldState,
  choiceIndex: number,
  config: SimulationConfig,
  events: GameEvent[],
): void {
  const upgradeId = world.progression.pendingUpgradeChoices[choiceIndex];
  if (!upgradeId) return;

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
    world.progression.buildCompletedAt = world.state.elapsed;
    world.progression.xp = 0;
    world.progression.xpToNext = 0;
    events.push({
      type: "build.completed",
      level: world.progression.level,
      elapsed: world.state.elapsed,
    });
  }
}
