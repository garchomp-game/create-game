import { describe, expect, it } from "vitest";
import { ArenaSession } from "../application/ArenaSession";
import { SIMULATION_CONFIG } from "../config/gameConfig";
import type { GameEvent, WeaponTypeId, WorldState } from "../domain/types";
import {
  chooseExProtocol,
  chooseExProtocolEvolution,
  offerExProtocolEvolution,
  offerExProtocolSelection,
} from "../simulation/exProtocolProgression";
import { createWorld } from "../simulation/createWorld";
import {
  createExProtocolChoiceViewModel,
  createExProtocolHudViewModel,
  formatExProtocolEventNotice,
  formatSelectedExProtocolRoute,
} from "./ExProtocolPresenter";

describe("EX Protocol choice presentation", () => {
  it("presents the three Pulse signatures with ordered facts and active input", () => {
    const { world, config } = createCandidate("pulse");
    expect(offerExProtocolSelection(world, config, [])).toBe(true);

    const viewModel = createExProtocolChoiceViewModel(world);

    expect(viewModel).toMatchObject({
      kind: "protocol",
      title: "EX Lv 0 / PROTOCOL SELECT",
      cards: [
        { id: "pulse.resonance-relay", inputHint: null },
        {
          id: "pulse.rebound-overdrive",
          inputHint: "RMB / E で能動発動",
        },
        { id: "pulse.redline-core", inputHint: null },
      ],
    });
    expect(viewModel?.cards[0]?.facts.map((fact) => fact.label)).toEqual([
      "TRIGGER",
      "EFFECT",
      "COST / LIMIT",
    ]);
    expect(viewModel?.cards[1]?.facts[0]?.text).toContain("1.25秒");
    expect(viewModel?.cards[2]?.facts[2]?.text).toContain("70%");
  });

  it("presents Evolution I differences and Evolution II automatic Mastery", () => {
    const { world, config } = createCandidate("pulse");
    offerExProtocolSelection(world, config, []);
    chooseExProtocol(world, 0, config, []);
    world.progression.extraLevel = 1;
    offerExProtocolEvolution(world, 1, []);

    const evolutionOne = createExProtocolChoiceViewModel(world);

    expect(evolutionOne).toMatchObject({
      kind: "evolution",
      title: "交差導線 / Resonance Relay / EVOLUTION I",
      cards: [
        { id: "extended-coupling" },
        { id: "dense-conduit" },
      ],
    });
    expect(evolutionOne?.cards[0]?.summary).toBe(
      "端点の持続時間: 0.9秒 → 1.5秒",
    );

    chooseExProtocolEvolution(world, 0, config, []);
    world.progression.extraLevel = 2;
    offerExProtocolEvolution(world, 2, []);
    const evolutionTwo = createExProtocolChoiceViewModel(world);

    expect(evolutionTwo?.cards.map((card) => card.id)).toEqual([
      "residual-anchor",
      "endpoint-priming",
    ]);
    expect(evolutionTwo?.subtitle).toContain("E1 延長結合");
    expect(evolutionTwo?.footer).toContain(
      "MASTERY 自動解禁: 交差結合 / Crosslink",
    );
  });
});

describe("EX Protocol HUD presentation", () => {
  it("does not create an EX slot for the production-off configuration", () => {
    const world = createWorld(SIMULATION_CONFIG);

    expect(createExProtocolHudViewModel(world, SIMULATION_CONFIG)).toBeNull();
  });

  it("shows Relay anchor lifetime without requiring active input copy", () => {
    const { world, config } = selectProtocol("pulse", 0);
    const progression = world.progression.exProtocol;
    if (
      progression?.status !== "selected" ||
      progression.runtime.kind !== "resonance-relay"
    ) {
      throw new Error("Expected Relay runtime.");
    }
    world.state.elapsed = 4;
    progression.runtime.anchor = {
      enemyId: "enemy-7",
      expiresAt: 4.85,
      createdByVolleyId: 10,
    };

    expect(createExProtocolHudViewModel(world, config)).toMatchObject({
      name: "交差導線",
      primary: "端点 ACTIVE 0.9s",
      secondary: "端点保持中 / 別の敵へ通常弾を当てる",
    });
  });

  it("shows Rebound armed and cooldown states together", () => {
    const { world, config } = selectProtocol("pulse", 1);
    const progression = world.progression.exProtocol;
    if (
      progression?.status !== "selected" ||
      progression.runtime.kind !== "rebound-overdrive"
    ) {
      throw new Error("Expected Rebound runtime.");
    }
    world.state.elapsed = 10;
    progression.runtime.armedUntil = 11.25;
    progression.runtime.cooldownUntil = 16;

    expect(createExProtocolHudViewModel(world, config)).toMatchObject({
      name: "反跳過給",
      primary: "武装 1.3s",
      secondary: "再装填 6.0s",
    });
  });

  it("shows Redline effective HP reservation", () => {
    const { world, config } = selectProtocol("pulse", 2);

    expect(createExProtocolHudViewModel(world, config)).toMatchObject({
      name: "赤熱炉心",
      primary: "稼働中",
      secondary: "予約HP 30/100 (30%)",
    });
  });

  it("keeps Tidal stored charge and current capture visible", () => {
    const { world, config } = selectProtocol("spread", 0);
    const progression = world.progression.exProtocol;
    if (
      progression?.status !== "selected" ||
      progression.runtime.kind !== "full-span-tidal-sweep"
    ) {
      throw new Error("Expected Tidal runtime.");
    }
    progression.runtime.charges = 1;
    world.analytics.activeVolleys[12] = {
      weaponType: "spread",
      enemyIds: [],
      postRicochetEnemyIds: [],
      spreadSweepEnemyIds: [],
      spreadSweepTriggered: false,
      tidalEnemyIds: ["a", "b", "c"],
    };

    expect(createExProtocolHudViewModel(world, config)).toMatchObject({
      name: "全幅潮汐掃討",
      primary: "発動可能  [RMB / E]  CHARGE 1/1",
      secondary: "捕捉 3/5",
    });
  });

  it("shows Breakwater charge, cooldown, and capture without hiding them", () => {
    const { world, config } = selectProtocol("spread", 1);
    const progression = world.progression.exProtocol;
    if (
      progression?.status !== "selected" ||
      progression.runtime.kind !== "breakwater-fan"
    ) {
      throw new Error("Expected Breakwater runtime.");
    }
    world.state.elapsed = 20;
    progression.runtime.charges = 1;
    progression.runtime.cooldownUntil = 24.25;
    world.analytics.activeVolleys[20] = {
      weaponType: "spread",
      enemyIds: [],
      postRicochetEnemyIds: [],
      spreadSweepEnemyIds: [],
      spreadSweepTriggered: false,
      breakwaterCloseEnemyIds: ["a", "b"],
    };

    expect(createExProtocolHudViewModel(world, config)).toMatchObject({
      name: "防波扇",
      primary: "CHARGE 1/1",
      secondary: "再装填 4.3s / 捕捉 2/3",
    });
  });

  it("shows Aegis Mastery charge separately from its active state", () => {
    const { world, config } = selectProtocol("spread", 2);
    const progression = world.progression.exProtocol;
    if (
      progression?.status !== "selected" ||
      progression.runtime.kind !== "aegis-fan"
    ) {
      throw new Error("Expected Aegis runtime.");
    }
    progression.route.masteryUnlocked = true;
    progression.runtime.perfectGuardCharges = 1;

    expect(createExProtocolHudViewModel(world, config)).toMatchObject({
      name: "護壁扇",
      primary: "稼働中",
      secondary: "完全防護 1/1",
    });
    expect(formatSelectedExProtocolRoute(world)).toContain("MASTERY");
  });

  it("uses player-facing notices for rejection and progression events", () => {
    const { world } = selectProtocol("pulse", 1);
    const progression = world.progression.exProtocol;
    if (progression?.status !== "selected") {
      throw new Error("Expected selected Protocol.");
    }

    expect(
      formatExProtocolEventNotice({
        type: "ex.special.rejected",
        protocolId: progression.route.protocolId,
        reason: "cooldown",
        elapsed: 3,
      }),
    ).toBe("再装填中");
    expect(
      formatExProtocolEventNotice({
        type: "ex.mastery.unlocked",
        protocolId: progression.route.protocolId,
        masteryId: "perfect-return",
        exLevel: 2,
        elapsed: 4,
      }),
    ).toBe("MASTERY 解禁: 完全帰還");
  });
});

function createCandidate(weaponType: WeaponTypeId): {
  world: WorldState;
  config: ArenaSession["config"];
} {
  const session = new ArenaSession(SIMULATION_CONFIG);
  session.start({
    seed: 20260723,
    weaponType,
    rulesetProfileId:
      weaponType === "spread" || weaponType === "pulse"
        ? "candidate-ex-endless-c1"
        : undefined,
  });
  return { world: session.world, config: session.config };
}

function selectProtocol(
  weaponType: "pulse" | "spread",
  choiceIndex: number,
): {
  world: WorldState;
  config: ArenaSession["config"];
  events: GameEvent[];
} {
  const { world, config } = createCandidate(weaponType);
  const events: GameEvent[] = [];
  offerExProtocolSelection(world, config, events);
  if (!chooseExProtocol(world, choiceIndex, config, events)) {
    throw new Error("Protocol selection failed.");
  }
  return { world, config, events };
}
