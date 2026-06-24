import { SIMULATION_CONFIG } from "../config/gameConfig";
import type { Difficulty, SimulationConfig } from "../domain/types";
import { getWaveDifficulty } from "./waveDirector";

export function getDifficulty(
  elapsed: number,
  config: SimulationConfig = SIMULATION_CONFIG,
): Difficulty {
  return getWaveDifficulty(config, elapsed);
}
