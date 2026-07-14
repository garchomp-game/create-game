import type {
  Enemy,
  EnemyProjectile,
  SimulationConfig,
  Vec2,
  WorldState,
} from "../domain/types";
import { normalize } from "../math/vector";
import {
  clamp,
  clampPointToArena,
  distanceBetween,
  dot,
  getArenaEdgeClearance,
  hashParity,
  isPointInsideArena,
  lengthSquared,
} from "./autoPilotMath";
import { findNearestEnemy, type EnemyTarget } from "./autoPilotTargeting";
import { getPointNavigation, hasClearNavigationPath } from "./navigationField";

export type ProjectileThreat = {
  projectile: EnemyProjectile;
  closestPoint: Vec2;
  closestDistance: number;
  timeToClosest: number;
  score: number;
};

export const ENEMY_EVADE_DISTANCE = 170;

const PROJECTILE_LOOKAHEAD_SECONDS = 1.05;
const PROJECTILE_DODGE_SECONDS = 0.48;

export function getProjectileThreats(
  world: WorldState,
  config: SimulationConfig,
): ProjectileThreat[] {
  const threats: ProjectileThreat[] = [];
  for (const projectile of world.enemyProjectiles) {
    const relative = {
      x: projectile.position.x - world.player.position.x,
      y: projectile.position.y - world.player.position.y,
    };
    const speedSquared = lengthSquared(projectile.velocity);
    const approaching = dot(relative, projectile.velocity) < 0;
    const timeToClosest = speedSquared > 0.001
      ? clamp(-dot(relative, projectile.velocity) / speedSquared, 0, PROJECTILE_LOOKAHEAD_SECONDS)
      : 0;
    const closestPoint = {
      x: projectile.position.x + projectile.velocity.x * timeToClosest,
      y: projectile.position.y + projectile.velocity.y * timeToClosest,
    };
    const currentDistance = Math.sqrt(lengthSquared(relative));
    const closestDistance = distanceBetween(world.player.position, closestPoint);
    const collisionDistance = config.player.radius + projectile.radius;
    const dangerDistance = collisionDistance + 52;
    const immediatelyClose = currentDistance < collisionDistance + 18;
    if ((!approaching || closestDistance >= dangerDistance) && !immediatelyClose) continue;
    if (
      !hasClearNavigationPath(
        projectile.position,
        closestPoint,
        projectile.radius,
        world.obstacles,
      )
    ) continue;

    threats.push({
      projectile,
      closestPoint,
      closestDistance,
      timeToClosest,
      score:
        dangerDistance - closestDistance +
        (PROJECTILE_LOOKAHEAD_SECONDS - timeToClosest) * 36,
    });
  }
  return threats.sort((a, b) => b.score - a.score).slice(0, 8);
}

export function selectProjectileDodgeMove(
  world: WorldState,
  threats: readonly ProjectileThreat[],
  config: SimulationConfig,
): Vec2 {
  const preferred = getProjectileAvoidanceDirection(world, threats);
  const candidates = [
    preferred,
    ...Array.from({ length: 16 }, (_, index) => {
      const angle = (Math.PI * 2 * index) / 16;
      return { x: Math.cos(angle), y: Math.sin(angle) };
    }),
  ];
  const speed = config.player.speed * world.runtime.playerSpeedMultiplier;
  let bestDirection = preferred;
  let bestScore = Number.NEGATIVE_INFINITY;

  for (const rawDirection of candidates) {
    const direction = normalize(rawDirection.x, rawDirection.y);
    if (lengthSquared(direction) < 0.001) continue;
    const endpoint = {
      x: world.player.position.x + direction.x * speed * PROJECTILE_DODGE_SECONDS,
      y: world.player.position.y + direction.y * speed * PROJECTILE_DODGE_SECONDS,
    };
    if (!isPointInsideArena(endpoint, config.player.radius + 2, config)) continue;
    if (
      !hasClearNavigationPath(
        world.player.position,
        endpoint,
        config.player.radius + config.navigation.obstacleClearance,
        world.obstacles,
      )
    ) continue;

    let minimumProjectileClearance = Number.POSITIVE_INFINITY;
    const playerVelocity = { x: direction.x * speed, y: direction.y * speed };
    for (const threat of threats) {
      const relativePosition = {
        x: threat.projectile.position.x - world.player.position.x,
        y: threat.projectile.position.y - world.player.position.y,
      };
      const relativeVelocity = {
        x: threat.projectile.velocity.x - playerVelocity.x,
        y: threat.projectile.velocity.y - playerVelocity.y,
      };
      const relativeSpeedSquared = lengthSquared(relativeVelocity);
      const closestTime = relativeSpeedSquared > 0.001
        ? clamp(
          -dot(relativePosition, relativeVelocity) / relativeSpeedSquared,
          0,
          PROJECTILE_LOOKAHEAD_SECONDS,
        )
        : 0;
      const separation = {
        x: relativePosition.x + relativeVelocity.x * closestTime,
        y: relativePosition.y + relativeVelocity.y * closestTime,
      };
      const clearance =
        Math.sqrt(lengthSquared(separation)) - config.player.radius - threat.projectile.radius;
      minimumProjectileClearance = Math.min(minimumProjectileClearance, clearance);
    }

    const nearestEnemy = findNearestEnemy(endpoint, world.enemies);
    const enemyClearance = nearestEnemy?.distance ?? 260;
    const edgeClearance = getArenaEdgeClearance(endpoint, config);
    const score =
      minimumProjectileClearance * 12 +
      Math.min(enemyClearance, 260) * 0.35 +
      Math.min(edgeClearance, 140) * 0.22 +
      dot(direction, preferred) * 18;
    if (score > bestScore) {
      bestScore = score;
      bestDirection = direction;
    }
  }

  return bestDirection;
}

export function getEnemyAvoidanceDirection(
  world: WorldState,
  radius: number,
  config: SimulationConfig,
): Vec2 {
  let x = 0;
  let y = 0;
  for (const enemy of world.enemies) {
    const dx = world.player.position.x - enemy.position.x;
    const dy = world.player.position.y - enemy.position.y;
    const distance = Math.hypot(dx, dy);
    if (distance >= radius) continue;
    const away = normalize(dx, dy);
    const weight = Math.max(0.1, (radius - distance) / radius);
    x += away.x * weight;
    y += away.y * weight;
  }
  const result = normalize(x, y);
  return lengthSquared(result) >= 0.001 ? result : getIdleOrbitMove(world, config);
}

export function getEngagementMove(
  world: WorldState,
  target: EnemyTarget,
  config: SimulationConfig,
): Vec2 {
  const toward = normalize(
    target.enemy.position.x - world.player.position.x,
    target.enemy.position.y - world.player.position.y,
  );
  const clockwise = hashParity(target.enemy.id) === 0;
  const tangent = clockwise
    ? { x: -toward.y, y: toward.x }
    : { x: toward.y, y: -toward.x };
  const preferredRange = world.state.weaponType === "pulse" ? 285 : 225;
  const speed = config.player.speed * world.runtime.playerSpeedMultiplier;
  const horizon = 0.42;
  const candidates = [
    { x: 0, y: 0 },
    ...Array.from({ length: 16 }, (_, index) => {
      const angle = (Math.PI * 2 * index) / 16;
      return { x: Math.cos(angle), y: Math.sin(angle) };
    }),
  ];
  let bestDirection: Vec2 = tangent;
  let bestScore = Number.NEGATIVE_INFINITY;

  for (const direction of candidates) {
    const endpoint = {
      x: world.player.position.x + direction.x * speed * horizon,
      y: world.player.position.y + direction.y * speed * horizon,
    };
    if (!isPointInsideArena(endpoint, config.player.radius + 3, config)) continue;
    if (
      !hasClearNavigationPath(
        world.player.position,
        endpoint,
        config.player.radius + config.navigation.obstacleClearance,
        world.obstacles,
      )
    ) continue;

    const targetDistance = distanceBetween(endpoint, target.enemy.position);
    const targetVisible = hasClearNavigationPath(
      endpoint,
      target.enemy.position,
      config.weapons[world.state.weaponType].radius,
      world.obstacles,
    );
    const enemyRisk = getEnemyPositionRisk(endpoint, world.enemies, horizon);
    const edgeClearance = getArenaEdgeClearance(endpoint, config);
    const rangeError = Math.abs(targetDistance - preferredRange);
    const focusStacks = target.enemy.pulseFocusStacks ?? 0;
    const score =
      (targetVisible ? 145 + focusStacks * 22 : -210) -
      rangeError * 1.25 -
      enemyRisk +
      Math.min(edgeClearance, 150) * 0.3 +
      dot(direction, tangent) * 24;
    if (score > bestScore) {
      bestScore = score;
      bestDirection = direction;
    }
  }

  if (lengthSquared(bestDirection) < 0.001) return { x: 0, y: 0 };
  return normalize(bestDirection.x, bestDirection.y);
}

export function navigateTo(
  world: WorldState,
  target: Vec2,
  config: SimulationConfig,
): Vec2 {
  return getPointNavigation(
    world,
    world.player.position,
    target,
    config.player.radius,
    config,
  ).direction;
}

export function navigateInDirection(
  world: WorldState,
  direction: Vec2,
  config: SimulationConfig,
  distance: number,
): Vec2 {
  const normalized = normalize(direction.x, direction.y);
  if (lengthSquared(normalized) < 0.001) return { x: 0, y: 0 };
  const target = clampPointToArena(
    {
      x: world.player.position.x + normalized.x * distance,
      y: world.player.position.y + normalized.y * distance,
    },
    config.player.radius + 3,
    config,
  );
  return navigateTo(world, target, config);
}

export function getIdleOrbitMove(world: WorldState, config: SimulationConfig): Vec2 {
  const centerOffset = normalize(
    config.arena.width / 2 - world.player.position.x,
    config.arena.height / 2 - world.player.position.y,
  );
  const orbit = normalize(
    Math.cos(world.state.elapsed * 0.85),
    Math.sin(world.state.elapsed * 0.65),
  );
  return normalize(centerOffset.x * 0.35 + orbit.x, centerOffset.y * 0.35 + orbit.y);
}

function getProjectileAvoidanceDirection(
  world: WorldState,
  threats: readonly ProjectileThreat[],
): Vec2 {
  let x = 0;
  let y = 0;
  for (const threat of threats) {
    let away = normalize(
      world.player.position.x - threat.closestPoint.x,
      world.player.position.y - threat.closestPoint.y,
    );
    if (lengthSquared(away) < 0.001) {
      away = normalize(-threat.projectile.velocity.y, threat.projectile.velocity.x);
    }
    const weight = Math.max(1, threat.score);
    x += away.x * weight;
    y += away.y * weight;
  }
  const result = normalize(x, y);
  if (lengthSquared(result) >= 0.001) return result;
  const primary = threats[0]!.projectile.velocity;
  return normalize(-primary.y, primary.x);
}

function getEnemyPositionRisk(
  position: Vec2,
  enemies: readonly Enemy[],
  horizon: number,
): number {
  let risk = 0;
  for (const enemy of enemies) {
    const towardPosition = normalize(
      position.x - enemy.position.x,
      position.y - enemy.position.y,
    );
    const projectedEnemy = enemy.behavior === "ranged"
      ? enemy.position
      : {
        x: enemy.position.x + towardPosition.x * enemy.speed * horizon,
        y: enemy.position.y + towardPosition.y * enemy.speed * horizon,
      };
    const clearance = distanceBetween(position, projectedEnemy) - enemy.radius;
    if (clearance < 70) {
      risk += (70 - clearance) * 8;
    } else if (clearance < 155) {
      risk += (155 - clearance) * 1.8;
    }
    if (enemy.typeId === "ranged" && clearance < 320) risk += (320 - clearance) * 0.12;
  }
  return risk;
}
