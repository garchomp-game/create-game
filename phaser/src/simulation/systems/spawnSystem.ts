import type {
  Difficulty,
  Enemy,
  GameEvent,
  RandomSource,
  SimulationConfig,
  Vec2,
  WorldState,
} from "../../domain/types";
import { getWaveBand, selectEnemyTypeForWave } from "../waveDirector";
import { getEnemyHpMultiplier, getThreatMultipliers } from "../threatDirector";
import { getActiveEncounterDefinition } from "./encounterSystem";

export function updateSpawner(
  world: WorldState,
  dt: number,
  random: RandomSource,
  config: SimulationConfig,
  events: GameEvent[],
): void {
  if (world.expedition?.boss?.status === "active") return;
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

  return spawnEnemyAtPosition(world, typeId, difficulty, { x, y }, config);
}

export function spawnEnemyAtPosition(
  world: WorldState,
  typeId: Enemy["typeId"],
  difficulty: Difficulty,
  position: Vec2,
  config: SimulationConfig,
): Enemy {
  const definition = config.enemies[typeId];
  const threat = getThreatMultipliers(config, world.state.elapsed);
  const enemy: Enemy = {
    id: `enemy-${world.nextEnemyId++}`,
    typeId,
    position: { ...position },
    radius: definition.radius,
    hp: Math.ceil(definition.hp * getEnemyHpMultiplier(config, world.state.elapsed, typeId)),
    damage: Math.ceil(definition.damage * threat.damage),
    speed:
      definition.speed *
      difficulty.speedMultiplier *
      world.encounter.contract.enemySpeedMultiplier,
    score: Math.round(definition.score * threat.score),
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
  const expedition = world.expedition?.spawnOverride;
  if (expedition) {
    return {
      ...wave,
      spawnInterval: Math.max(
        0.2,
        wave.spawnInterval * expedition.intervalMultiplier,
      ),
      spawnBudget: Math.max(wave.spawnBudget, expedition.budget),
      enemyWeights: { ...expedition.enemyWeights },
    };
  }
  const encounter = getActiveEncounterDefinition(world, config);
  if (!encounter) return wave;
  return {
    ...wave,
    spawnInterval: Math.max(0.2, wave.spawnInterval * encounter.spawnIntervalMultiplier),
    spawnBudget: Math.max(wave.spawnBudget, encounter.spawnBudget),
    enemyWeights: { ...encounter.enemyWeights },
  };
}
