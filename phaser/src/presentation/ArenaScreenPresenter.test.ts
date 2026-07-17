import { describe, expect, it } from "vitest";
import { SIMULATION_CONFIG } from "../config/gameConfig";
import { createDefaultProfileSettings } from "../domain/profile";
import { TEXT } from "../lang";
import { createWorld } from "../simulation/createWorld";
import { createArenaScreenViewModel } from "./ArenaScreenPresenter";
import type { ArenaUiState } from "./ArenaUiState";

describe("createArenaScreenViewModel", () => {
  it("presents the title screen without Phaser objects", () => {
    const world = createWorld(SIMULATION_CONFIG);
    world.state.status = "title";

    const viewModel = createArenaScreenViewModel(world, SIMULATION_CONFIG);

    expect(viewModel).toMatchObject({
      kind: "title",
      status: "title",
      secondaryMenu: null,
      detailText: null,
    });
    expect(viewModel.statusText).toBe(
      `${TEXT.ui.titleScreen}\n${TEXT.ui.endlessMode}\n公開ベータ v0.6.8`,
    );
  });

  it("formats secondary history state and its notice", () => {
    const world = createWorld(SIMULATION_CONFIG);
    world.state.status = "title";
    const uiState = createUiState({
      secondaryMenu: "history",
      notice: "履歴テスト",
    });

    const viewModel = createArenaScreenViewModel(world, SIMULATION_CONFIG, uiState);

    expect(viewModel.kind).toBe("history");
    expect(viewModel.statusText).toContain(TEXT.ui.historyTitle);
    expect(viewModel.statusText).toContain(TEXT.ui.noRecords);
    expect(viewModel.statusText).toContain("履歴テスト");
  });

  it("derives settings labels and confirmation labels from UI state", () => {
    const world = createWorld(SIMULATION_CONFIG);
    const uiState = createUiState({
      secondaryMenu: "settings",
      historyClearPending: true,
      rankingClearPending: true,
      historyWeaponFilter: "pulse",
      settings: {
        ...createDefaultProfileSettings(),
        bgmVolume: 0.5,
        autoFireEnabled: false,
      },
    });

    const viewModel = createArenaScreenViewModel(world, SIMULATION_CONFIG, uiState);

    expect(viewModel.kind).toBe("settings");
    expect(viewModel.menuLabels.clearHistory).toBe("もう一度押して消去");
    expect(viewModel.menuLabels.clearRankings).toBe("もう一度押して消去");
    expect(viewModel.menuLabels.settingsBgm).toContain("50%");
    expect(viewModel.menuLabels.settingsAutoFire).toContain("オフ");
    expect(viewModel.menuLabels.historyFilterPulse).toBe("[パルス]");
  });

  it("provides a deterministic result fallback when no record was saved", () => {
    const world = createWorld(SIMULATION_CONFIG);
    world.state.status = "gameOver";
    world.state.score = 1234;

    const viewModel = createArenaScreenViewModel(
      world,
      SIMULATION_CONFIG,
      createUiState(),
    );

    expect(viewModel.kind).toBe("gameOver");
    expect(viewModel.statusText).toContain("1234");
    expect(viewModel.detailText).toBe("記録を保存できませんでした");
  });
});

function createUiState(
  overrides: Partial<ArenaUiState> = {},
): ArenaUiState {
  return {
    secondaryMenu: null,
    records: [],
    ranking: [],
    profile: {
      schemaVersion: 1,
      id: "00000000-0000-4000-8000-000000000001",
      displayName: "ゲスト",
      createdAt: "2026-07-17T00:00:00.000Z",
      updatedAt: "2026-07-17T00:00:00.000Z",
    },
    settings: createDefaultProfileSettings(),
    latestRunRecord: null,
    previousBest: null,
    historyClearPending: false,
    rankingClearPending: false,
    historyPage: 0,
    historyWeaponFilter: "all",
    focusedMenuAction: null,
    notice: null,
    releaseIdentity: {
      appVersion: "0.6.8",
      rulesetVersion: "phaser-v0.6.8-pulse-boundary-ricochet",
      buildCommit: "123456789abc",
    },
    ...overrides,
  };
}
