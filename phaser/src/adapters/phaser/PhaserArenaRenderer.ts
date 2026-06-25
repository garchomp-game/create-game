import Phaser from "phaser";
import type {
  EnemyViewConfig,
  PlayerDamageSource,
  SimulationConfig,
  Vec2,
  ViewConfig,
  WorldState,
} from "../../domain/types";
import { formatTime } from "../../format/time";
import { createRunResultSummary } from "../../simulation/resultSummary";
import { createUpgradePreview, formatUpgradePreview } from "../../simulation/upgradePreview";
import { PhaserHud } from "./PhaserHud";
import { getMenuButtons, getUpgradeChoiceButtons } from "./PhaserMenuLayout";

export class PhaserArenaRenderer {
  private readonly graphics: Phaser.GameObjects.Graphics;
  private readonly hud: PhaserHud;
  private readonly statusText: Phaser.GameObjects.Text;
  private readonly menuButtonTexts: Phaser.GameObjects.Text[];
  private readonly upgradeChoiceTexts: Phaser.GameObjects.Text[];

  constructor(
    scene: Phaser.Scene,
    private readonly simulationConfig: SimulationConfig,
    private readonly viewConfig: ViewConfig,
  ) {
    this.graphics = scene.add.graphics();
    this.hud = new PhaserHud(scene, simulationConfig);

    scene.add
      .text(simulationConfig.arena.width - 18, 16, "Library: Phaser", {
        fontFamily: "Arial, sans-serif",
        fontSize: "18px",
        color: "#cbd5e1",
      })
      .setOrigin(1, 0)
      .setDepth(10);

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

    this.menuButtonTexts = Array.from({ length: 3 }, () =>
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
    this.upgradeChoiceTexts = Array.from({ length: 3 }, () =>
      scene.add
        .text(0, 0, "", {
          fontFamily: "Arial, sans-serif",
          fontSize: "16px",
          color: "#f8fafc",
          align: "center",
          lineSpacing: 3,
        })
        .setOrigin(0.5)
        .setDepth(21)
        .setVisible(false),
    );
  }

  render(world: WorldState, pointerWorld: Vec2 | null = null): void {
    const g = this.graphics;
    const { arena } = this.simulationConfig;
    const { bullet, pickup, player } = this.viewConfig;

    g.clear();
    g.fillStyle(this.viewConfig.arena.background, 1);
    g.fillRect(0, 0, arena.width, arena.height);
    g.lineStyle(3, this.viewConfig.arena.border, 1);
    g.strokeRect(1.5, 1.5, arena.width - 3, arena.height - 3);

    for (const obstacle of world.obstacles) {
      g.fillStyle(this.viewConfig.obstacle.fill, 1);
      g.fillRoundedRect(
        obstacle.x,
        obstacle.y,
        obstacle.width,
        obstacle.height,
        this.viewConfig.obstacle.radius,
      );
      g.lineStyle(2, this.viewConfig.obstacle.stroke, 1);
      g.strokeRoundedRect(
        obstacle.x,
        obstacle.y,
        obstacle.width,
        obstacle.height,
        this.viewConfig.obstacle.radius,
      );
    }

    for (const item of world.pickups) {
      if (item.kind === "heal") {
        this.drawHealPickup(g, item);
      } else {
        g.fillStyle(pickup.xpColor, 1);
        g.fillCircle(item.position.x, item.position.y, item.radius);
        g.lineStyle(2, 0x14532d, 1);
        g.strokeCircle(item.position.x, item.position.y, item.radius);
      }
    }

    for (const item of world.bullets) {
      g.fillStyle(bullet.color, 1);
      g.fillCircle(item.position.x, item.position.y, item.radius);
    }

    for (const item of world.enemyProjectiles) {
      this.drawEnemyProjectile(g, item);
    }

    for (const item of world.enemies) {
      this.drawEnemy(g, item);
    }

    this.drawAimGuide(g, world, pointerWorld);
    g.fillStyle(player.color, 1);
    g.fillCircle(world.player.position.x, world.player.position.y, world.player.radius);
    g.lineStyle(2, player.stroke, 1);
    g.strokeCircle(world.player.position.x, world.player.position.y, world.player.radius);

    this.hideButtonTexts();
    if (world.state.status === "gameOver") {
      g.fillStyle(0x020617, 0.9);
      g.fillRect(0, 0, arena.width, arena.height);
      this.statusText
        .setOrigin(0.5, 0)
        .setFontSize(26)
        .setLineSpacing(6)
        .setWordWrapWidth(arena.width - 96)
        .setPosition(arena.width / 2, 46)
        .setText(this.formatGameOverText(world))
        .setVisible(true);
      this.drawMenuButtons(g, world);
    } else if (world.state.status === "upgradeSelect") {
      g.fillStyle(0x020617, 0.9);
      g.fillRect(0, 0, arena.width, arena.height);
      this.statusText
        .setOrigin(0.5)
        .setFontSize(24)
        .setLineSpacing(10)
        .setWordWrapWidth(null)
        .setPosition(arena.width / 2, arena.height / 2 - 138)
        .setText(`LEVEL ${world.progression.level}\nChoose Upgrade`)
        .setVisible(true);
      this.drawUpgradeChoiceButtons(g, world);
    } else if (world.state.status === "paused") {
      g.fillStyle(0x020617, 0.9);
      g.fillRect(0, 0, arena.width, arena.height);
      this.statusText
        .setOrigin(0.5)
        .setFontSize(34)
        .setLineSpacing(10)
        .setWordWrapWidth(null)
        .setPosition(arena.width / 2, arena.height / 2 - 74)
        .setText("PAUSED")
        .setVisible(true);
      this.drawMenuButtons(g, world);
    } else if (world.state.status === "title") {
      g.fillStyle(0x05070d, 1);
      g.fillRect(0, 0, arena.width, arena.height);
      this.statusText
        .setOrigin(0.5)
        .setFontSize(34)
        .setLineSpacing(10)
        .setWordWrapWidth(null)
        .setPosition(arena.width / 2, arena.height / 2 - 72)
        .setText("ARENA CORE\nMove  Aim  Shoot\nSurvive the waves")
        .setVisible(true);
      this.drawMenuButtons(g, world);
    } else {
      this.statusText.setVisible(false);
    }

    this.hud.render(world);
    this.drawCursor(g, pointerWorld);
  }

  private formatGameOverText(world: WorldState): string {
    const summary = createRunResultSummary(world);
    const lines = [
      "RUN COMPLETE",
      `Score: ${summary.score}   Time: ${formatTime(summary.elapsed)}`,
      `Level: ${summary.level}   Kills: ${summary.enemiesKilled}`,
      `Shots: ${summary.shotsFired}   Recovered: ${summary.hpRecovered}`,
      `Heals: ${summary.effectiveHealPickupsCollected}/${summary.healPickupsCollected}`,
    ];

    if (summary.lastDamageSource) {
      lines.push(`Cause: ${this.formatDamageSource(summary.lastDamageSource)}`);
    }

    return lines.join("\n");
  }

  private drawAimGuide(
    g: Phaser.GameObjects.Graphics,
    world: WorldState,
    pointerWorld: Vec2 | null,
  ): void {
    if (world.state.status === "title" || world.state.status === "gameOver") return;

    const aimDirection = this.resolveAimDirection(world, pointerWorld);
    const start = {
      x: world.player.position.x + aimDirection.x * (world.player.radius + 6),
      y: world.player.position.y + aimDirection.y * (world.player.radius + 6),
    };
    const end = pointerWorld ?? {
      x: world.player.position.x + aimDirection.x * 180,
      y: world.player.position.y + aimDirection.y * 180,
    };
    g.lineStyle(2, 0x38bdf8, 0.62);
    g.lineBetween(start.x, start.y, end.x, end.y);
    g.lineStyle(1, 0xf8fafc, 0.34);
    g.strokeCircle(end.x, end.y, 14);
  }

  private resolveAimDirection(world: WorldState, pointerWorld: Vec2 | null): Vec2 {
    if (!pointerWorld) return world.state.lastAim;

    const dx = pointerWorld.x - world.player.position.x;
    const dy = pointerWorld.y - world.player.position.y;
    const distance = Math.hypot(dx, dy);
    if (distance < 0.001) return world.state.lastAim;

    return { x: dx / distance, y: dy / distance };
  }

  private drawCursor(g: Phaser.GameObjects.Graphics, pointerWorld: Vec2 | null): void {
    if (!pointerWorld) return;

    const { x, y } = pointerWorld;
    g.lineStyle(2, 0xf8fafc, 0.92);
    g.lineBetween(x - 12, y, x - 4, y);
    g.lineBetween(x + 4, y, x + 12, y);
    g.lineBetween(x, y - 12, x, y - 4);
    g.lineBetween(x, y + 4, x, y + 12);
    g.lineStyle(2, 0x38bdf8, 0.95);
    g.strokeCircle(x, y, 6);
    g.fillStyle(0xfacc15, 1);
    g.fillCircle(x, y, 2);
  }

  private drawEnemy(
    g: Phaser.GameObjects.Graphics,
    enemy: WorldState["enemies"][number],
  ): void {
    const view = this.viewConfig.enemy[enemy.typeId];
    const { x, y } = enemy.position;
    const r = enemy.radius;

    if (view.shape === "circle") {
      g.fillStyle(view.color, 1);
      g.fillCircle(x, y, r);
      g.lineStyle(2, view.stroke, 1);
      g.strokeCircle(x, y, r);
    } else if (view.shape === "square") {
      g.fillStyle(view.color, 1);
      g.fillRect(x - r, y - r, r * 2, r * 2);
      g.lineStyle(2, view.stroke, 1);
      g.strokeRect(x - r, y - r, r * 2, r * 2);
    } else if (view.shape === "diamond") {
      this.drawPolygon(g, [
        { x, y: y - r * 1.18 },
        { x: x + r * 1.18, y },
        { x, y: y + r * 1.18 },
        { x: x - r * 1.18, y },
      ], view.color, view.stroke);
    } else if (view.shape === "triangle") {
      this.drawPolygon(g, this.getRegularPolygonPoints(x, y, r * 1.25, 3, -Math.PI / 2), view.color, view.stroke);
    } else {
      this.drawPolygon(g, this.getRegularPolygonPoints(x, y, r * 1.08, 6, Math.PI / 6), view.color, view.stroke);
    }

    this.drawEnemyMark(g, enemy, view);
  }

  private drawHealPickup(
    g: Phaser.GameObjects.Graphics,
    pickup: WorldState["pickups"][number],
  ): void {
    const view = this.viewConfig.pickup;
    const { x, y } = pickup.position;
    const size = pickup.radius * 2.25;
    const left = x - size / 2;
    const top = y - size / 2;
    const crossLong = pickup.radius * 1.22;
    const crossShort = Math.max(3, pickup.radius * 0.38);

    g.fillStyle(view.healFill, 1);
    g.fillRoundedRect(left, top, size, size, 3);
    g.lineStyle(2, view.healStroke, 1);
    g.strokeRoundedRect(left, top, size, size, 3);
    g.fillStyle(view.healCross, 1);
    g.fillRect(x - crossShort / 2, y - crossLong / 2, crossShort, crossLong);
    g.fillRect(x - crossLong / 2, y - crossShort / 2, crossLong, crossShort);
  }

  private drawEnemyMark(
    g: Phaser.GameObjects.Graphics,
    enemy: WorldState["enemies"][number],
    view: EnemyViewConfig,
  ): void {
    const { x, y } = enemy.position;
    const r = enemy.radius;
    g.lineStyle(2, view.markColor, 0.95);

    if (view.mark === "ring") {
      g.strokeCircle(x, y, r * 0.48);
    } else if (view.mark === "cross") {
      g.lineBetween(x - r * 0.5, y, x + r * 0.5, y);
      g.lineBetween(x, y - r * 0.5, x, y + r * 0.5);
    } else if (view.mark === "slash") {
      g.lineStyle(3, view.markColor, 0.95);
      g.lineBetween(x - r * 0.48, y + r * 0.36, x + r * 0.48, y - r * 0.36);
    } else {
      g.fillStyle(view.markColor, 1);
      g.fillCircle(x, y, r * 0.28);
      g.lineStyle(1, view.stroke, 0.85);
      g.strokeCircle(x, y, r * 0.28);
    }
  }

  private drawEnemyProjectile(
    g: Phaser.GameObjects.Graphics,
    projectile: WorldState["enemyProjectiles"][number],
  ): void {
    const { x, y } = projectile.position;
    const r = projectile.radius + 3;
    const view = this.viewConfig.enemyProjectile;
    this.drawPolygon(g, [
      { x, y: y - r },
      { x: x + r, y },
      { x, y: y + r },
      { x: x - r, y },
    ], view.color, view.stroke);
    g.lineStyle(1, view.core, 0.95);
    g.lineBetween(x - r * 0.45, y, x + r * 0.45, y);
    g.lineBetween(x, y - r * 0.45, x, y + r * 0.45);
    g.fillStyle(view.core, 1);
    g.fillCircle(x, y, Math.max(2, projectile.radius * 0.35));
  }

  private drawPolygon(
    g: Phaser.GameObjects.Graphics,
    points: Vec2[],
    fillColor: number,
    strokeColor: number,
  ): void {
    g.fillStyle(fillColor, 1);
    this.tracePolygon(g, points);
    g.fillPath();
    g.lineStyle(2, strokeColor, 1);
    this.tracePolygon(g, points);
    g.strokePath();
  }

  private tracePolygon(g: Phaser.GameObjects.Graphics, points: Vec2[]): void {
    const first = points[0];
    if (!first) return;

    g.beginPath();
    g.moveTo(first.x, first.y);
    for (let index = 1; index < points.length; index += 1) {
      const point = points[index]!;
      g.lineTo(point.x, point.y);
    }
    g.closePath();
  }

  private getRegularPolygonPoints(
    x: number,
    y: number,
    radius: number,
    sides: number,
    rotation: number,
  ): Vec2[] {
    return Array.from({ length: sides }, (_, index) => {
      const angle = rotation + (Math.PI * 2 * index) / sides;
      return {
        x: x + Math.cos(angle) * radius,
        y: y + Math.sin(angle) * radius,
      };
    });
  }

  private formatDamageSource(source: PlayerDamageSource): string {
    if (source.kind === "contact") return `${source.enemyType} contact`;

    return "enemy projectile";
  }

  private drawMenuButtons(g: Phaser.GameObjects.Graphics, world: WorldState): void {
    const { width, height } = this.simulationConfig.arena;
    const buttons = getMenuButtons(world.state.status, width, height);
    buttons.forEach((button, index) => {
      this.drawButton(g, button.x, button.y, button.width, button.height);
      const text = this.menuButtonTexts[index]!;
      text
        .setText(button.label)
        .setPosition(button.x + button.width / 2, button.y + button.height / 2)
        .setVisible(true);
    });
  }

  private drawUpgradeChoiceButtons(g: Phaser.GameObjects.Graphics, world: WorldState): void {
    const { width, height } = this.simulationConfig.arena;
    const buttons = getUpgradeChoiceButtons(
      world.progression.pendingUpgradeChoices.length,
      width,
      height,
    );
    buttons.forEach((button) => {
      const upgradeId = world.progression.pendingUpgradeChoices[button.index]!;
      const upgrade = this.simulationConfig.upgrades[upgradeId];
      const currentRank = world.progression.upgradeRanks[upgradeId];
      const preview = formatUpgradePreview(
        createUpgradePreview(world, this.simulationConfig, upgradeId),
      );
      this.drawButton(g, button.x, button.y, button.width, button.height);
      this.upgradeChoiceTexts[button.index]!
        .setText(
          `${button.index + 1}. ${upgrade.title}  Rank ${currentRank + 1}/${
            upgrade.maxRank
          }\n${upgrade.description}\n${preview}`,
        )
        .setPosition(button.x + button.width / 2, button.y + button.height / 2)
        .setVisible(true);
    });
  }

  private drawButton(
    g: Phaser.GameObjects.Graphics,
    x: number,
    y: number,
    width: number,
    height: number,
  ): void {
    g.fillStyle(0x1f2937, 0.94);
    g.fillRoundedRect(x, y, width, height, 6);
    g.lineStyle(2, 0x38bdf8, 0.9);
    g.strokeRoundedRect(x, y, width, height, 6);
  }

  private hideButtonTexts(): void {
    for (const text of this.menuButtonTexts) {
      text.setVisible(false);
    }
    for (const text of this.upgradeChoiceTexts) {
      text.setVisible(false);
    }
  }
}
