import type {
  TutorialSnapshot,
  TutorialStepId,
  TutorialTarget,
} from "../domain/tutorial";
import type { GameStatus } from "../domain/types";
import { TEXT } from "../lang";

export type ArenaTutorialViewModel = {
  stepId: TutorialStepId;
  visible: boolean;
  presentation: "briefing" | "hud";
  eyebrow: string;
  title: string;
  instruction: string;
  briefing: string | null;
  actionLabel: string | null;
  success: string | null;
  hint: string | null;
  progress: string | null;
  notice: string | null;
  target: TutorialTarget | null;
  showGuideLine: boolean;
  panelKind: "standard" | "checklist";
};

export function createArenaTutorialViewModel(
  snapshot: TutorialSnapshot | null,
  status: GameStatus,
): ArenaTutorialViewModel | null {
  if (!snapshot) return null;
  if (snapshot.stepId === "complete" || snapshot.phase === "complete") {
    return hiddenViewModel(snapshot);
  }

  const text = TEXT.ui.trainingSteps[snapshot.stepId];
  if (snapshot.phase === "briefing") {
    if (status !== "trainingBriefing") return hiddenViewModel(snapshot);
    return {
      stepId: snapshot.stepId,
      visible: true,
      presentation: "briefing",
      eyebrow: `BASIC TRAINING  ${snapshot.stepNumber}/${snapshot.stepCount}`,
      title: text.title,
      instruction: text.instruction,
      briefing: text.briefing,
      actionLabel: text.actionLabel,
      success: formatSuccess(snapshot),
      hint: null,
      progress: null,
      notice: null,
      target: null,
      showGuideLine: false,
      panelKind: "standard",
    };
  }

  if (status !== "playing") return hiddenViewModel(snapshot);
  const hint =
    snapshot.stepId === "transferDrill"
      ? null
      : snapshot.hintLevel === 2
        ? text.hint2
        : snapshot.hintLevel === 1
          ? text.hint1
          : null;
  return {
    stepId: snapshot.stepId,
    visible: true,
    presentation: "hud",
    eyebrow: `BASIC TRAINING  ${snapshot.stepNumber}/${snapshot.stepCount}`,
    title: text.title,
    instruction: text.instruction,
    briefing: null,
    actionLabel: null,
    success: null,
    hint,
    progress: formatProgress(snapshot),
    notice: formatRetryNotice(snapshot),
    target: snapshot.target ? structuredClone(snapshot.target) : null,
    showGuideLine: snapshot.hintLevel === 2 && snapshot.target !== null,
    panelKind: snapshot.stepId === "transferDrill" ? "checklist" : "standard",
  };
}

function hiddenViewModel(snapshot: TutorialSnapshot): ArenaTutorialViewModel {
  return {
    stepId: snapshot.stepId,
    visible: false,
    presentation: "hud",
    eyebrow: `BASIC TRAINING  ${snapshot.stepNumber}/${snapshot.stepCount}`,
    title: "",
    instruction: "",
    briefing: null,
    actionLabel: null,
    success: null,
    hint: null,
    progress: null,
    notice: null,
    target: null,
    showGuideLine: false,
    panelKind: "standard",
  };
}

function formatProgress(snapshot: TutorialSnapshot): string | null {
  if (snapshot.stepId === "move") {
    return `${Math.floor(snapshot.progress.current)} / ${snapshot.progress.required}px`;
  }
  if (snapshot.stepId === "dodgeProjectile") {
    if (snapshot.readySecondsRemaining > 0) return "READY";
    return `${snapshot.progress.current} / ${snapshot.progress.required}`;
  }
  if (snapshot.stepId === "transferDrill") {
    return `敵 残り${snapshot.transfer.enemiesRemaining}体   取得物 残り${snapshot.transfer.pickupsRemaining}個`;
  }
  return null;
}

function formatSuccess(snapshot: TutorialSnapshot): string | null {
  const completed = snapshot.lastCompletedStepId;
  if (!completed || completed === "complete") return null;
  const base = TEXT.ui.trainingSteps[completed].success;
  if (completed !== "chooseUpgrade" || !snapshot.selectedUpgradeId) return base;
  const upgrade = TEXT.upgrades.definitions[snapshot.selectedUpgradeId];
  return `${base}：${upgrade.title}\n${upgrade.description}`;
}

function formatRetryNotice(snapshot: TutorialSnapshot): string | null {
  if (!snapshot.retryReason || snapshot.retryNoticeSecondsRemaining <= 0) {
    return null;
  }
  const reason = TEXT.ui.trainingRetry[snapshot.retryReason];
  if (snapshot.stepId === "dodgeProjectile") {
    return `${reason}\n回避 ${snapshot.progress.current}/${snapshot.progress.required}から再開します`;
  }
  return `${reason}\n総合演習を最初から再開します`;
}
