import type {
  AudioCueId,
  AudioRoutingSnapshot,
} from "./PhaserAudioEventRouter";
import type {
  ArenaCaptureLayerSnapshot,
  ArenaCaptureScenarioId,
} from "./ArenaCaptureScenarios";
import type { FeedbackSnapshot } from "./PhaserFeedbackLayer";
import type { MusicSnapshot } from "./PhaserMusicController";
import type { SecondaryMenu } from "./PhaserMenuLayout";
import type {
  LocalProfile,
  ProfileSettings,
  ProfileSettingsUpdate,
} from "../../domain/profile";
import type {
  RankEligibility,
  RunComparisonQuery,
  RunContext,
  RunOrigin,
  RunRecord,
  SeedCategory,
} from "../../domain/runRecords";
import type { RunRecordWriteResult } from "../../ports/RunRecordStorePort";
import type {
  RandomStreamId,
  RandomStreams,
} from "../../math/random";
import type {
  EnemyTypeId,
  BossAttackId,
  EncounterState,
  ExpeditionState,
  ExtraUpgradeId,
  GameEvent,
  GameStatus,
  InputSnapshot,
  RunResultSummary,
  RunStats,
  RuntimeModifiers,
  ProgressionChoiceId,
  UpgradeId,
  Vec2,
  WaveBand,
  WeaponTypeId,
} from "../../domain/types";
import type {
  AutoPilotMode,
  AutoPilotOverrideReason,
} from "../../simulation/autoPilot";
import type { BuildComposition } from "../../simulation/buildComposer";
import type { ArenaPerformanceSnapshot } from "../../application/PerformanceMonitor";
import type { ArenaRenderPerformanceSnapshot } from "./PhaserArenaRenderer";
export type { ArenaPerformanceSnapshot } from "../../application/PerformanceMonitor";

export type ArenaObstacleContactCounts = {
  player: number;
  enemies: number;
  bullets: number;
  enemyProjectiles: number;
  pickups: number;
};

export type ArenaRandomStreamSnapshot = Pick<RandomStreams, "version" | "rootSeed"> & {
  seeds: Record<RandomStreamId, number>;
};

export type ArenaDebugSnapshot = {
  configVersion: string;
  buildCommit: string;
  runContext: RunContext | null;
  latestRunRecord: RunRecord | null;
  secondaryMenu: SecondaryMenu | null;
  rankingQuery: RunComparisonQuery | null;
  rankingBoardIndex: number;
  rankingBoardCount: number;
  seed: number;
  randomStreams: ArenaRandomStreamSnapshot;
  status: GameStatus;
  autoPilotEnabled: boolean;
  autoPilotMode: AutoPilotMode | null;
  autoPilotIntentMode: AutoPilotMode | null;
  autoPilotOverrideReason: AutoPilotOverrideReason | null;
  autoPilotRiskScore: number;
  autoPilotTargetId: string | null;
  performance: ArenaPerformanceSnapshot;
  renderPerformance: ArenaRenderPerformanceSnapshot;
  elapsed: number;
  difficultyElapsed: number;
  hp: number;
  score: number;
  weaponType: WeaponTypeId;
  level: number;
  extraLevel: number;
  extraCycle: number;
  xp: number;
  xpToNext: number;
  buildCompletedAt: number | null;
  pendingUpgradeChoices: ProgressionChoiceId[];
  upgradeRanks: Record<UpgradeId, number>;
  extraUpgradeRanks: Record<ExtraUpgradeId, number>;
  extraCycleRemaining: ExtraUpgradeId[];
  runtime: RuntimeModifiers;
  buildComposition: BuildComposition;
  encounter: EncounterState;
  expedition: ExpeditionState | null;
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
  captureScenario: {
    id: ArenaCaptureScenarioId;
    layers: ArenaCaptureLayerSnapshot;
  } | null;
  feedback: FeedbackSnapshot;
  audioCues: AudioCueId[];
  audioRouting: AudioRoutingSnapshot;
  music: MusicSnapshot;
  lastEvents: GameEvent[];
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
  randomStreams: ArenaRandomStreamSnapshot;
  status: GameStatus;
  performance: ArenaPerformanceSnapshot;
  renderPerformance: ArenaRenderPerformanceSnapshot;
  elapsed: number;
  difficultyElapsed: number;
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
  buildCompletedAt: number | null;
  extraLevel: number;
  extraCycle: number;
  pendingUpgradeChoices: ProgressionChoiceId[];
  upgradeRanks: Record<UpgradeId, number>;
  extraUpgradeRanks: Record<ExtraUpgradeId, number>;
  extraCycleRemaining: ExtraUpgradeId[];
  runtime: RuntimeModifiers;
  buildComposition: BuildComposition;
  encounter: EncounterState;
  expedition: ExpeditionState | null;
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
  forceExtraUpgradeSelect(): void;
  restart(): void;
  startAutoPilot(weaponType?: WeaponTypeId): void;
  setAutoPilotEnabled(enabled: boolean): void;
  setPaused(paused: boolean): void;
  setElapsed(elapsed: number): void;
  setHudStressFixture(): void;
  setEnemyVisualFixture(band?: "wave2" | "wave3"): void;
  setObstacleFrictionFixture(): void;
  setHealPickupFixture(mode?: "damaged" | "full" | "fatal" | "visual"): void;
  setOffscreenEnemyIndicatorFixture(): void;
  setExpeditionCommanderFixture(): void;
  setExpeditionChargerFixture(): void;
  setExpeditionBossFixture(attackId?: BossAttackId, phase?: 1 | 2): void;
  loadCaptureScenario(scenarioId: ArenaCaptureScenarioId): boolean;
  armExpeditionBossDefeat(): void;
  step(input?: Partial<InputSnapshot>, deltaSeconds?: number): void;
};

type DebugWindow = {
  __ARENA_DEBUG__?: ArenaDebugApi;
};

export class ArenaDebugBridge {
  private installedApi: ArenaDebugApi | null = null;

  constructor(private readonly target: DebugWindow) {}

  install(api: ArenaDebugApi): void {
    this.installedApi = api;
    this.target.__ARENA_DEBUG__ = api;
  }

  uninstall(): void {
    if (this.target.__ARENA_DEBUG__ === this.installedApi) {
      delete this.target.__ARENA_DEBUG__;
    }
    this.installedApi = null;
  }
}
