import type {
  Enemy,
  Pickup,
  SimulationConfig,
  Vec2,
  WorldState,
} from "../domain/types";
import {
  distanceBetween,
  getArenaEdgeClearance,
  isPointInsideArena,
} from "./autoPilotMath";
import { hasClearNavigationPath } from "./navigationField";

export type EnemyTarget = {
  enemy: Enemy;
  distance: number;
  visible: boolean;
};

export type PickupTarget = {
  pickup: Pickup;
  distance: number;
};

const XP_SEARCH_DISTANCE = 420;

export function selectAimTarget(
  world: WorldState,
  config: SimulationConfig,
): EnemyTarget | null {
  let best: { target: EnemyTarget; score: number } | null = null;
  const projectileRadius = config.weapons[world.state.weaponType].radius;
  for (const enemy of world.enemies) {
    const distance = distanceBetween(world.player.position, enemy.position);
    const visible = hasClearNavigationPath(
      world.player.position,
      enemy.position,
      projectileRadius,
      world.obstacles,
    );
    const target = { enemy, distance, visible };
    const score = getEnemyTargetScore(world, target, config);
    if (!best || score < best.score) best = { target, score };
  }
  return best?.target ?? null;
}

export function findNearestEnemy(
  position: Vec2,
  enemies: readonly Enemy[],
): EnemyTarget | null {
  let nearest: EnemyTarget | null = null;
  for (const enemy of enemies) {
    const distance = distanceBetween(position, enemy.position);
    if (!nearest || distance < nearest.distance) {
      nearest = { enemy, distance, visible: true };
    }
  }
  return nearest;
}

export function selectPickupTarget(
  world: WorldState,
  config: SimulationConfig,
): PickupTarget | null {
  const maxHp = config.player.maxHp + world.runtime.maxHpBonus;
  const missingHpRatio = maxHp > 0 ? Math.max(0, 1 - world.state.hp / maxHp) : 0;
  let best: { target: PickupTarget; score: number } | null = null;
  for (const pickup of world.pickups) {
    if (pickup.kind === "heal" && missingHpRatio <= 0.001) continue;
    const distance = distanceBetween(world.player.position, pickup.position);
    const maximumDistance = pickup.kind === "heal" ? XP_SEARCH_DISTANCE + 120 : XP_SEARCH_DISTANCE;
    if (distance > maximumDistance) continue;
    const nearbyEnemy = findNearestEnemy(pickup.position, world.enemies);
    const dangerPenalty = nearbyEnemy && nearbyEnemy.distance < 150
      ? (150 - nearbyEnemy.distance) * 3.5
      : 0;
    const directRoute = hasClearNavigationPath(
      world.player.position,
      pickup.position,
      config.player.radius,
      world.obstacles,
    );
    const healPriority = pickup.kind === "heal" ? missingHpRatio * 360 : 0;
    const xpProgress = world.progression.xpToNext > 0
      ? world.progression.xp / world.progression.xpToNext
      : 0;
    const xpPriority = pickup.kind === "xp"
      ? Math.min(55, pickup.xpValue * 7 + xpProgress * 32)
      : 0;
    const score =
      distance +
      dangerPenalty +
      (directRoute ? 0 : 45) -
      healPriority -
      xpPriority;
    if (!best || score < best.score) best = { target: { pickup, distance }, score };
  }
  return best?.target ?? null;
}

export function canSafelyCollectPickup(
  world: WorldState,
  target: PickupTarget,
  nearestEnemy: EnemyTarget | null,
  config: SimulationConfig,
): boolean {
  const nearbyEnemy = findNearestEnemy(target.pickup.position, world.enemies);
  const magnetReach = config.pickup.magnetRadius * 1.6;
  if (target.distance <= magnetReach) return true;
  if (target.pickup.kind === "heal") {
    const maxHp = config.player.maxHp + world.runtime.maxHpBonus;
    const hpRatio = maxHp > 0 ? world.state.hp / maxHp : 1;
    return hpRatio < 0.72 &&
      (nearestEnemy?.distance ?? Number.POSITIVE_INFINITY) > 135 &&
      (nearbyEnemy?.distance ?? Number.POSITIVE_INFINITY) > 105;
  }
  return (
    (nearestEnemy?.distance ?? Number.POSITIVE_INFINITY) > 195 &&
    (nearbyEnemy?.distance ?? Number.POSITIVE_INFINITY) > 135
  );
}

export function findFiringPosition(
  world: WorldState,
  enemy: Enemy,
  config: SimulationConfig,
): Vec2 | null {
  const baseAngle = Math.atan2(
    world.player.position.y - enemy.position.y,
    world.player.position.x - enemy.position.x,
  );
  const angleOffsets = [
    0,
    Math.PI / 8,
    -Math.PI / 8,
    Math.PI / 4,
    -Math.PI / 4,
    (Math.PI * 3) / 8,
    (-Math.PI * 3) / 8,
    Math.PI / 2,
    -Math.PI / 2,
    (Math.PI * 3) / 4,
    (-Math.PI * 3) / 4,
    Math.PI,
  ];
  const projectileRadius = config.weapons[world.state.weaponType].radius;
  let best: { position: Vec2; score: number } | null = null;
  for (const radius of [230, 180, 285]) {
    for (const offset of angleOffsets) {
      const angle = baseAngle + offset;
      const position = {
        x: enemy.position.x + Math.cos(angle) * radius,
        y: enemy.position.y + Math.sin(angle) * radius,
      };
      if (!isPointInsideArena(position, config.player.radius + 4, config)) continue;
      if (
        !hasClearNavigationPath(
          position,
          position,
          config.player.radius + config.navigation.obstacleClearance,
          world.obstacles,
        )
      ) continue;
      if (
        !hasClearNavigationPath(
          position,
          enemy.position,
          projectileRadius,
          world.obstacles,
        )
      ) continue;

      const nearestEnemy = findNearestEnemy(
        position,
        world.enemies.filter((item) => item !== enemy),
      );
      const enemyPenalty = nearestEnemy && nearestEnemy.distance < 150
        ? (150 - nearestEnemy.distance) * 2.5
        : 0;
      const directRoute = hasClearNavigationPath(
        world.player.position,
        position,
        config.player.radius,
        world.obstacles,
      );
      const score =
        distanceBetween(world.player.position, position) +
        enemyPenalty +
        (directRoute ? 0 : 70) -
        Math.min(100, getArenaEdgeClearance(position, config)) * 0.15;
      if (!best || score < best.score) best = { position, score };
    }
  }
  return best?.position ?? null;
}

function getEnemyTargetScore(
  world: WorldState,
  target: EnemyTarget,
  config: SimulationConfig,
): number {
  const enemy = target.enemy;
  const insideArena = isEnemyInsideArena(enemy, config);
  const typePriority: Record<Enemy["typeId"], number> = {
    ranged: -135,
    fast: -90,
    chaser: -45,
    brute: -20,
  };
  const contactDistance = Math.max(
    0,
    target.distance - config.player.radius - enemy.radius,
  );
  const secondsToContact = enemy.behavior === "ranged"
    ? Number.POSITIVE_INFINITY
    : contactDistance / Math.max(1, enemy.speed);
  const contactPriority = Number.isFinite(secondsToContact)
    ? -Math.max(0, 3.2 - secondsToContact) * 75
    : 0;
  const focusActive =
    world.state.weaponType === "pulse" &&
    (enemy.pulseFocusExpiresAt ?? 0) >= world.state.elapsed;
  const focusPriority = focusActive ? -(enemy.pulseFocusStacks ?? 0) * 145 : 0;
  const lowHpPriority = Math.min(12, enemy.hp) * 7;

  return (
    (insideArena ? 0 : 100_000) +
    (target.visible ? 0 : 10_000) +
    (enemy.enteredArena ? 0 : 400) +
    target.distance +
    typePriority[enemy.typeId] +
    contactPriority +
    focusPriority +
    lowHpPriority
  );
}

function isEnemyInsideArena(enemy: Enemy, config: SimulationConfig): boolean {
  return (
    enemy.position.x >= 0 &&
    enemy.position.x <= config.arena.width &&
    enemy.position.y >= 0 &&
    enemy.position.y <= config.arena.height
  );
}
