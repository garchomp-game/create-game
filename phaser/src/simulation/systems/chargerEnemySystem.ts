import { TELEGRAPH_CHARGER_DEFINITION } from "../../content/chargerCatalog";
import type {
  Enemy,
  GameEvent,
  SimulationConfig,
  Vec2,
  WeaponTypeId,
  WorldState,
} from "../../domain/types";
import { normalize } from "../../math/vector";
import {
  getEnemyApproachNavigation,
  hasClearNavigationPath,
  type EnemyNavigationResult,
} from "../navigationField";
import { getSpawnWave, spawnEnemyAtPosition } from "./spawnSystem";
import { moveCircleWithObstacles } from "./movement";

export function spawnTelegraphCharger(
  world: WorldState,
  position: Vec2,
  config: SimulationConfig,
  events: GameEvent[],
): Enemy | null {
  const definition = TELEGRAPH_CHARGER_DEFINITION;
  const wave = getSpawnWave(world, config);
  if (world.enemies.length >= wave.maxEnemies) return null;

  const charger = spawnEnemyAtPosition(
    world,
    definition.baseEnemyTypeId,
    wave,
    position,
    config,
  );
  charger.radius *= definition.radiusMultiplier;
  charger.hp = Math.ceil(charger.hp * definition.hpMultiplier);
  charger.damage = Math.ceil(charger.damage * definition.damageMultiplier);
  charger.speed *= definition.approachSpeedMultiplier;
  charger.score = Math.round(charger.score * definition.scoreMultiplier);
  charger.xpValue = Math.round(charger.xpValue * definition.xpMultiplier);
  charger.action = {
    kind: "charger",
    phase: "approach",
    spawnedAt: world.state.elapsed,
    phaseStartedAt: world.state.elapsed,
    phaseEndsAt: world.state.elapsed + definition.initialDelaySeconds,
    chargeDirection: null,
    chargeStartPosition: null,
    charges: 0,
    hitPlayerDuringCharge: false,
  };
  (world.enemyActionState ??= { chargerIds: [] }).chargerIds.push(charger.id);
  events.push({
    type: "enemy.spawned",
    enemyId: charger.id,
    enemyType: charger.typeId,
    position: { ...charger.position },
  });
  events.push({
    type: "enemy.charger.spawned",
    enemyId: charger.id,
    position: { ...charger.position },
  });
  return charger;
}

export function updateChargerEnemy(
  world: WorldState,
  enemy: Enemy,
  dt: number,
  config: SimulationConfig,
  events: GameEvent[],
): EnemyNavigationResult | null {
  const action = enemy.action;
  if (!action || action.kind !== "charger") return null;

  if (action.phase === "approach") {
    const navigation = getEnemyApproachNavigation(world, enemy, config);
    moveEnemy(world, enemy, navigation.direction, enemy.speed, dt);
    tryStartTelegraph(world, enemy, config, events);
    return navigation;
  }

  if (action.phase === "telegraph") {
    if (world.state.elapsed >= action.phaseEndsAt) {
      action.phase = "prepare";
      action.phaseStartedAt = world.state.elapsed;
      action.phaseEndsAt = world.state.elapsed + TELEGRAPH_CHARGER_DEFINITION.prepareSeconds;
      events.push({
        type: "enemy.charger.prepare.started",
        enemyId: enemy.id,
        position: { ...enemy.position },
        direction: { ...action.chargeDirection! },
        duration: TELEGRAPH_CHARGER_DEFINITION.prepareSeconds,
      });
    }
    return stationaryNavigation();
  }

  if (action.phase === "prepare") {
    if (world.state.elapsed >= action.phaseEndsAt) {
      action.phase = "charge";
      action.phaseStartedAt = world.state.elapsed;
      action.phaseEndsAt = world.state.elapsed + TELEGRAPH_CHARGER_DEFINITION.chargeSeconds;
      action.chargeStartPosition = { ...enemy.position };
      action.hitPlayerDuringCharge = false;
      action.charges += 1;
      events.push({
        type: "enemy.charger.charge.started",
        enemyId: enemy.id,
        position: { ...enemy.position },
        direction: { ...action.chargeDirection! },
        duration: TELEGRAPH_CHARGER_DEFINITION.chargeSeconds,
      });
    }
    return stationaryNavigation();
  }

  if (action.phase === "charge") {
    if (world.state.elapsed >= action.phaseEndsAt) {
      endCharge(world, enemy, "timeout", events);
      return stationaryNavigation();
    }
    const direction = action.chargeDirection!;
    const distance = TELEGRAPH_CHARGER_DEFINITION.chargeSpeed * dt;
    const target = {
      x: enemy.position.x + direction.x * distance,
      y: enemy.position.y + direction.y * distance,
    };
    if (!isInsideArena(target, enemy.radius, config)) {
      endCharge(world, enemy, "arenaBoundary", events);
      return stationaryNavigation();
    }

    const before = { ...enemy.position };
    moveEnemy(world, enemy, direction, TELEGRAPH_CHARGER_DEFINITION.chargeSpeed, dt);
    const travelled = Math.hypot(
      enemy.position.x - before.x,
      enemy.position.y - before.y,
    );
    if (travelled < distance * 0.9) {
      endCharge(world, enemy, "obstacle", events);
    }
    return { direction, mode: "direct", fieldBuilt: false };
  }

  if (world.state.elapsed >= action.phaseEndsAt) {
    action.phase = "approach";
    action.phaseStartedAt = world.state.elapsed;
    action.phaseEndsAt = world.state.elapsed + TELEGRAPH_CHARGER_DEFINITION.cooldownSeconds;
    action.chargeDirection = null;
    action.chargeStartPosition = null;
    events.push({
      type: "enemy.charger.recovered",
      enemyId: enemy.id,
      position: { ...enemy.position },
    });
  }
  return stationaryNavigation();
}

export function recordChargerPlayerHit(
  enemy: Enemy,
  damage: number,
  events: GameEvent[],
): void {
  const action = enemy.action;
  if (!action || action.kind !== "charger" || action.phase !== "charge") return;
  action.hitPlayerDuringCharge = true;
  events.push({
    type: "enemy.charger.player.hit",
    enemyId: enemy.id,
    damage,
  });
}

export function recordChargerKilled(
  world: WorldState,
  enemy: Enemy,
  weaponType: WeaponTypeId,
  events: GameEvent[],
): void {
  const action = enemy.action;
  if (!action || action.kind !== "charger") return;
  if (world.enemyActionState) {
    world.enemyActionState.chargerIds = world.enemyActionState.chargerIds.filter(
      (enemyId) => enemyId !== enemy.id,
    );
  }
  events.push({
    type: "enemy.charger.killed",
    enemyId: enemy.id,
    weaponType,
    phase: action.phase,
    position: { ...enemy.position },
  });
}

function tryStartTelegraph(
  world: WorldState,
  enemy: Enemy,
  config: SimulationConfig,
  events: GameEvent[],
): void {
  const action = enemy.action!;
  const definition = TELEGRAPH_CHARGER_DEFINITION;
  if (
    !enemy.enteredArena ||
    world.state.elapsed < action.phaseEndsAt ||
    countReservedCharges(world, enemy.id) >= definition.maximumConcurrentCharges
  ) return;

  const offset = {
    x: world.player.position.x - enemy.position.x,
    y: world.player.position.y - enemy.position.y,
  };
  const playerDistance = Math.hypot(offset.x, offset.y);
  if (playerDistance > definition.triggerRange || playerDistance < 1) return;
  const direction = normalize(offset.x, offset.y);
  const clearPoint = {
    x: enemy.position.x + direction.x * definition.minimumClearChargeDistance,
    y: enemy.position.y + direction.y * definition.minimumClearChargeDistance,
  };
  if (
    !isInsideArena(clearPoint, enemy.radius, config) ||
    !hasClearNavigationPath(enemy.position, clearPoint, enemy.radius, world.obstacles)
  ) return;

  action.phase = "telegraph";
  action.phaseStartedAt = world.state.elapsed;
  action.phaseEndsAt = world.state.elapsed + definition.telegraphSeconds;
  action.chargeDirection = direction;
  events.push({
    type: "enemy.charger.telegraph.started",
    enemyId: enemy.id,
    position: { ...enemy.position },
    direction: { ...direction },
    duration: definition.telegraphSeconds + definition.prepareSeconds,
  });
}

function endCharge(
  world: WorldState,
  enemy: Enemy,
  reason: "timeout" | "obstacle" | "arenaBoundary",
  events: GameEvent[],
): void {
  const action = enemy.action!;
  action.phase = "recovery";
  action.phaseStartedAt = world.state.elapsed;
  action.phaseEndsAt = world.state.elapsed + TELEGRAPH_CHARGER_DEFINITION.recoverySeconds;
  events.push({
    type: "enemy.charger.charge.ended",
    enemyId: enemy.id,
    position: { ...enemy.position },
    reason,
    hitPlayer: action.hitPlayerDuringCharge,
    recoveryEndsAt: action.phaseEndsAt,
  });
}

function countReservedCharges(world: WorldState, currentEnemyId: string): number {
  const chargerIds = world.enemyActionState?.chargerIds ?? [];
  let count = 0;
  for (const chargerId of chargerIds) {
    if (chargerId === currentEnemyId) continue;
    const charger = world.enemies.find((enemy) => enemy.id === chargerId);
    const phase = charger?.action?.phase;
    if (phase === "telegraph" || phase === "prepare" || phase === "charge") count += 1;
  }
  return count;
}

function moveEnemy(
  world: WorldState,
  enemy: Enemy,
  direction: Vec2,
  speed: number,
  dt: number,
): void {
  moveCircleWithObstacles(world, enemy, direction.x * speed * dt, 0);
  moveCircleWithObstacles(world, enemy, 0, direction.y * speed * dt);
}

function isInsideArena(
  position: Vec2,
  radius: number,
  config: SimulationConfig,
): boolean {
  return (
    position.x >= radius &&
    position.x <= config.arena.width - radius &&
    position.y >= radius &&
    position.y <= config.arena.height - radius
  );
}

function stationaryNavigation(): EnemyNavigationResult {
  return { direction: { x: 0, y: 0 }, mode: "direct", fieldBuilt: false };
}
