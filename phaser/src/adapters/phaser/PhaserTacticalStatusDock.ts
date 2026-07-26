import * as Phaser from "phaser";
import {
  ARENA_PHASER_COLORS,
  ARENA_THEME,
} from "../../presentation/ArenaTheme";
import type {
  TacticalStatusTone,
  TacticalStatusViewModel,
} from "../../presentation/TacticalStatusPresenter";
import { getTacticalStatusDockBounds } from "./PhaserHudLayout";

const COMPACT_HEIGHT = 32;
const EXPANDED_HEIGHT = 50;

export class PhaserTacticalStatusDock {
  private readonly graphics: Phaser.GameObjects.Graphics;
  private readonly titleText: Phaser.GameObjects.Text;
  private readonly detailText: Phaser.GameObjects.Text;

  constructor(
    scene: Phaser.Scene,
    private readonly arenaWidth: number,
  ) {
    this.graphics = scene.add.graphics().setDepth(10);
    this.titleText = scene.add
      .text(0, 0, "", {
        fontFamily: ARENA_THEME.typography.canvasFontFamily,
        fontSize: "13px",
        color: ARENA_THEME.colors.textStrong,
      })
      .setDepth(11)
      .setOrigin(0.5, 0);
    this.detailText = scene.add
      .text(0, 0, "", {
        fontFamily: ARENA_THEME.typography.canvasFontFamily,
        fontSize: "11px",
        color: ARENA_THEME.colors.textMuted,
        align: "center",
      })
      .setDepth(11)
      .setOrigin(0.5, 0);
    this.setVisible(false);
  }

  render(
    view: TacticalStatusViewModel | null,
    enabled: boolean,
  ): void {
    this.graphics.clear();
    if (!enabled || !view) {
      this.setVisible(false);
      return;
    }

    const bounds = getTacticalStatusDockBounds(this.arenaWidth);
    const height = view.expanded ? EXPANDED_HEIGHT : COMPACT_HEIGHT;
    const colors = getToneColors(view.tone);
    this.graphics.fillStyle(
      ARENA_PHASER_COLORS.overlay,
      getBackgroundAlpha(view.tone),
    );
    this.graphics.fillRoundedRect(
      bounds.x,
      bounds.y,
      bounds.width,
      height,
      ARENA_THEME.radii.badge,
    );
    this.graphics.lineStyle(1, colors.border, colors.borderAlpha);
    this.graphics.strokeRoundedRect(
      bounds.x + 0.5,
      bounds.y + 0.5,
      bounds.width - 1,
      height - 1,
      ARENA_THEME.radii.badge,
    );
    this.graphics.fillStyle(colors.accent, 0.96);
    this.graphics.fillRoundedRect(
      bounds.x + 5,
      bounds.y + 6,
      3,
      height - 12,
      1,
    );

    if (view.remainingRatio !== null) {
      const trackX = bounds.x + 12;
      const trackY = bounds.y + height - 4;
      const trackWidth = bounds.width - 24;
      this.graphics.fillStyle(ARENA_PHASER_COLORS.barTrack, 0.88);
      this.graphics.fillRect(trackX, trackY, trackWidth, 2);
      this.graphics.fillStyle(colors.accent, 0.96);
      this.graphics.fillRect(
        trackX,
        trackY,
        trackWidth * view.remainingRatio,
        2,
      );
    }

    this.titleText
      .setPosition(bounds.x + bounds.width / 2, bounds.y + (view.expanded ? 5 : 8))
      .setColor(colors.title)
      .setWordWrapWidth(bounds.width - 28)
      .setText(view.title)
      .setVisible(true);
    this.detailText
      .setPosition(bounds.x + bounds.width / 2, bounds.y + 26)
      .setWordWrapWidth(bounds.width - 28)
      .setText(view.detail ?? "")
      .setVisible(view.expanded && Boolean(view.detail));
    this.graphics.setVisible(true);
  }

  private setVisible(visible: boolean): void {
    this.graphics.setVisible(visible);
    this.titleText.setVisible(visible);
    this.detailText.setVisible(false);
  }
}

function getToneColors(tone: TacticalStatusTone): {
  accent: number;
  border: number;
  borderAlpha: number;
  title: string;
} {
  if (tone === "danger") {
    return {
      accent: ARENA_PHASER_COLORS.danger,
      border: ARENA_PHASER_COLORS.danger,
      borderAlpha: 0.94,
      title: ARENA_THEME.colors.textStrong,
    };
  }
  if (tone === "warning") {
    return {
      accent: ARENA_PHASER_COLORS.warningBright,
      border: ARENA_PHASER_COLORS.warningBright,
      borderAlpha: 0.9,
      title: ARENA_THEME.colors.warningBright,
    };
  }
  if (tone === "recovery") {
    return {
      accent: ARENA_PHASER_COLORS.success,
      border: ARENA_PHASER_COLORS.success,
      borderAlpha: 0.72,
      title: ARENA_THEME.colors.success,
    };
  }
  return {
    accent: ARENA_PHASER_COLORS.accent,
    border: ARENA_PHASER_COLORS.accent,
    borderAlpha: 0.68,
    title: ARENA_THEME.colors.textStrong,
  };
}

function getBackgroundAlpha(tone: TacticalStatusTone): number {
  if (tone === "danger") return 0.74;
  if (tone === "warning") return 0.68;
  if (tone === "recovery") return 0.56;
  return 0.5;
}
