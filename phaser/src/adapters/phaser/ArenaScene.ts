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
} from "../../application/runRecords";
import type { RunOrigin, RunRecord } from "../../domain/runRecords";
import type {
  LocalProfile,
  ProfileSettings,
  ProfileSettingsUpdate,
} from "../../domain/profile";
import type {
  GameEvent,
  SimulationConfig,
  StepWorldResult,
  ViewConfig,
  WeaponTypeId,
  WorldState,
  InputSnapshot,
} from "../../domain/types";
import { UPGRADE_IDS } from "../../domain/types";
import { ConsoleLogger } from "../telemetry/ConsoleLogger";
import { FrameSpikeReporter } from "../telemetry/FrameSpikeReporter";
import { InMemoryMetrics } from "../telemetry/InMemoryMetrics";
import { createRandomStreams, type RandomStreams } from "../../math/random";
import { createWorld } from "../../simulation/createWorld";
import { composeBuild } from "../../simulation/buildComposer";
import {
  AUTO_PILOT_MODIFIER_ID,
  createAutoPilotDecision,
  type AutoPilotMode,
} from "../../simulation/autoPilot";
import { createRunResultSummary } from "../../simulation/resultSummary";
import { stepWorld } from "../../simulation/stepWorld";
import {
  getAvailableUpgradeIds,
  completeBuild,
  getLockedUpgradeIds,
  getMaxedUpgradeIds,
  selectUpgradeChoices,
  updateLevelProgression,
} from "../../simulation/systems/levelSystem";
import { updateRunStats } from "../../simulation/systems/statsSystem";
import { getWaveBand } from "../../simulation/waveDirector";
import { PhaserAudioEventRouter } from "./PhaserAudioEventRouter";
import {
  ArenaDebugBridge,
  type ArenaDebugApi,
  type ArenaPerformanceSnapshot,
  type ArenaRunExport,
} from "./ArenaDebugBridge";
import {
  applyEnemyVisualFixture,
  applyHealPickupFixture,
  applyObstacleFrictionFixture,
  applyOffscreenEnemyIndicatorFixture,
  createDebugInput,
} from "./ArenaDebugFixtures";
import { PhaserArenaRenderer } from "./PhaserArenaRenderer";
import { PhaserDebugOverlay } from "./PhaserDebugOverlay";
import { PhaserFeedbackLayer } from "./PhaserFeedbackLayer";
import { PhaserInputAdapter } from "./PhaserInputAdapter";
import { PhaserMusicController } from "./PhaserMusicController";
import type { MenuAction, SecondaryMenu } from "./PhaserMenuLayout";
import {
  createPhaserUiState,
  type HistoryWeaponFilter,
  type PhaserUiState,
} from "./PhaserUiState";
import { createBrowserStorage, createVolatileStorage } from "../storage/BrowserStorage";
import { LocalProfileStore } from "../storage/LocalProfileStore";
import { LocalRunRecordStore } from "../storage/LocalRunRecordStore";
import {
  copyRunStats,
  createArenaRunExport,
  getArenaEnemyTypeCounts,
  getArenaObstacleContactCounts,
} from "../telemetry/ArenaRunExport";
import { DevRunExportClient } from "../telemetry/DevRunExportClient";
import { ArenaChoiceOverlay } from "../dom/ArenaChoiceOverlay";

export class ArenaScene extends Phaser.Scene {
  private inputAdapter!: PhaserInputAdapter;
  private choiceOverlay!: ArenaChoiceOverlay;
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
  private selectedWeapon: WeaponTypeId = SIMULATION_CONFIG.defaultWeapon;
  private runRecordStore!: LocalRunRecordStore;
  private runRecordCoordinator!: RunRecordCoordinator;
  private runHistory: RunRecord[] = [];
  private runRankings: RunRecord[] = [];
  private latestRunRecord: RunRecord | null = null;
  private previousBest: RunRecord | null = null;
  private profileStore!: LocalProfileStore;
  private profile!: LocalProfile;
  private settings!: ProfileSettings;
  private randomStreams!: RandomStreams;
  private world!: WorldState;
  private lastEvents: GameEvent[] = [];
  private debugPaused = false;
  private autoPilotEnabled = false;
  private autoPilotMode: AutoPilotMode | null = null;
  private autoPilotTargetId: string | null = null;
  private soakProtectionEnabled = false;
  private secondaryMenu: SecondaryMenu | null = null;
  private historyClearPending = false;
  private rankingClearPending = false;
  private historyPage = 0;
  private historyWeaponFilter: HistoryWeaponFilter = "all";
  private uiNotice: string | null = null;
  private debugBridge: ArenaDebugBridge | null = null;
  private finalizedPerformance: ArenaPerformanceSnapshot | null = null;
  private readonly devRunExportClient = new DevRunExportClient();

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
    this.choiceOverlay = new ArenaChoiceOverlay(this.game.canvas, this.simulationConfig);
    this.arenaRenderer = new PhaserArenaRenderer(this, this.simulationConfig, this.viewConfig);
    this.feedbackLayer = new PhaserFeedbackLayer(this);
    this.feedbackLayer.configure(this.settings);
    this.audioRouter = new PhaserAudioEventRouter(this);
    this.audioRouter.configure(this.settings);
    this.musicController = new PhaserMusicController(this);
    this.musicController.configure(this.settings);
    this.debugOverlay = new PhaserDebugOverlay(this, this.metrics);
    this.resetGame("title");
    const requestedAutoPilotWeapon = this.getRequestedAutoPilotWeapon();
    if (requestedAutoPilotWeapon) this.startAutoPilot(requestedAutoPilotWeapon);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.choiceOverlay.destroy());
    if (import.meta.env.DEV) {
      this.debugBridge = new ArenaDebugBridge(window);
      this.installDebugHook();
      this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.debugBridge?.uninstall());
    }
  }

  update(_time: number, deltaMs: number): void {
    if (this.inputAdapter.readAutoPilotTogglePressed()) {
      this.setAutoPilotEnabled(!this.autoPilotEnabled);
    }
    const choiceInput = this.choiceOverlay.consumeInput();
    const manualInput = this.inputAdapter.read(
      this.world.state.status,
      this.world.progression.pendingUpgradeChoices.length,
      this.settings.autoFireEnabled,
      this.secondaryMenu,
    );
    if (choiceInput.upgradeChoice !== null) {
      manualInput.upgradeChoicePressed = choiceInput.upgradeChoice;
    }
    if (choiceInput.contractChoice !== null) {
      manualInput.contractChoicePressed = choiceInput.contractChoice;
    }
    const canvasMenuAction = this.inputAdapter.consumeMenuAction();
    const menuAction = choiceInput.menuAction ?? canvasMenuAction;
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
      this.stepDebugControls(manualInput);
      this.renderCurrentWorld();
      return;
    }

    this.feedbackLayer.update(deltaMs / 1000);
    this.prepareSoakProtection();
    const input = this.resolveFrameInput(manualInput);
    const result = stepWorld(this.world, input, deltaMs / 1000, this.randomStreams, this.runConfig);
    this.normalizeSoakHealth();
    this.recordResult(result, this.game.loop.rawDelta);
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
    if (status === "title") this.autoPilotEnabled = false;
    this.autoPilotMode = null;
    this.autoPilotTargetId = null;
    this.inputAdapter.clearTransientInput();
    this.choiceOverlay.clearInput();
    this.metrics.reset();
    this.finalizedPerformance = null;
    const fixedSeed = this.getFixedRunSeed();
    this.runSeed = this.createRunSeed(fixedSeed);
    this.runConfig = { ...this.simulationConfig, seed: this.runSeed };
    this.randomStreams = createRandomStreams(this.runSeed);
    this.world = createWorld(this.runConfig);
    this.soakProtectionEnabled = false;
    this.world.state.weaponType = this.selectedWeapon;
    this.world.state.status = status;
    const runOrigin =
      runOriginOverride ??
      (this.autoPilotEnabled ? this.getDebugRunOrigin() : this.getBaseRunOrigin());
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
        modifierIds: [
          `auto-fire:${this.settings.autoFireEnabled ? "on" : "off"}`,
          ...(this.autoPilotEnabled ? [AUTO_PILOT_MODIFIER_ID] : []),
        ],
        appVersion: APP_VERSION,
        buildCommit: this.getBuildCommit(),
        seed: this.runSeed,
        runOrigin,
        rankEligibility: createRankEligibility(runOrigin, !this.autoPilotEnabled),
      },
      status === "playing",
    );
    this.latestRunRecord = null;
    this.previousBest = null;
    this.secondaryMenu = null;
    this.historyClearPending = false;
    this.rankingClearPending = false;
    this.historyPage = 0;
    this.historyWeaponFilter = "all";
    this.uiNotice = null;
    this.lastEvents = [];
    this.feedbackLayer.reset();
    this.audioRouter.reset();
  }

  private recordResult(result: StepWorldResult, observedRawDtMs?: number): void {
    const metrics = result.metrics.map((metric) =>
      metric.type === "timing" && metric.name === "frame.raw_dt_ms" && observedRawDtMs !== undefined
        ? { ...metric, valueMs: observedRawDtMs }
        : metric,
    );
    for (const metric of metrics) {
      this.metrics.record(metric);
    }
    this.frameSpikeReporter.report(metrics);
    const gameOver = result.events.some((event) => event.type === "game.over");
    if (gameOver) this.finalizedPerformance = this.getPerformanceSnapshot();

    for (const event of result.events) {
      this.lastEvents.push(event);
      this.logEvent(event);
      if (event.type === "game.started") this.runRecordCoordinator.markStarted();
      if (event.type === "contract.selected") {
        this.runRecordCoordinator.addModifier(
          `contract:${event.choice}`,
          event.choice === "standard",
        );
      }
    }
    this.lastEvents = this.lastEvents.slice(-20);
    this.feedbackLayer.handleEvents(result.events, this.world);
    this.audioRouter.handleEvents(result.events);
    if (gameOver) {
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
      summary: createRunResultSummary(this.world, this.runConfig),
      upgradeRanks: this.world.progression.upgradeRanks,
      upgradeSelections: this.world.stats.progressionMetrics.selections,
      extraUpgradeRanks: this.world.progression.extraUpgradeRanks,
      extraUpgradeSelections: this.world.stats.progressionMetrics.extraSelections,
      buildCompletedAt: this.world.progression.buildCompletedAt,
      encounterMetrics: this.world.stats.encounterMetrics,
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
    const debugInput = createDebugInput(input);
    this.prepareSoakProtection();
    const result = stepWorld(
      this.world,
      debugInput,
      deltaSeconds,
      this.randomStreams,
      this.runConfig,
    );
    this.normalizeSoakHealth();
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
      this.randomStreams,
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
    updateLevelProgression(this.world, this.randomStreams.upgrade, this.runConfig, events);
    updateRunStats(this.world, events);
    this.recordResult({ events, metrics: [] });
    this.renderCurrentWorld();
  }

  private forceUpgradeSelect(): void {
    if (this.world.state.status === "gameOver") return;

    this.runRecordCoordinator.markDebugMutation();
    this.inputAdapter.clearTransientInput();
    const choices = selectUpgradeChoices(
      this.runConfig,
      this.randomStreams.upgrade,
      this.world.progression.upgradeRanks,
      this.world.state.weaponType,
    );
    if (choices.length === 0) return;
    this.world.state.status = "upgradeSelect";
    this.world.progression.pendingUpgradeChoices = choices;
    const availableUpgradeIds = getAvailableUpgradeIds(
      this.runConfig,
      this.world.progression.upgradeRanks,
      this.world.state.weaponType,
    );
    this.recordResult({
      events: [
        {
          type: "player.level_up",
          level: this.world.progression.level,
          choices: [...choices],
        },
        {
          type: "upgrade.offered",
          level: this.world.progression.level,
          choices: [...choices],
          availableUpgradeIds,
          lockedUpgradeIds: getLockedUpgradeIds(
            this.runConfig,
            this.world.progression.upgradeRanks,
            this.world.state.weaponType,
          ),
          maxedUpgradeIds: getMaxedUpgradeIds(
            this.runConfig,
            this.world.progression.upgradeRanks,
            this.world.state.weaponType,
          ),
        },
      ],
      metrics: [],
    });
    this.renderCurrentWorld();
  }

  private forceExtraUpgradeSelect(): void {
    if (this.world.state.status === "gameOver") return;

    this.runRecordCoordinator.markDebugMutation();
    this.inputAdapter.clearTransientInput();
    for (const upgradeId of UPGRADE_IDS) {
      this.world.progression.upgradeRanks[upgradeId] = this.runConfig.upgrades[upgradeId].maxRank;
    }
    const composition = composeBuild(
      this.runConfig,
      this.world.state.weaponType,
      this.world.progression.upgradeRanks,
      [],
      this.world.progression.extraUpgradeRanks,
    );
    Object.assign(this.world.runtime, composition.modifiers);
    this.world.state.hp = this.runConfig.player.maxHp + this.world.runtime.maxHpBonus;

    const events: GameEvent[] = [];
    completeBuild(this.world, this.runConfig, events);
    this.world.progression.xp = this.world.progression.xpToNext;
    this.world.state.status = "playing";
    updateLevelProgression(this.world, this.randomStreams.upgrade, this.runConfig, events);
    updateRunStats(this.world, events);
    this.recordResult({ events, metrics: [] });
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
    applyEnemyVisualFixture(this.world, this.runConfig, band);
    this.renderCurrentWorld();
  }

  private setObstacleFrictionFixture(): void {
    this.runRecordCoordinator.markDebugMutation();
    this.inputAdapter.clearTransientInput();
    if (applyObstacleFrictionFixture(this.world, this.runConfig)) this.renderCurrentWorld();
  }

  private setHealPickupFixture(mode: "damaged" | "full" | "fatal" | "visual" = "damaged"): void {
    this.runRecordCoordinator.markDebugMutation();
    this.inputAdapter.clearTransientInput();
    applyHealPickupFixture(this.world, this.runConfig, mode);
    this.renderCurrentWorld();
  }

  private setOffscreenEnemyIndicatorFixture(): void {
    this.runRecordCoordinator.markDebugMutation();
    this.inputAdapter.clearTransientInput();
    applyOffscreenEnemyIndicatorFixture(this.world, this.runConfig);
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
      this.autoPilotEnabled ? null : this.inputAdapter.getPointerWorld(),
      this.createUiState(),
      this.autoPilotEnabled,
      this.autoPilotMode,
    );
    this.choiceOverlay.render(this.world, this.secondaryMenu === null);
    this.musicController.sync(this.world.state.status);
    this.feedbackLayer.render();
    this.debugOverlay.render();
  }

  private installDebugHook(): void {
    if (!this.debugBridge) return;

    const api: ArenaDebugApi = {
      getSnapshot: () => ({
        configVersion: SIMULATION_CONFIG_VERSION,
        buildCommit: this.getBuildCommit(),
        runContext: this.runRecordCoordinator.getContext(),
        latestRunRecord: this.latestRunRecord ? { ...this.latestRunRecord } : null,
        secondaryMenu: this.secondaryMenu,
        seed: this.runSeed,
        randomStreams: {
          version: this.randomStreams.version,
          rootSeed: this.randomStreams.rootSeed,
          seeds: { ...this.randomStreams.seeds },
        },
        status: this.world.state.status,
        autoPilotEnabled: this.autoPilotEnabled,
        autoPilotMode: this.autoPilotMode,
        autoPilotTargetId: this.autoPilotTargetId,
        performance: this.finalizedPerformance ?? this.getPerformanceSnapshot(),
        elapsed: this.world.state.elapsed,
        hp: this.world.state.hp,
        score: this.world.state.score,
        weaponType: this.world.state.weaponType,
        level: this.world.progression.level,
        extraLevel: this.world.progression.extraLevel,
        extraCycle: this.world.progression.extraCycle,
        xp: this.world.progression.xp,
        xpToNext: this.world.progression.xpToNext,
        buildCompletedAt: this.world.progression.buildCompletedAt,
        pendingUpgradeChoices: [...this.world.progression.pendingUpgradeChoices],
        upgradeRanks: { ...this.world.progression.upgradeRanks },
        extraUpgradeRanks: { ...this.world.progression.extraUpgradeRanks },
        extraCycleRemaining: [...this.world.progression.extraCycleRemaining],
        runtime: { ...this.world.runtime },
        buildComposition: composeBuild(
          this.runConfig,
          this.world.state.weaponType,
          this.world.progression.upgradeRanks,
          [],
          this.world.progression.extraUpgradeRanks,
        ),
        encounter: structuredClone(this.world.encounter),
        wave: { ...getWaveBand(this.runConfig, this.world.state.elapsed) },
        stats: copyRunStats(this.world),
        resultSummary: createRunResultSummary(this.world, this.runConfig),
        player: { ...this.world.player.position },
        lastAim: { ...this.world.state.lastAim },
        bulletCount: this.world.bullets.length,
        enemyCount: this.world.enemies.length,
        enemyTypeCounts: getArenaEnemyTypeCounts(this.world),
        enemyProjectileCount: this.world.enemyProjectiles.length,
        pickupCount: this.world.pickups.length,
        obstacleContacts: getArenaObstacleContactCounts(this.world),
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
        this.historyWeaponFilter = "all";
        this.renderCurrentWorld();
      },
      saveRunExport: () => this.submitDevRunExport(),
      forceDamage: (amount: number) => {
        this.forceDamage(amount);
      },
      restoreHealthForSoak: () => {
        if (this.world.state.status === "gameOver") return;
        this.runRecordCoordinator.markDebugMutation();
        this.soakProtectionEnabled = true;
        this.normalizeSoakHealth();
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
      forceExtraUpgradeSelect: () => {
        this.forceExtraUpgradeSelect();
      },
      restart: () => {
        this.resetGame("playing", this.getDebugRunOrigin());
        this.renderCurrentWorld();
      },
      startAutoPilot: (weaponType: WeaponTypeId = "pulse") => {
        this.startAutoPilot(weaponType === "spread" ? "spread" : "pulse");
        this.renderCurrentWorld();
      },
      setAutoPilotEnabled: (enabled: boolean) => {
        this.setAutoPilotEnabled(enabled);
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
    this.debugBridge.install(api);
  }

  private getRunExport(): ArenaRunExport {
    return createArenaRunExport({
      capturedAt: new Date().toISOString(),
      buildCommit: this.getBuildCommit(),
      context: this.runRecordCoordinator.getContext(),
      profileId: this.profile.id,
      baseRunOrigin: this.getBaseRunOrigin(),
      fixedSeed: this.getFixedRunSeed(),
      runSeed: this.runSeed,
      randomStreams: this.randomStreams,
      runConfig: this.runConfig,
      world: this.world,
      performance: this.finalizedPerformance ?? this.getPerformanceSnapshot(),
      lastEvents: this.lastEvents,
    });
  }

  private getPerformanceSnapshot(): ArenaPerformanceSnapshot {
    const metrics = this.metrics.getSnapshot();
    const actualFps = this.game?.loop?.actualFps ?? 0;
    return {
      frameSamples: metrics.frameSamples,
      averageRawDtMs: metrics.averageRawDtMs,
      p95RawDtMs: metrics.p95RawDtMs,
      maxRawDtMs: metrics.maxRawDtMs,
      framesOver50Ms: metrics.framesOver50Ms,
      estimatedFps: metrics.averageRawDtMs > 0 ? 1_000 / metrics.averageRawDtMs : 0,
      actualFps: Number.isFinite(actualFps) ? actualFps : 0,
    };
  }

  private prepareSoakProtection(): void {
    if (!this.soakProtectionEnabled || this.world.state.status !== "playing") return;

    // Keep renderer soak tests alive without feeding synthetic health into run metrics.
    this.normalizeSoakHealth();
    this.world.state.damageCooldown = Math.max(this.world.state.damageCooldown, 60);
    this.world.encounter.collapse.damageTimer = Math.max(
      this.world.encounter.collapse.damageTimer,
      60,
    );
  }

  private normalizeSoakHealth(): void {
    if (!this.soakProtectionEnabled || this.world.state.status === "gameOver") return;

    this.world.state.hp = this.runConfig.player.maxHp + this.world.runtime.maxHpBonus;
  }

  private submitDevRunExport(): Promise<{ ok: boolean; path?: string; error?: string }> {
    if (!import.meta.env.DEV) {
      return Promise.resolve({ ok: false, error: "Run export logging is only available in dev." });
    }

    const runExport = this.getRunExport();
    return this.devRunExportClient
      .submit(runExport)
      .then((payload) => {
        if (payload.ok) {
          this.logger.info("run.export.saved", {
            path: payload.path,
            score: runExport.resultSummary.score,
            elapsed: Number(runExport.resultSummary.elapsed.toFixed(2)),
          });
        } else {
          this.logger.warn("run.export.save_failed", {
            message: payload.error ?? "Run export logging failed.",
          });
        }
        return payload;
      });
  }

  private getBuildCommit(): string {
    return import.meta.env.VITE_GIT_COMMIT || "unknown";
  }

  private handleMenuAction(action: MenuAction): boolean {
    if (action === "start" && this.world.state.status === "title") {
      this.world.state.status = "weaponSelect";
      this.uiNotice = null;
      return true;
    }

    if (action === "selectPulse" || action === "selectSpread") {
      this.selectedWeapon = action === "selectPulse" ? "pulse" : "spread";
      this.resetGame("playing");
      return true;
    }

    if (action === "back" && this.world.state.status === "weaponSelect") {
      this.resetGame("title");
      return true;
    }

    if (action === "history" || action === "ranking" || action === "settings") {
      this.secondaryMenu = action;
      this.historyClearPending = false;
      this.rankingClearPending = false;
      this.historyPage = 0;
      this.historyWeaponFilter = "all";
      this.uiNotice = null;
      return true;
    }

    if (action === "back") {
      this.secondaryMenu = null;
      this.historyClearPending = false;
      this.rankingClearPending = false;
      this.historyPage = 0;
      this.historyWeaponFilter = "all";
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

    if (
      action === "historyFilterAll" ||
      action === "historyFilterPulse" ||
      action === "historyFilterSpread"
    ) {
      this.historyWeaponFilter =
        action === "historyFilterPulse"
          ? "pulse"
          : action === "historyFilterSpread"
            ? "spread"
            : "all";
      this.historyPage = 0;
      this.historyClearPending = false;
      this.uiNotice = null;
      return true;
    }

    if (action === "historyPrevious" || action === "historyNext") {
      const count = this.runHistory.filter(
        (record) =>
          record.profileId === this.profile.id &&
          (this.historyWeaponFilter === "all" || record.weaponId === this.historyWeaponFilter),
      ).length;
      const maxPage = Math.max(0, Math.ceil(count / 7) - 1);
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
    return createPhaserUiState({
      secondaryMenu: this.secondaryMenu,
      runHistory: this.runHistory,
      runRankings: this.runRankings,
      runContext: this.runRecordCoordinator.getContext(),
      profile: this.profile,
      settings: this.settings,
      latestRunRecord: this.latestRunRecord,
      previousBest: this.previousBest,
      historyClearPending: this.historyClearPending,
      rankingClearPending: this.rankingClearPending,
      historyPage: this.historyPage,
      historyWeaponFilter: this.historyWeaponFilter,
      focusedMenuAction: this.inputAdapter.getFocusedMenuAction(
        this.world.state.status,
        this.secondaryMenu,
      ),
      notice: this.uiNotice,
    });
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

  private getRequestedAutoPilotWeapon(): WeaponTypeId | null {
    const value = new URLSearchParams(window.location.search).get("autopilot")?.toLowerCase();
    if (value === "spread") return "spread";
    if (value === "pulse" || value === "1" || value === "true") return "pulse";
    return null;
  }

  private startAutoPilot(weaponType: WeaponTypeId): void {
    this.autoPilotEnabled = true;
    this.autoPilotMode = null;
    this.autoPilotTargetId = null;
    this.selectedWeapon = weaponType;
    this.resetGame("playing", this.getDebugRunOrigin());
  }

  private setAutoPilotEnabled(enabled: boolean): void {
    if (enabled === this.autoPilotEnabled) return;
    if (
      enabled &&
      (this.world.state.status === "title" ||
        this.world.state.status === "weaponSelect" ||
        this.world.state.status === "gameOver")
    ) {
      this.startAutoPilot(this.selectedWeapon);
      return;
    }

    this.autoPilotEnabled = enabled;
    if (!enabled) {
      this.autoPilotMode = null;
      this.autoPilotTargetId = null;
      return;
    }
    this.runRecordCoordinator.markDebugMutation();
    this.runRecordCoordinator.addModifier(AUTO_PILOT_MODIFIER_ID, false);
  }

  private resolveFrameInput(manualInput: InputSnapshot): InputSnapshot {
    if (!this.autoPilotEnabled) return manualInput;

    const decision = createAutoPilotDecision(this.world, this.runConfig);
    this.autoPilotMode = decision.mode;
    this.autoPilotTargetId = decision.targetId;
    const autoInput = decision.input;
    return {
      ...autoInput,
      startPressed: manualInput.startPressed,
      restartPressed: manualInput.restartPressed,
      pausePressed: manualInput.pausePressed,
      quitToTitlePressed: manualInput.quitToTitlePressed,
      upgradeChoicePressed:
        manualInput.upgradeChoicePressed ?? autoInput.upgradeChoicePressed,
      contractChoicePressed:
        manualInput.contractChoicePressed ?? autoInput.contractChoicePressed,
    };
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
