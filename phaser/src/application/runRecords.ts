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
    kills: summary.enemiesKilled,
    damageTaken: summary.damageTaken,
    lastDamageSource: summary.lastDamageSource ? { ...summary.lastDamageSource } : null,
    shotsFired: summary.shotsFired,
    hpRecovered: summary.hpRecovered,
    upgradesChosen: summary.upgradesChosen,
    upgradeRanks: { ...input.upgradeRanks },
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
