import { composeBuild } from "../../simulation/buildComposer";
import { completeBuild } from "../../simulation/systems/levelSystem";
import { updateRunStats } from "../../simulation/systems/statsSystem";
import type {
  GameEvent,
  SimulationConfig,
  StepWorldResult,
  WorldState,
} from "../../domain/types";
import { UPGRADE_IDS } from "../../domain/types";

export function enterDebugExProtocolStory(
  world: WorldState,
  config: SimulationConfig,
): StepWorldResult {
  if (!config.features.exProtocols) {
    throw new Error("Debug EX Protocol story requires the EX candidate profile.");
  }

  for (const upgradeId of UPGRADE_IDS) {
    world.progression.upgradeRanks[upgradeId] =
      config.upgrades[upgradeId].maxRank;
  }
  const composition = composeBuild(
    config,
    world.state.weaponType,
    world.progression.upgradeRanks,
    [],
    world.progression.extraUpgradeRanks,
  );
  Object.assign(world.runtime, composition.modifiers);
  world.state.hp = config.player.maxHp + world.runtime.maxHpBonus;

  const events: GameEvent[] = [];
  completeBuild(world, config, events);
  updateRunStats(world, events);
  if (world.state.status !== "protocolSelect") {
    throw new Error("Debug EX Protocol story did not open Protocol selection.");
  }
  return { events, metrics: [] };
}
