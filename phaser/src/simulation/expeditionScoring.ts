import type { StageCompletionScoringDefinition } from "../domain/gameContent";
import type { ExpeditionOutcome, ExpeditionTimeMedal } from "../domain/types";

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
  if (runElapsed <= thresholds.gold) return "gold";
  if (runElapsed <= thresholds.silver) return "silver";
  if (runElapsed <= thresholds.bronze) return "bronze";
  return null;
}
