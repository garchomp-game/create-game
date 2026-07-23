import * as Phaser from "phaser";
import type { SimulationConfig, WorldState } from "../../domain/types";
import type { ArenaScreenViewModel } from "../../presentation/ArenaScreenPresenter";
import { getMenuButtons } from "./PhaserMenuLayout";

export class PhaserArenaScreenView {
  private readonly statusText: Phaser.GameObjects.Text;
  private readonly detailText: Phaser.GameObjects.Text;
  private readonly menuButtonTexts: Phaser.GameObjects.Text[];

  constructor(
    scene: Phaser.Scene,
    private readonly simulationConfig: SimulationConfig,
  ) {
    this.statusText = scene.add
      .text(simulationConfig.arena.width / 2, simulationConfig.arena.height / 2, "", {
        fontFamily: "Arial, sans-serif",
        fontSize: "42px",
        color: "#f8fafc",
        align: "center",
        lineSpacing: 10,
      })
      .setOrigin(0.5)
      .setDepth(20)
      .setVisible(false);

    this.detailText = scene.add
      .text(0, 0, "", {
        fontFamily: "Arial, sans-serif",
        fontSize: "17px",
        color: "#cbd5e1",
        align: "left",
        lineSpacing: 6,
      })
      .setOrigin(0, 0)
      .setDepth(20)
      .setVisible(false);

    this.menuButtonTexts = Array.from({ length: 8 }, () =>
      scene.add
        .text(0, 0, "", {
          fontFamily: "Arial, sans-serif",
          fontSize: "18px",
          color: "#f8fafc",
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

    if (
      screen.kind === "history" ||
      screen.kind === "ranking" ||
      screen.kind === "settings"
    ) {
      this.drawSecondaryMenu(graphics, world, screen);
      return;
    }
    if (screen.kind === "gameOver") {
      graphics.fillStyle(0x020617, 0.9);
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
      graphics.fillStyle(0x020617, 0.9);
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
      graphics.fillStyle(0x020617, 0.94);
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
      graphics.fillStyle(0x020617, 0.9);
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
      graphics.fillStyle(0x05070d, 0.94);
      graphics.fillRect(0, 0, width, height);
      return;
    }
    if (screen.kind === "title") {
      graphics.fillStyle(0x05070d, 0.86);
      graphics.fillRect(0, 0, width, height);
      this.statusText
        .setOrigin(0.5)
        .setAlign("center")
        .setFontSize(32)
        .setLineSpacing(4)
        .setWordWrapWidth(width - 160)
        .setPosition(width / 2, 116)
        .setText(screen.statusText ?? "")
        .setVisible(true);
      this.drawMenuButtons(graphics, world, screen);
    }
  }

  private drawSecondaryMenu(
    graphics: Phaser.GameObjects.Graphics,
    world: WorldState,
    screen: ArenaScreenViewModel,
  ): void {
    const { width, height } = this.simulationConfig.arena;
    graphics.fillStyle(0x05070d, 0.96);
    graphics.fillRect(0, 0, width, height);

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
      text
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
    graphics.fillStyle(focused ? 0x164e63 : 0x1f2937, 0.96);
    graphics.fillRoundedRect(x, y, width, height, 6);
    graphics.lineStyle(focused ? 3 : 2, focused ? 0xfacc15 : 0x38bdf8, 0.95);
    graphics.strokeRoundedRect(x, y, width, height, 6);
  }

  private hideButtonTexts(): void {
    for (const text of this.menuButtonTexts) {
      text.setVisible(false);
    }
  }
}
