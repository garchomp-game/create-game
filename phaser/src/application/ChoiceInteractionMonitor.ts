import type { WorldState } from "../domain/types";

export const CHOICE_INTERACTION_SCHEMA_VERSION = 1 as const;
export const CHOICE_RESUME_WINDOW_SECONDS = 1 as const;

export type ChoiceInteractionPhase = "upgrade" | "extra" | "contract";
export type ChoiceInteractionInputMethod = "keyboard" | "pointer";

export type ChoiceInteractionSurface = {
  signature: string;
  phase: ChoiceInteractionPhase;
  candidateIds: string[];
};

export type ChoiceInteractionCounters = {
  movementDistance: number;
  shotsFired: number;
  damageTaken: number;
};

export type ChoiceInteractionResumeObservation = ChoiceInteractionCounters & {
  simulationSeconds: number;
  moveInput: boolean;
  aimInput: boolean;
  shootInput: boolean;
};

export type ChoiceInteractionSample = {
  phase: ChoiceInteractionPhase;
  candidateIds: string[];
  candidateCount: number;
  selectedId: string;
  selectedIndex: number;
  inputMethod: ChoiceInteractionInputMethod;
  openedAtSimulationSeconds: number;
  selectedAtSimulationSeconds: number;
  intervalSincePreviousChoiceSeconds: number | null;
  visibleDurationMs: number;
  resumeWindow: {
    completed: boolean;
    observedSimulationSeconds: number;
    movementInputFrames: number;
    aimInputFrames: number;
    shootInputFrames: number;
    movementDistance: number;
    shotsFired: number;
    damageTaken: number;
  };
};

export type ChoiceInteractionReport = {
  schemaVersion: typeof CHOICE_INTERACTION_SCHEMA_VERSION;
  autoPilotObserved: boolean;
  interruptedChoiceCount: number;
  invalidSelectionCount: number;
  clockRegressionCount: number;
  samples: ChoiceInteractionSample[];
  summary: {
    selectedCount: number;
    completedResumeWindowCount: number;
    hardStallCount: number;
    totalVisibleDurationMs: number;
    averageVisibleDurationMs: number | null;
    choicesPerSimulationMinute: number | null;
    stoppedWallClockRatio: number | null;
    phaseCounts: Record<ChoiceInteractionPhase, number>;
    inputMethodCounts: Record<ChoiceInteractionInputMethod, number>;
  };
};

export type MonotonicClockPort = {
  nowMs(): number;
};

type ActiveChoice = {
  surface: ChoiceInteractionSurface;
  openedAtSimulationSeconds: number;
  openedAtWallClockMs: number;
  intervalSincePreviousChoiceSeconds: number | null;
};

type PendingResume = {
  sampleIndex: number;
  selectedAtSimulationSeconds: number;
  lastObservedAtSimulationSeconds: number;
  baseline: ChoiceInteractionCounters;
};

export class ChoiceInteractionMonitor {
  private activeChoice: ActiveChoice | null = null;
  private pendingResume: PendingResume | null = null;
  private samples: ChoiceInteractionSample[] = [];
  private previousOpenedAtSimulationSeconds: number | null = null;
  private autoPilotObserved = false;
  private interruptedChoiceCount = 0;
  private invalidSelectionCount = 0;
  private clockRegressionCount = 0;

  constructor(private readonly clock: MonotonicClockPort) {}

  reset(autoPilotEnabled = false): void {
    this.activeChoice = null;
    this.pendingResume = null;
    this.samples = [];
    this.previousOpenedAtSimulationSeconds = null;
    this.autoPilotObserved = autoPilotEnabled;
    this.interruptedChoiceCount = 0;
    this.invalidSelectionCount = 0;
    this.clockRegressionCount = 0;
  }

  markAutoPilotObserved(): void {
    this.autoPilotObserved = true;
  }

  syncSurface(
    surface: ChoiceInteractionSurface | null,
    simulationSeconds: number,
  ): void {
    if (surface === null) {
      if (this.activeChoice !== null) this.interruptedChoiceCount += 1;
      this.activeChoice = null;
      return;
    }
    if (this.activeChoice?.surface.signature === surface.signature) return;
    if (this.activeChoice !== null) this.interruptedChoiceCount += 1;

    const openedAtSimulationSeconds = finiteNonNegative(simulationSeconds);
    this.activeChoice = {
      surface: cloneSurface(surface),
      openedAtSimulationSeconds,
      openedAtWallClockMs: finiteNonNegative(this.clock.nowMs()),
      intervalSincePreviousChoiceSeconds:
        this.previousOpenedAtSimulationSeconds === null
          ? null
          : Math.max(
              0,
              openedAtSimulationSeconds - this.previousOpenedAtSimulationSeconds,
            ),
    };
    this.previousOpenedAtSimulationSeconds = openedAtSimulationSeconds;
  }

  select(
    selectedIndex: number,
    inputMethod: ChoiceInteractionInputMethod,
    simulationSeconds: number,
    baseline: ChoiceInteractionCounters,
  ): boolean {
    const active = this.activeChoice;
    const selectedId = active?.surface.candidateIds[selectedIndex];
    if (!active || selectedId === undefined) {
      this.invalidSelectionCount += 1;
      return false;
    }

    const wallClockDelta =
      finiteNonNegative(this.clock.nowMs()) - active.openedAtWallClockMs;
    if (wallClockDelta < 0) this.clockRegressionCount += 1;
    const selectedAtSimulationSeconds = finiteNonNegative(simulationSeconds);
    const sample: ChoiceInteractionSample = {
      phase: active.surface.phase,
      candidateIds: [...active.surface.candidateIds],
      candidateCount: active.surface.candidateIds.length,
      selectedId,
      selectedIndex,
      inputMethod,
      openedAtSimulationSeconds: active.openedAtSimulationSeconds,
      selectedAtSimulationSeconds,
      intervalSincePreviousChoiceSeconds: active.intervalSincePreviousChoiceSeconds,
      visibleDurationMs: Math.max(0, wallClockDelta),
      resumeWindow: emptyResumeWindow(),
    };
    this.samples.push(sample);
    this.pendingResume = {
      sampleIndex: this.samples.length - 1,
      selectedAtSimulationSeconds,
      lastObservedAtSimulationSeconds: selectedAtSimulationSeconds,
      baseline: copyCounters(baseline),
    };
    this.activeChoice = null;
    return true;
  }

  observeResume(observation: ChoiceInteractionResumeObservation): void {
    const pending = this.pendingResume;
    if (!pending) return;
    const simulationSeconds = finiteNonNegative(observation.simulationSeconds);
    if (simulationSeconds <= pending.lastObservedAtSimulationSeconds) return;

    const sample = this.samples[pending.sampleIndex];
    if (!sample) {
      this.pendingResume = null;
      return;
    }
    pending.lastObservedAtSimulationSeconds = simulationSeconds;
    if (observation.moveInput) sample.resumeWindow.movementInputFrames += 1;
    if (observation.aimInput) sample.resumeWindow.aimInputFrames += 1;
    if (observation.shootInput) sample.resumeWindow.shootInputFrames += 1;
    sample.resumeWindow.observedSimulationSeconds = Math.min(
      CHOICE_RESUME_WINDOW_SECONDS,
      simulationSeconds - pending.selectedAtSimulationSeconds,
    );
    sample.resumeWindow.movementDistance = nonNegativeDelta(
      observation.movementDistance,
      pending.baseline.movementDistance,
    );
    sample.resumeWindow.shotsFired = nonNegativeDelta(
      observation.shotsFired,
      pending.baseline.shotsFired,
    );
    sample.resumeWindow.damageTaken = nonNegativeDelta(
      observation.damageTaken,
      pending.baseline.damageTaken,
    );

    if (
      simulationSeconds - pending.selectedAtSimulationSeconds >=
      CHOICE_RESUME_WINDOW_SECONDS
    ) {
      sample.resumeWindow.completed = true;
      this.pendingResume = null;
    }
  }

  getReport(simulationSeconds: number): ChoiceInteractionReport {
    const samples = this.samples.map(cloneSample);
    const totalVisibleDurationMs = samples.reduce(
      (total, sample) => total + sample.visibleDurationMs,
      0,
    );
    const elapsedMs = finiteNonNegative(simulationSeconds) * 1000;
    const selectedCount = samples.length;
    return {
      schemaVersion: CHOICE_INTERACTION_SCHEMA_VERSION,
      autoPilotObserved: this.autoPilotObserved,
      interruptedChoiceCount: this.interruptedChoiceCount,
      invalidSelectionCount: this.invalidSelectionCount,
      clockRegressionCount: this.clockRegressionCount,
      samples,
      summary: {
        selectedCount,
        completedResumeWindowCount: samples.filter(
          (sample) => sample.resumeWindow.completed,
        ).length,
        hardStallCount: samples.filter(
          (sample) =>
            sample.resumeWindow.completed &&
            sample.resumeWindow.movementInputFrames === 0 &&
            sample.resumeWindow.shootInputFrames === 0 &&
            sample.resumeWindow.shotsFired === 0,
        ).length,
        totalVisibleDurationMs,
        averageVisibleDurationMs:
          selectedCount > 0 ? totalVisibleDurationMs / selectedCount : null,
        choicesPerSimulationMinute:
          elapsedMs > 0 ? selectedCount / (elapsedMs / 60_000) : null,
        stoppedWallClockRatio:
          elapsedMs + totalVisibleDurationMs > 0
            ? totalVisibleDurationMs / (elapsedMs + totalVisibleDurationMs)
            : null,
        phaseCounts: countByPhase(samples),
        inputMethodCounts: countByInputMethod(samples),
      },
    };
  }
}

export function createChoiceInteractionSurface(
  world: WorldState,
): ChoiceInteractionSurface | null {
  if (world.state.status === "upgradeSelect") {
    const phase = world.progression.buildCompletedAt === null ? "upgrade" : "extra";
    const candidateIds = [...world.progression.pendingUpgradeChoices];
    return {
      signature: [
        phase,
        world.progression.level,
        world.progression.extraLevel,
        world.progression.extraCycle,
        candidateIds.join(","),
      ].join(":"),
      phase,
      candidateIds,
    };
  }
  if (world.state.status === "contractSelect") {
    return {
      signature: `contract:${world.encounter.contract.offeredAt ?? "pending"}`,
      phase: "contract",
      candidateIds: ["standard", "overdrive"],
    };
  }
  return null;
}

export function createEmptyChoiceInteractionReport(): ChoiceInteractionReport {
  return {
    schemaVersion: CHOICE_INTERACTION_SCHEMA_VERSION,
    autoPilotObserved: false,
    interruptedChoiceCount: 0,
    invalidSelectionCount: 0,
    clockRegressionCount: 0,
    samples: [],
    summary: {
      selectedCount: 0,
      completedResumeWindowCount: 0,
      hardStallCount: 0,
      totalVisibleDurationMs: 0,
      averageVisibleDurationMs: null,
      choicesPerSimulationMinute: null,
      stoppedWallClockRatio: null,
      phaseCounts: { upgrade: 0, extra: 0, contract: 0 },
      inputMethodCounts: { keyboard: 0, pointer: 0 },
    },
  };
}

function emptyResumeWindow(): ChoiceInteractionSample["resumeWindow"] {
  return {
    completed: false,
    observedSimulationSeconds: 0,
    movementInputFrames: 0,
    aimInputFrames: 0,
    shootInputFrames: 0,
    movementDistance: 0,
    shotsFired: 0,
    damageTaken: 0,
  };
}

function cloneSurface(surface: ChoiceInteractionSurface): ChoiceInteractionSurface {
  return { ...surface, candidateIds: [...surface.candidateIds] };
}

function cloneSample(sample: ChoiceInteractionSample): ChoiceInteractionSample {
  return {
    ...sample,
    candidateIds: [...sample.candidateIds],
    resumeWindow: { ...sample.resumeWindow },
  };
}

function copyCounters(counters: ChoiceInteractionCounters): ChoiceInteractionCounters {
  return {
    movementDistance: finiteNonNegative(counters.movementDistance),
    shotsFired: finiteNonNegative(counters.shotsFired),
    damageTaken: finiteNonNegative(counters.damageTaken),
  };
}

function finiteNonNegative(value: number): number {
  return Number.isFinite(value) ? Math.max(0, value) : 0;
}

function nonNegativeDelta(current: number, previous: number): number {
  return Math.max(0, finiteNonNegative(current) - previous);
}

function countByPhase(
  samples: readonly ChoiceInteractionSample[],
): Record<ChoiceInteractionPhase, number> {
  const counts = { upgrade: 0, extra: 0, contract: 0 };
  for (const sample of samples) counts[sample.phase] += 1;
  return counts;
}

function countByInputMethod(
  samples: readonly ChoiceInteractionSample[],
): Record<ChoiceInteractionInputMethod, number> {
  const counts = { keyboard: 0, pointer: 0 };
  for (const sample of samples) counts[sample.inputMethod] += 1;
  return counts;
}
