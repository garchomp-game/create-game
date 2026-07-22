export const TUTORIAL_STEP_IDS = [
  "move",
  "navigate",
  "aimAndKill",
  "collectXp",
  "chooseUpgrade",
  "dodgeProjectile",
  "collectRepair",
  "transferDrill",
  "complete",
] as const;

export type TutorialStepId = (typeof TUTORIAL_STEP_IDS)[number];

export type TutorialPhase = "briefing" | "active" | "complete";

export type TutorialRetryReason = "enemyProjectile" | "damage";

export type TutorialUpgradeId = "rapidFire" | "swiftStep" | "vitalCore";

export type TutorialTarget = {
  kind: "zone" | "enemy" | "pickup";
  id: string | null;
  position: { x: number; y: number };
  radius: number;
  guidePath?: Array<{ x: number; y: number }>;
};

export type TutorialProgress = {
  current: number;
  required: number;
};

export type TutorialSnapshot = {
  stepId: TutorialStepId;
  phase: TutorialPhase;
  stepNumber: number;
  stepCount: number;
  stepActiveSeconds: number;
  totalActiveSeconds: number;
  hintLevel: 0 | 1 | 2;
  progress: TutorialProgress;
  target: TutorialTarget | null;
  lastCompletedStepId: TutorialStepId | null;
  selectedUpgradeId: TutorialUpgradeId | null;
  retryCount: number;
  retryReason: TutorialRetryReason | null;
  retryNoticeSecondsRemaining: number;
  readySecondsRemaining: number;
  transfer: {
    survivalSeconds: number;
    kills: number;
    pickups: number;
    spawnedPickups: number;
    requiredKills: number;
    enemiesRemaining: number;
    pickupsRemaining: number;
    repairPosition: { x: number; y: number };
  };
};
