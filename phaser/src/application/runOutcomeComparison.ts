import { toRunCentiseconds } from "../domain/runRecords";
import type { RunFactScope } from "../domain/runFacts";
import type {
  RunOutcomePreviousDifference,
  RunOutcomePrimaryCause,
  RunOutcomeProgress,
  RunOutcomeSnapshot,
  RunRetryContext,
} from "../domain/runOutcomeInsights";

export function createRunRetryContext(scope: RunFactScope): RunRetryContext {
  return {
    profileId: scope.profileId,
    modeId: scope.modeId,
    stageId: scope.stageId,
    difficultyId: scope.difficultyId,
    weaponId: scope.weaponId,
    rulesetVersion: scope.rulesetVersion,
    seed: scope.seed,
    seedCategory: scope.seedCategory,
    modifierIds: [...scope.modifierIds],
  };
}

export function createRunOutcomeSnapshot(
  retryContext: RunRetryContext,
  progress: RunOutcomeProgress,
  primaryCause: RunOutcomePrimaryCause | null,
  totalDamage: number,
): RunOutcomeSnapshot {
  return {
    comparisonKey: JSON.stringify([
      retryContext.profileId,
      retryContext.modeId,
      retryContext.stageId,
      retryContext.difficultyId,
      retryContext.weaponId,
      retryContext.rulesetVersion,
      retryContext.seedCategory,
      retryContext.seed,
      [...retryContext.modifierIds].sort(),
    ]),
    completionKind: progress.completionKind,
    elapsed: progress.elapsed,
    score: progress.score,
    primaryCauseId: primaryCause?.causeId ?? null,
    totalDamage,
    boss: progress.boss ? { ...progress.boss } : null,
  };
}

export function compareRunOutcomePrevious(
  current: RunOutcomeSnapshot,
  previous: RunOutcomeSnapshot | null,
): RunOutcomePreviousDifference {
  if (previous === null) return { state: "not-reached", reason: "noPreviousRun" };
  if (current.comparisonKey !== previous.comparisonKey) {
    return { state: "unavailable", reason: "comparisonScopeMismatch" };
  }
  if (
    current.completionKind === "expeditionCompleted" &&
    previous.completionKind !== "expeditionCompleted"
  ) {
    return { state: "available", kind: "completion", title: "前回未完遂の作戦を完遂" };
  }
  if (
    current.boss &&
    previous.boss &&
    current.boss.phaseReached !== previous.boss.phaseReached
  ) {
    return {
      state: "available",
      kind: "bossPhase",
      title: `Boss到達 Phase ${previous.boss.phaseReached} → ${current.boss.phaseReached}`,
    };
  }
  if (
    current.boss &&
    previous.boss &&
    current.boss.remainingHp !== previous.boss.remainingHp
  ) {
    const delta = previous.boss.remainingHp - current.boss.remainingHp;
    return {
      state: "available",
      kind: "bossRemainingHp",
      title: delta > 0
        ? `Boss残HPを前回より${delta}減らした`
        : `Boss残HPが前回より${Math.abs(delta)}多い`,
    };
  }
  if (current.primaryCauseId !== previous.primaryCauseId) {
    return {
      state: "available",
      kind: "primaryCause",
      title: "終了前5秒の主な被ダメージ源が変化",
    };
  }
  const elapsedDifference = toRunCentiseconds(current.elapsed) -
    toRunCentiseconds(previous.elapsed);
  if (elapsedDifference !== 0) {
    return {
      state: "available",
      kind: "elapsed",
      title: `経過時間 ${elapsedDifference > 0 ? "+" : "-"}${Math.abs(elapsedDifference) / 100}秒`,
    };
  }
  return { state: "available", kind: "same", title: "主要な進捗差なし" };
}
