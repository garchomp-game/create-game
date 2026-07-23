import type { RunContext } from "../domain/runRecords";
import {
  RUN_FACT_READ_MODEL_VERSION,
  type ObservedGameEvent,
  type RunCompletionFact,
  type RunDamageFact,
  type RunFactEpisodeScope,
  type RunFactHistoryExclusion,
  type RunFactReadModel,
  type RunFactScope,
  type RunFactState,
  type RunFactSummary,
  type RunFactValidationIssue,
  type RunKillFact,
  type RunRecoveryFact,
} from "../domain/runFacts";
import type { EnemyTypeId, GameEvent } from "../domain/types";

export function createRunFactScope(context: RunContext): RunFactScope {
  return {
    runId: context.id,
    profileId: context.profileId,
    modeId: context.modeId,
    stageId: context.stageId,
    difficultyId: context.difficultyId,
    weaponId: context.weaponId,
    rulesetVersion: context.rulesetVersion,
    seed: context.seed,
    seedCategory: context.seedCategory,
    modifierIds: [...context.modifierIds],
    appVersion: context.appVersion,
    buildCommit: context.buildCommit,
    runOrigin: context.runOrigin,
    rankEligibility: {
      eligible: context.rankEligibility.eligible,
      reasons: [...context.rankEligibility.reasons],
    },
  };
}

export function createRunFactEpisodeId(
  scope: Pick<RunFactScope, "runId">,
  episode: RunFactEpisodeScope,
): string {
  if (!scope.runId.trim()) throw new Error("Run fact episode requires a run ID.");
  if (!Number.isInteger(episode.occurrence) || episode.occurrence < 0) {
    throw new Error("Run fact episode occurrence must be a non-negative integer.");
  }
  if (episode.subjectId !== null && !episode.subjectId.trim()) {
    throw new Error("Run fact episode subject must be null or non-empty.");
  }

  return [
    "fact",
    encodeURIComponent(scope.runId),
    episode.kind,
    episode.subjectId === null ? "_" : encodeURIComponent(episode.subjectId),
    episode.occurrence,
  ].join(":");
}

export function aggregateRunFacts(
  sourceScope: RunFactScope,
  sourceEvents: readonly ObservedGameEvent[],
): RunFactReadModel {
  const scope = cloneScope(sourceScope);
  const events = sourceEvents.map((entry) => structuredClone(entry));
  const issues = validateInput(scope, events);
  const runEpisodeId = scope.runId.trim()
    ? createRunFactEpisodeId(scope, {
        kind: "run",
        subjectId: null,
        occurrence: 0,
      })
    : null;

  if (issues.length > 0 || runEpisodeId === null) {
    const invalidIssues =
      issues.length > 0 ? issues : [{ code: "missingRunId" as const }];
    const invalidState = () => ({
      state: "invalid" as const,
      issues: invalidIssues.map((issue) => ({ ...issue })),
    });
    return {
      schemaVersion: RUN_FACT_READ_MODEL_VERSION,
      scope,
      runEpisodeId,
      validation: invalidState(),
      standardHistory: invalidState(),
      completion: invalidState(),
      summary: null,
    };
  }

  const ordered = [...events].sort(compareObservedEvents);
  return {
    schemaVersion: RUN_FACT_READ_MODEL_VERSION,
    scope,
    runEpisodeId,
    validation: { state: "available", value: true },
    standardHistory: resolveStandardHistory(scope),
    completion: resolveCompletion(ordered),
    summary: summarizeEvents(runEpisodeId, ordered),
  };
}

function validateInput(
  scope: RunFactScope,
  events: readonly ObservedGameEvent[],
): RunFactValidationIssue[] {
  const issues: RunFactValidationIssue[] = [];
  if (!scope.runId.trim()) issues.push({ code: "missingRunId" });
  if (
    scope.rankEligibility.eligible !==
    (scope.rankEligibility.reasons.length === 0)
  ) {
    issues.push({ code: "inconsistentRankEligibility" });
  }

  const sequences = new Map<number, number>();
  for (const [inputIndex, entry] of events.entries()) {
    if (!Number.isInteger(entry.sequence) || entry.sequence < 0) {
      issues.push({ code: "invalidSequence", inputIndex });
    } else {
      sequences.set(entry.sequence, (sequences.get(entry.sequence) ?? 0) + 1);
    }
    if (!Number.isFinite(entry.elapsed) || entry.elapsed < 0) {
      issues.push({ code: "invalidElapsed", inputIndex });
    }
  }
  for (const [sequence, count] of [...sequences.entries()].sort(
    ([left], [right]) => left - right,
  )) {
    if (count > 1) issues.push({ code: "duplicateSequence", sequence });
  }

  const startedCount = countEvents(events, "game.started");
  if (startedCount === 0) issues.push({ code: "missingGameStarted" });
  if (startedCount > 1) {
    issues.push({ code: "multipleGameStarted", count: startedCount });
  }

  const gameOverCount = countEvents(events, "game.over");
  if (gameOverCount > 1) {
    issues.push({ code: "multipleGameOver", count: gameOverCount });
  }

  const expeditionCompletedCount = countEvents(events, "expedition.completed");
  const expeditionFailedCount = countEvents(events, "expedition.failed");
  if (expeditionCompletedCount > 1) {
    issues.push({
      code: "multipleExpeditionTerminal",
      terminalType: "expedition.completed",
      count: expeditionCompletedCount,
    });
  }
  if (expeditionFailedCount > 1) {
    issues.push({
      code: "multipleExpeditionTerminal",
      terminalType: "expedition.failed",
      count: expeditionFailedCount,
    });
  }
  if (expeditionCompletedCount > 0 && expeditionFailedCount > 0) {
    issues.push({ code: "contradictoryExpeditionTerminal" });
  }

  return issues.sort((left, right) =>
    JSON.stringify(left).localeCompare(JSON.stringify(right)),
  );
}

function countEvents(
  events: readonly ObservedGameEvent[],
  type: GameEvent["type"],
): number {
  return events.reduce(
    (count, entry) => count + Number(entry.event.type === type),
    0,
  );
}

function compareObservedEvents(
  left: ObservedGameEvent,
  right: ObservedGameEvent,
): number {
  return (
    left.elapsed - right.elapsed ||
    left.sequence - right.sequence ||
    left.event.type.localeCompare(right.event.type)
  );
}

function resolveStandardHistory(
  scope: RunFactScope,
): RunFactState<true, RunFactHistoryExclusion> {
  const reasons: RunFactHistoryExclusion[] = [];
  if (scope.runOrigin !== "manual") {
    reasons.push({ code: "nonManualRun", runOrigin: scope.runOrigin });
  }
  for (const reason of scope.rankEligibility.reasons) {
    reasons.push({ code: "rankIneligible", reason });
  }
  return reasons.length > 0
    ? { state: "unavailable", reasons }
    : { state: "available", value: true };
}

function resolveCompletion(
  events: readonly ObservedGameEvent[],
): RunFactState<RunCompletionFact> {
  const expeditionCompleted = findEvent(events, "expedition.completed");
  if (expeditionCompleted?.event.type === "expedition.completed") {
    return {
      state: "available",
      value: {
        kind: "expeditionCompleted",
        elapsed: expeditionCompleted.event.elapsed,
        score: expeditionCompleted.event.score,
        tacticalScore: expeditionCompleted.event.tacticalScore,
        actId: expeditionCompleted.event.actId,
      },
    };
  }

  const expeditionFailed = findEvent(events, "expedition.failed");
  if (expeditionFailed?.event.type === "expedition.failed") {
    return {
      state: "available",
      value: {
        kind: "expeditionFailed",
        elapsed: expeditionFailed.event.elapsed,
        score: expeditionFailed.event.score,
        tacticalScore: expeditionFailed.event.tacticalScore,
        actId: expeditionFailed.event.actId,
      },
    };
  }

  const gameOver = findEvent(events, "game.over");
  if (gameOver?.event.type === "game.over") {
    return {
      state: "available",
      value: {
        kind: "gameOver",
        elapsed: gameOver.event.elapsed,
        score: gameOver.event.score,
        tacticalScore: null,
        actId: null,
      },
    };
  }

  return { state: "not-reached", reason: "runNotTerminated" };
}

function findEvent<T extends GameEvent["type"]>(
  events: readonly ObservedGameEvent[],
  type: T,
): ObservedGameEvent | undefined {
  return events.find((entry) => entry.event.type === type);
}

function summarizeEvents(
  runEpisodeId: string,
  events: readonly ObservedGameEvent[],
): RunFactSummary {
  const damageTimeline: RunDamageFact[] = [];
  const recoveryTimeline: RunRecoveryFact[] = [];
  const killTimeline: RunKillFact[] = [];

  for (const entry of events) {
    const factId = `${runEpisodeId}:event:${entry.sequence}`;
    if (entry.event.type === "player.damaged") {
      damageTimeline.push({
        factId,
        episodeId: runEpisodeId,
        sequence: entry.sequence,
        elapsed: entry.elapsed,
        damage: entry.event.damage,
        hpAfter: entry.event.hpAfter,
        source: entry.event.source ? structuredClone(entry.event.source) : null,
      });
      continue;
    }
    if (
      entry.event.type === "pickup.collected" &&
      entry.event.pickupKind === "heal"
    ) {
      recoveryTimeline.push({
        factId,
        episodeId: runEpisodeId,
        sequence: entry.sequence,
        elapsed: entry.elapsed,
        healValue: entry.event.healValue,
        hpRecovered: entry.event.hpRecovered,
      });
      continue;
    }
    if (
      entry.event.type === "enemy.killed" ||
      entry.event.type === "enemy.protocol.killed"
    ) {
      killTimeline.push({
        factId,
        episodeId: runEpisodeId,
        sequence: entry.sequence,
        elapsed: entry.elapsed,
        enemyId: entry.event.enemyId,
        enemyType: entry.event.enemyType,
        weaponId: entry.event.weaponType,
        scoreAwarded: entry.event.scoreAwarded,
        xpAwarded: entry.event.xpAwarded,
      });
    }
  }

  const damageBySource = {
    contact: 0,
    projectile: 0,
    collapse: 0,
    unknown: 0,
  };
  for (const fact of damageTimeline) {
    damageBySource[fact.source?.kind ?? "unknown"] += fact.damage;
  }
  const killsByEnemyType = createEnemyTypeCounts();
  for (const fact of killTimeline) killsByEnemyType[fact.enemyType] += 1;

  return {
    observedEventCount: events.length,
    observedElapsed: {
      first: events[0]?.elapsed ?? 0,
      last: events.at(-1)?.elapsed ?? 0,
    },
    damage: {
      total: damageTimeline.reduce((total, fact) => total + fact.damage, 0),
      hits: damageTimeline.length,
      bySource: damageBySource,
      timeline: damageTimeline,
      last: damageTimeline.at(-1) ?? null,
    },
    recovery: {
      pickups: recoveryTimeline.length,
      offered: recoveryTimeline.reduce(
        (total, fact) => total + fact.healValue,
        0,
      ),
      recovered: recoveryTimeline.reduce(
        (total, fact) => total + fact.hpRecovered,
        0,
      ),
      timeline: recoveryTimeline,
    },
    combat: {
      kills: killTimeline.length,
      scoreAwarded: killTimeline.reduce(
        (total, fact) => total + fact.scoreAwarded,
        0,
      ),
      xpAwarded: killTimeline.reduce(
        (total, fact) => total + fact.xpAwarded,
        0,
      ),
      killsByEnemyType,
      timeline: killTimeline,
    },
  };
}

function createEnemyTypeCounts(): Record<EnemyTypeId, number> {
  return { chaser: 0, brute: 0, fast: 0, ranged: 0 };
}

function cloneScope(scope: RunFactScope): RunFactScope {
  return {
    ...scope,
    modifierIds: [...scope.modifierIds],
    rankEligibility: {
      eligible: scope.rankEligibility.eligible,
      reasons: [...scope.rankEligibility.reasons],
    },
  };
}
