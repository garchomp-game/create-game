import type { Enemy, EnemyProjectile, Vec2 } from "../domain/types";
import { normalize } from "../math/vector";
import type {
  AutoPilotFrame,
  AutoPilotNavigationPort,
} from "./autoPilotContracts";
import {
  clamp,
  distanceBetween,
  dot,
  lengthSquared,
} from "./autoPilotMath";

export type ProjectileThreat = {
  approaching: boolean;
  overlapping: boolean;
  collisionTime: number | null;
  closestTime: number;
  currentClearance: number;
  minimumClearance: number;
  risk: number;
};

export type ProjectileThreatSummary = {
  collisions: number;
  dangerousProjectiles: number;
  earliestCollision: number;
  minimumClearance: number;
  predictedDamage: number;
  risk: number;
};

export type EnemyThreatSummary = {
  collisions: number;
  immediateEnemies: number;
  nearbyEnemies: number;
  earliestCollision: number;
  minimumClearance: number;
  predictedDamage: number;
  risk: number;
};

export type AutoPilotThreatAssessment = {
  collisionCount: number;
  minimumTtc: number;
  predictedDamage: number;
  riskScore: number;
  projectiles: ProjectileThreatSummary;
  enemies: EnemyThreatSummary;
};

export type AutoPilotHazards = {
  projectiles: readonly EnemyProjectile[];
  enemies: readonly Enemy[];
};

export const AUTO_PILOT_PROJECTILE_HORIZON_SECONDS = 1.15;
export const AUTO_PILOT_ENEMY_HORIZON_SECONDS = 0.82;

export function assessProjectileThreat(
  frame: AutoPilotFrame,
  projectile: EnemyProjectile,
  playerVelocity: Vec2,
  horizonSeconds = AUTO_PILOT_PROJECTILE_HORIZON_SECONDS,
): ProjectileThreat {
  const relativePosition = {
    x: projectile.position.x - frame.world.player.position.x,
    y: projectile.position.y - frame.world.player.position.y,
  };
  const relativeVelocity = {
    x: projectile.velocity.x - playerVelocity.x,
    y: projectile.velocity.y - playerVelocity.y,
  };
  const combinedRadius = frame.config.player.radius + projectile.radius;
  const currentClearance = Math.sqrt(lengthSquared(relativePosition)) - combinedRadius;
  const overlapping = currentClearance <= 0;
  const approaching = dot(relativePosition, relativeVelocity) < -0.000001;
  const horizon = Math.max(
    0,
    Math.min(horizonSeconds, projectile.lifetime),
  );

  if (!approaching && !overlapping) {
    return {
      approaching: false,
      overlapping: false,
      collisionTime: null,
      closestTime: 0,
      currentClearance,
      minimumClearance: Number.POSITIVE_INFINITY,
      risk: 0,
    };
  }

  const relativeSpeedSquared = lengthSquared(relativeVelocity);
  const closestTime = relativeSpeedSquared > 0.001
    ? clamp(
        -dot(relativePosition, relativeVelocity) / relativeSpeedSquared,
        0,
        horizon,
      )
    : 0;
  const separation = {
    x: relativePosition.x + relativeVelocity.x * closestTime,
    y: relativePosition.y + relativeVelocity.y * closestTime,
  };
  const minimumClearance = Math.sqrt(lengthSquared(separation)) - combinedRadius;
  const collisionTime = overlapping
    ? 0
    : getTimeToCircleCollision(
        relativePosition,
        relativeVelocity,
        combinedRadius + 7,
        horizon,
      );
  const danger = Math.max(0, 105 - minimumClearance) / 105;
  const timeWeight =
    1.3 - Math.min(1, closestTime / AUTO_PILOT_PROJECTILE_HORIZON_SECONDS) * 0.55;
  const damageWeight = 1 + projectile.damage / 24;

  return {
    approaching,
    overlapping,
    collisionTime,
    closestTime,
    currentClearance,
    minimumClearance,
    risk: danger * danger * timeWeight * damageWeight,
  };
}

export function assessProjectileThreats(
  frame: AutoPilotFrame,
  projectiles: readonly EnemyProjectile[],
  playerVelocity: Vec2,
  horizonSeconds = AUTO_PILOT_PROJECTILE_HORIZON_SECONDS,
): ProjectileThreatSummary {
  let collisions = 0;
  let dangerousProjectiles = 0;
  let earliestCollision = Number.POSITIVE_INFINITY;
  let minimumClearance = Number.POSITIVE_INFINITY;
  let predictedDamage = 0;
  let risk = 0;

  for (const projectile of projectiles) {
    const threat = assessProjectileThreat(
      frame,
      projectile,
      playerVelocity,
      horizonSeconds,
    );
    if (threat.collisionTime !== null) {
      collisions += 1;
      earliestCollision = Math.min(earliestCollision, threat.collisionTime);
      predictedDamage += projectile.damage;
    }
    if (threat.minimumClearance < 85) dangerousProjectiles += 1;
    minimumClearance = Math.min(minimumClearance, threat.minimumClearance);
    risk += threat.risk;
  }

  return {
    collisions,
    dangerousProjectiles,
    earliestCollision,
    minimumClearance,
    predictedDamage,
    risk,
  };
}

export function assessAutoPilotThreat(
  frame: AutoPilotFrame,
  navigation: AutoPilotNavigationPort,
  playerVelocity: Vec2,
  hazards: AutoPilotHazards = {
    projectiles: frame.world.enemyProjectiles,
    enemies: frame.world.enemies,
  },
): AutoPilotThreatAssessment {
  const projectiles = assessProjectileThreats(
    frame,
    hazards.projectiles,
    playerVelocity,
  );
  const enemies = assessEnemyThreats(
    frame,
    navigation,
    hazards.enemies,
    playerVelocity,
  );
  const collisionCount = projectiles.collisions + enemies.collisions;
  const minimumTtc = Math.min(
    projectiles.earliestCollision,
    enemies.earliestCollision,
  );
  const predictedDamage = projectiles.predictedDamage + enemies.predictedDamage;
  const maximumHp = frame.config.player.maxHp + frame.world.runtime.maxHpBonus;
  const criticalHp = maximumHp * 0.46;
  const damageBudget = Math.max(1, frame.world.state.hp - criticalHp);
  const damageRisk = predictedDamage / damageBudget;
  const ttcRisk = Number.isFinite(minimumTtc)
    ? Math.exp(-minimumTtc / 0.35)
    : 0;
  const proximityRisk = 1 - Math.exp(-(projectiles.risk * 0.55 + enemies.risk * 0.42));
  const riskScore = clamp(
    damageRisk + ttcRisk * 0.35 + proximityRisk * 0.28,
    0,
    1,
  );

  return {
    collisionCount,
    minimumTtc,
    predictedDamage,
    riskScore,
    projectiles,
    enemies,
  };
}

export function assessEnemyThreats(
  frame: AutoPilotFrame,
  navigation: AutoPilotNavigationPort,
  enemies: readonly Enemy[],
  playerVelocity: Vec2,
): EnemyThreatSummary {
  let collisions = 0;
  let immediateEnemies = 0;
  let nearbyEnemies = 0;
  let earliestCollision = Number.POSITIVE_INFINITY;
  let minimumClearance = Number.POSITIVE_INFINITY;
  let predictedDamage = 0;
  let risk = 0;

  for (const enemy of enemies) {
    if (!enemy.enteredArena) continue;
    const initialDistance = distanceBetween(
      frame.world.player.position,
      enemy.position,
    );
    if (initialDistance < 280 && enemy.behavior !== "ranged") nearbyEnemies += 1;
    const maximumContactReach =
      enemy.speed * AUTO_PILOT_ENEMY_HORIZON_SECONDS +
      Math.hypot(playerVelocity.x, playerVelocity.y) *
        AUTO_PILOT_ENEMY_HORIZON_SECONDS +
      frame.config.player.radius +
      enemy.radius +
      210;
    if (initialDistance > maximumContactReach) continue;
    const assessment = assessEnemyThreat(
      frame,
      navigation,
      enemy,
      playerVelocity,
    );
    minimumClearance = Math.min(minimumClearance, assessment.minimumClearance);
    risk += assessment.risk;
    if (assessment.collisionTime !== null) {
      collisions += 1;
      predictedDamage += enemy.damage;
      earliestCollision = Math.min(earliestCollision, assessment.collisionTime);
    }
    if (
      enemy.behavior !== "ranged" &&
      (assessment.collisionTime !== null && assessment.collisionTime < 1.15 ||
        assessment.minimumClearance < 58)
    ) {
      immediateEnemies += 1;
    }
  }

  return {
    collisions,
    immediateEnemies,
    nearbyEnemies,
    earliestCollision,
    minimumClearance,
    predictedDamage,
    risk,
  };
}

export function estimateEnemyVelocity(
  frame: AutoPilotFrame,
  enemy: Enemy,
  targetPosition: Vec2,
  navigation: AutoPilotNavigationPort,
  enemyPosition: Vec2 = enemy.position,
): Vec2 {
  const directionToPlayer = normalize(
    targetPosition.x - enemyPosition.x,
    targetPosition.y - enemyPosition.y,
  );
  if (enemy.behavior !== "ranged") {
    const direction = getApproachDirection(
      frame,
      navigation,
      enemyPosition,
      targetPosition,
      enemy.radius,
    );
    return { x: direction.x * enemy.speed, y: direction.y * enemy.speed };
  }

  const ranged = frame.config.enemies[enemy.typeId].ranged;
  if (!ranged) {
    return { x: directionToPlayer.x * enemy.speed, y: directionToPlayer.y * enemy.speed };
  }
  const distance = distanceBetween(enemyPosition, targetPosition);
  const visible = navigation.hasClearPath(
    frame,
    enemyPosition,
    targetPosition,
    ranged.projectileRadius,
  );
  if (distance > ranged.preferredRange || !visible) {
    const direction = getApproachDirection(
      frame,
      navigation,
      enemyPosition,
      targetPosition,
      enemy.radius,
    );
    return { x: direction.x * enemy.speed, y: direction.y * enemy.speed };
  }
  if (distance < ranged.preferredRange * 0.65) {
    return {
      x: -directionToPlayer.x * enemy.speed,
      y: -directionToPlayer.y * enemy.speed,
    };
  }
  return { x: 0, y: 0 };
}

function getApproachDirection(
  frame: AutoPilotFrame,
  navigation: AutoPilotNavigationPort,
  enemyPosition: Vec2,
  targetPosition: Vec2,
  radius: number,
): Vec2 {
  if (
    navigation.hasClearPath(
      frame,
      enemyPosition,
      targetPosition,
      radius,
    )
  ) {
    return normalize(
      targetPosition.x - enemyPosition.x,
      targetPosition.y - enemyPosition.y,
    );
  }

  // Use the current player cell as the shared Dijkstra target. Candidate-specific
  // future targets would rebuild a navigation field for every sampled velocity.
  return navigation.navigateFrom(
    frame,
    enemyPosition,
    frame.world.player.position,
    radius,
  );
}

function assessEnemyThreat(
  frame: AutoPilotFrame,
  navigation: AutoPilotNavigationPort,
  enemy: Enemy,
  playerVelocity: Vec2,
): { collisionTime: number | null; minimumClearance: number; risk: number } {
  const combinedRadius = frame.config.player.radius + enemy.radius + 8;
  const segmentEnds = [0.2, 0.42, 0.62, AUTO_PILOT_ENEMY_HORIZON_SECONDS];
  let segmentStart = 0;
  let enemyPosition = { ...enemy.position };
  let collisionTime: number | null = null;
  let minimumClearance = Number.POSITIVE_INFINITY;
  let closestTime = AUTO_PILOT_ENEMY_HORIZON_SECONDS;

  for (const segmentEnd of segmentEnds) {
    const segmentDuration = segmentEnd - segmentStart;
    const playerPosition = positionAt(
      frame.world.player.position,
      playerVelocity,
      segmentStart,
    );
    const targetPosition = positionAt(
      frame.world.player.position,
      playerVelocity,
      segmentEnd,
    );
    const enemyVelocity = estimateEnemyVelocity(
      frame,
      enemy,
      targetPosition,
      navigation,
      enemyPosition,
    );
    const relativePosition = {
      x: enemyPosition.x - playerPosition.x,
      y: enemyPosition.y - playerPosition.y,
    };
    const relativeVelocity = {
      x: enemyVelocity.x - playerVelocity.x,
      y: enemyVelocity.y - playerVelocity.y,
    };
    const relativeSpeedSquared = lengthSquared(relativeVelocity);
    const localClosestTime = relativeSpeedSquared > 0.001
      ? clamp(
          -dot(relativePosition, relativeVelocity) / relativeSpeedSquared,
          0,
          segmentDuration,
        )
      : 0;
    const closestOffset = {
      x: relativePosition.x + relativeVelocity.x * localClosestTime,
      y: relativePosition.y + relativeVelocity.y * localClosestTime,
    };
    const clearance = Math.sqrt(lengthSquared(closestOffset)) - combinedRadius;
    if (clearance < minimumClearance) {
      minimumClearance = clearance;
      closestTime = segmentStart + localClosestTime;
    }
    const localCollision = getTimeToCircleCollision(
      relativePosition,
      relativeVelocity,
      combinedRadius,
      segmentDuration,
    );
    if (localCollision !== null) {
      collisionTime = segmentStart + localCollision;
      break;
    }
    enemyPosition = positionAt(enemyPosition, enemyVelocity, segmentDuration);
    segmentStart = segmentEnd;
  }

  const routeClear = navigation.hasClearPath(
    frame,
    enemy.position,
    frame.world.player.position,
    enemy.radius,
  );
  const dangerDistance = Math.min(
    190,
    92 + enemy.speed * 0.24 + (enemy.typeId === "fast" ? 22 : 0),
  );
  const danger = Math.max(0, dangerDistance - minimumClearance) / dangerDistance;
  const behaviorWeight = enemy.behavior === "ranged" ? 0.45 : 1;
  const routeWeight = routeClear ? 1 : 0.58;
  const damageWeight = 1 + enemy.damage / 28;
  const timeWeight = 1.2 - Math.min(1, closestTime / AUTO_PILOT_ENEMY_HORIZON_SECONDS) * 0.35;
  return {
    collisionTime,
    minimumClearance,
    risk: danger * danger * behaviorWeight * routeWeight * damageWeight * timeWeight,
  };
}

export function getTimeToCircleCollision(
  relativePosition: Vec2,
  relativeVelocity: Vec2,
  combinedRadius: number,
  horizon: number,
): number | null {
  const a = lengthSquared(relativeVelocity);
  const b = 2 * dot(relativePosition, relativeVelocity);
  const c = lengthSquared(relativePosition) - combinedRadius * combinedRadius;
  if (c <= 0) return 0;
  if (a < 0.000001 || b >= 0) return null;
  const discriminant = b * b - 4 * a * c;
  if (discriminant < 0) return null;
  const collisionTime = (-b - Math.sqrt(discriminant)) / (2 * a);
  return collisionTime >= 0 && collisionTime <= horizon ? collisionTime : null;
}

function positionAt(position: Vec2, velocity: Vec2, time: number): Vec2 {
  return {
    x: position.x + velocity.x * time,
    y: position.y + velocity.y * time,
  };
}
