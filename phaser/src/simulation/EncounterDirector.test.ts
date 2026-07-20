import { describe, expect, it } from "vitest";
import { SIMULATION_CONFIG } from "../config/gameConfig";
import {
  createEndlessEncounterCards,
  createEndlessEncounterDeck,
  ENDLESS_ENCOUNTER_ACTS,
} from "../content/endlessEncounterCards";
import type {
  EncounterActDefinition,
  EncounterCardDefinition,
  EncounterDeckDefinition,
} from "../domain/encounterDirector";
import { createRandomStreams } from "../math/random";
import { EncounterDirector } from "./EncounterDirector";

describe("EncounterDirector", () => {
  it("adapts the three existing Endless events without changing spawn values", () => {
    const cards = createEndlessEncounterCards(SIMULATION_CONFIG);
    const deck = createEndlessEncounterDeck(SIMULATION_CONFIG);

    expect(cards.map((card) => card.id)).toEqual([
      "rangedSurge",
      "swarmRush",
      "bruteSiege",
    ]);
    for (const card of cards) {
      const source =
        SIMULATION_CONFIG.encounter.director.definitions[
          card.id as keyof typeof SIMULATION_CONFIG.encounter.director.definitions
        ];
      expect(card.timing).toEqual({
        telegraphSeconds: source.warningDuration,
        activeSeconds: source.activeDuration,
        recoverySeconds: source.recoveryDuration,
      });
      expect(card.spawn).toMatchObject({
        intervalMultiplier: source.spawnIntervalMultiplier,
        budget: source.spawnBudget,
        enemyWeights: source.enemyWeights,
      });
    }
    expect(deck.initialDelay).toEqual({ minSeconds: 135, maxSeconds: 165 });
    expect(deck.interval).toEqual({ minSeconds: 48, maxSeconds: 68 });
  });

  it("produces a deterministic shuffle bag without immediate card or direction repeats", () => {
    const play = () => {
      const random = createRandomStreams(20260717).encounter;
      const director = createEndlessDirector();
      const state = director.createState(random);
      const cards: string[] = [];
      const directions: string[] = [];

      for (let index = 0; index < 9; index += 1) {
        director.update(
          state,
          { runElapsed: state.nextSelectionAt, threatTier: 10 },
          random,
        );
        cards.push(state.cardId!);
        directions.push(state.direction!);
        const card = director.getCard(state.cardId!);
        const completedAt =
          state.selectedAt! +
          card.timing.telegraphSeconds +
          card.timing.activeSeconds +
          card.timing.recoverySeconds;
        director.update(
          state,
          { runElapsed: completedAt, threatTier: 10 },
          random,
        );
        expect(state.phase).toBe("completed");
      }
      return { cards, directions };
    };

    const first = play();
    expect(new Set(first.cards.slice(0, 3)).size).toBe(3);
    expect(hasImmediateRepeat(first.cards)).toBe(false);
    expect(hasImmediateRepeat(first.directions)).toBe(false);
    expect(play()).toEqual(first);
  });

  it("advances through telegraph, active, recovery, and completion with metrics", () => {
    const director = createTestDirector();
    const random = createRandomStreams(1).encounter;
    const state = director.createState(random);

    expect(director.update(state, { runElapsed: 0, threatTier: 0 }, random)).toEqual([
      { type: "encounter.act.changed", actId: "act-one", elapsed: 0 },
      {
        type: "encounter.card.selected",
        cardId: "card-one",
        actId: "act-one",
        direction: expect.any(String),
        elapsed: 0,
      },
      {
        type: "encounter.card.telegraph.started",
        cardId: "card-one",
        direction: expect.any(String),
        elapsed: 0,
      },
    ]);
    expect(state.phase).toBe("telegraph");

    expect(director.update(state, { runElapsed: 2, threatTier: 0 }, random)).toContainEqual({
      type: "encounter.card.active.started",
      cardId: "card-one",
      elapsed: 2,
    });
    expect(director.update(state, { runElapsed: 5, threatTier: 0 }, random)).toContainEqual({
      type: "encounter.card.recovery.started",
      cardId: "card-one",
      elapsed: 5,
    });
    expect(director.update(state, { runElapsed: 6, threatTier: 0 }, random)).toContainEqual({
      type: "encounter.card.completed",
      cardId: "card-one",
      elapsed: 6,
      reason: "duration",
    });
    expect(state).toMatchObject({
      phase: "completed",
      metrics: { selections: 1, completed: 1, failed: 0, interrupted: 0 },
    });
  });

  it("records explicit failure, interruption, and signal completion reasons", () => {
    const failure = runSignalOutcome("player-down");
    expect(failure.state.phase).toBe("failed");
    expect(failure.events).toContainEqual(
      expect.objectContaining({
        type: "encounter.card.failed",
        reason: "signal:player-down",
      }),
    );

    const interruption = runSignalOutcome("stage-changed");
    expect(interruption.state.phase).toBe("interrupted");
    expect(interruption.events).toContainEqual(
      expect.objectContaining({
        type: "encounter.card.interrupted",
        reason: "signal:stage-changed",
      }),
    );

    const completion = runSignalOutcome("target-destroyed", true);
    expect(completion.state.phase).toBe("recovery");
    expect(completion.state.completionReason).toBe("signal:target-destroyed");

    const deadlineCompletion = runSignalOutcome("target-destroyed", true, 5);
    expect(deadlineCompletion.state.phase).toBe("recovery");
    expect(
      deadlineCompletion.events.some(
        (event) => event.type === "encounter.card.failed",
      ),
    ).toBe(false);

    const waiting = runSignalOutcome("unrelated-signal", true, 20);
    expect(waiting.state.phase).toBe("failed");
    expect(waiting.state.history.at(-1)).toMatchObject({
      activeElapsed: 3,
      outcome: "failed",
      reason: "timeout",
    });
  });

  it("keeps a signal encounter active when no timeout policy is configured", () => {
    const card = {
      ...createCard(
        "signal-card",
        ["act-one"],
        { type: "signal" as const, signalId: "target-destroyed" },
      ),
      activeTimeoutSeconds: null,
    };
    const director = new EncounterDirector({
      cards: [card],
      acts: [{ id: "act-one", titleKey: "act.one", startsAt: 0 }],
      deck: createDeck([card.id]),
    });
    const random = createRandomStreams(31).encounter;
    const state = director.createState(random);

    director.update(state, { runElapsed: 0, threatTier: 0 }, random);
    director.update(state, { runElapsed: 2, threatTier: 0 }, random);
    expect(director.update(state, { runElapsed: 240, threatTier: 0 }, random)).toEqual([]);
    expect(state).toMatchObject({ phase: "active", activeElapsed: 238 });
  });

  it("finalizes active and recovering cards when the run ends", () => {
    const director = createTestDirector();
    const random = createRandomStreams(32).encounter;
    const interrupted = director.createState(random);
    director.update(interrupted, { runElapsed: 0, threatTier: 0 }, random);
    director.update(interrupted, { runElapsed: 2, threatTier: 0 }, random);

    expect(
      director.terminateRun(
        interrupted,
        "interrupted",
        "run-ended:player-defeat",
        2.5,
        random,
      ),
    ).toEqual([{
      type: "encounter.card.interrupted",
      cardId: "card-one",
      elapsed: 2.5,
      reason: "run-ended:player-defeat",
    }]);
    expect(interrupted).toMatchObject({
      phase: "interrupted",
      actClockBlocked: false,
      activeElapsed: 0.5,
      nextDeploymentAttemptAt: null,
      deploymentDeadlineAt: null,
      metrics: { interrupted: 1 },
    });
    expect(interrupted.history.at(-1)).toMatchObject({
      outcome: "interrupted",
      reason: "run-ended:player-defeat",
    });

    const signalCard = {
      ...createCard(
        "boss-card",
        ["act-one"],
        { type: "signal" as const, signalId: "boss-defeated" },
      ),
      activeTimeoutSeconds: null,
    };
    const bossDirector = new EncounterDirector({
      cards: [signalCard],
      acts: [{ id: "act-one", titleKey: "act.one", startsAt: 0 }],
      deck: createDeck([signalCard.id]),
    });
    const completed = bossDirector.createState(random);
    bossDirector.update(completed, { runElapsed: 0, threatTier: 0 }, random);
    bossDirector.update(completed, { runElapsed: 2, threatTier: 0 }, random);
    bossDirector.update(
      completed,
      { runElapsed: 3, threatTier: 0, signals: ["boss-defeated"] },
      random,
    );

    expect(
      bossDirector.terminateRun(
        completed,
        "completed",
        "signal:boss-defeated",
        3,
        random,
      ),
    ).toEqual([{
      type: "encounter.card.completed",
      cardId: "boss-card",
      elapsed: 3,
      reason: "signal:boss-defeated",
    }]);
    expect(completed).toMatchObject({
      phase: "completed",
      actClockBlocked: false,
      metrics: { completed: 1 },
    });
  });

  it("changes acts and defers cards until their threat requirement is met", () => {
    const cards = [
      createCard("card-one", ["act-one"]),
      { ...createCard("card-two", ["act-two"]), minimumThreatTier: 2 },
    ];
    const director = new EncounterDirector({
      cards,
      acts: [
        { id: "act-one", titleKey: "act.one", startsAt: 0 },
        { id: "act-two", titleKey: "act.two", startsAt: 10 },
      ],
      deck: createDeck(["card-one", "card-two"]),
    });
    const random = createRandomStreams(2).encounter;
    const state = director.createState(random);
    director.update(state, { runElapsed: 0, threatTier: 0 }, random);
    director.update(state, { runElapsed: 6, threatTier: 0 }, random);
    state.nextSelectionAt = 10;

    const deferred = director.update(
      state,
      { runElapsed: 10, threatTier: 1 },
      random,
    );
    expect(deferred).toContainEqual({
      type: "encounter.act.changed",
      actId: "act-two",
      elapsed: 10,
    });
    expect(deferred).toContainEqual({
      type: "encounter.card.deferred",
      actId: "act-two",
      elapsed: 10,
    });

    director.update(state, { runElapsed: 11, threatTier: 2 }, random);
    expect(state.cardId).toBe("card-two");
  });

  it("uses the same Act and card at a cumulative 390-second boundary", () => {
    const director = new EncounterDirector({
      cards: [
        createCard("act-one-card", ["act-one"]),
        createCard("act-two-card", ["act-two"]),
      ],
      acts: [
        { id: "act-one", titleKey: "act.one", startsAt: 0 },
        { id: "act-two", titleKey: "act.two", startsAt: 390 },
      ],
      deck: createDeck(["act-one-card", "act-two-card"]),
    });

    const eventSequences: string[][] = [];
    for (const frameRate of [30, 60, 120, 144]) {
      const random = createRandomStreams(390).encounter;
      const state = director.createState(random);
      state.nextSelectionAt = 390;
      let elapsed = 0;
      const boundaryEvents = [];
      for (let frame = 1; frame <= frameRate * 390; frame += 1) {
        elapsed += 1 / frameRate;
        const events = director.update(
          state,
          { runElapsed: elapsed, threatTier: 0 },
          random,
        );
        if (frame === frameRate * 390) boundaryEvents.push(...events);
      }

      expect(state.actElapsed).toBeCloseTo(390, 9);
      expect(state.actId).toBe("act-two");
      expect(state.cardId).toBe("act-two-card");
      eventSequences.push(boundaryEvents.map((event) => JSON.stringify(event)));
    }
    expect(new Set(eventSequences.map((events) => JSON.stringify(events))).size).toBe(1);
  });

  it("blocks the Act clock from selection until a deployment encounter resolves", () => {
    const blocker = {
      ...createCard(
        "blocking-card",
        ["act-one"],
        { type: "signal" as const, signalId: "target-destroyed" },
      ),
      blocksActClock: true,
      activeTimeoutSeconds: 120,
      deployment: { retryIntervalSeconds: 2, timeoutSeconds: 10 },
      timing: { telegraphSeconds: 2, activeSeconds: 120, recoverySeconds: 1 },
    };
    const director = new EncounterDirector({
      cards: [blocker, createCard("card-two", ["act-two"])],
      acts: [
        { id: "act-one", titleKey: "act.one", startsAt: 0 },
        { id: "act-two", titleKey: "act.two", startsAt: 5 },
      ],
      deck: createDeck([blocker.id, "card-two"]),
    });
    const random = createRandomStreams(4).encounter;
    const state = director.createState(random);
    state.nextSelectionAt = 4;

    director.update(state, { runElapsed: 4, threatTier: 0 }, random);
    expect(state).toMatchObject({
      actId: "act-one",
      actElapsed: 4,
      actClockBlocked: true,
      phase: "telegraph",
    });

    const deployment = director.update(
      state,
      { runElapsed: 6, threatTier: 0 },
      random,
    );
    expect(deployment).toContainEqual(
      expect.objectContaining({
        type: "encounter.card.deployment.requested",
        attempt: 1,
        deadlineAt: 16,
      }),
    );
    director.reportDeployment(
      state,
      { status: "deployed", elapsed: 6 },
      random,
    );

    expect(
      director.update(state, { runElapsed: 10, threatTier: 0 }, random),
    ).not.toContainEqual(expect.objectContaining({ type: "encounter.act.changed" }));
    expect(state).toMatchObject({ actId: "act-one", actElapsed: 4, activeElapsed: 4 });

    director.update(
      state,
      {
        runElapsed: 10,
        threatTier: 0,
        signals: ["target-destroyed"],
      },
      random,
    );
    expect(state).toMatchObject({ phase: "recovery", actClockBlocked: false });

    const crossed = director.update(
      state,
      { runElapsed: 11, threatTier: 0 },
      random,
    );
    expect(crossed.filter((event) => event.type === "encounter.act.changed")).toEqual([
      { type: "encounter.act.changed", actId: "act-two", elapsed: 11 },
    ]);
    expect(state).toMatchObject({ actId: "act-two", actElapsed: 5 });
    expect(
      director.update(state, { runElapsed: 12, threatTier: 0 }, random),
    ).not.toContainEqual(expect.objectContaining({ type: "encounter.act.changed" }));
  });

  it("retries deployment on fixed run-time boundaries and starts active time at spawn", () => {
    const card = {
      ...createCard("deploy-card", ["act-one"]),
      blocksActClock: true,
      deployment: { retryIntervalSeconds: 2, timeoutSeconds: 10 },
    };
    const director = new EncounterDirector({
      cards: [card],
      acts: [{ id: "act-one", titleKey: "act.one", startsAt: 0 }],
      deck: createDeck([card.id]),
    });
    const random = createRandomStreams(5).encounter;
    const state = director.createState(random);
    director.update(state, { runElapsed: 0, threatTier: 0 }, random);
    director.update(state, { runElapsed: 2, threatTier: 0 }, random);

    const deferred = director.reportDeployment(
      state,
      { status: "deferred", elapsed: 2, reason: "maximumEnemyCap" },
      random,
    );
    expect(deferred).toEqual([{
      type: "encounter.card.deployment.deferred",
      cardId: card.id,
      attempt: 1,
      elapsed: 2,
      reason: "maximumEnemyCap",
      nextAttemptAt: 4,
    }]);
    expect(
      director.update(state, { runElapsed: 3.999, threatTier: 0 }, random),
    ).toEqual([]);
    expect(
      director.update(state, { runElapsed: 4, threatTier: 0 }, random),
    ).toContainEqual(
      expect.objectContaining({
        type: "encounter.card.deployment.requested",
        attempt: 2,
        elapsed: 4,
      }),
    );

    const active = director.reportDeployment(
      state,
      { status: "deployed", elapsed: 4 },
      random,
    );
    expect(active).toEqual([{
      type: "encounter.card.active.started",
      cardId: card.id,
      elapsed: 4,
    }]);
    expect(state).toMatchObject({
      phase: "active",
      activeStartedAt: 4,
      activeElapsed: 0,
      deploymentAttempts: 2,
    });
  });

  it("rejects a deployment reported at its deadline", () => {
    const card = {
      ...createCard("deploy-card", ["act-one"]),
      blocksActClock: true,
      deployment: { retryIntervalSeconds: 2, timeoutSeconds: 10 },
    };
    const director = new EncounterDirector({
      cards: [card],
      acts: [{ id: "act-one", titleKey: "act.one", startsAt: 0 }],
      deck: createDeck([card.id]),
    });
    const random = createRandomStreams(33).encounter;
    const state = director.createState(random);
    director.update(state, { runElapsed: 0, threatTier: 0 }, random);
    director.update(state, { runElapsed: 2, threatTier: 0 }, random);

    expect(
      director.reportDeployment(
        state,
        { status: "deployed", elapsed: 12 },
        random,
      ),
    ).toEqual([{
      type: "encounter.card.failed",
      cardId: card.id,
      elapsed: 12,
      reason: "deployment-timeout",
    }]);
    expect(state).toMatchObject({ phase: "failed", activeStartedAt: null });
  });

  it("times out before requesting deployment when a frame jumps past the deadline", () => {
    const card = {
      ...createCard("deploy-card", ["act-one"]),
      blocksActClock: true,
      deployment: { retryIntervalSeconds: 2, timeoutSeconds: 10 },
    };
    const director = new EncounterDirector({
      cards: [card],
      acts: [{ id: "act-one", titleKey: "act.one", startsAt: 0 }],
      deck: createDeck([card.id]),
    });
    const random = createRandomStreams(34).encounter;
    const state = director.createState(random);
    director.update(state, { runElapsed: 0, threatTier: 0 }, random);

    const events = director.update(
      state,
      { runElapsed: 15, threatTier: 0 },
      random,
    );

    expect(events).toEqual([{
      type: "encounter.card.failed",
      cardId: card.id,
      elapsed: 12,
      reason: "deployment-timeout",
    }]);
    expect(state).toMatchObject({
      phase: "failed",
      actClockBlocked: false,
      deploymentAttempts: 0,
      deploymentStartedAt: 2,
      activeStartedAt: null,
    });
    expect(state.history.at(-1)).toMatchObject({
      deploymentStartedAt: 2,
      deploymentAttempts: 0,
      finishedAt: 12,
      reason: "deployment-timeout",
    });
  });

  it("rejects unknown card and act references", () => {
    expect(
      () =>
        new EncounterDirector({
          cards: [createCard("card-one", ["missing-act"])],
          acts: [{ id: "act-one", titleKey: "act.one", startsAt: 0 }],
          deck: createDeck(["card-one"]),
        }),
    ).toThrow('references unknown act "missing-act"');

    expect(
      () =>
        new EncounterDirector({
          cards: [createCard("card-one", ["act-one"])],
          acts: [{ id: "act-one", titleKey: "act.one", startsAt: 0 }],
          deck: createDeck(["missing-card"]),
        }),
    ).toThrow('references unknown card "missing-card"');
  });
});

function createEndlessDirector(): EncounterDirector {
  return new EncounterDirector({
    cards: createEndlessEncounterCards(SIMULATION_CONFIG),
    acts: ENDLESS_ENCOUNTER_ACTS,
    deck: createEndlessEncounterDeck(SIMULATION_CONFIG),
  });
}

function createTestDirector(): EncounterDirector {
  return new EncounterDirector({
    cards: [createCard("card-one", ["act-one"])],
    acts: [{ id: "act-one", titleKey: "act.one", startsAt: 0 }],
    deck: createDeck(["card-one"]),
  });
}

function createCard(
  id: string,
  actIds: string[],
  completionCondition: EncounterCardDefinition["completionCondition"] = {
    type: "duration",
  },
): EncounterCardDefinition {
  return {
    id,
    titleKey: `encounter.${id}`,
    tags: ["test"],
    actIds,
    blocksActClock: false,
    activeTimeoutSeconds:
      completionCondition.type === "signal" ? 3 : null,
    deployment: null,
    timing: {
      telegraphSeconds: 2,
      activeSeconds: 3,
      recoverySeconds: 1,
    },
    spawn: {
      intervalMultiplier: 1,
      budget: 1,
      enemyWeights: { chaser: 1 },
      geometryId: "perimeter-random",
    },
    minimumThreatTier: 0,
    cooldownSeconds: 0,
    weight: 1,
    completionCondition,
    failureSignalIds: ["player-down"],
    interruptSignalIds: ["stage-changed"],
  };
}

function createDeck(cardIds: string[]): EncounterDeckDefinition {
  return {
    id: "test-deck",
    cardIds,
    directionIds: ["north", "east"],
    initialDelay: { minSeconds: 0, maxSeconds: 0 },
    interval: { minSeconds: 4, maxSeconds: 4 },
    retryDelaySeconds: 1,
  };
}

function runSignalOutcome(
  signal: string,
  externalCompletion = false,
  elapsed = 2,
) {
  const card = createCard(
    "card-one",
    ["act-one"],
    externalCompletion
      ? { type: "signal", signalId: "target-destroyed" }
      : { type: "duration" },
  );
  const director = new EncounterDirector({
    cards: [card],
    acts: [{ id: "act-one", titleKey: "act.one", startsAt: 0 }],
    deck: createDeck([card.id]),
  });
  const random = createRandomStreams(3).encounter;
  const state = director.createState(random);
  director.update(state, { runElapsed: 0, threatTier: 0 }, random);
  const events = director.update(
    state,
    { runElapsed: elapsed, threatTier: 0, signals: [signal] },
    random,
  );
  return { state, events };
}

function hasImmediateRepeat(values: readonly string[]): boolean {
  return values.some((value, index) => index > 0 && value === values[index - 1]);
}
