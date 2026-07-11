import type { LocalProfile, ProfileSettings } from "../../domain/profile";
import type { RunRecord } from "../../domain/runRecords";
import type { MenuAction, SecondaryMenu } from "./PhaserMenuLayout";

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
  focusedMenuAction: MenuAction | null;
  notice: string | null;
};
