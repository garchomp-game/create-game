import type { RankIneligibilityReason, RunRecord } from "../domain/runRecords";
import type { PlayerDamageSource, WorldState } from "../domain/types";
import { formatTime } from "../format/time";
import { TEXT } from "../lang";
import { createRunResultSummary } from "../simulation/resultSummary";
import type { ArenaUiState } from "./ArenaUiState";
import {
  formatActName,
  formatBossAttack,
  formatModeName,
  formatStageName,
} from "./ArenaRecordFormatters";

export type ArenaResultViewModel = {
  statusText: string;
  detailText: string;
};

export function createArenaResultViewModel(
  world: WorldState,
  uiState?: ArenaUiState,
): ArenaResultViewModel {
  return {
    statusText: formatGameOverText(world, uiState),
    detailText: formatGameOverDetails(uiState),
  };
}

function formatGameOverText(world: WorldState, uiState?: ArenaUiState): string {
  const summary = createRunResultSummary(world);
  const record = uiState?.latestRunRecord;
  const bestLine = formatBestLine(record, uiState?.previousBest ?? null);
  const expeditionOutcome = world.stats.encounterMetrics.expedition?.outcome;
  const lines = [
    expeditionOutcome === "victory"
      ? "作戦完遂"
      : expeditionOutcome === "defeat"
        ? "遠征失敗"
        : TEXT.ui.result.title,
    TEXT.ui.result.scoreTime(summary.score, formatTime(summary.elapsed)),
    bestLine,
    TEXT.ui.result.levelKills(summary.level, summary.enemiesKilled),
    `EX Lv ${summary.extraLevel} / C${summary.extraCycle}   脅威 ${summary.threatTier}   崩壊 ${summary.collapseStage}`,
    TEXT.ui.result.shotsRecovered(summary.shotsFired, summary.hpRecovered),
  ];

  const expedition = world.stats.encounterMetrics.expedition;
  if (expedition?.outcome === "victory") {
    lines.splice(
      2,
      0,
      `完遂 +${expedition.clearScoreBonus.toLocaleString()} / 速攻 +${expedition.timeScoreBonus.toLocaleString()}`,
      `指揮艦撃破 ${formatTime(expedition.bossFightDuration ?? 0)}`,
    );
  }

  if (summary.lastDamageSource) {
    lines.push(TEXT.ui.result.cause(formatDamageSource(summary.lastDamageSource)));
  }

  return lines.filter(Boolean).join("\n");
}

function formatGameOverDetails(uiState?: ArenaUiState): string {
  const record = uiState?.latestRunRecord;
  if (!record) return "記録を保存できませんでした";
  const eligibility = record.rankEligibility.eligible
    ? TEXT.ui.rankingEligible
    : TEXT.ui.rankingIneligible(
        record.rankEligibility.reasons.map(formatRankReason).join(" / "),
      );
  return [
    `モード: ${formatModeName(record.modeId)} / ステージ: ${formatStageName(record.stageId)}`,
    `開始武器: ${TEXT.hud.weaponNames[record.weaponId]}`,
    formatRecordCapstone(record),
    formatRecordEncounter(record),
    formatBuildLine(record),
    formatRecordSelections(record),
    `シード: ${record.seed} / ${record.seedCategory === "fixed" ? "固定" : "ランダム"}`,
    eligibility,
    `版: ${record.appVersion} / ${record.buildCommit.slice(0, 8)}`,
    uiState.notice ?? "",
  ].filter(Boolean).join("\n");
}

function formatBestLine(
  record: RunRecord | null | undefined,
  previousBest: RunRecord | null,
): string {
  if (!record || !record.rankEligibility.eligible) return "";
  if (previousBest === null) return TEXT.ui.firstRecord;
  const difference = record.score - previousBest.score;
  if (difference > 0) return TEXT.ui.newBest(difference);
  if (
    difference === 0 &&
    record.modeId === "expedition" &&
    previousBest.modeId === "expedition" &&
    record.elapsed < previousBest.elapsed
  ) {
    return `自己ベスト更新  完遂 -${formatTime(previousBest.elapsed - record.elapsed)}`;
  }
  if (difference === 0 && record.elapsed > previousBest.elapsed) {
    return `自己ベスト更新  生存 +${formatTime(record.elapsed - previousBest.elapsed)}`;
  }
  if (difference === 0) return "自己ベストと同点";
  return TEXT.ui.bestDifference(Math.abs(difference));
}

function formatBuildLine(record: RunRecord | null | undefined): string {
  if (!record) return "";
  const upgrades = Object.entries(record.upgradeRanks)
    .filter(([, rank]) => rank > 0)
    .sort(([, left], [, right]) => right - left)
    .slice(0, 3)
    .map(
      ([id, rank]) =>
        `${TEXT.upgrades.definitions[id as keyof typeof TEXT.upgrades.definitions].title} ${rank}`,
    );
  const extras = Object.entries(record.extraUpgradeRanks)
    .filter(([, rank]) => rank > 0)
    .map(
      ([id, rank]) =>
        `${TEXT.upgrades.extraDefinitions[id as keyof typeof TEXT.upgrades.extraDefinitions].title} ${rank}`,
    );
  const base = upgrades.length > 0 ? upgrades.join(" / ") : "強化なし";
  return extras.length > 0
    ? `ビルド: ${base}\n限界: ${extras.join(" / ")}`
    : `ビルド: ${base}`;
}

function formatRecordCapstone(record: RunRecord): string {
  const metrics = record.capstoneMetrics;
  if (metrics.acquiredAt === null || metrics.upgradeId === null) return "最終強化: 未取得";
  const title = TEXT.upgrades.definitions[metrics.upgradeId].title;
  if (metrics.upgradeId === "spreadSweep") {
    return `最終強化: ${title} ${formatTime(metrics.acquiredAt)}  発動${metrics.spreadSweepTriggers} / 消費${metrics.spreadSweepConsumes}`;
  }
  return `最終強化: ${title} ${formatTime(metrics.acquiredAt)}  障${metrics.obstacleRicochets}→${metrics.obstacleFollowUpHits} / 外${metrics.boundaryRicochets}→${metrics.boundaryFollowUpHits} / 追撃破${metrics.obstacleFollowUpKills + metrics.boundaryFollowUpKills}`;
}

function formatRecordEncounter(record: RunRecord): string {
  const metrics = record.encounterMetrics;
  if (metrics.expedition) {
    const expedition = metrics.expedition;
    const outcome =
      expedition.outcome === "victory"
        ? "作戦完遂"
        : expedition.outcome === "defeat"
          ? "敗退"
          : "進行中";
    const boss = metrics.boss;
    const bossLine = boss?.spawnedAt !== null && boss?.spawnedAt !== undefined
      ? `\n指揮艦: P${boss.phaseReached} / HP ${Math.ceil(boss.remainingHp ?? 0)} / 終 ${formatBossAttack(boss.lastAttackId)} / 被弾 ${Object.values(boss.playerHitsByAttack).reduce((sum, count) => sum + count, 0)}`
      : "";
    return `遠征: ${outcome} / ${formatActName(expedition.reachedActId)} / 遭遇${expedition.cardsCompleted}/${expedition.cardsSelected} / 編隊${expedition.structuredEnemiesSpawned}${bossLine}`;
  }
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

function formatRecordSelections(record: RunRecord): string {
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

function formatDamageSource(source: PlayerDamageSource): string {
  if (source.kind !== "collapse" && source.bossAttackId) {
    return `指揮艦 ${formatBossAttack(source.bossAttackId)}`;
  }
  if (source.kind === "contact") {
    if (source.bossId) return "指揮艦 接触";
    return TEXT.ui.damageSource.enemyContact(TEXT.ui.enemyNames[source.enemyType]);
  }
  if (source.kind === "projectile") return TEXT.ui.damageSource.enemyProjectile;
  return TEXT.ui.damageSource.collapse(source.stage);
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
