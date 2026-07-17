import {
  FIRST_COMMAND_SHIP_DEFINITION,
  type FirstCommandShipDefinition,
} from "../../content/bossCatalog";
import type { EncounterDirection } from "../../domain/encounterDirector";
import type {
  BossAttackId,
  Enemy,
  EnemyProjectile,
  GameEvent,
  SimulationConfig,
  Vec2,
  WorldState,
} from "../../domain/types";
import type { RandomStreams } from "../../math/random";
import { normalize } from "../../math/vector";
import { estimatePointNavigationPath } from "../navigationField";
import { planStructuredSpawn } from "../structuredSpawnPlanner";
import { getSpawnWave, spawnEnemyAtPosition } from "./spawnSystem";

const INGRESS_DIRECTIONS: EncounterDirection[] = ["north", "east", "south", "west"];

export function spawnFirstExpeditionBoss(
  world: WorldState,
  events: GameEvent[],
  definition: FirstCommandShipDefinition = FIRST_COMMAND_SHIP_DEFINITION,
): Enemy | null {
  const expedition = world.expedition;
  if (!expedition || expedition.boss?.status === "active") return null;

  // The command ship starts a separate duel instead of inheriting road pressure.
  world.enemies.length = 0;
  world.enemyProjectiles.length = 0;

  const enemy: Enemy = {
    id: `enemy-${world.nextEnemyId++}`,
    typeId: definition.baseEnemyTypeId,
    position: { ...definition.spawnPosition },
    radius: definition.radius,
    hp: definition.maximumHp,
    damage: definition.contactDamage,
    speed: 0,
    score: definition.score,
    xpValue: definition.xpValue,
    behavior: "chase",
    attackTimer: Number.POSITIVE_INFINITY,
    enteredArena: true,
    boss: { bossId: definition.id },
  };
  world.enemies.push(enemy);

  const action = createAttackState(world, enemy, 1, 0, world.state.elapsed, definition);
  expedition.boss = {
    bossId: definition.id,
    enemyId: enemy.id,
    status: "active",
    maxHp: definition.maximumHp,
    phase: 1,
    phaseChangedAt: null,
    spawnedAt: world.state.elapsed,
    defeatedAt: null,
    nextAttackIndex: 1,
    action,
  };
  expedition.objective = "指揮艦を撃破する";
  expedition.spawnOverride = null;
  events.push({
    type: "boss.spawned",
    bossId: definition.id,
    enemyId: enemy.id,
    position: { ...enemy.position },
    maximumHp: definition.maximumHp,
    elapsed: world.state.elapsed,
  });
  events.push(createTelegraphEvent(expedition.boss, enemy));
  return enemy;
}

export function updateFirstExpeditionBoss(
  world: WorldState,
  random: RandomStreams,
  config: SimulationConfig,
  baseEvents: readonly GameEvent[],
  definition: FirstCommandShipDefinition = FIRST_COMMAND_SHIP_DEFINITION,
): GameEvent[] {
  const boss = world.expedition?.boss;
  if (!boss || boss.status !== "active") return [];

  const killed = baseEvents.find(
    (event): event is Extract<GameEvent, { type: "enemy.killed" }> =>
      event.type === "enemy.killed" && event.enemyId === boss.enemyId,
  );
  if (killed) {
    boss.status = "defeated";
    boss.defeatedAt = world.state.elapsed;
    return [{
      type: "boss.defeated",
      bossId: boss.bossId,
      enemyId: boss.enemyId,
      weaponType: killed.weaponType,
      position: { ...killed.position },
      elapsed: world.state.elapsed,
    }];
  }

  const enemy = getActiveBossEnemy(world);
  if (!enemy) return [];
  const events: GameEvent[] = [];
  if (
    boss.phase === 1 &&
    enemy.hp <= boss.maxHp * definition.phaseTwoHpRatio
  ) {
    boss.phase = 2;
    boss.phaseChangedAt = world.state.elapsed;
    boss.action = {
      ...boss.action,
      phase: "recovery",
      startedAt: world.state.elapsed,
      endsAt: world.state.elapsed + definition.phaseTransitionRecoverySeconds,
    };
    events.push({
      type: "boss.phase.changed",
      bossId: boss.bossId,
      enemyId: boss.enemyId,
      phase: 2,
      elapsed: world.state.elapsed,
    });
    events.push({
      type: "boss.attack.recovery.started",
      bossId: boss.bossId,
      enemyId: boss.enemyId,
      attackId: boss.action.attackId,
      phase: boss.phase,
      recoveryEndsAt: boss.action.endsAt,
      elapsed: world.state.elapsed,
    });
    return events;
  }

  for (let transition = 0; transition < 4; transition += 1) {
    if (world.state.elapsed < boss.action.endsAt) break;
    const transitionAt = boss.action.endsAt;
    if (boss.action.phase === "telegraph") {
      const projectileIds =
        boss.action.attackId === "targeted-salvo"
          ? executeTargetedSalvo(world, enemy, boss.phase, config, definition)
          : executeEscortSuppressiveSalvo(
              world,
              enemy,
              boss.phase,
              config,
              definition,
            );
      if (boss.action.attackId === "escort-pincer") {
        events.push(...executeEscortPincer(world, random, config, definition));
      }
      boss.action = {
        ...boss.action,
        phase: "execute",
        startedAt: transitionAt,
        endsAt:
          transitionAt +
          phaseValue(
            boss.action.attackId === "targeted-salvo"
              ? definition.targetedSalvo.executeSeconds
              : definition.escortPincer.executeSeconds,
            boss.phase,
          ),
      };
      events.push({
        type: "boss.attack.executed",
        bossId: boss.bossId,
        enemyId: boss.enemyId,
        attackId: boss.action.attackId,
        phase: boss.phase,
        projectileIds,
        elapsed: transitionAt,
      });
      continue;
    }
    if (boss.action.phase === "execute") {
      const recoverySeconds = phaseValue(
        boss.action.attackId === "targeted-salvo"
          ? definition.targetedSalvo.recoverySeconds
          : definition.escortPincer.recoverySeconds,
        boss.phase,
      );
      boss.action = {
        ...boss.action,
        phase: "recovery",
        startedAt: transitionAt,
        endsAt: transitionAt + recoverySeconds,
      };
      events.push({
        type: "boss.attack.recovery.started",
        bossId: boss.bossId,
        enemyId: boss.enemyId,
        attackId: boss.action.attackId,
        phase: boss.phase,
        recoveryEndsAt: boss.action.endsAt,
        elapsed: transitionAt,
      });
      continue;
    }

    boss.action = createAttackState(
      world,
      enemy,
      boss.phase,
      boss.nextAttackIndex,
      transitionAt,
      definition,
    );
    boss.nextAttackIndex += 1;
    events.push(createTelegraphEvent(boss, enemy));
  }
  return events;
}

export function getActiveBossEnemy(world: WorldState): Enemy | null {
  const boss = world.expedition?.boss;
  if (!boss || boss.status !== "active") return null;
  return world.enemies.find((enemy) => enemy.id === boss.enemyId) ?? null;
}

export function isBossFightActive(world: WorldState): boolean {
  return world.expedition?.boss?.status === "active";
}

function createAttackState(
  world: WorldState,
  enemy: Enemy,
  phase: 1 | 2,
  attackIndex: number,
  startedAt: number,
  definition: FirstCommandShipDefinition,
) {
  const attackId = definition.attackOrder[attackIndex % definition.attackOrder.length]!;
  const telegraphSeconds = phaseValue(
    attackId === "targeted-salvo"
      ? definition.targetedSalvo.telegraphSeconds
      : definition.escortPincer.telegraphSeconds,
    phase,
  );
  const aimDirection = directionBetween(enemy.position, world.player.position);
  const ingressDirection =
    attackId === "escort-pincer"
      ? INGRESS_DIRECTIONS[attackIndex % INGRESS_DIRECTIONS.length]!
      : null;
  return {
    attackId,
    phase: "telegraph" as const,
    startedAt,
    endsAt: startedAt + telegraphSeconds,
    aimDirection,
    ingressDirection,
  };
}

function createTelegraphEvent(
  boss: NonNullable<NonNullable<WorldState["expedition"]>["boss"]>,
  enemy: Enemy,
): Extract<GameEvent, { type: "boss.attack.telegraphed" }> {
  return {
    type: "boss.attack.telegraphed",
    bossId: boss.bossId,
    enemyId: boss.enemyId,
    attackId: boss.action.attackId,
    phase: boss.phase,
    duration: boss.action.endsAt - boss.action.startedAt,
    aimDirection: boss.action.aimDirection
      ? { ...boss.action.aimDirection }
      : null,
    ingressDirection: boss.action.ingressDirection,
    elapsed: boss.action.startedAt,
  };
}

function executeTargetedSalvo(
  world: WorldState,
  enemy: Enemy,
  phase: 1 | 2,
  config: SimulationConfig,
  definition: FirstCommandShipDefinition,
): string[] {
  const action = world.expedition!.boss!.action;
  const aim =
    action.aimDirection ??
    directionBetween(enemy.position, world.player.position);
  return spawnBossSalvo(
    world,
    enemy,
    aim,
    phaseValue(definition.targetedSalvo.projectileCount, phase),
    phaseValue(definition.targetedSalvo.spreadRadians, phase),
    definition.targetedSalvo.projectileRadius,
    phaseValue(definition.targetedSalvo.projectileSpeed, phase),
    definition.targetedSalvo.projectileLifetime,
    phaseValue(definition.targetedSalvo.projectileDamage, phase),
    "targeted-salvo",
    config,
  );
}

function executeEscortSuppressiveSalvo(
  world: WorldState,
  enemy: Enemy,
  phase: 1 | 2,
  config: SimulationConfig,
  definition: FirstCommandShipDefinition,
): string[] {
  const salvo = definition.escortPincer.suppressiveSalvo;
  const aim =
    world.expedition!.boss!.action.aimDirection ??
    directionBetween(enemy.position, world.player.position);
  return spawnBossSalvo(
    world,
    enemy,
    aim,
    phaseValue(salvo.projectileCount, phase),
    phaseValue(salvo.spreadRadians, phase),
    salvo.projectileRadius,
    phaseValue(salvo.projectileSpeed, phase),
    salvo.projectileLifetime,
    phaseValue(salvo.projectileDamage, phase),
    "escort-pincer",
    config,
  );
}

function spawnBossSalvo(
  world: WorldState,
  enemy: Enemy,
  aim: Vec2,
  count: number,
  spread: number,
  radius: number,
  speed: number,
  lifetime: number,
  damage: number,
  attackId: BossAttackId,
  config: SimulationConfig,
): string[] {
  const available = Math.max(
    0,
    Math.min(
      count,
      config.threat.maximumEnemyProjectiles - world.enemyProjectiles.length,
    ),
  );
  const projectileIds: string[] = [];
  for (let index = 0; index < available; index += 1) {
    const offsetRatio = available <= 1 ? 0 : index / (available - 1) - 0.5;
    const direction = rotate(aim, spread * offsetRatio);
    const spawnOffset = enemy.radius + radius + 4;
    const projectile: EnemyProjectile = {
      id: `enemy-projectile-${world.nextEnemyProjectileId++}`,
      position: {
        x: enemy.position.x + direction.x * spawnOffset,
        y: enemy.position.y + direction.y * spawnOffset,
      },
      velocity: { x: direction.x * speed, y: direction.y * speed },
      radius,
      lifetime,
      damage,
      source: {
        bossId: world.expedition!.boss!.bossId,
        bossAttackId: attackId,
      },
    };
    world.enemyProjectiles.push(projectile);
    projectileIds.push(projectile.id);
  }
  return projectileIds;
}

function executeEscortPincer(
  world: WorldState,
  random: RandomStreams,
  config: SimulationConfig,
  definition: FirstCommandShipDefinition,
): GameEvent[] {
  const boss = world.expedition!.boss!;
  const direction = boss.action.ingressDirection ?? "north";
  const wave = getSpawnWave(world, config);
  const count = phaseValue(definition.escortPincer.escortCount, boss.phase);
  const enemyRadius = Math.max(
    ...definition.escortPincer.escortTypeIds.map((id) => config.enemies[id].radius),
  );
  const plan = planStructuredSpawn(
    {
      geometryId: "pincer",
      fallbackGeometryId: "perimeter-random",
      direction,
      count,
      arena: {
        ...config.arena,
        playerStart: { x: config.player.x, y: config.player.y },
      },
      obstacles: world.obstacles,
      playerPosition: world.player.position,
      enemyRadius,
      minimumPlayerDistance: definition.escortPincer.minimumPlayerDistance,
      spawnMargin: 24,
      collapseInset: world.encounter.collapse.inset,
      existingEnemyCount: world.enemies.length,
      maximumEnemies: wave.maxEnemies,
      telegraphStartedAt: boss.action.startedAt,
      spawnAt: boss.action.endsAt,
      isReachable: (entryPoint, radius) =>
        estimatePointNavigationPath(
          world,
          entryPoint,
          world.player.position,
          radius,
          config,
        ).reachable,
    },
    random.spawn,
  );
  if (plan.status === "deferred") {
    return [{
      type: "boss.escort.deferred",
      bossId: boss.bossId,
      attackId: "escort-pincer",
      reason: plan.deferReason ?? "unknown",
      elapsed: world.state.elapsed,
    }];
  }

  const events: GameEvent[] = [];
  const enemyIds: string[] = [];
  plan.placements.forEach((placement, index) => {
    const typeId = definition.escortPincer.escortTypeIds[index % definition.escortPincer.escortTypeIds.length]!;
    const enemy = spawnEnemyAtPosition(world, typeId, wave, placement.position, config);
    enemy.bossAttackSource = {
      bossId: boss.bossId,
      bossAttackId: "escort-pincer",
    };
    enemyIds.push(enemy.id);
    events.push({
      type: "enemy.spawned",
      enemyId: enemy.id,
      enemyType: enemy.typeId,
      position: { ...enemy.position },
    });
  });
  events.push({
    type: "boss.escort.deployed",
    bossId: boss.bossId,
    attackId: "escort-pincer",
    direction,
    enemyIds,
    elapsed: world.state.elapsed,
  });
  return events;
}

function phaseValue<T>(values: [T, T], phase: 1 | 2): T {
  return values[phase - 1];
}

function directionBetween(from: Vec2, to: Vec2): Vec2 {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  if (dx === 0 && dy === 0) return { x: 0, y: 1 };
  return normalize(dx, dy);
}

function rotate(direction: Vec2, radians: number): Vec2 {
  const cosine = Math.cos(radians);
  const sine = Math.sin(radians);
  return {
    x: direction.x * cosine - direction.y * sine,
    y: direction.x * sine + direction.y * cosine,
  };
}
