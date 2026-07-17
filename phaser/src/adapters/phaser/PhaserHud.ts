import * as Phaser from "phaser";
import type { SimulationConfig, WorldState } from "../../domain/types";
import { formatTime } from "../../format/time";
import { TEXT } from "../../lang";
import { getWaveBand } from "../../simulation/waveDirector";
import { getThreatTier } from "../../simulation/threatDirector";
import { getNextCollapseAt } from "../../simulation/systems/collapseSystem";
import type { AutoPilotMode } from "../../simulation/autoPilot";

export const HUD_LEFT_PANEL_BOUNDS = {
  x: 16,
  y: 14,
  width: 348,
  height: 82,
} as const;

export class PhaserHud {
  private readonly graphics: Phaser.GameObjects.Graphics;
  private readonly hpText: Phaser.GameObjects.Text;
  private readonly hpValueText: Phaser.GameObjects.Text;
  private readonly xpText: Phaser.GameObjects.Text;
  private readonly xpValueText: Phaser.GameObjects.Text;
  private readonly metaText: Phaser.GameObjects.Text;
  private readonly weaponText: Phaser.GameObjects.Text;
  private readonly encounterText: Phaser.GameObjects.Text;
  private readonly bossText: Phaser.GameObjects.Text;
  private readonly autoPilotText: Phaser.GameObjects.Text;

  constructor(scene: Phaser.Scene, private readonly simulationConfig: SimulationConfig) {
    this.graphics = scene.add.graphics().setDepth(10);
    this.hpText = this.createText(scene, 28, 20);
    this.hpValueText = this.createText(scene, 352, 20).setOrigin(1, 0);
    this.xpText = this.createText(scene, 28, 53);
    this.xpValueText = this.createText(scene, 352, 53).setOrigin(1, 0);
    this.metaText = this.createText(scene, simulationConfig.arena.width - 28, 24).setOrigin(1, 0);
    this.weaponText = this.createText(scene, simulationConfig.arena.width - 28, 52).setOrigin(1, 0);
    this.encounterText = this.createText(scene, simulationConfig.arena.width / 2, 112)
      .setOrigin(0.5, 0)
      .setFontSize(15);
    this.bossText = this.createText(scene, simulationConfig.arena.width / 2, 108)
      .setOrigin(0.5, 0)
      .setFontSize(14);
    this.autoPilotText = this.createText(scene, simulationConfig.arena.width / 2, 29)
      .setOrigin(0.5)
      .setColor("#67e8f9")
      .setText("AI観戦");
  }

  render(
    world: WorldState,
    enabled = true,
    autoPilotEnabled = false,
    autoPilotMode: AutoPilotMode | null = null,
  ): void {
    const visible =
      enabled && (world.state.status === "playing" || world.state.status === "paused");
    this.setVisible(visible);
    this.graphics.clear();
    if (!visible) return;

    const leftPanel = HUD_LEFT_PANEL_BOUNDS;
    const rightPanel = {
      x: this.simulationConfig.arena.width - 286,
      y: 14,
      width: 270,
      height: 82,
    };
    const maxHp = this.simulationConfig.player.maxHp + world.runtime.maxHpBonus;
    const hpRatio = maxHp > 0 ? world.state.hp / maxHp : 0;
    const buildComplete = world.progression.buildCompletedAt !== null;
    const xpRatio =
      world.progression.xpToNext > 0
        ? world.progression.xp / world.progression.xpToNext
        : 0;
    const wave = getWaveBand(this.simulationConfig, world.state.elapsed);
    const threatTier = getThreatTier(this.simulationConfig, world.state.elapsed);
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
    if (autoPilotEnabled) {
      const badge = { x: this.simulationConfig.arena.width / 2 - 78, y: 14, width: 156, height: 30 };
      this.graphics.fillStyle(0x083344, 0.9);
      this.graphics.fillRoundedRect(badge.x, badge.y, badge.width, badge.height, 4);
      this.graphics.lineStyle(1, 0x22d3ee, 0.95);
      this.graphics.strokeRoundedRect(
        badge.x + 0.5,
        badge.y + 0.5,
        badge.width - 1,
        badge.height - 1,
        4,
      );
    }
    this.autoPilotText
      .setText(formatAutoPilotMode(autoPilotMode))
      .setVisible(autoPilotEnabled);

    this.drawBar(28, 40, 324, 8, hpRatio, getHpBarColor(hpRatio));
    this.drawBar(28, 73, 324, 8, xpRatio, 0x38bdf8);

    this.hpText.setText(TEXT.hud.hpLabel);
    this.hpValueText.setText(TEXT.hud.hpValue(Math.ceil(world.state.hp), maxHp));
    this.xpText.setText(
      buildComplete
        ? TEXT.hud.extraLevelLabel(
            world.progression.extraLevel,
            world.progression.extraCycle,
          )
        : TEXT.hud.levelLabel(world.progression.level),
    );
    this.xpValueText.setText(
      TEXT.hud.experienceValue(world.progression.xp, world.progression.xpToNext),
    );
    this.metaText.setText(
      TEXT.hud.meta(formatTime(world.state.elapsed), world.state.score),
    );
    const weaponStatus = TEXT.hud.danger(
        threatTier,
        world.enemies.length,
        wave.maxEnemies,
        TEXT.hud.weaponNames[world.state.weaponType],
      );
    this.weaponText.setText(
      world.state.weaponType === "spread" && world.weaponIdentity.spreadSweepCharge
        ? `${weaponStatus}\n掃射循環 READY`
        : weaponStatus,
    );
    const bossEnemy = world.expedition?.boss?.status === "active"
      ? world.enemies.find((enemy) => enemy.id === world.expedition!.boss!.enemyId)
      : null;
    if (bossEnemy && world.expedition?.boss) {
      const boss = world.expedition.boss;
      const hpRatio = boss.maxHp > 0 ? bossEnemy.hp / boss.maxHp : 0;
      const seconds = Math.max(0, boss.action.endsAt - world.state.elapsed);
      this.encounterText.setVisible(false);
      const panel = {
        x: this.simulationConfig.arena.width / 2 - 250,
        y: this.simulationConfig.arena.height - 76,
        width: 500,
        height: 62,
      };
      this.bossText
        .setPosition(this.simulationConfig.arena.width / 2, panel.y + 6)
        .setText(
          `敵指揮艦  PHASE ${boss.phase}  ${Math.ceil(bossEnemy.hp)} / ${boss.maxHp}\n${formatBossAttack(boss.action.attackId)} ${formatBossActionPhase(boss.action.phase)} ${seconds.toFixed(1)}s`,
        )
        .setVisible(true);
      this.graphics.fillStyle(0x020617, 0.9);
      this.graphics.fillRoundedRect(panel.x, panel.y, panel.width, panel.height, 6);
      this.graphics.lineStyle(2, boss.phase === 2 ? 0xfb7185 : 0xfacc15, 0.98);
      this.graphics.strokeRoundedRect(panel.x, panel.y, panel.width, panel.height, 6);
      this.drawBar(panel.x + 28, panel.y + 48, panel.width - 56, 8, hpRatio, 0xef4444);
    } else {
      this.bossText.setVisible(false);
      const encounterLabel = this.getEncounterLabel(world);
      this.encounterText.setText(encounterLabel).setVisible(Boolean(encounterLabel));
      if (encounterLabel) {
        const banner = {
          x: this.simulationConfig.arena.width / 2 - 350,
          y: 104,
          width: 700,
          height: world.expedition ? 44 : 34,
        };
        this.graphics.fillStyle(0x020617, 0.88);
        this.graphics.fillRoundedRect(banner.x, banner.y, banner.width, banner.height, 6);
        this.graphics.lineStyle(
          2,
          world.encounter.director.phase === "active" ||
              world.expedition?.director.phase === "active" ||
              world.encounter.collapse.stage > 0
            ? 0xf97316
            : 0xfacc15,
          0.95,
        );
        this.graphics.strokeRoundedRect(banner.x, banner.y, banner.width, banner.height, 6);
      }
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
    this.hpValueText.setVisible(visible);
    this.xpText.setVisible(visible);
    this.xpValueText.setVisible(visible);
    this.metaText.setVisible(visible);
    this.weaponText.setVisible(visible);
    this.encounterText.setVisible(visible && Boolean(this.encounterText.text));
    this.bossText.setVisible(false);
    this.autoPilotText.setVisible(false);
  }

  private getEncounterLabel(world: WorldState): string {
    const labels: string[] = [];
    if (world.expedition) {
      const expedition = world.expedition;
      const phase = expedition.director.phase;
      const card = formatExpeditionCard(expedition.currentCardTitleKey);
      const direction = formatExpeditionDirection(expedition.currentDirection);
      const phaseLabel =
        phase === "telegraph"
          ? `予告 ${direction} > ${card}`
          : phase === "active"
            ? `交戦中 ${card}`
            : phase === "recovery"
              ? `制圧確認 ${card}`
              : null;
      labels.push(
        `${formatExpeditionAct(expedition.actId)}: ${expedition.objective}${phaseLabel ? `\n${phaseLabel}` : ""}`,
      );
      return labels.join(" / ");
    }
    const director = world.encounter.director;
    const scheduledAt = director.scheduledAt;
    const encounterId = director.currentId;
    if (scheduledAt !== null && encounterId !== null && director.phase === "warning") {
      labels.push(
        TEXT.hud.encounterWarning(
          TEXT.hud.encounterNames[encounterId],
          Math.max(0, Math.ceil(scheduledAt - world.state.elapsed)),
        ),
      );
    }
    if (scheduledAt !== null && encounterId !== null && director.phase === "active") {
      const end =
        scheduledAt +
        this.simulationConfig.encounter.director.definitions[encounterId].activeDuration;
      labels.push(
        TEXT.hud.encounterActive(
          TEXT.hud.encounterNames[encounterId],
          Math.max(0, Math.ceil(end - world.state.elapsed)),
        ),
      );
    }
    if (scheduledAt !== null && encounterId !== null && director.phase === "recovery") {
      const definition = this.simulationConfig.encounter.director.definitions[encounterId];
      const end =
        scheduledAt +
        definition.activeDuration +
        definition.recoveryDuration;
      labels.push(
        TEXT.hud.encounterRecovery(
          TEXT.hud.encounterNames[encounterId],
          Math.max(0, Math.ceil(end - world.state.elapsed)),
        ),
      );
    }
    if (this.simulationConfig.features.arenaCollapse) {
      const nextAt = getNextCollapseAt(
        this.simulationConfig,
        world.encounter.collapse.stage,
      );
      const untilNext = nextAt - world.state.elapsed;
      if (
        untilNext >= 0 &&
        untilNext <= this.simulationConfig.encounter.collapse.warningDuration
      ) {
        labels.push(TEXT.hud.collapseWarning(Math.ceil(untilNext)));
      } else if (world.encounter.collapse.stage > 0) {
        labels.push(TEXT.hud.collapseActive(world.encounter.collapse.stage));
      }
    }
    if (world.encounter.contract.choice === "overdrive") labels.push(TEXT.hud.overdriveContract);
    return labels.join(" / ");
  }
}

function formatExpeditionAct(actId: string): string {
  const labels: Record<string, string> = {
    deployment: "ACT 1 展開",
    "first-assault": "ACT 2 第一波",
    counterattack: "ACT 3 反撃",
    breakthrough: "ACT 4 突破",
    "command-ship": "ACT 5 決戦",
  };
  return labels[actId] ?? actId;
}

function formatExpeditionCard(titleKey: string | null): string {
  if (!titleKey) return "次の遭遇";
  const labels: Record<string, string> = {
    "encounter.vanguard-arc.title": "前衛弧状波",
    "encounter.crossfire-pincer.title": "十字挟撃",
    "encounter.heavy-escort.title": "重装護衛隊",
    "encounter.commander-counterattack.title": "指揮個体反撃",
    "encounter.charger-breakthrough.title": "突撃突破隊",
    "encounter.command-ship-showdown.title": "敵指揮艦決戦",
  };
  return labels[titleKey] ?? titleKey;
}

function formatBossAttack(attackId: "targeted-salvo" | "escort-pincer"): string {
  return attackId === "targeted-salvo" ? "照準斉射" : "挟撃護衛";
}

function formatBossActionPhase(phase: "telegraph" | "execute" | "recovery"): string {
  if (phase === "telegraph") return "予告";
  if (phase === "execute") return "攻撃";
  return "反撃機会";
}

function formatExpeditionDirection(
  direction: WorldState["expedition"] extends infer T
    ? T extends { currentDirection: infer D }
      ? D
      : never
    : never,
): string {
  const labels = { north: "北", east: "東", south: "南", west: "西" } as const;
  return direction ? labels[direction] : "外周";
}

function getHpBarColor(ratio: number): number {
  if (ratio <= 0.25) return 0xef4444;
  if (ratio <= 0.5) return 0xf59e0b;
  return 0x22c55e;
}

function formatAutoPilotMode(mode: AutoPilotMode | null): string {
  const labels: Record<AutoPilotMode, string> = {
    contract: "契約選択",
    upgrade: "強化選択",
    projectileDodge: "弾回避",
    enemyEvade: "接触回避",
    healCollect: "HP回収",
    xpCollect: "XP回収",
    reposition: "射線確保",
    engage: "交戦",
    survive: "退避",
    patrol: "周回",
  };
  return `AI観戦: ${mode ? labels[mode] : "待機"}`;
}
