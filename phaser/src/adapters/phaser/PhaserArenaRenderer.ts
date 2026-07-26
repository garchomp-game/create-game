import * as Phaser from "phaser";
import type {
  GameEvent,
  SimulationConfig,
  Vec2,
  ViewConfig,
  WorldState,
} from "../../domain/types";
import { createArenaScreenViewModel } from "../../presentation/ArenaScreenPresenter";
import type { AutoPilotMode } from "../../simulation/autoPilot";
import { PhaserArenaScreenView } from "./PhaserArenaScreenView";
import { PhaserArenaWorldView } from "./PhaserArenaWorldView";
import { PhaserHud } from "./PhaserHud";
import { PhaserTacticalBackground } from "./PhaserTacticalBackground";
import type { PhaserUiState } from "./PhaserUiState";
import type { TutorialSnapshot } from "../../domain/tutorial";
import { createArenaTutorialViewModel } from "../../presentation/ArenaTutorialPresenter";
import {
  ARENA_CURSOR_DEPTH,
  ARENA_DYNAMIC_WORLD_DEPTH,
  ARENA_SCREEN_GRAPHICS_DEPTH,
} from "./PhaserArenaDepths";
import { PhaserTutorialLayer } from "./PhaserTutorialLayer";
import { PhaserPracticeGuideLayer } from "./PhaserPracticeGuideLayer";
import { PhaserArenaEntityLayer } from "./PhaserArenaEntityLayer";

export class PhaserArenaRenderer {
  private readonly worldGraphics: Phaser.GameObjects.Graphics;
  private readonly screenGraphics: Phaser.GameObjects.Graphics;
  private readonly cursorGraphics: Phaser.GameObjects.Graphics;
  private readonly background: PhaserTacticalBackground;
  private readonly entityLayer: PhaserArenaEntityLayer;
  private readonly worldView: PhaserArenaWorldView;
  private readonly screenView: PhaserArenaScreenView;
  private readonly hud: PhaserHud;
  private readonly tutorialLayer: PhaserTutorialLayer;
  private readonly practiceGuideLayer: PhaserPracticeGuideLayer;
  private renderedFrames = 0;
  private worldRenderTotalMs = 0;
  private worldRenderMaxMs = 0;
  private screenHudRenderTotalMs = 0;
  private screenHudRenderMaxMs = 0;
  private feedbackRenderTotalMs = 0;
  private feedbackRenderMaxMs = 0;
  private runConfig: SimulationConfig;

  constructor(
    scene: Phaser.Scene,
    private readonly simulationConfig: SimulationConfig,
    viewConfig: ViewConfig,
    private readonly profilingEnabled = false,
  ) {
    this.runConfig = simulationConfig;
    this.background = new PhaserTacticalBackground(
      scene,
      simulationConfig,
      viewConfig,
    );
    this.entityLayer = new PhaserArenaEntityLayer(scene, viewConfig);
    this.worldGraphics = scene.add
      .graphics()
      .setDepth(ARENA_DYNAMIC_WORLD_DEPTH);
    this.screenGraphics = scene.add
      .graphics()
      .setDepth(ARENA_SCREEN_GRAPHICS_DEPTH);
    this.cursorGraphics = scene.add.graphics().setDepth(ARENA_CURSOR_DEPTH);
    this.worldView = new PhaserArenaWorldView(simulationConfig, viewConfig);
    this.hud = new PhaserHud(scene, simulationConfig);
    this.tutorialLayer = new PhaserTutorialLayer(scene, simulationConfig);
    this.practiceGuideLayer = new PhaserPracticeGuideLayer(
      scene,
      simulationConfig,
    );
    this.screenView = new PhaserArenaScreenView(
      scene,
      simulationConfig,
      viewConfig,
    );
  }

  configureForRun(config: SimulationConfig): void {
    this.runConfig = config;
    this.hud.configureForRun(config);
  }

  handleEvents(events: GameEvent[], world: WorldState): void {
    this.hud.handleEvents(events, world);
  }

  render(
    world: WorldState,
    pointerWorld: Vec2 | null = null,
    uiState?: PhaserUiState,
    autoPilotEnabled = false,
    autoPilotMode: AutoPilotMode | null = null,
    tutorialSnapshot: TutorialSnapshot | null = null,
  ): void {
    const screen = createArenaScreenViewModel(
      world,
      this.runConfig,
      uiState,
      tutorialSnapshot,
    );

    const worldStartedAt = this.profilingEnabled ? now() : 0;
    this.entityLayer.render(world);
    this.worldView.render(this.worldGraphics, world, pointerWorld);
    this.practiceGuideLayer.render(world);
    const worldDuration = this.profilingEnabled ? now() - worldStartedAt : 0;
    const screenStartedAt = this.profilingEnabled ? now() : 0;
    this.screenGraphics.clear();
    this.screenView.render(this.screenGraphics, world, screen);
    this.hud.render(
      world,
      uiState?.secondaryMenu === null || uiState?.secondaryMenu === undefined,
      autoPilotEnabled,
      autoPilotMode,
    );
    this.tutorialLayer.render(
      world,
      createArenaTutorialViewModel(tutorialSnapshot, world.state.status),
    );
    this.cursorGraphics.clear();
    this.worldView.renderCursor(this.cursorGraphics, pointerWorld);
    if (!this.profilingEnabled) return;

    const screenDuration = now() - screenStartedAt;
    this.renderedFrames += 1;
    this.worldRenderTotalMs += worldDuration;
    this.worldRenderMaxMs = Math.max(this.worldRenderMaxMs, worldDuration);
    this.screenHudRenderTotalMs += screenDuration;
    this.screenHudRenderMaxMs = Math.max(
      this.screenHudRenderMaxMs,
      screenDuration,
    );
  }

  recordFeedbackRender(durationMs: number): void {
    if (!this.profilingEnabled) return;
    if (!Number.isFinite(durationMs) || durationMs < 0) return;
    this.feedbackRenderTotalMs += durationMs;
    this.feedbackRenderMaxMs = Math.max(this.feedbackRenderMaxMs, durationMs);
  }

  resetPerformance(): void {
    this.renderedFrames = 0;
    this.worldRenderTotalMs = 0;
    this.worldRenderMaxMs = 0;
    this.screenHudRenderTotalMs = 0;
    this.screenHudRenderMaxMs = 0;
    this.feedbackRenderTotalMs = 0;
    this.feedbackRenderMaxMs = 0;
  }

  getPerformanceSnapshot(): ArenaRenderPerformanceSnapshot {
    const samples = Math.max(1, this.renderedFrames);
    return {
      staticBackground: this.background.getSnapshot(),
      renderedFrames: this.renderedFrames,
      dynamicWorld: {
        averageMs: this.worldRenderTotalMs / samples,
        maxMs: this.worldRenderMaxMs,
      },
      screenHud: {
        averageMs: this.screenHudRenderTotalMs / samples,
        maxMs: this.screenHudRenderMaxMs,
      },
      feedback: {
        averageMs: this.feedbackRenderTotalMs / samples,
        maxMs: this.feedbackRenderMaxMs,
      },
    };
  }
}

export type ArenaRenderPerformanceSnapshot = {
  staticBackground: { drawCount: number; drawDurationMs: number };
  renderedFrames: number;
  dynamicWorld: { averageMs: number; maxMs: number };
  screenHud: { averageMs: number; maxMs: number };
  feedback: { averageMs: number; maxMs: number };
};

function now(): number {
  return globalThis.performance?.now() ?? Date.now();
}
