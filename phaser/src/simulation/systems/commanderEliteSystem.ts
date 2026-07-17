import { COMMANDER_ELITE_DEFINITION } from "../../content/eliteCatalog";
import type { EncounterDirection } from "../../domain/encounterDirector";
import type {
  Enemy,
  GameEvent,
  RandomSource,
  SimulationConfig,
  Vec2,
  WeaponTypeId,
  WorldState,
} from "../../domain/types";
import { estimatePointNavigationPath } from "../navigationField";
import { planStructuredSpawn } from "../structuredSpawnPlanner";
import { getSpawnWave, spawnEnemyAtPosition } from "./spawnSystem";

const DIRECTIONS: EncounterDirection[] = ["north", "east", "south", "west"];

export function spawnCommanderElite(
  world: WorldState,
  position: Vec2,
  config: SimulationConfig,
  events: GameEvent[],
): Enemy | null {
  const definition = COMMANDER_ELITE_DEFINITION;
  const wave = getSpawnWave(world, config);
  if (world.enemies.length >= wave.maxEnemies) return null;

  const commander = spawnEnemyAtPosition(
    world,
    definition.baseEnemyTypeId,
    wave,
    position,
    config,
  );
  commander.radius *= definition.radiusMultiplier;
  commander.hp = definition.maximumHp;
  commander.damage = Math.ceil(commander.damage * definition.damageMultiplier);
  commander.speed *= definition.speedMultiplier;
  commander.score = Math.round(commander.score * definition.scoreMultiplier);
  commander.xpValue = Math.round(commander.xpValue * definition.xpMultiplier);
  commander.elite = {
    kind: "commander",
    trait: definition.trait,
    maximumHp: definition.maximumHp,
    phase: "cooldown",
    spawnedAt: world.state.elapsed,
    nextTraitAt: world.state.elapsed + definition.initialTraitDelaySeconds,
    telegraphStartedAt: null,
    reinforcementSpawnAt: null,
    reinforcementDirection: null,
    activations: 0,
  };
  (world.eliteState ??= { commanderIds: [] }).commanderIds.push(commander.id);

  events.push({
    type: "enemy.spawned",
    enemyId: commander.id,
    enemyType: commander.typeId,
    position: { ...commander.position },
  });
  events.push({
    type: "elite.commander.spawned",
    enemyId: commander.id,
    position: { ...commander.position },
    trait: definition.trait,
  });
  return commander;
}

export function updateCommanderElites(
  world: WorldState,
  random: RandomSource,
  config: SimulationConfig,
  events: GameEvent[],
): void {
  const commanderIds = world.eliteState?.commanderIds;
  if (!commanderIds || commanderIds.length === 0) return;

  for (const commanderId of [...commanderIds]) {
    const commander = world.enemies.find((enemy) => enemy.id === commanderId);
    if (!commander?.elite || commander.elite.kind !== "commander") continue;
    const elite = commander.elite!;
    if (elite.phase === "telegraph") {
      if (
        elite.reinforcementSpawnAt !== null &&
        world.state.elapsed >= elite.reinforcementSpawnAt
      ) {
        deployReinforcements(world, commander, random, config, events);
      }
      continue;
    }

    if (world.state.elapsed < elite.nextTraitAt) continue;
    const activeReinforcements = countActiveReinforcements(world, commander.id);
    if (activeReinforcements >= COMMANDER_ELITE_DEFINITION.maximumActiveReinforcements) {
      elite.nextTraitAt = world.state.elapsed + COMMANDER_ELITE_DEFINITION.retryDelaySeconds;
      events.push({
        type: "elite.commander.reinforcement.deferred",
        enemyId: commander.id,
        reason: "activeReinforcementCap",
      });
      continue;
    }

    const direction = DIRECTIONS[Math.floor(random() * DIRECTIONS.length)]!;
    elite.phase = "telegraph";
    elite.telegraphStartedAt = world.state.elapsed;
    elite.reinforcementSpawnAt =
      world.state.elapsed + COMMANDER_ELITE_DEFINITION.telegraphSeconds;
    elite.reinforcementDirection = direction;
    events.push({
      type: "elite.commander.reinforcement.telegraphed",
      enemyId: commander.id,
      direction,
      position: { ...commander.position },
      spawnAt: elite.reinforcementSpawnAt,
    });
  }
}

export function releaseCommanderPressure(
  world: WorldState,
  commander: Enemy,
  weaponType: WeaponTypeId,
  events: GameEvent[],
): void {
  const elite = commander.elite;
  if (!elite || elite.kind !== "commander") return;
  if (world.eliteState) {
    world.eliteState.commanderIds = world.eliteState.commanderIds.filter(
      (enemyId) => enemyId !== commander.id,
    );
  }

  const releasedEnemyIds: string[] = [];
  for (const enemy of world.enemies) {
    if (enemy.support?.sourceEnemyId !== commander.id) continue;
    enemy.speed /= enemy.support.speedMultiplier;
    delete enemy.support;
    releasedEnemyIds.push(enemy.id);
  }

  events.push({
    type: "elite.commander.killed",
    enemyId: commander.id,
    weaponType,
    lifetime: Math.max(0, world.state.elapsed - elite.spawnedAt),
    traitActivations: elite.activations,
    position: { ...commander.position },
  });
  events.push({
    type: "elite.commander.pressure.lowered",
    enemyId: commander.id,
    releasedEnemyIds,
    position: { ...commander.position },
  });
}

function deployReinforcements(
  world: WorldState,
  commander: Enemy,
  random: RandomSource,
  config: SimulationConfig,
  events: GameEvent[],
): void {
  const definition = COMMANDER_ELITE_DEFINITION;
  const elite = commander.elite!;
  const wave = getSpawnWave(world, config);
  const activeReinforcements = countActiveReinforcements(world, commander.id);
  const count = Math.min(
    definition.reinforcementCount,
    definition.maximumActiveReinforcements - activeReinforcements,
  );
  const direction = elite.reinforcementDirection;
  const telegraphStartedAt = elite.telegraphStartedAt;
  const spawnAt = elite.reinforcementSpawnAt;

  if (!direction || telegraphStartedAt === null || spawnAt === null || count <= 0) {
    resetAfterDeferred(world, commander, events, "invalidTelegraphState");
    return;
  }

  const reinforcementRadius = config.enemies[definition.reinforcementTypeId].radius;
  const plan = planStructuredSpawn(
    {
      geometryId: "escort",
      direction,
      count,
      arena: {
        ...config.arena,
        playerStart: { x: config.player.x, y: config.player.y },
      },
      obstacles: world.obstacles,
      playerPosition: world.player.position,
      enemyRadius: reinforcementRadius,
      minimumPlayerDistance: definition.minimumPlayerDistance,
      spawnMargin: 32,
      collapseInset: world.encounter.collapse.inset,
      existingEnemyCount: world.enemies.length,
      maximumEnemies: wave.maxEnemies,
      telegraphStartedAt,
      spawnAt,
      isReachable: (entryPoint, radius) =>
        estimatePointNavigationPath(
          world,
          entryPoint,
          world.player.position,
          radius,
          config,
        ).reachable,
    },
    random,
  );

  if (plan.status === "deferred") {
    resetAfterDeferred(world, commander, events, plan.deferReason ?? "noSafeCandidate");
    return;
  }

  const reinforcementIds = plan.placements.map((placement) => {
    const reinforcement = spawnEnemyAtPosition(
      world,
      definition.reinforcementTypeId,
      wave,
      placement.position,
      config,
    );
    reinforcement.speed *= definition.reinforcementSpeedMultiplier;
    reinforcement.support = {
      sourceEnemyId: commander.id,
      speedMultiplier: definition.reinforcementSpeedMultiplier,
    };
    events.push({
      type: "enemy.spawned",
      enemyId: reinforcement.id,
      enemyType: reinforcement.typeId,
      position: { ...reinforcement.position },
    });
    return reinforcement.id;
  });

  elite.activations += 1;
  events.push({
    type: "elite.commander.reinforcement.deployed",
    enemyId: commander.id,
    direction: plan.placements[0]?.direction ?? direction,
    reinforcementIds,
    position: { ...commander.position },
  });
  resetCommanderCooldown(world, commander);
}

function resetAfterDeferred(
  world: WorldState,
  commander: Enemy,
  events: GameEvent[],
  reason: string,
): void {
  events.push({
    type: "elite.commander.reinforcement.deferred",
    enemyId: commander.id,
    reason,
  });
  resetCommanderCooldown(world, commander, COMMANDER_ELITE_DEFINITION.retryDelaySeconds);
}

function resetCommanderCooldown(
  world: WorldState,
  commander: Enemy,
  delay = COMMANDER_ELITE_DEFINITION.traitIntervalSeconds,
): void {
  const elite = commander.elite!;
  elite.phase = "cooldown";
  elite.nextTraitAt = world.state.elapsed + delay;
  elite.telegraphStartedAt = null;
  elite.reinforcementSpawnAt = null;
  elite.reinforcementDirection = null;
}

function countActiveReinforcements(world: WorldState, commanderId: string): number {
  return world.enemies.filter(
    (enemy) => enemy.support?.sourceEnemyId === commanderId,
  ).length;
}
