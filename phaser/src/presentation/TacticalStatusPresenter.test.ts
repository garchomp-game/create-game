import { describe, expect, it } from "vitest";
import { ArenaSession } from "../application/ArenaSession";
import { SIMULATION_CONFIG } from "../config/gameConfig";
import { TEXT } from "../lang";
import { createTacticalStatusViewModel } from "./TacticalStatusPresenter";

describe("createTacticalStatusViewModel", () => {
  it("collapses the Expedition objective after the opening beat", () => {
    const session = createExpeditionSession();
    const world = session.world;

    expect(createTacticalStatusViewModel(world, session.config)).toEqual({
      tone: "objective",
      title: "ACT 1 · 四方警戒",
      detail: "四方から侵入する先遣隊を迎撃する",
      expanded: true,
      remainingRatio: null,
    });

    world.state.elapsed = 3;
    expect(createTacticalStatusViewModel(world, session.config)).toEqual({
      tone: "objective",
      title: "ACT 1 · 四方警戒",
      detail: null,
      expanded: false,
      remainingRatio: null,
    });
  });

  it("replaces the objective with a short directional warning", () => {
    const session = createExpeditionSession();
    const world = session.world;
    const expedition = world.expedition!;
    world.state.elapsed = 20.5;
    expedition.currentCardTitleKey = "encounter.vanguard-arc.title";
    expedition.currentDirection = "north";
    expedition.director.phase = "telegraph";
    expedition.director.cardId = "vanguard-arc";
    expedition.director.selectedAt = 20;

    expect(createTacticalStatusViewModel(world, session.config)).toEqual({
      tone: "warning",
      title: "北 ↑ · 前衛弧状波",
      detail: "侵入予告 1秒",
      expanded: true,
      remainingRatio: expect.closeTo(0.9 / 1.4),
    });
  });

  it("uses compact states during combat and recovery", () => {
    const session = createExpeditionSession();
    const world = session.world;
    const expedition = world.expedition!;
    expedition.currentCardTitleKey = "encounter.vanguard-arc.title";
    expedition.currentDirection = "east";
    expedition.director.cardId = "vanguard-arc";
    expedition.director.phase = "active";
    expedition.director.activeStartedAt = 20;
    world.state.elapsed = 25;

    expect(createTacticalStatusViewModel(world, session.config)).toMatchObject({
      tone: "danger",
      title: "前衛弧状波 · 交戦 9秒",
      detail: null,
      expanded: false,
    });

    expedition.director.phase = "recovery";
    expedition.director.recoveryStartedAt = 34;
    world.state.elapsed = 35;
    expect(createTacticalStatusViewModel(world, session.config)).toMatchObject({
      tone: "recovery",
      title: "再編 3秒 · 前衛弧状波",
      detail: null,
      expanded: false,
    });
  });

  it("keeps Endless wave cues compact", () => {
    const session = createEndlessSession();
    session.world.state.elapsed = 26;

    expect(createTacticalStatusViewModel(session.world, session.config)).toEqual({
      tone: "warning",
      title: "敵影増加まで 4秒",
      detail: null,
      expanded: false,
      remainingRatio: null,
    });
  });

  it("prioritizes collapse warnings over normal encounter text", () => {
    const session = createEndlessSession();
    const world = session.world;
    const collapse = session.config.encounter.collapse;
    world.state.elapsed = collapse.startsAt - 2;
    world.encounter.director = {
      ...world.encounter.director,
      phase: "warning",
      currentId: "rangedSurge",
      scheduledAt: world.state.elapsed + 1,
      warningStartedAt: world.state.elapsed,
    };

    expect(createTacticalStatusViewModel(world, session.config)).toMatchObject({
      tone: "danger",
      title: "アリーナ崩壊",
      detail: "安全領域縮小まで 2秒",
      expanded: true,
    });
  });

  it("splits normal encounter names from their countdown", () => {
    const session = createEndlessSession();
    const world = session.world;
    world.state.elapsed = 200;
    world.encounter.director = {
      ...world.encounter.director,
      phase: "warning",
      currentId: "rangedSurge",
      scheduledAt: 203,
      warningStartedAt: 200,
    };

    expect(createTacticalStatusViewModel(world, session.config)).toMatchObject({
      tone: "warning",
      title: TEXT.hud.encounterNames.rangedSurge,
      detail: "危険開始まで 3秒",
      expanded: true,
    });
  });
});

function createEndlessSession(): ArenaSession {
  const session = new ArenaSession(SIMULATION_CONFIG);
  session.start({ seed: 1, weaponType: "pulse" });
  return session;
}

function createExpeditionSession(): ArenaSession {
  const session = new ArenaSession(SIMULATION_CONFIG);
  session.start({
    seed: 1,
    weaponType: "pulse",
    modeId: "expedition",
    stageId: "final-expedition",
  });
  return session;
}
