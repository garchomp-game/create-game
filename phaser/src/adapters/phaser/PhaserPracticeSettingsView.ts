import * as Phaser from "phaser";
import type { MenuAction } from "../../application/ArenaMenuTypes";
import type { EnemyTypeId, ViewConfig } from "../../domain/types";
import type { ArenaScreenViewModel } from "../../presentation/ArenaScreenPresenter";
import {
  ARENA_PHASER_COLORS as COLOR,
  ARENA_THEME,
} from "../../presentation/ArenaTheme";
import { getMenuButtons, type MenuButton } from "./PhaserMenuLayout";
import { drawEnemyIcon } from "./PhaserEnemyIcon";

const TEXT_DEPTH = 21;
const VALUE_X_OFFSET = 136;
const VALUE_WIDTH = 128;

export class PhaserPracticeSettingsView {
  private readonly texts: Phaser.GameObjects.Text[];
  private textIndex = 0;

  constructor(
    scene: Phaser.Scene,
    private readonly arenaWidth: number,
    private readonly arenaHeight: number,
    private readonly viewConfig: ViewConfig,
  ) {
    this.texts = Array.from({ length: 20 }, () =>
      scene.add
        .text(0, 0, "", {
          fontFamily: ARENA_THEME.typography.canvasFontFamily,
          fontSize: "16px",
          color: ARENA_THEME.colors.text,
        })
        .setDepth(TEXT_DEPTH)
        .setVisible(false),
    );
  }

  hide(): void {
    this.textIndex = 0;
    for (const text of this.texts) text.setVisible(false);
  }

  render(
    graphics: Phaser.GameObjects.Graphics,
    screen: ArenaScreenViewModel,
  ): void {
    const settings = screen.practiceSettings;
    if (!settings) return;

    this.showText(settings.heading, this.arenaWidth / 2, 42, {
      fontSize: 20,
      color: ARENA_THEME.colors.textSecondary,
      originX: 0.5,
    });
    if (settings.notice) {
      this.showText(settings.notice, this.arenaWidth / 2, 73, {
        fontSize: 13,
        color: ARENA_THEME.colors.warningBright,
        originX: 0.5,
      });
    }

    this.drawSelector(
      graphics,
      screen,
      settings.invincibleLabel,
      settings.invincibleValue,
      112,
      "practiceInvinciblePrevious",
      "practiceInvincibleNext",
    );
    this.drawSelector(
      graphics,
      screen,
      settings.intensityLabel,
      settings.intensityValue,
      174,
      "practiceIntensityPrevious",
      "practiceIntensityNext",
    );

    this.showText(settings.enemiesHeading, this.arenaWidth / 2 - 260, 248, {
      fontSize: 15,
      color: ARENA_THEME.colors.textSubtle,
    });
    graphics.lineStyle(1, COLOR.borderSubtle, 0.9);
    graphics.lineBetween(
      this.arenaWidth / 2 - 260,
      271,
      this.arenaWidth / 2 + 260,
      271,
    );

    for (const enemy of settings.enemies) {
      const button = this.findButton(screen, enemy.action);
      if (!button) continue;
      this.drawCheckbox(
        graphics,
        button,
        enemy.typeId,
        enemy.label,
        enemy.enabled,
        screen.focusedMenuAction === enemy.action,
      );
    }

    const back = this.findButton(screen, "back");
    if (back) {
      this.drawConventionalButton(
        graphics,
        back,
        screen.focusedMenuAction === "back",
      );
      this.showText(
        back.label,
        back.x + back.width / 2,
        back.y + back.height / 2,
        {
          fontSize: 15,
          originX: 0.5,
          originY: 0.5,
        },
      );
    }
  }

  private drawSelector(
    graphics: Phaser.GameObjects.Graphics,
    screen: ArenaScreenViewModel,
    label: string,
    value: string,
    y: number,
    previousAction: MenuAction,
    nextAction: MenuAction,
  ): void {
    const labelX = this.arenaWidth / 2 - 260;
    const valueX = this.arenaWidth / 2 + VALUE_X_OFFSET;
    this.showText(label, labelX, y + 20, {
      fontSize: 17,
      color: ARENA_THEME.colors.textSecondary,
      originY: 0.5,
    });

    graphics.fillStyle(COLOR.barTrack, 0.92);
    graphics.fillRoundedRect(valueX, y, VALUE_WIDTH, 40, ARENA_THEME.radii.control);
    graphics.lineStyle(1, COLOR.borderSubtle, 0.95);
    graphics.strokeRoundedRect(
      valueX,
      y,
      VALUE_WIDTH,
      40,
      ARENA_THEME.radii.control,
    );
    this.showText(value, valueX + VALUE_WIDTH / 2, y + 20, {
      fontSize: 16,
      color: ARENA_THEME.colors.textStrong,
      originX: 0.5,
      originY: 0.5,
    });

    for (const action of [previousAction, nextAction]) {
      const button = this.findButton(screen, action);
      if (!button) continue;
      this.drawArrowButton(
        graphics,
        button,
        screen.focusedMenuAction === action,
      );
      this.showText(
        button.label,
        button.x + button.width / 2,
        button.y + button.height / 2,
        {
          fontSize: 17,
          color: ARENA_THEME.colors.accentBright,
          originX: 0.5,
          originY: 0.5,
        },
      );
    }
  }

  private drawArrowButton(
    graphics: Phaser.GameObjects.Graphics,
    button: MenuButton,
    focused: boolean,
  ): void {
    graphics.fillStyle(focused ? COLOR.surfaceFocused : COLOR.surface, 0.72);
    graphics.fillRoundedRect(
      button.x,
      button.y,
      button.width,
      button.height,
      ARENA_THEME.radii.control,
    );
    graphics.lineStyle(
      focused ? 2 : 1,
      focused ? COLOR.focus : COLOR.accent,
      0.95,
    );
    graphics.strokeRoundedRect(
      button.x,
      button.y,
      button.width,
      button.height,
      ARENA_THEME.radii.control,
    );
  }

  private drawCheckbox(
    graphics: Phaser.GameObjects.Graphics,
    button: MenuButton,
    enemyTypeId: EnemyTypeId,
    label: string,
    enabled: boolean,
    focused: boolean,
  ): void {
    if (focused) {
      graphics.fillStyle(COLOR.surfaceFocused, 0.28);
      graphics.fillRoundedRect(
        button.x,
        button.y,
        button.width,
        button.height,
        ARENA_THEME.radii.control,
      );
    }

    const checkboxX = button.x + 6;
    const checkboxY = button.y + 6;
    graphics.fillStyle(enabled ? COLOR.accent : COLOR.barTrack, enabled ? 0.9 : 0.8);
    graphics.fillRoundedRect(checkboxX, checkboxY, 28, 28, 4);
    graphics.lineStyle(
      focused ? 2 : 1,
      focused ? COLOR.focus : enabled ? COLOR.accentBright : COLOR.border,
      0.95,
    );
    graphics.strokeRoundedRect(checkboxX, checkboxY, 28, 28, 4);
    if (enabled) {
      this.showText("✓", checkboxX + 14, checkboxY + 14, {
        fontSize: 17,
        color: ARENA_THEME.colors.overlayStrong,
        originX: 0.5,
        originY: 0.5,
      });
    }
    const radius =
      enemyTypeId === "brute" ? 12 : enemyTypeId === "fast" ? 9 : 10;
    drawEnemyIcon(
      graphics,
      button.x + 58,
      button.y + 20,
      radius,
      this.viewConfig.enemy[enemyTypeId],
    );
    this.showText(label, button.x + 82, button.y + 20, {
      fontSize: 16,
      color: enabled
        ? ARENA_THEME.colors.textStrong
        : ARENA_THEME.colors.textMuted,
      originY: 0.5,
    });
  }

  private drawConventionalButton(
    graphics: Phaser.GameObjects.Graphics,
    button: MenuButton,
    focused: boolean,
  ): void {
    graphics.fillStyle(focused ? COLOR.surfaceFocused : COLOR.surface, 0.9);
    graphics.fillRoundedRect(
      button.x,
      button.y,
      button.width,
      button.height,
      ARENA_THEME.radii.control,
    );
    graphics.lineStyle(
      focused ? 2 : 1,
      focused ? COLOR.focus : COLOR.border,
      0.95,
    );
    graphics.strokeRoundedRect(
      button.x,
      button.y,
      button.width,
      button.height,
      ARENA_THEME.radii.control,
    );
  }

  private findButton(
    screen: ArenaScreenViewModel,
    action: MenuAction,
  ): MenuButton | undefined {
    return getMenuButtons(
      screen.status,
      this.arenaWidth,
      this.arenaHeight,
      screen.menuLabels,
      screen.secondaryMenu,
    ).find((button) => button.action === action);
  }

  private showText(
    value: string,
    x: number,
    y: number,
    style: {
      fontSize: number;
      color?: string;
      originX?: number;
      originY?: number;
    },
  ): void {
    const text = this.texts[this.textIndex++];
    if (!text) return;
    text
      .setText(value)
      .setPosition(x, y)
      .setFontSize(style.fontSize)
      .setColor(style.color ?? ARENA_THEME.colors.text)
      .setOrigin(style.originX ?? 0, style.originY ?? 0)
      .setVisible(true);
  }
}
