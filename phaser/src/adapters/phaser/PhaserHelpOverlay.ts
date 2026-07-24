import * as Phaser from "phaser";
import type {
  HelpPage,
  MenuAction,
} from "../../application/ArenaMenuTypes";
import type { SimulationConfig, ViewConfig } from "../../domain/types";
import {
  ARENA_PHASER_COLORS as COLOR,
  ARENA_THEME,
} from "../../presentation/ArenaTheme";
import {
  HELP_OVERLAY_GRAPHICS_DEPTH,
  HELP_OVERLAY_TEXT_DEPTH,
} from "./PhaserArenaDepths";
import { drawEnemyIcon } from "./PhaserEnemyIcon";
import {
  getHelpCloseButtonBounds,
  getHelpTabButtonBounds,
} from "./PhaserHelpLayout";
import { drawRecoveryKitIcon } from "./PhaserRecoveryKitIcon";

type HelpTextSpec = {
  text: string;
  x: number;
  y: number;
  size: number;
  color?: string;
  originX?: number;
  originY?: number;
  weight?: "normal" | "bold";
};

export class PhaserHelpOverlay {
  private readonly graphics: Phaser.GameObjects.Graphics;
  private readonly commonTexts: Phaser.GameObjects.Text[];
  private readonly tabTexts: Phaser.GameObjects.Text[];
  private readonly pageTexts: Record<HelpPage, Phaser.GameObjects.Text[]>;

  constructor(
    scene: Phaser.Scene,
    private readonly simulationConfig: SimulationConfig,
    private readonly viewConfig: ViewConfig,
  ) {
    this.graphics = scene.add
      .graphics()
      .setDepth(HELP_OVERLAY_GRAPHICS_DEPTH)
      .setVisible(false);
    this.commonTexts = this.createTexts(scene, createCommonTextSpecs(simulationConfig));
    this.tabTexts = this.createTexts(scene, createTabTextSpecs(simulationConfig));
    this.pageTexts = {
      controls: this.createTexts(scene, createControlsTextSpecs()),
      enemies: this.createTexts(scene, createEnemiesTextSpecs()),
      field: this.createTexts(scene, createFieldTextSpecs()),
    };
  }

  hide(): void {
    this.graphics.clear().setVisible(false);
    for (const text of this.allTexts()) text.setVisible(false);
  }

  render(page: HelpPage, focusedAction: MenuAction | null): void {
    const { width, height } = this.simulationConfig.arena;
    const graphics = this.graphics;
    graphics.clear().setVisible(true);
    for (const text of this.commonTexts) text.setVisible(true);
    for (const text of this.tabTexts) text.setVisible(true);
    for (const text of this.pageTexts[page]) text.setVisible(true);

    graphics.fillStyle(COLOR.overlayStrong, 1);
    graphics.fillRect(0, 0, width, height);
    graphics.lineStyle(2, COLOR.borderStrong, 0.95);
    graphics.strokeRoundedRect(18, 18, width - 36, height - 36, 7);
    graphics.lineStyle(1, COLOR.borderSubtle, 0.9);
    graphics.lineBetween(48, 82, width - 48, 82);
    graphics.lineBetween(48, 144, width - 48, 144);

    this.drawTabs(graphics, page, focusedAction);
    if (page === "controls") this.drawControls(graphics);
    else if (page === "enemies") this.drawEnemies(graphics);
    else this.drawField(graphics);
    this.drawCloseButton(graphics, focusedAction === "back");
  }

  private drawTabs(
    graphics: Phaser.GameObjects.Graphics,
    page: HelpPage,
    focusedAction: MenuAction | null,
  ): void {
    for (const tab of getHelpTabButtonBounds(this.simulationConfig.arena.width)) {
      const active = tab.page === page;
      const focused = tab.action === focusedAction;
      graphics.fillStyle(
        active || focused ? COLOR.surfaceFocused : COLOR.surface,
        active ? 0.96 : 0.72,
      );
      graphics.fillRoundedRect(tab.x, tab.y, tab.width, tab.height, 4);
      graphics.lineStyle(
        focused ? 3 : active ? 2 : 1,
        focused ? COLOR.focus : active ? COLOR.accentBright : COLOR.border,
        0.96,
      );
      graphics.strokeRoundedRect(tab.x, tab.y, tab.width, tab.height, 4);
      if (active) {
        graphics.fillStyle(COLOR.accentBright, 1);
        graphics.fillRect(tab.x + 18, tab.y + tab.height - 3, tab.width - 36, 3);
      }
    }
  }

  private drawControls(graphics: Phaser.GameObjects.Graphics): void {
    graphics.lineStyle(1, COLOR.borderSubtle, 0.72);
    graphics.lineBetween(480, 164, 480, 352);

    const keys = [
      { x: 205, y: 174 },
      { x: 158, y: 218 },
      { x: 205, y: 218 },
      { x: 252, y: 218 },
    ];
    for (const key of keys) {
      graphics.fillStyle(COLOR.surface, 0.98);
      graphics.fillRoundedRect(key.x, key.y, 42, 38, 5);
      graphics.lineStyle(2, COLOR.accent, 0.95);
      graphics.strokeRoundedRect(key.x, key.y, 42, 38, 5);
    }

    graphics.fillStyle(COLOR.surface, 0.98);
    graphics.fillRoundedRect(590, 172, 70, 96, 24);
    graphics.lineStyle(2, COLOR.line, 0.95);
    graphics.strokeRoundedRect(590, 172, 70, 96, 24);
    graphics.lineBetween(625, 172, 625, 209);
    graphics.lineBetween(590, 209, 660, 209);
    graphics.lineStyle(2, COLOR.focus, 0.95);
    graphics.strokeCircle(625, 225, 10);
    graphics.lineBetween(625, 209, 625, 241);
    graphics.lineBetween(609, 225, 641, 225);

    graphics.lineStyle(1, COLOR.borderSubtle, 0.72);
    graphics.lineBetween(48, 370, 912, 370);
    graphics.lineBetween(336, 388, 336, 450);
    graphics.lineBetween(624, 388, 624, 450);
  }

  private drawEnemies(graphics: Phaser.GameObjects.Graphics): void {
    graphics.lineStyle(1, COLOR.borderSubtle, 0.68);
    graphics.lineBetween(480, 166, 480, 385);
    graphics.lineBetween(56, 275, 904, 275);

    drawEnemyIcon(graphics, 130, 205, 18, this.viewConfig.enemy.chaser);
    drawEnemyIcon(graphics, 540, 205, 22, this.viewConfig.enemy.brute);
    drawEnemyIcon(graphics, 130, 335, 15, this.viewConfig.enemy.fast);
    drawEnemyIcon(graphics, 540, 335, 18, this.viewConfig.enemy.ranged);

    this.drawDiamond(
      graphics,
      350,
      425,
      13,
      this.viewConfig.enemyProjectile.color,
      this.viewConfig.enemyProjectile.stroke,
    );
    graphics.fillStyle(this.viewConfig.enemyProjectile.core, 1);
    graphics.fillCircle(350, 425, 3.5);
  }

  private drawField(graphics: Phaser.GameObjects.Graphics): void {
    graphics.lineStyle(1, COLOR.borderSubtle, 0.68);
    graphics.lineBetween(480, 166, 480, 448);
    graphics.lineBetween(56, 300, 904, 300);

    graphics.fillStyle(this.viewConfig.player.color, 1);
    graphics.fillCircle(145, 220, 20);
    graphics.lineStyle(3, this.viewConfig.player.stroke, 1);
    graphics.strokeCircle(145, 220, 20);

    graphics.fillStyle(this.viewConfig.pickup.xpColor, 1);
    graphics.fillCircle(545, 220, 17);
    graphics.lineStyle(3, 0x14532d, 1);
    graphics.strokeCircle(545, 220, 17);

    drawRecoveryKitIcon(
      graphics,
      145,
      362,
      40,
      this.viewConfig.pickup,
    );

    graphics.fillStyle(this.viewConfig.obstacle.fill, 1);
    graphics.fillRoundedRect(
      510,
      350,
      70,
      24,
      this.viewConfig.obstacle.radius,
    );
    graphics.lineStyle(3, this.viewConfig.obstacle.stroke, 1);
    graphics.strokeRoundedRect(
      510,
      350,
      70,
      24,
      this.viewConfig.obstacle.radius,
    );
  }

  private drawCloseButton(
    graphics: Phaser.GameObjects.Graphics,
    focused: boolean,
  ): void {
    const bounds = getHelpCloseButtonBounds(
      this.simulationConfig.arena.width,
      this.simulationConfig.arena.height,
    );
    graphics.fillStyle(focused ? COLOR.surfaceFocused : COLOR.surface, 0.98);
    graphics.fillRoundedRect(
      bounds.x,
      bounds.y,
      bounds.width,
      bounds.height,
      ARENA_THEME.radii.control,
    );
    graphics.lineStyle(
      focused ? 3 : 2,
      focused ? COLOR.focus : COLOR.accent,
      0.95,
    );
    graphics.strokeRoundedRect(
      bounds.x,
      bounds.y,
      bounds.width,
      bounds.height,
      ARENA_THEME.radii.control,
    );
  }

  private drawDiamond(
    graphics: Phaser.GameObjects.Graphics,
    x: number,
    y: number,
    radius: number,
    fill: number,
    stroke: number,
  ): void {
    const points = [
      { x, y: y - radius },
      { x: x + radius, y },
      { x, y: y + radius },
      { x: x - radius, y },
    ];
    graphics.beginPath();
    graphics.moveTo(points[0]!.x, points[0]!.y);
    for (const point of points.slice(1)) graphics.lineTo(point.x, point.y);
    graphics.closePath();
    graphics.fillStyle(fill, 1);
    graphics.fillPath();
    graphics.lineStyle(2, stroke, 1);
    graphics.strokePath();
  }

  private createTexts(
    scene: Phaser.Scene,
    specs: HelpTextSpec[],
  ): Phaser.GameObjects.Text[] {
    return specs.map((spec) =>
      scene.add
        .text(spec.x, spec.y, spec.text, {
          fontFamily: ARENA_THEME.typography.canvasFontFamily,
          fontSize: `${spec.size}px`,
          fontStyle: spec.weight ?? "normal",
          color: spec.color ?? ARENA_THEME.colors.text,
          lineSpacing: 2,
        })
        .setOrigin(spec.originX ?? 0, spec.originY ?? 0)
        .setDepth(HELP_OVERLAY_TEXT_DEPTH)
        .setVisible(false),
    );
  }

  private allTexts(): Phaser.GameObjects.Text[] {
    return [
      ...this.commonTexts,
      ...this.tabTexts,
      ...this.pageTexts.controls,
      ...this.pageTexts.enemies,
      ...this.pageTexts.field,
    ];
  }
}

function createCommonTextSpecs(config: SimulationConfig): HelpTextSpec[] {
  const close = getHelpCloseButtonBounds(config.arena.width, config.arena.height);
  return [
    { text: "操作ヘルプ", x: 48, y: 26, size: 27, weight: "bold" },
    {
      text: "プレイ中も時間を止めて確認できます",
      x: 48,
      y: 59,
      size: 13,
      color: ARENA_THEME.colors.textMuted,
    },
    {
      text: "H で閉じる",
      x: config.arena.width - 48,
      y: 38,
      size: 15,
      color: ARENA_THEME.colors.accentBright,
      originX: 1,
    },
    {
      text: "閉じる",
      x: close.x + close.width / 2,
      y: close.y + close.height / 2,
      size: 17,
      originX: 0.5,
      originY: 0.5,
    },
  ];
}

function createTabTextSpecs(config: SimulationConfig): HelpTextSpec[] {
  const labels = ["操作", "敵", "アイテム"];
  return getHelpTabButtonBounds(config.arena.width).map((tab, index) => ({
    text: labels[index]!,
    x: tab.x + tab.width / 2,
    y: tab.y + tab.height / 2,
    size: 15,
    weight: "bold",
    originX: 0.5,
    originY: 0.5,
  }));
}

function createControlsTextSpecs(): HelpTextSpec[] {
  return [
    { text: "W", x: 226, y: 193, size: 17, originX: 0.5, originY: 0.5 },
    { text: "A", x: 179, y: 237, size: 17, originX: 0.5, originY: 0.5 },
    { text: "S", x: 226, y: 237, size: 17, originX: 0.5, originY: 0.5 },
    { text: "D", x: 273, y: 237, size: 17, originX: 0.5, originY: 0.5 },
    {
      text: "移動",
      x: 226,
      y: 282,
      size: 22,
      weight: "bold",
      originX: 0.5,
    },
    {
      text: "WASD / 矢印キー",
      x: 226,
      y: 314,
      size: 15,
      color: ARENA_THEME.colors.textMuted,
      originX: 0.5,
    },
    {
      text: "照準",
      x: 625,
      y: 282,
      size: 22,
      weight: "bold",
      originX: 0.5,
    },
    {
      text: "マウスで向きを決める",
      x: 625,
      y: 314,
      size: 15,
      color: ARENA_THEME.colors.textMuted,
      originX: 0.5,
    },
    {
      text: "射撃",
      x: 192,
      y: 392,
      size: 18,
      weight: "bold",
      originX: 0.5,
    },
    {
      text: "左クリック / Space",
      x: 192,
      y: 420,
      size: 14,
      color: ARENA_THEME.colors.textMuted,
      originX: 0.5,
    },
    {
      text: "EX特殊",
      x: 480,
      y: 392,
      size: 18,
      weight: "bold",
      originX: 0.5,
    },
    {
      text: "E / 右クリック",
      x: 480,
      y: 420,
      size: 14,
      color: ARENA_THEME.colors.textMuted,
      originX: 0.5,
    },
    {
      text: "一時停止",
      x: 768,
      y: 392,
      size: 18,
      weight: "bold",
      originX: 0.5,
    },
    {
      text: "Esc / P",
      x: 768,
      y: 420,
      size: 14,
      color: ARENA_THEME.colors.textMuted,
      originX: 0.5,
    },
  ];
}

function createEnemiesTextSpecs(): HelpTextSpec[] {
  return [
    { text: "追跡体", x: 170, y: 180, size: 20, weight: "bold" },
    {
      text: "まっすぐ接近する基本敵",
      x: 170,
      y: 210,
      size: 14,
      color: ARENA_THEME.colors.textMuted,
    },
    { text: "重装体", x: 580, y: 180, size: 20, weight: "bold" },
    {
      text: "大きく頑丈。狙いやすい",
      x: 580,
      y: 210,
      size: 14,
      color: ARENA_THEME.colors.textMuted,
    },
    { text: "高速体", x: 170, y: 310, size: 20, weight: "bold" },
    {
      text: "小さく高速。接近に注意",
      x: 170,
      y: 340,
      size: 14,
      color: ARENA_THEME.colors.textMuted,
    },
    { text: "射撃体", x: 580, y: 310, size: 20, weight: "bold" },
    {
      text: "距離を取り敵弾を撃つ",
      x: 580,
      y: 340,
      size: 14,
      color: ARENA_THEME.colors.textMuted,
    },
    { text: "敵弾", x: 385, y: 407, size: 18, weight: "bold" },
    {
      text: "撃ち消せない",
      x: 385,
      y: 432,
      size: 13,
      color: ARENA_THEME.colors.textMuted,
    },
    {
      text: "敵への接触でもダメージ",
      x: 580,
      y: 418,
      size: 15,
      color: ARENA_THEME.colors.danger,
      weight: "bold",
    },
  ];
}

function createFieldTextSpecs(): HelpTextSpec[] {
  return [
    { text: "自機", x: 195, y: 194, size: 21, weight: "bold" },
    {
      text: "青い円。HPが0になると終了",
      x: 195,
      y: 225,
      size: 14,
      color: ARENA_THEME.colors.textMuted,
    },
    { text: "XP", x: 595, y: 194, size: 21, weight: "bold" },
    {
      text: "近づくと吸い寄せて回収",
      x: 595,
      y: 225,
      size: 14,
      color: ARENA_THEME.colors.textMuted,
    },
    { text: "回復キット", x: 195, y: 338, size: 21, weight: "bold" },
    {
      text: "取得するとHPを回復",
      x: 195,
      y: 369,
      size: 14,
      color: ARENA_THEME.colors.textMuted,
    },
    { text: "障害物", x: 610, y: 338, size: 21, weight: "bold" },
    {
      text: "通り抜け不可。射線を切れる",
      x: 610,
      y: 369,
      size: 14,
      color: ARENA_THEME.colors.textMuted,
    },
  ];
}
