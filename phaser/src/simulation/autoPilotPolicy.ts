import type { Enemy, WorldState } from "../domain/types";
import { normalize } from "../math/vector";
import type {
  AutoPilotAimPlan,
  AutoPilotCommitment,
  AutoPilotEnemyTarget,
  AutoPilotFrame,
  AutoPilotIntent,
  AutoPilotIntentMode,
  AutoPilotIntentSwitchReason,
  AutoPilotNavigationPort,
  AutoPilotPosture,
  AutoPilotTacticalPolicy,
} from "./autoPilotContracts";
import {
  clamp,
  distanceBetween,
  hashParity,
  lengthSquared,
} from "./autoPilotMath";
import {
  assessAutoPilotPressure,
  type AutoPilotPressure,
} from "./autoPilotPressure";
import {
  canSafelyCollectPickup,
  evaluatePickupTarget,
  findFiringPosition,
  getEffectiveWeaponRange,
  selectPickupTarget,
  type PickupTarget,
} from "./autoPilotTargeting";
import { getAutoPilotWeaponStrategy } from "./autoPilotWeaponStrategy";

const SWITCH_UTILITY_RATIO = 0.12;
const CROSS_MODE_SWITCH_UTILITY_RATIO = 0.18;
const SWITCH_UTILITY_FLOOR = 0.08;
const CROSS_MODE_SWITCH_UTILITY_FLOOR = 0.12;
export const AUTO_PILOT_COMMIT_STALL_SECONDS = 0.35;
const COVERAGE_PATROL_REVISIT_SECONDS = 30;
const COVERAGE_PATROL_FULL_UTILITY_RISK = 0.2;
const COVERAGE_PATROL_MAX_RISK = 0.55;
const COVERAGE_PATROL_MAX_UTILITY = 1.25;

export const AUTO_PILOT_FIELD_XP_LIMIT = 50;
export const AUTO_PILOT_FIELD_XP_COLLECTION_THRESHOLD = 35;

const MINIMUM_COMMIT_SECONDS: Record<AutoPilotIntentMode, number> = {
  healCollect: 0.72,
  xpCollect: 0.45,
  engage: 0.3,
  reposition: 0.3,
  survive: 0,
  patrol: 0,
};

export const DEFAULT_AUTO_PILOT_TACTICS: AutoPilotTacticalPolicy = {
  selectIntent(frame, aim, navigation) {
    return selectAutoPilotIntent(frame, aim, navigation);
  },
};

export function selectAutoPilotIntent(
  frame: AutoPilotFrame,
  aim: AutoPilotAimPlan,
  navigation: AutoPilotNavigationPort,
): AutoPilotIntent {
  const pressure = assessAutoPilotPressure(frame, navigation);
  const candidate = selectCandidateIntent(frame, aim, navigation, pressure);
  return resolveCommitment(
    frame,
    aim,
    navigation,
    candidate,
    pressure.posture,
  );
}

function selectCandidateIntent(
  frame: AutoPilotFrame,
  aim: AutoPilotAimPlan,
  navigation: AutoPilotNavigationPort,
  pressure: AutoPilotPressure,
): AutoPilotIntent {
  const { world, config } = frame;
  const maximumHp = config.player.maxHp + world.runtime.maxHpBonus;
  const hpRatio = maximumHp > 0 ? world.state.hp / maximumHp : 1;
  const weaponStrategy = getAutoPilotWeaponStrategy(frame);
  const encounterPhase = world.encounter.director.phase;
  const fieldXpCount = getFieldXpPickupCount(world);
  const backlogPressure = getXpBacklogPressure(fieldXpCount);
  const xpBacklog = backlogPressure > 0;
  const healTarget = selectPickupTarget(frame, navigation, "heal");
  const arenaDiagonal = Math.hypot(config.arena.width, config.arena.height);
  const xpMaximumDistance = encounterPhase === "warning"
    ? arenaDiagonal
    : clamp(
        700 - pressure.riskScore * 500 + backlogPressure * arenaDiagonal,
        360,
        arenaDiagonal,
      );
  const backlogCandidateLimit = Math.round(7 + backlogPressure * 17);
  const backlogPathBatchSize = Math.round(3 + backlogPressure * 4);
  const xpTarget = encounterPhase === "active"
    ? null
    : selectPickupTarget(frame, navigation, "xp", {
        maximumDistance: xpMaximumDistance,
        safeOnly: true,
        prioritizeDensity: encounterPhase === "warning" || xpBacklog,
        candidateLimit: encounterPhase === "warning"
          ? 24
          : backlogCandidateLimit,
        fullPathCandidateLimit:
          encounterPhase === "warning" ? 7 : backlogPathBatchSize,
        minimumAcceptedCandidates: 2,
      });
  const safeHeal = healTarget && canSafelyCollectPickup(frame, healTarget)
    ? healTarget
    : null;
  const safeXp = xpTarget;
  const tacticalXp = encounterPhase === "warning"
    ? canCompleteWarningCollection(frame, navigation, safeXp)
      ? safeXp
      : null
    : safeXp;

  if (hpRatio < weaponStrategy.criticalHpRatio) {
    return safeHeal
      ? createPickupIntent(frame, aim, navigation, safeHeal, pressure.posture)
      : createSurviveIntent(frame, aim, "defensive");
  }

  if (encounterPhase === "warning" && tacticalXp) {
    return createPickupIntent(
      frame,
      aim,
      navigation,
      tacticalXp,
      pressure.posture,
      1,
    );
  }

  if (pressure.riskScore >= 0.68) {
    if (safeHeal && safeHeal.eta <= 0.8) {
      return createPickupIntent(frame, aim, navigation, safeHeal, "defensive");
    }
    if (tacticalXp && tacticalXp.eta <= 0.35) {
      return createPickupIntent(frame, aim, navigation, tacticalXp, "defensive");
    }
    return createSurviveIntent(frame, aim, "defensive");
  }

  if (safeHeal && hpRatio < 0.8) {
    return createPickupIntent(
      frame,
      aim,
      navigation,
      safeHeal,
      pressure.posture,
    );
  }

  if (frame.patrolStrategy === "visit-history-v1") {
    if (backlogPressure > 0 && tacticalXp) {
      return createPickupIntent(
        frame,
        aim,
        navigation,
        tacticalXp,
        pressure.posture,
        getBacklogCollectionUtility(backlogPressure),
      );
    }
    if (
      backlogPressure > 0 &&
      (encounterPhase === "pending" || encounterPhase === "recovery") &&
      frame.coverage?.targetXpPickupCount
    ) {
      if (safeHeal && hpRatio < 0.8) {
        return createPickupIntent(
          frame,
          aim,
          navigation,
          safeHeal,
          pressure.posture,
        );
      }
      return createPatrolIntent(
        frame,
        pressure.posture,
        navigation,
        pressure.riskScore,
        0.9 + backlogPressure * 0.5,
      );
    }
  }

  const candidates: AutoPilotIntent[] = [];
  if (safeHeal) {
    candidates.push(
      createPickupIntent(frame, aim, navigation, safeHeal, pressure.posture),
    );
  }
  if (tacticalXp) {
    candidates.push(
      createPickupIntent(
        frame,
        aim,
        navigation,
        tacticalXp,
        pressure.posture,
        backlogPressure > 0
          ? getBacklogCollectionUtility(backlogPressure)
          : 0,
      ),
    );
  }
  if (aim.target) {
    candidates.push(
      createCombatIntent(frame, aim.target, navigation, pressure.posture),
    );
  }
  const coveragePatrolAllowed =
    encounterPhase === "pending" || encounterPhase === "recovery";
  if (coveragePatrolAllowed) {
    candidates.push(
      createPatrolIntent(
        frame,
        pressure.posture,
        navigation,
        pressure.riskScore,
      ),
    );
  }
  if (candidates.length === 0) {
    return createSurviveIntent(frame, aim, pressure.posture);
  }
  candidates.sort(compareIntents);
  return candidates[0]!;
}

function resolveCommitment(
  frame: AutoPilotFrame,
  aim: AutoPilotAimPlan,
  navigation: AutoPilotNavigationPort,
  candidate: AutoPilotIntent,
  posture: AutoPilotPosture,
): AutoPilotIntent {
  const commitment = frame.commitment;
  if (!commitment) {
    return withSwitchReason(
      candidate,
      frame.commitmentReleaseReason ?? "initial",
    );
  }

  const committed = recreateCommittedIntent(
    frame,
    aim,
    navigation,
    commitment,
    posture,
  );
  if (!committed) return withSwitchReason(candidate, "targetUnavailable");
  const encounterPhaseChangedTactic =
    (frame.world.encounter.director.phase === "warning" &&
      commitment.mode !== "xpCollect" &&
      candidate.mode === "xpCollect") ||
    (frame.world.encounter.director.phase === "active" &&
      commitment.mode === "xpCollect");
  if (encounterPhaseChangedTactic) {
    return withSwitchReason(candidate, "phaseTransition");
  }
  const committedFor = frame.world.state.elapsed - commitment.startedAt;
  const stalled = isProgressCommitment(commitment.mode) &&
    frame.world.state.elapsed - commitment.lastProgressAt >
      AUTO_PILOT_COMMIT_STALL_SECONDS;
  if (stalled) return withSwitchReason(candidate, "targetUnavailable");
  if (isSameTacticalTarget(committed, candidate)) {
    return withSwitchReason(candidate, "sameTarget");
  }

  const weaponStrategy = getAutoPilotWeaponStrategy(frame);
  const maximumHp = frame.config.player.maxHp + frame.world.runtime.maxHpBonus;
  const hpRatio = maximumHp > 0 ? frame.world.state.hp / maximumHp : 1;
  if (
    candidate.mode === "healCollect" &&
    hpRatio < weaponStrategy.criticalHpRatio
  ) {
    return withSwitchReason(candidate, "emergency");
  }
  if (committedFor < MINIMUM_COMMIT_SECONDS[commitment.mode]) {
    return withSwitchReason(committed, "minimumCommit");
  }

  const sameActionFamily = committed.mode === candidate.mode ||
    isCombatMode(committed.mode) && isCombatMode(candidate.mode);
  const requiredImprovement = Math.max(
    sameActionFamily
      ? SWITCH_UTILITY_FLOOR
      : CROSS_MODE_SWITCH_UTILITY_FLOOR,
    committed.utility * (
      sameActionFamily
        ? SWITCH_UTILITY_RATIO
        : CROSS_MODE_SWITCH_UTILITY_RATIO
    ),
  );
  if (candidate.utility >= committed.utility + requiredImprovement) {
    return withSwitchReason(candidate, "betterUtility");
  }
  return withSwitchReason(committed, "hysteresis");
}

function recreateCommittedIntent(
  frame: AutoPilotFrame,
  aim: AutoPilotAimPlan,
  navigation: AutoPilotNavigationPort,
  commitment: AutoPilotCommitment,
  posture: AutoPilotPosture,
): AutoPilotIntent | null {
  if (commitment.mode === "healCollect" || commitment.mode === "xpCollect") {
    const pickup = frame.world.pickups.find((item) => item.id === commitment.targetId);
    if (!pickup) return null;
    if (
      commitment.mode === "healCollect" && pickup.kind !== "heal" ||
      commitment.mode === "xpCollect" && pickup.kind !== "xp"
    ) return null;
    const target = evaluatePickupTarget(frame, navigation, pickup);
    if (!target) return null;
    return createPickupIntent(frame, aim, navigation, target, posture);
  }

  if (commitment.mode === "engage" || commitment.mode === "reposition") {
    const enemy = frame.world.enemies.find((item) => item.id === commitment.targetId);
    if (!enemy) return null;
    const target = createEnemyTarget(frame, enemy, navigation);
    return createCombatIntent(frame, target, navigation, posture);
  }
  return null;
}

function createPickupIntent(
  frame: AutoPilotFrame,
  aim: AutoPilotAimPlan,
  navigation: AutoPilotNavigationPort,
  target: PickupTarget,
  posture: AutoPilotPosture,
  minimumUtility = 0,
): AutoPilotIntent {
  const maximumHp = frame.config.player.maxHp + frame.world.runtime.maxHpBonus;
  const missingHpRatio = Math.max(
    0,
    (maximumHp - frame.world.state.hp) / Math.max(1, maximumHp),
  );
  const hpRatio = maximumHp > 0 ? frame.world.state.hp / maximumHp : 1;
  const healPriorityHpRatio = getAutoPilotWeaponStrategy(frame).healPriorityHpRatio;
  const healPriority = clamp(
    (healPriorityHpRatio - hpRatio) / Math.max(0.1, healPriorityHpRatio),
    0,
    1,
  );
  const expiryUrgency = target.ttlMargin === null
    ? 0
    : clamp((5 - target.ttlMargin) / 5, 0, 1);
  const utility = Math.max(
    minimumUtility,
    target.pickup.kind === "heal"
      ? clamp(
          target.utility +
            missingHpRatio * 1.2 +
            healPriority * 0.18 +
            Math.min(0.2, target.effectiveValue / Math.max(1, maximumHp) * 1.5) +
            expiryUrgency * 0.08,
          0,
          1,
        )
      : clamp(
          target.utility + (posture === "opportunistic" ? 0.12 : 0.04),
          0,
          1,
        ),
  );
  return {
    mode: target.pickup.kind === "heal" ? "healCollect" : "xpCollect",
    posture,
    targetId: target.pickup.id,
    goalPosition: { ...target.pickup.position },
    combatTarget: aim.target?.enemy ?? null,
    desiredDirection: navigation.navigateTo(frame, target.pickup.position),
    nextWaypoint: target.path.waypoints[1]
      ? { ...target.path.waypoints[1] }
      : { ...target.pickup.position },
    preferredRange: null,
    goalWeight:
      0.85 + Math.min(1, utility) * 1.25 + Math.max(0, utility - 1) * 0.35,
    preserveLineOfSight: false,
    utility,
    pathEta: target.eta,
    progressDistance: target.pathDistance,
    switchReason: "initial",
  };
}

export function getFieldXpPickupCount(world: WorldState): number {
  let count = 0;
  for (const pickup of world.pickups) {
    if (pickup.kind === "xp") count += 1;
  }
  return count;
}

export function getXpBacklogPressure(fieldXpCount: number): number {
  return clamp(
    (fieldXpCount - 20) / 50,
    0,
    1,
  );
}

function getBacklogCollectionUtility(backlogPressure: number): number {
  return 0.7 + backlogPressure * 2;
}

function canCompleteWarningCollection(
  frame: AutoPilotFrame,
  navigation: AutoPilotNavigationPort,
  target: PickupTarget | null,
): target is PickupTarget {
  if (!target) return false;
  const scheduledAt = frame.world.encounter.director.scheduledAt;
  if (scheduledAt === null) return true;
  const timeToActive = scheduledAt - frame.world.state.elapsed;
  if (timeToActive <= 0) return false;
  const inset = frame.world.encounter.collapse.inset;
  const safeAnchor = {
    x: (inset + frame.config.arena.width - inset) / 2,
    y: (inset + frame.config.arena.height - inset) / 2,
  };
  const exitPath = navigation.estimatePath(
    frame,
    target.pickup.position,
    safeAnchor,
    frame.config.player.radius,
  );
  if (!exitPath.reachable) return false;
  const speed = frame.config.player.speed *
    frame.world.runtime.playerSpeedMultiplier;
  const safeAnchorEta = exitPath.distance / Math.max(1, speed);
  const preparationMargin = 0.75;
  return target.eta + safeAnchorEta + preparationMargin < timeToActive;
}

function createCombatIntent(
  frame: AutoPilotFrame,
  target: AutoPilotEnemyTarget,
  navigation: AutoPilotNavigationPort,
  posture: AutoPilotPosture,
): AutoPilotIntent {
  const preferredRange = getAutoPilotWeaponStrategy(frame).preferredRange;
  const utility = getKillUtility(frame, target);
  if (!target.visible || !target.inRange) {
    const firingPosition = findFiringPosition(frame, target.enemy, navigation);
    const goalPosition = firingPosition ?? target.enemy.position;
    return {
      mode: "reposition",
      posture,
      targetId: target.enemy.id,
      goalPosition: { ...goalPosition },
      combatTarget: target.enemy,
      desiredDirection: navigation.navigateTo(frame, goalPosition),
      nextWaypoint: { ...goalPosition },
      preferredRange,
      goalWeight: 0.75 + utility,
      preserveLineOfSight: true,
      utility: utility * 0.82,
      pathEta: null,
      progressDistance: null,
      switchReason: "initial",
    };
  }

  return {
    mode: "engage",
    posture,
    targetId: target.enemy.id,
    goalPosition: null,
    combatTarget: target.enemy,
    desiredDirection: getEngagementDirection(
      frame,
      target.enemy.position,
      preferredRange,
    ),
    nextWaypoint: null,
    preferredRange,
    goalWeight: 0.8 + utility * 0.7,
    preserveLineOfSight: true,
    utility,
    pathEta: null,
    progressDistance: null,
    switchReason: "initial",
  };
}

function createSurviveIntent(
  frame: AutoPilotFrame,
  aim: AutoPilotAimPlan,
  posture: AutoPilotPosture,
): AutoPilotIntent {
  const desiredDirection = lengthSquared(frame.previousMove) > 0.001
    ? frame.previousMove
    : directionTowardArenaCenter(frame);
  return {
    mode: "survive",
    posture,
    targetId: aim.targetId,
    goalPosition: null,
    combatTarget: aim.target?.enemy ?? null,
    desiredDirection,
    nextWaypoint: null,
    preferredRange: null,
    goalWeight: 0.25,
    preserveLineOfSight: false,
    utility: 1,
    pathEta: null,
    progressDistance: null,
    switchReason: "emergency",
  };
}

function createPatrolIntent(
  frame: AutoPilotFrame,
  posture: AutoPilotPosture,
  navigation: AutoPilotNavigationPort,
  riskScore: number,
  minimumUtility = 0.08,
): AutoPilotIntent {
  const coverage = frame.patrolStrategy === "visit-history-v1"
    ? frame.coverage
    : null;
  const targetPosition = coverage?.targetPosition ?? null;
  const targetZoneId = coverage?.targetZoneId ?? null;
  const utility = coverage && targetPosition && targetZoneId
    ? Math.max(
        minimumUtility,
        getCoveragePatrolUtility(coverage.oldestZoneAgeSeconds, riskScore),
      )
    : 0.08;
  return {
    mode: "patrol",
    posture,
    targetId: targetZoneId ? `coverage:${targetZoneId}` : null,
    goalPosition: targetPosition ? { ...targetPosition } : null,
    combatTarget: null,
    desiredDirection: targetPosition
      ? navigation.navigateTo(frame, targetPosition)
      : getPatrolDirection(frame),
    nextWaypoint: targetPosition ? { ...targetPosition } : null,
    preferredRange: null,
    goalWeight: targetPosition
      ? 2 + Math.max(0, utility - 0.08) * 0.35
      : 0.65,
    preserveLineOfSight: false,
    utility,
    pathEta: targetPosition ? coverage?.targetEta ?? null : null,
    progressDistance: null,
    switchReason: "initial",
  };
}

function getCoveragePatrolUtility(
  oldestZoneAgeSeconds: number,
  riskScore: number,
): number {
  const urgencyStart = COVERAGE_PATROL_REVISIT_SECONDS * 0.5;
  const overdue = clamp(
    (oldestZoneAgeSeconds - urgencyStart) /
      (COVERAGE_PATROL_REVISIT_SECONDS - urgencyStart),
    0,
    1,
  );
  const calmFactor = 1 - clamp(
    (riskScore - COVERAGE_PATROL_FULL_UTILITY_RISK) /
      (COVERAGE_PATROL_MAX_RISK - COVERAGE_PATROL_FULL_UTILITY_RISK),
    0,
    1,
  );
  return 0.08 + (COVERAGE_PATROL_MAX_UTILITY - 0.08) * overdue * calmFactor;
}

function createEnemyTarget(
  frame: AutoPilotFrame,
  enemy: Enemy,
  navigation: AutoPilotNavigationPort,
): AutoPilotEnemyTarget {
  const distance = distanceBetween(frame.world.player.position, enemy.position);
  return {
    enemy,
    distance,
    visible: navigation.hasClearPath(
      frame,
      frame.world.player.position,
      enemy.position,
      frame.config.weapons[frame.world.state.weaponType].radius,
    ),
    inRange: distance <= getEffectiveWeaponRange(frame) + enemy.radius,
  };
}

function getKillUtility(
  frame: AutoPilotFrame,
  target: AutoPilotEnemyTarget,
): number {
  const expectedTtk = getExpectedTtk(frame, target);
  const xpToNext = Math.max(1, frame.world.progression.xpToNext);
  const dropValue = target.enemy.xpValue / xpToNext;
  const threatValueByType: Record<Enemy["typeId"], number> = {
    ranged: 0.42,
    fast: 0.38,
    chaser: 0.28,
    brute: 0.24,
  };
  const contactClearance = Math.max(
    0,
    target.distance - frame.config.player.radius - target.enemy.radius,
  );
  const contactUrgency = target.enemy.behavior === "ranged"
    ? 0
    : clamp(1 - contactClearance / Math.max(1, target.enemy.speed * 2), 0, 1);
  const identityValue = frame.world.state.weaponType === "pulse"
    ? Math.min(0.15, (target.enemy.pulseFocusStacks ?? 0) * 0.05)
    : frame.world.state.weaponType === "spread" &&
        frame.world.weaponIdentity.spreadSweepCharge
      ? 0.1
      : 0;
  const value =
    0.16 +
    dropValue * 3 +
    threatValueByType[target.enemy.typeId] * 0.55 +
    contactUrgency * 0.28 +
    identityValue;
  return clamp(value / Math.max(0.28, expectedTtk), 0, 1);
}

export function getExpectedTtk(
  frame: AutoPilotFrame,
  target: AutoPilotEnemyTarget,
): number {
  const weapon = frame.config.weapons[frame.world.state.weaponType];
  const projectileCount = weapon.projectileCount + frame.world.runtime.projectileCountBonus;
  const angularRadius = Math.asin(
    clamp(
      (target.enemy.radius + weapon.radius) / Math.max(1, target.distance),
      0,
      1,
    ),
  );
  let expectedHits = 1;
  if (frame.world.state.weaponType === "spread" && projectileCount > 1) {
    const step = weapon.spreadAngle / (projectileCount - 1);
    const start = -weapon.spreadAngle / 2;
    expectedHits = Math.max(
      1,
      Array.from({ length: projectileCount }, (_, index) => start + step * index)
        .filter((angle) => Math.abs(angle) <= angularRadius).length,
    );
  }
  const focusActive =
    (target.enemy.pulseFocusExpiresAt ?? 0) >= frame.world.state.elapsed;
  const focusStacks = focusActive ? target.enemy.pulseFocusStacks ?? 0 : 0;
  const focusMultiplier = frame.world.state.weaponType === "pulse"
    ? 1 + frame.world.runtime.pulseFocusBonusPerStack * focusStacks
    : 1;
  const damagePerVolley = Math.max(
    0.001,
    weapon.damage *
      frame.world.runtime.projectileDamageMultiplier *
      expectedHits *
      focusMultiplier,
  );
  const volleysRequired = Math.max(1, Math.ceil(target.enemy.hp / damagePerVolley));
  const intervalMultiplier =
    frame.world.state.weaponType === "spread" &&
    frame.world.weaponIdentity.spreadSweepCharge
      ? frame.world.runtime.spreadSweepNextIntervalMultiplier
      : 1;
  const fireInterval = Math.max(
    0.04,
    weapon.interval *
      frame.world.runtime.fireIntervalMultiplier *
      intervalMultiplier,
  );
  const projectileSpeed = weapon.speed * frame.world.runtime.projectileSpeedMultiplier;
  const travelTime = target.distance / Math.max(1, projectileSpeed);
  return (
    Math.max(0, frame.world.state.shotTimer) +
    travelTime +
    Math.max(0, volleysRequired - 1) * fireInterval
  );
}

function compareIntents(first: AutoPilotIntent, second: AutoPilotIntent): number {
  if (Math.abs(first.utility - second.utility) > 0.000001) {
    return second.utility - first.utility;
  }
  const priority: Record<AutoPilotIntentMode, number> = {
    healCollect: 0,
    xpCollect: 1,
    engage: 2,
    reposition: 3,
    survive: 4,
    patrol: 5,
  };
  return priority[first.mode] - priority[second.mode] ||
    (first.targetId ?? "").localeCompare(second.targetId ?? "");
}

function isSameTacticalTarget(
  first: AutoPilotIntent,
  second: AutoPilotIntent,
): boolean {
  if (!first.targetId || first.targetId !== second.targetId) return false;
  if (first.mode === second.mode) return true;
  return isCombatMode(first.mode) && isCombatMode(second.mode);
}

function isCombatMode(mode: AutoPilotIntentMode): boolean {
  return mode === "engage" || mode === "reposition";
}

function isProgressCommitment(mode: AutoPilotIntentMode): boolean {
  return mode === "healCollect" || mode === "xpCollect";
}

function withSwitchReason(
  intent: AutoPilotIntent,
  switchReason: AutoPilotIntentSwitchReason,
): AutoPilotIntent {
  return { ...intent, switchReason };
}

function getEngagementDirection(
  frame: AutoPilotFrame,
  target: { x: number; y: number },
  preferredRange: number,
): { x: number; y: number } {
  const { world } = frame;
  const toward = normalize(
    target.x - world.player.position.x,
    target.y - world.player.position.y,
  );
  const distance = distanceBetween(world.player.position, target);
  const clockwise = hashParity(frame.previousAimTargetId ?? "observer") === 0;
  const tangent = clockwise
    ? { x: -toward.y, y: toward.x }
    : { x: toward.y, y: -toward.x };
  const radial = distance > preferredRange + 25
    ? toward
    : distance < preferredRange - 25
      ? { x: -toward.x, y: -toward.y }
      : { x: 0, y: 0 };
  return normalize(tangent.x * 0.72 + radial.x, tangent.y * 0.72 + radial.y);
}

function getPatrolDirection(frame: AutoPilotFrame): { x: number; y: number } {
  const center = directionTowardArenaCenter(frame);
  const orbit = normalize(
    Math.cos(frame.world.state.elapsed * 0.85),
    Math.sin(frame.world.state.elapsed * 0.65),
  );
  return normalize(center.x * 0.45 + orbit.x, center.y * 0.45 + orbit.y);
}

function directionTowardArenaCenter(frame: AutoPilotFrame): { x: number; y: number } {
  const inset = frame.world.encounter.collapse.inset;
  const centerX = (inset + frame.config.arena.width - inset) / 2;
  const centerY = (inset + frame.config.arena.height - inset) / 2;
  return normalize(
    centerX - frame.world.player.position.x,
    centerY - frame.world.player.position.y,
  );
}
