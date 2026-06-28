import Phaser from "phaser";
import type { SimulationConfig, WorldState } from "../../domain/types";
import { formatTime } from "../../format/time";
import { TEXT } from "../../lang";
import { getWaveBand } from "../../simulation/waveDirector";

export class PhaserHud {
  private readonly graphics: Phaser.GameObjects.Graphics;
  private readonly hpText: Phaser.GameObjects.Text;
  private readonly xpText: Phaser.GameObjects.Text;
  private readonly metaText: Phaser.GameObjects.Text;
  private readonly weaponText: Phaser.GameObjects.Text;

  constructor(scene: Phaser.Scene, private readonly simulationConfig: SimulationConfig) {
    this.graphics = scene.add.graphics().setDepth(10);
    this.hpText = this.createText(scene, 28, 25);
    this.xpText = this.createText(scene, 28, 48);
    this.metaText = this.createText(scene, 28, 70);
    this.weaponText = this.createText(scene, 28, 91);
  }

  render(world: WorldState): void {
    const visible = world.state.status === "playing" || world.state.status === "paused";
    this.setVisible(visible);
    this.graphics.clear();
    if (!visible) return;

    const panel = { x: 16, y: 14, width: 348, height: 94 };
    const maxHp = this.simulationConfig.player.maxHp + world.runtime.maxHpBonus;
    const hpRatio = maxHp > 0 ? world.state.hp / maxHp : 0;
    const xpRatio =
      world.progression.xpToNext > 0
        ? world.progression.xp / world.progression.xpToNext
        : 0;
    const wave = getWaveBand(this.simulationConfig, world.state.elapsed);
    const waveIndex = this.simulationConfig.waves.findIndex((item) => item.start === wave.start) + 1;
    const weapon = this.simulationConfig.weapons[world.state.weaponType];
    const fireRate = 1 / Math.max(0.001, weapon.interval * world.runtime.fireIntervalMultiplier);
    const projectileCount = weapon.projectileCount + world.runtime.projectileCountBonus;
    const pierce = weapon.pierceCount + world.runtime.pierceBonus;

    this.graphics.fillStyle(0x020617, 0.76);
    this.graphics.fillRoundedRect(panel.x, panel.y, panel.width, panel.height, 6);
    this.graphics.lineStyle(1, 0x334155, 0.95);
    this.graphics.strokeRoundedRect(panel.x + 0.5, panel.y + 0.5, panel.width - 1, panel.height - 1, 6);

    this.drawBar(102, 27, 168, 10, hpRatio, 0xef4444);
    this.drawBar(102, 50, 168, 10, xpRatio, 0x22c55e);

    this.hpText.setText(TEXT.hud.hp(Math.ceil(world.state.hp), maxHp));
    this.xpText.setText(
      TEXT.hud.xp(world.progression.level, world.progression.xp, world.progression.xpToNext),
    );
    this.metaText.setText(
      TEXT.hud.meta(
        waveIndex,
        formatTime(world.state.elapsed),
        world.state.score,
        world.enemies.length,
        wave.maxEnemies,
      ),
    );
    this.weaponText.setText(
      TEXT.hud.weapon(
        TEXT.hud.weaponNames[world.state.weaponType],
        fireRate.toFixed(1),
        projectileCount,
        pierce,
      ),
    );
  }

  private createText(scene: Phaser.Scene, x: number, y: number): Phaser.GameObjects.Text {
    return scene.add
      .text(x, y, "", {
        fontFamily: "Arial, sans-serif",
        fontSize: "14px",
        color: "#f8fafc",
      })
      .setDepth(11)
      .setVisible(false);
  }

  private drawBar(
    x: number,
    y: number,
    width: number,
    height: number,
    ratio: number,
    fillColor: number,
  ): void {
    const clampedRatio = Math.max(0, Math.min(1, ratio));
    this.graphics.fillStyle(0x0f172a, 0.95);
    this.graphics.fillRoundedRect(x, y, width, height, 4);
    this.graphics.fillStyle(fillColor, 0.95);
    this.graphics.fillRoundedRect(x, y, width * clampedRatio, height, 4);
    this.graphics.lineStyle(1, 0x64748b, 0.8);
    this.graphics.strokeRoundedRect(x + 0.5, y + 0.5, width - 1, height - 1, 4);
  }

  private setVisible(visible: boolean): void {
    this.graphics.setVisible(visible);
    this.hpText.setVisible(visible);
    this.xpText.setVisible(visible);
    this.metaText.setVisible(visible);
    this.weaponText.setVisible(visible);
  }
}
