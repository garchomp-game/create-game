import { describe, expect, it } from "vitest";
import { SIMULATION_CONFIG } from "../config/gameConfig";
import {
  runAutoPilotProbe,
  type AutoPilotProbeRun,
} from "./autoPilotProbe";

describe("runAutoPilotProbe", () => {
  it("compares both observer weapons deterministically", { timeout: 15_000 }, () => {
    const options = {
      config: SIMULATION_CONFIG,
      seeds: [20260715],
      durationSeconds: 30,
    } as const;

    const first = runAutoPilotProbe(options);
    const second = runAutoPilotProbe(options);

    expect(first).toEqual(second);
    expect(first.map((run) => run.weaponType)).toEqual(["pulse", "spread"]);
    expect(first.every((run) => run.profile === "ceiling")).toBe(true);
    expect(first.every((run) => run.phaseTimingP95Ms === null)).toBe(true);
    expect(first.every((run) => run.patrolStrategy === "periodic-v3")).toBe(true);
    expect(first.every((run) => run.coverageFrames > 0)).toBe(true);
    expect(first.every((run) => run.averageReachableCoverageZones > 0)).toBe(true);
    expect(first.every((run) => run.modeFrames.engage > 0)).toBe(true);
    expect(first.every((run) => run.averageFieldXpPickups >= 0)).toBe(true);
    expect(first.every((run) => run.activeXpIntentFrames === 0)).toBe(true);

    const visitOptions = {
      ...options,
      patrolStrategy: "visit-history-v1",
    } as const;
    const firstVisit = runAutoPilotProbe(visitOptions);
    const secondVisit = runAutoPilotProbe(visitOptions);
    expect(firstVisit).toEqual(secondVisit);
    expect(firstVisit.every((run) => run.coverageFrames > 0)).toBe(true);
    expect(firstVisit.every((run) => run.activePatrolIntentFrames === 0)).toBe(true);
    expect(firstVisit.every((run) => run.warningPatrolIntentFrames === 0)).toBe(true);
  });

  it("can measure targeting, tactics, movement, and total decision p95", () => {
    const [run] = runAutoPilotProbe({
      config: SIMULATION_CONFIG,
      seeds: [20260715],
      durationSeconds: 2,
      weaponTypes: ["pulse"],
      measurePerformance: true,
    });

    expect(run?.phaseTimingP95Ms).not.toBeNull();
    expect(run!.phaseTimingP95Ms!.targeting).toBeGreaterThan(0);
    expect(run!.phaseTimingP95Ms!.coverage).toBeGreaterThan(0);
    expect(run!.phaseTimingP95Ms!.tactics).toBeGreaterThan(0);
    expect(run!.phaseTimingP95Ms!.movement).toBeGreaterThan(0);
    expect(run!.phaseTimingP95Ms!.total).toBeGreaterThan(0);
  });

  it.skipIf(import.meta.env.VITE_ARENA_AUTO_PILOT_PROFILE !== "1")(
    "prints the long fixed-seed observer profile",
    () => {
      const durationSeconds = Number(
        import.meta.env.VITE_ARENA_AUTO_PILOT_DURATION ?? 720,
      );
      const configuredSeeds = import.meta.env.VITE_ARENA_AUTO_PILOT_SEEDS;
      const seeds = configuredSeeds
        ? configuredSeeds.split(",").map((value: string) => Number(value.trim()))
        : [20260711, 20260712, 20260713, 20260714, 20260715];
      const configuredProfile = import.meta.env.VITE_ARENA_AUTO_PILOT_PROFILE_ID;
      const profile = configuredProfile === "fair" ? "fair" : "ceiling";
      const configuredPatrolStrategy =
        import.meta.env.VITE_ARENA_AUTO_PILOT_PATROL_STRATEGY;
      const patrolStrategy = configuredPatrolStrategy === "visit-history-v1"
        ? "visit-history-v1"
        : "periodic-v3";
      const measurePerformance =
        import.meta.env.VITE_ARENA_AUTO_PILOT_MEASURE_PERFORMANCE !== "0";
      const configuredWeapons = import.meta.env.VITE_ARENA_AUTO_PILOT_WEAPONS;
      const weaponTypes = configuredWeapons === "pulse"
        ? (["pulse"] as const)
        : configuredWeapons === "spread"
          ? (["spread"] as const)
          : undefined;
      const runs = runAutoPilotProbe({
        config: SIMULATION_CONFIG,
        seeds,
        durationSeconds,
        profile,
        patrolStrategy,
        measurePerformance,
        ...(weaponTypes ? { weaponTypes } : {}),
      });

      if (import.meta.env.VITE_ARENA_AUTO_PILOT_OUTPUT !== "summary") {
        console.table(
          runs.map((run) => {
          const totalModeFrames = Math.max(
            1,
            Object.values(run.modeFrames).reduce((sum, count) => sum + count, 0),
          );
          return {
            seed: run.seed,
            weapon: run.weaponType,
            profile: run.profile,
            patrol: run.patrolStrategy,
            seconds: Number(run.survivedSeconds.toFixed(1)),
            score: run.score,
            kills: run.kills,
            killsPerMinute: Number(run.killsPerMinute.toFixed(1)),
            xp: run.xpCollected,
            extraLevel: run.extraLevel,
            extraCycle: run.extraCycle,
            buildCompletedAt: run.buildCompletedAt === null
              ? null
              : Number(run.buildCompletedAt.toFixed(1)),
            pickups: run.pickupsCollected,
            contact: run.damageTakenBySource.contact,
            projectile: run.damageTakenBySource.projectile,
            healed: run.hpRecovered,
            hitRate: Number(run.projectileHitRate.toFixed(3)),
            switches: run.targetSwitches,
            intentSwitchesPerMinute: Number(run.intentSwitchesPerMinute.toFixed(2)),
            betterSwitches: run.intentSwitchReasons.betterUtility,
            voluntaryTransitions: JSON.stringify(run.voluntaryIntentTransitions),
            unavailable: run.intentSwitchReasons.targetUnavailable,
            stalledTargets: run.intentSwitchReasons.targetStalled,
            minimumCommit: run.intentSwitchReasons.minimumCommit,
            hysteresis: run.intentSwitchReasons.hysteresis,
            risk: Number(run.averageRiskScore.toFixed(3)),
            maxRisk: Number(run.maximumRiskScore.toFixed(3)),
            minTtc: run.minimumTtc === null ? null : Number(run.minimumTtc.toFixed(3)),
            pickupEta: run.averagePickupEta === null
              ? null
              : Number(run.averagePickupEta.toFixed(2)),
            pickupOverrides: run.pickupOverrideFrames,
            avgFieldXp: Number(run.averageFieldXpPickups.toFixed(1)),
            maxFieldXp: run.maximumFieldXpPickups,
            fieldXpExcessFrames: run.fieldXpExcessFrames,
            maxNonActiveFieldXp: run.maximumNonActiveFieldXpPickups,
            nonActiveXpExcessPct: run.nonActiveFrames > 0
              ? Number(
                  (run.nonActiveFieldXpExcessFrames / run.nonActiveFrames * 100).toFixed(1),
                )
              : 0,
            warningXpPct: run.warningFrames > 0
              ? Number((run.warningXpIntentFrames / run.warningFrames * 100).toFixed(1))
              : 0,
            activeXpFrames: run.activeXpIntentFrames,
            activeCombatPct: run.activeFrames > 0
              ? Number((run.activeCombatIntentFrames / run.activeFrames * 100).toFixed(1))
              : 0,
            stationaryXpFrames: run.stationaryXpIntentFrames,
            stationaryXpNoOverride: run.stationaryXpWithoutOverrideFrames,
            longestStationaryXpSeconds: Number(
              run.longestStationaryXpSeconds.toFixed(2),
            ),
            xpProgressStalls: run.xpProgressStallFrames,
            unclassifiedXpStalls: run.unclassifiedXpStallFrames,
            longestUnclassifiedXpStall: Number(
              run.longestUnclassifiedXpStallSeconds.toFixed(2),
            ),
            safetyStopWithMoving: run.safetyStopWithMovingCandidateFrames,
            avgXpSource: Number(run.averageXpPickupSourceCount.toFixed(1)),
            avgXpEvaluated: Number(run.averageXpPathEvaluatedCount.toFixed(1)),
            avgXpSafe: Number(run.averageXpSafeCandidateCount.toFixed(2)),
            avgXpCorridor: Number(
              run.averageXpSelectedCorridorPickupCount.toFixed(2),
            ),
            xpNoSafeFrames: run.xpNoSafeCandidateFrames,
            xpPotentialMissFrames: run.xpPotentialCandidateMissFrames,
            recklessPickups: run.recklessPickupCollections,
            wastedHeals: run.wastedHealPickups,
            unavoidableHeals: run.unavoidableWastedHealPickups,
            avoidableHeals: run.avoidableWastedHealPickups,
            healEfficiency: Number(run.healEfficiency.toFixed(3)),
            aimTargets: Number(run.averageAimExpectedDistinctHits.toFixed(2)),
            targetP95Ms: Number((run.phaseTimingP95Ms?.targeting ?? 0).toFixed(3)),
            tacticsP95Ms: Number((run.phaseTimingP95Ms?.tactics ?? 0).toFixed(3)),
            movementP95Ms: Number((run.phaseTimingP95Ms?.movement ?? 0).toFixed(3)),
            coverageP95Ms: Number((run.phaseTimingP95Ms?.coverage ?? 0).toFixed(3)),
            aiP95Ms: Number((run.phaseTimingP95Ms?.total ?? 0).toFixed(3)),
            patrolPct: Number(
              (run.patrolIntentFrames / totalModeFrames * 100).toFixed(2),
            ),
            longestPatrol: Number(run.longestPatrolIntentSeconds.toFixed(2)),
            warningPatrol: run.warningPatrolIntentFrames,
            activePatrol: run.activePatrolIntentFrames,
            stationaryPatrol: run.stationaryPatrolIntentFrames,
            stationaryPatrolNoOverride: run.stationaryPatrolWithoutOverrideFrames,
            densitySweepPatrol: run.densitySweepPatrolFrames,
            longestStationaryPatrol: Number(
              run.longestStationaryPatrolSeconds.toFixed(2),
            ),
            reachableZones: Number(
              run.averageReachableCoverageZones.toFixed(2),
            ),
            visited30Pct: Number(
              (run.averageCoverageVisitRatio30Seconds * 100).toFixed(1),
            ),
            visited120Pct: Number(
              (run.averageCoverageVisitRatio120Seconds * 100).toFixed(1),
            ),
            oldestZoneAge: Number(
              run.maximumOldestCoverageZoneAgeSeconds.toFixed(1),
            ),
            coverageTransitions: JSON.stringify(run.coverageTargetTransitions),
            focusHits: run.pulseFocusEnhancedHits,
            focusDamage: Number(run.pulseFocusBonusDamage.toFixed(1)),
            focusTargetDamage: Number(run.pulseFocusTargetBonusDamage.toFixed(1)),
            focusLineDamage: Number(run.pulseFocusLineBonusDamage.toFixed(1)),
            ricochetHits: run.pulseRicochetFollowUpHits,
            sweepTriggers: run.spreadSweepTriggers,
            ranks: run.upgradeRanks,
            dodgePct: Number(
              ((run.modeFrames.projectileDodge + run.modeFrames.enemyEvade) /
                totalModeFrames *
                100).toFixed(1),
            ),
            xpPct: Number(
              (run.modeFrames.xpCollect / totalModeFrames * 100).toFixed(1),
            ),
            engagePct: Number(
              ((run.modeFrames.engage + run.modeFrames.reposition) /
                totalModeFrames *
                100).toFixed(1),
            ),
          };
          }),
        );
      }
      console.log(
        "AUTO_PILOT_PROBE_SUMMARY",
        JSON.stringify(summarizeProbeRuns(runs)),
      );
    },
    1_800_000,
  );

  it.skipIf(import.meta.env.VITE_ARENA_PULSE_TUNING_PROFILE !== "1")(
    "compares Pulse precision tuning against the previous rules",
    () => {
      const durationSeconds = Number(
        import.meta.env.VITE_ARENA_AUTO_PILOT_DURATION ?? 650,
      );
      const configuredSeeds = import.meta.env.VITE_ARENA_AUTO_PILOT_SEEDS;
      const seeds = configuredSeeds
        ? configuredSeeds.split(",").map((value: string) => Number(value.trim()))
        : [20260711, 20260712, 20260713];
      const baselineConfig = structuredClone(SIMULATION_CONFIG);
      baselineConfig.weapons.pulse.damage = 1;
      const baselineFocus = baselineConfig.upgrades.pulseFocus.effect;
      if (baselineFocus.type !== "pulseFocus") {
        throw new Error("Pulse Focus must use the pulseFocus effect");
      }
      baselineFocus.bonusPerStack = 0.15;
      baselineFocus.lineBonusPerStack = 0;
      const commonOptions = {
        seeds,
        durationSeconds,
        profile: "ceiling" as const,
        patrolStrategy: "periodic-v3" as const,
        measurePerformance: false,
        weaponTypes: ["pulse"] as const,
      };
      const baseline = runAutoPilotProbe({
        ...commonOptions,
        config: baselineConfig,
      });
      const candidate = runAutoPilotProbe({
        ...commonOptions,
        config: SIMULATION_CONFIG,
      });

      expect(baseline).toHaveLength(seeds.length);
      expect(candidate).toHaveLength(seeds.length);
      console.log(
        "PULSE_TUNING_SUMMARY",
        JSON.stringify({
          baseline: summarizePulseTuningRuns(baseline),
          candidate: summarizePulseTuningRuns(candidate),
        }),
      );
    },
    1_800_000,
  );
});

function summarizePulseTuningRuns(runs: readonly AutoPilotProbeRun[]) {
  return {
    runCount: runs.length,
    meanSurvivedSeconds: mean(runs.map((run) => run.survivedSeconds)),
    meanScore: mean(runs.map((run) => run.score)),
    meanKills: mean(runs.map((run) => run.kills)),
    meanDamageTaken: mean(
      runs.map((run) =>
        run.damageTakenBySource.contact +
        run.damageTakenBySource.projectile +
        run.damageTakenBySource.collapse
      ),
    ),
    meanContactDamage: mean(
      runs.map((run) => run.damageTakenBySource.contact),
    ),
    meanProjectileDamage: mean(
      runs.map((run) => run.damageTakenBySource.projectile),
    ),
    meanXpPerMinute: mean(
      runs.map((run) =>
        run.xpCollected / Math.max(1 / 60, run.survivedSeconds / 60)
      ),
    ),
    meanFocusEnhancedHits: mean(
      runs.map((run) => run.pulseFocusEnhancedHits),
    ),
    meanFocusBonusDamage: mean(
      runs.map((run) => run.pulseFocusBonusDamage),
    ),
    meanFocusTargetBonusDamage: mean(
      runs.map((run) => run.pulseFocusTargetBonusDamage),
    ),
    meanFocusLineBonusDamage: mean(
      runs.map((run) => run.pulseFocusLineBonusDamage),
    ),
  };
}

function summarizeProbeRuns(runs: readonly AutoPilotProbeRun[]) {
  const totalIntentFrames = runs.reduce(
    (total, run) => total + Object.values(run.intentModeFrames)
      .reduce((sum, count) => sum + count, 0),
    0,
  );
  const patrolIntentFrames = runs.reduce(
    (total, run) => total + run.patrolIntentFrames,
    0,
  );
  const performanceRuns = runs.filter((run) => run.phaseTimingP95Ms !== null);
  const totalFrames = runs.reduce(
    (total, run) => total + Object.values(run.modeFrames)
      .reduce((sum, count) => sum + count, 0),
    0,
  );
  const totalNonActiveFrames = runs.reduce(
    (total, run) => total + run.nonActiveFrames,
    0,
  );
  const totalWarningFrames = runs.reduce(
    (total, run) => total + run.warningFrames,
    0,
  );
  const totalActiveFrames = runs.reduce(
    (total, run) => total + run.activeFrames,
    0,
  );
  const totalCommittedPickups = runs.reduce(
    (total, run) => total + run.committedPickupCollections,
    0,
  );
  return {
    runCount: runs.length,
    seeds: [...new Set(runs.map((run) => run.seed))],
    totalFrames,
    totalNonActiveFrames,
    totalWarningFrames,
    totalActiveFrames,
    totalCommittedPickups,
    maximumExtraLevel: Math.max(0, ...runs.map((run) => run.extraLevel)),
    maximumExtraCycle: Math.max(0, ...runs.map((run) => run.extraCycle)),
    cycleFiveRuns: runs.filter((run) => run.extraCycle >= 5).length,
    patrolStrategy: runs[0]?.patrolStrategy ?? null,
    runsWithPatrolAtLeastOneSecond: runs.filter(
      (run) => run.longestPatrolIntentSeconds >= 1,
    ).length,
    patrolIntentFrames,
    totalIntentFrames,
    patrolIntentRatio: patrolIntentFrames / Math.max(1, totalIntentFrames),
    longestPatrolIntentSeconds: Math.max(
      0,
      ...runs.map((run) => run.longestPatrolIntentSeconds),
    ),
    activePatrolIntentFrames: runs.reduce(
      (total, run) => total + run.activePatrolIntentFrames,
      0,
    ),
    warningPatrolIntentFrames: runs.reduce(
      (total, run) => total + run.warningPatrolIntentFrames,
      0,
    ),
    stationaryPatrolWithoutOverrideFrames: runs.reduce(
      (total, run) => total + run.stationaryPatrolWithoutOverrideFrames,
      0,
    ),
    densitySweepPatrolFrames: runs.reduce(
      (total, run) => total + run.densitySweepPatrolFrames,
      0,
    ),
    longestStationaryPatrolSeconds: Math.max(
      0,
      ...runs.map((run) => run.longestStationaryPatrolSeconds),
    ),
    coverageTargetTransitions: runs.reduce(
      (totals, run) => {
        for (const [reason, count] of Object.entries(run.coverageTargetTransitions)) {
          totals[reason] = (totals[reason] ?? 0) + count;
        }
        return totals;
      },
      {} as Record<string, number>,
    ),
    meanVisitRatio30Seconds: mean(
      runs.map((run) => run.averageCoverageVisitRatio30Seconds),
    ),
    meanVisitRatio120Seconds: mean(
      runs.map((run) => run.averageCoverageVisitRatio120Seconds),
    ),
    maximumOldestZoneAgeSeconds: Math.max(
      0,
      ...runs.map((run) => run.maximumOldestCoverageZoneAgeSeconds),
    ),
    meanFieldXpPickups: mean(
      runs.map((run) => run.averageFieldXpPickups),
    ),
    maximumFieldXpPickups: Math.max(
      0,
      ...runs.map((run) => run.maximumFieldXpPickups),
    ),
    fieldXpExcessRatio: runs.reduce(
      (total, run) => total + run.fieldXpExcessFrames,
      0,
    ) / Math.max(1, totalFrames),
    nonActiveFieldXpExcessRatio: runs.reduce(
      (total, run) => total + run.nonActiveFieldXpExcessFrames,
      0,
    ) / Math.max(1, totalNonActiveFrames),
    maximumNonActiveFieldXpPickups: Math.max(
      0,
      ...runs.map((run) => run.maximumNonActiveFieldXpPickups),
    ),
    xpProgressStallFrames: runs.reduce(
      (total, run) => total + run.xpProgressStallFrames,
      0,
    ),
    targetStalledSwitches: runs.reduce(
      (total, run) => total + run.intentSwitchReasons.targetStalled,
      0,
    ),
    unclassifiedXpStallFrames: runs.reduce(
      (total, run) => total + run.unclassifiedXpStallFrames,
      0,
    ),
    longestUnclassifiedXpStallSeconds: Math.max(
      0,
      ...runs.map((run) => run.longestUnclassifiedXpStallSeconds),
    ),
    safetyStopWithMovingCandidateFrames: runs.reduce(
      (total, run) => total + run.safetyStopWithMovingCandidateFrames,
      0,
    ),
    meanXpPickupSourceCount: mean(
      runs.map((run) => run.averageXpPickupSourceCount),
    ),
    meanXpPathEvaluatedCount: mean(
      runs.map((run) => run.averageXpPathEvaluatedCount),
    ),
    meanXpSafeCandidateCount: mean(
      runs.map((run) => run.averageXpSafeCandidateCount),
    ),
    meanXpSelectedCorridorPickupCount: mean(
      runs.map((run) => run.averageXpSelectedCorridorPickupCount),
    ),
    meanXpSelectedCorridorValue: mean(
      runs.map((run) => run.averageXpSelectedCorridorValue),
    ),
    xpNoSafeCandidateFrames: runs.reduce(
      (total, run) => total + run.xpNoSafeCandidateFrames,
      0,
    ),
    xpPotentialCandidateMissFrames: runs.reduce(
      (total, run) => total + run.xpPotentialCandidateMissFrames,
      0,
    ),
    xpRejectedByReason: runs.reduce(
      (totals, run) => {
        for (const [reason, count] of Object.entries(run.xpRejectedByReason)) {
          totals[reason] = (totals[reason] ?? 0) + count;
        }
        return totals;
      },
      {} as Record<string, number>,
    ),
    warningXpIntentRatio: runs.reduce(
      (total, run) => total + run.warningXpIntentFrames,
      0,
    ) / Math.max(1, totalWarningFrames),
    activeCombatIntentRatio: runs.reduce(
      (total, run) => total + run.activeCombatIntentFrames,
      0,
    ) / Math.max(1, totalActiveFrames),
    meanXpPerMinute: mean(
      runs.map((run) =>
        run.xpCollected / Math.max(1 / 60, run.survivedSeconds / 60)
      ),
    ),
    meanSurvivedSeconds: mean(runs.map((run) => run.survivedSeconds)),
    meanScore: mean(runs.map((run) => run.score)),
    meanKills: mean(runs.map((run) => run.kills)),
    meanContactDamage: mean(
      runs.map((run) => run.damageTakenBySource.contact),
    ),
    meanProjectileDamage: mean(
      runs.map((run) => run.damageTakenBySource.projectile),
    ),
    recklessPickupRatio: runs.reduce(
      (total, run) => total + run.recklessPickupCollections,
      0,
    ) / Math.max(1, totalCommittedPickups),
    avoidableWastedHealPickups: runs.reduce(
      (total, run) => total + run.avoidableWastedHealPickups,
      0,
    ),
    meanHealEfficiency: mean(runs.map((run) => run.healEfficiency)),
    maximumDecisionP95Ms: Math.max(
      0,
      ...performanceRuns.map((run) => run.phaseTimingP95Ms?.total ?? 0),
    ),
    maximumCoverageP95Ms: Math.max(
      0,
      ...performanceRuns.map((run) => run.phaseTimingP95Ms?.coverage ?? 0),
    ),
    meanPhaseP95Ms: summarizePhaseTiming(performanceRuns, "mean"),
    maximumPhaseP95Ms: summarizePhaseTiming(performanceRuns, "maximum"),
    byWeapon: Object.fromEntries(
      ["pulse", "spread"].map((weaponType) => {
        const weaponRuns = runs.filter((run) => run.weaponType === weaponType);
        return [weaponType, {
          runCount: weaponRuns.length,
          meanSurvivedSeconds: mean(
            weaponRuns.map((run) => run.survivedSeconds),
          ),
          meanScore: mean(weaponRuns.map((run) => run.score)),
          meanXpPerMinute: mean(
            weaponRuns.map((run) =>
              run.xpCollected / Math.max(1 / 60, run.survivedSeconds / 60)
            ),
          ),
          meanFieldXpPickups: mean(
            weaponRuns.map((run) => run.averageFieldXpPickups),
          ),
          meanVisitRatio30Seconds: mean(
            weaponRuns.map((run) => run.averageCoverageVisitRatio30Seconds),
          ),
        }];
      }),
    ),
  };
}

function summarizePhaseTiming(
  runs: readonly AutoPilotProbeRun[],
  mode: "mean" | "maximum",
) {
  return Object.fromEntries(
    ["coverage", "targeting", "tactics", "movement", "total"].map((phase) => {
      const values = runs.map((run) =>
        run.phaseTimingP95Ms?.[phase as keyof NonNullable<
          AutoPilotProbeRun["phaseTimingP95Ms"]
        >] ?? 0
      );
      return [phase, mode === "mean" ? mean(values) : Math.max(0, ...values)];
    }),
  );
}

function mean(values: readonly number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}
