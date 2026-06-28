/// <reference types="vite/client" />

import type { AudioCueId } from "./adapters/phaser/PhaserAudioEventRouter";
import type { FeedbackSnapshot } from "./adapters/phaser/PhaserFeedbackLayer";
import type {
  EnemyTypeId,
  GameEvent,
  GameStatus,
  InputSnapshot,
  RunResultSummary,
  RunStats,
  RuntimeModifiers,
  UpgradeId,
  Vec2,
  WaveBand,
  WeaponTypeId,
} from "./domain/types";

export type ArenaDebugSnapshot = {
  configVersion: string;
  buildCommit: string;
  seed: number;
  status: GameStatus;
  elapsed: number;
  hp: number;
  score: number;
  weaponType: WeaponTypeId;
  level: number;
  xp: number;
  xpToNext: number;
  pendingUpgradeChoices: UpgradeId[];
  upgradeRanks: Record<UpgradeId, number>;
  runtime: RuntimeModifiers;
  wave: WaveBand;
  stats: RunStats;
  resultSummary: RunResultSummary;
  player: Vec2;
  lastAim: Vec2;
  bulletCount: number;
  enemyCount: number;
  enemyTypeCounts: Record<EnemyTypeId, number>;
  enemyProjectileCount: number;
  pickupCount: number;
  obstacleContacts: ArenaObstacleContactCounts;
  feedback: FeedbackSnapshot;
  audioCues: AudioCueId[];
  lastEvents: GameEvent[];
};

export type ArenaObstacleContactCounts = {
  player: number;
  enemies: number;
  bullets: number;
  enemyProjectiles: number;
  pickups: number;
};

export type ArenaRunExport = {
  capturedAt: string;
  game: "arena-core-phaser";
  appVersion: string;
  configVersion: string;
  buildCommit: string;
  seed: number;
  status: GameStatus;
  elapsed: number;
  wave: WaveBand;
  resultSummary: RunResultSummary;
  stats: RunStats;
  counts: {
    bullets: number;
    enemies: number;
    enemyTypes: Record<EnemyTypeId, number>;
    enemyProjectiles: number;
    pickups: number;
    obstacleContacts: ArenaObstacleContactCounts;
  };
  player: Vec2;
  lastAim: Vec2;
  pendingUpgradeChoices: UpgradeId[];
  upgradeRanks: Record<UpgradeId, number>;
  runtime: RuntimeModifiers;
  lastEvents: GameEvent[];
};

export type ArenaDebugApi = {
  getSnapshot(): ArenaDebugSnapshot;
  getRunExport(): ArenaRunExport;
  getRunExportJson(): string;
  forceDamage(amount: number): void;
  forceGameOver(): void;
  grantXp(amount: number): void;
  forceUpgradeSelect(): void;
  restart(): void;
  setPaused(paused: boolean): void;
  setElapsed(elapsed: number): void;
  setEnemyVisualFixture(band?: "wave2" | "wave3"): void;
  setObstacleFrictionFixture(): void;
  setHealPickupFixture(mode?: "damaged" | "full" | "fatal" | "visual"): void;
  setOffscreenEnemyIndicatorFixture(): void;
  step(input?: Partial<InputSnapshot>, deltaSeconds?: number): void;
};

declare global {
  interface Window {
    __ARENA_DEBUG__?: ArenaDebugApi;
  }
}
