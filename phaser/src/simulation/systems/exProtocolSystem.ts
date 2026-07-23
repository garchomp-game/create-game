import type { GameEvent, SimulationConfig, WorldState } from "../../domain/types";
import { updateReboundLifecycle } from "../protocols/reboundOverdrive";
import { updateResonanceRelayLifecycle } from "../protocols/resonanceRelay";

export function updateExProtocolSpecialPhase(
  world: WorldState,
  specialPressed: boolean,
  config: SimulationConfig,
  events: GameEvent[],
): void {
  if (!config.features.exProtocols) return;
  updateResonanceRelayLifecycle(world);
  updateReboundLifecycle(world, specialPressed, events);
}
