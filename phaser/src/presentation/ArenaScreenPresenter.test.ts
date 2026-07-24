import { describe, expect, it } from "vitest";
import { createRankEligibility, createRunRecord } from "../application/runRecords";
import { SIMULATION_CONFIG } from "../config/gameConfig";
import { createDefaultProfileSettings } from "../domain/profile";
import type { RunRecord } from "../domain/runRecords";
import type { WorldState } from "../domain/types";
import { TEXT } from "../lang";
import { createWorld } from "../simulation/createWorld";
import { createRunResultSummary } from "../simulation/resultSummary";
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
      `${TEXT.ui.titleScreen}\nENDLESS / EXPEDITION / TRAINING\n生存限界か、最終決戦か\n技術プレビュー v0.7.0`,
    );
  });

  it("presents Training completion without a RunRecord result", () => {
    const world = createWorld(SIMULATION_CONFIG);
    world.state.status = "trainingComplete";

    const viewModel = createArenaScreenViewModel(world, SIMULATION_CONFIG);

    expect(viewModel).toMatchObject({
      kind: "trainingComplete",
      status: "trainingComplete",
      statusText: `${TEXT.ui.trainingCompleteTitle}\n${TEXT.ui.trainingCompleteDescription}`,
      detailText: null,
    });
    expect(viewModel.menuLabels.start).toBe("武器を選んでエンドレスへ");
    expect(viewModel.menuLabels.title).toBe("タイトルへ戻る");
  });

  it("labels pause actions as Training controls when a tutorial is active", () => {
    const world = createWorld(SIMULATION_CONFIG);
    world.state.status = "paused";

    const viewModel = createArenaScreenViewModel(
      world,
      SIMULATION_CONFIG,
      undefined,
      {
        stepId: "chooseUpgrade",
        phase: "active",
        stepNumber: 5,
        stepCount: 9,
        stepActiveSeconds: 0,
        totalActiveSeconds: 10,
        noProgressSeconds: 0,
        hintLevel: 0,
        progress: { current: 0, required: 1 },
        target: null,
        lastCompletedStepId: "collectXp",
        selectedUpgradeId: null,
        retryCount: 0,
        retryReason: null,
        retryNoticeSecondsRemaining: 0,
        readySecondsRemaining: 0,
        transfer: {
          survivalSeconds: 0,
          kills: 0,
          pickups: 0,
          spawnedPickups: 1,
          requiredKills: 3,
          enemiesRemaining: 3,
          pickupsRemaining: 1,
          repairPosition: { x: 480, y: 420 },
        },
      },
    );

    expect(viewModel).toMatchObject({
      kind: "paused",
      statusText: "基本訓練を一時停止",
      menuLabels: {
        resume: "強化選択へ戻る",
        restart: "基本訓練をやり直す",
        title: "訓練を中断してタイトルへ",
      },
    });
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

  it("explains PB eligibility consistently in run history", () => {
    const world = createWorld(SIMULATION_CONFIG);
    world.state.status = "title";
    world.state.elapsed = 430;
    world.stats.encounterMetrics.expedition = createExpeditionMetrics("defeat", 430);
    const defeat = createRecord(world, "expedition", "final-expedition");

    const victory = structuredClone(defeat);
    victory.id = "run-victory";
    victory.encounterMetrics.expedition!.outcome = "victory";

    const debug = structuredClone(victory);
    debug.id = "run-debug";
    debug.rankEligibility = { eligible: false, reasons: ["debugRun"] };

    const endless = createRecord(world);
    endless.id = "run-non-standard";
    endless.rankEligibility = { eligible: false, reasons: ["nonStandardRuleset"] };

    const viewModel = createArenaScreenViewModel(
      world,
      SIMULATION_CONFIG,
      createUiState({
        secondaryMenu: "history",
        records: [defeat, victory, debug, endless],
      }),
    );

    expect(viewModel.statusText).toContain("敗退 07:10.00");
    expect(viewModel.statusText).toContain("PB対象外: 遠征未完遂");
    expect(viewModel.statusText).toContain("PB対象外: デバッグ操作");
    expect(viewModel.statusText).toContain("PB対象外: 標準外ルール");
    expect(viewModel.statusText).toMatch(/完遂 07:10\.00.*PB対象(?:\n|$)/);
  });

  it("shows the selected ranking scope, seed, and ruleset", () => {
    const world = createWorld(SIMULATION_CONFIG);
    world.state.status = "title";
    const uiState = createUiState({
      secondaryMenu: "ranking",
      rankingBoardIndex: 2,
      rankingBoardCount: 4,
      rankingQuery: {
        profileId: "00000000-0000-4000-8000-000000000001",
        modeId: "expedition",
        stageId: "final-expedition",
        difficultyId: "standard",
        rulesetVersion: "rules-rc6",
        seedCategory: "fixed",
        seed: 77,
        comparisonScope: "weapon",
        weaponId: "pulse",
      },
    });

    const viewModel = createArenaScreenViewModel(world, SIMULATION_CONFIG, uiState);

    expect(viewModel.statusText).toContain("3/4");
    expect(viewModel.statusText).toContain("パルス別 / 固定シード 77");
    expect(viewModel.statusText).toContain("ルール: rules-rc6");
    expect(viewModel.statusText).toContain(
      "順位: 作戦完遂後、総クリア時間が短い順（同タイムは撃破点）",
    );
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
      tacticalScore: 18_300,
      scoreBeforeBonus: 18_300,
      clearScoreBonus: 15_000,
      timeScoreBonus: 0,
      timeMedal: "gold",
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
        "00:00.00 / 撃破 18,300点",
        "時間メダル 金 / 完遂 +15,000",
        "指揮艦撃破 00:00",
      ]),
    );
  });

  it("formats Expedition PB deltas from integer centiseconds", () => {
    const world = createWorld(SIMULATION_CONFIG);
    world.state.status = "gameOver";
    world.state.elapsed = 500.004;
    world.state.score = 35_000;
    world.stats.encounterMetrics.expedition = createExpeditionMetrics(
      "victory",
      500.004,
    );
    const current = createRecord(world, "expedition", "final-expedition");
    current.elapsed = 500.004;
    const previous = structuredClone(current);
    previous.id = "run-previous";
    previous.elapsed = 500.005;

    const improved = createArenaScreenViewModel(
      world,
      SIMULATION_CONFIG,
      createUiState({
        latestRunRecord: current,
        previousBest: previous,
        previousWeaponBest: previous,
      }),
    );
    expect(improved.statusText).toContain("総合PB更新 -00:00.01");
    expect(improved.statusText).not.toContain("-00:00.00");

    previous.elapsed = 500.003;
    const tied = createArenaScreenViewModel(
      world,
      SIMULATION_CONFIG,
      createUiState({
        latestRunRecord: current,
        previousBest: previous,
        previousWeaponBest: previous,
      }),
    );
    expect(tied.statusText).toContain("総合PBと同記録");
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
      tacticalScore: 20_000,
      scoreBeforeBonus: 20_000,
      clearScoreBonus: 0,
      timeScoreBonus: 0,
      timeMedal: null,
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

    const record = createRecord(world, "expedition", "final-expedition");
    const details = createArenaScreenViewModel(
      world,
      SIMULATION_CONFIG,
      createUiState({ latestRunRecord: record }),
    ).detailText;
    expect(details).toContain("遠征未完遂");
    expect(details).toContain(`ルール: ${record.rulesetVersion}`);
    expect(details).toContain(
      "順位: 作戦完遂後、総クリア時間が短い順（同タイムは撃破点）",
    );

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

  it("states the Endless ranking contract without changing its comparator", () => {
    const world = createWorld(SIMULATION_CONFIG);
    world.state.status = "gameOver";
    const record = createRecord(world);

    const details = createArenaScreenViewModel(
      world,
      SIMULATION_CONFIG,
      createUiState({ latestRunRecord: record }),
    ).detailText;

    expect(details).toContain("順位: 撃破点が高い順（同点は生存時間）");
  });
});

function createRecord(
  world: WorldState,
  modeId = "endless",
  stageId = "arena-default",
): RunRecord {
  return createRunRecord({
    context: {
      id: "run-presenter",
      profileId: "00000000-0000-4000-8000-000000000001",
      startedAt: "2026-07-19T00:00:00.000Z",
      modeId,
      stageId,
      difficultyId: "standard",
      rulesetVersion: "rules-rc6",
      seedCategory: "random",
      weaponId: world.state.weaponType,
      modifierIds: [],
      appVersion: "0.7.0",
      buildCommit: "123456789abc",
      seed: 77,
      runOrigin: "manual",
      rankEligibility: createRankEligibility("manual"),
    },
    capturedAt: "2026-07-19T00:10:00.000Z",
    summary: createRunResultSummary(world),
    upgradeRanks: world.progression.upgradeRanks,
    upgradeSelections: world.stats.progressionMetrics.selections,
    extraUpgradeRanks: world.progression.extraUpgradeRanks,
    extraUpgradeSelections: world.stats.progressionMetrics.extraSelections,
    buildCompletedAt: world.progression.buildCompletedAt,
    encounterMetrics: world.stats.encounterMetrics,
  });
}

function createExpeditionMetrics(
  outcome: "victory" | "defeat",
  completedAt: number,
): NonNullable<WorldState["stats"]["encounterMetrics"]["expedition"]> {
  return {
    outcome,
    reachedActId: "command-ship",
    reachedActIds: ["command-ship"],
    actChanges: 4,
    cardsSelected: 5,
    cardsCompleted: outcome === "victory" ? 5 : 4,
    cardsFailed: 0,
    cardsInterrupted: outcome === "defeat" ? 1 : 0,
    cardsDeferred: 0,
    structuredEnemiesSpawned: 20,
    structuredSpawnsDeferred: 0,
    longestMeaningfulGap: 0,
    completedAt,
    tacticalScore: 20_000,
    scoreBeforeBonus: 20_000,
    clearScoreBonus: outcome === "victory" ? 15_000 : 0,
    timeScoreBonus: 0,
    timeMedal: outcome === "victory" ? "gold" : null,
    bossFightDuration: 120,
    cardHistory: [],
  };
}

function createUiState(
  overrides: Partial<ArenaUiState> = {},
): ArenaUiState {
  return {
    secondaryMenu: null,
    records: [],
    ranking: [],
    rankingQuery: null,
    rankingBoardIndex: 0,
    rankingBoardCount: 0,
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
    previousWeaponBest: null,
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
