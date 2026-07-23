import type { MenuAction, SecondaryMenu } from "../application/ArenaMenuTypes";
import {
  compareRunPerformance,
  getExpeditionTacticalScore,
  isRankableRun,
} from "../application/runRecords";
import { APP_VERSION, RELEASE_CHANNEL_LABEL } from "../config/version";
import { toRunCentiseconds } from "../domain/runRecords";
import type { RankIneligibilityReason, RunRecord } from "../domain/runRecords";
import type {
  GameStatus,
  PlayerDamageSource,
  SimulationConfig,
  WorldState,
} from "../domain/types";
import type { TutorialSnapshot } from "../domain/tutorial";
import {
  formatRunCentiseconds,
  formatTime,
  formatTimePrecise,
} from "../format/time";
import { TEXT } from "../lang";
import { getUpgradeRequirementProgress } from "../simulation/buildComposer";
import { createRunResultSummary } from "../simulation/resultSummary";
import type { ArenaUiState } from "./ArenaUiState";

export type ArenaScreenKind =
  | "none"
  | "history"
  | "ranking"
  | "settings"
  | "gameOver"
  | "upgradeSelect"
  | "protocolSelect"
  | "evolutionSelect"
  | "contractSelect"
  | "trainingComplete"
  | "paused"
  | "weaponSelect"
  | "title";

export type ArenaScreenViewModel = {
  kind: ArenaScreenKind;
  status: GameStatus;
  secondaryMenu: SecondaryMenu | null;
  statusText: string | null;
  detailText: string | null;
  menuLabels: Partial<Record<MenuAction, string>>;
  focusedMenuAction: MenuAction | null;
};

export function createArenaScreenViewModel(
  world: WorldState,
  simulationConfig: SimulationConfig,
  uiState?: ArenaUiState,
  tutorialSnapshot: TutorialSnapshot | null = null,
): ArenaScreenViewModel {
  const secondaryMenu = uiState?.secondaryMenu ?? null;
  const base = {
    status: world.state.status,
    secondaryMenu,
    menuLabels: createMenuLabels(uiState),
    focusedMenuAction: uiState?.focusedMenuAction ?? null,
  };

  if (secondaryMenu === "history") {
    return {
      ...base,
      kind: "history",
      statusText: formatHistory(uiState!),
      detailText: null,
    };
  }
  if (secondaryMenu === "ranking") {
    return {
      ...base,
      kind: "ranking",
      statusText: formatRanking(uiState!),
      detailText: null,
    };
  }
  if (secondaryMenu === "settings") {
    return {
      ...base,
      kind: "settings",
      statusText: `${TEXT.ui.settingsTitle}\n${uiState!.profile.displayName ?? "ゲスト"}  ${uiState!.profile.id.slice(0, 8)}\n${uiState!.notice ?? "選択すると値が切り替わります"}`,
      detailText: null,
    };
  }

  switch (world.state.status) {
    case "gameOver":
      return {
        ...base,
        kind: "gameOver",
        statusText: formatGameOverText(world, uiState),
        detailText: formatGameOverDetails(uiState),
      };
    case "upgradeSelect":
      return { ...base, kind: "upgradeSelect", statusText: null, detailText: null };
    case "protocolSelect":
      return { ...base, kind: "protocolSelect", statusText: null, detailText: null };
    case "evolutionSelect":
      return { ...base, kind: "evolutionSelect", statusText: null, detailText: null };
    case "contractSelect":
      return { ...base, kind: "contractSelect", statusText: null, detailText: null };
    case "trainingComplete":
      return {
        ...base,
        kind: "trainingComplete",
        statusText: `${TEXT.ui.trainingCompleteTitle}\n${TEXT.ui.trainingCompleteDescription}`,
        detailText: null,
        menuLabels: {
          ...base.menuLabels,
          start: "武器を選んでエンドレスへ",
          title: "タイトルへ戻る",
        },
      };
    case "paused": {
      const trainingPaused = Boolean(
        tutorialSnapshot && tutorialSnapshot.phase !== "complete",
      );
      return {
        ...base,
        kind: "paused",
        statusText: trainingPaused ? TEXT.ui.trainingPaused : TEXT.ui.paused,
        detailText: `${TEXT.hud.weaponNames[world.state.weaponType]}\n${formatCapstoneProgress(world, simulationConfig)}\n${formatRecentSelections(world)}`,
        menuLabels: trainingPaused
          ? {
              ...base.menuLabels,
              resume:
                tutorialSnapshot?.stepId === "chooseUpgrade"
                  ? "強化選択へ戻る"
                  : "訓練を再開",
              restart: "基本訓練をやり直す",
              title: "訓練を中断してタイトルへ",
            }
          : base.menuLabels,
      };
    }
    case "weaponSelect":
      return { ...base, kind: "weaponSelect", statusText: null, detailText: null };
    case "title":
      return {
        ...base,
        kind: "title",
        statusText: `${TEXT.ui.titleScreen}\nENDLESS / EXPEDITION / TRAINING\n生存限界か、最終決戦か\n${RELEASE_CHANNEL_LABEL} v${uiState?.releaseIdentity.appVersion ?? APP_VERSION}`,
        detailText: null,
      };
    default:
      return { ...base, kind: "none", statusText: null, detailText: null };
  }
}

function formatGameOverText(world: WorldState, uiState?: ArenaUiState): string {
  const summary = createRunResultSummary(world);
  const record = uiState?.latestRunRecord;
  const bestLine = formatBestLine(
    record,
    uiState?.previousBest ?? null,
    uiState?.previousWeaponBest ?? null,
  );
  const expeditionOutcome = world.stats.encounterMetrics.expedition?.outcome;
  const expedition = world.stats.encounterMetrics.expedition;
  const primaryResult = expedition
    ? `${formatTimePrecise(summary.elapsed)} / 戦術 ${expedition.tacticalScore.toLocaleString()}点`
    : TEXT.ui.result.scoreTime(summary.score, formatTime(summary.elapsed));
  const lines = [
    expeditionOutcome === "victory"
      ? "作戦完遂"
      : expeditionOutcome === "defeat"
        ? "遠征失敗"
        : TEXT.ui.result.title,
    primaryResult,
    bestLine,
    TEXT.ui.result.levelKills(summary.level, summary.enemiesKilled),
    `EX Lv ${summary.extraLevel} / C${summary.extraCycle}   脅威 ${summary.threatTier}   崩壊 ${summary.collapseStage}`,
    TEXT.ui.result.shotsRecovered(summary.shotsFired, summary.hpRecovered),
  ];

  if (expedition?.outcome === "victory") {
    lines.splice(
      2,
      0,
      `時間メダル ${formatTimeMedal(expedition.timeMedal)} / 完遂 +${expedition.clearScoreBonus.toLocaleString()}`,
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
  const eligibility = isRankableRun(record)
    ? TEXT.ui.rankingEligible
    : TEXT.ui.rankingIneligible(formatRankIneligibility(record));
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
    `ルール: ${record.rulesetVersion}`,
    uiState.notice ?? "",
  ].filter(Boolean).join("\n");
}

function formatBestLine(
  record: RunRecord | null | undefined,
  previousBest: RunRecord | null,
  previousWeaponBest: RunRecord | null,
): string {
  if (!record || !isRankableRun(record)) return "";
  const weaponLabel = TEXT.hud.weaponNames[record.weaponId];
  return [
    formatBestComparison("総合", record, previousBest),
    formatBestComparison(weaponLabel, record, previousWeaponBest),
  ].join(" / ");
}

function formatBestComparison(
  label: string,
  record: RunRecord,
  previousBest: RunRecord | null,
): string {
  if (previousBest === null) return `${label} 初回記録`;
  const comparison = compareRunPerformance(record, previousBest);
  if (record.modeId === "expedition") {
    const elapsedDifference =
      toRunCentiseconds(record.elapsed) - toRunCentiseconds(previousBest.elapsed);
    if (comparison < 0) {
      return elapsedDifference < 0
        ? `${label}PB更新 -${formatRunCentiseconds(-elapsedDifference)}`
        : `${label}PB更新`;
    }
    if (comparison === 0) return `${label}PBと同記録`;
    if (elapsedDifference > 0) {
      return `${label}PBまで +${formatRunCentiseconds(elapsedDifference)}`;
    }
    const tacticalGap =
      getExpeditionTacticalScore(previousBest) - getExpeditionTacticalScore(record);
    return tacticalGap > 0
      ? `${label}PBまで 戦術${tacticalGap.toLocaleString()}点`
      : `${label}PB未更新`;
  }

  const scoreDifference = record.score - previousBest.score;
  if (comparison < 0) {
    return scoreDifference > 0
      ? `${label}PB更新 +${scoreDifference.toLocaleString()}点`
      : `${label}PB更新 生存+${formatTime(record.elapsed - previousBest.elapsed)}`;
  }
  if (comparison === 0) return `${label}PBと同記録`;
  return `${label}PBまで ${Math.abs(scoreDifference).toLocaleString()}点`;
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

function formatCapstoneProgress(world: WorldState, simulationConfig: SimulationConfig): string {
  const capstoneId =
    world.state.weaponType === "pulse"
      ? "pulseRicochet"
      : world.state.weaponType === "spread"
        ? "spreadSweep"
        : null;
  if (
    capstoneId === null ||
    (capstoneId === "pulseRicochet" && !simulationConfig.features.pulseRicochet) ||
    (capstoneId === "spreadSweep" && !simulationConfig.features.spreadSweep)
  ) {
    return "最終強化: この武器では未実装";
  }
  const title = TEXT.upgrades.definitions[capstoneId].title;
  if (world.progression.upgradeRanks[capstoneId] > 0) {
    return TEXT.upgrades.capstoneAcquired(title);
  }
  const progress = getUpgradeRequirementProgress(
    simulationConfig,
    capstoneId,
    world.progression.upgradeRanks,
  )[0];
  return progress
    ? TEXT.upgrades.capstoneProgress(progress.current, progress.required)
    : "最終強化: 条件なし";
}

function formatRecentSelections(world: WorldState): string {
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
    .map(
      (selection) => `${TEXT.upgrades.definitions[selection.upgradeId].title}${selection.rank}`,
    )
    .join(" / ")}`;
}

function formatHistory(uiState: ArenaUiState): string {
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
    lines[0] =
      `${TEXT.ui.historyTitle}  ${filterLabel}  ${uiState.historyPage + 1}/${pageCount}`;
    uiState.records.slice(start, start + pageSize).forEach((record, index) => {
      const eligibility = isRankableRun(record)
        ? "PB対象"
        : `PB対象外: ${formatRankIneligibility(record)}`;
      const recordResult = record.modeId === "expedition"
        ? `${record.encounterMetrics.expedition?.outcome === "victory" ? "完遂" : "敗退"} ${formatTimePrecise(record.elapsed)}  戦術${getExpeditionTacticalScore(record).toString().padStart(6)}点`
        : `${record.score.toString().padStart(6)}点  ${formatTime(record.elapsed)}`;
      lines.push(
        `${start + index + 1}. ${formatRecordDate(record.capturedAt)}  ${recordResult}  ${formatModeName(record.modeId)}  Lv${record.level}/EX${record.extraLevel}/C${record.extraCycle}  ${TEXT.hud.weaponNames[record.weaponId]}  ${eligibility}`,
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

function formatRanking(uiState: ArenaUiState): string {
  const context = uiState.rankingQuery;
  const scope = context?.comparisonScope === "weapon"
    ? `${context.weaponId ? TEXT.hud.weaponNames[context.weaponId] : "武器"}別`
    : "総合";
  const seed = context?.seedCategory === "fixed"
    ? `固定シード ${context.seed ?? "?"}`
    : "ランダムシード";
  const lines = [
    `${TEXT.ui.rankingTitle}  ${uiState.rankingBoardCount === 0 ? "0/0" : `${uiState.rankingBoardIndex + 1}/${uiState.rankingBoardCount}`}`,
    `${formatModeName(context?.modeId)} / ${formatStageName(context?.stageId)} / ${formatDifficultyName(context?.difficultyId)}`,
    `${scope} / ${seed}`,
    `ルール: ${context?.rulesetVersion ?? uiState.releaseIdentity.rulesetVersion}`,
    "",
  ];
  if (uiState.ranking.length === 0) {
    lines.push(TEXT.ui.noRecords);
  } else {
    uiState.ranking.slice(0, 10).forEach((record, index) => {
      const rankedResult = record.modeId === "expedition"
        ? `${formatTimePrecise(record.elapsed)}  戦術${getExpeditionTacticalScore(record).toString().padStart(6)}点  ${formatTimeMedal(record.encounterMetrics.expedition?.timeMedal ?? null)}`
        : `${record.score.toString().padStart(6)}点  ${formatTime(record.elapsed)}`;
      lines.push(
        `${String(index + 1).padStart(2)}. ${rankedResult}  EX${record.extraLevel}/C${record.extraCycle}  ${TEXT.hud.weaponNames[record.weaponId]}  ${formatRecordDate(record.capturedAt)}`,
      );
    });
  }
  if (uiState.notice) lines.push("", uiState.notice);
  return lines.join("\n");
}

function formatDifficultyName(difficultyId: string | undefined): string {
  if (!difficultyId || difficultyId === "standard") return "標準";
  return difficultyId;
}

function formatRankIneligibility(record: RunRecord): string {
  if (
    record.modeId === "expedition" &&
    record.encounterMetrics.expedition?.outcome !== "victory"
  ) {
    return "遠征未完遂";
  }
  return record.rankEligibility.reasons.map(formatRankReason).join(" / ") || "対象外記録";
}

function formatTimeMedal(medal: "gold" | "silver" | "bronze" | null): string {
  if (medal === "gold") return "金";
  if (medal === "silver") return "銀";
  if (medal === "bronze") return "銅";
  return "なし";
}

function createMenuLabels(
  uiState?: ArenaUiState,
): Partial<Record<MenuAction, string>> {
  if (!uiState) return TEXT.ui.menu;
  const percent = (value: number, muted = false) =>
    muted ? "オフ" : `${Math.round(value * 100)}%`;
  const enabled = (value: boolean) => (value ? "オン" : "オフ");

  return {
    ...TEXT.ui.menu,
    clearHistory: uiState.historyClearPending
      ? "もう一度押して消去"
      : TEXT.ui.menu.clearHistory,
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

function formatRecordDate(capturedAt: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(capturedAt);
  if (!match) return capturedAt.slice(0, 16);
  return `${match[2]}/${match[3]} ${match[4]}:${match[5]}`;
}

function formatModeName(modeId: string | null | undefined): string {
  if (modeId === "expedition") return "最終遠征";
  if (modeId === "endless") return "エンドレス";
  return modeId ?? "未選択";
}

function formatStageName(stageId: string | null | undefined): string {
  if (stageId === "final-expedition") return "第10ステージ 最終遠征";
  if (stageId === "arena-default") return "標準アリーナ";
  return stageId ?? "未選択";
}

function formatActName(actId: string | null): string {
  const names: Record<string, string> = {
    "perimeter-watch": "Act 1 四方警戒",
    "first-assault": "Act 2 重装襲来",
    counterattack: "Act 3 反撃",
    breakthrough: "Act 4 包囲突破",
    "command-ship": "Act 5 最終決戦",
  };
  return actId ? (names[actId] ?? actId) : "未到達";
}

function formatBossAttack(
  attackId: "targeted-salvo" | "escort-pincer" | "command-pulse" | null,
): string {
  if (attackId === "targeted-salvo") return "照準斉射";
  if (attackId === "escort-pincer") return "挟撃護衛";
  if (attackId === "command-pulse") return "制圧衝撃波";
  return "未実行";
}
