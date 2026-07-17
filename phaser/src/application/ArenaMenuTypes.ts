export type SecondaryMenu = "history" | "ranking" | "settings";

export type HistoryWeaponFilter = "all" | "pulse" | "spread";

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
  | "betaInfo"
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
