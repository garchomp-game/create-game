import * as Phaser from "phaser";
import type {
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
import type { PhaserUiState } from "./PhaserUiState";

export class PhaserArenaRenderer {
  private readonly graphics: Phaser.GameObjects.Graphics;
  private readonly worldView: PhaserArenaWorldView;
  private readonly screenView: PhaserArenaScreenView;
  private readonly hud: PhaserHud;

  constructor(
    scene: Phaser.Scene,
    private readonly simulationConfig: SimulationConfig,
    viewConfig: ViewConfig,
  ) {
    this.graphics = scene.add.graphics();
    this.worldView = new PhaserArenaWorldView(simulationConfig, viewConfig);
    this.hud = new PhaserHud(scene, simulationConfig);
    this.screenView = new PhaserArenaScreenView(scene, simulationConfig);
  }

  render(
    world: WorldState,
    pointerWorld: Vec2 | null = null,
    uiState?: PhaserUiState,
    autoPilotEnabled = false,
    autoPilotMode: AutoPilotMode | null = null,
  ): void {
    const screen = createArenaScreenViewModel(world, this.simulationConfig, uiState);

    this.worldView.render(this.graphics, world, pointerWorld);
    this.screenView.render(this.graphics, world, screen);
    this.hud.render(
      world,
      uiState?.secondaryMenu === null || uiState?.secondaryMenu === undefined,
      autoPilotEnabled,
      autoPilotMode,
    );
    this.worldView.renderCursor(this.graphics, pointerWorld);
  }
}
