import { describe, expect, it } from "vitest";
import type { ObservedGameEvent, RunFactScope } from "../domain/runFacts";
import type { RunOutcomeSnapshot } from "../domain/runOutcomeInsights";
import type { GameEvent, PlayerDamageSource } from "../domain/types";
import { aggregateRunFacts } from "./runFactKernel";
import { createRunOutcomeInsight } from "./runOutcomeInsights";

describe("createRunOutcomeInsight", () => {
  it("uses the five-second damage contribution instead of renaming the final hit", () => {
    const finalHit = projectile("final-shot");
    const contactRun = completedFacts([
      damage(1, 96, 7, contact("fast")),
      damage(2, 97, 7, contact("fast")),
      damage(3, 100, 4, finalHit, 0),
    ]);
    const projectileRun = completedFacts([
      damage(1, 96, 8, projectile("shot-a")),
      damage(2, 97, 8, projectile("shot-b")),
      damage(3, 100, 4, finalHit, 0),
    ]);

    const contactInsight = createRunOutcomeInsight(
      contactRun.facts,
      contactRun.events,
    );
    const projectileInsight = createRunOutcomeInsight(
      projectileRun.facts,
      projectileRun.events,
    );

    expect(contactInsight).toMatchObject({
      state: "available",
      primaryCause: {
        causeId: "contact:fast",
        damage: 14,
        isFinalHit: false,
      },
      nextAction: { id: "preserve-escape-route" },
    });
    expect(projectileInsight).toMatchObject({
      state: "available",
      primaryCause: {
        causeId: "projectile",
        damage: 20,
        isFinalHit: true,
      },
      nextAction: { id: "change-projectile-line" },
    });
  });

  it("returns boss facts without classifying an unregistered near miss", () => {
    const run = completedFacts([
      observed(1, 80, {
        type: "boss.spawned",
        bossId: "command-ship",
        enemyId: "boss-enemy",
        position: { x: 480, y: 120 },
        maximumHp: 3400,
        repairBudgetInitial: null,
        elapsed: 80,
      }),
      observed(2, 90, {
        type: "boss.phase.changed",
        bossId: "command-ship",
        enemyId: "boss-enemy",
        phase: 2,
        elapsed: 90,
      }),
      observed(3, 98, bossHit(620)),
      damage(4, 100, 34, bossProjectile("command-pulse"), 0),
    ], "expedition");

    const insight = createRunOutcomeInsight(run.facts, run.events);

    expect(insight).toMatchObject({
      state: "available",
      primaryCause: {
        causeId: "boss:command-pulse",
        title: "指揮艦の制圧衝撃波",
      },
      nextAction: { id: "use-cover-or-exit-radius" },
      progress: {
        boss: {
          phaseReached: 2,
          maximumHp: 3400,
          remainingHp: 620,
          defeated: false,
        },
        pressure: { bossActive: true },
      },
      nearMiss: {
        state: "evidence-only",
        reason: "thresholdNotRegistered",
        bossRemainingHp: 620,
        bossPhaseReached: 2,
      },
    });
  });

  it("does not produce near-miss evidence before the boss or after victory", () => {
    const defeat = completedFacts([
      damage(1, 100, 10, contact("chaser"), 0),
    ], "expedition");
    expect(createRunOutcomeInsight(defeat.facts, defeat.events)).toMatchObject({
      state: "available",
      nearMiss: { state: "not-reached", reason: "bossNotReached" },
    });

    const victoryEvents = baseEvents([
      observed(1, 80, {
        type: "boss.spawned",
        bossId: "command-ship",
        enemyId: "boss-enemy",
        position: { x: 480, y: 120 },
        maximumHp: 3400,
        repairBudgetInitial: null,
        elapsed: 80,
      }),
      observed(2, 99, {
        type: "boss.defeated",
        bossId: "command-ship",
        enemyId: "boss-enemy",
        weaponType: "pulse",
        position: { x: 480, y: 120 },
        elapsed: 99,
      }),
      observed(3, 100, expeditionCompleted()),
    ]);
    const victoryFacts = aggregateRunFacts(scope("expedition"), victoryEvents);
    expect(createRunOutcomeInsight(victoryFacts, victoryEvents)).toMatchObject({
      state: "available",
      nextAction: null,
      progress: { boss: { remainingHp: 0, defeated: true } },
      nearMiss: { state: "not-applicable", reason: "runCompleted" },
    });
  });

  it("copies retry context and rejects previous-run comparisons across scopes", () => {
    const run = completedFacts([
      damage(1, 100, 10, contact("chaser"), 0),
    ]);
    const mismatch: RunOutcomeSnapshot = {
      comparisonKey: "different",
      completionKind: "gameOver",
      elapsed: 90,
      score: 100,
      primaryCauseId: "contact:chaser",
      totalDamage: 10,
      boss: null,
    };
    const insight = createRunOutcomeInsight(run.facts, run.events, mismatch);

    expect(insight).toMatchObject({
      state: "available",
      retryContext: {
        modeId: "endless",
        stageId: "arena-default",
        difficultyId: "standard",
        weaponId: "pulse",
        rulesetVersion: "rules-control",
        seed: 77,
        seedCategory: "fixed",
        modifierIds: [],
      },
      previousDifference: {
        state: "unavailable",
        reason: "comparisonScopeMismatch",
      },
    });
  });

  it("reports factual progress against the same previous scope", () => {
    const previousRun = completedFacts([
      observed(1, 80, bossSpawned()),
      observed(2, 98, bossHit(1200)),
      damage(3, 100, 10, contact("chaser"), 0),
    ], "expedition");
    const previous = createRunOutcomeInsight(
      previousRun.facts,
      previousRun.events,
    );
    expect(previous.state).toBe("available");

    const currentRun = completedFacts([
      observed(1, 80, bossSpawned()),
      observed(2, 98, bossHit(700)),
      damage(3, 100, 10, contact("chaser"), 0),
    ], "expedition");
    const current = createRunOutcomeInsight(
      currentRun.facts,
      currentRun.events,
      previous.state === "available" ? previous.snapshot : null,
    );

    expect(current).toMatchObject({
      state: "available",
      previousDifference: {
        state: "available",
        kind: "bossRemainingHp",
        title: "Boss残HPを前回より500減らした",
      },
    });
  });

  it("preserves inputs, ignores input ordering, and waits for a terminal fact", () => {
    const run = completedFacts([
      damage(1, 99, 6, projectile("shot-a")),
      damage(2, 100, 6, projectile("shot-b"), 0),
    ]);
    const factsBefore = structuredClone(run.facts);
    const eventsBefore = structuredClone(run.events);
    const ordered = createRunOutcomeInsight(run.facts, run.events);
    const shuffled = createRunOutcomeInsight(run.facts, [...run.events].reverse());

    expect(shuffled).toEqual(ordered);
    expect(run.facts).toEqual(factsBefore);
    expect(run.events).toEqual(eventsBefore);

    const incompleteEvents = baseEvents([]);
    const incompleteFacts = aggregateRunFacts(scope(), incompleteEvents);
    expect(createRunOutcomeInsight(incompleteFacts, incompleteEvents)).toEqual({
      schemaVersion: 1,
      state: "not-reached",
      reason: "runNotTerminated",
    });
  });

  it("propagates invalid Run Fact input without inventing an outcome", () => {
    const invalidEvents = [
      observed(0, 100, { type: "game.over", score: 0, elapsed: 100 }),
    ];
    const invalidFacts = aggregateRunFacts(scope(), invalidEvents);

    expect(createRunOutcomeInsight(invalidFacts, invalidEvents)).toMatchObject({
      schemaVersion: 1,
      state: "invalid",
      issues: expect.arrayContaining([{ code: "missingGameStarted" }]),
    });
  });
});

function completedFacts(
  middle: ObservedGameEvent[],
  modeId: "endless" | "expedition" = "endless",
) {
  const terminal = modeId === "expedition"
    ? observed(900, 100, expeditionFailed())
    : observed(900, 100, { type: "game.over", score: 2000, elapsed: 100 });
  const events = baseEvents([...middle, terminal]);
  return { facts: aggregateRunFacts(scope(modeId), events), events };
}

function baseEvents(events: ObservedGameEvent[]): ObservedGameEvent[] {
  return [observed(0, 0, { type: "game.started" }), ...events];
}

function scope(modeId: "endless" | "expedition" = "endless"): RunFactScope {
  return {
    runId: `run-${modeId}`,
    profileId: "profile-1",
    modeId,
    stageId: modeId === "expedition" ? "final-expedition" : "arena-default",
    difficultyId: "standard",
    weaponId: "pulse",
    rulesetVersion: "rules-control",
    seed: 77,
    seedCategory: "fixed",
    modifierIds: [],
    appVersion: "0.7.0",
    buildCommit: "abcdef12",
    runOrigin: "manual",
    rankEligibility: { eligible: true, reasons: [] },
  };
}

function damage(
  sequence: number,
  elapsed: number,
  amount: number,
  source: PlayerDamageSource,
  hpAfter = 50,
): ObservedGameEvent {
  return observed(sequence, elapsed, {
    type: "player.damaged",
    damage: amount,
    hpAfter,
    source,
  });
}

function contact(enemyType: "chaser" | "brute" | "fast" | "ranged"): PlayerDamageSource {
  return { kind: "contact", enemyId: `enemy-${enemyType}`, enemyType };
}

function projectile(projectileId: string): PlayerDamageSource {
  return { kind: "projectile", projectileId };
}

function bossProjectile(
  bossAttackId: "targeted-salvo" | "escort-pincer" | "command-pulse",
): PlayerDamageSource {
  return {
    kind: "projectile",
    projectileId: `boss-${bossAttackId}`,
    bossId: "command-ship",
    bossAttackId,
  };
}

function bossSpawned(): GameEvent {
  return {
    type: "boss.spawned",
    bossId: "command-ship",
    enemyId: "boss-enemy",
    position: { x: 480, y: 120 },
    maximumHp: 3400,
    repairBudgetInitial: null,
    elapsed: 80,
  };
}

function bossHit(hpAfter: number): GameEvent {
  return {
    type: "enemy.hit",
    bulletId: "bullet-1",
    volleyId: 1,
    enemyId: "boss-enemy",
    enemyType: "brute",
    weaponType: "pulse",
    ricochetsUsed: 0,
    ricochetSurfaceKind: null,
    ricochetBoundarySide: null,
    damage: 10,
    hpAfter,
  };
}

function expeditionFailed(): GameEvent {
  return {
    type: "expedition.failed",
    actId: "command-ship",
    elapsed: 100,
    score: 2000,
    tacticalScore: 2000,
    scoreBeforeBonus: 2000,
    clearScoreBonus: 0,
    timeScoreBonus: 0,
    timeMedal: null,
    bossFightDuration: 20,
  };
}

function expeditionCompleted(): GameEvent {
  return {
    type: "expedition.completed",
    actId: "command-ship",
    elapsed: 100,
    score: 17_000,
    tacticalScore: 2000,
    scoreBeforeBonus: 2000,
    clearScoreBonus: 15_000,
    timeScoreBonus: 0,
    timeMedal: "gold",
    bossFightDuration: 20,
  };
}

function observed(
  sequence: number,
  elapsed: number,
  event: GameEvent,
): ObservedGameEvent {
  return { sequence, elapsed, event };
}
