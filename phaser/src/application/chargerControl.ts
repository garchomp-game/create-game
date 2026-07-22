import {
  CHARGER_CONTROL_READ_MODEL_VERSION,
  type ChargerControlAttempt,
  type ChargerControlReadModel,
  type ChargerControlSummary,
  type ChargerControlValidationIssue,
  type ChargerObservedEvent,
} from "../domain/chargerControl";
import type { ObservedGameEvent } from "../domain/runFacts";

type AttemptBuilder = Omit<
  ChargerControlAttempt,
  "killedBeforeTelegraph"
>;

export function aggregateChargerControl(
  sourceEvents: readonly ObservedGameEvent[],
): ChargerControlReadModel {
  const events = sourceEvents.map((entry) => structuredClone(entry));
  const issues = validateObservedEvents(events);
  const ordered = [...events].sort(compareObservedEvents);
  const chargerEvents = ordered.filter(isChargerEvent);
  const attempts = new Map<string, AttemptBuilder>();

  for (const entry of chargerEvents) {
    const enemyId = entry.event.enemyId;
    if (entry.event.type === "enemy.charger.spawned") {
      if (attempts.has(enemyId)) {
        issues.push({ code: "duplicateSpawn", enemyId, sequence: entry.sequence });
        continue;
      }
      attempts.set(enemyId, createAttempt(enemyId, entry));
      continue;
    }

    const attempt = attempts.get(enemyId);
    if (!attempt) {
      issues.push({
        code: "eventBeforeSpawn",
        enemyId,
        eventType: entry.event.type,
        sequence: entry.sequence,
      });
      continue;
    }
    if (attempt.kill) {
      issues.push(entry.event.type === "enemy.charger.killed"
        ? { code: "duplicateKill", enemyId, sequence: entry.sequence }
        : {
            code: "eventAfterKill",
            enemyId,
            eventType: entry.event.type,
            sequence: entry.sequence,
          });
      continue;
    }

    switch (entry.event.type) {
      case "enemy.charger.telegraph.started":
        attempt.telegraphs += 1;
        attempt.firstTelegraphAt ??= entry.elapsed;
        break;
      case "enemy.charger.prepare.started":
        break;
      case "enemy.charger.charge.started":
        if (attempt.telegraphs === 0) {
          issues.push({
            code: "chargeBeforeTelegraph",
            enemyId,
            sequence: entry.sequence,
          });
        }
        attempt.charges += 1;
        break;
      case "enemy.charger.charge.ended":
        if (attempt.chargeEnds >= attempt.charges) {
          issues.push({
            code: "chargeEndBeforeCharge",
            enemyId,
            sequence: entry.sequence,
          });
        }
        attempt.chargeEnds += 1;
        if (entry.event.reason === "timeout") attempt.timeoutEnds += 1;
        if (entry.event.reason === "obstacle") attempt.obstacleInterruptions += 1;
        if (entry.event.reason === "arenaBoundary") attempt.boundaryInterruptions += 1;
        break;
      case "enemy.charger.recovered":
        if (attempt.recoveries >= attempt.chargeEnds) {
          issues.push({
            code: "recoveryBeforeChargeEnd",
            enemyId,
            sequence: entry.sequence,
          });
        }
        attempt.recoveries += 1;
        break;
      case "enemy.charger.player.hit":
        attempt.playerHits += 1;
        break;
      case "enemy.charger.killed":
        if (entry.event.chargesStarted !== attempt.charges) {
          issues.push({
            code: "killChargeCountMismatch",
            enemyId,
            sequence: entry.sequence,
            observed: entry.event.chargesStarted,
            aggregated: attempt.charges,
          });
        }
        attempt.kill = {
          elapsed: entry.elapsed,
          sequence: entry.sequence,
          phase: entry.event.phase,
          weaponId: entry.event.weaponType,
        };
        break;
    }
  }

  const sortedIssues = issues.sort(compareIssues);
  if (sortedIssues.length > 0) {
    return {
      schemaVersion: CHARGER_CONTROL_READ_MODEL_VERSION,
      validation: { state: "invalid", issues: sortedIssues },
      observedEventCount: events.length,
      chargerEventCount: chargerEvents.length,
      attempts: [],
      summary: null,
    };
  }

  const completedAttempts = [...attempts.values()]
    .sort((left, right) =>
      left.spawnedAt - right.spawnedAt ||
      left.spawnSequence - right.spawnSequence ||
      left.enemyId.localeCompare(right.enemyId)
    )
    .map(finalizeAttempt);

  return {
    schemaVersion: CHARGER_CONTROL_READ_MODEL_VERSION,
    validation: { state: "available" },
    observedEventCount: events.length,
    chargerEventCount: chargerEvents.length,
    attempts: completedAttempts,
    summary: summarizeAttempts(completedAttempts),
  };
}

function validateObservedEvents(
  events: readonly ObservedGameEvent[],
): ChargerControlValidationIssue[] {
  const issues: ChargerControlValidationIssue[] = [];
  const sequenceCounts = new Map<number, number>();
  for (const [inputIndex, entry] of events.entries()) {
    if (!Number.isInteger(entry.sequence) || entry.sequence < 0) {
      issues.push({ code: "invalidSequence", inputIndex });
    } else {
      sequenceCounts.set(entry.sequence, (sequenceCounts.get(entry.sequence) ?? 0) + 1);
    }
    if (!Number.isFinite(entry.elapsed) || entry.elapsed < 0) {
      issues.push({ code: "invalidElapsed", inputIndex });
    }
  }
  for (const [sequence, count] of sequenceCounts) {
    if (count > 1) issues.push({ code: "duplicateSequence", sequence });
  }
  return issues;
}

function isChargerEvent(entry: ObservedGameEvent): entry is ChargerObservedEvent {
  return entry.event.type.startsWith("enemy.charger.");
}

function createAttempt(
  enemyId: string,
  entry: ChargerObservedEvent,
): AttemptBuilder {
  return {
    enemyId,
    spawnedAt: entry.elapsed,
    spawnSequence: entry.sequence,
    firstTelegraphAt: null,
    telegraphs: 0,
    charges: 0,
    chargeEnds: 0,
    timeoutEnds: 0,
    obstacleInterruptions: 0,
    boundaryInterruptions: 0,
    recoveries: 0,
    playerHits: 0,
    kill: null,
  };
}

function finalizeAttempt(attempt: AttemptBuilder): ChargerControlAttempt {
  return {
    ...attempt,
    kill: attempt.kill ? { ...attempt.kill } : null,
    killedBeforeTelegraph: attempt.kill !== null && attempt.firstTelegraphAt === null,
  };
}

function summarizeAttempts(attempts: readonly ChargerControlAttempt[]): ChargerControlSummary {
  return {
    opportunityState: attempts.length > 0 ? "observed" : "not-reached",
    spawned: attempts.length,
    killed: attempts.filter((attempt) => attempt.kill !== null).length,
    killedBeforeTelegraph: attempts.filter((attempt) => attempt.killedBeforeTelegraph).length,
    enemiesTelegraphed: attempts.filter((attempt) => attempt.telegraphs > 0).length,
    telegraphs: sum(attempts, (attempt) => attempt.telegraphs),
    enemiesCharged: attempts.filter((attempt) => attempt.charges > 0).length,
    charges: sum(attempts, (attempt) => attempt.charges),
    chargeEnds: sum(attempts, (attempt) => attempt.chargeEnds),
    timeoutEnds: sum(attempts, (attempt) => attempt.timeoutEnds),
    obstacleInterruptions: sum(attempts, (attempt) => attempt.obstacleInterruptions),
    boundaryInterruptions: sum(attempts, (attempt) => attempt.boundaryInterruptions),
    recoveries: sum(attempts, (attempt) => attempt.recoveries),
    playerHits: sum(attempts, (attempt) => attempt.playerHits),
  };
}

function sum(
  attempts: readonly ChargerControlAttempt[],
  select: (attempt: ChargerControlAttempt) => number,
): number {
  return attempts.reduce((total, attempt) => total + select(attempt), 0);
}

function compareObservedEvents(left: ObservedGameEvent, right: ObservedGameEvent): number {
  return left.elapsed - right.elapsed || left.sequence - right.sequence;
}

function compareIssues(
  left: ChargerControlValidationIssue,
  right: ChargerControlValidationIssue,
): number {
  return JSON.stringify(left).localeCompare(JSON.stringify(right));
}
