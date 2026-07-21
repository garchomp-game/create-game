import type {
  RankEligibility,
  RankIneligibilityReason,
  RunOrigin,
  SeedCategory,
} from "./runRecords";
import type {
  EnemyTypeId,
  GameEvent,
  PlayerDamageSource,
  WeaponTypeId,
} from "./types";

export const RUN_FACT_READ_MODEL_VERSION = 1 as const;

export const RUN_FACT_EPISODE_KINDS = [
  "run",
  "encounter",
  "opportunity",
] as const;

export type RunFactEpisodeKind = (typeof RUN_FACT_EPISODE_KINDS)[number];

export type RunFactScope = {
  runId: string;
  profileId: string;
  modeId: string;
  stageId: string;
  difficultyId: string;
  weaponId: WeaponTypeId;
  rulesetVersion: string;
  seed: number;
  seedCategory: SeedCategory;
  modifierIds: string[];
  appVersion: string;
  buildCommit: string;
  runOrigin: RunOrigin;
  rankEligibility: RankEligibility;
};

export type RunFactEpisodeScope = {
  kind: RunFactEpisodeKind;
  subjectId: string | null;
  occurrence: number;
};

export type ObservedGameEvent = {
  sequence: number;
  elapsed: number;
  event: GameEvent;
};

export type RunFactValidationIssue =
  | { code: "missingRunId" }
  | { code: "invalidSequence"; inputIndex: number }
  | { code: "duplicateSequence"; sequence: number }
  | { code: "invalidElapsed"; inputIndex: number }
  | { code: "missingGameStarted" }
  | { code: "multipleGameStarted"; count: number }
  | { code: "multipleGameOver"; count: number }
  | { code: "inconsistentRankEligibility" }
  | {
      code: "multipleExpeditionTerminal";
      terminalType: "expedition.completed" | "expedition.failed";
      count: number;
    }
  | { code: "contradictoryExpeditionTerminal" };

export type RunFactNotReachedReason = "runNotTerminated";

export type RunFactHistoryExclusion =
  | { code: "nonManualRun"; runOrigin: Exclude<RunOrigin, "manual"> }
  | { code: "rankIneligible"; reason: RankIneligibilityReason };

export type RunFactState<T, TUnavailableReason = string> =
  | { state: "available"; value: T }
  | { state: "not-reached"; reason: RunFactNotReachedReason }
  | { state: "unavailable"; reasons: TUnavailableReason[] }
  | { state: "invalid"; issues: RunFactValidationIssue[] };

export type RunCompletionFact = {
  kind: "gameOver" | "expeditionCompleted" | "expeditionFailed";
  elapsed: number;
  score: number;
  tacticalScore: number | null;
  actId: string | null;
};

export type RunDamageFact = {
  factId: string;
  episodeId: string;
  sequence: number;
  elapsed: number;
  damage: number;
  hpAfter: number;
  source: PlayerDamageSource | null;
};

export type RunRecoveryFact = {
  factId: string;
  episodeId: string;
  sequence: number;
  elapsed: number;
  healValue: number;
  hpRecovered: number;
};

export type RunKillFact = {
  factId: string;
  episodeId: string;
  sequence: number;
  elapsed: number;
  enemyId: string;
  enemyType: EnemyTypeId;
  weaponId: WeaponTypeId;
  scoreAwarded: number;
  xpAwarded: number;
};

export type RunFactSummary = {
  observedEventCount: number;
  observedElapsed: { first: number; last: number };
  damage: {
    total: number;
    hits: number;
    bySource: {
      contact: number;
      projectile: number;
      collapse: number;
      unknown: number;
    };
    timeline: RunDamageFact[];
    last: RunDamageFact | null;
  };
  recovery: {
    pickups: number;
    offered: number;
    recovered: number;
    timeline: RunRecoveryFact[];
  };
  combat: {
    kills: number;
    scoreAwarded: number;
    xpAwarded: number;
    killsByEnemyType: Record<EnemyTypeId, number>;
    timeline: RunKillFact[];
  };
};

export type RunFactReadModel = {
  schemaVersion: typeof RUN_FACT_READ_MODEL_VERSION;
  scope: RunFactScope;
  runEpisodeId: string | null;
  validation: RunFactState<true>;
  standardHistory: RunFactState<true, RunFactHistoryExclusion>;
  completion: RunFactState<RunCompletionFact>;
  summary: RunFactSummary | null;
};
