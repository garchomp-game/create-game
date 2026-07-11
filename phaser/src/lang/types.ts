import type {
  EnemyTypeId,
  UpgradeCategory,
  UpgradeId,
  WeaponTypeId,
} from "../domain/types";
import type { UpgradePreviewStat } from "../simulation/upgradePreview";

export type MenuActionLabel =
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

export type UiText = {
  libraryLabel: string;
  titleScreen: string;
  endlessMode: string;
  weaponSelectTitle: string;
  weaponSelectDescription: string;
  contractTitle: string;
  contractDescription: string;
  historyTitle: string;
  rankingTitle: string;
  settingsTitle: string;
  noRecords: string;
  firstRecord: string;
  newBest: (delta: number) => string;
  bestDifference: (delta: number) => string;
  rankingEligible: string;
  rankingIneligible: (reasons: string) => string;
  paused: string;
  upgradeHeading: (level: number) => string;
  rank: string;
  result: {
    title: string;
    scoreTime: (score: number, time: string) => string;
    levelKills: (level: number, kills: number) => string;
    shotsRecovered: (shots: number, recovered: number) => string;
    heals: (effective: number, collected: number) => string;
    cause: (cause: string) => string;
  };
  menu: Record<MenuActionLabel, string>;
  damageSource: {
    enemyContact: (enemyName: string) => string;
    enemyProjectile: string;
  };
  enemyNames: Record<EnemyTypeId, string>;
};

export type HudText = {
  hp: (current: number, max: number) => string;
  xp: (level: number, xp: number, next: number) => string;
  buildComplete: (level: number) => string;
  meta: (time: string, score: number) => string;
  danger: (
    wave: number,
    enemies: number,
    maxEnemies: number,
    weaponName: string,
  ) => string;
  encounterWarning: (seconds: number) => string;
  encounterActive: (seconds: number) => string;
  encounterRecovery: (seconds: number) => string;
  overdriveContract: string;
  weapon: (
    weaponName: string,
    fireRate: string,
    projectileCount: number,
    extraPierce: number,
  ) => string;
  weaponNames: Record<WeaponTypeId, string>;
};

export type UpgradeText = {
  definitions: Record<UpgradeId, {
    title: string;
    description: string;
  }>;
  categoryLabels: Record<UpgradeCategory, string>;
  capstoneProgress: (current: number, required: number) => string;
  capstoneAcquired: string;
  preview: {
    labels: Record<UpgradePreviewStat, string>;
    perSecond: string;
    separator: string;
  };
};

export type DebugText = {
  title: string;
  delta: (value: string) => string;
  p95Delta: (value: string) => string;
  enemies: (count: number) => string;
  bullets: (count: number) => string;
};

export type GameText = {
  ui: UiText;
  hud: HudText;
  upgrades: UpgradeText;
  debug: DebugText;
};
