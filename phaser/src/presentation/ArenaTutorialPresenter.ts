import type { TutorialSnapshot, TutorialTarget } from "../domain/tutorial";
import type { GameStatus } from "../domain/types";
import { TEXT } from "../lang";

export type ArenaTutorialViewModel = {
  visible: boolean;
  eyebrow: string;
  title: string;
  instruction: string;
  hint: string | null;
  progress: string | null;
  target: TutorialTarget | null;
  showGuideLine: boolean;
};

export function createArenaTutorialViewModel(
  snapshot: TutorialSnapshot | null,
  status: GameStatus,
): ArenaTutorialViewModel | null {
  if (!snapshot) return null;
  if (
    snapshot.stepId === "transferDrill" ||
    snapshot.stepId === "complete" ||
    status !== "playing"
  ) {
    return hiddenViewModel(snapshot);
  }

  const text = TEXT.ui.trainingSteps[snapshot.stepId];
  const hint =
    snapshot.hintLevel === 2
      ? text.hint2
      : snapshot.hintLevel === 1
        ? text.hint1
        : null;
  return {
    visible: true,
    eyebrow: `BASIC TRAINING  ${snapshot.stepNumber}/${snapshot.stepCount}`,
    title: text.title,
    instruction: text.instruction,
    hint,
    progress: formatProgress(snapshot),
    target: snapshot.target ? structuredClone(snapshot.target) : null,
    showGuideLine: snapshot.hintLevel === 2 && snapshot.target !== null,
  };
}

function hiddenViewModel(snapshot: TutorialSnapshot): ArenaTutorialViewModel {
  return {
    visible: false,
    eyebrow: `BASIC TRAINING  ${snapshot.stepNumber}/${snapshot.stepCount}`,
    title: "",
    instruction: "",
    hint: null,
    progress: null,
    target: null,
    showGuideLine: false,
  };
}

function formatProgress(snapshot: TutorialSnapshot): string | null {
  if (snapshot.stepId === "move") {
    return `${Math.floor(snapshot.progress.current)} / ${snapshot.progress.required}px`;
  }
  if (snapshot.stepId === "dodgeProjectile") {
    return `${snapshot.progress.current} / ${snapshot.progress.required}`;
  }
  if (snapshot.retryCount > 0) {
    return `再試行 ${snapshot.retryCount}`;
  }
  return null;
}
