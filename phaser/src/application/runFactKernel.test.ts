import { describe, expect, it } from "vitest";
import type { RunContext } from "../domain/runRecords";
import type { ObservedGameEvent, RunFactScope } from "../domain/runFacts";
import { createRankEligibility } from "./runRecords";
import {
  aggregateRunFacts,
  createRunFactEpisodeId,
  createRunFactScope,
} from "./runFactKernel";

describe("runFactKernel", () => {
  it("copies reproducible run scope and creates escaped episode IDs", () => {
    const context = makeContext();
    const scope = createRunFactScope(context);
    context.modifierIds.push("late-change");
    context.rankEligibility.reasons.push("debugRun");

    expect(scope).toMatchObject({
      runId: "run:alpha/1",
      profileId: "guest-1",
      modeId: "expedition",
      stageId: "final-expedition",
      difficultyId: "standard",
      weaponId: "pulse",
      rulesetVersion: "rules-rc6",
      seed: 20260721,
      seedCategory: "fixed",
      modifierIds: ["auto-fire:on"],
      runOrigin: "manual",
      rankEligibility: { eligible: true, reasons: [] },
    });
    expect(
      createRunFactEpisodeId(scope, {
        kind: "opportunity",
        subjectId: "charger/enemy:1",
        occurrence: 2,
      }),
    ).toBe(
      "fact:run%3Aalpha%2F1:opportunity:charger%2Fenemy%3A1:2",
    );
  });

  it("normalizes event order and aggregates candidate-independent facts", () => {
    const events = makeCompletedEvents();
    const shuffled = [
      events[5]!,
      events[2]!,
      events[0]!,
      events[4]!,
      events[1]!,
      events[3]!,
    ];

    const first = aggregateRunFacts(createRunFactScope(makeContext()), events);
    const second = aggregateRunFacts(createRunFactScope(makeContext()), shuffled);

    expect(second).toEqual(first);
    expect(first.validation).toEqual({ state: "available", value: true });
    expect(first.standardHistory).toEqual({ state: "available", value: true });
    expect(first.completion).toEqual({
      state: "available",
      value: {
        kind: "gameOver",
        elapsed: 5,
        score: 120,
        tacticalScore: null,
        actId: null,
      },
    });
    expect(first.summary).toMatchObject({
      observedEventCount: 6,
      observedElapsed: { first: 0, last: 5 },
      damage: {
        total: 10,
        hits: 2,
        bySource: { contact: 7, projectile: 0, collapse: 3, unknown: 0 },
        last: { sequence: 4, elapsed: 4, damage: 3 },
      },
      recovery: { pickups: 1, offered: 12, recovered: 6 },
      combat: {
        kills: 1,
        scoreAwarded: 25,
        xpAwarded: 2,
        killsByEnemyType: { chaser: 0, brute: 0, fast: 0, ranged: 1 },
      },
    });
    expect(first.summary?.damage.timeline.map((fact) => fact.sequence)).toEqual([
      1,
      4,
    ]);
  });

  it("uses sequence as the deterministic tie-break at the same elapsed time", () => {
    const events: ObservedGameEvent[] = [
      observed(0, 0, { type: "game.started" }),
      observed(2, 1, {
        type: "player.damaged",
        damage: 4,
        hpAfter: 89,
        source: { kind: "collapse", stage: 1 },
      }),
      observed(1, 1, {
        type: "player.damaged",
        damage: 7,
        hpAfter: 93,
        source: {
          kind: "contact",
          enemyId: "enemy-1",
          enemyType: "chaser",
        },
      }),
    ];

    const result = aggregateRunFacts(createRunFactScope(makeContext()), events);

    expect(result.summary?.damage.timeline.map((fact) => fact.sequence)).toEqual([
      1,
      2,
    ]);
    expect(result.summary?.damage.last?.source).toEqual({
      kind: "collapse",
      stage: 1,
    });
  });

  it("uses the Expedition result when it is paired with game over", () => {
    const result = aggregateRunFacts(createRunFactScope(makeContext()), [
      observed(0, 0, { type: "game.started" }),
      observed(1, 480, {
        type: "expedition.completed",
        actId: "command-ship",
        elapsed: 480,
        score: 35_000,
        tacticalScore: 20_000,
        scoreBeforeBonus: 20_000,
        clearScoreBonus: 15_000,
        timeScoreBonus: 0,
        timeMedal: "gold",
        bossFightDuration: 80,
      }),
      observed(2, 480, { type: "game.over", score: 35_000, elapsed: 480 }),
    ]);

    expect(result.completion).toEqual({
      state: "available",
      value: {
        kind: "expeditionCompleted",
        elapsed: 480,
        score: 35_000,
        tacticalScore: 20_000,
        actId: "command-ship",
      },
    });
  });

  it("separates a valid unfinished run from unavailable Standard history", () => {
    const unfinished = aggregateRunFacts(createRunFactScope(makeContext()), [
      observed(0, 0, { type: "game.started" }),
    ]);
    expect(unfinished.completion).toEqual({
      state: "not-reached",
      reason: "runNotTerminated",
    });
    expect(unfinished.summary).not.toBeNull();

    const debugContext = makeContext();
    debugContext.runOrigin = "debug";
    debugContext.rankEligibility = createRankEligibility("debug");
    const debug = aggregateRunFacts(createRunFactScope(debugContext), [
      observed(0, 0, { type: "game.started" }),
    ]);
    expect(debug.validation).toEqual({ state: "available", value: true });
    expect(debug.standardHistory).toEqual({
      state: "unavailable",
      reasons: [
        { code: "nonManualRun", runOrigin: "debug" },
        { code: "rankIneligible", reason: "debugRun" },
      ],
    });
  });

  it.each([
    {
      name: "missing start",
      events: [observed(0, 1, { type: "game.over", score: 0, elapsed: 1 })],
      code: "missingGameStarted",
    },
    {
      name: "duplicate sequence",
      events: [
        observed(0, 0, { type: "game.started" }),
        observed(0, 1, { type: "game.paused", elapsed: 1 }),
      ],
      code: "duplicateSequence",
    },
    {
      name: "negative elapsed",
      events: [observed(0, -1, { type: "game.started" })],
      code: "invalidElapsed",
    },
    {
      name: "duplicate terminal",
      events: [
        observed(0, 0, { type: "game.started" }),
        observed(1, 2, { type: "game.over", score: 10, elapsed: 2 }),
        observed(2, 3, { type: "game.over", score: 20, elapsed: 3 }),
      ],
      code: "multipleGameOver",
    },
    {
      name: "contradictory Expedition terminal",
      events: [
        observed(0, 0, { type: "game.started" }),
        observed(1, 2, {
          type: "expedition.completed",
          actId: "command-ship",
          elapsed: 2,
          score: 100,
          tacticalScore: 80,
          scoreBeforeBonus: 80,
          clearScoreBonus: 20,
          timeScoreBonus: 0,
          timeMedal: null,
          bossFightDuration: 1,
        }),
        observed(2, 2, {
          type: "expedition.failed",
          actId: "command-ship",
          elapsed: 2,
          score: 80,
          tacticalScore: 80,
          scoreBeforeBonus: 80,
          clearScoreBonus: 0,
          timeScoreBonus: 0,
          timeMedal: null,
          bossFightDuration: 1,
        }),
      ],
      code: "contradictoryExpeditionTerminal",
    },
  ])("marks $name as invalid instead of a failed fact", ({ events, code }) => {
    const result = aggregateRunFacts(createRunFactScope(makeContext()), events);

    expect(result.validation.state).toBe("invalid");
    expect(result.completion.state).toBe("invalid");
    expect(result.summary).toBeNull();
    if (result.validation.state === "invalid") {
      expect(result.validation.issues).toContainEqual(
        expect.objectContaining({ code }),
      );
    }
  });

  it("does not mutate the source scope or event payloads", () => {
    const scope = createRunFactScope(makeContext());
    const events = makeCompletedEvents();
    const scopeBefore = structuredClone(scope);
    const eventsBefore = structuredClone(events);

    aggregateRunFacts(scope, events);

    expect(scope).toEqual(scopeBefore);
    expect(events).toEqual(eventsBefore);
  });
});

function makeCompletedEvents(): ObservedGameEvent[] {
  return [
    observed(0, 0, { type: "game.started" }),
    observed(1, 1, {
      type: "player.damaged",
      damage: 7,
      hpAfter: 93,
      source: {
        kind: "contact",
        enemyId: "enemy-1",
        enemyType: "chaser",
      },
    }),
    observed(2, 1.5, {
      type: "enemy.killed",
      bulletId: "bullet-1",
      volleyId: 1,
      enemyId: "enemy-2",
      enemyType: "ranged",
      weaponType: "pulse",
      scoreAwarded: 25,
      xpAwarded: 2,
      position: { x: 100, y: 120 },
    }),
    observed(3, 2, {
      type: "pickup.collected",
      pickupId: "pickup-1",
      pickupKind: "heal",
      xpValue: 0,
      healValue: 12,
      hpRecovered: 6,
    }),
    observed(4, 4, {
      type: "player.damaged",
      damage: 3,
      hpAfter: 96,
      source: { kind: "collapse", stage: 1 },
    }),
    observed(5, 5, { type: "game.over", score: 120, elapsed: 5 }),
  ];
}

function observed(
  sequence: number,
  elapsed: number,
  event: ObservedGameEvent["event"],
): ObservedGameEvent {
  return { sequence, elapsed, event };
}

function makeContext(): RunContext {
  return {
    id: "run:alpha/1",
    profileId: "guest-1",
    startedAt: "2026-07-21T00:00:00.000Z",
    modeId: "expedition",
    stageId: "final-expedition",
    difficultyId: "standard",
    rulesetVersion: "rules-rc6",
    seedCategory: "fixed",
    weaponId: "pulse",
    modifierIds: ["auto-fire:on"],
    appVersion: "0.7.0",
    buildCommit: "test",
    seed: 20260721,
    runOrigin: "manual",
    rankEligibility: createRankEligibility("manual"),
  };
}
