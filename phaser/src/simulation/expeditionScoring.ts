import type { StageCompletionScoringDefinition } from "../domain/gameContent";
import type { ExpeditionOutcome, ExpeditionTimeMedal } from "../domain/types";
import { normalizeRunTime } from "../domain/runRecords";

export type ExpeditionCompletionRewards = {
  clearScoreBonus: number;
  timeScoreBonus: 0;
  timeMedal: ExpeditionTimeMedal | null;
};

export function calculateExpeditionCompletionRewards(
  outcome: ExpeditionOutcome,
  runElapsed: number,
  scoring: StageCompletionScoringDefinition | undefined,
): ExpeditionCompletionRewards {
  if (outcome !== "victory" || !scoring) {
    return { clearScoreBonus: 0, timeScoreBonus: 0, timeMedal: null };
  }

  return {
    clearScoreBonus: scoring.clearBonus,
    timeScoreBonus: 0,
    timeMedal: resolveExpeditionTimeMedal(runElapsed, scoring.timeMedalSeconds),
  };
}

export function resolveExpeditionTimeMedal(
  runElapsed: number,
  thresholds: StageCompletionScoringDefinition["timeMedalSeconds"],
): ExpeditionTimeMedal | null {
  const elapsed = normalizeRunTime(runElapsed);
  if (elapsed <= thresholds.gold) return "gold";
  if (elapsed <= thresholds.silver) return "silver";
  if (elapsed <= thresholds.bronze) return "bronze";
  return null;
}
