import type { Enemy, EnemyProjectile, Vec2 } from "../domain/types";
import { normalize } from "../math/vector";
import type {
  AutoPilotFrame,
  AutoPilotIntent,
  AutoPilotMotionDisposition,
  AutoPilotMotionPlanner,
  AutoPilotMovementPlan,
  AutoPilotNavigationPort,
  AutoPilotOverrideReason,
} from "./autoPilotContracts";
import {
  clamp,
  distanceBetween,
  dot,
  getObstacleClearance,
  getSafeArenaEdgeClearance,
  lengthSquared,
} from "./autoPilotMath";
import {
  assessAutoPilotThreat,
  AUTO_PILOT_ENEMY_HORIZON_SECONDS,
  AUTO_PILOT_PROJECTILE_HORIZON_SECONDS,
} from "./autoPilotThreat";
import {
  getAutoPilotFiringLaneReward,
  getAutoPilotOpenSpaceWeight,
  getAutoPilotWeaponStrategy,
} from "./autoPilotWeaponStrategy";

type HazardSet = {
  projectiles: EnemyProjectile[];
  enemies: Enemy[];
};

type CandidateAssessment = {
  direction: Vec2;
  move: Vec2;
  speedScale: number;
  blocked: boolean;
  collisionCount: number;
  projectileCollisionCount: number;
  dangerousProjectileCount: number;
  enemyCollisionCount: number;
  earliestCollision: number;
  dangerTier: number;
  minimumProjectileClearance: number;
  minimumEnemyClearance: number;
  openSpaceClearance: number;
  hazardCost: number;
  riskScore: number;
  minimumTtc: number;
  predictedDamage: number;
  score: number;
};

const MOTION_HORIZON_SECONDS = 0.58;
const BASE_DIRECTION_COUNT = 16;
const ESCAPE_DIRECTION_COUNT = 6;
const MAX_RELEVANT_PROJECTILES = 40;
const MAX_RELEVANT_ENEMIES = 20;

export const DEFAULT_AUTO_PILOT_MOTION: AutoPilotMotionPlanner = {
  planMovement(frame, intent, navigation) {
    return planAutoPilotMovement(frame, intent, navigation);
  },
};

export function planAutoPilotMovement(
  frame: AutoPilotFrame,
  intent: AutoPilotIntent,
  navigation: AutoPilotNavigationPort,
): AutoPilotMovementPlan {
  const hazards = selectRelevantHazards(frame);
  const assessments = createBaseCandidates(frame, intent).map((direction) =>
    assessCandidate(frame, intent, navigation, hazards, direction)
  );
  const stationary = assessments[0]!;
  const preliminarySafe = getSafetyEnvelope(assessments)
    .sort(compareCandidateAssessments);
  const preliminaryHasMoving = preliminarySafe.some(
    (assessment) => lengthSquared(assessment.move) > 0.001,
  );
  const playerSpeed =
    frame.config.player.speed * frame.world.runtime.playerSpeedMultiplier;
  const waypointDistance = intent.nextWaypoint
    ? distanceBetween(frame.world.player.position, intent.nextWaypoint)
    : Number.POSITIVE_INFINITY;
  const partialDirections: Vec2[] = [];
  for (const rawDirection of [intent.desiredDirection, frame.previousMove]) {
    const direction = normalize(rawDirection.x, rawDirection.y);
    if (lengthSquared(direction) < 0.001) continue;
    if (partialDirections.some((candidate) => dot(candidate, direction) > 0.999)) {
      continue;
    }
    const fullAssessment = assessments.find((assessment) =>
      assessment.speedScale >= 0.999 &&
      dot(assessment.direction, direction) > 0.999
    );
    const nearWaypoint = dot(direction, normalize(
      (intent.nextWaypoint?.x ?? frame.world.player.position.x) -
        frame.world.player.position.x,
      (intent.nextWaypoint?.y ?? frame.world.player.position.y) -
        frame.world.player.position.y,
    )) > 0.5 &&
      waypointDistance < playerSpeed * MOTION_HORIZON_SECONDS;
    if (!fullAssessment?.blocked && preliminaryHasMoving && !nearWaypoint) continue;
    partialDirections.push(direction);
  }
  for (const direction of partialDirections) {
    const halfSpeed = assessCandidate(
      frame,
      intent,
      navigation,
      hazards,
      { x: direction.x * 0.5, y: direction.y * 0.5 },
    );
    assessments.push(halfSpeed);
    const secondaryScale = halfSpeed.blocked ? 0.25 : 0.75;
    assessments.push(assessCandidate(
      frame,
      intent,
      navigation,
      hazards,
      {
        x: direction.x * secondaryScale,
        y: direction.y * secondaryScale,
      },
    ));
  }

  const refinementSeeds = getSafetyEnvelope(assessments)
    .sort(compareCandidateAssessments)
    .filter((assessment) => lengthSquared(assessment.move) > 0.001)
    .slice(0, 1);
  for (const seed of refinementSeeds) {
    const angle = Math.atan2(seed.direction.y, seed.direction.x);
    for (const offset of [-Math.PI / 64, Math.PI / 64]) {
      const direction = { x: Math.cos(angle + offset), y: Math.sin(angle + offset) };
      assessments.push(assessCandidate(frame, intent, navigation, hazards, {
        x: direction.x * seed.speedScale,
        y: direction.y * seed.speedScale,
      }));
    }
  }
  const rankedSafeAssessments = getSafetyEnvelope(assessments)
    .sort(compareCandidateAssessments);
  const best = preferPickupProgress(
    frame,
    intent,
    rankedSafeAssessments[0] ?? stationary,
    rankedSafeAssessments,
  );
  const desiredDirection = normalize(
    intent.desiredDirection.x,
    intent.desiredDirection.y,
  );
  const desiredAssessment = assessments.find((assessment) =>
    assessment.speedScale >= 0.999 &&
    dot(assessment.direction, desiredDirection) > 0.999
  ) ?? null;
  const movingSafeCandidateCount = rankedSafeAssessments.filter(
    (assessment) => lengthSquared(assessment.move) > 0.001,
  ).length;
  const minimumCandidateRisk = rankedSafeAssessments.length > 0
    ? Math.min(...rankedSafeAssessments.map((assessment) => assessment.riskScore))
    : 1;
  const movementOverride = getFinalMovementOverride(
    stationary,
    desiredAssessment,
    best,
  );
  const overrideReason = movementOverride?.reason ?? null;
  const motionDisposition = getMotionDisposition(
    frame,
    intent,
    desiredAssessment,
    best,
    rankedSafeAssessments.length,
    movingSafeCandidateCount,
    overrideReason,
  );
  const selectedMove = best.blocked ? { x: 0, y: 0 } : best.move;

  return {
    move: selectedMove,
    modeOverride: overrideReason?.startsWith("projectile")
      ? "projectileDodge"
      : overrideReason?.startsWith("enemy")
        ? "enemyEvade"
        : null,
    overrideReason,
    riskScore: Math.max(
      best.riskScore,
      movementOverride?.source.riskScore ?? 0,
    ),
    minimumTtc: minimumFiniteTtc(
      best.minimumTtc,
      movementOverride?.source.minimumTtc,
    ),
    predictedDamage: Math.max(
      best.predictedDamage,
      movementOverride?.source.predictedDamage ?? 0,
    ),
    motionDisposition,
    selectedVelocity: {
      x: selectedMove.x * playerSpeed,
      y: selectedMove.y * playerSpeed,
    },
    desiredVelocity: {
      x: desiredDirection.x * playerSpeed,
      y: desiredDirection.y * playerSpeed,
    },
    safeCandidateCount: rankedSafeAssessments.length,
    movingSafeCandidateCount,
    selectedRisk: best.riskScore,
    minimumCandidateRisk,
    minimumProjectileClearance: finiteClearance(best.minimumProjectileClearance),
    minimumEnemyClearance: finiteClearance(best.minimumEnemyClearance),
    openSpaceClearance: finiteClearance(best.openSpaceClearance),
  };
}

type MovementOverride = {
  reason: AutoPilotOverrideReason;
  source: CandidateAssessment;
};

function getFinalMovementOverride(
  stationary: CandidateAssessment,
  desired: CandidateAssessment | null,
  selected: CandidateAssessment,
): MovementOverride | null {
  const stationaryProjectile = getProjectileOverride(stationary, selected);
  if (stationaryProjectile) return stationaryProjectile;
  const stationaryEnemy = getEnemyOverride(stationary, selected);
  if (stationaryEnemy) return stationaryEnemy;
  if (desired && !desired.blocked) {
    const desiredProjectile = getProjectileOverride(desired, selected);
    if (desiredProjectile) return desiredProjectile;
    const desiredEnemy = getEnemyOverride(desired, selected);
    if (desiredEnemy) return desiredEnemy;
  }
  return null;
}

function getProjectileOverride(
  source: CandidateAssessment,
  selected: CandidateAssessment,
): MovementOverride | null {
  const collisionAvoided =
    source.projectileCollisionCount > selected.projectileCollisionCount;
  const threatAvoided = source.dangerousProjectileCount > 0 &&
    source.minimumProjectileClearance < 70 &&
    selected.minimumProjectileClearance > source.minimumProjectileClearance + 4;
  if (!collisionAvoided && !threatAvoided) return null;
  return {
    reason: collisionAvoided ? "projectileCollision" : "projectileThreat",
    source,
  };
}

function getEnemyOverride(
  source: CandidateAssessment,
  selected: CandidateAssessment,
): MovementOverride | null {
  const collisionAvoided = source.enemyCollisionCount > selected.enemyCollisionCount;
  const threatAvoided = source.minimumEnemyClearance < 92 &&
    selected.minimumEnemyClearance > source.minimumEnemyClearance + 4;
  if (!collisionAvoided && !threatAvoided) return null;
  return {
    reason: collisionAvoided ? "enemyCollision" : "enemyThreat",
    source,
  };
}

function minimumFiniteTtc(
  first: number,
  second: number | undefined,
): number | null {
  const finite = [first, second].filter(
    (value): value is number => value !== undefined && Number.isFinite(value),
  );
  return finite.length > 0 ? Math.min(...finite) : null;
}

function getMotionDisposition(
  frame: AutoPilotFrame,
  intent: AutoPilotIntent,
  desired: CandidateAssessment | null,
  selected: CandidateAssessment,
  safeCandidateCount: number,
  movingSafeCandidateCount: number,
  overrideReason: AutoPilotOverrideReason | null,
): AutoPilotMotionDisposition {
  const goalDistance = intent.goalPosition
    ? distanceBetween(frame.world.player.position, intent.goalPosition)
    : null;
  const stationary = lengthSquared(selected.move) <= 0.001;
  if (
    stationary &&
    goalDistance !== null &&
    (intent.mode === "xpCollect" || intent.mode === "healCollect") &&
    goalDistance <= frame.config.pickup.magnetRadius * 0.72
  ) return "magnetWait";
  if (goalDistance !== null && goalDistance <= Math.max(12, frame.config.player.radius)) {
    return "goalReached";
  }
  if (safeCandidateCount === 0 || selected.blocked) return "noSafeVelocity";
  if (movingSafeCandidateCount === 0) {
    return desired?.blocked ? "pathBlocked" : "safetyStop";
  }
  if (
    overrideReason ||
    desired?.blocked ||
    !stationary &&
      lengthSquared(intent.desiredDirection) > 0.001 &&
      dot(selected.direction, normalize(
        intent.desiredDirection.x,
        intent.desiredDirection.y,
      )) < 0.45
  ) return "safetyDeflection";
  if (stationary) return "safetyStop";
  return "progress";
}

function preferPickupProgress(
  frame: AutoPilotFrame,
  intent: AutoPilotIntent,
  best: CandidateAssessment,
  rankedSafeAssessments: readonly CandidateAssessment[],
): CandidateAssessment {
  if (
    intent.mode !== "xpCollect" && intent.mode !== "healCollect" ||
    !intent.goalPosition ||
    lengthSquared(best.move) > 0.001
  ) return best;

  const targetDistance = distanceBetween(
    frame.world.player.position,
    intent.goalPosition,
  );
  if (targetDistance <= frame.config.pickup.magnetRadius * 0.72) return best;

  const progressing = rankedSafeAssessments.find((assessment) =>
    lengthSquared(assessment.move) > 0.001 &&
    dot(assessment.direction, intent.desiredDirection) > 0.1
  );
  if (progressing) return progressing;
  return rankedSafeAssessments.find(
    (assessment) => lengthSquared(assessment.move) > 0.001,
  ) ?? best;
}

function createBaseCandidates(
  frame: AutoPilotFrame,
  intent: AutoPilotIntent,
): Vec2[] {
  const candidates: Vec2[] = [{ x: 0, y: 0 }];
  addDirection(candidates, intent.desiredDirection);
  addDirection(candidates, frame.previousMove);
  for (let index = 0; index < BASE_DIRECTION_COUNT; index += 1) {
    const angle = (Math.PI * 2 * index) / BASE_DIRECTION_COUNT;
    addDirection(candidates, { x: Math.cos(angle), y: Math.sin(angle) });
  }
  return candidates;
}

function addDirection(candidates: Vec2[], rawDirection: Vec2): void {
  const direction = normalize(rawDirection.x, rawDirection.y);
  if (lengthSquared(direction) < 0.001) return;
  if (candidates.some((candidate) => dot(candidate, direction) > 0.9995)) return;
  candidates.push(direction);
}

function getCandidateHorizonSeconds(
  frame: AutoPilotFrame,
  intent: AutoPilotIntent,
  direction: Vec2,
  speed: number,
): number {
  if (speed <= 0.001) return MOTION_HORIZON_SECONDS;
  const waypoint = intent.nextWaypoint ?? intent.goalPosition;
  if (!waypoint) return MOTION_HORIZON_SECONDS;
  const distance = distanceBetween(frame.world.player.position, waypoint);
  const towardWaypoint = normalize(
    waypoint.x - frame.world.player.position.x,
    waypoint.y - frame.world.player.position.y,
  );
  if (dot(direction, towardWaypoint) < 0.5) return MOTION_HORIZON_SECONDS;
  const collectionAllowance =
    intent.mode === "xpCollect" || intent.mode === "healCollect"
      ? frame.config.pickup.magnetRadius * 0.72
      : 0;
  const travelDistance = Math.max(0, distance - collectionAllowance);
  return clamp(travelDistance / speed, 1 / 30, MOTION_HORIZON_SECONDS);
}

function assessCandidate(
  frame: AutoPilotFrame,
  intent: AutoPilotIntent,
  navigation: AutoPilotNavigationPort,
  hazards: HazardSet,
  rawDirection: Vec2,
): CandidateAssessment {
  const speedScale = clamp(Math.hypot(rawDirection.x, rawDirection.y), 0, 1);
  const direction = normalize(rawDirection.x, rawDirection.y);
  const speed = frame.config.player.speed * frame.world.runtime.playerSpeedMultiplier;
  const velocity = {
    x: direction.x * speed * speedScale,
    y: direction.y * speed * speedScale,
  };
  const move = {
    x: direction.x * speedScale,
    y: direction.y * speedScale,
  };
  const horizon = getCandidateHorizonSeconds(frame, intent, direction, speed * speedScale);
  const endpoint = positionAt(frame.world.player.position, velocity, horizon);
  const blocked = isCandidateBlocked(frame, navigation, direction, endpoint);
  if (blocked) return createBlockedAssessment(direction, move, speedScale);

  const threat = assessAutoPilotThreat(
    frame,
    navigation,
    velocity,
    hazards,
  );
  const projectile = threat.projectiles;
  const enemies = threat.enemies;
  const rangedExposure = assessRangedExposure(
    frame,
    navigation,
    hazards.enemies,
    endpoint,
  );
  const openSpaceClearance = getOpenSpaceClearance(endpoint, frame);
  const escapeRoutes = countEscapeRoutes(endpoint, frame, navigation);
  const wastedHealPenalty = getWastedHealMagnetPenalty(frame, intent, endpoint);
  const collisionCount = projectile.collisions + enemies.collisions;
  const dangerTier = getDangerTier(
    collisionCount,
    projectile.minimumClearance,
    enemies.minimumClearance,
  );
  const openSpaceWeight = getAutoPilotOpenSpaceWeight(
    frame,
    intent.mode,
    intent.posture,
  );
  const weaponStrategy = getAutoPilotWeaponStrategy(frame);
  const projectileRiskCost =
    projectile.risk * 1_250 * weaponStrategy.projectileRiskMultiplier;
  const enemyRiskCost =
    enemies.risk * 920 * weaponStrategy.enemyRiskMultiplier;
  const rangedExposureCost =
    rangedExposure * 85 * weaponStrategy.rangedExposureMultiplier;
  const escapeRisk = 0.2 * (1 - escapeRoutes / ESCAPE_DIRECTION_COUNT);
  const riskScore = clamp(threat.riskScore + escapeRisk, 0, 1);
  const safetyScore =
    -projectileRiskCost -
    enemyRiskCost -
    rangedExposureCost +
    Math.min(180, openSpaceClearance) * openSpaceWeight +
    escapeRoutes * (intent.mode === "survive" ? 27 : 16.5);
  const hazardCost = projectileRiskCost + enemyRiskCost + rangedExposureCost;
  const objectiveScore = getIntentScore(
    frame,
    intent,
    navigation,
    direction,
    endpoint,
    wastedHealPenalty,
  );
  const continuity = lengthSquared(frame.previousMove) > 0.001
    ? dot(direction, frame.previousMove) * 16 * speedScale
    : 0;

  return {
    direction,
    move,
    speedScale,
    blocked: false,
    collisionCount,
    projectileCollisionCount: projectile.collisions,
    dangerousProjectileCount: projectile.dangerousProjectiles,
    enemyCollisionCount: enemies.collisions,
    earliestCollision: Math.min(projectile.earliestCollision, enemies.earliestCollision),
    dangerTier,
    minimumProjectileClearance: projectile.minimumClearance,
    minimumEnemyClearance: enemies.minimumClearance,
    openSpaceClearance,
    hazardCost,
    riskScore,
    minimumTtc: threat.minimumTtc,
    predictedDamage: threat.predictedDamage,
    score: safetyScore + objectiveScore + continuity,
  };
}

function assessRangedExposure(
  frame: AutoPilotFrame,
  navigation: AutoPilotNavigationPort,
  enemies: readonly Enemy[],
  endpoint: Vec2,
): number {
  let exposure = 0;
  for (const enemy of enemies) {
    if (enemy.behavior !== "ranged" || !enemy.enteredArena) continue;
    const ranged = frame.config.enemies[enemy.typeId].ranged;
    if (!ranged) continue;
    const firingRange = ranged.preferredRange * 1.2;
    const distance = distanceBetween(enemy.position, endpoint);
    if (distance > firingRange + 35) continue;
    if (
      !navigation.hasClearPath(
        frame,
        enemy.position,
        endpoint,
        ranged.projectileRadius,
      )
    ) continue;

    const readiness = enemy.attackTimer <= 0
      ? 1.35
      : Math.max(0, 1 - enemy.attackTimer / 0.9);
    if (readiness <= 0) continue;
    const rangePressure = clamp(
      (firingRange + 35 - distance) / (firingRange * 0.45),
      0,
      1,
    );
    exposure += readiness * (0.45 + rangePressure);
  }
  return exposure;
}

function getIntentScore(
  frame: AutoPilotFrame,
  intent: AutoPilotIntent,
  navigation: AutoPilotNavigationPort,
  direction: Vec2,
  endpoint: Vec2,
  wastedHealPenalty: number,
): number {
  const current = frame.world.player.position;
  let score = dot(direction, intent.desiredDirection) * 72 * intent.goalWeight;

  if (intent.goalPosition) {
    const progress =
      distanceBetween(current, intent.goalPosition) -
      distanceBetween(endpoint, intent.goalPosition);
    score += progress * 1.8 * intent.goalWeight;
  }

  if (intent.combatTarget && intent.preferredRange !== null) {
    const currentError = Math.abs(
      distanceBetween(current, intent.combatTarget.position) - intent.preferredRange,
    );
    const endpointError = Math.abs(
      distanceBetween(endpoint, intent.combatTarget.position) - intent.preferredRange,
    );
    score += (currentError - endpointError) * 1.9;
    if (intent.preserveLineOfSight) {
      const visible = navigation.hasClearPath(
        frame,
        endpoint,
        intent.combatTarget.position,
        frame.config.weapons[frame.world.state.weaponType].radius,
      );
      const weaponStrategy = getAutoPilotWeaponStrategy(frame);
      score += visible
        ? weaponStrategy.lineOfSightReward
        : -weaponStrategy.lineOfSightPenalty;
      if (
        frame.world.state.weaponType === "pulse" &&
        (intent.combatTarget.pulseFocusStacks ?? 0) > 0 &&
        visible
      ) {
        score += (intent.combatTarget.pulseFocusStacks ?? 0) * 28;
      }
      if (visible) {
        score += getAutoPilotFiringLaneReward(
          frame,
          endpoint,
          intent.combatTarget,
        );
      }
    }
  }

  score -= wastedHealPenalty;

  return score;
}

function getWastedHealMagnetPenalty(
  frame: AutoPilotFrame,
  intent: AutoPilotIntent,
  endpoint: Vec2,
): number {
  const maximumHp = frame.config.player.maxHp + frame.world.runtime.maxHpBonus;
  if (frame.world.state.hp < maximumHp - 0.001) return 0;
  let penalty = 0;
  for (const pickup of frame.world.pickups) {
    if (pickup.kind !== "heal" || pickup.id === intent.targetId) continue;
    const currentDistance = distanceBetween(
      frame.world.player.position,
      pickup.position,
    );
    const endpointDistance = distanceBetween(endpoint, pickup.position);
    const magnetRadius = frame.config.pickup.magnetRadius;
    const avoidanceRadius = magnetRadius + frame.config.player.radius + 18;
    const movementClearance = distanceToSegment(
      pickup.position,
      frame.world.player.position,
      endpoint,
    );
    if (movementClearance < avoidanceRadius) {
      const proximity = (avoidanceRadius - movementClearance) / avoidanceRadius;
      const movingCloser = endpointDistance < currentDistance;
      penalty +=
        proximity * 920 +
        (movingCloser ? 520 : 0) +
        (movementClearance <= magnetRadius ? 2_400 : 0);
    }
    if (
      currentDistance > magnetRadius &&
      endpointDistance <= magnetRadius
    ) {
      penalty += 1_100;
    }
  }
  return penalty;
}

function distanceToSegment(point: Vec2, start: Vec2, end: Vec2): number {
  const segment = { x: end.x - start.x, y: end.y - start.y };
  const segmentLengthSquared = lengthSquared(segment);
  if (segmentLengthSquared <= 0.000001) return distanceBetween(point, start);
  const offset = { x: point.x - start.x, y: point.y - start.y };
  const ratio = clamp(dot(offset, segment) / segmentLengthSquared, 0, 1);
  return distanceBetween(point, {
    x: start.x + segment.x * ratio,
    y: start.y + segment.y * ratio,
  });
}

function isCandidateBlocked(
  frame: AutoPilotFrame,
  navigation: AutoPilotNavigationPort,
  direction: Vec2,
  endpoint: Vec2,
): boolean {
  const clearance = frame.config.player.radius + 3;
  if (getSafeArenaEdgeClearance(endpoint, frame.world, frame.config) < clearance) return true;
  if (lengthSquared(direction) < 0.001) {
    return getObstacleClearance(endpoint, frame.world.obstacles) < clearance;
  }
  return !navigation.hasClearPath(
    frame,
    frame.world.player.position,
    endpoint,
    frame.config.player.radius + frame.config.navigation.obstacleClearance,
  );
}

function getOpenSpaceClearance(endpoint: Vec2, frame: AutoPilotFrame): number {
  const edge = getSafeArenaEdgeClearance(endpoint, frame.world, frame.config);
  const obstacle = getObstacleClearance(endpoint, frame.world.obstacles);
  return Math.max(0, Math.min(edge, obstacle) - frame.config.player.radius);
}

function countEscapeRoutes(
  endpoint: Vec2,
  frame: AutoPilotFrame,
  navigation: AutoPilotNavigationPort,
): number {
  let count = 0;
  const distance = 105;
  const clearance = frame.config.player.radius + 3;
  for (let index = 0; index < ESCAPE_DIRECTION_COUNT; index += 1) {
    const angle = (Math.PI * 2 * index) / ESCAPE_DIRECTION_COUNT;
    const target = {
      x: endpoint.x + Math.cos(angle) * distance,
      y: endpoint.y + Math.sin(angle) * distance,
    };
    if (getSafeArenaEdgeClearance(target, frame.world, frame.config) < clearance) continue;
    if (
      navigation.hasClearPath(
        frame,
        endpoint,
        target,
        frame.config.player.radius + frame.config.navigation.obstacleClearance,
      )
    ) count += 1;
  }
  return count;
}

function selectRelevantHazards(frame: AutoPilotFrame): HazardSet {
  const player = frame.world.player.position;
  const playerSpeed = frame.config.player.speed * frame.world.runtime.playerSpeedMultiplier;
  const projectiles = frame.world.enemyProjectiles
    .map((projectile) => ({
      projectile,
      relevance:
        distanceBetween(player, projectile.position) -
        Math.hypot(projectile.velocity.x, projectile.velocity.y) *
          AUTO_PILOT_PROJECTILE_HORIZON_SECONDS -
        playerSpeed * AUTO_PILOT_PROJECTILE_HORIZON_SECONDS,
    }))
    .filter((candidate) => candidate.relevance < 150)
    .sort((a, b) => a.relevance - b.relevance)
    .slice(0, MAX_RELEVANT_PROJECTILES)
    .map((candidate) => candidate.projectile);
  const enemies = frame.world.enemies
    .map((enemy) => ({
      enemy,
      relevance:
        distanceBetween(player, enemy.position) -
        enemy.speed * AUTO_PILOT_ENEMY_HORIZON_SECONDS,
    }))
    .filter((candidate) => candidate.relevance < 460)
    .sort((a, b) => a.relevance - b.relevance)
    .slice(0, MAX_RELEVANT_ENEMIES)
    .map((candidate) => candidate.enemy);
  return { projectiles, enemies };
}

function getDangerTier(
  collisionCount: number,
  projectileClearance: number,
  enemyClearance: number,
): number {
  if (collisionCount > 0) return 3;
  if (projectileClearance < 28 || enemyClearance < 38) return 2;
  if (projectileClearance < 72 || enemyClearance < 92) return 1;
  return 0;
}

function compareCandidateAssessments(
  first: CandidateAssessment,
  second: CandidateAssessment,
): number {
  if (first.collisionCount > 0 && first.earliestCollision !== second.earliestCollision) {
    return second.earliestCollision - first.earliestCollision;
  }
  return second.score - first.score ||
    first.riskScore - second.riskScore ||
    first.hazardCost - second.hazardCost;
}

function getSafetyEnvelope(
  assessments: readonly CandidateAssessment[],
): CandidateAssessment[] {
  const unblocked = assessments.filter((assessment) => !assessment.blocked);
  if (unblocked.length === 0) return [];
  const minimumCollisions = Math.min(
    ...unblocked.map((assessment) => assessment.collisionCount),
  );
  const collisionSafe = unblocked.filter(
    (assessment) => assessment.collisionCount === minimumCollisions,
  );
  const minimumRisk = Math.min(
    ...collisionSafe.map((assessment) => assessment.riskScore),
  );
  const epsilon = 0.03 + 0.12 * (1 - minimumRisk) ** 2;
  return collisionSafe.filter(
    (assessment) => assessment.riskScore <= minimumRisk + epsilon,
  );
}

function positionAt(position: Vec2, velocity: Vec2, time: number): Vec2 {
  return {
    x: position.x + velocity.x * time,
    y: position.y + velocity.y * time,
  };
}

function createBlockedAssessment(
  direction: Vec2,
  move: Vec2,
  speedScale: number,
): CandidateAssessment {
  return {
    direction,
    move,
    speedScale,
    blocked: true,
    collisionCount: Number.POSITIVE_INFINITY,
    projectileCollisionCount: Number.POSITIVE_INFINITY,
    dangerousProjectileCount: Number.POSITIVE_INFINITY,
    enemyCollisionCount: Number.POSITIVE_INFINITY,
    earliestCollision: 0,
    dangerTier: 4,
    minimumProjectileClearance: Number.NEGATIVE_INFINITY,
    minimumEnemyClearance: Number.NEGATIVE_INFINITY,
    openSpaceClearance: 0,
    hazardCost: Number.POSITIVE_INFINITY,
    riskScore: 1,
    minimumTtc: 0,
    predictedDamage: Number.POSITIVE_INFINITY,
    score: Number.NEGATIVE_INFINITY,
  };
}

function finiteClearance(value: number): number {
  if (Number.isFinite(value)) return value;
  return value > 0 ? 999 : -999;
}
