import Phaser from "phaser";
import type { SimulationConfig, Vec2, ViewConfig, WorldState } from "../../domain/types";
import { formatTime } from "../../format/time";
import { createRunResultSummary } from "../../simulation/resultSummary";
import { getWaveBand } from "../../simulation/waveDirector";
import { getMenuButtons, getUpgradeChoiceButtons } from "./PhaserMenuLayout";

export class PhaserArenaRenderer {
  private readonly graphics: Phaser.GameObjects.Graphics;
  private readonly hud: Phaser.GameObjects.Text;
  private readonly statusText: Phaser.GameObjects.Text;
  private readonly menuButtonTexts: Phaser.GameObjects.Text[];
  private readonly upgradeChoiceTexts: Phaser.GameObjects.Text[];

  constructor(
    scene: Phaser.Scene,
    private readonly simulationConfig: SimulationConfig,
    private readonly viewConfig: ViewConfig,
  ) {
    this.graphics = scene.add.graphics();
    this.hud = scene.add
      .text(18, 16, "", {
        fontFamily: "Arial, sans-serif",
        fontSize: "16px",
        color: "#f8fafc",
        backgroundColor: "rgba(2, 6, 23, 0.68)",
        padding: { x: 8, y: 6 },
        lineSpacing: 4,
      })
      .setDepth(10);

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
    const { bullet, enemy, enemyProjectile, pickup, player } = this.viewConfig;

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
      g.fillStyle(pickup.xpColor, 1);
      g.fillCircle(item.position.x, item.position.y, item.radius);
      g.lineStyle(2, 0x14532d, 1);
      g.strokeCircle(item.position.x, item.position.y, item.radius);
    }

    for (const item of world.bullets) {
      g.fillStyle(bullet.color, 1);
      g.fillCircle(item.position.x, item.position.y, item.radius);
    }

    for (const item of world.enemyProjectiles) {
      g.fillStyle(enemyProjectile.color, 1);
      g.fillCircle(item.position.x, item.position.y, item.radius);
    }

    for (const item of world.enemies) {
      const enemyView = enemy[item.typeId];
      g.fillStyle(enemyView.color, 1);
      g.fillCircle(item.position.x, item.position.y, item.radius);
      g.lineStyle(2, enemyView.stroke, 1);
      g.strokeCircle(item.position.x, item.position.y, item.radius);
    }

    this.drawAimGuide(g, world, pointerWorld);
    g.fillStyle(player.color, 1);
    g.fillCircle(world.player.position.x, world.player.position.y, world.player.radius);
    g.lineStyle(2, player.stroke, 1);
    g.strokeCircle(world.player.position.x, world.player.position.y, world.player.radius);

    this.hideButtonTexts();
    if (world.state.status === "gameOver") {
      const summary = createRunResultSummary(world);
      g.fillStyle(0x020617, 0.9);
      g.fillRect(0, 0, arena.width, arena.height);
      this.statusText
        .setFontSize(34)
        .setPosition(arena.width / 2, arena.height / 2 - 72)
        .setText(
          `RUN COMPLETE\nScore: ${summary.score}\nTime: ${formatTime(
            summary.elapsed,
          )}\nLevel: ${summary.level}\nKills: ${summary.enemiesKilled}\nShots: ${
            summary.shotsFired
          }`,
        )
        .setVisible(true);
      this.drawMenuButtons(g, world);
    } else if (world.state.status === "upgradeSelect") {
      g.fillStyle(0x020617, 0.9);
      g.fillRect(0, 0, arena.width, arena.height);
      this.statusText
        .setFontSize(24)
        .setPosition(arena.width / 2, arena.height / 2 - 138)
        .setText(`LEVEL ${world.progression.level}\nChoose Upgrade`)
        .setVisible(true);
      this.drawUpgradeChoiceButtons(g, world);
    } else if (world.state.status === "paused") {
      g.fillStyle(0x020617, 0.9);
      g.fillRect(0, 0, arena.width, arena.height);
      this.statusText
        .setFontSize(34)
        .setPosition(arena.width / 2, arena.height / 2 - 74)
        .setText("PAUSED")
        .setVisible(true);
      this.drawMenuButtons(g, world);
    } else if (world.state.status === "title") {
      g.fillStyle(0x05070d, 1);
      g.fillRect(0, 0, arena.width, arena.height);
      this.statusText
        .setFontSize(34)
        .setPosition(arena.width / 2, arena.height / 2 - 72)
        .setText("ARENA CORE\nMove  Aim  Shoot\nSurvive the waves")
        .setVisible(true);
      this.drawMenuButtons(g, world);
    } else {
      this.statusText.setVisible(false);
    }

    this.hud.setVisible(world.state.status !== "title");
    this.hud.setText(this.formatHud(world));
    this.drawCursor(g, pointerWorld);
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

  private formatHud(world: WorldState): string {
    const wave = getWaveBand(this.simulationConfig, world.state.elapsed);
    const waveIndex = this.simulationConfig.waves.findIndex((item) => item.start === wave.start) + 1;
    const maxHp = this.simulationConfig.player.maxHp + world.runtime.maxHpBonus;
    return [
      `HP ${Math.ceil(world.state.hp)}/${maxHp}  LV ${world.progression.level}  XP ${world.progression.xp}/${world.progression.xpToNext}`,
      `Score ${world.state.score}  Time ${formatTime(world.state.elapsed)}  Wave ${waveIndex}`,
      `Weapon ${world.state.weaponType}  Enemies ${world.enemies.length}/${wave.maxEnemies}`,
    ].join("\n");
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
      this.drawButton(g, button.x, button.y, button.width, button.height);
      this.upgradeChoiceTexts[button.index]!
        .setText(
          `${button.index + 1}. ${upgrade.title}  Rank ${currentRank + 1}/${
            upgrade.maxRank
          }\n${upgrade.description}`,
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
