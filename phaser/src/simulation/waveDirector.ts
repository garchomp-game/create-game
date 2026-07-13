import type {
  Difficulty,
  EnemyTypeId,
  RandomSource,
  SimulationConfig,
  WaveBand,
} from "../domain/types";
import { getPressureStep } from "./threatDirector";

export function getWaveBand(config: SimulationConfig, elapsed: number): WaveBand {
  let current = config.waves[0]!;
  for (const wave of config.waves) {
    if (wave.start <= elapsed) current = wave;
  }
  const finalWave = config.waves[config.waves.length - 1]!;
  if (current !== finalWave) return current;

  return applyEndlessPressure(config, finalWave, elapsed);
}

export function getWaveDifficulty(config: SimulationConfig, elapsed: number): Difficulty {
  const wave = getWaveBand(config, elapsed);
  return {
    spawnInterval: wave.spawnInterval,
    speedMultiplier: wave.speedMultiplier,
    maxEnemies: wave.maxEnemies,
  };
}

export function selectEnemyTypeForWave(
  config: SimulationConfig,
  wave: WaveBand,
  budget: number,
  random: RandomSource,
): EnemyTypeId | null {
  const available = Object.entries(wave.enemyWeights).filter(([typeId, weight]) => {
    const definition = config.enemies[typeId as EnemyTypeId];
    return Boolean(weight && weight > 0 && definition.spawnCost <= budget);
  }) as Array<[EnemyTypeId, number]>;

  if (available.length === 0) return null;

  const totalWeight = available.reduce((sum, [, weight]) => sum + weight, 0);
  let roll = random() * totalWeight;
  for (const [typeId, weight] of available) {
    roll -= weight;
    if (roll <= 0) return typeId;
  }
  return available[available.length - 1]![0];
}

function applyEndlessPressure(
  config: SimulationConfig,
  finalWave: WaveBand,
  elapsed: number,
): WaveBand {
  const steps = getPressureStep(config, elapsed);
  if (steps <= 0) return finalWave;

  return {
    ...finalWave,
    spawnInterval: roundToThreeDecimals(
      Math.max(
        config.threat.minimumSpawnInterval,
        finalWave.spawnInterval - steps * config.threat.spawnIntervalStep,
      ),
    ),
    speedMultiplier: roundToThreeDecimals(
      Math.min(
        config.threat.maximumSpeedMultiplier,
        finalWave.speedMultiplier + steps * config.threat.speedMultiplierStep,
      ),
    ),
    maxEnemies: Math.min(
      config.threat.maximumEnemies,
      finalWave.maxEnemies + steps * config.threat.maxEnemiesStep,
    ),
    spawnBudget: Math.min(
      config.threat.maximumSpawnBudget,
      finalWave.spawnBudget + Math.floor(steps / config.threat.spawnBudgetStepInterval),
    ),
  };
}

function roundToThreeDecimals(value: number): number {
  return Math.round(value * 1000) / 1000;
}
