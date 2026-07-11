import type {
  Difficulty,
  EnemyTypeId,
  RandomSource,
  SimulationConfig,
  WaveBand,
} from "../domain/types";

const ENDLESS_STEP_SECONDS = 60;
const ENDLESS_MAX_STEPS = 8;
const ENDLESS_MIN_SPAWN_INTERVAL = 0.43;
const ENDLESS_MAX_SPAWN_BUDGET = 5;

export function getWaveBand(config: SimulationConfig, elapsed: number): WaveBand {
  let current = config.waves[0]!;
  for (const wave of config.waves) {
    if (wave.start <= elapsed) current = wave;
  }
  const finalWave = config.waves[config.waves.length - 1]!;
  if (current !== finalWave) return current;

  return applyEndlessPressure(finalWave, elapsed);
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

function applyEndlessPressure(finalWave: WaveBand, elapsed: number): WaveBand {
  const steps = Math.min(
    ENDLESS_MAX_STEPS,
    Math.floor((elapsed - finalWave.start) / ENDLESS_STEP_SECONDS),
  );
  if (steps <= 0) return finalWave;

  return {
    ...finalWave,
    spawnInterval: roundToThreeDecimals(
      Math.max(ENDLESS_MIN_SPAWN_INTERVAL, finalWave.spawnInterval - steps * 0.015),
    ),
    speedMultiplier: roundToThreeDecimals(finalWave.speedMultiplier + steps * 0.04),
    maxEnemies: finalWave.maxEnemies + steps * 2,
    spawnBudget: Math.min(ENDLESS_MAX_SPAWN_BUDGET, finalWave.spawnBudget + Math.floor(steps / 3)),
  };
}

function roundToThreeDecimals(value: number): number {
  return Math.round(value * 1000) / 1000;
}
