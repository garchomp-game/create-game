/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_APP_VERSION: string;
  readonly VITE_RULESET_VERSION: string;
  readonly VITE_GIT_COMMIT: string;
  readonly VITE_ARENA_FIXED_SEED?: string;
  readonly VITE_ARENA_RUN_ORIGIN?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

import type { AudioCueId } from "./adapters/phaser/PhaserAudioEventRouter";
import type { FeedbackSnapshot } from "./adapters/phaser/PhaserFeedbackLayer";
import type { MusicSnapshot } from "./adapters/phaser/PhaserMusicController";
import type { SecondaryMenu } from "./adapters/phaser/PhaserMenuLayout";
import type {
  LocalProfile,
  ProfileSettings,
  ProfileSettingsUpdate,
} from "./domain/profile";
import type {
  RankEligibility,
  RunContext,
  RunOrigin,
  RunRecord,
  SeedCategory,
} from "./domain/runRecords";
import type { RunRecordWriteResult } from "./ports/RunRecordStorePort";
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
  runContext: RunContext | null;
  latestRunRecord: RunRecord | null;
  secondaryMenu: SecondaryMenu | null;
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
  music: MusicSnapshot;
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
  rulesetVersion: string;
  configVersion: string;
  buildCommit: string;
  runId: string;
  profileId: string;
  modeId: string;
  stageId: string;
  difficultyId: string;
  runOrigin: RunOrigin;
  rankEligibility: RankEligibility;
  seed: number;
  seedCategory: SeedCategory;
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
  getRunRecords(): RunRecord[];
  getRunHistory(): RunRecord[];
  getRunRankingRecords(): RunRecord[];
  clearRunRecords(): RunRecordWriteResult;
  getProfile(): LocalProfile;
  getSettings(): ProfileSettings;
  updateSettings(update: ProfileSettingsUpdate): ProfileSettings;
  openMenu(menu: SecondaryMenu | null): void;
  saveRunExport(): Promise<{ ok: boolean; path?: string; error?: string }>;
  forceDamage(amount: number): void;
  restoreHealthForSoak(): void;
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
