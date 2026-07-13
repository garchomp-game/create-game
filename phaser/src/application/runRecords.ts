import {
  RUN_RANKING_LIMIT,
  RUN_RECORD_SCHEMA_VERSION,
} from "../domain/runRecords";
import type {
  CreateRunRecordInput,
  RankEligibility,
  RunComparisonKey,
  RunOrigin,
  RunRecord,
} from "../domain/runRecords";
import type { EncounterRunStats } from "../domain/types";
import { createEmptyExtraUpgradeRanks } from "../simulation/extraProgression";

export function createRankEligibility(
  runOrigin: RunOrigin,
  standardRuleset = true,
): RankEligibility {
  const reasons: RankEligibility["reasons"] = [];

  if (runOrigin === "debug") reasons.push("debugRun");
  if (runOrigin === "test") reasons.push("automatedTest");
  if (!standardRuleset) reasons.push("nonStandardRuleset");

  return {
    eligible: reasons.length === 0,
    reasons,
  };
}

export function createRunRecord(input: CreateRunRecordInput): RunRecord {
  const { context, summary } = input;

  return {
    schemaVersion: RUN_RECORD_SCHEMA_VERSION,
    id: context.id,
    profileId: context.profileId,
    capturedAt: input.capturedAt,
    modeId: context.modeId,
    stageId: context.stageId,
    difficultyId: context.difficultyId,
    weaponId: context.weaponId,
    modifierIds: [...context.modifierIds],
    appVersion: context.appVersion,
    rulesetVersion: context.rulesetVersion,
    buildCommit: context.buildCommit,
    seed: context.seed,
    seedCategory: context.seedCategory,
    runOrigin: context.runOrigin,
    rankEligibility: {
      eligible: context.rankEligibility.eligible,
      reasons: [...context.rankEligibility.reasons],
    },
    elapsed: summary.elapsed,
    score: summary.score,
    level: summary.level,
    extraLevel: summary.extraLevel,
    extraCycle: summary.extraCycle,
    threatTier: summary.threatTier,
    collapseStage: summary.collapseStage,
    kills: summary.enemiesKilled,
    damageTaken: summary.damageTaken,
    lastDamageSource: summary.lastDamageSource ? { ...summary.lastDamageSource } : null,
    shotsFired: summary.shotsFired,
    hpRecovered: summary.hpRecovered,
    upgradesChosen: summary.upgradesChosen,
    extraUpgradesChosen: summary.extraUpgradesChosen,
    upgradeRanks: { ...input.upgradeRanks },
    upgradeSelections: input.upgradeSelections.map((selection) => ({ ...selection })),
    extraUpgradeRanks: {
      ...(input.extraUpgradeRanks ?? createEmptyExtraUpgradeRanks()),
    },
    extraUpgradeSelections: (input.extraUpgradeSelections ?? []).map((selection) => ({
      ...selection,
    })),
    buildCompletedAt: input.buildCompletedAt,
    capstoneMetrics: { ...summary.capstoneMetrics },
    encounterMetrics: structuredClone(input.encounterMetrics ?? createEmptyEncounterMetrics()),
  };
}

function createEmptyEncounterMetrics(): EncounterRunStats {
  return {
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
  };
}

export function compareRunRecords(left: RunRecord, right: RunRecord): number {
  return (
    right.score - left.score ||
    right.elapsed - left.elapsed ||
    left.capturedAt.localeCompare(right.capturedAt) ||
    left.id.localeCompare(right.id)
  );
}

export function matchesComparisonKey(
  record: RunRecord,
  key: RunComparisonKey,
): boolean {
  return (
    record.modeId === key.modeId &&
    record.stageId === key.stageId &&
    record.difficultyId === key.difficultyId &&
    record.rulesetVersion === key.rulesetVersion &&
    record.seedCategory === key.seedCategory
  );
}

export function selectRanking(
  records: readonly RunRecord[],
  key: RunComparisonKey,
  limit = RUN_RANKING_LIMIT,
): RunRecord[] {
  return records
    .filter((record) => record.rankEligibility.eligible && matchesComparisonKey(record, key))
    .sort(compareRunRecords)
    .slice(0, Math.max(0, limit));
}

export function selectPersonalBest(
  records: readonly RunRecord[],
  key: RunComparisonKey,
): RunRecord | null {
  return selectRanking(records, key, 1)[0] ?? null;
}
