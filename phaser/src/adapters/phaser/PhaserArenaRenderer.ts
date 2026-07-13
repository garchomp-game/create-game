import Phaser from "phaser";
import type {
  EnemyViewConfig,
  PlayerDamageSource,
  SimulationConfig,
  Vec2,
  ViewConfig,
  WorldState,
} from "../../domain/types";
import type { RankIneligibilityReason, RunRecord } from "../../domain/runRecords";
import { formatTime } from "../../format/time";
import { TEXT } from "../../lang";
import { createRunResultSummary } from "../../simulation/resultSummary";
import { getUpgradeRequirementProgress } from "../../simulation/buildComposer";
import { createUpgradePreview, formatUpgradePreview } from "../../simulation/upgradePreview";
import { isExtraUpgradeId } from "../../simulation/extraProgression";
import { getCollapseSafeBounds } from "../../simulation/systems/collapseSystem";
import { PhaserHud } from "./PhaserHud";
import { getMenuButtons, getUpgradeChoiceButtons } from "./PhaserMenuLayout";
import type { MenuAction } from "./PhaserMenuLayout";
import type { PhaserUiState } from "./PhaserUiState";

export class PhaserArenaRenderer {
  private readonly graphics: Phaser.GameObjects.Graphics;
  private readonly hud: PhaserHud;
  private readonly statusText: Phaser.GameObjects.Text;
  private readonly detailText: Phaser.GameObjects.Text;
  private readonly menuButtonTexts: Phaser.GameObjects.Text[];
  private readonly upgradeChoiceTexts: Phaser.GameObjects.Text[];

  constructor(
    scene: Phaser.Scene,
    private readonly simulationConfig: SimulationConfig,
    private readonly viewConfig: ViewConfig,
  ) {
    this.graphics = scene.add.graphics();
    this.hud = new PhaserHud(scene, simulationConfig);

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

  render(
    world: WorldState,
    pointerWorld: Vec2 | null = null,
    uiState?: PhaserUiState,
  ): void {
    const g = this.graphics;
    const { arena } = this.simulationConfig;
    const { bullet, pickup, player } = this.viewConfig;

    g.clear();
    g.fillStyle(this.viewConfig.arena.background, 1);
    g.fillRect(0, 0, arena.width, arena.height);
    this.drawCollapse(g, world);
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
      const bounced = item.ricochetsUsed > 0;
      g.fillStyle(bounced ? 0x67e8f9 : bullet.color, 1);
      g.fillCircle(item.position.x, item.position.y, item.radius);
      if (item.ricochetRemaining > 0 || bounced) {
        g.lineStyle(2, 0x22d3ee, 0.95);
        g.strokeCircle(item.position.x, item.position.y, item.radius + 2);
      }
    }

    for (const item of world.enemyProjectiles) {
      this.drawEnemyProjectile(g, item);
    }

    for (const item of world.enemies) {
      this.drawEnemy(g, item);
    }
    this.drawOffscreenEnemyIndicators(g, world);

    this.drawAimGuide(g, world, pointerWorld);
    g.fillStyle(player.color, 1);
    g.fillCircle(world.player.position.x, world.player.position.y, world.player.radius);
    g.lineStyle(2, player.stroke, 1);
    g.strokeCircle(world.player.position.x, world.player.position.y, world.player.radius);

    this.hideButtonTexts();
    this.detailText.setVisible(false);
    if (uiState?.secondaryMenu) {
      this.drawSecondaryMenu(g, world, uiState);
    } else if (world.state.status === "gameOver") {
      g.fillStyle(0x020617, 0.9);
      g.fillRect(0, 0, arena.width, arena.height);
      this.statusText
        .setOrigin(0, 0)
        .setAlign("left")
        .setFontSize(20)
        .setLineSpacing(7)
        .setWordWrapWidth(400)
        .setPosition(72, 34)
        .setText(this.formatGameOverText(world, uiState))
        .setVisible(true);
      this.detailText
        .setOrigin(0, 0)
        .setAlign("left")
        .setFontSize(17)
        .setPosition(520, 42)
        .setWordWrapWidth(366)
        .setText(this.formatGameOverDetails(uiState))
        .setVisible(true);
      this.drawMenuButtons(g, world, uiState);
    } else if (world.state.status === "upgradeSelect") {
      g.fillStyle(0x020617, 0.9);
      g.fillRect(0, 0, arena.width, arena.height);
      this.statusText
        .setOrigin(0.5)
        .setFontSize(24)
        .setLineSpacing(10)
        .setWordWrapWidth(null)
        .setPosition(arena.width / 2, arena.height / 2 - 164)
        .setText(
          world.progression.buildCompletedAt === null
            ? TEXT.ui.upgradeHeading(world.progression.level)
            : TEXT.ui.extraUpgradeHeading(
                world.progression.extraLevel,
                world.progression.extraCycle,
              ),
        )
        .setVisible(true);
      this.detailText
        .setOrigin(0.5, 0)
        .setAlign("center")
        .setFontSize(15)
        .setPosition(arena.width / 2, 158)
        .setWordWrapWidth(560)
        .setText(
          world.progression.buildCompletedAt === null
            ? this.formatCapstoneProgress(world)
            : `通常ビルド完成 / EXサイクル C${world.progression.extraCycle} / 未取得 ${world.progression.extraCycleRemaining.length}`,
        )
        .setVisible(
          world.progression.buildCompletedAt !== null || world.state.weaponType === "pulse",
        );
      this.drawUpgradeChoiceButtons(g, world);
    } else if (world.state.status === "contractSelect") {
      g.fillStyle(0x020617, 0.94);
      g.fillRect(0, 0, arena.width, arena.height);
      this.statusText
        .setOrigin(0.5)
        .setAlign("center")
        .setFontSize(32)
        .setLineSpacing(8)
        .setWordWrapWidth(arena.width - 160)
        .setPosition(arena.width / 2, 132)
        .setText(TEXT.ui.contractTitle)
        .setVisible(true);
      this.detailText
        .setOrigin(0.5, 0)
        .setAlign("center")
        .setFontSize(17)
        .setPosition(arena.width / 2, 194)
        .setWordWrapWidth(620)
        .setText(TEXT.ui.contractDescription)
        .setVisible(true);
      this.drawMenuButtons(g, world, uiState);
    } else if (world.state.status === "paused") {
      g.fillStyle(0x020617, 0.9);
      g.fillRect(0, 0, arena.width, arena.height);
      this.statusText
        .setOrigin(0.5)
        .setFontSize(34)
        .setLineSpacing(10)
        .setWordWrapWidth(null)
        .setPosition(arena.width / 2, arena.height / 2 - 74)
        .setText(TEXT.ui.paused)
        .setVisible(true);
      this.detailText
        .setOrigin(0, 0)
        .setAlign("left")
        .setFontSize(16)
        .setPosition(650, 150)
        .setWordWrapWidth(250)
        .setText(
          `${TEXT.hud.weaponNames[world.state.weaponType]}\n${this.formatCapstoneProgress(world)}\n${this.formatRecentSelections(world)}`,
        )
        .setVisible(true);
      this.drawMenuButtons(g, world, uiState);
    } else if (world.state.status === "weaponSelect") {
      g.fillStyle(0x05070d, 0.94);
      g.fillRect(0, 0, arena.width, arena.height);
      this.statusText
        .setOrigin(0.5)
        .setAlign("center")
        .setFontSize(32)
        .setLineSpacing(8)
        .setWordWrapWidth(arena.width - 160)
        .setPosition(arena.width / 2, 96)
        .setText(TEXT.ui.weaponSelectTitle)
        .setVisible(true);
      this.detailText
        .setOrigin(0, 0)
        .setAlign("left")
        .setFontSize(17)
        .setPosition(220, 154)
        .setWordWrapWidth(520)
        .setText(TEXT.ui.weaponSelectDescription)
        .setVisible(true);
      this.drawMenuButtons(g, world, uiState);
    } else if (world.state.status === "title") {
      g.fillStyle(0x05070d, 0.86);
      g.fillRect(0, 0, arena.width, arena.height);
      this.statusText
        .setOrigin(0.5)
        .setAlign("center")
        .setFontSize(36)
        .setLineSpacing(8)
        .setWordWrapWidth(arena.width - 160)
        .setPosition(arena.width / 2, 164)
        .setText(`${TEXT.ui.titleScreen}\n${TEXT.ui.endlessMode}`)
        .setVisible(true);
      this.drawMenuButtons(g, world, uiState);
    } else {
      this.statusText.setVisible(false);
    }

    this.hud.render(world, uiState?.secondaryMenu === null || uiState?.secondaryMenu === undefined);
    this.drawCursor(g, pointerWorld);
  }

  private formatGameOverText(world: WorldState, uiState?: PhaserUiState): string {
    const summary = createRunResultSummary(world);
    const record = uiState?.latestRunRecord;
    const bestLine = this.formatBestLine(record, uiState?.previousBest ?? null);
    const lines = [
      TEXT.ui.result.title,
      TEXT.ui.result.scoreTime(summary.score, formatTime(summary.elapsed)),
      bestLine,
      TEXT.ui.result.levelKills(summary.level, summary.enemiesKilled),
      `EX Lv ${summary.extraLevel} / C${summary.extraCycle}   脅威 ${summary.threatTier}   崩壊 ${summary.collapseStage}`,
      TEXT.ui.result.shotsRecovered(summary.shotsFired, summary.hpRecovered),
    ];

    if (summary.lastDamageSource) {
      lines.push(TEXT.ui.result.cause(this.formatDamageSource(summary.lastDamageSource)));
    }

    return lines.filter(Boolean).join("\n");
  }

  private formatGameOverDetails(uiState?: PhaserUiState): string {
    const record = uiState?.latestRunRecord;
    if (!record) return "記録を保存できませんでした";
    const eligibility = record.rankEligibility.eligible
      ? TEXT.ui.rankingEligible
      : TEXT.ui.rankingIneligible(
          record.rankEligibility.reasons.map(formatRankReason).join(" / "),
        );
    return [
      `開始武器: ${TEXT.hud.weaponNames[record.weaponId]}`,
      this.formatRecordCapstone(record),
      this.formatRecordEncounter(record),
      this.formatBuildLine(record),
      this.formatRecordSelections(record),
      `シード: ${record.seed}`,
      `区分: ${record.seedCategory === "fixed" ? "固定シード" : "ランダム"}`,
      eligibility,
      `ルール: ${record.rulesetVersion}`,
      uiState.notice ?? "",
    ].filter(Boolean).join("\n");
  }

  private formatBestLine(record: RunRecord | null | undefined, previousBest: RunRecord | null): string {
    if (!record || !record.rankEligibility.eligible) return "";
    if (previousBest === null) return TEXT.ui.firstRecord;
    const difference = record.score - previousBest.score;
    if (difference > 0) return TEXT.ui.newBest(difference);
    if (difference === 0 && record.elapsed > previousBest.elapsed) {
      return `自己ベスト更新  生存 +${formatTime(record.elapsed - previousBest.elapsed)}`;
    }
    if (difference === 0) return "自己ベストと同点";
    return TEXT.ui.bestDifference(Math.abs(difference));
  }

  private formatBuildLine(record: RunRecord | null | undefined): string {
    if (!record) return "";
    const upgrades = Object.entries(record.upgradeRanks)
      .filter(([, rank]) => rank > 0)
      .sort(([, left], [, right]) => right - left)
      .slice(0, 3)
      .map(([id, rank]) => `${TEXT.upgrades.definitions[id as keyof typeof TEXT.upgrades.definitions].title} ${rank}`);
    const extras = Object.entries(record.extraUpgradeRanks)
      .filter(([, rank]) => rank > 0)
      .map(
        ([id, rank]) =>
          `${TEXT.upgrades.extraDefinitions[id as keyof typeof TEXT.upgrades.extraDefinitions].title} ${rank}`,
      );
    const base = upgrades.length > 0 ? upgrades.join(" / ") : "強化なし";
    return extras.length > 0 ? `ビルド: ${base}\n限界: ${extras.join(" / ")}` : `ビルド: ${base}`;
  }

  private formatRecordCapstone(record: RunRecord): string {
    const metrics = record.capstoneMetrics;
    if (metrics.acquiredAt === null) return "最終強化: 未取得";
    return `最終強化: 反響回路 ${formatTime(metrics.acquiredAt)}  跳弾${metrics.activations} / 追撃${metrics.followUpHits}`;
  }

  private formatRecordEncounter(record: RunRecord): string {
    const metrics = record.encounterMetrics;
    if (metrics.activeStartedAt === null) return "危険イベント: 未到達";
    const contract =
      metrics.contractChoice === "overdrive"
        ? "過負荷"
        : metrics.contractChoice === "standard"
          ? "標準維持"
          : "未選択";
    const events = Object.values(metrics.eventCounts).reduce((sum, count) => sum + count, 0);
    return `危険: ${events}回 / 被ダメ${metrics.damageTakenDuringActive}  崩壊${metrics.peakCollapseStage}  契約:${contract}`;
  }

  private formatRecordSelections(record: RunRecord): string {
    if (record.extraUpgradeSelections.length > 0) {
      const selections = record.extraUpgradeSelections.slice(-3).map((selection) => {
        const title = TEXT.upgrades.extraDefinitions[selection.extraUpgradeId].title;
        return `${formatTime(selection.elapsed)} C${selection.cycle} ${title}${selection.rank}${selection.automatic ? "(自動)" : ""}`;
      });
      return `直近の限界強化: ${selections.join(" > ")}`;
    }
    if (record.upgradeSelections.length === 0) return "選択順: 旧記録のため未記録";
    const selections = record.upgradeSelections.slice(-4).map((selection) => {
      const title = TEXT.upgrades.definitions[selection.upgradeId].title;
      return `${formatTime(selection.elapsed)} ${title}${selection.rank}`;
    });
    return `直近の選択: ${selections.join(" > ")}`;
  }

  private formatCapstoneProgress(world: WorldState): string {
    if (world.state.weaponType !== "pulse" || !this.simulationConfig.features.pulseRicochet) {
      return "最終強化: この武器では未実装";
    }
    if (world.progression.upgradeRanks.pulseRicochet > 0) return TEXT.upgrades.capstoneAcquired;
    const progress = getUpgradeRequirementProgress(
      this.simulationConfig,
      "pulseRicochet",
      world.progression.upgradeRanks,
    )[0];
    return progress
      ? TEXT.upgrades.capstoneProgress(progress.current, progress.required)
      : "最終強化: 条件なし";
  }

  private formatRecentSelections(world: WorldState): string {
    const extraSelections = world.stats.progressionMetrics.extraSelections.slice(-3);
    if (extraSelections.length > 0) {
      return `直近: ${extraSelections
        .map(
          (selection) =>
            `${TEXT.upgrades.extraDefinitions[selection.extraUpgradeId].title}${selection.rank}`,
        )
        .join(" / ")}`;
    }
    const selections = world.stats.progressionMetrics.selections.slice(-3);
    if (selections.length === 0) return "選択履歴: まだなし";
    return `直近: ${selections
      .map((selection) => `${TEXT.upgrades.definitions[selection.upgradeId].title}${selection.rank}`)
      .join(" / ")}`;
  }

  private drawSecondaryMenu(
    g: Phaser.GameObjects.Graphics,
    world: WorldState,
    uiState: PhaserUiState,
  ): void {
    const { width, height } = this.simulationConfig.arena;
    g.fillStyle(0x05070d, 0.96);
    g.fillRect(0, 0, width, height);

    if (uiState.secondaryMenu === "history") {
      this.statusText
        .setOrigin(0, 0)
        .setAlign("left")
        .setFontSize(17)
        .setLineSpacing(6)
        .setWordWrapWidth(width - 128)
        .setPosition(64, 32)
        .setText(this.formatHistory(uiState))
        .setVisible(true);
    } else if (uiState.secondaryMenu === "ranking") {
      this.statusText
        .setOrigin(0, 0)
        .setAlign("left")
        .setFontSize(17)
        .setLineSpacing(6)
        .setWordWrapWidth(width - 128)
        .setPosition(64, 32)
        .setText(this.formatRanking(uiState))
        .setVisible(true);
    } else {
      this.statusText
        .setOrigin(0.5, 0)
        .setAlign("center")
        .setFontSize(28)
        .setLineSpacing(5)
        .setWordWrapWidth(width - 120)
        .setPosition(width / 2, 34)
        .setText(
          `${TEXT.ui.settingsTitle}\n${uiState.profile.displayName ?? "ゲスト"}  ${uiState.profile.id.slice(0, 8)}\n${uiState.notice ?? "選択すると値が切り替わります"}`,
        )
        .setVisible(true);
    }

    this.drawMenuButtons(g, world, uiState);
  }

  private formatHistory(uiState: PhaserUiState): string {
    const lines = [TEXT.ui.historyTitle, ""];
    if (uiState.records.length === 0) {
      lines.push(TEXT.ui.noRecords);
    } else {
      const pageSize = 7;
      const pageCount = Math.max(1, Math.ceil(uiState.records.length / pageSize));
      const start = uiState.historyPage * pageSize;
      const filterLabel =
        uiState.historyWeaponFilter === "all"
          ? "すべて"
          : TEXT.hud.weaponNames[uiState.historyWeaponFilter];
      lines[0] = `${TEXT.ui.historyTitle}  ${filterLabel}  ${uiState.historyPage + 1}/${pageCount}`;
      uiState.records.slice(start, start + pageSize).forEach((record, index) => {
        const eligibility = record.rankEligibility.eligible ? "対象" : "対象外";
        lines.push(
          `${start + index + 1}. ${formatRecordDate(record.capturedAt)}  ${record.score.toString().padStart(6)}点  ${formatTime(record.elapsed)}  Lv${record.level}/EX${record.extraLevel}/C${record.extraCycle}  ${TEXT.hud.weaponNames[record.weaponId]}  ${eligibility}`,
        );
      });
      const latest = uiState.records[0]!;
      lines.push(
        "",
        `最新: ${latest.kills}撃破 / 被ダメージ${latest.damageTaken} / シード${latest.seed}`,
      );
    }
    if (uiState.notice) lines.push("", uiState.notice);
    return lines.join("\n");
  }

  private formatRanking(uiState: PhaserUiState): string {
    const lines = [TEXT.ui.rankingTitle, "エンドレス / 標準 / 現在のルールセット", ""];
    if (uiState.ranking.length === 0) {
      lines.push(TEXT.ui.noRecords);
    } else {
      uiState.ranking.slice(0, 10).forEach((record, index) => {
        lines.push(
          `${String(index + 1).padStart(2)}. ${record.score.toString().padStart(6)}点  ${formatTime(record.elapsed)}  EX${record.extraLevel}/C${record.extraCycle}  ${TEXT.hud.weaponNames[record.weaponId]}  ${formatRecordDate(record.capturedAt)}`,
        );
      });
    }
    if (uiState.notice) lines.push("", uiState.notice);
    return lines.join("\n");
  }

  private drawCollapse(g: Phaser.GameObjects.Graphics, world: WorldState): void {
    const inset = world.encounter.collapse.inset;
    if (inset <= 0) return;
    const { width, height } = this.simulationConfig.arena;
    const bounds = getCollapseSafeBounds(this.simulationConfig, inset);

    g.fillStyle(0x7f1d1d, 0.34);
    g.fillRect(0, 0, width, Math.min(height, inset));
    g.fillRect(0, Math.max(0, height - inset), width, Math.min(height, inset));
    const middleHeight = Math.max(0, height - inset * 2);
    g.fillRect(0, inset, Math.min(width, inset), middleHeight);
    g.fillRect(Math.max(0, width - inset), inset, Math.min(width, inset), middleHeight);

    if (bounds.right > bounds.left && bounds.bottom > bounds.top) {
      g.lineStyle(3, 0xfca5a5, 0.9);
      g.strokeRect(
        bounds.left + 1.5,
        bounds.top + 1.5,
        Math.max(0, bounds.right - bounds.left - 3),
        Math.max(0, bounds.bottom - bounds.top - 3),
      );
    }
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

  private drawOffscreenEnemyIndicators(g: Phaser.GameObjects.Graphics, world: WorldState): void {
    if (world.state.status !== "playing" && world.state.status !== "paused") return;

    const visibleLimit = 8;
    const offscreenEnemies = world.enemies
      .filter((enemy) => this.isOffscreen(enemy))
      .sort((a, b) => this.distanceToPlayer(world, a) - this.distanceToPlayer(world, b))
      .slice(0, visibleLimit);

    for (const enemy of offscreenEnemies) {
      this.drawOffscreenEnemyIndicator(g, world, enemy);
    }
  }

  private isOffscreen(enemy: WorldState["enemies"][number]): boolean {
    const { width, height } = this.simulationConfig.arena;
    return (
      enemy.position.x < 0 ||
      enemy.position.x > width ||
      enemy.position.y < 0 ||
      enemy.position.y > height
    );
  }

  private distanceToPlayer(world: WorldState, enemy: WorldState["enemies"][number]): number {
    return Math.hypot(
      world.player.position.x - enemy.position.x,
      world.player.position.y - enemy.position.y,
    );
  }

  private drawOffscreenEnemyIndicator(
    g: Phaser.GameObjects.Graphics,
    world: WorldState,
    enemy: WorldState["enemies"][number],
  ): void {
    const center = this.getOffscreenIndicatorCenter(enemy);
    const dx = world.player.position.x - enemy.position.x;
    const dy = world.player.position.y - enemy.position.y;
    const distance = Math.max(0.001, Math.hypot(dx, dy));
    const direction = { x: dx / distance, y: dy / distance };
    const perpendicular = { x: -direction.y, y: direction.x };
    const size = 11;
    const spread = 7;
    const tail = 7;
    const points = [
      {
        x: center.x + direction.x * size,
        y: center.y + direction.y * size,
      },
      {
        x: center.x - direction.x * tail + perpendicular.x * spread,
        y: center.y - direction.y * tail + perpendicular.y * spread,
      },
      {
        x: center.x - direction.x * tail - perpendicular.x * spread,
        y: center.y - direction.y * tail - perpendicular.y * spread,
      },
    ];
    const view = this.viewConfig.enemy[enemy.typeId];

    g.fillStyle(0x020617, 0.72);
    g.fillCircle(center.x, center.y, 15);
    this.drawPolygon(g, points, view.color, 0xf8fafc);
    g.lineStyle(1, view.stroke, 0.95);
    g.strokeCircle(center.x, center.y, 15);
  }

  private getOffscreenIndicatorCenter(enemy: WorldState["enemies"][number]): Vec2 {
    const { width, height } = this.simulationConfig.arena;
    const padding = 18;
    const hud = { x: 16, y: 14, width: 348, height: 94 };
    const margin = 16;
    const center = {
      x: Math.max(padding, Math.min(width - padding, enemy.position.x)),
      y: Math.max(padding, Math.min(height - padding, enemy.position.y)),
    };

    if (!this.overlapsHud(center, hud, margin)) return center;

    if (enemy.position.y < 0) {
      return { x: hud.x + hud.width + margin + 15, y: center.y };
    }
    if (enemy.position.x < 0) {
      return { x: center.x, y: hud.y + hud.height + margin + 15 };
    }

    return center;
  }

  private overlapsHud(
    position: Vec2,
    hud: { x: number; y: number; width: number; height: number },
    margin: number,
  ): boolean {
    return (
      position.x >= hud.x - margin &&
      position.x <= hud.x + hud.width + margin &&
      position.y >= hud.y - margin &&
      position.y <= hud.y + hud.height + margin
    );
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
    if (source.kind === "contact") {
      return TEXT.ui.damageSource.enemyContact(TEXT.ui.enemyNames[source.enemyType]);
    }
    if (source.kind === "projectile") return TEXT.ui.damageSource.enemyProjectile;
    return TEXT.ui.damageSource.collapse(source.stage);
  }

  private drawMenuButtons(
    g: Phaser.GameObjects.Graphics,
    world: WorldState,
    uiState?: PhaserUiState,
  ): void {
    const { width, height } = this.simulationConfig.arena;
    const labels = this.createMenuLabels(uiState);
    const buttons = getMenuButtons(
      world.state.status,
      width,
      height,
      labels,
      uiState?.secondaryMenu ?? null,
    );
    buttons.forEach((button, index) => {
      this.drawButton(
        g,
        button.x,
        button.y,
        button.width,
        button.height,
        button.action === uiState?.focusedMenuAction,
      );
      const text = this.menuButtonTexts[index]!;
      text
        .setText(button.label)
        .setPosition(button.x + button.width / 2, button.y + button.height / 2)
        .setVisible(true);
    });
  }

  private createMenuLabels(uiState?: PhaserUiState): Partial<Record<MenuAction, string>> {
    if (!uiState) return TEXT.ui.menu;
    const percent = (value: number, muted = false) =>
      muted ? "オフ" : `${Math.round(value * 100)}%`;
    const enabled = (value: boolean) => (value ? "オン" : "オフ");

    return {
      ...TEXT.ui.menu,
      clearHistory: uiState.historyClearPending ? "もう一度押して消去" : TEXT.ui.menu.clearHistory,
      clearRankings: uiState.rankingClearPending
        ? "もう一度押して消去"
        : TEXT.ui.menu.clearRankings,
      settingsBgm: `${TEXT.ui.menu.settingsBgm}  ${percent(uiState.settings.bgmVolume, uiState.settings.bgmMuted)}`,
      settingsSfx: `${TEXT.ui.menu.settingsSfx}  ${percent(uiState.settings.sfxVolume, uiState.settings.sfxMuted)}`,
      settingsShake: `${TEXT.ui.menu.settingsShake}  ${percent(uiState.settings.shakeIntensity)}`,
      settingsFlash: `${TEXT.ui.menu.settingsFlash}  ${percent(uiState.settings.flashIntensity)}`,
      settingsAutoFire: `${TEXT.ui.menu.settingsAutoFire}  ${enabled(uiState.settings.autoFireEnabled)}`,
      historyFilterAll:
        uiState.historyWeaponFilter === "all" ? "[すべて]" : TEXT.ui.menu.historyFilterAll,
      historyFilterPulse:
        uiState.historyWeaponFilter === "pulse" ? "[パルス]" : TEXT.ui.menu.historyFilterPulse,
      historyFilterSpread:
        uiState.historyWeaponFilter === "spread" ? "[拡散]" : TEXT.ui.menu.historyFilterSpread,
    };
  }

  private drawUpgradeChoiceButtons(g: Phaser.GameObjects.Graphics, world: WorldState): void {
    const { width, height } = this.simulationConfig.arena;
    const buttons = getUpgradeChoiceButtons(
      world.progression.pendingUpgradeChoices.length,
      width,
      height,
    );
    buttons.forEach((button) => {
      const choiceId = world.progression.pendingUpgradeChoices[button.index]!;
      if (isExtraUpgradeId(choiceId)) {
        const definition = this.simulationConfig.extraUpgrades[choiceId];
        const display = TEXT.upgrades.extraDefinitions[choiceId];
        const currentRank = world.progression.extraUpgradeRanks[choiceId];
        const nextRank = currentRank + 1;
        const rank = definition.maxRank === null ? `${nextRank}` : `${nextRank}/${definition.maxRank}`;
        this.drawButton(g, button.x, button.y, button.width, button.height);
        this.upgradeChoiceTexts[button.index]!
          .setText(
            `${button.index + 1}. [${TEXT.upgrades.extraCategoryLabel}] ${display.title}  ${TEXT.ui.rank} ${rank}\n${display.description}\n${this.formatExtraUpgradePreview(definition.effect, currentRank)}`,
          )
          .setPosition(button.x + button.width / 2, button.y + button.height / 2)
          .setVisible(true);
        return;
      }

      const upgradeId = choiceId;
      const upgrade = this.simulationConfig.upgrades[upgradeId];
      const upgradeDisplay = TEXT.upgrades.definitions[upgradeId];
      const currentRank = world.progression.upgradeRanks[upgradeId];
      const category = TEXT.upgrades.categoryLabels[upgrade.category];
      const preview = formatUpgradePreview(
        createUpgradePreview(world, this.simulationConfig, upgradeId),
        TEXT.upgrades.preview.labels,
        {
          perSecond: TEXT.upgrades.preview.perSecond,
          separator: TEXT.upgrades.preview.separator,
        },
      );
      this.drawButton(g, button.x, button.y, button.width, button.height);
      this.upgradeChoiceTexts[button.index]!
        .setText(
          `${button.index + 1}. [${category}] ${upgradeDisplay.title}  ${TEXT.ui.rank} ${currentRank + 1}/${
            upgrade.maxRank
          }\n${upgradeDisplay.description}\n${preview}`,
        )
        .setPosition(button.x + button.width / 2, button.y + button.height / 2)
        .setVisible(true);
    });
  }

  private formatExtraUpgradePreview(
    effect: SimulationConfig["extraUpgrades"][keyof SimulationConfig["extraUpgrades"]]["effect"],
    currentRank: number,
  ): string {
    const nextRank = currentRank + 1;
    if (effect.type === "projectileDamage") {
      return `弾ダメージ x${(1 + effect.amountPerRank * currentRank).toFixed(2)} -> x${(
        1 +
        effect.amountPerRank * nextRank
      ).toFixed(2)}`;
    }
    if (effect.type === "fireRate" || effect.type === "moveSpeed") {
      const current = Math.min(effect.maximumBonus, effect.amountPerRank * currentRank);
      const next = Math.min(effect.maximumBonus, effect.amountPerRank * nextRank);
      const label = effect.type === "fireRate" ? "追加連射" : "追加移動速度";
      return `${label} +${Math.round(current * 100)}% -> +${Math.round(next * 100)}%`;
    }
    return `追加HP +${effect.amountPerRank * currentRank} -> +${effect.amountPerRank * nextRank}`;
  }

  private drawButton(
    g: Phaser.GameObjects.Graphics,
    x: number,
    y: number,
    width: number,
    height: number,
    focused = false,
  ): void {
    g.fillStyle(focused ? 0x164e63 : 0x1f2937, 0.96);
    g.fillRoundedRect(x, y, width, height, 6);
    g.lineStyle(focused ? 3 : 2, focused ? 0xfacc15 : 0x38bdf8, 0.95);
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

function formatRankReason(reason: RankIneligibilityReason): string {
  switch (reason) {
    case "debugRun":
      return "デバッグ操作";
    case "automatedTest":
      return "自動テスト";
    case "nonStandardRuleset":
      return "標準外ルール";
  }
}

function formatRecordDate(capturedAt: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(capturedAt);
  if (!match) return capturedAt.slice(0, 16);
  return `${match[2]}/${match[3]} ${match[4]}:${match[5]}`;
}
