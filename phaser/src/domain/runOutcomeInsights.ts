import type { RunFactScope, RunFactValidationIssue } from "./runFacts";
import type { BossAttackId, EnemyTypeId, WeaponTypeId } from "./types";

export const RUN_OUTCOME_INSIGHT_VERSION = 1 as const;
export const RUN_OUTCOME_DAMAGE_WINDOW_SECONDS = 5 as const;

export type RunRetryContext = {
  profileId: string;
  modeId: string;
  stageId: string;
  difficultyId: string;
  weaponId: WeaponTypeId;
  rulesetVersion: string;
  seed: number;
  seedCategory: RunFactScope["seedCategory"];
  modifierIds: string[];
};

export type RunOutcomeCauseKind =
  | "bossAttack"
  | "contact"
  | "projectile"
  | "collapse"
  | "unknown";

export type RunOutcomePrimaryCause = {
  causeId: string;
  kind: RunOutcomeCauseKind;
  title: string;
  evidence: string;
  damage: number;
  hits: number;
  lastElapsed: number;
  isFinalHit: boolean;
  bossAttackId: BossAttackId | null;
  enemyType: EnemyTypeId | null;
};

export type RunOutcomeNextActionId =
  | "leave-attack-line"
  | "use-cover-or-exit-radius"
  | "prioritize-escorts"
  | "preserve-escape-route"
  | "change-projectile-line"
  | "return-to-safe-zone"
  | "prioritize-commander"
  | "review-final-pressure";

export type RunOutcomeNextAction = {
  id: RunOutcomeNextActionId;
  title: string;
};

export type RunOutcomeBossProgress = {
  bossId: string;
  enemyId: string;
  phaseReached: 1 | 2;
  maximumHp: number;
  remainingHp: number;
  remainingHpRatio: number;
  defeated: boolean;
};

export type RunOutcomePressureSnapshot = {
  activeCommanderCount: number;
  activeEscortCount: number;
  bossActive: boolean;
  collapseStage: number;
  lastBossAttackId: BossAttackId | null;
};

export type RunOutcomeProgress = {
  completionKind: "gameOver" | "expeditionCompleted" | "expeditionFailed";
  elapsed: number;
  score: number;
  tacticalScore: number | null;
  actId: string | null;
  boss: RunOutcomeBossProgress | null;
  pressure: RunOutcomePressureSnapshot;
};

export type RunOutcomeNearMissEvidence =
  | { state: "not-reached"; reason: "bossNotReached" }
  | { state: "not-applicable"; reason: "runCompleted" }
  | {
      state: "evidence-only";
      reason: "thresholdNotRegistered";
      bossRemainingHp: number;
      bossMaximumHp: number;
      bossRemainingHpRatio: number;
      bossPhaseReached: 1 | 2;
    };

export type RunOutcomeSnapshot = {
  comparisonKey: string;
  completionKind: RunOutcomeProgress["completionKind"];
  elapsed: number;
  score: number;
  primaryCauseId: string | null;
  totalDamage: number;
  boss: RunOutcomeBossProgress | null;
};

export type RunOutcomePreviousDifference =
  | { state: "not-reached"; reason: "noPreviousRun" }
  | { state: "unavailable"; reason: "comparisonScopeMismatch" }
  | {
      state: "available";
      kind:
        | "completion"
        | "bossPhase"
        | "bossRemainingHp"
        | "primaryCause"
        | "elapsed"
        | "same";
      title: string;
    };

export type RunOutcomeInsightViewModel =
  | {
      schemaVersion: typeof RUN_OUTCOME_INSIGHT_VERSION;
      state: "invalid";
      issues: RunFactValidationIssue[];
    }
  | {
      schemaVersion: typeof RUN_OUTCOME_INSIGHT_VERSION;
      state: "not-reached";
      reason: "runNotTerminated";
    }
  | {
      schemaVersion: typeof RUN_OUTCOME_INSIGHT_VERSION;
      state: "available";
      retryContext: RunRetryContext;
      primaryCause: RunOutcomePrimaryCause | null;
      nextAction: RunOutcomeNextAction | null;
      progress: RunOutcomeProgress;
      nearMiss: RunOutcomeNearMissEvidence;
      previousDifference: RunOutcomePreviousDifference;
      snapshot: RunOutcomeSnapshot;
    };
