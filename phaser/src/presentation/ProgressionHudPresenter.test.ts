import { describe, expect, it } from "vitest";
import { SIMULATION_CONFIG } from "../config/gameConfig";
import { createWorld } from "../simulation/createWorld";
import { createProgressionHudViewModel } from "./ProgressionHudPresenter";

describe("createProgressionHudViewModel", () => {
  it("shows the first upgrade cadence alongside the XP requirement", () => {
    const world = createWorld(SIMULATION_CONFIG);

    expect(createProgressionHudViewModel(world)).toEqual({
      levelLabel: "Lv 1",
      experienceLabel: "経験値 0 / 3　強化まで8秒",
      experienceRatio: 0,
      upgradeWaitSeconds: 8,
    });
  });

  it("clamps stored XP and keeps the remaining wait visible", () => {
    const world = createWorld(SIMULATION_CONFIG);
    world.state.elapsed = 5.2;
    world.progression.xp = 4;

    expect(createProgressionHudViewModel(world)).toEqual({
      levelLabel: "Lv 1",
      experienceLabel: "経験値 3 / 3　強化まで3秒",
      experienceRatio: 1,
      upgradeWaitSeconds: 3,
    });
  });

  it("does not apply the normal upgrade cadence after build completion", () => {
    const world = createWorld(SIMULATION_CONFIG);
    world.progression.buildCompletedAt = 120;
    world.progression.extraLevel = 2;
    world.progression.extraCycle = 1;
    world.progression.xp = 48;
    world.progression.xpToNext = 180;
    world.progression.nextUpgradeOfferAt = 999;

    expect(createProgressionHudViewModel(world)).toEqual({
      levelLabel: "EX Lv 2 / C1",
      experienceLabel: "経験値 48 / 180",
      experienceRatio: 48 / 180,
      upgradeWaitSeconds: null,
    });
  });
});
