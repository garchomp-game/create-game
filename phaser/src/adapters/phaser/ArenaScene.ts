import Phaser from "phaser";
import { SIMULATION_CONFIG, VIEW_CONFIG } from "../../config/gameConfig";
import type {
  EnemyTypeId,
  GameEvent,
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

export class ArenaScene extends Phaser.Scene {
  private inputAdapter!: PhaserInputAdapter;
  private arenaRenderer!: PhaserArenaRenderer;
  private debugOverlay!: PhaserDebugOverlay;
  private feedbackLayer!: PhaserFeedbackLayer;
  private audioRouter!: PhaserAudioEventRouter;
  private logger = new ConsoleLogger("warn");
  private metrics = new InMemoryMetrics();
  private frameSpikeReporter = new FrameSpikeReporter(this.logger, this.metrics);
  private simulationConfig: SimulationConfig = SIMULATION_CONFIG;
  private viewConfig: ViewConfig = VIEW_CONFIG;
  private random!: RandomSource;
  private world!: WorldState;
  private lastEvents: GameEvent[] = [];
  private debugPaused = false;

  constructor() {
    super("arena");
  }

  create(): void {
    this.simulationConfig =
      (this.registry.get("simulationConfig") as SimulationConfig | undefined) ?? SIMULATION_CONFIG;
    this.viewConfig = (this.registry.get("viewConfig") as ViewConfig | undefined) ?? VIEW_CONFIG;
    this.inputAdapter = new PhaserInputAdapter(this);
    this.arenaRenderer = new PhaserArenaRenderer(this, this.simulationConfig, this.viewConfig);
    this.feedbackLayer = new PhaserFeedbackLayer(this);
    this.audioRouter = new PhaserAudioEventRouter(this);
    this.debugOverlay = new PhaserDebugOverlay(this, this.metrics);
    this.resetGame("title");
    this.installDebugHook();
  }

  update(_time: number, deltaMs: number): void {
    const input = this.inputAdapter.read(
      this.world.state.status,
      this.world.progression.pendingUpgradeChoices.length,
    );
    if (this.inputAdapter.readDebugTogglePressed()) {
      this.debugOverlay.toggle();
    }
    if (this.debugPaused) {
      this.feedbackLayer.update(0);
      this.stepDebugControls(input);
      this.renderCurrentWorld();
      return;
    }

    this.feedbackLayer.update(deltaMs / 1000);
    const result = stepWorld(this.world, input, deltaMs / 1000, this.random, this.simulationConfig);
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

  private resetGame(status: WorldState["state"]["status"] = "playing"): void {
    this.random = createRandom(this.simulationConfig.seed);
    this.world = createWorld(this.simulationConfig);
    this.world.state.status = status;
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
    }
    this.lastEvents = this.lastEvents.slice(-20);
    this.feedbackLayer.handleEvents(result.events, this.world);
    this.audioRouter.handleEvents(result.events);
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
      this.simulationConfig,
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
      this.simulationConfig,
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

    const xpValue = Math.max(0, Math.floor(amount));
    if (xpValue === 0) return;

    const events: GameEvent[] = [
      { type: "pickup.collected", pickupId: "debug-xp", xpValue },
    ];
    this.world.progression.xp += xpValue;
    updateLevelProgression(this.world, this.random, this.simulationConfig, events);
    updateRunStats(this.world, events);
    this.recordResult({ events, metrics: [] });
    this.renderCurrentWorld();
  }

  private forceUpgradeSelect(): void {
    if (this.world.state.status === "gameOver") return;

    this.world.state.status = "upgradeSelect";
    this.world.progression.pendingUpgradeChoices = selectUpgradeChoices(
      this.simulationConfig,
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

  private recordForcedEvents(events: GameEvent[]): void {
    updateRunStats(this.world, events);
    this.recordResult({ events, metrics: [] });
  }

  private renderCurrentWorld(): void {
    this.arenaRenderer.render(this.world, this.inputAdapter.getPointerWorld());
    this.feedbackLayer.render();
    this.debugOverlay.render();
  }

  private installDebugHook(): void {
    if (!import.meta.env.DEV) return;

    window.__ARENA_DEBUG__ = {
      getSnapshot: () => ({
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
        wave: { ...getWaveBand(this.simulationConfig, this.world.state.elapsed) },
        stats: this.getStatsSnapshot(),
        resultSummary: createRunResultSummary(this.world),
        player: { ...this.world.player.position },
        lastAim: { ...this.world.state.lastAim },
        bulletCount: this.world.bullets.length,
        enemyCount: this.world.enemies.length,
        enemyTypeCounts: this.getEnemyTypeCounts(),
        enemyProjectileCount: this.world.enemyProjectiles.length,
        pickupCount: this.world.pickups.length,
        feedback: this.feedbackLayer.getSnapshot(),
        audioCues: this.audioRouter.getLastCues(),
        lastEvents: [...this.lastEvents],
      }),
      forceDamage: (amount: number) => {
        this.forceDamage(amount);
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
        this.resetGame("playing");
        this.renderCurrentWorld();
      },
      setPaused: (paused: boolean) => {
        this.debugPaused = paused;
        this.renderCurrentWorld();
      },
      step: (input: Partial<InputSnapshot> = {}, deltaSeconds = 1 / 60) => {
        this.stepDebugWorld(input, deltaSeconds);
      },
    };
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

  private getStatsSnapshot(): WorldState["stats"] {
    return {
      shotsFired: this.world.stats.shotsFired,
      enemiesKilled: this.world.stats.enemiesKilled,
      hitsTaken: this.world.stats.hitsTaken,
      damageTaken: this.world.stats.damageTaken,
      xpCollected: this.world.stats.xpCollected,
      pickupsCollected: this.world.stats.pickupsCollected,
      upgradesChosen: this.world.stats.upgradesChosen,
      weaponMetrics: {
        pulse: { ...this.world.stats.weaponMetrics.pulse },
        spread: { ...this.world.stats.weaponMetrics.spread },
        pierce: { ...this.world.stats.weaponMetrics.pierce },
      },
    };
  }
}
