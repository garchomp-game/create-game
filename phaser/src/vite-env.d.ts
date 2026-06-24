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
  feedback: FeedbackSnapshot;
  audioCues: AudioCueId[];
  lastEvents: GameEvent[];
};

export type ArenaDebugApi = {
  getSnapshot(): ArenaDebugSnapshot;
  forceDamage(amount: number): void;
  forceGameOver(): void;
  grantXp(amount: number): void;
  forceUpgradeSelect(): void;
  restart(): void;
  setPaused(paused: boolean): void;
  step(input?: Partial<InputSnapshot>, deltaSeconds?: number): void;
};

declare global {
  interface Window {
    __ARENA_DEBUG__?: ArenaDebugApi;
  }
}
