import type * as Phaser from "phaser";
import type { SimulationConfig, WorldState } from "../../domain/types";
import type { ArenaTutorialViewModel } from "../../presentation/ArenaTutorialPresenter";
import {
  TUTORIAL_CHECKLIST_GRAPHICS_DEPTH,
  TUTORIAL_CHECKLIST_TEXT_DEPTH,
  TUTORIAL_OVERLAY_GRAPHICS_DEPTH,
  TUTORIAL_OVERLAY_TEXT_DEPTH,
} from "./PhaserArenaDepths";
import { PhaserTutorialCueRenderer } from "./PhaserTutorialCueRenderer";

export const TUTORIAL_PANEL_BOUNDS = {
  x: 130,
  y: 446,
  width: 700,
  height: 78,
} as const;

export const TUTORIAL_TRANSFER_CHECKLIST_BOUNDS = {
  x: 374,
  y: 14,
  width: 290,
  height: 82,
} as const;

export class PhaserTutorialLayer {
  private readonly graphics: Phaser.GameObjects.Graphics;
  private readonly checklistGraphics: Phaser.GameObjects.Graphics;
  private readonly eyebrowText: Phaser.GameObjects.Text;
  private readonly titleText: Phaser.GameObjects.Text;
  private readonly instructionText: Phaser.GameObjects.Text;
  private readonly hintText: Phaser.GameObjects.Text;
  private readonly progressText: Phaser.GameObjects.Text;
  private readonly noticeText: Phaser.GameObjects.Text;
  private readonly checklistEyebrowText: Phaser.GameObjects.Text;
  private readonly checklistInstructionText: Phaser.GameObjects.Text;
  private readonly checklistHintText: Phaser.GameObjects.Text;
  private readonly cueRenderer: PhaserTutorialCueRenderer;

  constructor(
    scene: Phaser.Scene,
    private readonly simulationConfig: SimulationConfig,
  ) {
    this.graphics = scene.add
      .graphics()
      .setDepth(TUTORIAL_OVERLAY_GRAPHICS_DEPTH);
    this.checklistGraphics = scene.add
      .graphics()
      .setDepth(TUTORIAL_CHECKLIST_GRAPHICS_DEPTH);
    this.eyebrowText = createText(
      scene,
      12,
      "#67e8f9",
      TUTORIAL_OVERLAY_TEXT_DEPTH,
    );
    this.titleText = createText(
      scene,
      20,
      "#f8fafc",
      TUTORIAL_OVERLAY_TEXT_DEPTH,
    );
    this.instructionText = createText(
      scene,
      16,
      "#e2e8f0",
      TUTORIAL_OVERLAY_TEXT_DEPTH,
    );
    this.hintText = createText(
      scene,
      13,
      "#facc15",
      TUTORIAL_OVERLAY_TEXT_DEPTH,
    );
    this.progressText = createText(
      scene,
      13,
      "#cbd5e1",
      TUTORIAL_OVERLAY_TEXT_DEPTH,
    ).setOrigin(1, 0);
    this.noticeText = createText(
      scene,
      13,
      "#ffffff",
      TUTORIAL_OVERLAY_TEXT_DEPTH,
    )
      .setOrigin(0.5, 0.5)
      .setAlign("center");
    this.checklistEyebrowText = createText(
      scene,
      12,
      "#67e8f9",
      TUTORIAL_CHECKLIST_TEXT_DEPTH,
    );
    this.checklistInstructionText = createText(
      scene,
      16,
      "#e2e8f0",
      TUTORIAL_CHECKLIST_TEXT_DEPTH,
    );
    this.checklistHintText = createText(
      scene,
      13,
      "#facc15",
      TUTORIAL_CHECKLIST_TEXT_DEPTH,
    );
    this.cueRenderer = new PhaserTutorialCueRenderer(scene, simulationConfig);
  }

  render(
    world: WorldState,
    view: ArenaTutorialViewModel | null,
  ): void {
    this.graphics.clear();
    this.checklistGraphics.clear();
    const visible = Boolean(view?.visible && view.presentation === "hud");
    const checklistVisible = Boolean(visible && view?.panelKind === "checklist");
    this.setOverlayTextVisible(visible && !checklistVisible);
    this.setChecklistTextVisible(checklistVisible);
    this.cueRenderer.render(world, visible ? view : null);
    if (!view || !visible) return;

    if (view.panelKind === "checklist") {
      this.renderChecklist(view);
    } else {
      this.renderStandardPanel(view);
    }

    if (view.notice) this.renderNotice(view.notice);
  }

  private renderStandardPanel(view: ArenaTutorialViewModel): void {
    const panel = {
      ...TUTORIAL_PANEL_BOUNDS,
      width: this.simulationConfig.arena.width - TUTORIAL_PANEL_BOUNDS.x * 2,
    };
    this.graphics.fillStyle(0x020617, 0.9);
    this.graphics.fillRoundedRect(panel.x, panel.y, panel.width, panel.height, 6);
    this.graphics.lineStyle(2, 0x22d3ee, 0.95);
    this.graphics.strokeRoundedRect(
      panel.x + 0.5,
      panel.y + 0.5,
      panel.width - 1,
      panel.height - 1,
      6,
    );

    this.eyebrowText
      .setPosition(panel.x + 18, panel.y + 9)
      .setText(view.eyebrow);
    this.titleText
      .setPosition(panel.x + 18, panel.y + 29)
      .setText(view.title);
    this.instructionText
      .setPosition(panel.x + 150, panel.y + 31)
      .setWordWrapWidth(panel.width - 180)
      .setText(view.instruction);
    this.hintText
      .setPosition(panel.x + 18, panel.y + 58)
      .setText(view.hint ?? "")
      .setVisible(Boolean(view.hint));
    this.progressText
      .setPosition(panel.x + panel.width - 18, panel.y + 9)
      .setText(view.progress ?? "")
      .setVisible(Boolean(view.progress));
  }

  private renderChecklist(view: ArenaTutorialViewModel): void {
    const panel = TUTORIAL_TRANSFER_CHECKLIST_BOUNDS;
    this.checklistGraphics.fillStyle(0x020617, 0.9);
    this.checklistGraphics.fillRoundedRect(
      panel.x,
      panel.y,
      panel.width,
      panel.height,
      6,
    );
    this.checklistGraphics.lineStyle(2, 0x22d3ee, 0.95);
    this.checklistGraphics.strokeRoundedRect(
      panel.x + 0.5,
      panel.y + 0.5,
      panel.width - 1,
      panel.height - 1,
      6,
    );
    this.checklistEyebrowText
      .setPosition(panel.x + 14, panel.y + 8)
      .setText(view.eyebrow);
    this.checklistInstructionText
      .setPosition(panel.x + 14, panel.y + 31)
      .setWordWrapWidth(panel.width - 28)
      .setText(view.progress ?? "");
    this.checklistHintText
      .setPosition(panel.x + 14, panel.y + 59)
      .setText("危険時は回避を優先");
  }

  private renderNotice(notice: string): void {
    const panel = TUTORIAL_TRANSFER_CHECKLIST_BOUNDS;
    this.graphics.fillStyle(0x450a0a, 0.96);
    this.graphics.fillRoundedRect(panel.x, panel.y, panel.width, panel.height, 6);
    this.graphics.lineStyle(2, 0xfb7185, 0.98);
    this.graphics.strokeRoundedRect(
      panel.x + 0.5,
      panel.y + 0.5,
      panel.width - 1,
      panel.height - 1,
      6,
    );
    this.noticeText
      .setPosition(panel.x + panel.width / 2, panel.y + panel.height / 2)
      .setText(notice)
      .setVisible(true);
  }

  private setOverlayTextVisible(visible: boolean): void {
    this.eyebrowText.setVisible(visible);
    this.titleText.setVisible(visible);
    this.instructionText.setVisible(visible);
    this.hintText.setVisible(visible);
    this.progressText.setVisible(visible);
    this.noticeText.setVisible(false);
  }

  private setChecklistTextVisible(visible: boolean): void {
    this.checklistEyebrowText.setVisible(visible);
    this.checklistInstructionText.setVisible(visible);
    this.checklistHintText.setVisible(visible);
  }
}

function createText(
  scene: Phaser.Scene,
  fontSize: number,
  color: string,
  depth: number,
): Phaser.GameObjects.Text {
  return scene.add
    .text(0, 0, "", {
      fontFamily: "Arial, sans-serif",
      fontSize: `${fontSize}px`,
      color,
      letterSpacing: 0,
    })
    .setDepth(depth)
    .setVisible(false);
}
