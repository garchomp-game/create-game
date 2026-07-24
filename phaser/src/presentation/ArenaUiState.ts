import {
  createRankingBoardQueries,
  selectRanking,
} from "../application/runRecords";
import type {
  HelpPage,
  HistoryWeaponFilter,
  MenuAction,
  SecondaryMenu,
} from "../application/ArenaMenuTypes";
import type { LocalProfile, ProfileSettings } from "../domain/profile";
import {
  clonePracticeRunOptions,
  createDefaultPracticeRunOptions,
  type PracticeRunOptions,
} from "../domain/practice";
import type {
  RunComparisonQuery,
  RunContext,
  RunRecord,
} from "../domain/runRecords";

export type { HistoryWeaponFilter } from "../application/ArenaMenuTypes";

export type ReleaseIdentity = {
  appVersion: string;
  rulesetVersion: string;
  buildCommit: string;
};

export type ArenaUiState = {
  secondaryMenu: SecondaryMenu | null;
  helpPage: HelpPage;
  records: RunRecord[];
  ranking: RunRecord[];
  rankingQuery: RunComparisonQuery | null;
  rankingBoardIndex: number;
  rankingBoardCount: number;
  profile: LocalProfile;
  settings: ProfileSettings;
  practiceOptions: PracticeRunOptions;
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
  helpPage?: HelpPage;
  runHistory: readonly RunRecord[];
  runRankings: readonly RunRecord[];
  runContext: RunContext | null;
  profile: LocalProfile;
  settings: ProfileSettings;
  practiceOptions?: PracticeRunOptions;
  latestRunRecord: RunRecord | null;
  previousBest: RunRecord | null;
  previousWeaponBest: RunRecord | null;
  historyClearPending: boolean;
  rankingClearPending: boolean;
  rankingBoardIndex?: number;
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
  const rankingBoards = createRankingBoardQueries(
    input.runRankings,
    input.profile.id,
    input.runContext,
  );
  const rankingBoardIndex = Math.max(
    0,
    Math.min(input.rankingBoardIndex ?? 0, rankingBoards.length - 1),
  );
  const rankingQuery = rankingBoards[rankingBoardIndex] ?? null;
  const ranking = rankingQuery
    ? selectRanking(input.runRankings, rankingQuery)
    : [];

  return {
    secondaryMenu: input.secondaryMenu,
    helpPage: input.helpPage ?? "controls",
    records,
    ranking,
    rankingQuery: rankingQuery ? { ...rankingQuery } : null,
    rankingBoardIndex,
    rankingBoardCount: rankingBoards.length,
    profile: { ...input.profile },
    settings: { ...input.settings },
    practiceOptions: clonePracticeRunOptions(
      input.practiceOptions ?? createDefaultPracticeRunOptions(),
    ),
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
