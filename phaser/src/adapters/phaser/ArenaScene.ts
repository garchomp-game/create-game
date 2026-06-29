import Phaser from "phaser";
import {
  SIMULATION_CONFIG,
  SIMULATION_CONFIG_VERSION,
  VIEW_CONFIG,
} from "../../config/gameConfig";
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
    this.inputAdapter.clearTransientInput();
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
    updateLevelProgression(this.world, this.random, this.simulationConfig, events);
    updateRunStats(this.world, events);
    this.recordResult({ events, metrics: [] });
    this.renderCurrentWorld();
  }

  private forceUpgradeSelect(): void {
    if (this.world.state.status === "gameOver") return;

    this.inputAdapter.clearTransientInput();
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

  private setElapsedForDebug(elapsed: number): void {
    if (!Number.isFinite(elapsed)) return;

    this.world.state.elapsed = Math.max(0, elapsed);
    this.renderCurrentWorld();
  }

  private setEnemyVisualFixture(band: "wave2" | "wave3" = "wave3"): void {
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
      const definition = this.simulationConfig.enemies[item.typeId];
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

    const ranged = this.simulationConfig.enemies.ranged.ranged;
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
    const obstacle = this.simulationConfig.obstacles[0];
    if (!obstacle) return;

    this.inputAdapter.clearTransientInput();
    this.world.player.position = {
      x: obstacle.x - this.simulationConfig.player.radius,
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
    this.inputAdapter.clearTransientInput();
    const maxHp = this.simulationConfig.player.maxHp + this.world.runtime.maxHpBonus;
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
          radius: this.simulationConfig.pickup.xpRadius,
          xpValue: 1,
          healValue: 0,
          lifetime: null,
        },
        this.createDebugHealPickup("debug-heal-pickup", { x: 665, y: 300 }, healValue),
      ];
      this.world.enemies = [this.createDebugEnemy("chaser", { x: 740, y: 300 }, 1)];
      const ranged = this.simulationConfig.enemies.ranged.ranged;
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
      const ranged = this.simulationConfig.enemies.ranged.ranged;
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
    this.inputAdapter.clearTransientInput();
    const { width, height } = this.simulationConfig.arena;

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
    this.arenaRenderer.render(this.world, this.inputAdapter.getPointerWorld());
    this.feedbackLayer.render();
    this.debugOverlay.render();
  }

  private installDebugHook(): void {
    if (!import.meta.env.DEV) return;

    window.__ARENA_DEBUG__ = {
      getSnapshot: () => ({
        configVersion: SIMULATION_CONFIG_VERSION,
        buildCommit: this.getBuildCommit(),
        seed: this.simulationConfig.seed,
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
        obstacleContacts: this.getObstacleContactCounts(),
        feedback: this.feedbackLayer.getSnapshot(),
        audioCues: this.audioRouter.getLastCues(),
        lastEvents: [...this.lastEvents],
      }),
      getRunExport: () => this.getRunExport(),
      getRunExportJson: () => JSON.stringify(this.getRunExport(), null, 2),
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
    return {
      capturedAt: new Date().toISOString(),
      game: "arena-core-phaser" as const,
      appVersion: "0.4",
      configVersion: SIMULATION_CONFIG_VERSION,
      buildCommit: this.getBuildCommit(),
      seed: this.simulationConfig.seed,
      status: this.world.state.status,
      elapsed: this.world.state.elapsed,
      wave: { ...getWaveBand(this.simulationConfig, this.world.state.elapsed) },
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
      radius: this.simulationConfig.pickup.healRadius,
      xpValue: 0,
      healValue,
      lifetime: this.simulationConfig.pickup.healLifetime,
    };
  }

  private createDebugEnemy(
    typeId: EnemyTypeId,
    position: { x: number; y: number },
    index: number,
    enteredArena = true,
  ): Enemy {
    const definition = this.simulationConfig.enemies[typeId];
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
    const maxHp = this.simulationConfig.player.maxHp + this.world.runtime.maxHpBonus;
    return Math.max(
      this.simulationConfig.pickup.healMinimum,
      Math.floor(maxHp * this.simulationConfig.pickup.healRatio),
    );
  }
}
