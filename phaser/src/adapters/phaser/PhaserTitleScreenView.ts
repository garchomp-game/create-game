import * as Phaser from "phaser";
import type { MenuAction } from "../../application/ArenaMenuTypes";
import type { ArenaScreenViewModel } from "../../presentation/ArenaScreenPresenter";
import {
  ARENA_PHASER_COLORS as COLOR,
  ARENA_THEME,
} from "../../presentation/ArenaTheme";
import { getMenuButtons, type MenuButton } from "./PhaserMenuLayout";

const MODE_DESCRIPTIONS: Partial<Record<MenuAction, string>> = {
  story: "物語に沿って操作と戦闘を習得",
  start: "生存時間とスコアの限界へ",
  startExpedition: "敵中枢を撃破する決戦モード",
  startTraining: "初回推奨：基本操作を順番に練習",
  practice: "敵・無敵・出現量を選んで試す",
};

const UTILITY_ACTIONS = new Set<MenuAction>([
  "ranking",
  "history",
  "help",
  "settings",
  "betaInfo",
]);

export class PhaserTitleScreenView {
  private readonly brandText: Phaser.GameObjects.Text;
  private readonly taglineText: Phaser.GameObjects.Text;
  private readonly releaseText: Phaser.GameObjects.Text;
  private readonly modeHeadingText: Phaser.GameObjects.Text;
  private readonly utilityHeadingText: Phaser.GameObjects.Text;
  private readonly buttonTitleTexts: Phaser.GameObjects.Text[];
  private readonly buttonDescriptionTexts: Phaser.GameObjects.Text[];

  constructor(
    scene: Phaser.Scene,
    private readonly arenaWidth: number,
    private readonly arenaHeight: number,
  ) {
    this.brandText = createText(scene, 56, 28, 42, ARENA_THEME.colors.textStrong)
      .setOrigin(0, 0);
    this.taglineText = createText(
      scene,
      58,
      82,
      16,
      ARENA_THEME.colors.textSecondary,
    ).setOrigin(0, 0);
    this.releaseText = createText(
      scene,
      arenaWidth - 56,
      45,
      13,
      ARENA_THEME.colors.textSubtle,
    ).setOrigin(1, 0.5);
    this.modeHeadingText = createText(
      scene,
      88,
      126,
      12,
      ARENA_THEME.colors.accentBright,
    ).setOrigin(0, 0);
    this.utilityHeadingText = createText(
      scene,
      88,
      340,
      12,
      ARENA_THEME.colors.textSubtle,
    ).setOrigin(0, 0);
    this.buttonTitleTexts = Array.from({ length: 10 }, () =>
      createText(scene, 0, 0, 19, ARENA_THEME.colors.textStrong).setOrigin(0.5),
    );
    this.buttonDescriptionTexts = Array.from({ length: 10 }, () =>
      createText(scene, 0, 0, 13, ARENA_THEME.colors.textSubtitle).setOrigin(0.5),
    );
  }

  render(
    graphics: Phaser.GameObjects.Graphics,
    screen: ArenaScreenViewModel,
  ): void {
    graphics.fillStyle(COLOR.overlayStrong, 0.83);
    graphics.fillRect(0, 0, this.arenaWidth, this.arenaHeight);
    this.drawArenaSignal(graphics);
    this.drawHeader(graphics);

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
    this.brandText.setText(screen.statusText ?? "").setVisible(true);
    this.taglineText.setText(tagline).setVisible(true);
    this.releaseText.setText(release).setVisible(true);
    this.modeHeadingText.setText("モードを選択").setVisible(true);
    this.utilityHeadingText.setText("記録と設定").setVisible(true);
  }

  hide(): void {
    this.brandText.setVisible(false);
    this.taglineText.setVisible(false);
    this.releaseText.setVisible(false);
    this.modeHeadingText.setVisible(false);
    this.utilityHeadingText.setVisible(false);
    for (const text of this.buttonTitleTexts) text.setVisible(false);
    for (const text of this.buttonDescriptionTexts) text.setVisible(false);
  }

  private drawHeader(graphics: Phaser.GameObjects.Graphics): void {
    graphics.fillStyle(COLOR.accent, 0.95);
    graphics.fillRect(56, 112, 112, 3);
    graphics.fillStyle(COLOR.borderSubtle, 0.72);
    graphics.fillRect(168, 113, this.arenaWidth - 224, 1);
  }

  private drawArenaSignal(graphics: Phaser.GameObjects.Graphics): void {
    const x = this.arenaWidth * 0.74;
    const y = 225;
    graphics.lineStyle(1, COLOR.accent, 0.08);
    graphics.strokeCircle(x, y, 88);
    graphics.strokeCircle(x, y, 148);
    graphics.strokeCircle(x, y, 215);
    graphics.lineBetween(x - 240, y, x + 240, y);
    graphics.lineBetween(x, y - 190, x, y + 190);
    graphics.fillStyle(COLOR.accentBright, 0.09);
    graphics.fillCircle(x, y, 11);
  }

  private drawButton(
    graphics: Phaser.GameObjects.Graphics,
    button: MenuButton,
    focused: boolean,
  ): void {
    const utility = UTILITY_ACTIONS.has(button.action);
    const primary =
      button.action === "story";
    const accent =
      button.action === "story"
        ? COLOR.accentBright
        : button.action === "startExpedition"
        ? COLOR.danger
        : button.action === "start"
          ? COLOR.accentBright
          : COLOR.accent;

    graphics.fillStyle(
      focused ? COLOR.surfaceFocused : utility ? COLOR.overlay : COLOR.surface,
      utility ? 0.9 : 0.96,
    );
    graphics.fillRoundedRect(
      button.x,
      button.y,
      button.width,
      button.height,
      ARENA_THEME.radii.control,
    );
    graphics.lineStyle(
      focused ? 3 : primary ? 2 : 1.5,
      focused ? COLOR.focus : utility ? COLOR.border : accent,
      focused ? 1 : 0.9,
    );
    graphics.strokeRoundedRect(
      button.x,
      button.y,
      button.width,
      button.height,
      ARENA_THEME.radii.control,
    );

    if (primary) {
      graphics.fillStyle(accent, focused ? 1 : 0.86);
      graphics.fillRoundedRect(
        button.x,
        button.y,
        6,
        button.height,
        ARENA_THEME.radii.control,
      );
    }
  }

  private renderButtonText(button: MenuButton, index: number): void {
    const title = this.buttonTitleTexts[index]!;
    const description = this.buttonDescriptionTexts[index]!;
    const utility = UTILITY_ACTIONS.has(button.action);
    const primary =
      button.action === "story";
    const detail = MODE_DESCRIPTIONS[button.action] ?? "";

    title
      .setFontSize(utility ? 15 : primary ? 21 : 18)
      .setPosition(
        button.x + button.width / 2,
        button.y + (utility ? button.height / 2 : primary ? 29 : 24),
      )
      .setText(button.label)
      .setVisible(true);

    description
      .setPosition(
        button.x + button.width / 2,
        button.y + (primary ? 57 : 47),
      )
      .setText(detail)
      .setVisible(!utility && detail.length > 0);
  }
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
