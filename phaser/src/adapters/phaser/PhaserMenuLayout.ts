import type { GameStatus } from "../../domain/types";

export type SecondaryMenu = "history" | "ranking" | "settings";

export type MenuAction =
  | "start"
  | "selectPulse"
  | "selectSpread"
  | "contractStandard"
  | "contractOverdrive"
  | "resume"
  | "restart"
  | "title"
  | "history"
  | "ranking"
  | "settings"
  | "back"
  | "historyPrevious"
  | "historyNext"
  | "historyFilterAll"
  | "historyFilterPulse"
  | "historyFilterSpread"
  | "clearHistory"
  | "clearRankings"
  | "resetSettings"
  | "resetProfile"
  | "settingsBgm"
  | "settingsSfx"
  | "settingsShake"
  | "settingsFlash"
  | "settingsAutoFire";

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

const DEFAULT_MENU_LABELS: Record<MenuAction, string> = {
  start: "エンドレス開始",
  selectPulse: "パルスを選ぶ",
  selectSpread: "拡散を選ぶ",
  contractStandard: "標準を維持",
  contractOverdrive: "過負荷を受け入れる",
  resume: "再開",
  restart: "リスタート",
  title: "タイトルへ",
  history: "ラン履歴",
  ranking: "ランキング",
  settings: "設定",
  back: "戻る",
  historyPrevious: "前のページ",
  historyNext: "次のページ",
  historyFilterAll: "すべて",
  historyFilterPulse: "パルス",
  historyFilterSpread: "拡散",
  clearHistory: "履歴を消去",
  clearRankings: "ランキングを消去",
  resetSettings: "設定を初期化",
  resetProfile: "ゲストIDを再生成",
  settingsBgm: "BGM",
  settingsSfx: "効果音",
  settingsShake: "画面揺れ",
  settingsFlash: "画面点滅",
  settingsAutoFire: "自動射撃",
};

export function getMenuButtons(
  status: GameStatus,
  arenaWidth: number,
  arenaHeight: number,
  labels: Partial<Record<MenuAction, string>> = DEFAULT_MENU_LABELS,
  secondaryMenu: SecondaryMenu | null = null,
): MenuButton[] {
  const label = (action: MenuAction) => labels[action] ?? DEFAULT_MENU_LABELS[action];
  const buttonWidth = 260;
  const buttonHeight = 42;
  const x = arenaWidth / 2 - buttonWidth / 2;

  if (status === "weaponSelect") {
    return [
      {
        action: "selectPulse",
        label: label("selectPulse"),
        x,
        y: 304,
        width: buttonWidth,
        height: buttonHeight,
      },
      {
        action: "selectSpread",
        label: label("selectSpread"),
        x,
        y: 356,
        width: buttonWidth,
        height: buttonHeight,
      },
      {
        action: "back",
        label: label("back"),
        x,
        y: 434,
        width: buttonWidth,
        height: buttonHeight,
      },
    ];
  }

  if (status === "contractSelect") {
    return [
      {
        action: "contractStandard",
        label: label("contractStandard"),
        x,
        y: 322,
        width: buttonWidth,
        height: buttonHeight,
      },
      {
        action: "contractOverdrive",
        label: label("contractOverdrive"),
        x,
        y: 374,
        width: buttonWidth,
        height: buttonHeight,
      },
    ];
  }

  if (secondaryMenu === "settings") {
    const actions: MenuAction[] = [
      "settingsBgm",
      "settingsSfx",
      "settingsShake",
      "settingsFlash",
      "settingsAutoFire",
      "resetSettings",
      "resetProfile",
      "back",
    ];
    return actions.map((action, index) => ({
      action,
      label: label(action),
      x,
      y: 134 + index * 48,
      width: buttonWidth,
      height: buttonHeight,
    }));
  }

  if (secondaryMenu === "history") {
    return [
      {
        action: "historyFilterAll",
        label: label("historyFilterAll"),
        x: arenaWidth / 2 - 245,
        y: arenaHeight - 198,
        width: 150,
        height: buttonHeight,
      },
      {
        action: "historyFilterPulse",
        label: label("historyFilterPulse"),
        x: arenaWidth / 2 - 75,
        y: arenaHeight - 198,
        width: 150,
        height: buttonHeight,
      },
      {
        action: "historyFilterSpread",
        label: label("historyFilterSpread"),
        x: arenaWidth / 2 + 95,
        y: arenaHeight - 198,
        width: 150,
        height: buttonHeight,
      },
      {
        action: "historyPrevious",
        label: label("historyPrevious"),
        x: arenaWidth / 2 - 270,
        y: arenaHeight - 146,
        width: 250,
        height: buttonHeight,
      },
      {
        action: "historyNext",
        label: label("historyNext"),
        x: arenaWidth / 2 + 20,
        y: arenaHeight - 146,
        width: 250,
        height: buttonHeight,
      },
      {
        action: "clearHistory",
        label: label("clearHistory"),
        x,
        y: arenaHeight - 98,
        width: buttonWidth,
        height: buttonHeight,
      },
      {
        action: "back",
        label: label("back"),
        x,
        y: arenaHeight - 50,
        width: buttonWidth,
        height: buttonHeight,
      },
    ];
  }

  if (secondaryMenu === "ranking") {
    return [
      {
        action: "clearRankings",
        label: label("clearRankings"),
        x,
        y: arenaHeight - 98,
        width: buttonWidth,
        height: buttonHeight,
      },
      {
        action: "back",
        label: label("back"),
        x,
        y: arenaHeight - 50,
        width: buttonWidth,
        height: buttonHeight,
      },
    ];
  }

  if (status === "title") {
    const actions: MenuAction[] = ["start", "ranking", "history", "settings"];
    return actions.map((action, index) => ({
      action,
      label: label(action),
      x,
      y: 286 + index * 52,
      width: buttonWidth,
      height: buttonHeight,
    }));
  }

  if (status === "paused") {
    return [
      { action: "resume", label: label("resume"), x, y: 284, width: buttonWidth, height: buttonHeight },
      { action: "restart", label: label("restart"), x, y: 336, width: buttonWidth, height: buttonHeight },
      { action: "title", label: label("title"), x, y: 388, width: buttonWidth, height: buttonHeight },
    ];
  }

  if (status === "gameOver") {
    return [
      { action: "restart", label: label("restart"), x, y: 366, width: buttonWidth, height: buttonHeight },
      { action: "history", label: label("history"), x, y: 418, width: buttonWidth, height: buttonHeight },
      { action: "title", label: label("title"), x, y: 470, width: buttonWidth, height: buttonHeight },
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
  secondaryMenu: SecondaryMenu | null = null,
): MenuAction | null {
  const button = getMenuButtons(status, arenaWidth, arenaHeight, undefined, secondaryMenu).find(
    (item) => pointInRect(x, y, item),
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
