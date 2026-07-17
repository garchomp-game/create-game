import type {
  DamageTakenBySource,
  SimulationConfig,
  WeaponTypeId,
  WorldState,
} from "../domain/types";
import { createRandomStreams } from "../math/random";
import { createAutoPilotAgent, type AutoPilotMode } from "./autoPilot";
import type {
  AutoPilotCoverageTransitionReason,
  AutoPilotDecision,
  AutoPilotIntentSwitchReason,
  AutoPilotMotionDisposition,
  AutoPilotOverrideReason,
  AutoPilotPhase,
  AutoPilotPatrolStrategy,
  AutoPilotPickupRejectionReason,
  AutoPilotProfileId,
} from "./autoPilotContracts";
import {
  AUTO_PILOT_FIELD_XP_LIMIT,
  getFieldXpPickupCount,
} from "./autoPilotPolicy";
import { createWorld } from "./createWorld";
import { stepWorld } from "./stepWorld";

export type AutoPilotProbeOptions = {
  config: SimulationConfig;
  seeds: readonly number[];
  durationSeconds: number;
  frameRate?: number;
  weaponTypes?: readonly WeaponTypeId[];
  profile?: AutoPilotProfileId;
  patrolStrategy?: AutoPilotPatrolStrategy;
  measurePerformance?: boolean;
};

type AutoPilotCoverageProbeRun = {
  patrolStrategy: AutoPilotPatrolStrategy;
  coverageFrames: number;
  averageReachableCoverageZones: number;
  averageCoverageVisitRatio30Seconds: number;
  averageCoverageVisitRatio120Seconds: number;
  maximumOldestCoverageZoneAgeSeconds: number;
  coverageTargetTransitions: Record<AutoPilotCoverageTransitionReason, number>;
  patrolIntentFrames: number;
  longestPatrolIntentSeconds: number;
  activePatrolIntentFrames: number;
  warningPatrolIntentFrames: number;
  coveragePatrolOverrideFrames: number;
  densitySweepPatrolFrames: number;
  stationaryPatrolIntentFrames: number;
  stationaryPatrolWithoutOverrideFrames: number;
  longestStationaryPatrolSeconds: number;
};

type AutoPilotMotionProbeRun = {
  motionDispositionFrames: Record<AutoPilotMotionDisposition, number>;
  xpProgressStallFrames: number;
  unclassifiedXpStallFrames: number;
  longestUnclassifiedXpStallSeconds: number;
  safetyStopWithMovingCandidateFrames: number;
  averageXpPickupSourceCount: number;
  averageXpWithinSearchDistanceCount: number;
  averageXpPrefilteredCount: number;
  averageXpPathEvaluatedCount: number;
  averageXpSafeCandidateCount: number;
  averageXpSelectedCorridorPickupCount: number;
  averageXpSelectedCorridorValue: number;
  xpNoSafeCandidateFrames: number;
  xpPotentialCandidateMissFrames: number;
  xpRejectedByReason: Record<AutoPilotPickupRejectionReason, number>;
};

export type AutoPilotProbeRun = AutoPilotCoverageProbeRun & AutoPilotMotionProbeRun & {
  seed: number;
  weaponType: WeaponTypeId;
  profile: AutoPilotProfileId;
  survivedSeconds: number;
  score: number;
  kills: number;
  killsPerMinute: number;
  xpCollected: number;
  pickupsCollected: number;
  hitsTaken: number;
  damageTakenBySource: DamageTakenBySource;
  hpRecovered: number;
  effectiveHealPickupsCollected: number;
  projectileHitRate: number;
  targetSwitches: number;
  intentTargetSwitches: number;
  voluntaryIntentSwitches: number;
  intentSwitchesPerMinute: number;
  intentSwitchReasons: Record<AutoPilotIntentSwitchReason, number>;
  voluntaryIntentTransitions: Record<string, number>;
  averageRiskScore: number;
  maximumRiskScore: number;
  minimumTtc: number | null;
  averageIntentUtility: number;
  averagePickupEta: number | null;
  averageAimExpectedDistinctHits: number;
  averageFieldXpPickups: number;
  maximumFieldXpPickups: number;
  fieldXpExcessFrames: number;
  maximumNonActiveFieldXpPickups: number;
  nonActiveFieldXpExcessFrames: number;
  nonActiveFrames: number;
  warningFrames: number;
  warningXpIntentFrames: number;
  activeFrames: number;
  activeXpIntentFrames: number;
  activeCombatIntentFrames: number;
  stationaryXpIntentFrames: number;
  stationaryXpWithoutOverrideFrames: number;
  longestStationaryXpSeconds: number;
  pickupIntentFrames: number;
  pickupOverrideFrames: number;
  committedPickupCollections: number;
  recklessPickupCollections: number;
  wastedHealPickups: number;
  unavoidableWastedHealPickups: number;
  avoidableWastedHealPickups: number;
  healEfficiency: number;
  phaseTimingP95Ms: Record<AutoPilotPhase, number> | null;
  pulseFocusEnhancedHits: number;
  pulseFocusBonusDamage: number;
  pulseFocusTargetEnhancedHits: number;
  pulseFocusLineEnhancedHits: number;
  pulseFocusTargetBonusDamage: number;
  pulseFocusLineBonusDamage: number;
  pulseRicochetFollowUpHits: number;
  spreadSweepTriggers: number;
  upgradeRanks: string;
  modeFrames: Record<AutoPilotMode, number>;
  intentModeFrames: Record<AutoPilotMode, number>;
  overrideFrames: Record<AutoPilotOverrideReason, number>;
};

export function runAutoPilotProbe(
  options: AutoPilotProbeOptions,
): AutoPilotProbeRun[] {
  const frameRate = options.frameRate ?? 30;
  const weaponTypes = options.weaponTypes ?? ["pulse", "spread"];
  const maximumFrames = Math.ceil(options.durationSeconds * frameRate);
  const profile = options.profile ?? "ceiling";
  const patrolStrategy = options.patrolStrategy ?? "periodic-v3";
  const runs: AutoPilotProbeRun[] = [];

  for (const seed of options.seeds) {
    for (const weaponType of weaponTypes) {
      const config = { ...options.config, seed };
      const world = createWorld(config);
      world.state.weaponType = weaponType;
      const random = createRandomStreams(seed);
      const modeFrames = createModeCounts();
      const intentModeFrames = createModeCounts();
      const overrideFrames = createOverrideCounts();
      const intentSwitchReasons = createIntentSwitchReasonCounts();
      const phaseTimingSamples = createPhaseTimingSamples();
      const coverageAccumulator = createCoverageAccumulator(patrolStrategy);
      const motionDispositionFrames = createMotionDispositionCounts();
      const xpRejectedByReason = createPickupRejectionCounts();
      const progressWindow: Array<{
        elapsed: number;
        targetId: string | null;
        x: number;
        y: number;
        goalDistance: number | null;
      }> = [];
      const agent = createAutoPilotAgent(
        undefined,
        {
          profile,
          patrolStrategy,
          coverageTelemetry: true,
          ...(options.measurePerformance
            ? {
                onPhaseTiming(phase: AutoPilotPhase, durationMs: number) {
                  phaseTimingSamples[phase].push(durationMs);
                },
              }
            : {}),
        },
      );
      let previousTargetId: string | null = null;
      let previousIntentTargetId: string | null = null;
      let previousIntentMode: AutoPilotMode | null = null;
      let targetSwitches = 0;
      let intentTargetSwitches = 0;
      let voluntaryIntentSwitches = 0;
      const voluntaryIntentTransitions: Record<string, number> = {};
      let riskTotal = 0;
      let maximumRiskScore = 0;
      let minimumTtc = Number.POSITIVE_INFINITY;
      let intentUtilityTotal = 0;
      let pickupEtaTotal = 0;
      let pickupEtaFrames = 0;
      let aimExpectedDistinctHitsTotal = 0;
      let shootingFrames = 0;
      let fieldXpPickupTotal = 0;
      let maximumFieldXpPickups = 0;
      let fieldXpExcessFrames = 0;
      let maximumNonActiveFieldXpPickups = 0;
      let nonActiveFieldXpExcessFrames = 0;
      let nonActiveFrames = 0;
      let warningFrames = 0;
      let warningXpIntentFrames = 0;
      let activeFrames = 0;
      let activeXpIntentFrames = 0;
      let activeCombatIntentFrames = 0;
      let stationaryXpIntentFrames = 0;
      let stationaryXpWithoutOverrideFrames = 0;
      let consecutiveStationaryXpFrames = 0;
      let longestStationaryXpFrames = 0;
      let pickupIntentFrames = 0;
      let pickupOverrideFrames = 0;
      let activePickupTargetId: string | null = null;
      let activePickupDamaged = false;
      let committedPickupCollections = 0;
      let recklessPickupCollections = 0;
      let wastedHealPickups = 0;
      let unavoidableWastedHealPickups = 0;
      let avoidableWastedHealPickups = 0;
      let healValueCollected = 0;
      const healSpawnDistances = new Map<string, number>();
      const recentPickupWindows: Array<{ expiresAt: number; damaged: boolean }> = [];
      let decisionFrames = 0;
      let xpProgressStallFrames = 0;
      let unclassifiedXpStallFrames = 0;
      let consecutiveUnclassifiedXpStallFrames = 0;
      let longestUnclassifiedXpStallFrames = 0;
      let safetyStopWithMovingCandidateFrames = 0;
      let xpSelectionFrames = 0;
      let xpPickupSourceTotal = 0;
      let xpWithinSearchDistanceTotal = 0;
      let xpPrefilteredTotal = 0;
      let xpPathEvaluatedTotal = 0;
      let xpSafeCandidateTotal = 0;
      let xpSelectedCorridorPickupTotal = 0;
      let xpSelectedCorridorValueTotal = 0;
      let xpNoSafeCandidateFrames = 0;
      let xpPotentialCandidateMissFrames = 0;

      for (
        let frame = 0;
        frame < maximumFrames && world.state.status !== "gameOver";
        frame += 1
      ) {
        for (let index = recentPickupWindows.length - 1; index >= 0; index -= 1) {
          const window = recentPickupWindows[index]!;
          if (window.expiresAt > world.state.elapsed) continue;
          if (window.damaged) recklessPickupCollections += 1;
          recentPickupWindows.splice(index, 1);
        }
        const decision = agent.decide(world, config);
        const fieldXpPickups = getFieldXpPickupCount(world);
        fieldXpPickupTotal += fieldXpPickups;
        maximumFieldXpPickups = Math.max(maximumFieldXpPickups, fieldXpPickups);
        if (fieldXpPickups > AUTO_PILOT_FIELD_XP_LIMIT) {
          fieldXpExcessFrames += 1;
        }
        const encounterPhase = world.encounter.director.phase;
        if (encounterPhase !== "active") {
          nonActiveFrames += 1;
          maximumNonActiveFieldXpPickups = Math.max(
            maximumNonActiveFieldXpPickups,
            fieldXpPickups,
          );
          if (fieldXpPickups > AUTO_PILOT_FIELD_XP_LIMIT) {
            nonActiveFieldXpExcessFrames += 1;
          }
        }
        if (encounterPhase === "warning") {
          warningFrames += 1;
          if (decision.intentMode === "xpCollect") warningXpIntentFrames += 1;
        } else if (encounterPhase === "active") {
          activeFrames += 1;
          if (decision.intentMode === "xpCollect") activeXpIntentFrames += 1;
          if (
            decision.intentMode === "engage" ||
            decision.intentMode === "reposition"
          ) activeCombatIntentFrames += 1;
        }
        const stationary = Math.hypot(
          decision.input.move.x,
          decision.input.move.y,
        ) < 0.001;
        motionDispositionFrames[decision.motionDisposition] += 1;
        if (
          decision.intentMode === "xpCollect" &&
          decision.motionDisposition === "safetyStop" &&
          decision.movingSafeCandidateCount > 0
        ) safetyStopWithMovingCandidateFrames += 1;
        progressWindow.push({
          elapsed: world.state.elapsed,
          targetId: decision.intentTargetId,
          x: world.player.position.x,
          y: world.player.position.y,
          goalDistance: decision.goalDistancePx,
        });
        while (
          progressWindow.length > 0 &&
          world.state.elapsed - progressWindow[0]!.elapsed > 0.5
        ) progressWindow.shift();
        const progressStart = progressWindow.find((sample) =>
          sample.targetId === decision.intentTargetId &&
          sample.goalDistance !== null &&
          world.state.elapsed - sample.elapsed >= 0.25
        );
        const xpProgressStalled = decision.intentMode === "xpCollect" &&
          decision.goalDistancePx !== null &&
          progressStart?.goalDistance !== null &&
          progressStart !== undefined &&
          Math.hypot(
            world.player.position.x - progressStart.x,
            world.player.position.y - progressStart.y,
          ) < 2 &&
          progressStart.goalDistance - decision.goalDistancePx < 2;
        if (xpProgressStalled) {
          xpProgressStallFrames += 1;
          const classified = decision.motionDisposition !== "progress";
          if (!classified) {
            unclassifiedXpStallFrames += 1;
            consecutiveUnclassifiedXpStallFrames += 1;
            longestUnclassifiedXpStallFrames = Math.max(
              longestUnclassifiedXpStallFrames,
              consecutiveUnclassifiedXpStallFrames,
            );
          } else {
            consecutiveUnclassifiedXpStallFrames = 0;
          }
        } else {
          consecutiveUnclassifiedXpStallFrames = 0;
        }
        const xpSelection = decision.pickupSelection.xp;
        if (xpSelection) {
          xpSelectionFrames += 1;
          xpPickupSourceTotal += xpSelection.pickupSourceCount;
          xpWithinSearchDistanceTotal += xpSelection.withinSearchDistanceCount;
          xpPrefilteredTotal += xpSelection.prefilteredCount;
          xpPathEvaluatedTotal += xpSelection.pathEvaluatedCount;
          xpSafeCandidateTotal += xpSelection.safeCount;
          xpSelectedCorridorPickupTotal +=
            xpSelection.selectedCorridorPickupCount;
          xpSelectedCorridorValueTotal += xpSelection.selectedCorridorXpValue;
          if (xpSelection.pickupSourceCount > 0 && xpSelection.safeCount === 0) {
            xpNoSafeCandidateFrames += 1;
            if (xpSelection.prefilteredCount < xpSelection.withinSearchDistanceCount) {
              xpPotentialCandidateMissFrames += 1;
            }
          }
          for (const reason of Object.keys(
            xpSelection.rejectedByReason,
          ) as AutoPilotPickupRejectionReason[]) {
            xpRejectedByReason[reason] += xpSelection.rejectedByReason[reason];
          }
        }
        recordCoverageDecision(
          coverageAccumulator,
          decision,
          encounterPhase,
          stationary,
          fieldXpPickups,
        );
        if (decision.intentMode === "xpCollect" && stationary) {
          stationaryXpIntentFrames += 1;
          consecutiveStationaryXpFrames += 1;
          longestStationaryXpFrames = Math.max(
            longestStationaryXpFrames,
            consecutiveStationaryXpFrames,
          );
          if (!decision.overrideReason) stationaryXpWithoutOverrideFrames += 1;
        } else {
          consecutiveStationaryXpFrames = 0;
        }
        modeFrames[decision.executedMode] += 1;
        intentModeFrames[decision.intentMode] += 1;
        intentSwitchReasons[decision.intentSwitchReason] += 1;
        if (
          decision.intentSwitchReason === "betterUtility" ||
          decision.intentSwitchReason === "emergency"
        ) {
          voluntaryIntentSwitches += 1;
          const transition = `${previousIntentMode ?? "none"}->${decision.intentMode}`;
          voluntaryIntentTransitions[transition] =
            (voluntaryIntentTransitions[transition] ?? 0) + 1;
        }
        if (decision.overrideReason) overrideFrames[decision.overrideReason] += 1;
        riskTotal += decision.riskScore;
        intentUtilityTotal += decision.intentUtility;
        maximumRiskScore = Math.max(maximumRiskScore, decision.riskScore);
        if (decision.minimumTtc !== null) {
          minimumTtc = Math.min(minimumTtc, decision.minimumTtc);
        }
        if (decision.input.shootHeld) {
          aimExpectedDistinctHitsTotal += decision.aimExpectedDistinctHits;
          shootingFrames += 1;
        }
        const pickupIntent =
          decision.intentMode === "healCollect" || decision.intentMode === "xpCollect";
        if (pickupIntent) {
          pickupIntentFrames += 1;
          if (decision.overrideReason) pickupOverrideFrames += 1;
          if (decision.intentPathEta !== null) {
            pickupEtaTotal += decision.intentPathEta;
            pickupEtaFrames += 1;
          }
          if (activePickupTargetId !== decision.intentTargetId) {
            activePickupTargetId = decision.intentTargetId;
            activePickupDamaged = false;
          }
        } else {
          activePickupTargetId = null;
          activePickupDamaged = false;
        }
        decisionFrames += 1;
        if (
          decision.aimTargetId !== null &&
          previousTargetId !== null &&
          decision.aimTargetId !== previousTargetId
        ) targetSwitches += 1;
        if (decision.aimTargetId !== null) previousTargetId = decision.aimTargetId;
        if (
          decision.intentTargetId !== null &&
          previousIntentTargetId !== null &&
          decision.intentTargetId !== previousIntentTargetId
        ) intentTargetSwitches += 1;
        if (decision.intentTargetId !== null) {
          previousIntentTargetId = decision.intentTargetId;
        }
        previousIntentMode = decision.intentMode;
        const result = stepWorld(world, decision.input, 1 / frameRate, random, config);
        if (result.events.some((event) => event.type === "player.damaged")) {
          activePickupDamaged = activePickupTargetId !== null || activePickupDamaged;
          for (const window of recentPickupWindows) window.damaged = true;
        }
        for (const event of result.events) {
          if (event.type === "pickup.spawned" && event.pickupKind === "heal") {
            healSpawnDistances.set(
              event.pickupId,
              Math.hypot(
                event.position.x - world.player.position.x,
                event.position.y - world.player.position.y,
              ),
            );
            continue;
          }
          if (event.type === "pickup.expired") {
            healSpawnDistances.delete(event.pickupId);
            continue;
          }
          if (event.type !== "pickup.collected") continue;
          if (event.pickupKind === "heal") {
            healValueCollected += event.healValue;
            if (event.hpRecovered <= 0) {
              wastedHealPickups += 1;
              const unavoidableSpawnDistance = Math.max(
                config.player.radius + config.pickup.healRadius,
                config.pickup.magnetRadius,
              );
              if (
                (healSpawnDistances.get(event.pickupId) ?? Number.POSITIVE_INFINITY) <=
                  unavoidableSpawnDistance
              ) unavoidableWastedHealPickups += 1;
              else avoidableWastedHealPickups += 1;
            }
            healSpawnDistances.delete(event.pickupId);
          }
          if (event.pickupId !== activePickupTargetId) continue;
          committedPickupCollections += 1;
          recentPickupWindows.push({
            expiresAt: world.state.elapsed + 1,
            damaged: activePickupDamaged,
          });
          activePickupTargetId = null;
          activePickupDamaged = false;
        }
      }

      recklessPickupCollections += recentPickupWindows.filter(
        (window) => window.damaged,
      ).length;

      runs.push(createProbeRun(
        world,
        seed,
        weaponType,
        profile,
        modeFrames,
        intentModeFrames,
        overrideFrames,
        targetSwitches,
        intentTargetSwitches,
        voluntaryIntentSwitches,
        intentSwitchReasons,
        voluntaryIntentTransitions,
        riskTotal / Math.max(1, decisionFrames),
        maximumRiskScore,
        Number.isFinite(minimumTtc) ? minimumTtc : null,
        intentUtilityTotal / Math.max(1, decisionFrames),
        pickupEtaFrames > 0 ? pickupEtaTotal / pickupEtaFrames : null,
        aimExpectedDistinctHitsTotal / Math.max(1, shootingFrames),
        fieldXpPickupTotal / Math.max(1, decisionFrames),
        maximumFieldXpPickups,
        fieldXpExcessFrames,
        maximumNonActiveFieldXpPickups,
        nonActiveFieldXpExcessFrames,
        nonActiveFrames,
        warningFrames,
        warningXpIntentFrames,
        activeFrames,
        activeXpIntentFrames,
        activeCombatIntentFrames,
        stationaryXpIntentFrames,
        stationaryXpWithoutOverrideFrames,
        longestStationaryXpFrames / frameRate,
        pickupIntentFrames,
        pickupOverrideFrames,
        committedPickupCollections,
        recklessPickupCollections,
        wastedHealPickups,
        unavoidableWastedHealPickups,
        avoidableWastedHealPickups,
        healValueCollected,
        options.measurePerformance ? summarizePhaseTimings(phaseTimingSamples) : null,
        summarizeCoverageAccumulator(coverageAccumulator, frameRate),
        {
          motionDispositionFrames,
          xpProgressStallFrames,
          unclassifiedXpStallFrames,
          longestUnclassifiedXpStallSeconds:
            longestUnclassifiedXpStallFrames / frameRate,
          safetyStopWithMovingCandidateFrames,
          averageXpPickupSourceCount:
            xpPickupSourceTotal / Math.max(1, xpSelectionFrames),
          averageXpWithinSearchDistanceCount:
            xpWithinSearchDistanceTotal / Math.max(1, xpSelectionFrames),
          averageXpPrefilteredCount:
            xpPrefilteredTotal / Math.max(1, xpSelectionFrames),
          averageXpPathEvaluatedCount:
            xpPathEvaluatedTotal / Math.max(1, xpSelectionFrames),
          averageXpSafeCandidateCount:
            xpSafeCandidateTotal / Math.max(1, xpSelectionFrames),
          averageXpSelectedCorridorPickupCount:
            xpSelectedCorridorPickupTotal / Math.max(1, xpSelectionFrames),
          averageXpSelectedCorridorValue:
            xpSelectedCorridorValueTotal / Math.max(1, xpSelectionFrames),
          xpNoSafeCandidateFrames,
          xpPotentialCandidateMissFrames,
          xpRejectedByReason,
        },
      ));
    }
  }

  return runs;
}

function createProbeRun(
  world: WorldState,
  seed: number,
  weaponType: WeaponTypeId,
  profile: AutoPilotProfileId,
  modeFrames: Record<AutoPilotMode, number>,
  intentModeFrames: Record<AutoPilotMode, number>,
  overrideFrames: Record<AutoPilotOverrideReason, number>,
  targetSwitches: number,
  intentTargetSwitches: number,
  voluntaryIntentSwitches: number,
  intentSwitchReasons: Record<AutoPilotIntentSwitchReason, number>,
  voluntaryIntentTransitions: Record<string, number>,
  averageRiskScore: number,
  maximumRiskScore: number,
  minimumTtc: number | null,
  averageIntentUtility: number,
  averagePickupEta: number | null,
  averageAimExpectedDistinctHits: number,
  averageFieldXpPickups: number,
  maximumFieldXpPickups: number,
  fieldXpExcessFrames: number,
  maximumNonActiveFieldXpPickups: number,
  nonActiveFieldXpExcessFrames: number,
  nonActiveFrames: number,
  warningFrames: number,
  warningXpIntentFrames: number,
  activeFrames: number,
  activeXpIntentFrames: number,
  activeCombatIntentFrames: number,
  stationaryXpIntentFrames: number,
  stationaryXpWithoutOverrideFrames: number,
  longestStationaryXpSeconds: number,
  pickupIntentFrames: number,
  pickupOverrideFrames: number,
  committedPickupCollections: number,
  recklessPickupCollections: number,
  wastedHealPickups: number,
  unavoidableWastedHealPickups: number,
  avoidableWastedHealPickups: number,
  healValueCollected: number,
  phaseTimingP95Ms: Record<AutoPilotPhase, number> | null,
  coverage: AutoPilotCoverageProbeRun,
  motion: AutoPilotMotionProbeRun,
): AutoPilotProbeRun {
  const weaponMetrics = world.stats.weaponMetrics[weaponType];
  return {
    seed,
    weaponType,
    profile,
    ...coverage,
    ...motion,
    survivedSeconds: world.state.elapsed,
    score: world.state.score,
    kills: world.stats.enemiesKilled,
    killsPerMinute:
      world.stats.enemiesKilled / Math.max(1 / 60, world.state.elapsed / 60),
    xpCollected: world.stats.xpCollected,
    pickupsCollected: world.stats.pickupsCollected,
    hitsTaken: world.stats.hitsTaken,
    damageTakenBySource: { ...world.stats.damageTakenBySource },
    hpRecovered: world.stats.hpRecovered,
    effectiveHealPickupsCollected: world.stats.effectiveHealPickupsCollected,
    projectileHitRate:
      weaponMetrics.projectilesFired > 0
        ? weaponMetrics.hits / weaponMetrics.projectilesFired
        : 0,
    targetSwitches,
    intentTargetSwitches,
    voluntaryIntentSwitches,
    intentSwitchesPerMinute:
      voluntaryIntentSwitches / Math.max(1 / 60, world.state.elapsed / 60),
    intentSwitchReasons: { ...intentSwitchReasons },
    voluntaryIntentTransitions: { ...voluntaryIntentTransitions },
    averageRiskScore,
    maximumRiskScore,
    minimumTtc,
    averageIntentUtility,
    averagePickupEta,
    averageAimExpectedDistinctHits,
    averageFieldXpPickups,
    maximumFieldXpPickups,
    fieldXpExcessFrames,
    maximumNonActiveFieldXpPickups,
    nonActiveFieldXpExcessFrames,
    nonActiveFrames,
    warningFrames,
    warningXpIntentFrames,
    activeFrames,
    activeXpIntentFrames,
    activeCombatIntentFrames,
    stationaryXpIntentFrames,
    stationaryXpWithoutOverrideFrames,
    longestStationaryXpSeconds,
    pickupIntentFrames,
    pickupOverrideFrames,
    committedPickupCollections,
    recklessPickupCollections,
    wastedHealPickups,
    unavoidableWastedHealPickups,
    avoidableWastedHealPickups,
    healEfficiency:
      healValueCollected > 0 ? world.stats.hpRecovered / healValueCollected : 1,
    phaseTimingP95Ms,
    pulseFocusEnhancedHits: world.stats.weaponIdentityMetrics.pulseFocus.enhancedHits,
    pulseFocusBonusDamage: world.stats.weaponIdentityMetrics.pulseFocus.bonusDamage,
    pulseFocusTargetEnhancedHits:
      world.stats.weaponIdentityMetrics.pulseFocus.targetEnhancedHits,
    pulseFocusLineEnhancedHits:
      world.stats.weaponIdentityMetrics.pulseFocus.lineEnhancedHits,
    pulseFocusTargetBonusDamage:
      world.stats.weaponIdentityMetrics.pulseFocus.targetBonusDamage,
    pulseFocusLineBonusDamage:
      world.stats.weaponIdentityMetrics.pulseFocus.lineBonusDamage,
    pulseRicochetFollowUpHits: world.stats.capstoneMetrics.followUpHits,
    spreadSweepTriggers: world.stats.weaponIdentityMetrics.spreadSweep.triggers,
    upgradeRanks: [
      `rf${world.progression.upgradeRanks.rapidFire}`,
      `mv${world.progression.upgradeRanks.swiftStep}`,
      `od${world.progression.upgradeRanks.overdriveRounds}`,
      `hp${world.progression.upgradeRanks.vitalCore}`,
      `pc${world.progression.upgradeRanks.piercingRounds}`,
      `pf${world.progression.upgradeRanks.pulseFocus}`,
      `ss${world.progression.upgradeRanks.splitShot}`,
    ].join("/"),
    modeFrames: { ...modeFrames },
    intentModeFrames: { ...intentModeFrames },
    overrideFrames: { ...overrideFrames },
  };
}

function createModeCounts(): Record<AutoPilotMode, number> {
  return {
    contract: 0,
    upgrade: 0,
    projectileDodge: 0,
    enemyEvade: 0,
    healCollect: 0,
    xpCollect: 0,
    reposition: 0,
    engage: 0,
    survive: 0,
    patrol: 0,
  };
}

function createOverrideCounts(): Record<AutoPilotOverrideReason, number> {
  return {
    projectileCollision: 0,
    projectileThreat: 0,
    enemyCollision: 0,
    enemyThreat: 0,
  };
}

function createMotionDispositionCounts(): Record<
  AutoPilotMotionDisposition,
  number
> {
  return {
    progress: 0,
    goalReached: 0,
    magnetWait: 0,
    safetyDeflection: 0,
    safetyStop: 0,
    noSafeVelocity: 0,
    pathBlocked: 0,
  };
}

function createPickupRejectionCounts(): Record<
  AutoPilotPickupRejectionReason,
  number
> {
  return {
    cooldown: 0,
    distance: 0,
    pathUnreachable: 0,
    ttlExpired: 0,
    noEffectiveValue: 0,
    pathRisk: 0,
    unsafeProximity: 0,
  };
}

function createIntentSwitchReasonCounts(): Record<AutoPilotIntentSwitchReason, number> {
  return {
    initial: 0,
    sameTarget: 0,
    minimumCommit: 0,
    hysteresis: 0,
    betterUtility: 0,
    targetUnavailable: 0,
    targetStalled: 0,
    emergency: 0,
    phaseTransition: 0,
  };
}

function createPhaseTimingSamples(): Record<AutoPilotPhase, number[]> {
  return {
    coverage: [],
    targeting: [],
    tactics: [],
    movement: [],
    total: [],
  };
}

function summarizePhaseTimings(
  samples: Record<AutoPilotPhase, number[]>,
): Record<AutoPilotPhase, number> {
  return {
    coverage: percentile95(samples.coverage),
    targeting: percentile95(samples.targeting),
    tactics: percentile95(samples.tactics),
    movement: percentile95(samples.movement),
    total: percentile95(samples.total),
  };
}

type CoverageAccumulator = {
  patrolStrategy: AutoPilotPatrolStrategy;
  frames: number;
  reachableZoneTotal: number;
  visitRatio30Total: number;
  visitRatio120Total: number;
  maximumOldestZoneAge: number;
  transitions: Record<AutoPilotCoverageTransitionReason, number>;
  patrolIntentFrames: number;
  consecutivePatrolFrames: number;
  longestPatrolFrames: number;
  activePatrolIntentFrames: number;
  warningPatrolIntentFrames: number;
  patrolOverrideFrames: number;
  densitySweepPatrolFrames: number;
  stationaryPatrolFrames: number;
  stationaryPatrolWithoutOverrideFrames: number;
  consecutiveStationaryPatrolFrames: number;
  longestStationaryPatrolFrames: number;
};

function createCoverageAccumulator(
  patrolStrategy: AutoPilotPatrolStrategy,
): CoverageAccumulator {
  return {
    patrolStrategy,
    frames: 0,
    reachableZoneTotal: 0,
    visitRatio30Total: 0,
    visitRatio120Total: 0,
    maximumOldestZoneAge: 0,
    transitions: createCoverageTransitionCounts(),
    patrolIntentFrames: 0,
    consecutivePatrolFrames: 0,
    longestPatrolFrames: 0,
    activePatrolIntentFrames: 0,
    warningPatrolIntentFrames: 0,
    patrolOverrideFrames: 0,
    densitySweepPatrolFrames: 0,
    stationaryPatrolFrames: 0,
    stationaryPatrolWithoutOverrideFrames: 0,
    consecutiveStationaryPatrolFrames: 0,
    longestStationaryPatrolFrames: 0,
  };
}

function recordCoverageDecision(
  accumulator: CoverageAccumulator,
  decision: AutoPilotDecision,
  encounterPhase: WorldState["encounter"]["director"]["phase"],
  stationary: boolean,
  fieldXpPickups: number,
): void {
  const coverage = decision.coverage;
  if (coverage) {
    accumulator.frames += 1;
    const reachable = coverage.reachableZoneIds.length;
    accumulator.reachableZoneTotal += reachable;
    accumulator.visitRatio30Total += reachable > 0
      ? coverage.visitedZoneIds30Seconds.length / reachable
      : 1;
    accumulator.visitRatio120Total += reachable > 0
      ? coverage.visitedZoneIds120Seconds.length / reachable
      : 1;
    accumulator.maximumOldestZoneAge = Math.max(
      accumulator.maximumOldestZoneAge,
      coverage.oldestZoneAgeSeconds,
    );
    accumulator.transitions[coverage.transitionReason] += 1;
  }

  if (decision.intentMode !== "patrol") {
    accumulator.consecutivePatrolFrames = 0;
    accumulator.consecutiveStationaryPatrolFrames = 0;
    return;
  }
  accumulator.patrolIntentFrames += 1;
  accumulator.consecutivePatrolFrames += 1;
  accumulator.longestPatrolFrames = Math.max(
    accumulator.longestPatrolFrames,
    accumulator.consecutivePatrolFrames,
  );
  if (encounterPhase === "active") accumulator.activePatrolIntentFrames += 1;
  if (encounterPhase === "warning") accumulator.warningPatrolIntentFrames += 1;
  if (decision.overrideReason) accumulator.patrolOverrideFrames += 1;
  if (
    fieldXpPickups > AUTO_PILOT_FIELD_XP_LIMIT &&
    (decision.coverage?.targetXpPickupCount ?? 0) > 0
  ) accumulator.densitySweepPatrolFrames += 1;
  if (!stationary) {
    accumulator.consecutiveStationaryPatrolFrames = 0;
    return;
  }
  accumulator.stationaryPatrolFrames += 1;
  accumulator.consecutiveStationaryPatrolFrames += 1;
  accumulator.longestStationaryPatrolFrames = Math.max(
    accumulator.longestStationaryPatrolFrames,
    accumulator.consecutiveStationaryPatrolFrames,
  );
  if (!decision.overrideReason) accumulator.stationaryPatrolWithoutOverrideFrames += 1;
}

function summarizeCoverageAccumulator(
  accumulator: CoverageAccumulator,
  frameRate: number,
): AutoPilotCoverageProbeRun {
  return {
    patrolStrategy: accumulator.patrolStrategy,
    coverageFrames: accumulator.frames,
    averageReachableCoverageZones:
      accumulator.reachableZoneTotal / Math.max(1, accumulator.frames),
    averageCoverageVisitRatio30Seconds:
      accumulator.visitRatio30Total / Math.max(1, accumulator.frames),
    averageCoverageVisitRatio120Seconds:
      accumulator.visitRatio120Total / Math.max(1, accumulator.frames),
    maximumOldestCoverageZoneAgeSeconds: accumulator.maximumOldestZoneAge,
    coverageTargetTransitions: { ...accumulator.transitions },
    patrolIntentFrames: accumulator.patrolIntentFrames,
    longestPatrolIntentSeconds: accumulator.longestPatrolFrames / frameRate,
    activePatrolIntentFrames: accumulator.activePatrolIntentFrames,
    warningPatrolIntentFrames: accumulator.warningPatrolIntentFrames,
    coveragePatrolOverrideFrames: accumulator.patrolOverrideFrames,
    densitySweepPatrolFrames: accumulator.densitySweepPatrolFrames,
    stationaryPatrolIntentFrames: accumulator.stationaryPatrolFrames,
    stationaryPatrolWithoutOverrideFrames:
      accumulator.stationaryPatrolWithoutOverrideFrames,
    longestStationaryPatrolSeconds:
      accumulator.longestStationaryPatrolFrames / frameRate,
  };
}

function createCoverageTransitionCounts(): Record<
  AutoPilotCoverageTransitionReason,
  number
> {
  return {
    none: 0,
    selected: 0,
    reached: 0,
    unreachable: 0,
    stalled: 0,
    arenaChanged: 0,
    strategyDisabled: 0,
  };
}

function percentile95(values: readonly number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((first, second) => first - second);
  return sorted[Math.ceil(sorted.length * 0.95) - 1] ?? 0;
}
