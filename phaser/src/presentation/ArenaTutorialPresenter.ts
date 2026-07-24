import type {
  TutorialSnapshot,
  TutorialStepId,
  TutorialTarget,
} from "../domain/tutorial";
import type { GameStatus } from "../domain/types";
import { TEXT } from "../lang";

export type ArenaTutorialCueKind =
  | "aim"
  | "dodge"
  | "move"
  | "observe"
  | "route"
  | "upgrade";

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
  targetLabel: string | null;
  cueKind: ArenaTutorialCueKind | null;
  cueLabel: string | null;
  cueLevel: 0 | 1 | 2;
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
      targetLabel: null,
      cueKind: getCueKind(snapshot.stepId),
      cueLabel: formatCueLabel(snapshot, text.cueLabel),
      cueLevel: 0,
      showGuideLine: false,
      panelKind: "standard",
    };
  }

  if (status !== "playing") return hiddenViewModel(snapshot);
  const hint =
    snapshot.stepId !== "transferDrill" && snapshot.hintLevel === 2
      ? text.hint2
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
    targetLabel: snapshot.target
      ? formatTargetLabel(snapshot, text.targetLabel)
      : null,
    cueKind: getCueKind(snapshot.stepId),
    cueLabel: formatCueLabel(snapshot, text.cueLabel),
    cueLevel: snapshot.hintLevel,
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
    targetLabel: null,
    cueKind: null,
    cueLabel: null,
    cueLevel: 0,
    showGuideLine: false,
    panelKind: "standard",
  };
}

function getCueKind(stepId: TutorialStepId): ArenaTutorialCueKind | null {
  if (stepId === "aimAndKill") return "aim";
  if (stepId === "move") return "move";
  if (
    stepId === "navigate" ||
    stepId === "collectXp" ||
    stepId === "collectRepair"
  ) return "route";
  if (stepId === "dodgeProjectile") return "dodge";
  if (stepId === "contactDamage") return "observe";
  if (stepId === "chooseUpgrade") return "upgrade";
  return null;
}

function formatProgress(snapshot: TutorialSnapshot): string | null {
  if (snapshot.stepId === "move") {
    return `右 ${snapshot.progress.current >= 1 ? "✓" : "…"}   左 ${
      snapshot.progress.current >= 2 ? "✓" : "…"
    }`;
  }
  if (snapshot.stepId === "aimAndKill") {
    return `標的 ${snapshot.progress.current} / ${snapshot.progress.required}`;
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

function formatCueLabel(
  snapshot: TutorialSnapshot,
  fallback: string,
): string | null {
  if (snapshot.stepId === "move") {
    return snapshot.progress.current === 0 ? "Dで右へ" : "Aで左へ";
  }
  if (snapshot.stepId === "aimAndKill") {
    return snapshot.progress.current === 0
      ? "止まった敵を狙う"
      : "動く敵を追って狙う";
  }
  return fallback || null;
}

function formatTargetLabel(
  snapshot: TutorialSnapshot,
  fallback: string,
): string | null {
  if (snapshot.stepId === "move") {
    return snapshot.progress.current === 0 ? "右の光" : "左の光";
  }
  if (snapshot.stepId === "aimAndKill") {
    return snapshot.progress.current === 0 ? "静止標的" : "移動標的";
  }
  return fallback || null;
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
