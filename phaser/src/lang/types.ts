import type { EnemyTypeId, UpgradeId, WeaponTypeId } from "../domain/types";
import type { UpgradePreviewStat } from "../simulation/upgradePreview";

export type MenuActionLabel = "start" | "resume" | "restart" | "title";

export type UiText = {
  libraryLabel: string;
  titleScreen: string;
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
  meta: (wave: number, time: string, score: number, enemies: number, maxEnemies: number) => string;
  weapon: (weaponName: string, fireRate: string, projectileCount: number, pierce: number) => string;
  weaponNames: Record<WeaponTypeId, string>;
};

export type UpgradeText = {
  definitions: Record<UpgradeId, {
    title: string;
    description: string;
  }>;
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
