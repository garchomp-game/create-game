import type { Enemy, Pickup, Vec2, WorldState } from "../domain/types";
import { normalize } from "../math/vector";
import type {
  AutoPilotAimPlan,
  AutoPilotEnemyTarget,
  AutoPilotFrame,
  AutoPilotNavigationPort,
  AutoPilotPathEstimate,
  AutoPilotPickupRejectionReason,
  AutoPilotPickupSelectionDiagnostics,
  AutoPilotTargetingPolicy,
} from "./autoPilotContracts";
import {
  clamp,
  distanceBetween,
  dot,
  getSafeArenaEdgeClearance,
  isPointInsideArena,
  lengthSquared,
} from "./autoPilotMath";
import {
  getAutoPilotPreferredRange,
  getAutoPilotReachableLaneHits,
  getAutoPilotWeaponStrategy,
} from "./autoPilotWeaponStrategy";
import {
  estimateEnemyVelocity,
  getTimeToCircleCollision,
} from "./autoPilotThreat";

export type PickupTarget = {
  pickup: Pickup;
  distance: number;
  pathDistance: number;
  eta: number;
  ttlMargin: number | null;
  danger: number;
  pathRisk: number;
  predictedDamage: number;
  effectiveValue: number;
  corridorPickupCount: number;
  corridorXpValue: number;
  utility: number;
  path: AutoPilotPathEstimate;
};

export type PickupTargetOptions = {
  maximumDistance?: number;
  safeOnly?: boolean;
  prioritizeDensity?: boolean;
  candidateLimit?: number;
  fullPathCandidateLimit?: number;
  minimumAcceptedCandidates?: number;
  onDiagnostics?: (diagnostics: AutoPilotPickupSelectionDiagnostics) => void;
};

export type PickupSafetyOptions = {
  minimumPlayerEnemyDistance?: number;
  minimumPickupEnemyDistance?: number;
};

const XP_SEARCH_DISTANCE = 420;
const RANGE_MARGIN = 0.94;
const MAX_PICKUP_CANDIDATES_PER_KIND = 7;
const MAX_BACKLOG_PICKUP_CANDIDATES = 24;
const MAX_FULL_PATH_PICKUP_CANDIDATES = 3;
const PATH_SAMPLE_COUNT = 6;
const SPREAD_AIM_DIRECTION_COUNT = 24;
const PICKUP_GRID_CELL_SIZE = 150;

export const DEFAULT_AUTO_PILOT_TARGETING: AutoPilotTargetingPolicy = {
  planAim(frame, navigation) {
    const target = selectAimTarget(frame, navigation);
    if (!target) {
      return {
        target: null,
        targetId: null,
        aimWorld: {
          x: frame.world.player.position.x + 100,
          y: frame.world.player.position.y,
        },
        shootHeld: false,
        expectedDistinctHits: 0,
      };
    }

    const directAim = getInterceptAimPoint(frame, target.enemy, navigation);
    const aim = frame.world.state.weaponType === "spread"
      ? getSpreadAimSolution(frame, target, navigation, directAim)
      : {
          aimWorld: directAim,
          expectedDistinctHits: getAutoPilotReachableLaneHits(
            frame,
            frame.world.player.position,
            target.enemy,
          ),
        };

    return {
      target,
      targetId: target.enemy.id,
      aimWorld: aim.aimWorld,
      shootHeld: target.visible && target.inRange,
      expectedDistinctHits: aim.expectedDistinctHits,
    };
  },
};

type SpreadAimSolution = {
  aimWorld: Vec2;
  expectedDistinctHits: number;
};

type SpreadAimSample = {
  enemy: Enemy;
  angle: number;
  distance: number;
};

type PickupSpatialIndex = {
  source: readonly Pickup[];
  byKind: Record<Pickup["kind"], Pickup[]>;
  cells: Map<string, Pickup[]>;
  cellKindCounts: Map<string, Record<Pickup["kind"], number>>;
};

const pickupSpatialIndexes = new WeakMap<WorldState, PickupSpatialIndex>();

function getSpreadAimSolution(
  frame: AutoPilotFrame,
  target: AutoPilotEnemyTarget,
  navigation: AutoPilotNavigationPort,
  directAim: Vec2,
): SpreadAimSolution {
  const player = frame.world.player.position;
  const directAngle = Math.atan2(
    directAim.y - player.y,
    directAim.x - player.x,
  );
  const samples = createSpreadAimSamples(frame, navigation);
  const candidateAngles = [directAngle];
  for (const sample of samples) addUniqueAngle(candidateAngles, sample.angle);
  for (let index = 0; index < SPREAD_AIM_DIRECTION_COUNT; index += 1) {
    addUniqueAngle(
      candidateAngles,
      Math.PI * 2 * index / SPREAD_AIM_DIRECTION_COUNT,
    );
  }

  const contactDistance = Math.max(
    0,
    target.distance - frame.config.player.radius - target.enemy.radius,
  );
  const imminentContact = target.enemy.behavior !== "ranged" &&
    contactDistance / Math.max(1, target.enemy.speed) <= 0.75;
  let best = evaluateSpreadAimAngle(frame, samples, target.enemy, directAngle);
  if (!imminentContact) {
    for (const angle of candidateAngles) {
      const candidate = evaluateSpreadAimAngle(
        frame,
        samples,
        target.enemy,
        angle,
      );
      if (!candidate.hitsTarget) continue;
      if (
        candidate.score > best.score + 0.000001 ||
        Math.abs(candidate.score - best.score) <= 0.000001 &&
          angleDistance(angle, directAngle) < angleDistance(best.angle, directAngle)
      ) best = candidate;
    }
  }

  const aimDistance = Math.max(120, Math.min(getEffectiveWeaponRange(frame), target.distance));
  return {
    aimWorld: {
      x: player.x + Math.cos(best.angle) * aimDistance,
      y: player.y + Math.sin(best.angle) * aimDistance,
    },
    expectedDistinctHits: best.distinctHits,
  };
}

function createSpreadAimSamples(
  frame: AutoPilotFrame,
  navigation: AutoPilotNavigationPort,
): SpreadAimSample[] {
  const player = frame.world.player.position;
  const weapon = frame.config.weapons.spread;
  const range = getEffectiveWeaponRange(frame);
  return frame.world.enemies.flatMap((enemy) => {
    if (!enemy.enteredArena || !isEnemyInsideArena(
      enemy,
      frame.config.arena.width,
      frame.config.arena.height,
    )) return [];
    const aimPoint = getInterceptAimPoint(frame, enemy, navigation);
    const distance = distanceBetween(player, aimPoint);
    if (distance > range + enemy.radius) return [];
    if (!navigation.hasClearPath(frame, player, aimPoint, weapon.radius)) return [];
    return [{
      enemy,
      distance,
      angle: Math.atan2(aimPoint.y - player.y, aimPoint.x - player.x),
    }];
  });
}

function evaluateSpreadAimAngle(
  frame: AutoPilotFrame,
  samples: readonly SpreadAimSample[],
  target: Enemy,
  angle: number,
): {
  angle: number;
  distinctHits: number;
  hitsTarget: boolean;
  score: number;
} {
  const weapon = frame.config.weapons.spread;
  const projectileCount = weapon.projectileCount + frame.world.runtime.projectileCountBonus;
  const offsets = getSpreadOffsets(projectileCount, weapon.spreadAngle);
  const damage = weapon.damage * frame.world.runtime.projectileDamageMultiplier;
  let distinctHits = 0;
  let hitsTarget = false;
  let expectedDamage = 0;
  let overkill = 0;
  let threatValue = 0;

  for (const sample of samples) {
    const angularRadius = Math.asin(
      clamp((sample.enemy.radius + weapon.radius + 3) / Math.max(1, sample.distance), 0, 1),
    );
    const hitCount = offsets.filter(
      (offset) => angleDistance(angle + offset, sample.angle) <= angularRadius,
    ).length;
    if (hitCount === 0) continue;
    distinctHits += 1;
    if (sample.enemy.id === target.id) hitsTarget = true;
    const volleyDamage = hitCount * damage;
    expectedDamage += Math.min(sample.enemy.hp, volleyDamage);
    overkill += Math.max(0, volleyDamage - sample.enemy.hp);
    threatValue += getSpreadThreatValue(sample.enemy, sample.distance);
  }

  const sweepThreshold = frame.world.runtime.spreadSweepDistinctTargets;
  const sweepValue = sweepThreshold > 0 && distinctHits >= sweepThreshold
    ? 1.25
    : 0;
  return {
    angle,
    distinctHits,
    hitsTarget,
    score:
      distinctHits * 1.15 +
      expectedDamage * 0.3 +
      threatValue +
      sweepValue -
      overkill * 0.04 +
      (hitsTarget ? 0.9 : -1.5),
  };
}

function getSpreadOffsets(projectileCount: number, spreadAngle: number): number[] {
  if (projectileCount <= 1) return [0];
  const step = spreadAngle / (projectileCount - 1);
  return Array.from(
    { length: projectileCount },
    (_, index) => -spreadAngle / 2 + step * index,
  );
}

function getSpreadThreatValue(enemy: Enemy, distance: number): number {
  const typeValue: Record<Enemy["typeId"], number> = {
    ranged: 0.42,
    fast: 0.36,
    chaser: 0.24,
    brute: 0.18,
  };
  return typeValue[enemy.typeId] + clamp((260 - distance) / 260, 0, 1) * 0.3;
}

function addUniqueAngle(angles: number[], angle: number): void {
  if (angles.some((candidate) => angleDistance(candidate, angle) < 0.015)) return;
  angles.push(angle);
}

function angleDistance(first: number, second: number): number {
  return Math.abs(Math.atan2(Math.sin(first - second), Math.cos(first - second)));
}

export function selectAimTarget(
  frame: AutoPilotFrame,
  navigation: AutoPilotNavigationPort,
): AutoPilotEnemyTarget | null {
  const { world, config } = frame;
  let best: { target: AutoPilotEnemyTarget; score: number } | null = null;
  let emergency: { target: AutoPilotEnemyTarget; secondsToContact: number } | null = null;
  const projectileRadius = config.weapons[world.state.weaponType].radius;
  const effectiveRange = getEffectiveWeaponRange(frame);
  const emergencyWindow = world.expedition?.boss?.status === "active"
    ? 0.3
    : world.state.weaponType === "pulse"
      ? 1.4
      : world.state.weaponType === "pierce"
        ? 1.1
        : 0.75;

  for (const enemy of world.enemies) {
    const distance = distanceBetween(world.player.position, enemy.position);
    const visible = navigation.hasClearPath(
      frame,
      world.player.position,
      enemy.position,
      projectileRadius,
    );
    const target = {
      enemy,
      distance,
      visible,
      inRange: distance <= effectiveRange + enemy.radius,
    };
    if (
      enemy.behavior !== "ranged" &&
      enemy.enteredArena &&
      visible &&
      target.inRange
    ) {
      const contactDistance = Math.max(
        0,
        distance - config.player.radius - enemy.radius,
      );
      const secondsToContact = contactDistance / Math.max(1, enemy.speed);
      if (
        secondsToContact < emergencyWindow &&
        (!emergency || secondsToContact < emergency.secondsToContact)
      ) {
        emergency = { target, secondsToContact };
      }
    }
    const score = getEnemyTargetScore(frame, target);
    if (!best || score < best.score) best = { target, score };
  }
  return emergency?.target ?? best?.target ?? null;
}

export function findNearestEnemy(
  position: Vec2,
  enemies: readonly Enemy[],
): AutoPilotEnemyTarget | null {
  let nearest: AutoPilotEnemyTarget | null = null;
  for (const enemy of enemies) {
    const distance = distanceBetween(position, enemy.position);
    if (!nearest || distance < nearest.distance) {
      nearest = { enemy, distance, visible: true, inRange: true };
    }
  }
  return nearest;
}

export function selectPickupTarget(
  frame: AutoPilotFrame,
  navigation: AutoPilotNavigationPort,
  kind: Pickup["kind"] | null = null,
  options: PickupTargetOptions = {},
): PickupTarget | null {
  const { world, config } = frame;
  const maxHp = config.player.maxHp + world.runtime.maxHpBonus;
  const hpRatio = maxHp > 0 ? world.state.hp / maxHp : 1;
  const arenaDiagonal = Math.hypot(config.arena.width, config.arena.height);
  const pickupIndex = getPickupSpatialIndex(world);
  const source = kind ? pickupIndex.byKind[kind] : pickupIndex.source;
  const diagnostics = createPickupSelectionDiagnostics(kind, source.length);
  const candidateLimit = clamp(
    options.candidateLimit ?? MAX_PICKUP_CANDIDATES_PER_KIND,
    1,
    MAX_BACKLOG_PICKUP_CANDIDATES,
  );
  const candidates: Array<{ pickup: Pickup; distance: number; rank: number }> = [];
  for (const pickup of source) {
    if (frame.excludedPickupIds?.has(pickup.id)) {
      diagnostics.rejectedByReason.cooldown += 1;
      continue;
    }
    const distance = distanceBetween(world.player.position, pickup.position);
    const maximumDistance = pickup.kind === "heal"
      ? hpRatio < 0.45
        ? arenaDiagonal
        : hpRatio < 0.75
          ? 720
          : XP_SEARCH_DISTANCE + 120
      : options.maximumDistance ?? XP_SEARCH_DISTANCE;
    if (distance > maximumDistance) {
      diagnostics.rejectedByReason.distance += 1;
      continue;
    }
    diagnostics.withinSearchDistanceCount += 1;
    const expiry = pickup.lifetime ?? Number.POSITIVE_INFINITY;
    const densityRankBonus = options.prioritizeDensity
      ? Math.min(
          180,
          Math.max(0, getPickupNeighborhoodPopulation(pickup, pickupIndex) - 1) * 10,
        )
      : 0;
    const rank = distance - densityRankBonus + Math.min(0, expiry - 4) * 30;
    const candidate = { pickup, distance, rank };
    const insertAt = candidates.findIndex((item) =>
      rank < item.rank || rank === item.rank && pickup.id < item.pickup.id
    );
    if (insertAt < 0) candidates.push(candidate);
    else candidates.splice(insertAt, 0, candidate);
    if (candidates.length > candidateLimit) candidates.pop();
  }
  diagnostics.prefilteredCount = candidates.length;
  let best: PickupTarget | null = null;

  const fullPathCandidateLimit = clamp(
    options.fullPathCandidateLimit ?? MAX_FULL_PATH_PICKUP_CANDIDATES,
    1,
    candidateLimit,
  );
  const minimumAcceptedCandidates = clamp(
    options.minimumAcceptedCandidates ?? 1,
    1,
    candidateLimit,
  );
  let acceptedCandidates = 0;
  for (let index = 0; index < candidates.length; index += 1) {
    const { pickup, distance } = candidates[index]!;
    const evaluation = evaluatePickupTargetDetailed(
      frame,
      navigation,
      pickup,
      distance,
    );
    diagnostics.pathEvaluatedCount += 1;
    if (evaluation.reachable) diagnostics.reachableCount += 1;
    if (evaluation.ttlValid) diagnostics.ttlValidCount += 1;
    if (!evaluation.target) {
      diagnostics.rejectedByReason[evaluation.rejectionReason!] += 1;
      if (shouldStopPickupEvaluation(
        index,
        fullPathCandidateLimit,
        acceptedCandidates,
        minimumAcceptedCandidates,
      )) break;
      continue;
    }
    const target = evaluation.target;
    const safetyRejection = getPickupSafetyRejectionReason(frame, target);
    if (!safetyRejection) diagnostics.safeCount += 1;
    else {
      diagnostics.rejectedByReason[safetyRejection] += 1;
    }
    if (safetyRejection && options.safeOnly) {
      if (shouldStopPickupEvaluation(
        index,
        fullPathCandidateLimit,
        acceptedCandidates,
        minimumAcceptedCandidates,
      )) break;
      continue;
    }
    acceptedCandidates += 1;
    if (
      !best ||
      target.utility > best.utility + 0.000001 ||
      Math.abs(target.utility - best.utility) <= 0.000001 &&
        (target.corridorPickupCount > best.corridorPickupCount ||
          target.corridorPickupCount === best.corridorPickupCount &&
            (target.eta < best.eta ||
          target.eta === best.eta && target.pickup.id < best.pickup.id)
        )
    ) {
      best = target;
    }
    if (shouldStopPickupEvaluation(
      index,
      fullPathCandidateLimit,
      acceptedCandidates,
      minimumAcceptedCandidates,
    )) break;
  }
  diagnostics.selectedPickupId = best?.pickup.id ?? null;
  diagnostics.selectedCorridorPickupCount = best?.corridorPickupCount ?? 0;
  diagnostics.selectedCorridorXpValue = best?.corridorXpValue ?? 0;
  const diagnosticKind = kind ?? best?.pickup.kind;
  if (diagnosticKind) frame.recordPickupSelection?.(diagnosticKind, diagnostics);
  options.onDiagnostics?.(diagnostics);
  return best;
}

function createPickupSelectionDiagnostics(
  kind: Pickup["kind"] | null,
  pickupSourceCount: number,
): AutoPilotPickupSelectionDiagnostics {
  return {
    kind,
    pickupSourceCount,
    withinSearchDistanceCount: 0,
    prefilteredCount: 0,
    pathEvaluatedCount: 0,
    reachableCount: 0,
    ttlValidCount: 0,
    safeCount: 0,
    selectedPickupId: null,
    selectedCorridorPickupCount: 0,
    selectedCorridorXpValue: 0,
    rejectedByReason: {
      cooldown: 0,
      distance: 0,
      pathUnreachable: 0,
      ttlExpired: 0,
      noEffectiveValue: 0,
      pathRisk: 0,
      unsafeProximity: 0,
    },
  };
}

function shouldStopPickupEvaluation(
  _candidateIndex: number,
  _batchSize: number,
  acceptedCandidates: number,
  minimumAcceptedCandidates: number,
): boolean {
  return acceptedCandidates >= minimumAcceptedCandidates;
}

function assessXpPickupCorridor(
  frame: AutoPilotFrame,
  path: AutoPilotPathEstimate,
): { pickupCount: number; xpValue: number } {
  const corridorRadius = frame.config.pickup.magnetRadius * 0.9;
  const spatialIndex = getPickupSpatialIndex(frame.world);
  const corridorCandidates = new Map<string, Pickup>();
  for (let index = 1; index < path.waypoints.length; index += 1) {
    const start = path.waypoints[index - 1]!;
    const end = path.waypoints[index]!;
    const minimumCellX = Math.floor(
      (Math.min(start.x, end.x) - corridorRadius) / PICKUP_GRID_CELL_SIZE,
    );
    const maximumCellX = Math.floor(
      (Math.max(start.x, end.x) + corridorRadius) / PICKUP_GRID_CELL_SIZE,
    );
    const minimumCellY = Math.floor(
      (Math.min(start.y, end.y) - corridorRadius) / PICKUP_GRID_CELL_SIZE,
    );
    const maximumCellY = Math.floor(
      (Math.max(start.y, end.y) + corridorRadius) / PICKUP_GRID_CELL_SIZE,
    );
    for (let cellY = minimumCellY; cellY <= maximumCellY; cellY += 1) {
      for (let cellX = minimumCellX; cellX <= maximumCellX; cellX += 1) {
        for (const pickup of spatialIndex.cells.get(`${cellX}:${cellY}`) ?? []) {
          if (pickup.kind === "xp") corridorCandidates.set(pickup.id, pickup);
        }
      }
    }
  }
  let pickupCount = 0;
  let xpValue = 0;
  for (const pickup of corridorCandidates.values()) {
    if (frame.excludedPickupIds?.has(pickup.id)) continue;
    if (distanceToPath(pickup.position, path.waypoints) > corridorRadius) continue;
    pickupCount += 1;
    xpValue += pickup.xpValue;
  }
  return { pickupCount, xpValue };
}

function distanceToPath(point: Vec2, waypoints: readonly Vec2[]): number {
  if (waypoints.length === 0) return Number.POSITIVE_INFINITY;
  if (waypoints.length === 1) return distanceBetween(point, waypoints[0]!);
  let minimum = Number.POSITIVE_INFINITY;
  for (let index = 1; index < waypoints.length; index += 1) {
    minimum = Math.min(
      minimum,
      distanceToSegment(point, waypoints[index - 1]!, waypoints[index]!),
    );
  }
  return minimum;
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

export function evaluatePickupTarget(
  frame: AutoPilotFrame,
  navigation: AutoPilotNavigationPort,
  pickup: Pickup,
  directDistance = distanceBetween(
    frame.world.player.position,
    pickup.position,
  ),
): PickupTarget | null {
  return evaluatePickupTargetDetailed(
    frame,
    navigation,
    pickup,
    directDistance,
  ).target;
}

type PickupTargetEvaluation = {
  target: PickupTarget | null;
  reachable: boolean;
  ttlValid: boolean;
  rejectionReason: Extract<
    AutoPilotPickupRejectionReason,
    "pathUnreachable" | "ttlExpired" | "noEffectiveValue"
  > | null;
};

function evaluatePickupTargetDetailed(
  frame: AutoPilotFrame,
  navigation: AutoPilotNavigationPort,
  pickup: Pickup,
  directDistance = distanceBetween(
    frame.world.player.position,
    pickup.position,
  ),
): PickupTargetEvaluation {
  const { world, config } = frame;
  const path = navigation.estimatePath(
    frame,
    world.player.position,
    pickup.position,
    config.player.radius,
  );
  if (!path.reachable) {
    return {
      target: null,
      reachable: false,
      ttlValid: false,
      rejectionReason: "pathUnreachable",
    };
  }
  const speed = config.player.speed * world.runtime.playerSpeedMultiplier;
  const collectionDistance = Math.min(
    path.distance,
    config.pickup.magnetRadius * 0.72,
  );
  const travelDistance = Math.max(0, path.distance - collectionDistance);
  const eta = travelDistance / Math.max(1, speed);
  const ttlMargin = pickup.lifetime === null ? null : pickup.lifetime - eta;
  if (ttlMargin !== null && ttlMargin <= 0) {
    return {
      target: null,
      reachable: true,
      ttlValid: false,
      rejectionReason: "ttlExpired",
    };
  }
  const pathThreat = assessPickupPathThreat(
    frame,
    navigation,
    path,
    eta,
    travelDistance,
  );
  const danger = getPickupDanger(pickup.position, world.enemies);
  const maximumHp = config.player.maxHp + world.runtime.maxHpBonus;
  const projectedHp = Math.max(0, world.state.hp - pathThreat.predictedDamage);
  const missingHpAtArrival = Math.max(0, maximumHp - projectedHp);
  const effectiveValue = pickup.kind === "heal"
    ? Math.min(pickup.healValue, missingHpAtArrival)
    : pickup.xpValue;
  if (effectiveValue <= 0) {
    return {
      target: null,
      reachable: true,
      ttlValid: true,
      rejectionReason: "noEffectiveValue",
    };
  }

  const travelFactor = 1 / (1 + eta / 2.6);
  const safetyFactor = Math.max(0, 1 - pathThreat.risk);
  const densityBonus = getPickupDensityBonus(
    pickup,
    getPickupSpatialIndex(world),
  );
  const baseUtility = pickup.kind === "heal"
    ? getHealUtility(
        pickup,
        effectiveValue,
        maximumHp,
        eta,
        ttlMargin,
        travelFactor,
        safetyFactor,
      )
    : getXpUtility(
        frame,
        pickup,
        travelFactor,
        safetyFactor,
        densityBonus,
      );
  const corridor = pickup.kind === "xp"
    ? assessXpPickupCorridor(frame, path)
    : { pickupCount: 0, xpValue: 0 };
  const corridorBonus = pickup.kind === "xp"
    ? clamp((corridor.pickupCount - 1) / 8, 0, 0.28) +
      clamp(
        corridor.xpValue / Math.max(1, world.progression.xpToNext),
        0,
        0.15,
      )
    : 0;
  const utility = clamp(baseUtility + corridorBonus, 0, 1);

  return {
    target: {
      pickup,
      distance: directDistance,
      pathDistance: path.distance,
      eta,
      ttlMargin,
      danger,
      pathRisk: pathThreat.risk,
      predictedDamage: pathThreat.predictedDamage,
      effectiveValue,
      corridorPickupCount: corridor.pickupCount,
      corridorXpValue: corridor.xpValue,
      utility,
      path,
    },
    reachable: true,
    ttlValid: true,
    rejectionReason: null,
  };
}

export function canSafelyCollectPickup(
  frame: AutoPilotFrame,
  target: PickupTarget,
  options: PickupSafetyOptions = {},
): boolean {
  return getPickupSafetyRejectionReason(frame, target, options) === null;
}

function getPickupSafetyRejectionReason(
  frame: AutoPilotFrame,
  target: PickupTarget,
  options: PickupSafetyOptions = {},
): Extract<AutoPilotPickupRejectionReason, "pathRisk" | "unsafeProximity"> | null {
  const { world, config } = frame;
  const nearestEnemy = findNearestEnemy(world.player.position, world.enemies);
  const nearbyEnemy = findNearestEnemy(target.pickup.position, world.enemies);
  const magnetReach = config.pickup.magnetRadius * 1.6;
  const maximumPathRisk = target.pickup.kind === "heal" ? 0.42 : 0.3;
  if (target.pathRisk > maximumPathRisk) return "pathRisk";
  if (target.distance <= magnetReach || target.eta <= 0.75) return null;
  if (target.pathRisk <= 0.12) return null;
  if (target.pickup.kind === "heal") {
    const maxHp = config.player.maxHp + world.runtime.maxHpBonus;
    const hpRatio = maxHp > 0 ? world.state.hp / maxHp : 1;
    const safe = hpRatio < 0.75 &&
      (nearestEnemy?.distance ?? Number.POSITIVE_INFINITY) > (hpRatio < 0.45 ? 95 : 135) &&
      (nearbyEnemy?.distance ?? Number.POSITIVE_INFINITY) > (hpRatio < 0.45 ? 75 : 105);
    return safe ? null : "unsafeProximity";
  }
  const minimumPlayerEnemyDistance =
    options.minimumPlayerEnemyDistance ?? 145;
  const minimumPickupEnemyDistance =
    options.minimumPickupEnemyDistance ?? 100;
  const safe = (
    (nearestEnemy?.distance ?? Number.POSITIVE_INFINITY) >
      minimumPlayerEnemyDistance &&
    (nearbyEnemy?.distance ?? Number.POSITIVE_INFINITY) >
      minimumPickupEnemyDistance
  );
  return safe ? null : "unsafeProximity";
}

export function findFiringPosition(
  frame: AutoPilotFrame,
  enemy: Enemy,
  navigation: AutoPilotNavigationPort,
): Vec2 | null {
  const { world, config } = frame;
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
  const preferredRange = getAutoPilotPreferredRange(frame, enemy);
  let best: { position: Vec2; score: number } | null = null;

  for (const radius of [preferredRange, preferredRange - 55, preferredRange + 45]) {
    for (const offset of angleOffsets) {
      const angle = baseAngle + offset;
      const position = {
        x: enemy.position.x + Math.cos(angle) * radius,
        y: enemy.position.y + Math.sin(angle) * radius,
      };
      if (!isPointInsideArena(position, config.player.radius + 4, config)) continue;
      if (getSafeArenaEdgeClearance(position, world, config) < config.player.radius + 4) continue;
      if (
        !navigation.hasClearPath(
          frame,
          position,
          position,
          config.player.radius + config.navigation.obstacleClearance,
        )
      ) continue;
      if (!navigation.hasClearPath(frame, position, enemy.position, projectileRadius)) continue;

      const nearestEnemy = findNearestEnemy(
        position,
        world.enemies.filter((item) => item !== enemy),
      );
      const enemyPenalty = nearestEnemy && nearestEnemy.distance < 180
        ? (180 - nearestEnemy.distance) * 3.2
        : 0;
      const directRoute = navigation.hasClearPath(
        frame,
        world.player.position,
        position,
        config.player.radius,
      );
      const score =
        distanceBetween(world.player.position, position) +
        enemyPenalty +
        (directRoute ? 0 : 70) -
        Math.min(120, getSafeArenaEdgeClearance(position, world, config)) * 0.2;
      if (!best || score < best.score) best = { position, score };
    }
  }
  return best?.position ?? null;
}

function getInterceptAimPoint(
  frame: AutoPilotFrame,
  enemy: Enemy,
  navigation: AutoPilotNavigationPort,
): Vec2 {
  const { world, config } = frame;
  const weapon = config.weapons[world.state.weaponType];
  const projectileSpeed = weapon.speed * world.runtime.projectileSpeedMultiplier;
  const enemyVelocity = estimateEnemyVelocity(
    frame,
    enemy,
    world.player.position,
    navigation,
  );
  const relative = {
    x: enemy.position.x - world.player.position.x,
    y: enemy.position.y - world.player.position.y,
  };
  const a = enemyVelocity.x ** 2 + enemyVelocity.y ** 2 - projectileSpeed ** 2;
  const b = 2 * (relative.x * enemyVelocity.x + relative.y * enemyVelocity.y);
  const c = relative.x ** 2 + relative.y ** 2;
  const interceptTime = solvePositiveTime(a, b, c) ?? Math.sqrt(c) / Math.max(1, projectileSpeed);
  const time = clamp(interceptTime, 0, weapon.lifetime * RANGE_MARGIN);
  return {
    x: clamp(enemy.position.x + enemyVelocity.x * time, enemy.radius, config.arena.width - enemy.radius),
    y: clamp(enemy.position.y + enemyVelocity.y * time, enemy.radius, config.arena.height - enemy.radius),
  };
}

export function getEffectiveWeaponRange(frame: AutoPilotFrame): number {
  const weapon = frame.config.weapons[frame.world.state.weaponType];
  return weapon.speed * frame.world.runtime.projectileSpeedMultiplier * weapon.lifetime * RANGE_MARGIN;
}

function getEnemyTargetScore(
  frame: AutoPilotFrame,
  target: AutoPilotEnemyTarget,
): number {
  const { world, config } = frame;
  const enemy = target.enemy;
  const insideArena = isEnemyInsideArena(enemy, config.arena.width, config.arena.height);
  const typePriority: Record<Enemy["typeId"], number> = {
    ranged: -150,
    fast: -120,
    chaser: -55,
    brute: -25,
  };
  const contactDistance = Math.max(0, target.distance - config.player.radius - enemy.radius);
  const secondsToContact = enemy.behavior === "ranged"
    ? Number.POSITIVE_INFINITY
    : contactDistance / Math.max(1, enemy.speed);
  const contactPriority = Number.isFinite(secondsToContact)
    ? secondsToContact <= 0.3
      ? -5_500
      : -Math.max(0, 4 - secondsToContact) * 95
    : 0;
  const retainedTargetPriority =
    enemy.id === frame.previousAimTargetId && world.state.weaponType !== "pulse" ? -35 : 0;
  const lowHpPriority = Math.min(14, enemy.hp) * 7;
  const strategicTargetPriority = enemy.elite
    ? -2_200
    : enemy.boss
      ? -4_200
      : 0;

  return (
    (insideArena ? 0 : 100_000) +
    (target.visible ? 0 : 10_000) +
    (target.inRange ? 0 : 4_000) +
    (enemy.enteredArena ? 0 : 400) +
    target.distance +
    typePriority[enemy.typeId] +
    contactPriority +
    retainedTargetPriority +
    strategicTargetPriority +
    lowHpPriority +
    getAutoPilotWeaponStrategy(frame).targetScoreAdjustment(frame, target)
  );
}

function getPickupDanger(position: Vec2, enemies: readonly Enemy[]): number {
  let danger = 0;
  for (const enemy of enemies) {
    const distance = distanceBetween(position, enemy.position) - enemy.radius;
    if (distance < 110) danger += (110 - distance) * 6;
    else if (distance < 190) danger += (190 - distance) * 1.4;
  }
  return danger;
}

function assessPickupPathThreat(
  frame: AutoPilotFrame,
  navigation: AutoPilotNavigationPort,
  path: AutoPilotPathEstimate,
  eta: number,
  travelDistance: number,
): { risk: number; predictedDamage: number } {
  if (eta <= 0.001 || travelDistance <= 0.001) {
    return { risk: 0, predictedDamage: 0 };
  }
  const bounds = getPathBounds(path.waypoints, travelDistance);
  const relevantProjectiles = frame.world.enemyProjectiles.filter((projectile) =>
    distanceToBounds(projectile.position, bounds) <=
      Math.hypot(projectile.velocity.x, projectile.velocity.y) * eta + 130
  );
  const relevantEnemies = frame.world.enemies.filter((enemy) =>
    enemy.enteredArena &&
    distanceToBounds(enemy.position, bounds) <= enemy.speed * eta + 165
  );
  const damagedBy = new Set<string>();
  const enemyPositions = new Map(
    relevantEnemies.map((enemy) => [enemy.id, { ...enemy.position }]),
  );
  let maximumRisk = 0;

  for (let sampleIndex = 1; sampleIndex <= PATH_SAMPLE_COUNT; sampleIndex += 1) {
    const startRatio = (sampleIndex - 1) / PATH_SAMPLE_COUNT;
    const endRatio = sampleIndex / PATH_SAMPLE_COUNT;
    const startTime = eta * startRatio;
    const segmentDuration = Math.max(0.001, eta / PATH_SAMPLE_COUNT);
    const position = getPointAlongPath(
      path.waypoints,
      travelDistance * startRatio,
    );
    const nextPosition = getPointAlongPath(
      path.waypoints,
      travelDistance * endRatio,
    );
    const playerVelocity = {
      x: (nextPosition.x - position.x) / segmentDuration,
      y: (nextPosition.y - position.y) / segmentDuration,
    };

    for (const projectile of relevantProjectiles) {
      if (projectile.lifetime < startTime) continue;
      const projectilePosition = {
        x: projectile.position.x + projectile.velocity.x * startTime,
        y: projectile.position.y + projectile.velocity.y * startTime,
      };
      const relativePosition = {
        x: projectilePosition.x - position.x,
        y: projectilePosition.y - position.y,
      };
      const relativeVelocity = {
        x: projectile.velocity.x - playerVelocity.x,
        y: projectile.velocity.y - playerVelocity.y,
      };
      const combinedRadius = frame.config.player.radius + projectile.radius;
      const currentClearance = Math.sqrt(lengthSquared(relativePosition)) - combinedRadius;
      const approaching = dot(relativePosition, relativeVelocity) < -0.000001;
      if (!approaching && currentClearance > 0) continue;
      const relativeSpeedSquared = lengthSquared(relativeVelocity);
      const closestTime = relativeSpeedSquared > 0.001
        ? clamp(
            -dot(relativePosition, relativeVelocity) / relativeSpeedSquared,
            0,
            segmentDuration,
          )
        : 0;
      const closestOffset = {
        x: relativePosition.x + relativeVelocity.x * closestTime,
        y: relativePosition.y + relativeVelocity.y * closestTime,
      };
      const clearance = Math.sqrt(lengthSquared(closestOffset)) - combinedRadius;
      maximumRisk = Math.max(maximumRisk, clearanceRisk(clearance, 95));
      if (
        getTimeToCircleCollision(
          relativePosition,
          relativeVelocity,
          combinedRadius + 7,
          segmentDuration,
        ) !== null
      ) damagedBy.add(projectile.id);
    }

    for (const enemy of relevantEnemies) {
      const enemyPosition = enemyPositions.get(enemy.id) ?? enemy.position;
      const enemyVelocity = estimateEnemyVelocity(
        frame,
        enemy,
        nextPosition,
        navigation,
        enemyPosition,
      );
      const relativePosition = {
        x: enemyPosition.x - position.x,
        y: enemyPosition.y - position.y,
      };
      const relativeVelocity = {
        x: enemyVelocity.x - playerVelocity.x,
        y: enemyVelocity.y - playerVelocity.y,
      };
      const combinedRadius =
        frame.config.player.radius + enemy.radius + 8;
      const relativeSpeedSquared = lengthSquared(relativeVelocity);
      const closestTime = relativeSpeedSquared > 0.001
        ? clamp(
            -dot(relativePosition, relativeVelocity) / relativeSpeedSquared,
            0,
            segmentDuration,
          )
        : 0;
      const closestOffset = {
        x: relativePosition.x + relativeVelocity.x * closestTime,
        y: relativePosition.y + relativeVelocity.y * closestTime,
      };
      const reachableClearance =
        Math.sqrt(lengthSquared(closestOffset)) - combinedRadius;
      const behaviorWeight = enemy.behavior === "ranged" ? 0.45 : 1;
      maximumRisk = Math.max(
        maximumRisk,
        clearanceRisk(reachableClearance, 125) * behaviorWeight,
      );
      if (
        enemy.behavior !== "ranged" &&
        getTimeToCircleCollision(
          relativePosition,
          relativeVelocity,
          combinedRadius,
          segmentDuration,
        ) !== null
      ) {
        damagedBy.add(enemy.id);
      }
      enemyPositions.set(enemy.id, {
        x: enemyPosition.x + enemyVelocity.x * segmentDuration,
        y: enemyPosition.y + enemyVelocity.y * segmentDuration,
      });
    }
  }

  let predictedDamage = 0;
  for (const projectile of relevantProjectiles) {
    if (damagedBy.has(projectile.id)) predictedDamage += projectile.damage;
  }
  for (const enemy of relevantEnemies) {
    if (damagedBy.has(enemy.id)) predictedDamage += enemy.damage;
  }
  const maximumHp = frame.config.player.maxHp + frame.world.runtime.maxHpBonus;
  return {
    risk: clamp(
      maximumRisk + predictedDamage / Math.max(1, maximumHp) * 0.5,
      0,
      1,
    ),
    predictedDamage,
  };
}

type PathBounds = {
  minimumX: number;
  minimumY: number;
  maximumX: number;
  maximumY: number;
};

function getPathBounds(
  path: readonly Vec2[],
  travelDistance: number,
): PathBounds {
  const points = [getPointAlongPath(path, 0)];
  let traversed = 0;
  for (let index = 1; index < path.length && traversed < travelDistance; index += 1) {
    const start = path[index - 1]!;
    const end = path[index]!;
    const segmentLength = distanceBetween(start, end);
    traversed += segmentLength;
    points.push(
      traversed <= travelDistance
        ? end
        : getPointAlongPath(path, travelDistance),
    );
  }
  return {
    minimumX: Math.min(...points.map((point) => point.x)),
    minimumY: Math.min(...points.map((point) => point.y)),
    maximumX: Math.max(...points.map((point) => point.x)),
    maximumY: Math.max(...points.map((point) => point.y)),
  };
}

function distanceToBounds(position: Vec2, bounds: PathBounds): number {
  const deltaX = Math.max(
    bounds.minimumX - position.x,
    0,
    position.x - bounds.maximumX,
  );
  const deltaY = Math.max(
    bounds.minimumY - position.y,
    0,
    position.y - bounds.maximumY,
  );
  return Math.hypot(deltaX, deltaY);
}

function getHealUtility(
  pickup: Pickup,
  effectiveValue: number,
  maximumHp: number,
  eta: number,
  ttlMargin: number | null,
  travelFactor: number,
  safetyFactor: number,
): number {
  const effectiveRatio = effectiveValue / Math.max(1, maximumHp);
  const expiryUrgency = ttlMargin === null
    ? 0
    : clamp((6 - ttlMargin) / 6, 0, 1);
  const arrivalProbability = pickup.lifetime === null || ttlMargin === null
    ? 1
    : clamp(ttlMargin / Math.max(0.6, Math.min(2, eta + 0.6)), 0, 1);
  const value = clamp(0.22 + effectiveRatio * 2.6 + expiryUrgency * 0.16, 0, 1);
  return clamp(value * travelFactor * safetyFactor * arrivalProbability, 0, 1);
}

function getXpUtility(
  frame: AutoPilotFrame,
  pickup: Pickup,
  travelFactor: number,
  safetyFactor: number,
  densityBonus: number,
): number {
  const { xp, xpToNext } = frame.world.progression;
  const denominator = Math.max(1, xpToNext);
  const scale = Math.max(1, denominator * 0.08);
  const before = sigmoid((xp - xpToNext) / scale);
  const after = sigmoid((xp + pickup.xpValue - xpToNext) / scale);
  const marginalValue =
    0.4 * pickup.xpValue / denominator + 0.6 * (after - before);
  const value = clamp(0.3 + marginalValue * 8 + densityBonus, 0, 1);
  return clamp(value * travelFactor * safetyFactor, 0, 1);
}

function getPickupDensityBonus(
  target: Pickup,
  index: PickupSpatialIndex,
): number {
  let value = 0;
  const cellX = Math.floor(target.position.x / PICKUP_GRID_CELL_SIZE);
  const cellY = Math.floor(target.position.y / PICKUP_GRID_CELL_SIZE);
  for (let offsetY = -1; offsetY <= 1; offsetY += 1) {
    for (let offsetX = -1; offsetX <= 1; offsetX += 1) {
      const pickups = index.cells.get(`${cellX + offsetX}:${cellY + offsetY}`) ?? [];
      for (const pickup of pickups) {
        if (pickup.id === target.id || pickup.kind !== target.kind) continue;
        const distance = distanceBetween(target.position, pickup.position);
        if (distance < PICKUP_GRID_CELL_SIZE) {
          value +=
            (PICKUP_GRID_CELL_SIZE - distance) /
            PICKUP_GRID_CELL_SIZE *
            0.025;
        }
      }
    }
  }
  return Math.min(0.18, value);
}

function getPickupSpatialIndex(world: WorldState): PickupSpatialIndex {
  const cached = pickupSpatialIndexes.get(world);
  if (cached?.source === world.pickups) return cached;
  const index: PickupSpatialIndex = {
    source: world.pickups,
    byKind: { xp: [], heal: [] },
    cells: new Map(),
    cellKindCounts: new Map(),
  };
  for (const pickup of world.pickups) {
    index.byKind[pickup.kind].push(pickup);
    const key = `${Math.floor(pickup.position.x / PICKUP_GRID_CELL_SIZE)}:${
      Math.floor(pickup.position.y / PICKUP_GRID_CELL_SIZE)
    }`;
    const cell = index.cells.get(key);
    if (cell) cell.push(pickup);
    else index.cells.set(key, [pickup]);
    const kindCounts = index.cellKindCounts.get(key) ?? { xp: 0, heal: 0 };
    kindCounts[pickup.kind] += 1;
    index.cellKindCounts.set(key, kindCounts);
  }
  pickupSpatialIndexes.set(world, index);
  return index;
}

function getPickupNeighborhoodPopulation(
  target: Pickup,
  index: PickupSpatialIndex,
): number {
  const cellX = Math.floor(target.position.x / PICKUP_GRID_CELL_SIZE);
  const cellY = Math.floor(target.position.y / PICKUP_GRID_CELL_SIZE);
  let population = 0;
  for (let offsetY = -1; offsetY <= 1; offsetY += 1) {
    for (let offsetX = -1; offsetX <= 1; offsetX += 1) {
      const counts = index.cellKindCounts.get(`${cellX + offsetX}:${cellY + offsetY}`);
      const count = counts?.[target.kind] ?? 0;
      population += offsetX === 0 && offsetY === 0 ? count : count * 0.35;
    }
  }
  return population;
}

function getPointAlongPath(path: readonly Vec2[], distance: number): Vec2 {
  if (path.length === 0) return { x: 0, y: 0 };
  let remaining = Math.max(0, distance);
  for (let index = 1; index < path.length; index += 1) {
    const start = path[index - 1]!;
    const end = path[index]!;
    const segmentLength = distanceBetween(start, end);
    if (remaining <= segmentLength || index === path.length - 1) {
      const ratio = segmentLength > 0 ? clamp(remaining / segmentLength, 0, 1) : 0;
      return {
        x: start.x + (end.x - start.x) * ratio,
        y: start.y + (end.y - start.y) * ratio,
      };
    }
    remaining -= segmentLength;
  }
  return { ...path.at(-1)! };
}

function clearanceRisk(clearance: number, range: number): number {
  return clamp((range - clearance) / range, 0, 1) ** 2;
}

function sigmoid(value: number): number {
  if (value >= 0) return 1 / (1 + Math.exp(-value));
  const exponent = Math.exp(value);
  return exponent / (1 + exponent);
}

function solvePositiveTime(a: number, b: number, c: number): number | null {
  if (Math.abs(a) < 0.000001) {
    if (Math.abs(b) < 0.000001) return null;
    const time = -c / b;
    return time > 0 ? time : null;
  }
  const discriminant = b * b - 4 * a * c;
  if (discriminant < 0) return null;
  const root = Math.sqrt(discriminant);
  const first = (-b - root) / (2 * a);
  const second = (-b + root) / (2 * a);
  const positive = [first, second].filter((time) => time > 0).sort((x, y) => x - y);
  return positive[0] ?? null;
}

function isEnemyInsideArena(enemy: Enemy, width: number, height: number): boolean {
  return (
    enemy.position.x >= 0 &&
    enemy.position.x <= width &&
    enemy.position.y >= 0 &&
    enemy.position.y <= height
  );
}
