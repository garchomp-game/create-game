import * as Phaser from "phaser";
import type { MenuAction } from "../../application/ArenaMenuTypes";
import type {
  ArenaScreenViewModel,
  SettingsScreenViewModel,
} from "../../presentation/ArenaScreenPresenter";
import {
  ARENA_PHASER_COLORS as COLOR,
  ARENA_THEME,
} from "../../presentation/ArenaTheme";
import {
  getMenuButtons,
  getSettingsStepperButtons,
  type MenuButton,
} from "./PhaserMenuLayout";

const TEXT_DEPTH = 21;
const GROUP_HEADING_Y = [92, 214, 288] as const;

export class PhaserSettingsView {
  private readonly texts: Phaser.GameObjects.Text[];
  private textIndex = 0;

  constructor(
    scene: Phaser.Scene,
    private readonly arenaWidth: number,
    private readonly arenaHeight: number,
  ) {
    this.texts = Array.from({ length: 32 }, () =>
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
    const panel = screen.settingsPanel;
    if (!panel) return;

    this.showText(panel.heading, this.arenaWidth / 2, 30, {
      fontSize: 28,
      color: ARENA_THEME.colors.textStrong,
      originX: 0.5,
    });
    this.showText(
      panel.notice ?? "変更内容は自動で保存されます",
      this.arenaWidth / 2,
      67,
      {
        fontSize: 13,
        color: panel.notice
          ? ARENA_THEME.colors.warningBright
          : ARENA_THEME.colors.textSubtle,
        originX: 0.5,
      },
    );

    panel.groups.forEach((group, groupIndex) => {
      this.drawGroup(graphics, screen, group, groupIndex);
    });

    graphics.lineStyle(1, COLOR.borderSubtle, 0.8);
    graphics.lineBetween(
      this.arenaWidth / 2 - 310,
      414,
      this.arenaWidth / 2 + 310,
      414,
    );
    this.showText("データ管理", this.arenaWidth / 2 - 310, 420, {
      fontSize: 13,
      color: ARENA_THEME.colors.textSubtle,
    });

    for (const action of ["resetSettings", "resetProfile"] as const) {
      const button = this.findButton(screen, action);
      if (!button) continue;
      this.drawCommandButton(
        graphics,
        button,
        screen.focusedMenuAction === action,
        action,
      );
      this.showText(
        button.label,
        button.x + button.width / 2,
        button.y + button.height / 2,
        {
          fontSize: action === "resetProfile" ? 14 : 15,
          color:
            action === "resetProfile"
              ? ARENA_THEME.colors.danger
              : ARENA_THEME.colors.text,
          originX: 0.5,
          originY: 0.5,
        },
      );
    }

    const back = this.findButton(screen, "back");
    if (back) {
      this.drawCommandButton(
        graphics,
        back,
        screen.focusedMenuAction === "back",
        "back",
      );
      this.showText(
        `←  ${back.label}`,
        back.x + back.width / 2,
        back.y + back.height / 2,
        {
          fontSize: 14,
          originX: 0.5,
          originY: 0.5,
        },
      );
    }
  }

  private drawGroup(
    graphics: Phaser.GameObjects.Graphics,
    screen: ArenaScreenViewModel,
    group: SettingsScreenViewModel["groups"][number],
    groupIndex: number,
  ): void {
    const headingY = GROUP_HEADING_Y[groupIndex];
    if (headingY === undefined) return;

    this.showText(group.heading, this.arenaWidth / 2 - 310, headingY, {
      fontSize: 13,
      color: ARENA_THEME.colors.textSubtle,
    });
    for (const row of group.rows) {
      const button = this.findButton(screen, row.action);
      if (!button) continue;
      this.drawSettingRow(
        graphics,
        button,
        row,
        screen.focusedMenuAction === row.action,
      );
    }
  }

  private drawSettingRow(
    graphics: Phaser.GameObjects.Graphics,
    button: MenuButton,
    row: SettingsScreenViewModel["groups"][number]["rows"][number],
    focused: boolean,
  ): void {
    graphics.fillStyle(
      focused ? COLOR.surfaceFocused : COLOR.surface,
      focused ? 0.64 : 0.5,
    );
    graphics.fillRoundedRect(
      button.x,
      button.y,
      button.width,
      button.height,
      ARENA_THEME.radii.control,
    );
    graphics.lineStyle(
      focused ? 2 : 1,
      focused ? COLOR.focus : COLOR.borderSubtle,
      focused ? 1 : 0.85,
    );
    graphics.strokeRoundedRect(
      button.x,
      button.y,
      button.width,
      button.height,
      ARENA_THEME.radii.control,
    );

    this.showText(row.label, button.x + 18, button.y + button.height / 2, {
      fontSize: 16,
      color: ARENA_THEME.colors.textSecondary,
      originY: 0.5,
    });

    if (row.control === "stepper" && row.decreaseAction !== null) {
      this.drawStepperControl(
        graphics,
        button,
        row.value,
        row.decreaseAction,
        row.action,
      );
      return;
    }
    if (row.control === "toggle" && row.enabled !== null) {
      this.drawToggleControl(graphics, button, row.value, row.enabled);
    }
  }

  private drawStepperControl(
    graphics: Phaser.GameObjects.Graphics,
    button: MenuButton,
    value: string,
    decreaseAction: MenuAction,
    increaseAction: MenuAction,
  ): void {
    const controls = getSettingsStepperButtons(this.arenaWidth);
    for (const action of [decreaseAction, increaseAction]) {
      const control = controls.find((candidate) => candidate.action === action);
      if (!control) continue;
      graphics.fillStyle(COLOR.barTrack, 0.95);
      graphics.fillRoundedRect(
        control.x,
        control.y,
        control.width,
        control.height,
        ARENA_THEME.radii.control,
      );
      graphics.lineStyle(1, COLOR.accent, 0.9);
      graphics.strokeRoundedRect(
        control.x,
        control.y,
        control.width,
        control.height,
        ARENA_THEME.radii.control,
      );
      this.showText(
        action === decreaseAction ? "−" : "＋",
        control.x + control.width / 2,
        control.y + control.height / 2,
        {
          fontSize: 18,
          color: ARENA_THEME.colors.accentBright,
          originX: 0.5,
          originY: 0.5,
        },
      );
    }
    this.showText(value, button.x + button.width - 96, button.y + 20, {
      fontSize: 15,
      color: ARENA_THEME.colors.textStrong,
      originX: 0.5,
      originY: 0.5,
    });
  }

  private drawToggleControl(
    graphics: Phaser.GameObjects.Graphics,
    button: MenuButton,
    value: string,
    enabled: boolean,
  ): void {
    const switchX = button.x + button.width - 72;
    const switchY = button.y + 10;
    this.showText(value, switchX - 18, button.y + 20, {
      fontSize: 15,
      color: enabled
        ? ARENA_THEME.colors.accentBright
        : ARENA_THEME.colors.textMuted,
      originX: 1,
      originY: 0.5,
    });
    graphics.fillStyle(enabled ? COLOR.accent : COLOR.barTrack, enabled ? 0.9 : 1);
    graphics.fillRoundedRect(switchX, switchY, 48, 20, 10);
    graphics.lineStyle(1, enabled ? COLOR.accentBright : COLOR.border, 0.95);
    graphics.strokeRoundedRect(switchX, switchY, 48, 20, 10);
    graphics.fillStyle(enabled ? COLOR.textStrong : COLOR.textMuted, 1);
    graphics.fillCircle(enabled ? switchX + 37 : switchX + 11, switchY + 10, 7);
  }

  private drawCommandButton(
    graphics: Phaser.GameObjects.Graphics,
    button: MenuButton,
    focused: boolean,
    action: MenuAction,
  ): void {
    const danger = action === "resetProfile";
    graphics.fillStyle(
      focused ? COLOR.surfaceFocused : COLOR.surface,
      danger ? 0.45 : 0.72,
    );
    graphics.fillRoundedRect(
      button.x,
      button.y,
      button.width,
      button.height,
      ARENA_THEME.radii.control,
    );
    graphics.lineStyle(
      focused ? 2 : 1,
      focused ? COLOR.focus : danger ? COLOR.danger : COLOR.border,
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
