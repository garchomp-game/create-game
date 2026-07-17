import type {
  Enemy,
  InputSnapshot,
  Pickup,
  SimulationConfig,
  Vec2,
  WorldState,
} from "../domain/types";

export type AutoPilotPosture = "opportunistic" | "balanced" | "defensive";
export type AutoPilotProfileId = "fair" | "ceiling";
export type AutoPilotPatrolStrategy = "periodic-v3" | "visit-history-v1";
export type AutoPilotPhase = "coverage" | "targeting" | "tactics" | "movement" | "total";
export type AutoPilotCoverageZoneId =
  | "north-west"
  | "north"
  | "north-east"
  | "west"
  | "center"
  | "east"
  | "south-west"
  | "south"
  | "south-east";
export type AutoPilotCoverageTransitionReason =
  | "none"
  | "selected"
  | "reached"
  | "unreachable"
  | "stalled"
  | "arenaChanged"
  | "strategyDisabled";
export type AutoPilotOverrideReason =
  | "projectileCollision"
  | "projectileThreat"
  | "enemyCollision"
  | "enemyThreat";
export type AutoPilotMotionDisposition =
  | "progress"
  | "goalReached"
  | "magnetWait"
  | "safetyDeflection"
  | "safetyStop"
  | "noSafeVelocity"
  | "pathBlocked";
export type AutoPilotPickupRejectionReason =
  | "cooldown"
  | "distance"
  | "pathUnreachable"
  | "ttlExpired"
  | "noEffectiveValue"
  | "pathRisk"
  | "unsafeProximity";
export type AutoPilotPickupSelectionDiagnostics = {
  kind: Pickup["kind"] | null;
  pickupSourceCount: number;
  withinSearchDistanceCount: number;
  prefilteredCount: number;
  pathEvaluatedCount: number;
  reachableCount: number;
  ttlValidCount: number;
  safeCount: number;
  selectedPickupId: string | null;
  selectedCorridorPickupCount: number;
  selectedCorridorXpValue: number;
  rejectedByReason: Record<AutoPilotPickupRejectionReason, number>;
};
export type AutoPilotPickupSelectionSnapshot = Record<
  Pickup["kind"],
  AutoPilotPickupSelectionDiagnostics | null
>;
export type AutoPilotIntentSwitchReason =
  | "initial"
  | "sameTarget"
  | "minimumCommit"
  | "hysteresis"
  | "betterUtility"
  | "targetUnavailable"
  | "targetStalled"
  | "emergency"
  | "phaseTransition";

export type AutoPilotMode =
  | "contract"
  | "upgrade"
  | "projectileDodge"
  | "enemyEvade"
  | "healCollect"
  | "xpCollect"
  | "reposition"
  | "engage"
  | "survive"
  | "patrol";

export type AutoPilotDecision = {
  input: InputSnapshot;
  profile: AutoPilotProfileId;
  patrolStrategy: AutoPilotPatrolStrategy;
  coverage: AutoPilotCoverageSnapshot | null;
  intentMode: AutoPilotMode;
  intentTargetId: string | null;
  executedMode: AutoPilotMode;
  overrideReason: AutoPilotOverrideReason | null;
  riskScore: number;
  minimumTtc: number | null;
  predictedDamage: number;
  motionDisposition: AutoPilotMotionDisposition;
  actualDisplacementPx: number;
  goalDistancePx: number | null;
  goalProgressPx: number | null;
  nextWaypoint: Vec2 | null;
  waypointDistancePx: number | null;
  selectedVelocity: Vec2;
  desiredVelocity: Vec2;
  safeCandidateCount: number;
  movingSafeCandidateCount: number;
  selectedRisk: number;
  minimumCandidateRisk: number;
  stallAgeSeconds: number;
  pickupSelection: AutoPilotPickupSelectionSnapshot;
  intentSwitchReason: AutoPilotIntentSwitchReason;
  intentUtility: number;
  intentPathEta: number | null;
  intentCommitSeconds: number;
  aimExpectedDistinctHits: number;
  /** Compatibility alias for executedMode. */
  mode: AutoPilotMode;
  targetId: string | null;
  aimTargetId: string | null;
};

export type AutoPilotFrame = {
  world: WorldState;
  config: SimulationConfig;
  previousMove: Vec2;
  previousAimTargetId: string | null;
  profile?: AutoPilotProfileId;
  commitment?: AutoPilotCommitment | null;
  patrolStrategy?: AutoPilotPatrolStrategy;
  coverage?: AutoPilotCoverageSnapshot | null;
  excludedPickupIds?: ReadonlySet<string>;
  commitmentReleaseReason?: "targetStalled" | null;
  recordPickupSelection?: (
    kind: Pickup["kind"],
    diagnostics: AutoPilotPickupSelectionDiagnostics,
  ) => void;
};

export type AutoPilotCoverageSnapshot = {
  strategy: AutoPilotPatrolStrategy;
  clock: number;
  targetZoneId: AutoPilotCoverageZoneId | null;
  targetPosition: Vec2 | null;
  targetEta: number | null;
  targetXpPickupCount: number;
  transitionReason: AutoPilotCoverageTransitionReason;
  reachableZoneIds: AutoPilotCoverageZoneId[];
  visitedZoneIds30Seconds: AutoPilotCoverageZoneId[];
  visitedZoneIds120Seconds: AutoPilotCoverageZoneId[];
  oldestZoneAgeSeconds: number;
};

export type AutoPilotEnemyTarget = {
  enemy: Enemy;
  distance: number;
  visible: boolean;
  inRange: boolean;
};

export type AutoPilotAimPlan = {
  target: AutoPilotEnemyTarget | null;
  targetId: string | null;
  aimWorld: Vec2;
  shootHeld: boolean;
  expectedDistinctHits: number;
};

export type AutoPilotIntentMode = Extract<
  AutoPilotMode,
  "healCollect" | "xpCollect" | "reposition" | "engage" | "survive" | "patrol"
>;

export type AutoPilotIntent = {
  mode: AutoPilotIntentMode;
  posture: AutoPilotPosture;
  targetId: string | null;
  goalPosition: Vec2 | null;
  combatTarget: Enemy | null;
  desiredDirection: Vec2;
  nextWaypoint: Vec2 | null;
  preferredRange: number | null;
  goalWeight: number;
  preserveLineOfSight: boolean;
  utility: number;
  pathEta: number | null;
  progressDistance: number | null;
  switchReason: AutoPilotIntentSwitchReason;
};

export type AutoPilotCommitment = {
  mode: AutoPilotIntentMode;
  targetId: string;
  startedAt: number;
  utility: number;
  lastDistance: number;
  lastProgressAt: number;
};

export type AutoPilotMovementPlan = {
  move: Vec2;
  modeOverride: "projectileDodge" | "enemyEvade" | null;
  overrideReason: AutoPilotOverrideReason | null;
  riskScore: number;
  minimumTtc: number | null;
  predictedDamage: number;
  motionDisposition: AutoPilotMotionDisposition;
  selectedVelocity: Vec2;
  desiredVelocity: Vec2;
  safeCandidateCount: number;
  movingSafeCandidateCount: number;
  selectedRisk: number;
  minimumCandidateRisk: number;
  minimumProjectileClearance: number;
  minimumEnemyClearance: number;
  openSpaceClearance: number;
};

export type AutoPilotPathEstimate = {
  reachable: boolean;
  direct: boolean;
  distance: number;
  waypoints: Vec2[];
};

export type AutoPilotNavigationPort = {
  hasClearPath(
    frame: AutoPilotFrame,
    start: Vec2,
    end: Vec2,
    clearance: number,
  ): boolean;
  navigateTo(frame: AutoPilotFrame, target: Vec2): Vec2;
  navigateFrom(
    frame: AutoPilotFrame,
    start: Vec2,
    target: Vec2,
    radius: number,
  ): Vec2;
  estimatePath(
    frame: AutoPilotFrame,
    start: Vec2,
    target: Vec2,
    radius: number,
  ): AutoPilotPathEstimate;
};

export type AutoPilotTargetingPolicy = {
  planAim(frame: AutoPilotFrame, navigation: AutoPilotNavigationPort): AutoPilotAimPlan;
};

export type AutoPilotTacticalPolicy = {
  selectIntent(
    frame: AutoPilotFrame,
    aim: AutoPilotAimPlan,
    navigation: AutoPilotNavigationPort,
  ): AutoPilotIntent;
};

export type AutoPilotMotionPlanner = {
  planMovement(
    frame: AutoPilotFrame,
    intent: AutoPilotIntent,
    navigation: AutoPilotNavigationPort,
  ): AutoPilotMovementPlan;
};

export type AutoPilotServices = {
  navigation: AutoPilotNavigationPort;
  targeting: AutoPilotTargetingPolicy;
  tactics: AutoPilotTacticalPolicy;
  motion: AutoPilotMotionPlanner;
};

export type AutoPilotAgent = {
  decide(world: WorldState, config: SimulationConfig): AutoPilotDecision;
  reset(): void;
};

export type AutoPilotAgentOptions = {
  profile?: AutoPilotProfileId;
  patrolStrategy?: AutoPilotPatrolStrategy;
  coverageTelemetry?: boolean;
  onPhaseTiming?: (phase: AutoPilotPhase, durationMs: number) => void;
};
