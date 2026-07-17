import { describe, expect, it } from "vitest";
import type { RunRecord } from "../domain/runRecords";
import type {
  RunRecordLoadResult,
  RunRecordStorePort,
  RunRecordWriteResult,
} from "../ports/RunRecordStorePort";
import { createRankEligibility } from "./runRecords";
import { RunRecordCoordinator } from "./RunRecordCoordinator";

describe("RunRecordCoordinator", () => {
  it("does not save a run that never started", () => {
    const store = new MemoryRunRecordStore();
    const coordinator = new RunRecordCoordinator(store);
    coordinator.reset(makeContext());

    expect(coordinator.finalize(makeFinalizeInput())).toEqual({ status: "notStarted" });
    expect(store.records).toEqual([]);
  });

  it("saves exactly once even when finalize is called repeatedly", () => {
    const store = new MemoryRunRecordStore();
    const coordinator = new RunRecordCoordinator(store);
    coordinator.reset(makeContext(), true);

    expect(coordinator.finalize(makeFinalizeInput()).status).toBe("saved");
    expect(coordinator.finalize(makeFinalizeInput()).status).toBe("alreadyFinalized");
    expect(store.records).toHaveLength(1);
  });

  it("marks human debug mutations ineligible without replacing test origin", () => {
    const coordinator = new RunRecordCoordinator(new MemoryRunRecordStore());
    coordinator.reset(makeContext(), true);
    coordinator.markDebugMutation();

    expect(coordinator.getContext()).toMatchObject({
      runOrigin: "debug",
      rankEligibility: { eligible: false, reasons: ["debugRun"] },
    });

    coordinator.reset({ ...makeContext(), runOrigin: "test", rankEligibility: createRankEligibility("test") });
    coordinator.markDebugMutation();
    expect(coordinator.getContext()?.runOrigin).toBe("test");
  });

  it("adds contract modifiers and marks overdrive as a non-standard ruleset", () => {
    const coordinator = new RunRecordCoordinator(new MemoryRunRecordStore());
    coordinator.reset(makeContext(), true);
    coordinator.addModifier("contract:overdrive", false);
    coordinator.addModifier("contract:overdrive", false);

    expect(coordinator.getContext()).toMatchObject({
      modifierIds: ["contract:overdrive"],
      rankEligibility: { eligible: false, reasons: ["nonStandardRuleset"] },
    });
  });

  it("retries a failed storage write with the same run id", () => {
    const store = new MemoryRunRecordStore();
    store.failWrites = true;
    const coordinator = new RunRecordCoordinator(store);
    coordinator.reset(makeContext(), true);

    expect(coordinator.finalize(makeFinalizeInput()).status).toBe("saveFailed");
    store.failWrites = false;
    const retried = coordinator.finalize(makeFinalizeInput());
    expect(retried.status).toBe("saved");
    expect("record" in retried ? retried.record.id : null).toBe("run-1");
    expect(store.saveAttempts).toBe(2);
  });
});

class MemoryRunRecordStore implements RunRecordStorePort {
  records: RunRecord[] = [];
  failWrites = false;
  saveAttempts = 0;

  load(): RunRecordLoadResult {
    return {
      records: [...this.records],
      history: [...this.records],
      rankings: [...this.records],
      recovered: false,
    };
  }

  save(record: RunRecord): RunRecordWriteResult {
    this.saveAttempts += 1;
    if (this.failWrites) {
      return { ok: false, records: [], history: [], rankings: [], error: "failed" };
    }
    this.records = [record];
    return {
      ok: true,
      records: [...this.records],
      history: [...this.records],
      rankings: [...this.records],
    };
  }

  clearHistory(): RunRecordWriteResult {
    return this.clear();
  }

  clearRankings(): RunRecordWriteResult {
    return this.clear();
  }

  clear(): RunRecordWriteResult {
    this.records = [];
    return { ok: true, records: [], history: [], rankings: [] };
  }
}

function makeContext() {
  return {
    id: "run-1",
    profileId: "guest-1",
    startedAt: "2026-07-10T10:00:00Z",
    modeId: "endless",
    stageId: "arena-default",
    difficultyId: "standard",
    rulesetVersion: "rules-v1",
    seedCategory: "random" as const,
    weaponId: "pulse" as const,
    modifierIds: [],
    appVersion: "0.5",
    buildCommit: "test",
    seed: 42,
    runOrigin: "manual" as const,
    rankEligibility: createRankEligibility("manual"),
  };
}

function makeFinalizeInput() {
  return {
    capturedAt: "2026-07-10T10:01:00Z",
    summary: {
      elapsed: 60,
      score: 100,
      hp: 0,
      level: 2,
      extraLevel: 0,
      extraCycle: 0,
      xp: 0,
      threatTier: 0,
      collapseStage: 0,
      shotsFired: 10,
      enemiesKilled: 5,
      hitsTaken: 1,
      damageTaken: 100,
      damageTakenBySource: { contact: 100, projectile: 0, collapse: 0 },
      lastDamageSource: null,
      xpCollected: 5,
      pickupsCollected: 5,
      hpRecovered: 0,
      healPickupsCollected: 0,
      effectiveHealPickupsCollected: 0,
      upgradesChosen: 1,
      extraUpgradesChosen: 0,
      capstoneMetrics: {
        upgradeId: "pulseRicochet" as const,
        acquiredAt: null,
        activations: 0,
        followUpHits: 0,
        followUpUniqueEnemiesHit: 0,
        maxFollowUpUniqueEnemiesPerVolley: 0,
        obstacleRicochets: 0,
        boundaryRicochets: 0,
        boundaryRicochetsBySide: { left: 0, right: 0, top: 0, bottom: 0 },
        obstacleFollowUpHits: 0,
        obstacleFollowUpKills: 0,
        boundaryFollowUpHits: 0,
        boundaryFollowUpKills: 0,
        boundaryFollowUpHitsBySide: { left: 0, right: 0, top: 0, bottom: 0 },
        spreadSweepTriggers: 0,
        spreadSweepConsumes: 0,
      },
      weaponIdentityMetrics: {
        pulseFocus: {
          enhancedHits: 0,
          bonusDamage: 0,
          targetEnhancedHits: 0,
          lineEnhancedHits: 0,
          targetBonusDamage: 0,
          lineBonusDamage: 0,
          maxStacks: 0,
          killsByEnemyType: { chaser: 0, brute: 0, fast: 0, ranged: 0 },
        },
        spreadSweep: { triggers: 0, consumes: 0, maxDistinctTargets: 0 },
      },
      weaponMetrics: {
        pulse: { shotsFired: 10, projectilesFired: 10, hits: 5, kills: 5 },
        spread: { shotsFired: 0, projectilesFired: 0, hits: 0, kills: 0 },
        pierce: { shotsFired: 0, projectilesFired: 0, hits: 0, kills: 0 },
      },
    },
    upgradeRanks: {
      rapidFire: 1,
      swiftStep: 0,
      vitalCore: 0,
      overdriveRounds: 0,
      splitShot: 0,
      pulseFocus: 0,
      piercingRounds: 0,
      pulseRicochet: 0,
      spreadSweep: 0,
    },
    upgradeSelections: [],
    buildCompletedAt: null,
  };
}
