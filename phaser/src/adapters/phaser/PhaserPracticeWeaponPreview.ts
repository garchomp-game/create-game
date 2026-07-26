import * as Phaser from "phaser";
import type { ViewConfig } from "../../domain/types";
import {
  ARENA_PHASER_COLORS as COLOR,
  ARENA_THEME,
} from "../../presentation/ArenaTheme";
import { ARENA_SCREEN_ENTITY_PREVIEW_DEPTH } from "./PhaserArenaDepths";
import { PhaserArenaEntityPreview } from "./PhaserArenaEntityPreview";

const PREVIEW_Y = 326;
const PREVIEW_HEIGHT = 82;
const PREVIEW_WIDTH = 320;

export class PhaserPracticeWeaponPreview {
  private readonly labels: Phaser.GameObjects.Text[];
  private readonly playerPreviews: PhaserArenaEntityPreview[];
  private readonly targetPreviews: PhaserArenaEntityPreview[];
  private targetPreviewIndex = 0;

  constructor(
    private readonly scene: Phaser.Scene,
    viewConfig: ViewConfig,
  ) {
    this.labels = [
      this.createLabel("高速・直線"),
      this.createLabel("低速・扇状"),
    ];
    this.playerPreviews = Array.from(
      { length: 2 },
      () =>
        new PhaserArenaEntityPreview(
          scene,
          "player",
          viewConfig,
          ARENA_SCREEN_ENTITY_PREVIEW_DEPTH,
        ),
    );
    this.targetPreviews = Array.from(
      { length: 4 },
      () =>
        new PhaserArenaEntityPreview(
          scene,
          "chaser",
          viewConfig,
          ARENA_SCREEN_ENTITY_PREVIEW_DEPTH,
        ),
    );
  }

  hide(): void {
    for (const label of this.labels) label.setVisible(false);
    for (const preview of this.playerPreviews) preview.hide();
    for (const preview of this.targetPreviews) preview.hide();
  }

  render(graphics: Phaser.GameObjects.Graphics): void {
    this.targetPreviewIndex = 0;
    const phase =
      import.meta.env.VITE_ARENA_RUN_ORIGIN === "test"
        ? 0.42
        : (this.scene.time.now / 1200) % 1;
    this.drawPreview(graphics, 140, "pulse", phase);
    this.drawPreview(graphics, 500, "spread", phase);
  }

  private drawPreview(
    graphics: Phaser.GameObjects.Graphics,
    x: number,
    weapon: "pulse" | "spread",
    phase: number,
  ): void {
    const accent = weapon === "pulse" ? COLOR.pulse : COLOR.spread;
    graphics.fillStyle(COLOR.barTrack, 0.72);
    graphics.fillRoundedRect(
      x,
      PREVIEW_Y,
      PREVIEW_WIDTH,
      PREVIEW_HEIGHT,
      ARENA_THEME.radii.control,
    );
    graphics.lineStyle(1, accent, 0.65);
    graphics.strokeRoundedRect(
      x,
      PREVIEW_Y,
      PREVIEW_WIDTH,
      PREVIEW_HEIGHT,
      ARENA_THEME.radii.control,
    );
    graphics.lineStyle(1, accent, 0.24);
    graphics.lineBetween(x + 45, PREVIEW_Y + 51, x + 286, PREVIEW_Y + 51);

    const label = this.labels[weapon === "pulse" ? 0 : 1]!;
    label
      .setPosition(x + 12, PREVIEW_Y + 8)
      .setColor(
        weapon === "pulse"
          ? ARENA_THEME.colors.pulse
          : ARENA_THEME.colors.warningBright,
      )
      .setVisible(true);

    const playerX = x + 28;
    const centerY = PREVIEW_Y + 51;
    this.playerPreviews[weapon === "pulse" ? 0 : 1]!.render({
      x: playerX,
      y: centerY,
      radius: 11,
      direction: { x: 1, y: 0 },
    });
    graphics.lineStyle(2, accent, 0.9);
    graphics.lineBetween(playerX + 11, centerY, playerX + 21, centerY);

    if (weapon === "pulse") {
      this.drawTarget(x + 292, centerY, 8);
      for (const offset of [0, 0.34, 0.68]) {
        const progress = (phase + offset) % 1;
        this.drawShot(
          graphics,
          playerX + 21 + progress * 238,
          centerY,
          accent,
          8,
        );
      }
      return;
    }

    const targetYs = [centerY - 19, centerY, centerY + 19];
    for (const targetY of targetYs) {
      this.drawTarget(x + 292, targetY, 6);
    }
    for (const volleyOffset of [0, 0.5]) {
      const progress = (phase + volleyOffset) % 1;
      targetYs.forEach((targetY) => {
        this.drawShot(
          graphics,
          playerX + 21 + progress * 238,
          centerY + (targetY - centerY) * progress,
          accent,
          6,
        );
      });
    }
  }

  private drawShot(
    graphics: Phaser.GameObjects.Graphics,
    x: number,
    y: number,
    color: number,
    width: number,
  ): void {
    graphics.fillStyle(color, 0.98);
    graphics.fillRoundedRect(x - width / 2, y - 2.5, width, 5, 2.5);
    graphics.lineStyle(1, COLOR.line, 0.72);
    graphics.strokeRoundedRect(x - width / 2, y - 2.5, width, 5, 2.5);
  }

  private drawTarget(
    x: number,
    y: number,
    radius: number,
  ): void {
    const preview = this.targetPreviews[this.targetPreviewIndex++];
    preview?.render({
      x,
      y,
      radius,
      direction: { x: -1, y: 0 },
    });
  }

  private createLabel(text: string): Phaser.GameObjects.Text {
    return this.scene.add
      .text(0, 0, text, {
        fontFamily: ARENA_THEME.typography.canvasFontFamily,
        fontSize: "13px",
        fontStyle: "bold",
      })
      .setDepth(21)
      .setVisible(false);
  }
}
