import {
  createRunComparisonQuery,
  selectRanking,
} from "../application/runRecords";
import type {
  HistoryWeaponFilter,
  MenuAction,
  SecondaryMenu,
} from "../application/ArenaMenuTypes";
import type { LocalProfile, ProfileSettings } from "../domain/profile";
import type { RunContext, RunRecord } from "../domain/runRecords";

export type { HistoryWeaponFilter } from "../application/ArenaMenuTypes";

export type ReleaseIdentity = {
  appVersion: string;
  rulesetVersion: string;
  buildCommit: string;
};

export type ArenaUiState = {
  secondaryMenu: SecondaryMenu | null;
  records: RunRecord[];
  ranking: RunRecord[];
  profile: LocalProfile;
  settings: ProfileSettings;
  latestRunRecord: RunRecord | null;
  previousBest: RunRecord | null;
  previousWeaponBest: RunRecord | null;
  historyClearPending: boolean;
  rankingClearPending: boolean;
  historyPage: number;
  historyWeaponFilter: HistoryWeaponFilter;
  focusedMenuAction: MenuAction | null;
  notice: string | null;
  releaseIdentity: ReleaseIdentity;
  runContext?: RunContext | null;
};

export type CreateArenaUiStateInput = {
  secondaryMenu: SecondaryMenu | null;
  runHistory: readonly RunRecord[];
  runRankings: readonly RunRecord[];
  runContext: RunContext | null;
  profile: LocalProfile;
  settings: ProfileSettings;
  latestRunRecord: RunRecord | null;
  previousBest: RunRecord | null;
  previousWeaponBest: RunRecord | null;
  historyClearPending: boolean;
  rankingClearPending: boolean;
  historyPage: number;
  historyWeaponFilter: HistoryWeaponFilter;
  focusedMenuAction: MenuAction | null;
  notice: string | null;
  releaseIdentity: ReleaseIdentity;
};

export function createArenaUiState(input: CreateArenaUiStateInput): ArenaUiState {
  const records = input.runHistory.filter(
    (record) =>
      record.profileId === input.profile.id &&
      (input.historyWeaponFilter === "all" || record.weaponId === input.historyWeaponFilter),
  );
  const ranking = input.runContext
    ? selectRanking(
        input.runRankings.filter((record) => record.profileId === input.profile.id),
        createRunComparisonQuery(input.runContext, "overall"),
      )
    : [];

  return {
    secondaryMenu: input.secondaryMenu,
    records,
    ranking,
    profile: { ...input.profile },
    settings: { ...input.settings },
    latestRunRecord: input.latestRunRecord ? { ...input.latestRunRecord } : null,
    previousBest: input.previousBest ? { ...input.previousBest } : null,
    previousWeaponBest: input.previousWeaponBest
      ? { ...input.previousWeaponBest }
      : null,
    historyClearPending: input.historyClearPending,
    rankingClearPending: input.rankingClearPending,
    historyPage: input.historyPage,
    historyWeaponFilter: input.historyWeaponFilter,
    focusedMenuAction: input.focusedMenuAction,
    notice: input.notice,
    releaseIdentity: { ...input.releaseIdentity },
    runContext: input.runContext ? { ...input.runContext } : null,
  };
}
