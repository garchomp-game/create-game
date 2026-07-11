import { selectRanking } from "../../application/runRecords";
import type { LocalProfile, ProfileSettings } from "../../domain/profile";
import type { RunContext, RunRecord } from "../../domain/runRecords";
import type { MenuAction, SecondaryMenu } from "./PhaserMenuLayout";

export type HistoryWeaponFilter = "all" | "pulse" | "spread";

export type PhaserUiState = {
  secondaryMenu: SecondaryMenu | null;
  records: RunRecord[];
  ranking: RunRecord[];
  profile: LocalProfile;
  settings: ProfileSettings;
  latestRunRecord: RunRecord | null;
  previousBest: RunRecord | null;
  historyClearPending: boolean;
  rankingClearPending: boolean;
  historyPage: number;
  historyWeaponFilter: HistoryWeaponFilter;
  focusedMenuAction: MenuAction | null;
  notice: string | null;
};

export type CreatePhaserUiStateInput = {
  secondaryMenu: SecondaryMenu | null;
  runHistory: readonly RunRecord[];
  runRankings: readonly RunRecord[];
  runContext: RunContext | null;
  profile: LocalProfile;
  settings: ProfileSettings;
  latestRunRecord: RunRecord | null;
  previousBest: RunRecord | null;
  historyClearPending: boolean;
  rankingClearPending: boolean;
  historyPage: number;
  historyWeaponFilter: HistoryWeaponFilter;
  focusedMenuAction: MenuAction | null;
  notice: string | null;
};

export function createPhaserUiState(input: CreatePhaserUiStateInput): PhaserUiState {
  const records = input.runHistory.filter(
    (record) =>
      record.profileId === input.profile.id &&
      (input.historyWeaponFilter === "all" || record.weaponId === input.historyWeaponFilter),
  );
  const ranking = input.runContext
    ? selectRanking(
        input.runRankings.filter((record) => record.profileId === input.profile.id),
        input.runContext,
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
    historyClearPending: input.historyClearPending,
    rankingClearPending: input.rankingClearPending,
    historyPage: input.historyPage,
    historyWeaponFilter: input.historyWeaponFilter,
    focusedMenuAction: input.focusedMenuAction,
    notice: input.notice,
  };
}
