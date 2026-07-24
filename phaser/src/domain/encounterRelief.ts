import type { EncounterId } from "./types";

export const ENCOUNTER_RELIEF_SCHEMA_VERSION = 1 as const;
export const ENCOUNTER_RELIEF_WINDOW_SECONDS = 5 as const;

export type EncounterReliefBoardSnapshot = {
  observedAt: number;
  playerHp: number;
  enemyCount: number;
  enemyProjectileCount: number;
  groundXpCount: number;
  groundXpValue: number;
  groundRepairCount: number;
  groundRepairValue: number;
};

export type EncounterReliefWindowMetrics = {
  xpCollected: number;
  damageTaken: number;
  hpRecovered: number;
  repairPickupsCollected: number;
  repairPickupsCollectedAtFullHp: number;
  regularEnemiesKilled: number;
};

export type EncounterReliefBoardDelta = Omit<
  EncounterReliefBoardSnapshot,
  "observedAt"
>;

export type EncounterReliefNextWarning = {
  encounterId: EncounterId;
  elapsed: number;
  secondsAfterRecoveryStarted: number;
  board: EncounterReliefBoardSnapshot;
};

export type EncounterReliefEpisode = {
  episodeId: string;
  encounterId: EncounterId;
  occurrence: number;
  windowStartedAt: number;
  targetEndsAt: number;
  observedUntil: number;
  windowState: "complete" | "partial";
  startBoard: EncounterReliefBoardSnapshot;
  endBoard: EncounterReliefBoardSnapshot;
  boardDelta: EncounterReliefBoardDelta;
  metrics: EncounterReliefWindowMetrics;
  repairOffsetRate: number | null;
  nextWarning: EncounterReliefNextWarning | null;
};

export type EncounterReliefSummary = {
  episodeCount: number;
  completeWindowCount: number;
  partialWindowCount: number;
  nextWarningObservedCount: number;
  completeWindowTotals: EncounterReliefWindowMetrics;
  completeWindowRepairOffsetRate: number | null;
};

export type EncounterReliefReport =
  | {
      schemaVersion: typeof ENCOUNTER_RELIEF_SCHEMA_VERSION;
      windowSeconds: typeof ENCOUNTER_RELIEF_WINDOW_SECONDS;
      state: "not-reached";
      reason: "recoveryNotObserved";
    }
  | {
      schemaVersion: typeof ENCOUNTER_RELIEF_SCHEMA_VERSION;
      windowSeconds: typeof ENCOUNTER_RELIEF_WINDOW_SECONDS;
      state: "available";
      observedUntil: number;
      summary: EncounterReliefSummary;
      episodes: EncounterReliefEpisode[];
    };
