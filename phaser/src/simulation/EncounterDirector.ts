import {
  parseEncounterActs,
  parseEncounterCards,
  parseEncounterDeck,
} from "../content/encounterCardSchema";
import type {
  EncounterActDefinition,
  EncounterCardDefinition,
  EncounterDeckDefinition,
  EncounterDirection,
  EncounterDirectorEvent,
  EncounterDirectorFrame,
  EncounterDirectorHistoryEntry,
  EncounterDirectorRandom,
  EncounterDirectorState,
} from "../domain/encounterDirector";

export type EncounterDirectorContent = {
  deck: EncounterDeckDefinition;
  cards: EncounterCardDefinition[];
  acts: EncounterActDefinition[];
};

export class EncounterDirector {
  private readonly deck: EncounterDeckDefinition;
  private readonly cards: Map<string, EncounterCardDefinition>;
  private readonly acts: EncounterActDefinition[];

  constructor(content: EncounterDirectorContent) {
    this.deck = parseEncounterDeck(content.deck);
    const cards = parseEncounterCards(content.cards);
    const acts = parseEncounterActs(content.acts).sort(
      (left, right) => left.startsAt - right.startsAt,
    );
    assertUnique("card", cards.map((card) => card.id));
    assertUnique("act", acts.map((act) => act.id));
    assertUnique("deck card", this.deck.cardIds);
    assertUnique("direction", this.deck.directionIds);
    if (acts[0]?.startsAt !== 0) {
      throw new Error("The first encounter act must start at 0 seconds.");
    }
    this.cards = new Map(cards.map((card) => [card.id, card]));
    this.acts = acts;
    this.validateReferences();
  }

  createState(
    random: EncounterDirectorRandom,
    startedAt = 0,
  ): EncounterDirectorState {
    return {
      phase: "idle",
      actId: null,
      selectedActId: null,
      cardId: null,
      direction: null,
      selectedAt: null,
      activeStartedAt: null,
      recoveryStartedAt: null,
      finishedAt: null,
      completionReason: null,
      nextSelectionAt: roundToMillis(
        startedAt + drawRange(random, this.deck.initialDelay),
      ),
      cardBag: [],
      directionBag: [],
      lastSelectedAt: {},
      history: [],
      metrics: {
        selections: 0,
        completed: 0,
        failed: 0,
        interrupted: 0,
        lastMeaningfulAt: startedAt,
        longestMeaningfulGap: 0,
      },
    };
  }

  update(
    state: EncounterDirectorState,
    frame: EncounterDirectorFrame,
    random: EncounterDirectorRandom,
  ): EncounterDirectorEvent[] {
    if (!Number.isFinite(frame.elapsed) || frame.elapsed < 0) {
      throw new Error("EncounterDirector elapsed time must be non-negative and finite.");
    }
    const events: EncounterDirectorEvent[] = [];
    const act = this.resolveAct(frame.elapsed);
    if (state.actId !== act.id) {
      state.actId = act.id;
      state.cardBag = [];
      events.push({
        type: "encounter.act.changed",
        actId: act.id,
        elapsed: frame.elapsed,
      });
    }

    if (isTerminalOrIdle(state.phase) && frame.elapsed >= state.nextSelectionAt) {
      this.selectCard(state, frame, act, random, events);
    }
    if (!isRunning(state.phase) || state.cardId === null) return events;

    const card = this.cards.get(state.cardId)!;
    const signals = new Set(frame.signals ?? []);
    const failureSignal = card.failureSignalIds.find((signal) => signals.has(signal));
    if (failureSignal) {
      this.finish(
        state,
        "failed",
        `signal:${failureSignal}`,
        frame.elapsed,
        random,
        events,
      );
      return events;
    }
    const interruptSignal = card.interruptSignalIds.find((signal) =>
      signals.has(signal),
    );
    if (interruptSignal) {
      this.finish(
        state,
        "interrupted",
        `signal:${interruptSignal}`,
        frame.elapsed,
        random,
        events,
      );
      return events;
    }

    if (state.phase === "telegraph") {
      const activeAt = roundToMillis(
        state.selectedAt! + card.timing.telegraphSeconds,
      );
      if (hasReached(frame.elapsed, activeAt)) {
        state.phase = "active";
        state.activeStartedAt = activeAt;
        events.push({
          type: "encounter.card.active.started",
          cardId: card.id,
          elapsed: state.activeStartedAt,
        });
      }
    }

    if (state.phase === "active") {
      const completionSignal =
        card.completionCondition.type === "signal" &&
        signals.has(card.completionCondition.signalId)
          ? card.completionCondition.signalId
          : null;
      const durationCompleted =
        card.completionCondition.type === "duration" &&
        hasReached(
          frame.elapsed,
          roundToMillis(
            state.activeStartedAt! + card.timing.activeSeconds,
          ),
        );
      if (completionSignal || durationCompleted) {
        const recoveryAt = roundToMillis(
          completionSignal
            ? frame.elapsed
            : state.activeStartedAt! + card.timing.activeSeconds,
        );
        state.phase = "recovery";
        state.recoveryStartedAt = recoveryAt;
        state.completionReason = completionSignal
          ? `signal:${completionSignal}`
          : "duration";
        events.push({
          type: "encounter.card.recovery.started",
          cardId: card.id,
          elapsed: state.recoveryStartedAt,
        });
      }
    }

    if (state.phase === "recovery") {
      const completedAt = roundToMillis(
        state.recoveryStartedAt! + card.timing.recoverySeconds,
      );
      if (hasReached(frame.elapsed, completedAt)) {
        this.finish(
          state,
          "completed",
          state.completionReason ?? "duration",
          roundToMillis(completedAt),
          random,
          events,
        );
      }
    }
    return events;
  }

  getCard(cardId: string): EncounterCardDefinition {
    const card = this.cards.get(cardId);
    if (!card) throw new Error(`Unknown encounter card ID "${cardId}".`);
    return structuredClone(card);
  }

  private selectCard(
    state: EncounterDirectorState,
    frame: EncounterDirectorFrame,
    act: EncounterActDefinition,
    random: EncounterDirectorRandom,
    events: EncounterDirectorEvent[],
  ): void {
    const selectedAt = roundToMillis(state.nextSelectionAt);
    const candidates = this.deck.cardIds.filter((cardId) => {
      const card = this.cards.get(cardId)!;
      const lastSelectedAt = state.lastSelectedAt[cardId] ?? Number.NEGATIVE_INFINITY;
      return (
        card.actIds.includes(act.id) &&
        frame.threatTier >= card.minimumThreatTier &&
        selectedAt - lastSelectedAt >= card.cooldownSeconds
      );
    });
    if (candidates.length === 0) {
      state.nextSelectionAt = roundToMillis(
        frame.elapsed + this.deck.retryDelaySeconds,
      );
      events.push({
        type: "encounter.card.deferred",
        actId: act.id,
        elapsed: frame.elapsed,
      });
      return;
    }

    state.cardBag = state.cardBag.filter((cardId) => candidates.includes(cardId));
    if (state.cardBag.length === 0) {
      state.cardBag = shuffle(
        candidates.flatMap((cardId) =>
          Array(this.cards.get(cardId)!.weight).fill(cardId),
        ),
        random,
      );
    }
    const previousCardId = state.history.at(-1)?.cardId ?? state.cardId;
    const cardId = takeWithoutImmediateRepeat(
      state.cardBag,
      previousCardId,
      new Set(candidates).size > 1,
    );

    state.directionBag = state.directionBag.filter((direction) =>
      this.deck.directionIds.includes(direction),
    );
    if (state.directionBag.length === 0) {
      state.directionBag = shuffle([...this.deck.directionIds], random);
    }
    const previousDirection = state.history.at(-1)?.direction ?? state.direction;
    const direction = takeWithoutImmediateRepeat(
      state.directionBag,
      previousDirection,
      this.deck.directionIds.length > 1,
    );

    state.phase = "telegraph";
    state.selectedActId = act.id;
    state.cardId = cardId;
    state.direction = direction;
    state.selectedAt = selectedAt;
    state.activeStartedAt = null;
    state.recoveryStartedAt = null;
    state.finishedAt = null;
    state.completionReason = null;
    state.lastSelectedAt[cardId] = selectedAt;
    state.metrics.selections += 1;
    const gap = selectedAt - state.metrics.lastMeaningfulAt;
    state.metrics.longestMeaningfulGap = Math.max(
      state.metrics.longestMeaningfulGap,
      gap,
    );
    state.metrics.lastMeaningfulAt = selectedAt;
    events.push({
      type: "encounter.card.selected",
      cardId,
      actId: act.id,
      direction,
      elapsed: selectedAt,
    });
    events.push({
      type: "encounter.card.telegraph.started",
      cardId,
      direction,
      elapsed: selectedAt,
    });
  }

  private finish(
    state: EncounterDirectorState,
    outcome: "completed" | "failed" | "interrupted",
    reason: string,
    finishedAt: number,
    random: EncounterDirectorRandom,
    events: EncounterDirectorEvent[],
  ): void {
    const historyEntry: EncounterDirectorHistoryEntry = {
      cardId: state.cardId!,
      actId: state.selectedActId!,
      direction: state.direction!,
      selectedAt: state.selectedAt!,
      activeStartedAt: state.activeStartedAt,
      recoveryStartedAt: state.recoveryStartedAt,
      finishedAt,
      outcome,
      reason,
    };
    state.phase = outcome;
    state.finishedAt = finishedAt;
    state.history.push(historyEntry);
    state.history = state.history.slice(-64);
    state.metrics[outcome] += 1;
    state.nextSelectionAt = roundToMillis(
      finishedAt + drawRange(random, this.deck.interval),
    );
    events.push({
      type: `encounter.card.${outcome}`,
      cardId: historyEntry.cardId,
      elapsed: finishedAt,
      reason,
    });
  }

  private resolveAct(elapsed: number): EncounterActDefinition {
    let result = this.acts[0]!;
    for (const act of this.acts) {
      if (act.startsAt > elapsed) break;
      result = act;
    }
    return result;
  }

  private validateReferences(): void {
    const actIds = new Set(this.acts.map((act) => act.id));
    for (const cardId of this.deck.cardIds) {
      if (!this.cards.has(cardId)) {
        throw new Error(
          `Encounter deck "${this.deck.id}" references unknown card "${cardId}".`,
        );
      }
    }
    for (const card of this.cards.values()) {
      for (const actId of card.actIds) {
        if (!actIds.has(actId)) {
          throw new Error(
            `Encounter card "${card.id}" references unknown act "${actId}".`,
          );
        }
      }
    }
    for (const act of this.acts) {
      const hasCard = this.deck.cardIds.some((cardId) =>
        this.cards.get(cardId)!.actIds.includes(act.id),
      );
      if (!hasCard) {
        throw new Error(`Encounter act "${act.id}" has no available cards.`);
      }
    }
  }
}

function isRunning(phase: EncounterDirectorState["phase"]): boolean {
  return phase === "telegraph" || phase === "active" || phase === "recovery";
}

function isTerminalOrIdle(phase: EncounterDirectorState["phase"]): boolean {
  return phase === "idle" || phase === "completed" || phase === "failed" || phase === "interrupted";
}

function drawRange(
  random: EncounterDirectorRandom,
  range: { minSeconds: number; maxSeconds: number },
): number {
  return range.minSeconds + random() * (range.maxSeconds - range.minSeconds);
}

function shuffle<T>(values: T[], random: EncounterDirectorRandom): T[] {
  for (let index = values.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    [values[index], values[swapIndex]] = [values[swapIndex]!, values[index]!];
  }
  return values;
}

function takeWithoutImmediateRepeat<T>(
  bag: T[],
  previous: T | null | undefined,
  hasAlternative: boolean,
): T {
  if (hasAlternative && previous !== null && previous !== undefined) {
    const alternativeIndex = bag.findIndex((item) => item !== previous);
    if (alternativeIndex > 0) {
      [bag[0], bag[alternativeIndex]] = [bag[alternativeIndex]!, bag[0]!];
    }
  }
  return bag.shift()!;
}

function assertUnique(kind: string, values: readonly string[]): void {
  const seen = new Set<string>();
  for (const value of values) {
    if (seen.has(value)) throw new Error(`Duplicate encounter ${kind} ID "${value}".`);
    seen.add(value);
  }
}

function roundToMillis(value: number): number {
  return Math.round(value * 1000) / 1000;
}

function hasReached(elapsed: number, threshold: number): boolean {
  return roundToMillis(elapsed) >= threshold;
}
