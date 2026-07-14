import { describe, expect, it } from "vitest";
import type { LocalProfile, ProfileSettings } from "../../domain/profile";
import type { RunContext, RunRecord } from "../../domain/runRecords";
import { createPhaserUiState } from "./PhaserUiState";

describe("createPhaserUiState", () => {
  it("filters records to the active profile and computes its ranking", () => {
    const profile = { id: "profile-a", displayName: "", schemaVersion: 1 } as LocalProfile;
    const settings = {} as ProfileSettings;
    const context = makeRecord("context", "profile-a", 0) as unknown as RunContext;
    const ownRecord = makeRecord("own", "profile-a", 100);
    const otherRecord = makeRecord("other", "profile-b", 200);

    const state = createPhaserUiState({
      secondaryMenu: "ranking",
      runHistory: [ownRecord, otherRecord],
      runRankings: [ownRecord, otherRecord],
      runContext: context,
      profile,
      settings,
      latestRunRecord: ownRecord,
      previousBest: null,
      historyClearPending: false,
      rankingClearPending: false,
      historyPage: 0,
      historyWeaponFilter: "all",
      focusedMenuAction: "back",
      notice: null,
    });

    expect(state.records.map((record) => record.id)).toEqual(["own"]);
    expect(state.ranking.map((record) => record.id)).toEqual(["own"]);
    expect(state.profile).not.toBe(profile);
    expect(state.latestRunRecord).not.toBe(ownRecord);
  });

  it("filters history by starting weapon without changing the combined ranking", () => {
    const profile = { id: "profile-a", displayName: "", schemaVersion: 1 } as LocalProfile;
    const pulse = makeRecord("pulse", "profile-a", 100);
    const spread = { ...makeRecord("spread", "profile-a", 200), weaponId: "spread" as const };
    const state = createPhaserUiState({
      secondaryMenu: "history",
      runHistory: [spread, pulse],
      runRankings: [spread, pulse],
      runContext: pulse as unknown as RunContext,
      profile,
      settings: {} as ProfileSettings,
      latestRunRecord: null,
      previousBest: null,
      historyClearPending: false,
      rankingClearPending: false,
      historyPage: 0,
      historyWeaponFilter: "spread",
      focusedMenuAction: "back",
      notice: null,
    });

    expect(state.records.map((record) => record.id)).toEqual(["spread"]);
    expect(state.ranking.map((record) => record.id)).toEqual(["spread", "pulse"]);
  });
});

function makeRecord(id: string, profileId: string, score: number): RunRecord {
  return {
    schemaVersion: 2,
    id,
    profileId,
    capturedAt: "2026-07-11T00:00:00.000Z",
    modeId: "endless",
    stageId: "default",
    difficultyId: "normal",
    weaponId: "pulse",
    modifierIds: [],
    appVersion: "0.5",
    rulesetVersion: "rules",
    buildCommit: "test",
    seed: 1,
    seedCategory: "random",
    runOrigin: "manual",
    rankEligibility: { eligible: true, reasons: [] },
    elapsed: 1,
    score,
    level: 1,
    extraLevel: 0,
    extraCycle: 0,
    threatTier: 0,
    collapseStage: 0,
    kills: 0,
    damageTaken: 0,
    lastDamageSource: null,
    shotsFired: 0,
    hpRecovered: 0,
    upgradesChosen: 0,
    extraUpgradesChosen: 0,
    upgradeRanks: {
      rapidFire: 0,
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
    extraUpgradeRanks: { limitPower: 0, limitCycle: 0, limitDrive: 0, limitCore: 0 },
    extraUpgradeSelections: [],
    buildCompletedAt: null,
    capstoneMetrics: {
      upgradeId: "pulseRicochet",
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
        maxStacks: 0,
        killsByEnemyType: { chaser: 0, brute: 0, fast: 0, ranged: 0 },
      },
      spreadSweep: { triggers: 0, consumes: 0, maxDistinctTargets: 0 },
    },
    encounterMetrics: {
      scheduledAt: null,
      warningStartedAt: null,
      activeStartedAt: null,
      recoveryStartedAt: null,
      completedAt: null,
      rangedEnemiesSpawned: 0,
      damageTakenDuringActive: 0,
      killsDuringActiveByEnemyType: { chaser: 0, brute: 0, fast: 0, ranged: 0 },
      movement: {
        baseline: { distance: 0, vector: { x: 0, y: 0 } },
        warning: { distance: 0, vector: { x: 0, y: 0 } },
        active: { distance: 0, vector: { x: 0, y: 0 } },
        recovery: { distance: 0, vector: { x: 0, y: 0 } },
      },
      contractOfferedAt: null,
      contractSelectedAt: null,
      contractChoice: null,
      eventCounts: { rangedSurge: 0, swarmRush: 0, bruteSiege: 0 },
      eventsCompleted: 0,
      collapseStartedAt: null,
      peakCollapseStage: 0,
      collapseDamageTaken: 0,
    },
  };
}
