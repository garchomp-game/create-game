import * as Phaser from "phaser";
import type { MenuAction } from "../../application/ArenaMenuTypes";
import type { ArenaScreenViewModel } from "../../presentation/ArenaScreenPresenter";
import {
  ARENA_PHASER_COLORS as COLOR,
  ARENA_THEME,
} from "../../presentation/ArenaTheme";
import { getMenuButtons, type MenuButton } from "./PhaserMenuLayout";

const UTILITY_ACTIONS = new Set<MenuAction>([
  "ranking",
  "history",
  "settings",
  "betaInfo",
]);

const TITLE_UTILITY_LABELS: Partial<Record<MenuAction, string>> = {
  history: "履歴",
  betaInfo: "情報",
};

export class PhaserTitleScreenView {
  private readonly brandText: Phaser.GameObjects.Text;
  private readonly taglineText: Phaser.GameObjects.Text;
  private readonly releaseText: Phaser.GameObjects.Text;
  private readonly buttonTitleTexts: Phaser.GameObjects.Text[];

  constructor(
    scene: Phaser.Scene,
    private readonly arenaWidth: number,
    private readonly arenaHeight: number,
  ) {
    this.brandText = createText(
      scene,
      arenaWidth / 2,
      106,
      66,
      ARENA_THEME.colors.textStrong,
    )
      .setOrigin(0.5, 0)
      .setFontFamily('Georgia, "Times New Roman", serif')
      .setFontStyle("bold");
    this.taglineText = createText(
      scene,
      arenaWidth / 2,
      205,
      21,
      ARENA_THEME.colors.textSecondary,
    ).setOrigin(0.5);
    this.releaseText = createText(
      scene,
      arenaWidth / 2,
      234,
      15,
      ARENA_THEME.colors.textSubtle,
    ).setOrigin(0.5);
    this.buttonTitleTexts = Array.from({ length: 10 }, () =>
      createText(scene, 0, 0, 22, ARENA_THEME.colors.textStrong).setOrigin(0.5),
    );
  }

  render(
    graphics: Phaser.GameObjects.Graphics,
    screen: ArenaScreenViewModel,
  ): void {
    graphics.fillStyle(COLOR.overlayStrong, 1);
    graphics.fillRect(0, 0, this.arenaWidth, this.arenaHeight);

    const buttons = getMenuButtons(
      "title",
      this.arenaWidth,
      this.arenaHeight,
      screen.menuLabels,
    );
    buttons.forEach((button, index) => {
      this.drawButton(
        graphics,
        button,
        button.action === screen.focusedMenuAction,
      );
      this.renderButtonText(button, index);
    });

    const [tagline = "", release = ""] = (screen.detailText ?? "").split("\n");
    this.brandText
      .setText(toTitleCaseBrand(screen.statusText ?? ""))
      .setVisible(true);
    this.taglineText.setText(tagline).setVisible(true);
    this.releaseText.setText(release).setVisible(true);
  }

  hide(): void {
    this.brandText.setVisible(false);
    this.taglineText.setVisible(false);
    this.releaseText.setVisible(false);
    for (const text of this.buttonTitleTexts) text.setVisible(false);
  }

  private drawButton(
    graphics: Phaser.GameObjects.Graphics,
    button: MenuButton,
    focused: boolean,
  ): void {
    const utility = UTILITY_ACTIONS.has(button.action);
    if (utility) {
      if (focused) {
        graphics.fillStyle(COLOR.surfaceFocused, 0.55);
        graphics.fillRoundedRect(
          button.x,
          button.y,
          button.width,
          button.height,
          ARENA_THEME.radii.control,
        );
      }
      graphics.fillStyle(focused ? COLOR.focus : COLOR.accent, focused ? 1 : 0.62);
      graphics.fillRoundedRect(
        button.x + 12,
        button.y + button.height - 3,
        button.width - 24,
        focused ? 2 : 1,
        1,
      );
      return;
    }

    graphics.fillStyle(focused ? COLOR.surfaceFocused : COLOR.overlay, 0.48);
    graphics.fillRoundedRect(
      button.x,
      button.y,
      button.width,
      button.height,
      ARENA_THEME.radii.control,
    );
    graphics.lineStyle(
      focused ? 3 : 2,
      focused ? COLOR.focus : COLOR.accent,
      1,
    );
    graphics.strokeRoundedRect(
      button.x,
      button.y,
      button.width,
      button.height,
      ARENA_THEME.radii.control,
    );
  }

  private renderButtonText(button: MenuButton, index: number): void {
    const title = this.buttonTitleTexts[index]!;
    const utility = UTILITY_ACTIONS.has(button.action);

    title
      .setColor(
        utility
          ? ARENA_THEME.colors.accent
          : ARENA_THEME.colors.textStrong,
      )
      .setFontSize(utility ? 17 : 25)
      .setPosition(
        button.x + button.width / 2,
        button.y + button.height / 2,
      )
      .setText(TITLE_UTILITY_LABELS[button.action] ?? button.label)
      .setVisible(true);
  }
}

function toTitleCaseBrand(value: string): string {
  return value.toUpperCase() === "ARENA CORE" ? "Arena Core" : value;
}

function createText(
  scene: Phaser.Scene,
  x: number,
  y: number,
  fontSize: number,
  color: string,
): Phaser.GameObjects.Text {
  return scene.add
    .text(x, y, "", {
      fontFamily: ARENA_THEME.typography.canvasFontFamily,
      fontSize: `${fontSize}px`,
      color,
      align: "center",
    })
    .setDepth(21)
    .setVisible(false);
}
