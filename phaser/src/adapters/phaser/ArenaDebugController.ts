import { SIMULATION_CONFIG_VERSION } from "../../config/gameConfig";
import type {
  LocalProfile,
  ProfileSettings,
  ProfileSettingsUpdate,
} from "../../domain/profile";
import type { RunOrigin } from "../../domain/runRecords";
import type {
  BossAttackId,
  GameEvent,
  InputSnapshot,
  StepWorldResult,
  WeaponTypeId,
  WorldState,
} from "../../domain/types";
import { UPGRADE_IDS } from "../../domain/types";
import type { RunRecordStorePort } from "../../ports/RunRecordStorePort";
import { composeBuild } from "../../simulation/buildComposer";
import { createRunResultSummary } from "../../simulation/resultSummary";
import {
  completeBuild,
  getAvailableUpgradeIds,
  getLockedUpgradeIds,
  getMaxedUpgradeIds,
  selectUpgradeChoices,
  updateLevelProgression,
} from "../../simulation/systems/levelSystem";
import { updateRunStats } from "../../simulation/systems/statsSystem";
import { getWaveBand } from "../../simulation/waveDirector";
import type { ArenaSession } from "../../application/ArenaSession";
import type { AutoPilotController } from "../../application/AutoPilotController";
import type { PerformanceMonitor } from "../../application/PerformanceMonitor";
import type { RunLifecycleController } from "../../application/RunLifecycleController";
import {
  copyRunStats,
  createArenaRunExport,
  getArenaEnemyTypeCounts,
  getArenaObstacleContactCounts,
} from "../telemetry/ArenaRunExport";
import type { AudioCueId } from "./PhaserAudioEventRouter";
import type {
  ArenaDebugApi,
  ArenaRunExport,
} from "./ArenaDebugBridge";
import {
  armExpeditionBossDefeatFixture,
  applyEnemyVisualFixture,
  applyExpeditionBossFixture,
  applyExpeditionChargerFixture,
  applyExpeditionCommanderFixture,
  applyHealPickupFixture,
  applyHudStressFixture,
  applyObstacleFrictionFixture,
  applyOffscreenEnemyIndicatorFixture,
  createDebugInput,
} from "./ArenaDebugFixtures";
import type { FeedbackSnapshot } from "./PhaserFeedbackLayer";
import type { MusicSnapshot } from "./PhaserMusicController";
import type { SecondaryMenu } from "../../application/ArenaMenuTypes";
import type { ArenaRenderPerformanceSnapshot } from "./PhaserArenaRenderer";

export type ArenaDebugControllerDependencies = {
  session: ArenaSession;
  runLifecycle: RunLifecycleController;
  runRecordStore: Pick<RunRecordStorePort, "load">;
  autoPilot: AutoPilotController;
  performance: PerformanceMonitor;
  getActualFps(): number;
  getRenderPerformance(): ArenaRenderPerformanceSnapshot;
  getBuildCommit(): string;
  getProfile(): LocalProfile;
  getSettings(): ProfileSettings;
  updateSettings(update: ProfileSettingsUpdate): ProfileSettings;
  getSecondaryMenu(): SecondaryMenu | null;
  openMenu(menu: SecondaryMenu | null): void;
  getBaseRunOrigin(): RunOrigin;
  getFixedSeed(): number | null;
  getFeedbackSnapshot(): FeedbackSnapshot;
  getAudioCues(): AudioCueId[];
  getMusicSnapshot(): MusicSnapshot;
  clearTransientInput(): void;
  recordResult(result: StepWorldResult): void;
  resetGame(status: WorldState["state"]["status"], origin?: RunOrigin): void;
  render(): void;
  startAutoPilot(weaponType: WeaponTypeId): void;
  setAutoPilotEnabled(enabled: boolean): void;
  saveRunExport(): Promise<{ ok: boolean; path?: string; error?: string }>;
};

export class ArenaDebugController {
  private pausedState = false;
  private soakProtectionEnabled = false;

  constructor(private readonly dependencies: ArenaDebugControllerDependencies) {}

  get paused(): boolean {
    return this.pausedState;
  }

  resetRun(): void {
    this.soakProtectionEnabled = false;
  }

  prepareSoakProtection(): void {
    const world = this.world;
    if (!this.soakProtectionEnabled || world.state.status !== "playing") return;

    this.normalizeSoakHealth();
    world.state.damageCooldown = Math.max(world.state.damageCooldown, 60);
    world.encounter.collapse.damageTimer = Math.max(
      world.encounter.collapse.damageTimer,
      60,
    );
  }

  normalizeSoakHealth(): void {
    const world = this.world;
    if (!this.soakProtectionEnabled || world.state.status === "gameOver") return;
    world.state.hp = this.config.player.maxHp + world.runtime.maxHpBonus;
  }

  stepDebugControls(input: InputSnapshot): void {
    if (
      !input.restartPressed &&
      !input.pausePressed &&
      !input.startPressed &&
      !input.quitToTitlePressed
    ) return;

    const result = this.dependencies.session.step(
      {
        move: { x: 0, y: 0 },
        aimWorld: null,
        startPressed: input.startPressed,
        shootHeld: false,
        restartPressed: input.restartPressed,
        pausePressed: input.pausePressed,
        quitToTitlePressed: input.quitToTitlePressed,
        upgradeChoicePressed: null,
        contractChoicePressed: null,
      },
      0,
    );
    this.dependencies.recordResult(result);
    this.handleNavigationEvents(result.events);
  }

  createApi(): ArenaDebugApi {
    return {
      getSnapshot: () => this.getSnapshot(),
      getRunExport: () => this.getRunExport(),
      getRunExportJson: () => JSON.stringify(this.getRunExport(), null, 2),
      getRunRecords: () => this.dependencies.runRecordStore.load().records,
      getRunHistory: () => this.dependencies.runRecordStore.load().history,
      getRunRankingRecords: () =>
        this.dependencies.runRecordStore.load().rankings,
      clearRunRecords: () => this.dependencies.runLifecycle.clearAll(),
      getProfile: () => ({ ...this.dependencies.getProfile() }),
      getSettings: () => ({ ...this.dependencies.getSettings() }),
      updateSettings: (update) => this.dependencies.updateSettings(update),
      openMenu: (menu) => this.dependencies.openMenu(menu),
      saveRunExport: () => this.dependencies.saveRunExport(),
      forceDamage: (amount) => this.forceDamage(amount),
      restoreHealthForSoak: () => this.restoreHealthForSoak(),
      forceGameOver: () => this.forceGameOver(),
      grantXp: (amount) => this.grantXp(amount),
      forceUpgradeSelect: (preserveInput) => this.forceUpgradeSelect(preserveInput),
      forceExtraUpgradeSelect: () => this.forceExtraUpgradeSelect(),
      restart: () => {
        this.dependencies.resetGame("playing", this.debugRunOrigin);
        this.dependencies.render();
      },
      startAutoPilot: (weaponType = "pulse") => {
        this.dependencies.startAutoPilot(
          weaponType === "spread" ? "spread" : "pulse",
        );
        this.dependencies.render();
      },
      setAutoPilotEnabled: (enabled) => {
        this.dependencies.setAutoPilotEnabled(enabled);
        this.dependencies.render();
      },
      setPaused: (paused) => {
        this.dependencies.runLifecycle.markDebugMutation();
        this.pausedState = paused;
        this.dependencies.render();
      },
      setElapsed: (elapsed) => this.setElapsed(elapsed),
      setHudStressFixture: () => this.setHudStressFixture(),
      setEnemyVisualFixture: (band = "wave3") =>
        this.setEnemyVisualFixture(band),
      setObstacleFrictionFixture: () => this.setObstacleFrictionFixture(),
      setHealPickupFixture: (mode = "damaged") =>
        this.setHealPickupFixture(mode),
      setOffscreenEnemyIndicatorFixture: () =>
        this.setOffscreenEnemyIndicatorFixture(),
      setExpeditionCommanderFixture: () =>
        this.setExpeditionCommanderFixture(),
      setExpeditionChargerFixture: () =>
        this.setExpeditionChargerFixture(),
      setExpeditionBossFixture: (attackId = "targeted-salvo", phase = 1) =>
        this.setExpeditionBossFixture(attackId, phase),
      armExpeditionBossDefeat: () => this.armExpeditionBossDefeat(),
      step: (input = {}, deltaSeconds = 1 / 60) =>
        this.stepWorld(input, deltaSeconds),
    };
  }

  getRunExport(): ArenaRunExport {
    return createArenaRunExport({
      capturedAt: new Date().toISOString(),
      buildCommit: this.dependencies.getBuildCommit(),
      context: this.dependencies.runLifecycle.getContext(),
      profileId: this.dependencies.getProfile().id,
      baseRunOrigin: this.dependencies.getBaseRunOrigin(),
      fixedSeed: this.dependencies.getFixedSeed(),
      runSeed: this.dependencies.session.seed,
      randomStreams: this.dependencies.session.randomStreams,
      runConfig: this.config,
      world: this.world,
      performance: this.dependencies.performance.getSnapshot(
        this.dependencies.getActualFps(),
      ),
      renderPerformance: this.dependencies.getRenderPerformance(),
      lastEvents: this.dependencies.runLifecycle.getLastEvents(),
    });
  }

  private getSnapshot(): ReturnType<ArenaDebugApi["getSnapshot"]> {
    const world = this.world;
    const config = this.config;
    const randomStreams = this.dependencies.session.randomStreams;
    const autoPilot = this.dependencies.autoPilot.getSnapshot();
    return {
      configVersion: SIMULATION_CONFIG_VERSION,
      buildCommit: this.dependencies.getBuildCommit(),
      runContext: this.dependencies.runLifecycle.getContext(),
      latestRunRecord: this.dependencies.runLifecycle.getLatestRecord(),
      secondaryMenu: this.dependencies.getSecondaryMenu(),
      seed: this.dependencies.session.seed,
      randomStreams: {
        version: randomStreams.version,
        rootSeed: randomStreams.rootSeed,
        seeds: { ...randomStreams.seeds },
      },
      status: world.state.status,
      autoPilotEnabled: autoPilot.enabled,
      autoPilotMode: autoPilot.mode,
      autoPilotIntentMode: autoPilot.intentMode,
      autoPilotOverrideReason: autoPilot.overrideReason,
      autoPilotRiskScore: autoPilot.riskScore,
      autoPilotTargetId: autoPilot.targetId,
      performance: this.dependencies.performance.getSnapshot(
        this.dependencies.getActualFps(),
      ),
      renderPerformance: this.dependencies.getRenderPerformance(),
      elapsed: world.state.elapsed,
      hp: world.state.hp,
      score: world.state.score,
      weaponType: world.state.weaponType,
      level: world.progression.level,
      extraLevel: world.progression.extraLevel,
      extraCycle: world.progression.extraCycle,
      xp: world.progression.xp,
      xpToNext: world.progression.xpToNext,
      buildCompletedAt: world.progression.buildCompletedAt,
      pendingUpgradeChoices: [...world.progression.pendingUpgradeChoices],
      upgradeRanks: { ...world.progression.upgradeRanks },
      extraUpgradeRanks: { ...world.progression.extraUpgradeRanks },
      extraCycleRemaining: [...world.progression.extraCycleRemaining],
      runtime: { ...world.runtime },
      buildComposition: composeBuild(
        config,
        world.state.weaponType,
        world.progression.upgradeRanks,
        [],
        world.progression.extraUpgradeRanks,
      ),
      encounter: structuredClone(world.encounter),
      expedition: world.expedition ? structuredClone(world.expedition) : null,
      wave: { ...getWaveBand(config, world.state.elapsed) },
      stats: copyRunStats(world),
      resultSummary: createRunResultSummary(world, config),
      player: { ...world.player.position },
      lastAim: { ...world.state.lastAim },
      bulletCount: world.bullets.length,
      enemyCount: world.enemies.length,
      enemyTypeCounts: getArenaEnemyTypeCounts(world),
      enemyProjectileCount: world.enemyProjectiles.length,
      pickupCount: world.pickups.length,
      obstacleContacts: getArenaObstacleContactCounts(world),
      feedback: this.dependencies.getFeedbackSnapshot(),
      audioCues: this.dependencies.getAudioCues(),
      music: this.dependencies.getMusicSnapshot(),
      lastEvents: this.dependencies.runLifecycle.getLastEvents(),
    };
  }

  private stepWorld(input: Partial<InputSnapshot>, deltaSeconds: number): void {
    this.markMutation();
    this.prepareSoakProtection();
    const result = this.dependencies.session.step(
      createDebugInput(input),
      deltaSeconds,
    );
    this.normalizeSoakHealth();
    this.dependencies.recordResult(result);
    this.handleNavigationEvents(result.events);
    this.dependencies.render();
  }

  private forceDamage(amount: number): void {
    if (this.world.state.status !== "playing") return;
    this.markMutation();
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
    this.dependencies.render();
  }

  private restoreHealthForSoak(): void {
    if (this.world.state.status === "gameOver") return;
    this.dependencies.runLifecycle.markDebugMutation();
    this.soakProtectionEnabled = true;
    this.normalizeSoakHealth();
    this.dependencies.render();
  }

  private forceGameOver(): void {
    if (this.world.state.status === "gameOver") return;
    this.markMutation();
    this.world.state.hp = 0;
    this.world.state.status = "gameOver";
    this.recordForcedEvents([
      {
        type: "game.over",
        score: this.world.state.score,
        elapsed: this.world.state.elapsed,
      },
    ]);
    this.dependencies.render();
  }

  private grantXp(amount: number): void {
    if (this.world.state.status !== "playing") return;
    this.markMutation();
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
    updateLevelProgression(
      this.world,
      this.dependencies.session.randomStreams.upgrade,
      this.config,
      events,
    );
    updateRunStats(this.world, events);
    this.dependencies.recordResult({ events, metrics: [] });
    this.dependencies.render();
  }

  private forceUpgradeSelect(preserveInput = false): void {
    if (this.world.state.status === "gameOver") return;
    this.markMutation(!preserveInput);
    const choices = selectUpgradeChoices(
      this.config,
      this.dependencies.session.randomStreams.upgrade,
      this.world.progression.upgradeRanks,
      this.world.state.weaponType,
    );
    if (choices.length === 0) return;

    this.world.state.status = "upgradeSelect";
    this.world.progression.pendingUpgradeChoices = choices;
    const availableUpgradeIds = getAvailableUpgradeIds(
      this.config,
      this.world.progression.upgradeRanks,
      this.world.state.weaponType,
    );
    this.dependencies.recordResult({
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
            this.config,
            this.world.progression.upgradeRanks,
            this.world.state.weaponType,
          ),
          maxedUpgradeIds: getMaxedUpgradeIds(
            this.config,
            this.world.progression.upgradeRanks,
            this.world.state.weaponType,
          ),
        },
      ],
      metrics: [],
    });
    this.dependencies.render();
  }

  private forceExtraUpgradeSelect(): void {
    if (this.world.state.status === "gameOver") return;
    this.markMutation();
    for (const upgradeId of UPGRADE_IDS) {
      this.world.progression.upgradeRanks[upgradeId] =
        this.config.upgrades[upgradeId].maxRank;
    }
    const composition = composeBuild(
      this.config,
      this.world.state.weaponType,
      this.world.progression.upgradeRanks,
      [],
      this.world.progression.extraUpgradeRanks,
    );
    Object.assign(this.world.runtime, composition.modifiers);
    this.world.state.hp =
      this.config.player.maxHp + this.world.runtime.maxHpBonus;

    const events: GameEvent[] = [];
    completeBuild(this.world, this.config, events);
    this.world.progression.xp = this.world.progression.xpToNext;
    this.world.state.status = "playing";
    updateLevelProgression(
      this.world,
      this.dependencies.session.randomStreams.upgrade,
      this.config,
      events,
    );
    updateRunStats(this.world, events);
    this.dependencies.recordResult({ events, metrics: [] });
    this.dependencies.render();
  }

  private setElapsed(elapsed: number): void {
    if (!Number.isFinite(elapsed)) return;
    this.markMutation(false);
    this.world.state.elapsed = Math.max(0, elapsed);
    this.dependencies.render();
  }

  private setEnemyVisualFixture(band: "wave2" | "wave3"): void {
    this.markMutation();
    applyEnemyVisualFixture(this.world, this.config, band);
    this.dependencies.render();
  }

  private setHudStressFixture(): void {
    this.markMutation();
    applyHudStressFixture(this.world, this.config);
    this.dependencies.render();
  }

  private setObstacleFrictionFixture(): void {
    this.markMutation();
    if (applyObstacleFrictionFixture(this.world, this.config)) {
      this.dependencies.render();
    }
  }

  private setHealPickupFixture(
    mode: "damaged" | "full" | "fatal" | "visual",
  ): void {
    this.markMutation();
    applyHealPickupFixture(this.world, this.config, mode);
    this.dependencies.render();
  }

  private setOffscreenEnemyIndicatorFixture(): void {
    this.markMutation();
    applyOffscreenEnemyIndicatorFixture(this.world, this.config);
    this.dependencies.render();
  }

  private setExpeditionCommanderFixture(): void {
    this.markMutation();
    if (applyExpeditionCommanderFixture(this.world, this.config)) {
      this.dependencies.render();
    }
  }

  private setExpeditionChargerFixture(): void {
    this.markMutation();
    if (applyExpeditionChargerFixture(this.world, this.config)) {
      this.dependencies.render();
    }
  }

  private setExpeditionBossFixture(
    attackId: BossAttackId,
    phase: 1 | 2,
  ): void {
    this.markMutation();
    if (applyExpeditionBossFixture(this.world, this.config, attackId, phase)) {
      this.dependencies.render();
    }
  }

  private armExpeditionBossDefeat(): void {
    this.markMutation();
    if (armExpeditionBossDefeatFixture(this.world)) {
      this.dependencies.render();
    }
  }

  private recordForcedEvents(events: GameEvent[]): void {
    updateRunStats(this.world, events);
    this.dependencies.recordResult({ events, metrics: [] });
  }

  private markMutation(clearInput = true): void {
    this.dependencies.runLifecycle.markDebugMutation();
    if (clearInput) this.dependencies.clearTransientInput();
  }

  private handleNavigationEvents(events: readonly GameEvent[]): void {
    if (events.some((event) => event.type === "game.restart.requested")) {
      this.dependencies.resetGame("playing");
    }
    if (events.some((event) => event.type === "game.title.requested")) {
      this.dependencies.resetGame("title");
    }
  }

  private get world(): WorldState {
    return this.dependencies.session.world;
  }

  private get config() {
    return this.dependencies.session.config;
  }

  private get debugRunOrigin(): RunOrigin {
    return this.dependencies.getBaseRunOrigin() === "test" ? "test" : "debug";
  }
}
