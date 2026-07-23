import type { GameEvent, SimulationConfig, WorldState } from "../../domain/types";
import { updateReboundLifecycle } from "../protocols/reboundOverdrive";
import { updateResonanceRelayLifecycle } from "../protocols/resonanceRelay";
import {
  activateTidalSweep,
  updateTidalLifecycle,
} from "../protocols/tidalSweep";
import { activateBreakwaterFan } from "../protocols/breakwaterFan";

export function updateExProtocolSpecialPhase(
  world: WorldState,
  specialPressed: boolean,
  config: SimulationConfig,
  events: GameEvent[],
): void {
  if (!config.features.exProtocols) return;
  updateResonanceRelayLifecycle(world);
  updateReboundLifecycle(world, specialPressed, events);
  updateTidalLifecycle(world);
  activateTidalSweep(world, specialPressed, config, events);
  activateBreakwaterFan(world, specialPressed, config, events);
}
