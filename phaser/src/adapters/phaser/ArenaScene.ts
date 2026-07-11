import Phaser from "phaser";
import {
  SIMULATION_CONFIG,
  SIMULATION_CONFIG_VERSION,
  VIEW_CONFIG,
} from "../../config/gameConfig";
import {
  APP_VERSION,
  DEFAULT_DIFFICULTY_ID,
  DEFAULT_MODE_ID,
  DEFAULT_STAGE_ID,
  RULESET_VERSION,
} from "../../config/version";
import { resolveRunOrigin, resolveSeedCategory } from "../../application/runEnvironment";
import { RunRecordCoordinator } from "../../application/RunRecordCoordinator";
import {
  compareRunRecords,
  createRankEligibility,
  selectPersonalBest,
  selectRanking,
} from "../../application/runRecords";
import type { RunOrigin, RunRecord } from "../../domain/runRecords";
import type {
  LocalProfile,
  ProfileSettings,
  ProfileSettingsUpdate,
} from "../../domain/profile";
import type {
  CircleBody,
  Enemy,
  EnemyProjectile,
  EnemyTypeId,
  GameEvent,
  Pickup,
  RandomSource,
  SimulationConfig,
  StepWorldResult,
  ViewConfig,
  WorldState,
  InputSnapshot,
} from "../../domain/types";
import { ConsoleLogger } from "../telemetry/ConsoleLogger";
import { FrameSpikeReporter } from "../telemetry/FrameSpikeReporter";
import { InMemoryMetrics } from "../telemetry/InMemoryMetrics";
import { circleRect } from "../../math/geometry";
import { createRandom } from "../../math/random";
import { createWorld } from "../../simulation/createWorld";
import { createRunResultSummary } from "../../simulation/resultSummary";
import { stepWorld } from "../../simulation/stepWorld";
import { selectUpgradeChoices, updateLevelProgression } from "../../simulation/systems/levelSystem";
import { updateRunStats } from "../../simulation/systems/statsSystem";
import { getWaveBand } from "../../simulation/waveDirector";
import { PhaserAudioEventRouter } from "./PhaserAudioEventRouter";
import { PhaserArenaRenderer } from "./PhaserArenaRenderer";
import { PhaserDebugOverlay } from "./PhaserDebugOverlay";
import { PhaserFeedbackLayer } from "./PhaserFeedbackLayer";
import { PhaserInputAdapter } from "./PhaserInputAdapter";
import { PhaserMusicController } from "./PhaserMusicController";
import type { MenuAction, SecondaryMenu } from "./PhaserMenuLayout";
import type { PhaserUiState } from "./PhaserUiState";
import { createBrowserStorage, createVolatileStorage } from "../storage/BrowserStorage";
import { LocalProfileStore } from "../storage/LocalProfileStore";
import { LocalRunRecordStore } from "../storage/LocalRunRecordStore";

export class ArenaScene extends Phaser.Scene {
  private inputAdapter!: PhaserInputAdapter;
  private arenaRenderer!: PhaserArenaRenderer;
  private debugOverlay!: PhaserDebugOverlay;
  private feedbackLayer!: PhaserFeedbackLayer;
  private audioRouter!: PhaserAudioEventRouter;
  private musicController!: PhaserMusicController;
  private logger = new ConsoleLogger("warn");
  private metrics = new InMemoryMetrics();
  private frameSpikeReporter = new FrameSpikeReporter(this.logger, this.metrics);
  private simulationConfig: SimulationConfig = SIMULATION_CONFIG;
  private runConfig: SimulationConfig = SIMULATION_CONFIG;
  private viewConfig: ViewConfig = VIEW_CONFIG;
  private runSeed = SIMULATION_CONFIG.seed;
  private runRecordStore!: LocalRunRecordStore;
  private runRecordCoordinator!: RunRecordCoordinator;
  private runHistory: RunRecord[] = [];
  private runRankings: RunRecord[] = [];
  private latestRunRecord: RunRecord | null = null;
  private previousBest: RunRecord | null = null;
  private profileStore!: LocalProfileStore;
  private profile!: LocalProfile;
  private settings!: ProfileSettings;
  private random!: RandomSource;
  private world!: WorldState;
  private lastEvents: GameEvent[] = [];
  private debugPaused = false;
  private secondaryMenu: SecondaryMenu | null = null;
  private historyClearPending = false;
  private rankingClearPending = false;
  private historyPage = 0;
  private uiNotice: string | null = null;

  constructor() {
    super("arena");
  }

  preload(): void {
    this.load.audio("bgmEndless", "/audio/arena-loop.ogg");
    this.load.audio("shot", "/audio/shot.ogg");
    this.load.audio("shotAlt1", "/audio/shot-alt-1.ogg");
    this.load.audio("shotAlt2", "/audio/shot-alt-2.ogg");
    this.load.audio("hit", "/audio/hit.ogg");
    this.load.audio("hitAlt1", "/audio/hit-alt-1.ogg");
    this.load.audio("hitAlt2", "/audio/hit-alt-2.ogg");
    this.load.audio("kill", "/audio/kill.ogg");
    this.load.audio("killAlt1", "/audio/kill-alt-1.ogg");
    this.load.audio("pickup", "/audio/pickup.ogg");
    this.load.audio("pickupAlt1", "/audio/pickup-alt-1.ogg");
    this.load.audio("levelUp", "/audio/level-up.ogg");
    this.load.audio("upgrade", "/audio/upgrade.ogg");
    this.load.audio("damage", "/audio/damage.ogg");
    this.load.audio("damageAlt1", "/audio/damage-alt-1.ogg");
    this.load.audio("gameOver", "/audio/game-over.ogg");
  }

  create(): void {
    this.simulationConfig =
      (this.registry.get("simulationConfig") as SimulationConfig | undefined) ?? SIMULATION_CONFIG;
    this.viewConfig = (this.registry.get("viewConfig") as ViewConfig | undefined) ?? VIEW_CONFIG;
    const storage = createBrowserStorage();
    this.runRecordStore = new LocalRunRecordStore(storage);
    this.runRecordCoordinator = new RunRecordCoordinator(this.runRecordStore);
    const loadedRecords = this.runRecordStore.load();
    this.runHistory = loadedRecords.history;
    this.runRankings = loadedRecords.rankings;
    this.initializeProfile(storage);
    this.inputAdapter = new PhaserInputAdapter(this);
    this.arenaRenderer = new PhaserArenaRenderer(this, this.simulationConfig, this.viewConfig);
    this.feedbackLayer = new PhaserFeedbackLayer(this);
    this.feedbackLayer.configure(this.settings);
    this.audioRouter = new PhaserAudioEventRouter(this);
    this.audioRouter.configure(this.settings);
    this.musicController = new PhaserMusicController(this);
    this.musicController.configure(this.settings);
    this.debugOverlay = new PhaserDebugOverlay(this, this.metrics);
    this.resetGame("title");
    this.installDebugHook();
  }

  update(_time: number, deltaMs: number): void {
    const input = this.inputAdapter.read(
      this.world.state.status,
      this.world.progression.pendingUpgradeChoices.length,
      this.settings.autoFireEnabled,
      this.secondaryMenu,
    );
    const menuAction = this.inputAdapter.consumeMenuAction();
    if (menuAction && this.handleMenuAction(menuAction)) {
      this.renderCurrentWorld();
      return;
    }
    if (this.secondaryMenu) {
      this.renderCurrentWorld();
      return;
    }
    if (import.meta.env.DEV && this.inputAdapter.readDebugTogglePressed()) {
      this.debugOverlay.toggle();
    }
    if (this.debugPaused) {
      this.feedbackLayer.update(0);
      this.stepDebugControls(input);
      this.renderCurrentWorld();
      return;
    }

    this.feedbackLayer.update(deltaMs / 1000);
    const result = stepWorld(this.world, input, deltaMs / 1000, this.random, this.runConfig);
    this.recordResult(result);
    if (result.events.some((event) => event.type === "game.restart.requested")) {
      this.resetGame("playing");
      this.renderCurrentWorld();
      return;
    }
    if (result.events.some((event) => event.type === "game.title.requested")) {
      this.resetGame("title");
      this.renderCurrentWorld();
      return;
    }

    this.renderCurrentWorld();
  }

  private resetGame(
    status: WorldState["state"]["status"] = "playing",
    runOriginOverride?: RunOrigin,
  ): void {
    this.inputAdapter.clearTransientInput();
    const fixedSeed = this.getFixedRunSeed();
    this.runSeed = this.createRunSeed(fixedSeed);
    this.runConfig = { ...this.simulationConfig, seed: this.runSeed };
    this.random = createRandom(this.runSeed);
    this.world = createWorld(this.runConfig);
    this.world.state.status = status;
    const runOrigin = runOriginOverride ?? this.getBaseRunOrigin();
    this.runRecordCoordinator.reset(
      {
        id: this.createRunId(),
        profileId: this.profile.id,
        startedAt: new Date().toISOString(),
        modeId: DEFAULT_MODE_ID,
        stageId: DEFAULT_STAGE_ID,
        difficultyId: DEFAULT_DIFFICULTY_ID,
        rulesetVersion: RULESET_VERSION,
        seedCategory: resolveSeedCategory(fixedSeed),
        weaponId: this.world.state.weaponType,
        modifierIds: [`auto-fire:${this.settings.autoFireEnabled ? "on" : "off"}`],
        appVersion: APP_VERSION,
        buildCommit: this.getBuildCommit(),
        seed: this.runSeed,
        runOrigin,
        rankEligibility: createRankEligibility(runOrigin),
      },
      status === "playing",
    );
    this.latestRunRecord = null;
    this.previousBest = null;
    this.secondaryMenu = null;
    this.historyClearPending = false;
    this.rankingClearPending = false;
    this.historyPage = 0;
    this.uiNotice = null;
    this.lastEvents = [];
    this.feedbackLayer.reset();
    this.audioRouter.reset();
  }

  private recordResult(result: StepWorldResult): void {
    for (const metric of result.metrics) {
      this.metrics.record(metric);
    }
    this.frameSpikeReporter.report(result.metrics);

    for (const event of result.events) {
      this.lastEvents.push(event);
      this.logEvent(event);
      if (event.type === "game.started") this.runRecordCoordinator.markStarted();
    }
    this.lastEvents = this.lastEvents.slice(-20);
    this.feedbackLayer.handleEvents(result.events, this.world);
    this.audioRouter.handleEvents(result.events);
    if (result.events.some((event) => event.type === "game.over")) {
      this.finalizeRunRecord();
    }
  }

  private finalizeRunRecord(): void {
    const context = this.runRecordCoordinator.getContext();
    this.previousBest = context
      ? selectPersonalBest(
          this.runRankings.filter((record) => record.profileId === this.profile.id),
          context,
        )
      : null;
    const result = this.runRecordCoordinator.finalize({
      capturedAt: new Date().toISOString(),
      summary: createRunResultSummary(this.world),
      upgradeRanks: this.world.progression.upgradeRanks,
    });

    if (result.status === "notStarted" || result.status === "alreadyFinalized") return;

    this.latestRunRecord = result.record;
    if (
      result.record.rankEligibility.eligible &&
      (this.previousBest === null || compareRunRecords(result.record, this.previousBest) < 0)
    ) {
      this.feedbackLayer.celebrateRecord(this.world.player.position);
    }
    if (result.write.ok) {
      this.runHistory = result.write.history;
      this.runRankings = result.write.rankings;
    }
    if (result.status === "saveFailed") {
      this.uiNotice = "記録を保存できませんでした";
      this.logger.warn("run.record.save_failed", {
        runId: result.record.id,
        message: result.write.error ?? "Unknown storage failure.",
      });
    }

    if (
      import.meta.env.DEV &&
      result.record.runOrigin !== "test" &&
      result.record.elapsed >= 1
    ) {
      void this.submitDevRunExport();
    }
  }

  private logEvent(event: GameEvent): void {
    if (event.type === "game.over") {
      this.logger.info("game.over", {
        score: event.score,
        elapsed: Number(event.elapsed.toFixed(2)),
      });
    }
  }

  private stepDebugWorld(input: Partial<InputSnapshot>, deltaSeconds: number): void {
    this.runRecordCoordinator.markDebugMutation();
    const debugInput: InputSnapshot = {
      move: input.move ?? { x: 0, y: 0 },
      aimWorld: input.aimWorld ?? null,
      startPressed: input.startPressed ?? false,
      shootHeld: input.shootHeld ?? false,
      restartPressed: input.restartPressed ?? false,
      pausePressed: input.pausePressed ?? false,
      quitToTitlePressed: input.quitToTitlePressed ?? false,
      upgradeChoicePressed: input.upgradeChoicePressed ?? null,
    };
    const result = stepWorld(
      this.world,
      debugInput,
      deltaSeconds,
      this.random,
      this.runConfig,
    );
    this.recordResult(result);
    if (result.events.some((event) => event.type === "game.restart.requested")) {
      this.resetGame("playing");
    }
    if (result.events.some((event) => event.type === "game.title.requested")) {
      this.resetGame("title");
    }
    this.renderCurrentWorld();
  }

  private stepDebugControls(input: InputSnapshot): void {
    if (
      !input.restartPressed &&
      !input.pausePressed &&
      !input.startPressed &&
      !input.quitToTitlePressed
    ) return;

    const result = stepWorld(
      this.world,
      {
        move: { x: 0, y: 0 },
        aimWorld: null,
        startPressed: input.startPressed,
        shootHeld: false,
        restartPressed: input.restartPressed,
        pausePressed: input.pausePressed,
        quitToTitlePressed: input.quitToTitlePressed,
        upgradeChoicePressed: null,
      },
      0,
      this.random,
      this.runConfig,
    );
    this.recordResult(result);
    if (result.events.some((event) => event.type === "game.restart.requested")) {
      this.resetGame("playing");
    }
    if (result.events.some((event) => event.type === "game.title.requested")) {
      this.resetGame("title");
    }
  }

  private forceDamage(amount: number): void {
    if (this.world.state.status !== "playing") return;

    this.runRecordCoordinator.markDebugMutation();
    this.inputAdapter.clearTransientInput();
    const requestedDamage = Number.isFinite(amount) ? Math.max(0, amount) : 0;
    if (requestedDamage === 0) return;

    const hpBefore = this.world.state.hp;
    this.world.state.hp = Math.max(0, hpBefore - requestedDamage);
    const appliedDamage = hpBefore - this.world.state.hp;
    const events: GameEvent[] = [];

    if (appliedDamage > 0) {
      events.push({
        type: "player.damaged",
        damage: appliedDamage,
        hpAfter: this.world.state.hp,
      });
    }

    if (this.world.state.hp === 0) {
      this.world.state.status = "gameOver";
      events.push({
        type: "game.over",
        score: this.world.state.score,
        elapsed: this.world.state.elapsed,
      });
    }

    this.recordForcedEvents(events);
    this.renderCurrentWorld();
  }

  private forceGameOver(): void {
    if (this.world.state.status === "gameOver") return;

    this.runRecordCoordinator.markDebugMutation();
    this.inputAdapter.clearTransientInput();
    this.world.state.hp = 0;
    this.world.state.status = "gameOver";
    this.recordForcedEvents([
      {
        type: "game.over",
        score: this.world.state.score,
        elapsed: this.world.state.elapsed,
      },
    ]);
    this.renderCurrentWorld();
  }

  private grantXp(amount: number): void {
    if (this.world.state.status !== "playing") return;

    this.runRecordCoordinator.markDebugMutation();
    this.inputAdapter.clearTransientInput();
    const xpValue = Math.max(0, Math.floor(amount));
    if (xpValue === 0) return;

    const events: GameEvent[] = [
      {
        type: "pickup.collected",
        pickupId: "debug-xp",
        pickupKind: "xp",
        xpValue,
        healValue: 0,
        hpRecovered: 0,
      },
    ];
    this.world.progression.xp += xpValue;
    updateLevelProgression(this.world, this.random, this.runConfig, events);
    updateRunStats(this.world, events);
    this.recordResult({ events, metrics: [] });
    this.renderCurrentWorld();
  }

  private forceUpgradeSelect(): void {
    if (this.world.state.status === "gameOver") return;

    this.runRecordCoordinator.markDebugMutation();
    this.inputAdapter.clearTransientInput();
    this.world.state.status = "upgradeSelect";
    this.world.progression.pendingUpgradeChoices = selectUpgradeChoices(
      this.runConfig,
      this.random,
      this.world.progression.upgradeRanks,
    );
    this.recordResult({
      events: [
        {
          type: "player.level_up",
          level: this.world.progression.level,
          choices: [...this.world.progression.pendingUpgradeChoices],
        },
        {
          type: "upgrade.offered",
          level: this.world.progression.level,
          choices: [...this.world.progression.pendingUpgradeChoices],
        },
      ],
      metrics: [],
    });
    this.renderCurrentWorld();
  }

  private setElapsedForDebug(elapsed: number): void {
    if (!Number.isFinite(elapsed)) return;

    this.runRecordCoordinator.markDebugMutation();
    this.world.state.elapsed = Math.max(0, elapsed);
    this.renderCurrentWorld();
  }

  private setEnemyVisualFixture(band: "wave2" | "wave3" = "wave3"): void {
    this.runRecordCoordinator.markDebugMutation();
    this.inputAdapter.clearTransientInput();
    const enemyLayout: Array<{ typeId: EnemyTypeId; x: number; y: number }> =
      band === "wave2"
        ? [
            { typeId: "chaser", x: 660, y: 205 },
            { typeId: "brute", x: 745, y: 205 },
            { typeId: "fast", x: 830, y: 205 },
          ]
        : [
            { typeId: "chaser", x: 620, y: 205 },
            { typeId: "brute", x: 705, y: 205 },
            { typeId: "fast", x: 790, y: 205 },
            { typeId: "ranged", x: 875, y: 205 },
          ];

    this.world.player.position = { x: 280, y: 390 };
    this.world.state.lastAim = { x: 0.98, y: -0.2 };
    this.world.enemies = enemyLayout.map((item, index): Enemy => {
      const definition = this.runConfig.enemies[item.typeId];
      return {
        id: `debug-enemy-${index + 1}`,
        typeId: item.typeId,
        position: { x: item.x, y: item.y },
        radius: definition.radius,
        hp: definition.hp,
        damage: definition.damage,
        speed: definition.speed,
        score: definition.score,
        xpValue: definition.xpValue,
        behavior: definition.behavior,
        attackTimer: definition.ranged ? definition.ranged.attackInterval : 0,
        enteredArena: true,
      };
    });

    const ranged = this.runConfig.enemies.ranged.ranged;
    this.world.enemyProjectiles = band === "wave3" && ranged
      ? [
          {
            id: "debug-enemy-projectile-1",
            position: { x: 760, y: 295 },
            velocity: { x: -ranged.projectileSpeed, y: 0 },
            radius: ranged.projectileRadius,
            lifetime: ranged.projectileLifetime,
            damage: ranged.projectileDamage,
          } satisfies EnemyProjectile,
        ]
      : [];
    this.world.bullets = [];
    this.world.pickups = [];
    this.world.nextEnemyId = this.world.enemies.length + 1;
    this.world.nextEnemyProjectileId = this.world.enemyProjectiles.length + 1;
    this.renderCurrentWorld();
  }

  private setObstacleFrictionFixture(): void {
    const obstacle = this.runConfig.obstacles[0];
    if (!obstacle) return;

    this.runRecordCoordinator.markDebugMutation();
    this.inputAdapter.clearTransientInput();
    this.world.player.position = {
      x: obstacle.x - this.runConfig.player.radius,
      y: obstacle.y + obstacle.height / 2,
    };
    this.world.state.lastAim = { x: 1, y: 0 };
    this.world.enemies = [];
    this.world.bullets = [];
    this.world.enemyProjectiles = [];
    this.world.pickups = [];
    this.renderCurrentWorld();
  }

  private setHealPickupFixture(mode: "damaged" | "full" | "fatal" | "visual" = "damaged"): void {
    this.runRecordCoordinator.markDebugMutation();
    this.inputAdapter.clearTransientInput();
    const maxHp = this.runConfig.player.maxHp + this.world.runtime.maxHpBonus;
    const healValue = this.getDebugHealValue();

    this.world.state.status = "playing";
    this.world.state.damageCooldown = 0;
    this.world.player.position =
      mode === "visual" ? { x: 280, y: 390 } : { ...this.world.player.position };
    this.world.state.lastAim = { x: 1, y: 0 };
    this.world.enemies = [];
    this.world.bullets = [];
    this.world.enemyProjectiles = [];
    this.world.pickups = [];

    if (mode === "full") {
      this.world.state.hp = maxHp;
    } else if (mode === "fatal") {
      this.world.state.hp = 1;
    } else {
      this.world.state.hp = Math.max(1, maxHp - 40);
    }

    if (mode === "visual") {
      this.world.state.hp = Math.max(1, maxHp - 32);
      this.world.pickups = [
        {
          id: "debug-xp-pickup",
          kind: "xp",
          position: { x: 620, y: 300 },
          radius: this.runConfig.pickup.xpRadius,
          xpValue: 1,
          healValue: 0,
          lifetime: null,
        },
        this.createDebugHealPickup("debug-heal-pickup", { x: 665, y: 300 }, healValue),
      ];
      this.world.enemies = [this.createDebugEnemy("chaser", { x: 740, y: 300 }, 1)];
      const ranged = this.runConfig.enemies.ranged.ranged;
      if (ranged) {
        this.world.enemyProjectiles = [
          {
            id: "debug-heal-projectile",
            position: { x: 705, y: 300 },
            velocity: { x: 0, y: 0 },
            radius: ranged.projectileRadius,
            lifetime: ranged.projectileLifetime,
            damage: ranged.projectileDamage,
          },
        ];
      }
    } else {
      this.world.pickups = [
        this.createDebugHealPickup(
          "debug-heal-pickup",
          { ...this.world.player.position },
          healValue,
        ),
      ];
    }

    if (mode === "fatal") {
      const ranged = this.runConfig.enemies.ranged.ranged;
      this.world.enemyProjectiles = [
        {
          id: "debug-fatal-projectile",
          position: { ...this.world.player.position },
          velocity: { x: 0, y: 0 },
          radius: ranged?.projectileRadius ?? 6,
          lifetime: ranged?.projectileLifetime ?? 1,
          damage: maxHp,
        },
      ];
    }

    this.renderCurrentWorld();
  }

  private setOffscreenEnemyIndicatorFixture(): void {
    this.runRecordCoordinator.markDebugMutation();
    this.inputAdapter.clearTransientInput();
    const { width, height } = this.runConfig.arena;

    this.world.state.status = "playing";
    this.world.state.elapsed = 64;
    this.world.player.position = { x: width / 2, y: height / 2 };
    this.world.state.lastAim = { x: 1, y: 0 };
    this.world.enemies = [
      this.createDebugEnemy("chaser", { x: width * 0.48, y: -34 }, 1, false),
      this.createDebugEnemy("brute", { x: width + 34, y: height * 0.35 }, 2, false),
      this.createDebugEnemy("fast", { x: width * 0.7, y: height + 34 }, 3, false),
      this.createDebugEnemy("ranged", { x: -34, y: height * 0.68 }, 4, false),
    ];
    this.world.enemyProjectiles = [];
    this.world.bullets = [];
    this.world.pickups = [];
    this.world.nextEnemyId = this.world.enemies.length + 1;
    this.renderCurrentWorld();
  }

  private recordForcedEvents(events: GameEvent[]): void {
    updateRunStats(this.world, events);
    this.recordResult({ events, metrics: [] });
  }

  private renderCurrentWorld(): void {
    this.inputAdapter.syncCursor(
      this.world.state.status,
      this.world.progression.pendingUpgradeChoices.length,
      this.secondaryMenu,
    );
    this.arenaRenderer.render(
      this.world,
      this.inputAdapter.getPointerWorld(),
      this.createUiState(),
    );
    this.musicController.sync(this.world.state.status);
    this.feedbackLayer.render();
    this.debugOverlay.render();
  }

  private installDebugHook(): void {
    if (!import.meta.env.DEV) return;

    window.__ARENA_DEBUG__ = {
      getSnapshot: () => ({
        configVersion: SIMULATION_CONFIG_VERSION,
        buildCommit: this.getBuildCommit(),
        runContext: this.runRecordCoordinator.getContext(),
        latestRunRecord: this.latestRunRecord ? { ...this.latestRunRecord } : null,
        secondaryMenu: this.secondaryMenu,
        seed: this.runSeed,
        status: this.world.state.status,
        elapsed: this.world.state.elapsed,
        hp: this.world.state.hp,
        score: this.world.state.score,
        weaponType: this.world.state.weaponType,
        level: this.world.progression.level,
        xp: this.world.progression.xp,
        xpToNext: this.world.progression.xpToNext,
        pendingUpgradeChoices: [...this.world.progression.pendingUpgradeChoices],
        upgradeRanks: { ...this.world.progression.upgradeRanks },
        runtime: { ...this.world.runtime },
        wave: { ...getWaveBand(this.runConfig, this.world.state.elapsed) },
        stats: this.getStatsSnapshot(),
        resultSummary: createRunResultSummary(this.world),
        player: { ...this.world.player.position },
        lastAim: { ...this.world.state.lastAim },
        bulletCount: this.world.bullets.length,
        enemyCount: this.world.enemies.length,
        enemyTypeCounts: this.getEnemyTypeCounts(),
        enemyProjectileCount: this.world.enemyProjectiles.length,
        pickupCount: this.world.pickups.length,
        obstacleContacts: this.getObstacleContactCounts(),
        feedback: this.feedbackLayer.getSnapshot(),
        audioCues: this.audioRouter.getLastCues(),
        music: this.musicController.getSnapshot(),
        lastEvents: [...this.lastEvents],
      }),
      getRunExport: () => this.getRunExport(),
      getRunExportJson: () => JSON.stringify(this.getRunExport(), null, 2),
      getRunRecords: () => this.runRecordStore.load().records,
      getRunHistory: () => this.runRecordStore.load().history,
      getRunRankingRecords: () => this.runRecordStore.load().rankings,
      clearRunRecords: () => this.clearAllRunRecords(),
      getProfile: () => ({ ...this.profile }),
      getSettings: () => ({ ...this.settings }),
      updateSettings: (update: ProfileSettingsUpdate) => {
        this.updateSettings(() => this.profileStore.updateSettings(update));
        this.renderCurrentWorld();
        return { ...this.settings };
      },
      openMenu: (menu: SecondaryMenu | null) => {
        this.secondaryMenu = menu;
        this.historyClearPending = false;
        this.rankingClearPending = false;
        this.historyPage = 0;
        this.renderCurrentWorld();
      },
      saveRunExport: () => this.submitDevRunExport(),
      forceDamage: (amount: number) => {
        this.forceDamage(amount);
      },
      restoreHealthForSoak: () => {
        if (this.world.state.status === "gameOver") return;
        this.runRecordCoordinator.markDebugMutation();
        this.world.state.hp = this.runConfig.player.maxHp + this.world.runtime.maxHpBonus;
        this.renderCurrentWorld();
      },
      forceGameOver: () => {
        this.forceGameOver();
      },
      grantXp: (amount: number) => {
        this.grantXp(amount);
      },
      forceUpgradeSelect: () => {
        this.forceUpgradeSelect();
      },
      restart: () => {
        this.resetGame("playing", this.getDebugRunOrigin());
        this.renderCurrentWorld();
      },
      setPaused: (paused: boolean) => {
        this.runRecordCoordinator.markDebugMutation();
        this.debugPaused = paused;
        this.renderCurrentWorld();
      },
      setElapsed: (elapsed: number) => {
        this.setElapsedForDebug(elapsed);
      },
      setEnemyVisualFixture: (band: "wave2" | "wave3" = "wave3") => {
        this.setEnemyVisualFixture(band);
      },
      setObstacleFrictionFixture: () => {
        this.setObstacleFrictionFixture();
      },
      setHealPickupFixture: (mode: "damaged" | "full" | "fatal" | "visual" = "damaged") => {
        this.setHealPickupFixture(mode);
      },
      setOffscreenEnemyIndicatorFixture: () => {
        this.setOffscreenEnemyIndicatorFixture();
      },
      step: (input: Partial<InputSnapshot> = {}, deltaSeconds = 1 / 60) => {
        this.stepDebugWorld(input, deltaSeconds);
      },
    };
  }

  private getRunExport() {
    const context = this.runRecordCoordinator.getContext();
    return {
      capturedAt: new Date().toISOString(),
      game: "arena-core-phaser" as const,
      appVersion: APP_VERSION,
      rulesetVersion: RULESET_VERSION,
      configVersion: SIMULATION_CONFIG_VERSION,
      buildCommit: this.getBuildCommit(),
      runId: context?.id ?? "unknown",
      profileId: context?.profileId ?? this.profile.id,
      modeId: context?.modeId ?? DEFAULT_MODE_ID,
      stageId: context?.stageId ?? DEFAULT_STAGE_ID,
      difficultyId: context?.difficultyId ?? DEFAULT_DIFFICULTY_ID,
      runOrigin: context?.runOrigin ?? this.getBaseRunOrigin(),
      rankEligibility: context?.rankEligibility ?? createRankEligibility(this.getBaseRunOrigin()),
      seed: this.runSeed,
      seedCategory: context?.seedCategory ?? resolveSeedCategory(this.getFixedRunSeed()),
      status: this.world.state.status,
      elapsed: this.world.state.elapsed,
      wave: { ...getWaveBand(this.runConfig, this.world.state.elapsed) },
      resultSummary: createRunResultSummary(this.world),
      stats: this.getStatsSnapshot(),
      counts: {
        bullets: this.world.bullets.length,
        enemies: this.world.enemies.length,
        enemyTypes: this.getEnemyTypeCounts(),
        enemyProjectiles: this.world.enemyProjectiles.length,
        pickups: this.world.pickups.length,
        obstacleContacts: this.getObstacleContactCounts(),
      },
      player: { ...this.world.player.position },
      lastAim: { ...this.world.state.lastAim },
      pendingUpgradeChoices: [...this.world.progression.pendingUpgradeChoices],
      upgradeRanks: { ...this.world.progression.upgradeRanks },
      runtime: { ...this.world.runtime },
      lastEvents: [...this.lastEvents],
    };
  }

  private submitDevRunExport(): Promise<{ ok: boolean; path?: string; error?: string }> {
    if (!import.meta.env.DEV) {
      return Promise.resolve({ ok: false, error: "Run export logging is only available in dev." });
    }

    const runExport = this.getRunExport();
    return fetch("/__arena/run-export", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(runExport),
    })
      .then(async (response) => {
        const payload = (await response.json()) as { ok: boolean; path?: string; error?: string };
        if (!response.ok || !payload.ok) {
          throw new Error(payload.error ?? "Run export logging failed.");
        }
        return payload;
      })
      .then((payload) => {
        this.logger.info("run.export.saved", {
          path: payload.path,
          score: runExport.resultSummary.score,
          elapsed: Number(runExport.resultSummary.elapsed.toFixed(2)),
        });
        return payload;
      })
      .catch((error) => {
        const message = error instanceof Error ? error.message : String(error);
        this.logger.warn("run.export.save_failed", { message });
        return { ok: false, error: message };
      });
  }

  private getBuildCommit(): string {
    return import.meta.env.VITE_GIT_COMMIT || "unknown";
  }

  private getEnemyTypeCounts(): Record<EnemyTypeId, number> {
    return this.world.enemies.reduce(
      (counts, enemy) => {
        counts[enemy.typeId] += 1;
        return counts;
      },
      { chaser: 0, brute: 0, fast: 0, ranged: 0 },
    );
  }

  private getObstacleContactCounts(): {
    player: number;
    enemies: number;
    bullets: number;
    enemyProjectiles: number;
    pickups: number;
  } {
    return {
      player: this.countObstacleContacts([this.world.player]),
      enemies: this.countObstacleContacts(this.world.enemies),
      bullets: this.countObstacleContacts(this.world.bullets),
      enemyProjectiles: this.countObstacleContacts(this.world.enemyProjectiles),
      pickups: this.countObstacleContacts(this.world.pickups),
    };
  }

  private countObstacleContacts(bodies: CircleBody[]): number {
    return bodies.filter((body) =>
      this.world.obstacles.some((obstacle) => circleRect(body, obstacle)),
    ).length;
  }

  private getStatsSnapshot(): WorldState["stats"] {
    return {
      shotsFired: this.world.stats.shotsFired,
      enemiesKilled: this.world.stats.enemiesKilled,
      hitsTaken: this.world.stats.hitsTaken,
      damageTaken: this.world.stats.damageTaken,
      damageTakenBySource: { ...this.world.stats.damageTakenBySource },
      lastDamageSource: this.world.stats.lastDamageSource
        ? { ...this.world.stats.lastDamageSource }
        : null,
      xpCollected: this.world.stats.xpCollected,
      pickupsCollected: this.world.stats.pickupsCollected,
      hpRecovered: this.world.stats.hpRecovered,
      healPickupsCollected: this.world.stats.healPickupsCollected,
      effectiveHealPickupsCollected: this.world.stats.effectiveHealPickupsCollected,
      upgradesChosen: this.world.stats.upgradesChosen,
      weaponMetrics: {
        pulse: { ...this.world.stats.weaponMetrics.pulse },
        spread: { ...this.world.stats.weaponMetrics.spread },
        pierce: { ...this.world.stats.weaponMetrics.pierce },
      },
    };
  }

  private createDebugHealPickup(id: string, position: { x: number; y: number }, healValue: number): Pickup {
    return {
      id,
      kind: "heal",
      position,
      radius: this.runConfig.pickup.healRadius,
      xpValue: 0,
      healValue,
      lifetime: this.runConfig.pickup.healLifetime,
    };
  }

  private createDebugEnemy(
    typeId: EnemyTypeId,
    position: { x: number; y: number },
    index: number,
    enteredArena = true,
  ): Enemy {
    const definition = this.runConfig.enemies[typeId];
    return {
      id: `debug-heal-enemy-${index}`,
      typeId,
      position,
      radius: definition.radius,
      hp: definition.hp,
      damage: definition.damage,
      speed: definition.speed,
      score: definition.score,
      xpValue: definition.xpValue,
      behavior: definition.behavior,
      attackTimer: definition.ranged ? definition.ranged.attackInterval : 0,
      enteredArena,
    };
  }

  private getDebugHealValue(): number {
    const maxHp = this.runConfig.player.maxHp + this.world.runtime.maxHpBonus;
    return Math.max(
      this.runConfig.pickup.healMinimum,
      Math.floor(maxHp * this.runConfig.pickup.healRatio),
    );
  }

  private handleMenuAction(action: MenuAction): boolean {
    if (action === "history" || action === "ranking" || action === "settings") {
      this.secondaryMenu = action;
      this.historyClearPending = false;
      this.rankingClearPending = false;
      this.historyPage = 0;
      this.uiNotice = null;
      return true;
    }

    if (action === "back") {
      this.secondaryMenu = null;
      this.historyClearPending = false;
      this.rankingClearPending = false;
      this.historyPage = 0;
      this.uiNotice = null;
      return true;
    }

    if (action === "clearHistory") {
      if (!this.historyClearPending) {
        this.historyClearPending = true;
        this.uiNotice = "もう一度選ぶと履歴を消去します";
        return true;
      }

      const result = this.runRecordStore.clearHistory();
      if (result.ok) {
        this.runHistory = result.history;
        this.runRankings = result.rankings;
        this.uiNotice = "ラン履歴を消去しました";
      } else {
        this.uiNotice = "ラン履歴を消去できませんでした";
      }
      this.historyClearPending = false;
      return true;
    }

    if (action === "historyPrevious" || action === "historyNext") {
      const count = this.runHistory.filter((record) => record.profileId === this.profile.id).length;
      const maxPage = Math.max(0, Math.ceil(count / 8) - 1);
      this.historyPage = Math.max(
        0,
        Math.min(maxPage, this.historyPage + (action === "historyNext" ? 1 : -1)),
      );
      this.historyClearPending = false;
      this.uiNotice = null;
      return true;
    }

    if (action === "clearRankings") {
      if (!this.rankingClearPending) {
        this.rankingClearPending = true;
        this.uiNotice = "もう一度選ぶとランキングを消去します";
        return true;
      }
      const result = this.runRecordStore.clearRankings();
      if (result.ok) {
        this.runHistory = result.history;
        this.runRankings = result.rankings;
        this.uiNotice = "ランキングを消去しました";
      } else {
        this.uiNotice = "ランキングを消去できませんでした";
      }
      this.rankingClearPending = false;
      return true;
    }

    if (action === "resetSettings") {
      return this.updateSettings(() => this.profileStore.resetSettings(), "設定を初期化しました");
    }

    if (action === "resetProfile") {
      try {
        this.profile = this.profileStore.resetProfile();
        this.resetGame("title");
        this.secondaryMenu = "settings";
        this.uiNotice = "ゲストIDを再生成しました";
      } catch (error) {
        this.uiNotice = "ゲストIDを再生成できませんでした";
        this.logger.warn("profile.reset_failed", {
          message: error instanceof Error ? error.message : String(error),
        });
      }
      return true;
    }

    if (action === "settingsBgm") {
      return this.updateSettings(() => {
        const next = cycleLevel(this.settings.bgmMuted ? 0 : this.settings.bgmVolume);
        return this.profileStore.updateSettings({ bgmVolume: next, bgmMuted: next === 0 });
      });
    }

    if (action === "settingsSfx") {
      return this.updateSettings(() => {
        const next = cycleLevel(this.settings.sfxMuted ? 0 : this.settings.sfxVolume);
        return this.profileStore.updateSettings({ sfxVolume: next, sfxMuted: next === 0 });
      });
    }

    if (action === "settingsShake") {
      return this.updateSettings(() =>
        this.profileStore.updateSettings({ shakeIntensity: cycleLevel(this.settings.shakeIntensity) }),
      );
    }

    if (action === "settingsFlash") {
      return this.updateSettings(() =>
        this.profileStore.updateSettings({ flashIntensity: cycleLevel(this.settings.flashIntensity) }),
      );
    }

    if (action === "settingsAutoFire") {
      return this.updateSettings(() =>
        this.profileStore.updateSettings({ autoFireEnabled: !this.settings.autoFireEnabled }),
      );
    }

    return false;
  }

  private updateSettings(update: () => ProfileSettings, notice: string | null = null): true {
    try {
      this.settings = update();
      this.feedbackLayer.configure(this.settings);
      this.audioRouter.configure(this.settings);
      this.musicController.configure(this.settings);
      this.uiNotice = notice;
    } catch (error) {
      this.uiNotice = "設定を保存できませんでした";
      this.logger.warn("profile.settings.save_failed", {
        message: error instanceof Error ? error.message : String(error),
      });
    }
    return true;
  }

  private createUiState(): PhaserUiState {
    const context = this.runRecordCoordinator.getContext();
    const ranking = context
      ? selectRanking(
          this.runRankings.filter((record) => record.profileId === this.profile.id),
          context,
        )
      : [];
    return {
      secondaryMenu: this.secondaryMenu,
      records: this.runHistory.filter((record) => record.profileId === this.profile.id),
      ranking,
      profile: { ...this.profile },
      settings: { ...this.settings },
      latestRunRecord: this.latestRunRecord ? { ...this.latestRunRecord } : null,
      previousBest: this.previousBest ? { ...this.previousBest } : null,
      historyClearPending: this.historyClearPending,
      rankingClearPending: this.rankingClearPending,
      historyPage: this.historyPage,
      focusedMenuAction: this.inputAdapter.getFocusedMenuAction(
        this.world.state.status,
        this.secondaryMenu,
      ),
      notice: this.uiNotice,
    };
  }

  private createRunSeed(fixedSeed: number | null): number {
    if (fixedSeed !== null) return fixedSeed;

    if (window.crypto?.getRandomValues) {
      const values = new Uint32Array(1);
      window.crypto.getRandomValues(values);
      if (values[0]) return values[0];
    }

    return Date.now() >>> 0;
  }

  private getFixedRunSeed(): number | null {
    const seedParam = new URLSearchParams(window.location.search).get("seed");
    if (seedParam !== null) {
      const seed = Number(seedParam);
      if (Number.isSafeInteger(seed)) return seed >>> 0;
    }

    if (import.meta.env.VITE_ARENA_FIXED_SEED === "1") {
      return this.simulationConfig.seed;
    }

    return null;
  }

  private getBaseRunOrigin(): RunOrigin {
    return resolveRunOrigin(
      window.location.search,
      navigator.webdriver || import.meta.env.VITE_ARENA_RUN_ORIGIN === "test",
    );
  }

  private getDebugRunOrigin(): RunOrigin {
    return this.getBaseRunOrigin() === "test" ? "test" : "debug";
  }

  private createRunId(): string {
    if (window.crypto?.randomUUID) return window.crypto.randomUUID();
    return `run-${Date.now()}-${this.runSeed}`;
  }

  private initializeProfile(storage: Pick<Storage, "getItem" | "setItem" | "removeItem">): void {
    try {
      this.profileStore = new LocalProfileStore(storage);
      this.profile = this.profileStore.loadProfile();
      this.settings = this.profileStore.loadSettings();
    } catch (error) {
      this.logger.warn("profile.storage.unavailable", {
        message: error instanceof Error ? error.message : String(error),
      });
      this.profileStore = new LocalProfileStore(createVolatileStorage());
      this.profile = this.profileStore.loadProfile();
      this.settings = this.profileStore.loadSettings();
    }
  }

  private clearAllRunRecords() {
    const result = this.runRecordStore.clear();
    if (result.ok) {
      this.runHistory = [];
      this.runRankings = [];
      this.latestRunRecord = null;
      this.previousBest = null;
    }
    return result;
  }
}

function cycleLevel(value: number): number {
  if (value >= 0.75) return 0.5;
  if (value >= 0.25) return 0;
  return 1;
}
