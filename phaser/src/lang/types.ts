import type {
  EnemyTypeId,
  EncounterId,
  ExtraUpgradeId,
  UpgradeCategory,
  UpgradeId,
  WeaponTypeId,
} from "../domain/types";
import type { UpgradePreviewStat } from "../simulation/upgradePreview";

export type MenuActionLabel =
  | "start"
  | "startExpedition"
  | "startTraining"
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

export type UiText = {
  libraryLabel: string;
  titleScreen: string;
  endlessMode: string;
  expeditionMode: string;
  trainingMode: string;
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
  trainingPaused: string;
  trainingCompleteTitle: string;
  trainingCompleteDescription: string;
  trainingRetry: {
    enemyProjectile: string;
    damage: string;
  };
  upgradeHeading: (level: number) => string;
  extraUpgradeHeading: (extraLevel: number, cycle: number) => string;
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
  trainingSteps: Record<
    | "move"
    | "navigate"
    | "contactDamage"
    | "aimAndKill"
    | "collectXp"
    | "dodgeProjectile"
    | "collectRepair"
    | "chooseUpgrade"
    | "transferDrill",
    {
      title: string;
      instruction: string;
      briefing: string;
      actionLabel: string;
      hint1: string;
      hint2: string;
      success: string;
    }
  >;
  damageSource: {
    enemyContact: (enemyName: string) => string;
    enemyProjectile: string;
    collapse: (stage: number) => string;
  };
  enemyNames: Record<EnemyTypeId, string>;
};

export type HudText = {
  hpLabel: string;
  hpValue: (current: number, max: number) => string;
  levelLabel: (level: number) => string;
  extraLevelLabel: (extraLevel: number, cycle: number) => string;
  experienceValue: (xp: number, next: number) => string;
  hp: (current: number, max: number) => string;
  xp: (level: number, xp: number, next: number) => string;
  buildComplete: (level: number) => string;
  extraXp: (extraLevel: number, cycle: number, xp: number, next: number) => string;
  meta: (time: string, score: number) => string;
  danger: (
    threatTier: number,
    enemies: number,
    maxEnemies: number,
    weaponName: string,
  ) => string;
  encounterWarning: (encounterName: string, seconds: number) => string;
  encounterActive: (encounterName: string, seconds: number) => string;
  encounterRecovery: (encounterName: string, seconds: number) => string;
  collapseWarning: (seconds: number) => string;
  collapseActive: (stage: number) => string;
  overdriveContract: string;
  weapon: (
    weaponName: string,
    fireRate: string,
    projectileCount: number,
    extraPierce: number,
  ) => string;
  weaponNames: Record<WeaponTypeId, string>;
  encounterNames: Record<EncounterId, string>;
};

export type UpgradeText = {
  definitions: Record<UpgradeId, {
    title: string;
    description: string;
  }>;
  extraDefinitions: Record<ExtraUpgradeId, {
    title: string;
    description: string;
  }>;
  extraCategoryLabel: string;
  categoryLabels: Record<UpgradeCategory, string>;
  capstoneProgress: (current: number, required: number) => string;
  capstoneAcquired: (name: string) => string;
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
