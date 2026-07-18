import type { MenuAction, SecondaryMenu } from "../application/ArenaMenuTypes";
import { formatTime } from "../format/time";
import { TEXT } from "../lang";
import type { ArenaUiState } from "./ArenaUiState";
import {
  formatModeName,
  formatRecordDate,
  formatStageName,
} from "./ArenaRecordFormatters";

export type ArenaSecondaryMenuViewModel = {
  kind: SecondaryMenu;
  statusText: string;
};

export function createArenaSecondaryMenuViewModel(
  secondaryMenu: SecondaryMenu,
  uiState: ArenaUiState,
): ArenaSecondaryMenuViewModel {
  if (secondaryMenu === "history") {
    return { kind: secondaryMenu, statusText: formatHistory(uiState) };
  }
  if (secondaryMenu === "ranking") {
    return { kind: secondaryMenu, statusText: formatRanking(uiState) };
  }
  return {
    kind: secondaryMenu,
    statusText: `${TEXT.ui.settingsTitle}\n${uiState.profile.displayName ?? "ゲスト"}  ${uiState.profile.id.slice(0, 8)}\n${uiState.notice ?? "選択すると値が切り替わります"}`,
  };
}

export function createArenaMenuLabels(
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
