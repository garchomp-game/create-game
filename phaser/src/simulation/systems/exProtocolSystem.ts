import type { GameEvent, SimulationConfig, WorldState } from "../../domain/types";
import { updateReboundLifecycle } from "../protocols/reboundOverdrive";

export function updateExProtocolSpecialPhase(
  world: WorldState,
  specialPressed: boolean,
  config: SimulationConfig,
  events: GameEvent[],
): void {
  if (!config.features.exProtocols) return;
  updateReboundLifecycle(world, specialPressed, events);
}
