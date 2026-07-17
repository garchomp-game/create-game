import type { InputSnapshot, SimulationConfig, Vec2, WorldState } from "../domain/types";
import type {
  AutoPilotAgent,
  AutoPilotAgentOptions,
  AutoPilotCommitment,
  AutoPilotCoverageSnapshot,
  AutoPilotDecision,
  AutoPilotIntent,
  AutoPilotIntentMode,
  AutoPilotMode,
  AutoPilotNavigationPort,
  AutoPilotPatrolStrategy,
  AutoPilotPickupSelectionDiagnostics,
  AutoPilotPickupSelectionSnapshot,
  AutoPilotServices,
} from "./autoPilotContracts";
import { createAutoPilotCoverageTracker } from "./autoPilotCoverage";
import { DEFAULT_AUTO_PILOT_MOTION } from "./autoPilotMovement";
import { ROT_AUTO_PILOT_NAVIGATION } from "./autoPilotNavigation";
import {
  AUTO_PILOT_COMMIT_STALL_SECONDS,
  DEFAULT_AUTO_PILOT_TACTICS,
} from "./autoPilotPolicy";
import { DEFAULT_AUTO_PILOT_TARGETING } from "./autoPilotTargeting";

export type {
  AutoPilotAgent,
  AutoPilotAgentOptions,
  AutoPilotDecision,
  AutoPilotMode,
  AutoPilotOverrideReason,
  AutoPilotPatrolStrategy,
  AutoPilotProfileId,
  AutoPilotServices,
} from "./autoPilotContracts";

export const AUTO_PILOT_MODIFIER_ID = "auto-pilot:tactical-observer-v3";
export const AUTO_PILOT_PATROL_MODIFIER_ID =
  "auto-pilot:patrol:visit-history-v1";
const STALLED_PICKUP_COOLDOWN_SECONDS = 0.9;

const BASE_INPUT: InputSnapshot = {
  move: { x: 0, y: 0 },
  aimWorld: null,
  startPressed: false,
  shootHeld: false,
  restartPressed: false,
  pausePressed: false,
  quitToTitlePressed: false,
  upgradeChoicePressed: null,
  contractChoicePressed: null,
};

function createEmptyPickupSelection(): AutoPilotPickupSelectionSnapshot {
  return { xp: null, heal: null };
}

function createIdleMotionTelemetry() {
  return {
    motionDisposition: "goalReached" as const,
    actualDisplacementPx: 0,
    goalDistancePx: null,
    goalProgressPx: null,
    nextWaypoint: null,
    waypointDistancePx: null,
    selectedVelocity: { x: 0, y: 0 },
    desiredVelocity: { x: 0, y: 0 },
    safeCandidateCount: 0,
    movingSafeCandidateCount: 0,
    selectedRisk: 0,
    minimumCandidateRisk: 0,
    stallAgeSeconds: 0,
    pickupSelection: createEmptyPickupSelection(),
  };
}

const UPGRADE_PRIORITY = [
  "pulseRicochet",
  "spreadSweep",
  "pulseFocus",
  "splitShot",
  "swiftStep",
  "rapidFire",
  "overdriveRounds",
  "piercingRounds",
  "vitalCore",
] as const;

const DEFAULT_SERVICES: AutoPilotServices = {
  navigation: ROT_AUTO_PILOT_NAVIGATION,
  targeting: DEFAULT_AUTO_PILOT_TARGETING,
  tactics: DEFAULT_AUTO_PILOT_TACTICS,
  motion: DEFAULT_AUTO_PILOT_MOTION,
};

export function createAutoPilotAgent(
  services: AutoPilotServices = DEFAULT_SERVICES,
  options: AutoPilotAgentOptions = {},
): AutoPilotAgent {
  let previousMove: Vec2 = { x: 0, y: 0 };
  let previousAimTargetId: string | null = null;
  let previousIntentMode: AutoPilotIntentMode | null = null;
  let commitment: AutoPilotCommitment | null = null;
  let previousPlayerPosition: Vec2 | null = null;
  let previousGoalKey: string | null = null;
  let previousGoalDistance: number | null = null;
  const pickupCooldowns = new Map<string, number>();
  const profile = options.profile ?? "ceiling";
  const patrolStrategy = options.patrolStrategy ?? "periodic-v3";
  const coverageTracker = createAutoPilotCoverageTracker();

  return {
    decide(world, config) {
      if (world.state.status === "contractSelect") {
        return {
          input: { ...BASE_INPUT, contractChoicePressed: 0 },
          profile,
          patrolStrategy,
          coverage: null,
          intentMode: "contract",
          intentTargetId: null,
          executedMode: "contract",
          overrideReason: null,
          riskScore: 0,
          minimumTtc: null,
          predictedDamage: 0,
          ...createIdleMotionTelemetry(),
          intentSwitchReason: "initial",
          intentUtility: 0,
          intentPathEta: null,
          intentCommitSeconds: 0,
          aimExpectedDistinctHits: 0,
          mode: "contract",
          targetId: null,
          aimTargetId: null,
        };
      }
      if (world.state.status === "upgradeSelect") {
        const upgradeIndex = chooseUpgradeIndex(world);
        return {
          input: { ...BASE_INPUT, upgradeChoicePressed: upgradeIndex },
          profile,
          patrolStrategy,
          coverage: null,
          intentMode: "upgrade",
          intentTargetId:
            upgradeIndex === null
              ? null
              : world.progression.pendingUpgradeChoices[upgradeIndex] ?? null,
          executedMode: "upgrade",
          overrideReason: null,
          riskScore: 0,
          minimumTtc: null,
          predictedDamage: 0,
          ...createIdleMotionTelemetry(),
          intentSwitchReason: "initial",
          intentUtility: 0,
          intentPathEta: null,
          intentCommitSeconds: 0,
          aimExpectedDistinctHits: 0,
          mode: "upgrade",
          targetId:
            upgradeIndex === null
              ? null
              : world.progression.pendingUpgradeChoices[upgradeIndex] ?? null,
          aimTargetId: null,
        };
      }
      if (world.state.status !== "playing") {
        return {
          input: { ...BASE_INPUT },
          profile,
          patrolStrategy,
          coverage: null,
          intentMode: "patrol",
          intentTargetId: null,
          executedMode: "patrol",
          overrideReason: null,
          riskScore: 0,
          minimumTtc: null,
          predictedDamage: 0,
          ...createIdleMotionTelemetry(),
          intentSwitchReason: "initial",
          intentUtility: 0,
          intentPathEta: null,
          intentCommitSeconds: 0,
          aimExpectedDistinctHits: 0,
          mode: "patrol",
          targetId: null,
          aimTargetId: null,
        };
      }

      const actualDisplacementPx = previousPlayerPosition
        ? Math.hypot(
            world.player.position.x - previousPlayerPosition.x,
            world.player.position.y - previousPlayerPosition.y,
          )
        : 0;
      previousPlayerPosition = { ...world.player.position };
      commitment = refreshCommitmentProgress(
        commitment,
        world,
        config,
        previousMove,
        previousAimTargetId,
        services.navigation,
      );
      prunePickupCooldowns(pickupCooldowns, world.state.elapsed);
      let commitmentReleaseReason: "targetStalled" | null = null;
      let releasedStallAgeSeconds = 0;
      if (isStalledPickupCommitment(commitment, world.state.elapsed)) {
        releasedStallAgeSeconds = world.state.elapsed - commitment.lastProgressAt;
        pickupCooldowns.set(
          commitment.targetId,
          world.state.elapsed + STALLED_PICKUP_COOLDOWN_SECONDS,
        );
        commitment = null;
        commitmentReleaseReason = "targetStalled";
      }
      const pickupSelection = createEmptyPickupSelection();
      const totalStartedAt = options.onPhaseTiming ? performance.now() : 0;
      const baseFrame = {
        world,
        config,
        previousMove,
        previousAimTargetId,
        profile,
        commitment,
        patrolStrategy,
        coverage: null,
        excludedPickupIds: new Set(pickupCooldowns.keys()),
        commitmentReleaseReason,
        recordPickupSelection(
          kind: keyof AutoPilotPickupSelectionSnapshot,
          diagnostics: AutoPilotPickupSelectionDiagnostics,
        ) {
          pickupSelection[kind] = diagnostics;
        },
      };
      const coverage = options.coverageTelemetry || patrolStrategy === "visit-history-v1"
        ? measurePhase(options, "coverage", () =>
            coverageTracker.update(
              baseFrame,
              services.navigation,
              patrolStrategy,
              previousIntentMode,
            )
          )
        : null;
      const frame = { ...baseFrame, coverage };
      const aim = measurePhase(options, "targeting", () =>
        services.targeting.planAim(frame, services.navigation)
      );
      const intent = measurePhase(options, "tactics", () =>
        services.tactics.selectIntent(frame, aim, services.navigation)
      );
      const movement = measurePhase(options, "movement", () =>
        services.motion.planMovement(frame, intent, services.navigation)
      );
      const mode = movement.modeOverride ?? intent.mode;
      const targetId = movement.modeOverride
        ? aim.targetId ?? intent.targetId
        : intent.targetId ?? aim.targetId;
      previousMove = { ...movement.move };
      previousAimTargetId = aim.targetId;
      previousIntentMode = intent.mode;
      commitment = updateCommitment(commitment, intent, world);
      const intentCommitSeconds = commitment && commitment.targetId === intent.targetId
        ? Math.max(0, world.state.elapsed - commitment.startedAt)
        : 0;
      const goalDistancePx = intent.goalPosition
        ? Math.hypot(
            intent.goalPosition.x - world.player.position.x,
            intent.goalPosition.y - world.player.position.y,
          )
        : null;
      const goalKey = getIntentGoalKey(intent);
      const goalProgressPx = goalKey && goalKey === previousGoalKey &&
          goalDistancePx !== null && previousGoalDistance !== null
        ? previousGoalDistance - goalDistancePx
        : null;
      previousGoalKey = goalKey;
      previousGoalDistance = goalDistancePx;
      const waypointDistancePx = intent.nextWaypoint
        ? Math.hypot(
            intent.nextWaypoint.x - world.player.position.x,
            intent.nextWaypoint.y - world.player.position.y,
          )
        : null;
      const stallAgeSeconds = releasedStallAgeSeconds > 0
        ? releasedStallAgeSeconds
        : commitment && isProgressCommitment(commitment.mode)
          ? Math.max(0, world.state.elapsed - commitment.lastProgressAt)
          : 0;

      const decision = createCombatDecision(
        profile,
        patrolStrategy,
        coverage,
        intent.mode,
        intent.targetId,
        mode,
        movement.move,
        aim.aimWorld,
        aim.shootHeld,
        targetId,
        aim.targetId,
        movement.overrideReason,
        movement.riskScore,
        movement.minimumTtc,
        movement.predictedDamage,
        movement.motionDisposition,
        actualDisplacementPx,
        goalDistancePx,
        goalProgressPx,
        intent.nextWaypoint,
        waypointDistancePx,
        movement.selectedVelocity,
        movement.desiredVelocity,
        movement.safeCandidateCount,
        movement.movingSafeCandidateCount,
        movement.selectedRisk,
        movement.minimumCandidateRisk,
        stallAgeSeconds,
        pickupSelection,
        intent.switchReason,
        intent.utility,
        intent.pathEta,
        intentCommitSeconds,
        aim.expectedDistinctHits,
      );
      if (options.onPhaseTiming) {
        options.onPhaseTiming("total", performance.now() - totalStartedAt);
      }
      return decision;
    },
    reset() {
      previousMove = { x: 0, y: 0 };
      previousAimTargetId = null;
      previousIntentMode = null;
      commitment = null;
      previousPlayerPosition = null;
      previousGoalKey = null;
      previousGoalDistance = null;
      pickupCooldowns.clear();
      coverageTracker.reset();
    },
  };
}

function measurePhase<T>(
  options: AutoPilotAgentOptions,
  phase: "coverage" | "targeting" | "tactics" | "movement",
  operation: () => T,
): T {
  if (!options.onPhaseTiming) return operation();
  const startedAt = performance.now();
  const result = operation();
  options.onPhaseTiming(phase, performance.now() - startedAt);
  return result;
}

export function createAutoPilotInput(
  world: WorldState,
  config: SimulationConfig,
): InputSnapshot {
  return createAutoPilotDecision(world, config).input;
}

export function createAutoPilotDecision(
  world: WorldState,
  config: SimulationConfig,
): AutoPilotDecision {
  return createAutoPilotAgent().decide(world, config);
}

function createCombatDecision(
  profile: AutoPilotDecision["profile"],
  patrolStrategy: AutoPilotPatrolStrategy,
  coverage: AutoPilotCoverageSnapshot | null,
  intentMode: AutoPilotDecision["intentMode"],
  intentTargetId: string | null,
  mode: AutoPilotMode,
  move: Vec2,
  aimWorld: Vec2,
  shootHeld: boolean,
  targetId: string | null,
  aimTargetId: string | null,
  overrideReason: AutoPilotDecision["overrideReason"],
  riskScore: number,
  minimumTtc: number | null,
  predictedDamage: number,
  motionDisposition: AutoPilotDecision["motionDisposition"],
  actualDisplacementPx: number,
  goalDistancePx: number | null,
  goalProgressPx: number | null,
  nextWaypoint: Vec2 | null,
  waypointDistancePx: number | null,
  selectedVelocity: Vec2,
  desiredVelocity: Vec2,
  safeCandidateCount: number,
  movingSafeCandidateCount: number,
  selectedRisk: number,
  minimumCandidateRisk: number,
  stallAgeSeconds: number,
  pickupSelection: AutoPilotPickupSelectionSnapshot,
  intentSwitchReason: AutoPilotDecision["intentSwitchReason"],
  intentUtility: number,
  intentPathEta: number | null,
  intentCommitSeconds: number,
  aimExpectedDistinctHits: number,
): AutoPilotDecision {
  return {
    profile,
    patrolStrategy,
    coverage,
    intentMode,
    intentTargetId,
    executedMode: mode,
    overrideReason,
    riskScore,
    minimumTtc,
    predictedDamage,
    motionDisposition,
    actualDisplacementPx,
    goalDistancePx,
    goalProgressPx,
    nextWaypoint: nextWaypoint ? { ...nextWaypoint } : null,
    waypointDistancePx,
    selectedVelocity: { ...selectedVelocity },
    desiredVelocity: { ...desiredVelocity },
    safeCandidateCount,
    movingSafeCandidateCount,
    selectedRisk,
    minimumCandidateRisk,
    stallAgeSeconds,
    pickupSelection,
    intentSwitchReason,
    intentUtility,
    intentPathEta,
    intentCommitSeconds,
    aimExpectedDistinctHits,
    mode,
    targetId,
    aimTargetId,
    input: {
      ...BASE_INPUT,
      move,
      aimWorld,
      shootHeld,
    },
  };
}

function refreshCommitmentProgress(
  commitment: AutoPilotCommitment | null,
  world: WorldState,
  config: SimulationConfig,
  previousMove: Vec2,
  previousAimTargetId: string | null,
  navigation: AutoPilotNavigationPort,
): AutoPilotCommitment | null {
  if (!commitment || !isProgressCommitment(commitment.mode)) return commitment;
  const target = world.pickups.find((pickup) => pickup.id === commitment.targetId);
  if (!target) return commitment;
  const path = navigation.estimatePath(
    {
      world,
      config,
      previousMove,
      previousAimTargetId,
      commitment,
    },
    world.player.position,
    target.position,
    config.player.radius,
  );
  if (!path.reachable || commitment.lastDistance - path.distance < 2) {
    return commitment;
  }
  return {
    ...commitment,
    lastDistance: path.distance,
    lastProgressAt: world.state.elapsed,
  };
}

function updateCommitment(
  previous: AutoPilotCommitment | null,
  intent: AutoPilotIntent,
  world: WorldState,
): AutoPilotCommitment | null {
  if (!intent.targetId || !isCommittedMode(intent.mode)) return null;
  const targetPosition = getIntentTargetPosition(intent, world);
  const distance = intent.progressDistance ?? (
    targetPosition
      ? Math.hypot(
          targetPosition.x - world.player.position.x,
          targetPosition.y - world.player.position.y,
        )
      : Number.POSITIVE_INFINITY
  );
  if (previous && isSameCommitment(previous, intent)) {
    const madeProgress = previous.lastDistance - distance >= 2;
    return {
      ...previous,
      mode: intent.mode,
      utility: intent.utility,
      lastDistance: Math.min(previous.lastDistance, distance),
      lastProgressAt: madeProgress
        ? world.state.elapsed
        : previous.lastProgressAt,
    };
  }
  return {
    mode: intent.mode,
    targetId: intent.targetId,
    startedAt: world.state.elapsed,
    utility: intent.utility,
    lastDistance: distance,
    lastProgressAt: world.state.elapsed,
  };
}

function isCommittedMode(mode: AutoPilotIntent["mode"]): boolean {
  return mode === "healCollect" ||
    mode === "xpCollect" ||
    mode === "engage" ||
    mode === "reposition";
}

function isProgressCommitment(mode: AutoPilotCommitment["mode"]): boolean {
  return mode === "healCollect" || mode === "xpCollect";
}

function isStalledPickupCommitment(
  commitment: AutoPilotCommitment | null,
  elapsed: number,
): commitment is AutoPilotCommitment {
  return Boolean(
    commitment &&
      isProgressCommitment(commitment.mode) &&
      elapsed - commitment.lastProgressAt > AUTO_PILOT_COMMIT_STALL_SECONDS,
  );
}

function prunePickupCooldowns(
  cooldowns: Map<string, number>,
  elapsed: number,
): void {
  for (const [pickupId, expiresAt] of cooldowns) {
    if (expiresAt <= elapsed) cooldowns.delete(pickupId);
  }
}

function getIntentGoalKey(intent: AutoPilotIntent): string | null {
  if (intent.targetId) return `${intent.mode}:${intent.targetId}`;
  if (!intent.goalPosition) return null;
  return `${intent.mode}:${intent.goalPosition.x.toFixed(2)}:${intent.goalPosition.y.toFixed(2)}`;
}

function isSameCommitment(
  commitment: AutoPilotCommitment,
  intent: AutoPilotIntent,
): boolean {
  if (commitment.targetId !== intent.targetId) return false;
  if (commitment.mode === intent.mode) return true;
  return isCombatMode(commitment.mode) && isCombatMode(intent.mode);
}

function isCombatMode(mode: AutoPilotCommitment["mode"]): boolean {
  return mode === "engage" || mode === "reposition";
}

function getIntentTargetPosition(
  intent: AutoPilotIntent,
  world: WorldState,
): Vec2 | null {
  if (intent.goalPosition) return intent.goalPosition;
  if (!intent.targetId) return null;
  return world.enemies.find((enemy) => enemy.id === intent.targetId)?.position ?? null;
}

function chooseUpgradeIndex(world: WorldState): number | null {
  let bestIndex: number | null = null;
  let bestRank = Number.POSITIVE_INFINITY;
  for (const upgradeId of UPGRADE_PRIORITY) {
    const index = world.progression.pendingUpgradeChoices.indexOf(upgradeId);
    if (index < 0) continue;
    const rank = world.progression.upgradeRanks[upgradeId];
    if (rank < bestRank) {
      bestIndex = index;
      bestRank = rank;
    }
  }
  return bestIndex ?? (world.progression.pendingUpgradeChoices.length > 0 ? 0 : null);
}
