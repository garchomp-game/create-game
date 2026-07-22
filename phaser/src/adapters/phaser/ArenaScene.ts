import * as Phaser from "phaser";
import {
  SIMULATION_CONFIG,
  VIEW_CONFIG,
} from "../../config/gameConfig";
import {
  APP_VERSION,
  DEFAULT_DIFFICULTY_ID,
  DEFAULT_MODE_ID,
  DEFAULT_STAGE_ID,
  RULESET_VERSION,
  resolveRunRulesetVersion,
} from "../../config/version";
import { resolveRunOrigin, resolveSeedCategory } from "../../application/runEnvironment";
import {
  ArenaMenuController,
  type ArenaMenuActionOutcome,
} from "../../application/ArenaMenuController";
import { ArenaSession } from "../../application/ArenaSession";
import { AutoPilotController } from "../../application/AutoPilotController";
import { PerformanceMonitor } from "../../application/PerformanceMonitor";
import { RunLifecycleController } from "../../application/RunLifecycleController";
import {
  createRankEligibility,
  createRankingBoardQueries,
} from "../../application/runRecords";
import type { RunOrigin } from "../../domain/runRecords";
import type { LocalProfile, ProfileSettings } from "../../domain/profile";
import type {
  GameEvent,
  SimulationConfig,
  StepWorldResult,
  ViewConfig,
  WeaponTypeId,
  WorldState,
} from "../../domain/types";
import { ConsoleLogger } from "../telemetry/ConsoleLogger";
import { FrameSpikeReporter } from "../telemetry/FrameSpikeReporter";
import { InMemoryMetrics } from "../telemetry/InMemoryMetrics";
import {
  AUTO_PILOT_MODIFIER_ID,
  AUTO_PILOT_PATROL_MODIFIER_ID,
  type AutoPilotPatrolStrategy,
} from "../../simulation/autoPilot";
import { PhaserAudioEventRouter } from "./PhaserAudioEventRouter";
import type { ArenaDebugBridge } from "./ArenaDebugBridge";
import type { ArenaDebugController } from "./ArenaDebugController";
import { PhaserArenaRenderer } from "./PhaserArenaRenderer";
import { PhaserDebugOverlay } from "./PhaserDebugOverlay";
import { PhaserFeedbackLayer } from "./PhaserFeedbackLayer";
import { PhaserInputAdapter } from "./PhaserInputAdapter";
import { PhaserMusicController } from "./PhaserMusicController";
import type { MenuAction, SecondaryMenu } from "../../application/ArenaMenuTypes";
import { createPhaserUiState, type PhaserUiState } from "./PhaserUiState";
import { createBrowserStorage, createVolatileStorage } from "../storage/BrowserStorage";
import { LocalProfileStore } from "../storage/LocalProfileStore";
import { LocalRunRecordStore } from "../storage/LocalRunRecordStore";
import { DevRunExportClient } from "../telemetry/DevRunExportClient";
import { ArenaChoiceOverlay } from "../dom/ArenaChoiceOverlay";

const loadArenaDebugModules =
  import.meta.env.DEV ||
  import.meta.env.VITE_ARENA_ENABLE_TEST_HOOKS === "1"
    ? () =>
        Promise.all([
          import("./ArenaDebugController"),
          import("./ArenaDebugBridge"),
        ])
    : null;

export class ArenaScene extends Phaser.Scene {
  private inputAdapter!: PhaserInputAdapter;
  private choiceOverlay!: ArenaChoiceOverlay;
  private arenaRenderer!: PhaserArenaRenderer;
  private debugOverlay!: PhaserDebugOverlay;
  private feedbackLayer!: PhaserFeedbackLayer;
  private audioRouter!: PhaserAudioEventRouter;
  private musicController!: PhaserMusicController;
  private logger = new ConsoleLogger("warn");
  private performanceMonitor!: PerformanceMonitor;
  private simulationConfig: SimulationConfig = SIMULATION_CONFIG;
  private viewConfig: ViewConfig = VIEW_CONFIG;
  private selectedWeapon: WeaponTypeId = SIMULATION_CONFIG.defaultWeapon;
  private selectedModeId = DEFAULT_MODE_ID;
  private selectedStageId = DEFAULT_STAGE_ID;
  private session!: ArenaSession;
  private runRecordStore!: LocalRunRecordStore;
  private runLifecycle!: RunLifecycleController;
  private profileStore!: LocalProfileStore;
  private profile!: LocalProfile;
  private settings!: ProfileSettings;
  private menuController!: ArenaMenuController;
  private readonly autoPilotController = new AutoPilotController(
    getConfiguredAutoPilotPatrolStrategy(),
  );
  private debugController: ArenaDebugController | null = null;
  private debugBridge: ArenaDebugBridge | null = null;
  private readonly devRunExportClient = import.meta.env.DEV
    ? new DevRunExportClient()
    : null;

  constructor() {
    super("arena");
  }

  preload(): void {
    this.load.audio("bgmEndless", "/audio/arena-loop.ogg");
    this.load.audio("bgmVictory", "/audio/expedition-clear-loop.ogg");
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
    const metrics = new InMemoryMetrics();
    this.performanceMonitor = new PerformanceMonitor(
      metrics,
      new FrameSpikeReporter(this.logger, metrics),
    );
    this.session = new ArenaSession(this.simulationConfig);
    this.runRecordStore = new LocalRunRecordStore(storage);
    this.runLifecycle = new RunLifecycleController(this.runRecordStore);
    this.initializeProfile(storage);
    this.menuController = new ArenaMenuController({
      runRecordStore: this.runRecordStore,
      profileStore: this.profileStore,
      logger: this.logger,
    });
    this.inputAdapter = new PhaserInputAdapter(this);
    this.choiceOverlay = new ArenaChoiceOverlay(this.game.canvas, this.simulationConfig);
    this.arenaRenderer = new PhaserArenaRenderer(this, this.simulationConfig, this.viewConfig);
    this.feedbackLayer = new PhaserFeedbackLayer(this);
    this.feedbackLayer.configure(this.settings);
    this.audioRouter = new PhaserAudioEventRouter(
      this,
      loadArenaDebugModules !== null,
    );
    this.audioRouter.configure(this.settings);
    this.musicController = new PhaserMusicController(this);
    this.musicController.configure(this.settings);
    this.debugOverlay = new PhaserDebugOverlay(
      this,
      this.performanceMonitor.metricsReader,
    );
    this.resetGame("title");
    const requestedAutoPilotWeapon = this.getRequestedAutoPilotWeapon();
    if (requestedAutoPilotWeapon) this.startAutoPilot(requestedAutoPilotWeapon);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.choiceOverlay.destroy());
    if (loadArenaDebugModules) {
      void this.initializeDebugController();
      this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
        this.debugBridge?.uninstall();
        this.debugController = null;
      });
    }
  }

  update(_time: number, deltaMs: number): void {
    if (this.inputAdapter.readAutoPilotTogglePressed()) {
      this.setAutoPilotEnabled(!this.autoPilotController.enabled);
    }
    const choiceInput = this.choiceOverlay.consumeInput();
    const manualInput = this.inputAdapter.read(
      this.world.state.status,
      this.world.progression.pendingUpgradeChoices.length,
      this.settings.autoFireEnabled,
      this.menuController.state.secondaryMenu,
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
    if (this.menuController.state.secondaryMenu) {
      this.renderCurrentWorld();
      return;
    }
    if (import.meta.env.DEV && this.inputAdapter.readDebugTogglePressed()) {
      this.debugOverlay.toggle();
    }
    if (this.debugController?.paused) {
      this.feedbackLayer.update(0);
      this.debugController.stepDebugControls(manualInput);
      this.renderCurrentWorld();
      return;
    }

    this.feedbackLayer.update(deltaMs / 1000);
    this.debugController?.prepareSoakProtection();
    const input = this.autoPilotController.resolveInput(
      manualInput,
      this.world,
      this.runConfig,
    );
    const result = this.session.step(input, deltaMs / 1000);
    this.debugController?.normalizeSoakHealth();
    this.recordResult(result, this.game.loop.rawDelta);
    if (result.events.some((event) => event.type === "game.restart.requested")) {
      this.resetGame("playing");
      this.renderCurrentWorld();
      return;
    }
    if (result.events.some((event) => event.type === "game.title.requested")) {
      this.showTitle();
      this.renderCurrentWorld();
      return;
    }

    this.renderCurrentWorld();
  }

  private resetGame(
    status: WorldState["state"]["status"] = "playing",
    runOriginOverride?: RunOrigin,
  ): void {
    this.autoPilotController.resetForRun(status);
    this.inputAdapter.clearTransientInput();
    this.choiceOverlay.clearInput();
    this.performanceMonitor.reset();
    this.arenaRenderer.resetPerformance();
    const fixedSeed = this.getFixedRunSeed();
    const runSeed = this.createRunSeed(fixedSeed);
    this.session.start({
      seed: runSeed,
      weaponType: this.selectedWeapon,
      status,
      modeId: this.selectedModeId,
      stageId: this.selectedStageId,
    });
    this.debugController?.resetRun();
    const runOrigin =
      runOriginOverride ??
      (this.autoPilotController.enabled
        ? this.getDebugRunOrigin()
        : this.getBaseRunOrigin());
    this.runLifecycle.begin(
      {
        id: this.createRunId(),
        profileId: this.profile.id,
        startedAt: new Date().toISOString(),
        modeId: this.session.modeId,
        stageId: this.session.stageId,
        difficultyId: DEFAULT_DIFFICULTY_ID,
        rulesetVersion: resolveRunRulesetVersion(
          this.session.modeId,
          this.session.stageId,
        ),
        seedCategory: resolveSeedCategory(fixedSeed),
        weaponId: this.world.state.weaponType,
        modifierIds: [
          `auto-fire:${this.settings.autoFireEnabled ? "on" : "off"}`,
          ...(this.autoPilotController.enabled
            ? [AUTO_PILOT_MODIFIER_ID]
            : []),
          ...(this.autoPilotController.enabled &&
              this.autoPilotController.patrolStrategy === "visit-history-v1"
            ? [AUTO_PILOT_PATROL_MODIFIER_ID]
            : []),
        ],
        appVersion: APP_VERSION,
        buildCommit: this.getBuildCommit(),
        seed: runSeed,
        runOrigin,
        rankEligibility: createRankEligibility(
          runOrigin,
          !this.autoPilotController.enabled,
        ),
      },
      status === "playing",
    );
    this.menuController.reset();
    this.feedbackLayer.reset();
    this.audioRouter.reset();
  }

  private recordResult(result: StepWorldResult, observedRawDtMs?: number): void {
    const gameOver = result.events.some((event) => event.type === "game.over");
    this.performanceMonitor.record(
      result.metrics,
      observedRawDtMs,
      this.game?.loop?.actualFps ?? 0,
      gameOver,
    );

    this.runLifecycle.observeEvents(result.events);
    for (const event of result.events) {
      this.logEvent(event);
    }
    this.feedbackLayer.handleEvents(result.events, this.world);
    this.audioRouter.handleEvents(result.events);
    if (gameOver) {
      this.finalizeRunRecord();
    }
  }

  private finalizeRunRecord(): void {
    const outcome = this.runLifecycle.finalize(
      this.world,
      this.runConfig,
      new Date().toISOString(),
    );
    const { result } = outcome;

    if (result.status === "notStarted" || result.status === "alreadyFinalized") return;

    if (outcome.newPersonalBest || outcome.newWeaponPersonalBest) {
      this.feedbackLayer.celebrateRecord(this.world.player.position);
    }
    if (result.status === "saveFailed") {
      this.menuController.setNotice("記録を保存できませんでした");
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

  private renderCurrentWorld(): void {
    const secondaryMenu = this.menuController.state.secondaryMenu;
    const autoPilot = this.autoPilotController.getSnapshot();
    this.inputAdapter.syncCursor(
      this.world.state.status,
      this.world.progression.pendingUpgradeChoices.length,
      secondaryMenu,
    );
    this.arenaRenderer.render(
      this.world,
      autoPilot.enabled ? null : this.inputAdapter.getPointerWorld(),
      this.createUiState(),
      autoPilot.enabled,
      autoPilot.mode,
    );
    this.choiceOverlay.render(this.world, secondaryMenu === null);
    this.musicController.sync(
      this.world.state.status,
      this.world.expedition?.outcome ?? null,
    );
    const feedbackStartedAt = now();
    this.feedbackLayer.render();
    this.arenaRenderer.recordFeedbackRender(now() - feedbackStartedAt);
    this.debugOverlay.render();
  }

  private async initializeDebugController(): Promise<void> {
    if (!loadArenaDebugModules) return;
    const [{ ArenaDebugController }, { ArenaDebugBridge }] =
      await loadArenaDebugModules();
    const controller = new ArenaDebugController({
      session: this.session,
      runLifecycle: this.runLifecycle,
      runRecordStore: this.runRecordStore,
      autoPilot: this.autoPilotController,
      performance: this.performanceMonitor,
      getActualFps: () => this.game?.loop?.actualFps ?? 0,
      getRenderPerformance: () => this.arenaRenderer.getPerformanceSnapshot(),
      getBuildCommit: () => this.getBuildCommit(),
      getProfile: () => this.profile,
      getSettings: () => this.settings,
      updateSettings: (update) => {
        this.applyMenuActionOutcome(this.menuController.updateSettings(update));
        this.renderCurrentWorld();
        return { ...this.settings };
      },
      getSecondaryMenu: () => this.menuController.state.secondaryMenu,
      getRankingView: () => {
        const state = this.createUiState();
        return {
          query: state.rankingQuery,
          index: state.rankingBoardIndex,
          count: state.rankingBoardCount,
        };
      },
      openMenu: (menu) => {
        this.menuController.open(menu);
        this.renderCurrentWorld();
      },
      getBaseRunOrigin: () => this.getBaseRunOrigin(),
      getFixedSeed: () => this.getFixedRunSeed(),
      getFeedbackSnapshot: () => this.feedbackLayer.getSnapshot(),
      getAudioCues: () => this.audioRouter.getLastCues(),
      getAudioRoutingSnapshot: () => this.audioRouter.getRoutingSnapshot(),
      getMusicSnapshot: () => this.musicController.getSnapshot(),
      clearTransientInput: () => this.inputAdapter.clearTransientInput(),
      recordResult: (result) => this.recordResult(result),
      resetGame: (status, origin) => this.resetGame(status, origin),
      render: () => this.renderCurrentWorld(),
      startAutoPilot: (weaponType) => this.startAutoPilot(weaponType),
      setAutoPilotEnabled: (enabled) => this.setAutoPilotEnabled(enabled),
      saveRunExport: () => this.submitDevRunExport(),
    });
    this.debugController = controller;
    this.debugBridge = new ArenaDebugBridge(window);
    this.debugBridge.install(controller.createApi());
  }

  private submitDevRunExport(): Promise<{ ok: boolean; path?: string; error?: string }> {
    if (!import.meta.env.DEV || !this.devRunExportClient) {
      return Promise.resolve({ ok: false, error: "Run export logging is only available in dev." });
    }

    const runExport = this.debugController?.getRunExport();
    if (!runExport) {
      return Promise.resolve({
        ok: false,
        error: "Debug run export controller is not ready.",
      });
    }
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
    const runRankings = this.runLifecycle.getRankings();
    const runContext = this.runLifecycle.getContext();
    const outcome = this.menuController.handle(action, {
      status: this.world.state.status,
      profileId: this.profile.id,
      settings: this.settings,
      runHistory: this.runLifecycle.getHistory(),
      rankingBoardCount: createRankingBoardQueries(
        runRankings,
        this.profile.id,
        runContext,
      ).length,
    });
    if (!outcome.handled) return false;

    this.applyMenuActionOutcome(outcome);
    return true;
  }

  private applyMenuActionOutcome(outcome: ArenaMenuActionOutcome): void {
    if (outcome.records) {
      this.runLifecycle.applyRecordViews(outcome.records);
    }
    if (outcome.settings) {
      this.settings = outcome.settings;
      this.feedbackLayer.configure(this.settings);
      this.audioRouter.configure(this.settings);
      this.musicController.configure(this.settings);
    }

    const command = outcome.command;
    if (!command) return;
    if (command.type === "showWeaponSelect") {
      this.selectedModeId = command.modeId;
      this.selectedStageId = command.stageId;
      this.resetGame("weaponSelect");
      return;
    }
    if (command.type === "startRun") {
      this.selectedWeapon = command.weaponType;
      this.resetGame("playing");
      return;
    }
    if (command.type === "showTitle") {
      this.showTitle();
      return;
    }
    if (command.type === "showBetaInfo") {
      window.location.assign("/beta-info.html");
      return;
    }

    this.profile = command.profile;
    this.showTitle();
    this.menuController.open("settings", "ゲストIDを再生成しました");
  }

  private createUiState(): PhaserUiState {
    const menuState = this.menuController.state;
    return createPhaserUiState({
      secondaryMenu: menuState.secondaryMenu,
      runHistory: this.runLifecycle.getHistory(),
      runRankings: this.runLifecycle.getRankings(),
      runContext: this.runLifecycle.getContext(),
      profile: this.profile,
      settings: this.settings,
      latestRunRecord: this.runLifecycle.getLatestRecord(),
      previousBest: this.runLifecycle.getPreviousBest(),
      previousWeaponBest: this.runLifecycle.getPreviousWeaponBest(),
      historyClearPending: menuState.historyClearPending,
      rankingClearPending: menuState.rankingClearPending,
      rankingBoardIndex: menuState.rankingBoardIndex,
      historyPage: menuState.historyPage,
      historyWeaponFilter: menuState.historyWeaponFilter,
      focusedMenuAction: this.inputAdapter.getFocusedMenuAction(
        this.world.state.status,
        menuState.secondaryMenu,
      ),
      notice: menuState.notice,
      releaseIdentity: {
        appVersion: APP_VERSION,
        rulesetVersion: RULESET_VERSION,
        buildCommit: this.getBuildCommit(),
      },
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

  private showTitle(): void {
    this.selectedModeId = DEFAULT_MODE_ID;
    this.selectedStageId = DEFAULT_STAGE_ID;
    this.resetGame("title");
  }

  private startAutoPilot(weaponType: WeaponTypeId): void {
    this.autoPilotController.start();
    this.selectedWeapon = weaponType;
    this.resetGame("playing", this.getDebugRunOrigin());
  }

  private setAutoPilotEnabled(enabled: boolean): void {
    if (enabled === this.autoPilotController.enabled) return;
    if (
      enabled &&
      (this.world.state.status === "title" ||
        this.world.state.status === "weaponSelect" ||
        this.world.state.status === "gameOver")
    ) {
      this.startAutoPilot(this.selectedWeapon);
      return;
    }

    this.autoPilotController.setEnabled(enabled);
    if (!enabled) return;
    this.runLifecycle.markDebugMutation();
    this.runLifecycle.addModifier(AUTO_PILOT_MODIFIER_ID, false);
    if (this.autoPilotController.patrolStrategy === "visit-history-v1") {
      this.runLifecycle.addModifier(
        AUTO_PILOT_PATROL_MODIFIER_ID,
        false,
      );
    }
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

  private get world(): WorldState {
    return this.session.world;
  }

  private get runConfig(): SimulationConfig {
    return this.session.config;
  }

  private get runSeed(): number {
    return this.session.seed;
  }

}

function getConfiguredAutoPilotPatrolStrategy(): AutoPilotPatrolStrategy {
  return import.meta.env.VITE_ARENA_AUTO_PILOT_PATROL_STRATEGY ===
      "visit-history-v1"
    ? "visit-history-v1"
    : "periodic-v3";
}

function now(): number {
  return globalThis.performance?.now() ?? Date.now();
}
