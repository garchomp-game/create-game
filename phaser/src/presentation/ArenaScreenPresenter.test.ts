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
      `${TEXT.ui.titleScreen}\nENDLESS / EXPEDITION\n生存限界か、最終決戦か\n技術プレビュー v0.7.0`,
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

  it("keeps Expedition completion bonuses on separate readable lines", () => {
    const world = createWorld(SIMULATION_CONFIG);
    world.state.status = "gameOver";
    world.state.score = 141_292;
    world.stats.encounterMetrics.expedition = {
      outcome: "victory",
      reachedActId: "command-ship",
      reachedActIds: ["command-ship"],
      actChanges: 1,
      cardsSelected: 1,
      cardsCompleted: 1,
      cardsFailed: 0,
      cardsInterrupted: 0,
      cardsDeferred: 0,
      structuredEnemiesSpawned: 0,
      structuredSpawnsDeferred: 0,
      longestMeaningfulGap: 0,
      completedAt: 421.4,
      scoreBeforeBonus: 18_300,
      clearScoreBonus: 15_000,
      timeScoreBonus: 107_992,
      bossFightDuration: 0.016,
      cardHistory: [],
    };

    const viewModel = createArenaScreenViewModel(
      world,
      SIMULATION_CONFIG,
      createUiState(),
    );

    expect(viewModel.statusText?.split("\n")).toEqual(
      expect.arrayContaining([
        "完遂 +15,000 / 速攻 +107,992",
        "指揮艦撃破 00:00",
      ]),
    );
  });

  it("names the boss attack that ended an Expedition", () => {
    const world = createWorld(SIMULATION_CONFIG);
    world.state.status = "gameOver";
    world.state.hp = 0;
    world.stats.lastDamageSource = {
      kind: "projectile",
      projectileId: "boss-projectile-1",
      bossId: "first-command-ship",
      bossAttackId: "targeted-salvo",
    };
    world.stats.encounterMetrics.expedition = {
      outcome: "defeat",
      reachedActId: "command-ship",
      reachedActIds: ["command-ship"],
      actChanges: 1,
      cardsSelected: 1,
      cardsCompleted: 0,
      cardsFailed: 0,
      cardsInterrupted: 0,
      cardsDeferred: 0,
      structuredEnemiesSpawned: 0,
      structuredSpawnsDeferred: 0,
      longestMeaningfulGap: 0,
      completedAt: 430,
      scoreBeforeBonus: 20_000,
      clearScoreBonus: 0,
      timeScoreBonus: 0,
      bossFightDuration: 30,
      cardHistory: [],
    };

    const viewModel = createArenaScreenViewModel(
      world,
      SIMULATION_CONFIG,
      createUiState(),
    );

    expect(viewModel.statusText).toContain("遠征失敗");
    expect(viewModel.statusText).toContain("指揮艦 照準斉射");

    world.stats.lastDamageSource = {
      kind: "contact",
      enemyId: "escort-1",
      enemyType: "fast",
      bossId: "first-command-ship",
      bossAttackId: "escort-pincer",
    };
    expect(
      createArenaScreenViewModel(world, SIMULATION_CONFIG, createUiState()).statusText,
    ).toContain("指揮艦 挟撃護衛");
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
