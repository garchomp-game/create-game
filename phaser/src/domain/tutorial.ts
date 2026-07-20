export const TUTORIAL_STEP_IDS = [
  "move",
  "navigate",
  "aimAndKill",
  "collectXp",
  "dodgeProjectile",
  "collectRepair",
  "chooseUpgrade",
  "transferDrill",
  "complete",
] as const;

export type TutorialStepId = (typeof TUTORIAL_STEP_IDS)[number];

export type TutorialTarget = {
  kind: "zone" | "enemy" | "pickup";
  id: string | null;
  position: { x: number; y: number };
  radius: number;
};

export type TutorialProgress = {
  current: number;
  required: number;
};

export type TutorialSnapshot = {
  stepId: TutorialStepId;
  stepNumber: number;
  stepCount: number;
  stepActiveSeconds: number;
  totalActiveSeconds: number;
  hintLevel: 0 | 1 | 2;
  progress: TutorialProgress;
  target: TutorialTarget | null;
  retryCount: number;
  transfer: {
    survivalSeconds: number;
    kills: number;
    pickups: number;
  };
};
