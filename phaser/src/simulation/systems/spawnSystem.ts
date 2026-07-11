import type {
  Difficulty,
  Enemy,
  GameEvent,
  RandomSource,
  SimulationConfig,
  WorldState,
} from "../../domain/types";
import { getWaveBand, selectEnemyTypeForWave } from "../waveDirector";

export function updateSpawner(
  world: WorldState,
  dt: number,
  random: RandomSource,
  config: SimulationConfig,
  events: GameEvent[],
): void {
  const wave = getSpawnWave(world, config);
  if (world.enemies.length >= wave.maxEnemies) return;

  world.state.spawnTimer -= dt;
  let spawned = 0;
  let budgetRemaining = wave.spawnBudget;
  while (
    world.state.spawnTimer <= 0 &&
    world.enemies.length < wave.maxEnemies &&
    spawned < 4 &&
    budgetRemaining > 0
  ) {
    const typeId = selectEnemyTypeForWave(config, wave, budgetRemaining, random);
    if (!typeId) break;
    const enemy = spawnEnemy(world, typeId, wave, random, config);
    budgetRemaining -= config.enemies[typeId].spawnCost;
    events.push({
      type: "enemy.spawned",
      enemyId: enemy.id,
      enemyType: enemy.typeId,
      position: { ...enemy.position },
    });
    spawned += 1;
  }
  if (spawned > 0) {
    world.state.spawnTimer += wave.spawnInterval;
  }
}

function spawnEnemy(
  world: WorldState,
  typeId: Enemy["typeId"],
  difficulty: Difficulty,
  random: RandomSource,
  config: SimulationConfig,
): Enemy {
  const definition = config.enemies[typeId];
  const margin = 32;
  const side = Math.floor(random() * 4);
  let x = 0;
  let y = 0;

  if (side === 0) {
    x = random() * config.arena.width;
    y = -margin;
  } else if (side === 1) {
    x = config.arena.width + margin;
    y = random() * config.arena.height;
  } else if (side === 2) {
    x = random() * config.arena.width;
    y = config.arena.height + margin;
  } else {
    x = -margin;
    y = random() * config.arena.height;
  }

  const enemy: Enemy = {
    id: `enemy-${world.nextEnemyId++}`,
    typeId,
    position: { x, y },
    radius: definition.radius,
    hp: definition.hp,
    damage: definition.damage,
    speed:
      definition.speed *
      difficulty.speedMultiplier *
      world.encounter.contract.enemySpeedMultiplier,
    score: definition.score,
    xpValue: definition.xpValue,
    behavior: definition.behavior,
    attackTimer: definition.ranged ? definition.ranged.attackInterval * 0.5 : 0,
    enteredArena: false,
  };
  world.enemies.push(enemy);
  return enemy;
}

export function getSpawnWave(world: WorldState, config: SimulationConfig) {
  const wave = getWaveBand(config, world.state.elapsed);
  if (world.encounter.rangedSurge.phase !== "active") return wave;
  const surge = config.encounter.rangedSurge;
  return {
    ...wave,
    spawnInterval: Math.max(0.3, wave.spawnInterval * surge.spawnIntervalMultiplier),
    spawnBudget: Math.max(wave.spawnBudget, surge.spawnBudget),
    enemyWeights: { ...surge.enemyWeights },
  };
}
