import type { GameStatus } from "../../domain/types";
import type { MenuAction, SecondaryMenu } from "../../application/ArenaMenuTypes";
import {
  getHelpCloseButtonBounds,
  getHelpTabButtonBounds,
} from "./PhaserHelpLayout";

export type { MenuAction, SecondaryMenu } from "../../application/ArenaMenuTypes";

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
  story: "ストーリー",
  start: "エンドレス",
  startExpedition: "最終遠征に挑む",
  startTraining: "基本訓練",
  practice: "練習場",
  practiceSettings: "設定",
  practiceInvincible: "HP無敵",
  practiceInvinciblePrevious: "◀",
  practiceInvincibleNext: "▶",
  practiceIntensity: "敵の出現量",
  practiceIntensityPrevious: "◀",
  practiceIntensityNext: "▶",
  practiceEnemyChaser: "追跡体",
  practiceEnemyBrute: "重装体",
  practiceEnemyFast: "高速体",
  practiceEnemyRanged: "射撃体",
  practiceStartPulse: "パルスで開始",
  practiceStartSpread: "拡散で開始",
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
  help: "操作ヘルプ",
  helpControls: "操作",
  helpEnemies: "敵",
  helpField: "アイテム",
  betaInfo: "プレビュー情報",
  back: "戻る",
  historyPrevious: "前のページ",
  historyNext: "次のページ",
  historyFilterAll: "すべて",
  historyFilterPulse: "パルス",
  historyFilterSpread: "拡散",
  rankingPrevious: "前のボード",
  rankingNext: "次のボード",
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
    const halfWidth = 250;
    const leftX = arenaWidth / 2 - 270;
    const rightX = arenaWidth / 2 + 20;
    const actions = [
      ["settingsBgm", leftX, 150],
      ["settingsSfx", leftX, 202],
      ["settingsShake", leftX, 254],
      ["settingsFlash", leftX, 306],
      ["settingsAutoFire", rightX, 150],
      ["help", rightX, 202],
      ["resetSettings", rightX, 254],
      ["resetProfile", rightX, 306],
    ] as const;
    return [
      ...actions.map(([action, buttonX, buttonY]) => ({
        action,
        label: label(action),
        x: buttonX,
        y: buttonY,
        width: halfWidth,
        height: buttonHeight,
      })),
      {
        action: "back" as const,
        label: label("back"),
        x,
        y: 390,
        width: buttonWidth,
        height: buttonHeight,
      },
    ];
  }

  if (secondaryMenu === "help") {
    const close = getHelpCloseButtonBounds(arenaWidth, arenaHeight);
    return [
      ...getHelpTabButtonBounds(arenaWidth).map((tab) => ({
        action: tab.action,
        label: label(tab.action),
        x: tab.x,
        y: tab.y,
        width: tab.width,
        height: tab.height,
      })),
      {
        action: "back",
        label: label("back"),
        ...close,
      },
    ];
  }

  if (secondaryMenu === "practice") {
    const weaponWidth = 320;
    const weaponHeight = 120;
    const leftX = arenaWidth / 2 - 340;
    const rightX = arenaWidth / 2 + 20;
    return [
      {
        action: "practiceStartPulse",
        label: label("practiceStartPulse"),
        x: leftX,
        y: 190,
        width: weaponWidth,
        height: weaponHeight,
      },
      {
        action: "practiceStartSpread",
        label: label("practiceStartSpread"),
        x: rightX,
        y: 190,
        width: weaponWidth,
        height: weaponHeight,
      },
      {
        action: "back",
        label: label("back"),
        x: arenaWidth / 2 - 80,
        y: 438,
        width: 160,
        height: 36,
      },
    ];
  }

  if (secondaryMenu === "story") {
    return [
      {
        action: "startTraining",
        label: "第1章　初期作戦",
        x: arenaWidth / 2 - 280,
        y: 176,
        width: 560,
        height: 82,
      },
      {
        action: "startExpedition",
        label: "最終章　最終遠征",
        x: arenaWidth / 2 - 280,
        y: 278,
        width: 560,
        height: 82,
      },
      {
        action: "back",
        label: label("back"),
        x: arenaWidth / 2 - 80,
        y: 420,
        width: 160,
        height: 36,
      },
    ];
  }

  if (secondaryMenu === "practiceSettings") {
    const selectorLeftX = arenaWidth / 2 + 90;
    const selectorRightX = arenaWidth / 2 + 270;
    const enemyLeftX = arenaWidth / 2 - 230;
    const enemyRightX = arenaWidth / 2 + 30;
    return [
      {
        action: "practiceInvinciblePrevious",
        label: label("practiceInvinciblePrevious"),
        x: selectorLeftX,
        y: 112,
        width: 40,
        height: 40,
      },
      {
        action: "practiceInvincibleNext",
        label: label("practiceInvincibleNext"),
        x: selectorRightX,
        y: 112,
        width: 40,
        height: 40,
      },
      {
        action: "practiceIntensityPrevious",
        label: label("practiceIntensityPrevious"),
        x: selectorLeftX,
        y: 174,
        width: 40,
        height: 40,
      },
      {
        action: "practiceIntensityNext",
        label: label("practiceIntensityNext"),
        x: selectorRightX,
        y: 174,
        width: 40,
        height: 40,
      },
      ...(
        [
          ["practiceEnemyChaser", enemyLeftX, 286],
          ["practiceEnemyBrute", enemyRightX, 286],
          ["practiceEnemyFast", enemyLeftX, 342],
          ["practiceEnemyRanged", enemyRightX, 342],
        ] as const
      ).map(([action, buttonX, buttonY]) => ({
        action,
        label: label(action),
        x: buttonX,
        y: buttonY,
        width: 200,
        height: 40,
      })),
      {
        action: "back",
        label: label("back"),
        x: arenaWidth / 2 - 80,
        y: 446,
        width: 160,
        height: 36,
      },
    ];
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
        action: "rankingPrevious",
        label: label("rankingPrevious"),
        x: arenaWidth / 2 - 270,
        y: arenaHeight - 146,
        width: 250,
        height: buttonHeight,
      },
      {
        action: "rankingNext",
        label: label("rankingNext"),
        x: arenaWidth / 2 + 20,
        y: arenaHeight - 146,
        width: 250,
        height: buttonHeight,
      },
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
    const primary: MenuAction[] = ["story"];
    const support: MenuAction[] = ["start", "practice"];
    const utility: MenuAction[] = [
      "ranking",
      "history",
      "help",
      "settings",
      "betaInfo",
    ];
    return [
      ...primary.map((action, index) => ({
        action,
        label: label(action),
        x: 88,
        y: 146,
        width: 784,
        height: 86,
      })),
      ...support.map((action, index) => ({
        action,
        label: label(action),
        x: 88 + index * 392,
        y: 250,
        width: 376,
        height: 66,
      })),
      ...utility.map((action, index) => ({
        action,
        label: label(action),
        x: 76 + index * 164,
        y: 368,
        width: 152,
        height: 44,
      })),
    ];
  }

  if (status === "trainingComplete") {
    return [
      { action: "start", label: label("start"), x, y: 348, width: buttonWidth, height: buttonHeight },
      { action: "title", label: label("title"), x, y: 400, width: buttonWidth, height: buttonHeight },
    ];
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
      { action: "restart", label: label("restart"), x, y: 346, width: buttonWidth, height: buttonHeight },
      { action: "ranking", label: label("ranking"), x, y: 394, width: buttonWidth, height: buttonHeight },
      { action: "history", label: label("history"), x, y: 442, width: buttonWidth, height: buttonHeight },
      { action: "title", label: label("title"), x, y: 490, width: buttonWidth, height: buttonHeight },
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
