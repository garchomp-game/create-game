import * as Phaser from "phaser";
import type { SimulationConfig, WorldState } from "../../domain/types";
import type { ArenaTutorialViewModel } from "../../presentation/ArenaTutorialPresenter";

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
  private readonly eyebrowText: Phaser.GameObjects.Text;
  private readonly titleText: Phaser.GameObjects.Text;
  private readonly instructionText: Phaser.GameObjects.Text;
  private readonly hintText: Phaser.GameObjects.Text;
  private readonly progressText: Phaser.GameObjects.Text;
  private readonly noticeText: Phaser.GameObjects.Text;

  constructor(
    scene: Phaser.Scene,
    private readonly simulationConfig: SimulationConfig,
  ) {
    this.graphics = scene.add.graphics().setDepth(12);
    this.eyebrowText = createText(scene, 12, "#67e8f9");
    this.titleText = createText(scene, 20, "#f8fafc");
    this.instructionText = createText(scene, 16, "#e2e8f0");
    this.hintText = createText(scene, 13, "#facc15");
    this.progressText = createText(scene, 13, "#cbd5e1").setOrigin(1, 0);
    this.noticeText = createText(scene, 13, "#ffffff")
      .setOrigin(0.5, 0.5)
      .setAlign("center");
  }

  render(
    world: WorldState,
    view: ArenaTutorialViewModel | null,
  ): void {
    this.graphics.clear();
    const visible = Boolean(view?.visible && view.presentation === "hud");
    this.setTextVisible(visible);
    if (!view || !visible) return;

    if (view.panelKind === "checklist") {
      this.renderChecklist(view);
    } else {
      this.renderStandardPanel(view);
    }

    if (view.notice) this.renderNotice(view.notice);

    if (view.target) {
      const pulse = (Math.sin(world.state.elapsed * 5) + 1) * 2;
      const radius = view.target.radius + pulse;
      if (view.showGuideLine) {
        this.graphics.lineStyle(2, 0xfacc15, 0.72);
        this.graphics.beginPath();
        this.graphics.moveTo(world.player.position.x, world.player.position.y);
        for (const point of view.target.guidePath ?? []) {
          this.graphics.lineTo(point.x, point.y);
        }
        this.graphics.lineTo(view.target.position.x, view.target.position.y);
        this.graphics.strokePath();
      }
      this.graphics.fillStyle(0xfacc15, view.target.kind === "zone" ? 0.12 : 0.05);
      this.graphics.fillCircle(
        view.target.position.x,
        view.target.position.y,
        radius,
      );
      this.graphics.lineStyle(3, 0xfacc15, 0.96);
      this.graphics.strokeCircle(
        view.target.position.x,
        view.target.position.y,
        radius,
      );
    }
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
      .setPosition(panel.x + 14, panel.y + 8)
      .setText("総合演習  8/8");
    this.titleText.setVisible(false);
    this.instructionText
      .setPosition(panel.x + 14, panel.y + 31)
      .setWordWrapWidth(panel.width - 28)
      .setText(view.progress ?? "");
    this.hintText
      .setPosition(panel.x + 14, panel.y + 59)
      .setText("危険時は回避を優先")
      .setVisible(true);
    this.progressText.setVisible(false);
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

  private setTextVisible(visible: boolean): void {
    this.eyebrowText.setVisible(visible);
    this.titleText.setVisible(visible);
    this.instructionText.setVisible(visible);
    this.hintText.setVisible(visible);
    this.progressText.setVisible(visible);
    this.noticeText.setVisible(false);
  }
}

function createText(
  scene: Phaser.Scene,
  fontSize: number,
  color: string,
): Phaser.GameObjects.Text {
  return scene.add
    .text(0, 0, "", {
      fontFamily: "Arial, sans-serif",
      fontSize: `${fontSize}px`,
      color,
      letterSpacing: 0,
    })
    .setDepth(13)
    .setVisible(false);
}
