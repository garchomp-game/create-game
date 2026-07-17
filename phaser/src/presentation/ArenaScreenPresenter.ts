import type { MenuAction, SecondaryMenu } from "../application/ArenaMenuTypes";
import { APP_VERSION, RELEASE_CHANNEL_LABEL } from "../config/version";
import type { RankIneligibilityReason, RunRecord } from "../domain/runRecords";
import type {
  GameStatus,
  PlayerDamageSource,
  SimulationConfig,
  WorldState,
} from "../domain/types";
import { formatTime } from "../format/time";
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
  | "contractSelect"
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
    case "contractSelect":
      return { ...base, kind: "contractSelect", statusText: null, detailText: null };
    case "paused":
      return {
        ...base,
        kind: "paused",
        statusText: TEXT.ui.paused,
        detailText: `${TEXT.hud.weaponNames[world.state.weaponType]}\n${formatCapstoneProgress(world, simulationConfig)}\n${formatRecentSelections(world)}`,
      };
    case "weaponSelect":
      return { ...base, kind: "weaponSelect", statusText: null, detailText: null };
    case "title":
      return {
        ...base,
        kind: "title",
        statusText: `${TEXT.ui.titleScreen}\nENDLESS / EXPEDITION\n生存限界か、最初の作戦か\n${RELEASE_CHANNEL_LABEL} v${uiState?.releaseIdentity.appVersion ?? APP_VERSION}`,
        detailText: null,
      };
    default:
      return { ...base, kind: "none", statusText: null, detailText: null };
  }
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
    `シード: ${record.seed}`,
    `区分: ${record.seedCategory === "fixed" ? "固定シード" : "ランダム"}`,
    eligibility,
    `アプリ: ${record.appVersion} / build ${record.buildCommit}`,
    `ルール: ${record.rulesetVersion}`,
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
      ? `\n指揮艦: PHASE ${boss.phaseReached} / HP ${Math.ceil(boss.remainingHp ?? 0)} / 最終攻撃 ${formatBossAttack(boss.lastAttackId)} / 被弾 ${Object.values(boss.playerHitsByAttack).reduce((sum, count) => sum + count, 0)}`
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
      const eligibility = record.rankEligibility.eligible ? "対象" : "対象外";
      lines.push(
        `${start + index + 1}. ${formatRecordDate(record.capturedAt)}  ${record.score.toString().padStart(6)}点  ${formatTime(record.elapsed)}  ${formatModeName(record.modeId)}  Lv${record.level}/EX${record.extraLevel}/C${record.extraCycle}  ${TEXT.hud.weaponNames[record.weaponId]}  ${eligibility}`,
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
  const context = uiState.runContext ?? uiState.ranking[0] ?? uiState.latestRunRecord;
  const lines = [
    TEXT.ui.rankingTitle,
    `${formatModeName(context?.modeId)} / ${formatStageName(context?.stageId)} / 標準`,
    "",
  ];
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
  if (modeId === "expedition") return "初回遠征";
  if (modeId === "endless") return "エンドレス";
  return modeId ?? "未選択";
}

function formatStageName(stageId: string | null | undefined): string {
  if (stageId === "first-expedition") return "最初の出撃";
  if (stageId === "arena-default") return "標準アリーナ";
  return stageId ?? "未選択";
}

function formatActName(actId: string | null): string {
  const names: Record<string, string> = {
    deployment: "Act 1 展開",
    "first-assault": "Act 2 第一波",
    counterattack: "Act 3 反撃",
    breakthrough: "Act 4 突破",
    "command-ship": "Act 5 指揮艦決戦",
  };
  return actId ? (names[actId] ?? actId) : "未到達";
}

function formatBossAttack(
  attackId: "targeted-salvo" | "escort-pincer" | null,
): string {
  if (attackId === "targeted-salvo") return "照準斉射";
  if (attackId === "escort-pincer") return "挟撃護衛";
  return "未実行";
}
