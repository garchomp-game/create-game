import * as Phaser from "phaser";
import type { SimulationConfig, ViewConfig, WorldState } from "../../domain/types";
import type { ArenaScreenViewModel } from "../../presentation/ArenaScreenPresenter";
import { ARENA_PHASER_COLORS as COLOR, ARENA_THEME } from "../../presentation/ArenaTheme";
import { getMenuButtons } from "./PhaserMenuLayout";
import { PhaserHelpOverlay } from "./PhaserHelpOverlay";
import { PhaserPracticeSettingsView } from "./PhaserPracticeSettingsView";
import { PhaserPracticeWeaponPreview } from "./PhaserPracticeWeaponPreview";
import { PhaserTitleScreenView } from "./PhaserTitleScreenView";

export class PhaserArenaScreenView {
  private readonly statusText: Phaser.GameObjects.Text;
  private readonly detailText: Phaser.GameObjects.Text;
  private readonly menuButtonTexts: Phaser.GameObjects.Text[];
  private readonly helpOverlay: PhaserHelpOverlay;
  private readonly practiceSettingsView: PhaserPracticeSettingsView;
  private readonly practiceWeaponPreview: PhaserPracticeWeaponPreview;
  private readonly titleScreenView: PhaserTitleScreenView;

  constructor(
    scene: Phaser.Scene,
    private readonly simulationConfig: SimulationConfig,
    viewConfig: ViewConfig,
  ) {
    this.helpOverlay = new PhaserHelpOverlay(
      scene,
      simulationConfig,
      viewConfig,
    );
    this.practiceSettingsView = new PhaserPracticeSettingsView(
      scene,
      simulationConfig.arena.width,
      simulationConfig.arena.height,
      viewConfig,
    );
    this.practiceWeaponPreview = new PhaserPracticeWeaponPreview(
      scene,
      viewConfig,
    );
    this.titleScreenView = new PhaserTitleScreenView(
      scene,
      simulationConfig.arena.width,
      simulationConfig.arena.height,
    );
    this.statusText = scene.add
      .text(simulationConfig.arena.width / 2, simulationConfig.arena.height / 2, "", {
        fontFamily: ARENA_THEME.typography.canvasFontFamily,
        fontSize: "42px",
        color: ARENA_THEME.colors.text,
        align: "center",
        lineSpacing: 10,
      })
      .setOrigin(0.5)
      .setDepth(20)
      .setVisible(false);

    this.detailText = scene.add
      .text(0, 0, "", {
        fontFamily: ARENA_THEME.typography.canvasFontFamily,
        fontSize: "17px",
        color: ARENA_THEME.colors.textMuted,
        align: "left",
        lineSpacing: 6,
      })
      .setOrigin(0, 0)
      .setDepth(20)
      .setVisible(false);

    this.menuButtonTexts = Array.from({ length: 12 }, () =>
      scene.add
        .text(0, 0, "", {
          fontFamily: ARENA_THEME.typography.canvasFontFamily,
          fontSize: "18px",
          color: ARENA_THEME.colors.text,
          align: "center",
        })
        .setOrigin(0.5)
        .setDepth(21)
        .setVisible(false),
    );
  }

  render(
    graphics: Phaser.GameObjects.Graphics,
    world: WorldState,
    screen: ArenaScreenViewModel,
  ): void {
    const { width, height } = this.simulationConfig.arena;
    this.hideButtonTexts();
    this.statusText.setVisible(false);
    this.detailText.setVisible(false);
    this.helpOverlay.hide();
    this.practiceSettingsView.hide();
    this.practiceWeaponPreview.hide();
    this.titleScreenView.hide();

    if (screen.kind === "help") {
      this.helpOverlay.render(screen.helpPage, screen.focusedMenuAction);
      return;
    }

    if (
      screen.kind === "history" ||
      screen.kind === "ranking" ||
      screen.kind === "settings" ||
      screen.kind === "story" ||
      screen.kind === "practice"
    ) {
      this.drawSecondaryMenu(graphics, world, screen);
      return;
    }
    if (screen.kind === "gameOver") {
      graphics.fillStyle(COLOR.overlay, 0.9);
      graphics.fillRect(0, 0, width, height);
      this.statusText
        .setOrigin(0, 0)
        .setAlign("left")
        .setFontSize(18)
        .setLineSpacing(5)
        .setWordWrapWidth(280)
        .setPosition(40, 34)
        .setText(screen.statusText ?? "")
        .setVisible(true);
      this.detailText
        .setOrigin(0, 0)
        .setAlign("left")
        .setFontSize(14)
        .setLineSpacing(3)
        .setPosition(640, 42)
        .setWordWrapWidth(280)
        .setText(screen.detailText ?? "")
        .setVisible(true);
      this.drawMenuButtons(graphics, world, screen);
      return;
    }
    if (screen.kind === "upgradeSelect") {
      graphics.fillStyle(COLOR.overlay, 0.32);
      graphics.fillRect(0, 0, width, height);
      return;
    }
    if (
      screen.kind === "protocolSelect" ||
      screen.kind === "evolutionSelect"
    ) {
      graphics.fillStyle(0x020617, 0.62);
      graphics.fillRect(0, 0, width, height);
      return;
    }
    if (screen.kind === "contractSelect") {
      graphics.fillStyle(COLOR.overlay, 0.38);
      graphics.fillRect(0, 0, width, height);
      return;
    }
    if (screen.kind === "trainingComplete") {
      graphics.fillStyle(0x020617, 0.92);
      graphics.fillRect(0, 0, width, height);
      this.statusText
        .setOrigin(0.5)
        .setAlign("center")
        .setFontSize(30)
        .setLineSpacing(8)
        .setWordWrapWidth(width - 180)
        .setPosition(width / 2, 218)
        .setText(screen.statusText ?? "")
        .setVisible(true);
      this.drawMenuButtons(graphics, world, screen);
      return;
    }
    if (screen.kind === "paused") {
      graphics.fillStyle(COLOR.overlay, 0.9);
      graphics.fillRect(0, 0, width, height);
      this.statusText
        .setOrigin(0.5)
        .setFontSize(34)
        .setLineSpacing(10)
        .setWordWrapWidth(null)
        .setPosition(width / 2, height / 2 - 74)
        .setText(screen.statusText ?? "")
        .setVisible(true);
      this.detailText
        .setOrigin(0, 0)
        .setAlign("left")
        .setFontSize(16)
        .setPosition(650, 150)
        .setWordWrapWidth(250)
        .setText(screen.detailText ?? "")
        .setVisible(true);
      this.drawMenuButtons(graphics, world, screen);
      return;
    }
    if (screen.kind === "weaponSelect") {
      graphics.fillStyle(COLOR.overlayStrong, 0.55);
      graphics.fillRect(0, 0, width, height);
      return;
    }
    if (screen.kind === "title") {
      this.titleScreenView.render(graphics, screen);
    }
  }

  private drawSecondaryMenu(
    graphics: Phaser.GameObjects.Graphics,
    world: WorldState,
    screen: ArenaScreenViewModel,
  ): void {
    const { width, height } = this.simulationConfig.arena;
    graphics.fillStyle(COLOR.overlayStrong, 0.96);
    graphics.fillRect(0, 0, width, height);

    if (screen.secondaryMenu === "practiceSettings") {
      this.practiceSettingsView.render(graphics, screen);
      return;
    }

    if (screen.kind === "history") {
      this.statusText
        .setOrigin(0, 0)
        .setAlign("left")
        .setFontSize(17)
        .setLineSpacing(6)
        .setWordWrapWidth(width - 128)
        .setPosition(64, 32)
        .setText(screen.statusText ?? "")
        .setVisible(true);
    } else if (screen.kind === "ranking") {
      this.statusText
        .setOrigin(0, 0)
        .setAlign("left")
        .setFontSize(17)
        .setLineSpacing(6)
        .setWordWrapWidth(width - 128)
        .setPosition(64, 32)
        .setText(screen.statusText ?? "")
        .setVisible(true);
    } else {
      this.statusText
        .setOrigin(0.5, 0)
        .setAlign("center")
        .setFontSize(28)
        .setLineSpacing(5)
        .setWordWrapWidth(width - 120)
        .setPosition(width / 2, 34)
        .setText(screen.statusText ?? "")
        .setVisible(true);
    }

    if (screen.secondaryMenu === "practice") {
      this.practiceWeaponPreview.render(graphics);
    }
    this.drawMenuButtons(graphics, world, screen);
  }

  private drawMenuButtons(
    graphics: Phaser.GameObjects.Graphics,
    world: WorldState,
    screen: ArenaScreenViewModel,
  ): void {
    const { width, height } = this.simulationConfig.arena;
    const buttons = getMenuButtons(
      world.state.status,
      width,
      height,
      screen.menuLabels,
      screen.secondaryMenu,
    );
    buttons.forEach((button, index) => {
      this.drawButton(
        graphics,
        button.x,
        button.y,
        button.width,
        button.height,
        button.action === screen.focusedMenuAction,
      );
      const text = this.menuButtonTexts[index]!;
      const isPracticeWeapon =
        screen.secondaryMenu === "practice" &&
        (button.action === "practiceStartPulse" ||
          button.action === "practiceStartSpread");
      const isPracticeBack =
        screen.secondaryMenu === "practice" && button.action === "back";
      text
        .setFontSize(isPracticeWeapon ? 22 : isPracticeBack ? 15 : 18)
        .setText(button.label)
        .setPosition(button.x + button.width / 2, button.y + button.height / 2)
        .setVisible(true);
    });
  }

  private drawButton(
    graphics: Phaser.GameObjects.Graphics,
    x: number,
    y: number,
    width: number,
    height: number,
    focused = false,
  ): void {
    graphics.fillStyle(focused ? COLOR.surfaceFocused : COLOR.surface, 0.96);
    graphics.fillRoundedRect(x, y, width, height, ARENA_THEME.radii.control);
    graphics.lineStyle(focused ? 3 : 2, focused ? COLOR.focus : COLOR.accent, 0.95);
    graphics.strokeRoundedRect(x, y, width, height, ARENA_THEME.radii.control);
  }

  private hideButtonTexts(): void {
    for (const text of this.menuButtonTexts) {
      text.setVisible(false);
    }
  }
}
