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
  private readonly encounterText: Phaser.GameObjects.Text;

  constructor(scene: Phaser.Scene, private readonly simulationConfig: SimulationConfig) {
    this.graphics = scene.add.graphics().setDepth(10);
    this.hpText = this.createText(scene, 28, 24);
    this.xpText = this.createText(scene, 28, 52);
    this.metaText = this.createText(scene, simulationConfig.arena.width - 28, 24).setOrigin(1, 0);
    this.weaponText = this.createText(scene, simulationConfig.arena.width - 28, 52).setOrigin(1, 0);
    this.encounterText = this.createText(scene, simulationConfig.arena.width / 2, 102)
      .setOrigin(0.5, 0)
      .setFontSize(15);
  }

  render(world: WorldState, enabled = true): void {
    const visible =
      enabled && (world.state.status === "playing" || world.state.status === "paused");
    this.setVisible(visible);
    this.graphics.clear();
    if (!visible) return;

    const leftPanel = { x: 16, y: 14, width: 326, height: 72 };
    const rightPanel = {
      x: this.simulationConfig.arena.width - 286,
      y: 14,
      width: 270,
      height: 72,
    };
    const maxHp = this.simulationConfig.player.maxHp + world.runtime.maxHpBonus;
    const hpRatio = maxHp > 0 ? world.state.hp / maxHp : 0;
    const buildComplete = world.progression.buildCompletedAt !== null;
    const xpRatio = buildComplete
      ? 1
      : world.progression.xpToNext > 0
        ? world.progression.xp / world.progression.xpToNext
        : 0;
    const wave = getWaveBand(this.simulationConfig, world.state.elapsed);
    const waveIndex = this.simulationConfig.waves.findIndex((item) => item.start === wave.start) + 1;
    this.graphics.fillStyle(0x020617, 0.76);
    this.graphics.fillRoundedRect(leftPanel.x, leftPanel.y, leftPanel.width, leftPanel.height, 6);
    this.graphics.fillRoundedRect(rightPanel.x, rightPanel.y, rightPanel.width, rightPanel.height, 6);
    this.graphics.lineStyle(1, 0x334155, 0.95);
    this.graphics.strokeRoundedRect(
      leftPanel.x + 0.5,
      leftPanel.y + 0.5,
      leftPanel.width - 1,
      leftPanel.height - 1,
      6,
    );
    this.graphics.strokeRoundedRect(
      rightPanel.x + 0.5,
      rightPanel.y + 0.5,
      rightPanel.width - 1,
      rightPanel.height - 1,
      6,
    );

    this.drawBar(128, 27, 188, 10, hpRatio, 0xef4444);
    this.drawBar(128, 55, 188, 10, xpRatio, 0x22c55e);

    this.hpText.setText(TEXT.hud.hp(Math.ceil(world.state.hp), maxHp));
    this.xpText.setText(
      buildComplete
        ? TEXT.hud.buildComplete(world.progression.level)
        : TEXT.hud.xp(world.progression.level, world.progression.xp, world.progression.xpToNext),
    );
    this.metaText.setText(
      TEXT.hud.meta(formatTime(world.state.elapsed), world.state.score),
    );
    this.weaponText.setText(
      TEXT.hud.danger(
        waveIndex,
        world.enemies.length,
        wave.maxEnemies,
        TEXT.hud.weaponNames[world.state.weaponType],
      ),
    );
    const encounterLabel = this.getEncounterLabel(world);
    this.encounterText.setText(encounterLabel).setVisible(Boolean(encounterLabel));
    if (encounterLabel) {
      const banner = { x: this.simulationConfig.arena.width / 2 - 205, y: 94, width: 410, height: 34 };
      this.graphics.fillStyle(0x020617, 0.88);
      this.graphics.fillRoundedRect(banner.x, banner.y, banner.width, banner.height, 6);
      this.graphics.lineStyle(2, world.encounter.rangedSurge.phase === "active" ? 0xf97316 : 0xfacc15, 0.95);
      this.graphics.strokeRoundedRect(banner.x, banner.y, banner.width, banner.height, 6);
    }
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
    this.encounterText.setVisible(visible && Boolean(this.encounterText.text));
  }

  private getEncounterLabel(world: WorldState): string {
    const surge = world.encounter.rangedSurge;
    const scheduledAt = surge.scheduledAt;
    if (scheduledAt !== null && surge.phase === "warning") {
      return TEXT.hud.encounterWarning(Math.max(0, Math.ceil(scheduledAt - world.state.elapsed)));
    }
    if (scheduledAt !== null && surge.phase === "active") {
      const end = scheduledAt + this.simulationConfig.encounter.rangedSurge.activeDuration;
      return TEXT.hud.encounterActive(Math.max(0, Math.ceil(end - world.state.elapsed)));
    }
    if (scheduledAt !== null && surge.phase === "recovery") {
      const end =
        scheduledAt +
        this.simulationConfig.encounter.rangedSurge.activeDuration +
        this.simulationConfig.encounter.rangedSurge.recoveryDuration;
      return TEXT.hud.encounterRecovery(Math.max(0, Math.ceil(end - world.state.elapsed)));
    }
    if (world.encounter.contract.choice === "overdrive") return TEXT.hud.overdriveContract;
    return "";
  }
}
