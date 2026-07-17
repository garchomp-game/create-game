import { describe, expect, it, vi } from "vitest";
import { createDefaultProfileSettings } from "../domain/profile";
import type { LocalProfile, ProfileSettings } from "../domain/profile";
import type { RunRecord } from "../domain/runRecords";
import {
  ArenaMenuController,
  type ArenaMenuActionContext,
} from "./ArenaMenuController";

describe("ArenaMenuController", () => {
  it("turns primary menu actions into scene commands", () => {
    const { controller } = createController();

    expect(controller.handle("start", createContext()).command).toEqual({
      type: "showWeaponSelect",
      modeId: "endless",
      stageId: "arena-default",
    });
    expect(controller.handle("startExpedition", createContext()).command).toEqual({
      type: "showWeaponSelect",
      modeId: "expedition",
      stageId: "first-expedition",
    });
    expect(
      controller.handle("selectSpread", createContext({ status: "weaponSelect" })).command,
    ).toEqual({ type: "startRun", weaponType: "spread" });
    expect(
      controller.handle("back", createContext({ status: "weaponSelect" })).command,
    ).toEqual({ type: "showTitle" });
    expect(controller.handle("betaInfo", createContext()).command).toEqual({
      type: "showBetaInfo",
    });
    expect(controller.handle("resume", createContext({ status: "paused" })).handled).toBe(
      false,
    );
  });

  it("owns secondary screen, filter, page, and back state", () => {
    const { controller } = createController();
    const runHistory = Array.from({ length: 8 }, (_, index) =>
      createRecord(`run-${index}`, "profile-a", "pulse"),
    );

    controller.handle("history", createContext({ runHistory }));
    controller.handle("historyFilterPulse", createContext({ runHistory }));
    controller.handle("historyNext", createContext({ runHistory }));

    expect(controller.state).toMatchObject({
      secondaryMenu: "history",
      historyWeaponFilter: "pulse",
      historyPage: 1,
    });

    controller.handle("back", createContext({ runHistory }));
    expect(controller.state).toMatchObject({
      secondaryMenu: null,
      historyWeaponFilter: "all",
      historyPage: 0,
    });
  });

  it("requires confirmation before clearing history and exposes updated records", () => {
    const { controller, clearHistory } = createController();

    const first = controller.handle("clearHistory", createContext());
    expect(first.handled).toBe(true);
    expect(clearHistory).not.toHaveBeenCalled();
    expect(controller.state.historyClearPending).toBe(true);

    const second = controller.handle("clearHistory", createContext());
    expect(clearHistory).toHaveBeenCalledOnce();
    expect(second.records).toEqual({ history: [], rankings: [] });
    expect(controller.state).toMatchObject({
      historyClearPending: false,
      notice: "ラン履歴を消去しました",
    });
  });

  it("updates settings through the profile port and reports persistence failures", () => {
    const { controller, logger, profileStore } = createController();
    const context = createContext();

    const updated = controller.handle("settingsBgm", context);
    expect(updated.settings).toMatchObject({ bgmVolume: 0.5, bgmMuted: false });

    profileStore.updateSettings.mockImplementationOnce(() => {
      throw new Error("storage unavailable");
    });
    const failed = controller.handle("settingsAutoFire", context);

    expect(failed.settings).toBeUndefined();
    expect(controller.state.notice).toBe("設定を保存できませんでした");
    expect(logger.warn).toHaveBeenCalledWith("profile.settings.save_failed", {
      message: "storage unavailable",
    });
  });

  it("returns the regenerated profile as an explicit command", () => {
    const { controller, profileStore } = createController();
    const nextProfile = createProfile("profile-next");
    profileStore.resetProfile.mockReturnValue(nextProfile);

    const outcome = controller.handle("resetProfile", createContext());

    expect(outcome.command).toEqual({ type: "profileReset", profile: nextProfile });
  });
});

function createController() {
  let settings = createDefaultProfileSettings();
  const clearHistory = vi.fn(() => ({
    ok: true,
    records: [],
    history: [],
    rankings: [],
  }));
  const clearRankings = vi.fn(() => ({
    ok: true,
    records: [],
    history: [],
    rankings: [],
  }));
  const profileStore = {
    updateSettings: vi.fn((update: Partial<ProfileSettings>) => {
      settings = { ...settings, ...update };
      return settings;
    }),
    resetSettings: vi.fn(() => {
      settings = createDefaultProfileSettings();
      return settings;
    }),
    resetProfile: vi.fn(() => createProfile("profile-next")),
  };
  const logger = { warn: vi.fn() };
  return {
    controller: new ArenaMenuController({
      runRecordStore: { clearHistory, clearRankings },
      profileStore,
      logger,
    }),
    clearHistory,
    clearRankings,
    profileStore,
    logger,
  };
}

function createContext(
  overrides: Partial<ArenaMenuActionContext> = {},
): ArenaMenuActionContext {
  return {
    status: "title",
    profileId: "profile-a",
    settings: createDefaultProfileSettings(),
    runHistory: [],
    ...overrides,
  };
}

function createProfile(id: string): LocalProfile {
  return {
    schemaVersion: 1,
    id,
    createdAt: "2026-07-17T00:00:00.000Z",
    updatedAt: "2026-07-17T00:00:00.000Z",
  };
}

function createRecord(
  id: string,
  profileId: string,
  weaponId: RunRecord["weaponId"],
): RunRecord {
  return { id, profileId, weaponId } as RunRecord;
}
