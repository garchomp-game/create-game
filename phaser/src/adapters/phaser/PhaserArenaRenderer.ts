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
import { ARENA_DYNAMIC_WORLD_DEPTH } from "./PhaserArenaDepths";
import { PhaserTutorialLayer } from "./PhaserTutorialLayer";

export class PhaserArenaRenderer {
  private readonly graphics: Phaser.GameObjects.Graphics;
  private readonly background: PhaserTacticalBackground;
  private readonly worldView: PhaserArenaWorldView;
  private readonly screenView: PhaserArenaScreenView;
  private readonly hud: PhaserHud;
  private readonly tutorialLayer: PhaserTutorialLayer;
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
  ) {
    this.runConfig = simulationConfig;
    this.background = new PhaserTacticalBackground(
      scene,
      simulationConfig,
      viewConfig,
    );
    this.graphics = scene.add.graphics().setDepth(ARENA_DYNAMIC_WORLD_DEPTH);
    this.worldView = new PhaserArenaWorldView(simulationConfig, viewConfig);
    this.hud = new PhaserHud(scene, simulationConfig);
    this.tutorialLayer = new PhaserTutorialLayer(scene, simulationConfig);
    this.screenView = new PhaserArenaScreenView(scene, simulationConfig);
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

    const worldStartedAt = now();
    this.worldView.render(this.graphics, world, pointerWorld);
    const worldDuration = now() - worldStartedAt;
    const screenStartedAt = now();
    this.screenView.render(this.graphics, world, screen);
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
    this.worldView.renderCursor(this.graphics, pointerWorld);
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
