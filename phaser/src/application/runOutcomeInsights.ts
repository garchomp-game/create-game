import type {
  ObservedGameEvent,
  RunFactReadModel,
} from "../domain/runFacts";
import {
  RUN_OUTCOME_INSIGHT_VERSION,
  type RunOutcomeInsightViewModel,
  type RunOutcomeSnapshot,
} from "../domain/runOutcomeInsights";
import {
  createRunOutcomeNextAction,
  createRunOutcomePrimaryCause,
} from "./runOutcomeCause";
import {
  compareRunOutcomePrevious,
  createRunOutcomeSnapshot,
  createRunRetryContext,
} from "./runOutcomeComparison";
import {
  createRunOutcomeNearMissEvidence,
  createRunOutcomeProgress,
} from "./runOutcomeProgress";

export function createRunOutcomeInsight(
  sourceFacts: RunFactReadModel,
  sourceEvents: readonly ObservedGameEvent[],
  previousSnapshot: RunOutcomeSnapshot | null = null,
): RunOutcomeInsightViewModel {
  const facts = structuredClone(sourceFacts);
  const events = sourceEvents.map((entry) => structuredClone(entry));
  if (facts.validation.state === "invalid") {
    return {
      schemaVersion: RUN_OUTCOME_INSIGHT_VERSION,
      state: "invalid",
      issues: facts.validation.issues.map((issue) => ({ ...issue })),
    };
  }
  if (facts.completion.state !== "available" || facts.summary === null) {
    return {
      schemaVersion: RUN_OUTCOME_INSIGHT_VERSION,
      state: "not-reached",
      reason: "runNotTerminated",
    };
  }

  const orderedEvents = [...events].sort(compareObservedEvents);
  const progress = createRunOutcomeProgress(
    orderedEvents,
    facts.completion.value,
  );
  const primaryCause = createRunOutcomePrimaryCause(
    facts.summary.damage.timeline,
    facts.completion.value.elapsed,
  );
  const nextAction = progress.completionKind === "expeditionCompleted"
    ? null
    : createRunOutcomeNextAction(primaryCause, progress.pressure);
  const retryContext = createRunRetryContext(facts.scope);
  const snapshot = createRunOutcomeSnapshot(
    retryContext,
    progress,
    primaryCause,
    facts.summary.damage.total,
  );

  return {
    schemaVersion: RUN_OUTCOME_INSIGHT_VERSION,
    state: "available",
    retryContext,
    primaryCause,
    nextAction,
    progress,
    nearMiss: createRunOutcomeNearMissEvidence(progress),
    previousDifference: compareRunOutcomePrevious(snapshot, previousSnapshot),
    snapshot,
  };
}

function compareObservedEvents(
  left: ObservedGameEvent,
  right: ObservedGameEvent,
): number {
  return left.elapsed - right.elapsed || left.sequence - right.sequence;
}
