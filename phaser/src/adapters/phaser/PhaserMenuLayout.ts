import type { GameStatus } from "../../domain/types";
import type { MenuActionLabel } from "../../lang";

export type MenuAction = "start" | "resume" | "restart" | "title";

export type MenuButton = {
  action: MenuAction;
  label: string;
  x: number;
  y: number;
  width: number;
  height: number;
};

export type UpgradeChoiceButton = {
  index: number;
  x: number;
  y: number;
  width: number;
  height: number;
};

const DEFAULT_MENU_LABELS: Record<MenuActionLabel, string> = {
  start: "Start",
  resume: "Resume",
  restart: "Restart",
  title: "Title",
};

export function getMenuButtons(
  status: GameStatus,
  arenaWidth: number,
  arenaHeight: number,
  labels: Record<MenuActionLabel, string> = DEFAULT_MENU_LABELS,
): MenuButton[] {
  const buttonWidth = 220;
  const buttonHeight = 44;
  const x = arenaWidth / 2 - buttonWidth / 2;

  if (status === "title") {
    return [
      {
        action: "start",
        label: labels.start,
        x,
        y: arenaHeight / 2 + 76,
        width: buttonWidth,
        height: buttonHeight,
      },
    ];
  }

  if (status === "paused") {
    return [
      { action: "resume", label: labels.resume, x, y: arenaHeight / 2 + 14, width: buttonWidth, height: buttonHeight },
      { action: "restart", label: labels.restart, x, y: arenaHeight / 2 + 66, width: buttonWidth, height: buttonHeight },
      { action: "title", label: labels.title, x, y: arenaHeight / 2 + 118, width: buttonWidth, height: buttonHeight },
    ];
  }

  if (status === "gameOver") {
    return [
      { action: "restart", label: labels.restart, x, y: arenaHeight / 2 + 114, width: buttonWidth, height: buttonHeight },
      { action: "title", label: labels.title, x, y: arenaHeight / 2 + 166, width: buttonWidth, height: buttonHeight },
    ];
  }

  return [];
}

export function getUpgradeChoiceButtons(
  choiceCount: number,
  arenaWidth: number,
  arenaHeight: number,
): UpgradeChoiceButton[] {
  const buttonWidth = 520;
  const buttonHeight = 72;
  const gap = 10;
  const totalHeight = choiceCount * buttonHeight + Math.max(0, choiceCount - 1) * gap;
  const x = arenaWidth / 2 - buttonWidth / 2;
  const startY = arenaHeight / 2 - totalHeight / 2 + 34;
  return Array.from({ length: choiceCount }, (_, index) => ({
    index,
    x,
    y: startY + index * (buttonHeight + gap),
    width: buttonWidth,
    height: buttonHeight,
  }));
}

export function findMenuActionAt(
  status: GameStatus,
  arenaWidth: number,
  arenaHeight: number,
  x: number,
  y: number,
): MenuAction | null {
  const button = getMenuButtons(status, arenaWidth, arenaHeight).find((item) =>
    pointInRect(x, y, item),
  );
  return button?.action ?? null;
}

export function findUpgradeChoiceAt(
  choiceCount: number,
  arenaWidth: number,
  arenaHeight: number,
  x: number,
  y: number,
): number | null {
  const button = getUpgradeChoiceButtons(choiceCount, arenaWidth, arenaHeight).find((item) =>
    pointInRect(x, y, item),
  );
  return button?.index ?? null;
}

function pointInRect(
  x: number,
  y: number,
  rect: { x: number; y: number; width: number; height: number },
): boolean {
  return x >= rect.x && x <= rect.x + rect.width && y >= rect.y && y <= rect.y + rect.height;
}
