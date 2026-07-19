import type { SpawnGeometryId } from "./structuredSpawning";
import type { EnemyTypeId, RandomSource } from "./types";

export const ENCOUNTER_DIRECTIONS = [
  "north",
  "east",
  "south",
  "west",
] as const;
export type EncounterDirection = (typeof ENCOUNTER_DIRECTIONS)[number];

export type EncounterCardDefinition = {
  id: string;
  titleKey: string;
  tags: string[];
  actIds: string[];
  blocksActClock: boolean;
  deployment: {
    retryIntervalSeconds: number;
    timeoutSeconds: number;
  } | null;
  timing: {
    telegraphSeconds: number;
    activeSeconds: number;
    recoverySeconds: number;
  };
  spawn: {
    intervalMultiplier: number;
    budget: number;
    enemyWeights: Partial<Record<EnemyTypeId, number>>;
    geometryId: SpawnGeometryId;
  };
  minimumThreatTier: number;
  cooldownSeconds: number;
  weight: number;
  completionCondition:
    | { type: "duration" }
    | { type: "signal"; signalId: string };
  failureSignalIds: string[];
  interruptSignalIds: string[];
};

export type EncounterActDefinition = {
  id: string;
  titleKey: string;
  startsAt: number;
};

export type EncounterDeckDefinition = {
  id: string;
  cardIds: string[];
  directionIds: EncounterDirection[];
  initialDelay: { minSeconds: number; maxSeconds: number };
  interval: { minSeconds: number; maxSeconds: number };
  retryDelaySeconds: number;
};

export type EncounterDirectorPhase =
  | "idle"
  | "telegraph"
  | "deploying"
  | "active"
  | "recovery"
  | "completed"
  | "failed"
  | "interrupted";

export type EncounterDirectorHistoryEntry = {
  cardId: string;
  actId: string;
  direction: EncounterDirection;
  selectedAt: number;
  selectedAtActElapsed: number;
  deploymentStartedAt: number | null;
  deploymentAttempts: number;
  deploymentLastReason: string | null;
  activeStartedAt: number | null;
  activeElapsed: number;
  recoveryStartedAt: number | null;
  finishedAt: number;
  outcome: "completed" | "failed" | "interrupted";
  reason: string;
};

export type EncounterDirectorState = {
  phase: EncounterDirectorPhase;
  runElapsed: number;
  actElapsed: number;
  activeElapsed: number;
  actClockBlocked: boolean;
  actId: string | null;
  selectedActId: string | null;
  cardId: string | null;
  direction: EncounterDirection | null;
  selectedAt: number | null;
  selectedAtActElapsed: number | null;
  deploymentStartedAt: number | null;
  deploymentDeadlineAt: number | null;
  nextDeploymentAttemptAt: number | null;
  deploymentAttempts: number;
  deploymentLastReason: string | null;
  activeStartedAt: number | null;
  recoveryStartedAt: number | null;
  finishedAt: number | null;
  completionReason: string | null;
  nextSelectionAt: number;
  cardBag: string[];
  directionBag: EncounterDirection[];
  lastSelectedAt: Record<string, number>;
  history: EncounterDirectorHistoryEntry[];
  metrics: {
    selections: number;
    completed: number;
    failed: number;
    interrupted: number;
    lastMeaningfulAt: number;
    longestMeaningfulGap: number;
  };
};

export type EncounterDirectorFrame = {
  runElapsed: number;
  threatTier: number;
  signals?: readonly string[];
};

export type EncounterDeploymentResult =
  | { status: "deployed"; elapsed: number }
  | { status: "deferred"; elapsed: number; reason: string };

export type EncounterDirectorEvent =
  | { type: "encounter.act.changed"; actId: string; elapsed: number }
  | {
      type: "encounter.card.selected";
      cardId: string;
      actId: string;
      direction: EncounterDirection;
      elapsed: number;
    }
  | {
      type: "encounter.card.telegraph.started";
      cardId: string;
      direction: EncounterDirection;
      elapsed: number;
    }
  | {
      type: "encounter.card.deployment.requested";
      cardId: string;
      attempt: number;
      elapsed: number;
      deadlineAt: number;
    }
  | {
      type: "encounter.card.deployment.deferred";
      cardId: string;
      attempt: number;
      elapsed: number;
      reason: string;
      nextAttemptAt: number;
    }
  | { type: "encounter.card.active.started"; cardId: string; elapsed: number }
  | { type: "encounter.card.recovery.started"; cardId: string; elapsed: number }
  | {
      type:
        | "encounter.card.completed"
        | "encounter.card.failed"
        | "encounter.card.interrupted";
      cardId: string;
      elapsed: number;
      reason: string;
    }
  | { type: "encounter.card.deferred"; actId: string; elapsed: number };

export type EncounterDirectorRandom = RandomSource;
