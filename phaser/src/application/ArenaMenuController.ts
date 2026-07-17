import type { LocalProfile, ProfileSettings, ProfileSettingsUpdate } from "../domain/profile";
import type { RunRecord } from "../domain/runRecords";
import type { GameStatus, WeaponTypeId } from "../domain/types";
import type { LoggerPort } from "../ports/LoggerPort";
import type { ProfileStorePort } from "../ports/ProfileStorePort";
import type { RunRecordStorePort } from "../ports/RunRecordStorePort";
import type {
  HistoryWeaponFilter,
  MenuAction,
  SecondaryMenu,
} from "./ArenaMenuTypes";
import {
  DEFAULT_MODE_ID,
  DEFAULT_STAGE_ID,
  EXPEDITION_MODE_ID,
  FIRST_EXPEDITION_STAGE_ID,
} from "../config/version";

export type ArenaMenuState = {
  secondaryMenu: SecondaryMenu | null;
  historyClearPending: boolean;
  rankingClearPending: boolean;
  historyPage: number;
  historyWeaponFilter: HistoryWeaponFilter;
  notice: string | null;
};

export type ArenaMenuActionContext = {
  status: GameStatus;
  profileId: string;
  settings: ProfileSettings;
  runHistory: readonly RunRecord[];
};

export type ArenaMenuCommand =
  | { type: "showWeaponSelect"; modeId: string; stageId: string }
  | { type: "startRun"; weaponType: WeaponTypeId }
  | { type: "showTitle" }
  | { type: "showBetaInfo" }
  | { type: "profileReset"; profile: LocalProfile };

export type ArenaMenuActionOutcome = {
  handled: boolean;
  command?: ArenaMenuCommand;
  settings?: ProfileSettings;
  records?: {
    history: RunRecord[];
    rankings: RunRecord[];
  };
};

type ArenaMenuControllerDependencies = {
  runRecordStore: Pick<RunRecordStorePort, "clearHistory" | "clearRankings">;
  profileStore: Pick<
    ProfileStorePort,
    "updateSettings" | "resetSettings" | "resetProfile"
  >;
  logger: Pick<LoggerPort, "warn">;
};

export class ArenaMenuController {
  private menuState: ArenaMenuState = createInitialMenuState();

  constructor(private readonly dependencies: ArenaMenuControllerDependencies) {}

  get state(): Readonly<ArenaMenuState> {
    return this.menuState;
  }

  reset(): void {
    this.menuState = createInitialMenuState();
  }

  open(menu: SecondaryMenu | null, notice: string | null = null): void {
    this.menuState = {
      ...createInitialMenuState(),
      secondaryMenu: menu,
      notice,
    };
  }

  setNotice(notice: string | null): void {
    this.menuState.notice = notice;
  }

  handle(
    action: MenuAction,
    context: ArenaMenuActionContext,
  ): ArenaMenuActionOutcome {
    if (action === "start" && context.status === "title") {
      this.setNotice(null);
      return handled({
        type: "showWeaponSelect",
        modeId: DEFAULT_MODE_ID,
        stageId: DEFAULT_STAGE_ID,
      });
    }

    if (action === "startExpedition" && context.status === "title") {
      this.setNotice(null);
      return handled({
        type: "showWeaponSelect",
        modeId: EXPEDITION_MODE_ID,
        stageId: FIRST_EXPEDITION_STAGE_ID,
      });
    }

    if (action === "selectPulse" || action === "selectSpread") {
      return handled({
        type: "startRun",
        weaponType: action === "selectPulse" ? "pulse" : "spread",
      });
    }

    if (action === "back" && context.status === "weaponSelect") {
      return handled({ type: "showTitle" });
    }

    if (action === "history" || action === "ranking" || action === "settings") {
      this.open(action);
      return handled();
    }

    if (action === "betaInfo" && context.status === "title") {
      return handled({ type: "showBetaInfo" });
    }

    if (action === "back") {
      this.reset();
      return handled();
    }

    if (action === "clearHistory") {
      if (!this.menuState.historyClearPending) {
        this.menuState.historyClearPending = true;
        this.menuState.notice = "もう一度選ぶと履歴を消去します";
        return handled();
      }

      const result = this.dependencies.runRecordStore.clearHistory();
      this.menuState.notice = result.ok
        ? "ラン履歴を消去しました"
        : "ラン履歴を消去できませんでした";
      this.menuState.historyClearPending = false;
      return result.ok
        ? handled(undefined, undefined, {
            history: result.history,
            rankings: result.rankings,
          })
        : handled();
    }

    if (
      action === "historyFilterAll" ||
      action === "historyFilterPulse" ||
      action === "historyFilterSpread"
    ) {
      this.menuState.historyWeaponFilter =
        action === "historyFilterPulse"
          ? "pulse"
          : action === "historyFilterSpread"
            ? "spread"
            : "all";
      this.menuState.historyPage = 0;
      this.menuState.historyClearPending = false;
      this.menuState.notice = null;
      return handled();
    }

    if (action === "historyPrevious" || action === "historyNext") {
      const count = context.runHistory.filter(
        (record) =>
          record.profileId === context.profileId &&
          (this.menuState.historyWeaponFilter === "all" ||
            record.weaponId === this.menuState.historyWeaponFilter),
      ).length;
      const maxPage = Math.max(0, Math.ceil(count / 7) - 1);
      this.menuState.historyPage = Math.max(
        0,
        Math.min(
          maxPage,
          this.menuState.historyPage + (action === "historyNext" ? 1 : -1),
        ),
      );
      this.menuState.historyClearPending = false;
      this.menuState.notice = null;
      return handled();
    }

    if (action === "clearRankings") {
      if (!this.menuState.rankingClearPending) {
        this.menuState.rankingClearPending = true;
        this.menuState.notice = "もう一度選ぶとランキングを消去します";
        return handled();
      }

      const result = this.dependencies.runRecordStore.clearRankings();
      this.menuState.notice = result.ok
        ? "ランキングを消去しました"
        : "ランキングを消去できませんでした";
      this.menuState.rankingClearPending = false;
      return result.ok
        ? handled(undefined, undefined, {
            history: result.history,
            rankings: result.rankings,
          })
        : handled();
    }

    if (action === "resetSettings") {
      return this.runSettingsUpdate(
        () => this.dependencies.profileStore.resetSettings(),
        "設定を初期化しました",
      );
    }

    if (action === "resetProfile") {
      try {
        const profile = this.dependencies.profileStore.resetProfile();
        return handled({ type: "profileReset", profile });
      } catch (error) {
        this.menuState.notice = "ゲストIDを再生成できませんでした";
        this.dependencies.logger.warn("profile.reset_failed", {
          message: error instanceof Error ? error.message : String(error),
        });
        return handled();
      }
    }

    if (action === "settingsBgm") {
      const next = cycleLevel(context.settings.bgmMuted ? 0 : context.settings.bgmVolume);
      return this.runSettingsUpdate(() =>
        this.dependencies.profileStore.updateSettings({
          bgmVolume: next,
          bgmMuted: next === 0,
        }),
      );
    }

    if (action === "settingsSfx") {
      const next = cycleLevel(context.settings.sfxMuted ? 0 : context.settings.sfxVolume);
      return this.runSettingsUpdate(() =>
        this.dependencies.profileStore.updateSettings({
          sfxVolume: next,
          sfxMuted: next === 0,
        }),
      );
    }

    if (action === "settingsShake") {
      return this.runSettingsUpdate(() =>
        this.dependencies.profileStore.updateSettings({
          shakeIntensity: cycleLevel(context.settings.shakeIntensity),
        }),
      );
    }

    if (action === "settingsFlash") {
      return this.runSettingsUpdate(() =>
        this.dependencies.profileStore.updateSettings({
          flashIntensity: cycleLevel(context.settings.flashIntensity),
        }),
      );
    }

    if (action === "settingsAutoFire") {
      return this.runSettingsUpdate(() =>
        this.dependencies.profileStore.updateSettings({
          autoFireEnabled: !context.settings.autoFireEnabled,
        }),
      );
    }

    return { handled: false };
  }

  updateSettings(update: ProfileSettingsUpdate): ArenaMenuActionOutcome {
    return this.updateSettingsOperation(() =>
      this.dependencies.profileStore.updateSettings(update),
    );
  }

  private runSettingsUpdate(
    update: () => ProfileSettings,
    notice: string | null = null,
  ): ArenaMenuActionOutcome {
    return this.updateSettingsOperation(update, notice);
  }

  private updateSettingsOperation(
    update: () => ProfileSettings,
    notice: string | null = null,
  ): ArenaMenuActionOutcome {
    try {
      const settings = update();
      this.menuState.notice = notice;
      return handled(undefined, settings);
    } catch (error) {
      this.menuState.notice = "設定を保存できませんでした";
      this.dependencies.logger.warn("profile.settings.save_failed", {
        message: error instanceof Error ? error.message : String(error),
      });
      return handled();
    }
  }
}

function createInitialMenuState(): ArenaMenuState {
  return {
    secondaryMenu: null,
    historyClearPending: false,
    rankingClearPending: false,
    historyPage: 0,
    historyWeaponFilter: "all",
    notice: null,
  };
}

function handled(
  command?: ArenaMenuCommand,
  settings?: ProfileSettings,
  records?: ArenaMenuActionOutcome["records"],
): ArenaMenuActionOutcome {
  return {
    handled: true,
    ...(command ? { command } : {}),
    ...(settings ? { settings } : {}),
    ...(records ? { records } : {}),
  };
}

function cycleLevel(value: number): number {
  if (value >= 0.75) return 0.5;
  if (value >= 0.25) return 0;
  return 1;
}
