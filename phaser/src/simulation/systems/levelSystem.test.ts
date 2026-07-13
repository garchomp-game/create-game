import { describe, expect, it } from "vitest";
import { SIMULATION_CONFIG } from "../../config/gameConfig";
import type { GameEvent } from "../../domain/types";
import { createRandomStreams } from "../../math/random";
import { createWorld } from "../createWorld";
import { composeBuild } from "../buildComposer";
import { updateLevelProgression } from "./levelSystem";
import { updateRunStats } from "./statsSystem";
import { chooseUpgrade } from "./upgradeSystem";
import {
  getAvailableUpgradeIds,
  getLockedUpgradeIds,
  getMaxedUpgradeIds,
  getRemainingUpgradeIds,
  selectUpgradeChoices,
} from "./levelSystem";

describe("level progression cadence", () => {
  it("keeps meaningful choices moving under a ramping human-play XP model", () => {
    const world = createWorld(SIMULATION_CONFIG);
    const random = createRandomStreams(SIMULATION_CONFIG.seed);

    for (let elapsed = 1; elapsed <= 600 && world.progression.buildCompletedAt === null; elapsed += 1) {
      world.state.elapsed = elapsed;
      world.progression.xp += Math.min(6, 0.45 + elapsed * 0.03);
      const events: GameEvent[] = [];
      updateLevelProgression(world, random.upgrade, SIMULATION_CONFIG, events);
      updateRunStats(world, events);

      if (world.state.status === "upgradeSelect") {
        const selectedEvents: GameEvent[] = [];
        chooseUpgrade(world, 0, SIMULATION_CONFIG, selectedEvents);
        updateRunStats(world, selectedEvents);
      }
    }

    const metrics = world.stats.progressionMetrics;
    const offerIntervals = metrics.offers.map((offer, index) =>
      offer.elapsed - (metrics.offers[index - 1]?.elapsed ?? 0),
    );
    const laterIntervals = metrics.offers
      .filter((offer) => offer.elapsed >= 120)
      .map((offer, index, offers) => offer.elapsed - (offers[index - 1]?.elapsed ?? 120));

    expect(metrics.firstOfferAt).toBeGreaterThanOrEqual(5);
    expect(metrics.firstOfferAt).toBeLessThanOrEqual(10);
    expect(
      Math.max(...offerIntervals.filter((_, index) => metrics.offers[index]!.elapsed <= 120)),
    ).toBeLessThanOrEqual(30);
    expect(Math.max(...laterIntervals)).toBeLessThanOrEqual(60);
    expect(metrics.buildCompletedAt).toBeGreaterThanOrEqual(240);
    expect(metrics.buildCompletedAt).toBeLessThanOrEqual(360);
    expect(metrics.longestMeaningfulChoiceGap).toBeLessThanOrEqual(60);
    expect(metrics.selections).toHaveLength(25);
  });

  it("guarantees the Pulse capstone after seven weapon ranks without mislabeling locks", () => {
    const world = createWorld(SIMULATION_CONFIG);
    const random = createRandomStreams(SIMULATION_CONFIG.seed);

    expect(getLockedUpgradeIds(SIMULATION_CONFIG, world.progression.upgradeRanks, "pulse")).toEqual([
      "pulseRicochet",
    ]);
    expect(getMaxedUpgradeIds(SIMULATION_CONFIG, world.progression.upgradeRanks, "pulse")).not.toContain(
      "pulseRicochet",
    );

    world.progression.upgradeRanks.rapidFire = 5;
    world.progression.upgradeRanks.splitShot = 2;

    expect(getAvailableUpgradeIds(SIMULATION_CONFIG, world.progression.upgradeRanks, "pulse")).toContain(
      "pulseRicochet",
    );
    expect(
      selectUpgradeChoices(
        SIMULATION_CONFIG,
        random.upgrade,
        world.progression.upgradeRanks,
        "pulse",
      )[0],
    ).toBe("pulseRicochet");
  });

  it("excludes the Pulse-only capstone from Spread and from disabled experiments", () => {
    const world = createWorld(SIMULATION_CONFIG);
    expect(getRemainingUpgradeIds(SIMULATION_CONFIG, world.progression.upgradeRanks, "spread")).not.toContain(
      "pulseRicochet",
    );

    const disabledConfig = {
      ...SIMULATION_CONFIG,
      features: { ...SIMULATION_CONFIG.features, pulseRicochet: false },
    };
    expect(getRemainingUpgradeIds(disabledConfig, world.progression.upgradeRanks, "pulse")).not.toContain(
      "pulseRicochet",
    );
  });

  it("cycles every available extra once and auto-grants the final card", () => {
    const world = createWorld(SIMULATION_CONFIG);
    for (const upgradeId of Object.keys(world.progression.upgradeRanks) as Array<
      keyof typeof world.progression.upgradeRanks
    >) {
      world.progression.upgradeRanks[upgradeId] = SIMULATION_CONFIG.upgrades[upgradeId].maxRank;
    }
    const normalModifiers = composeBuild(
      SIMULATION_CONFIG,
      world.state.weaponType,
      world.progression.upgradeRanks,
    ).modifiers;
    world.progression.buildCompletedAt = 300;
    world.progression.xpToNext = SIMULATION_CONFIG.leveling.extra.baseXp;
    world.progression.xp = world.progression.xpToNext;
    world.state.elapsed = 301;
    const events: GameEvent[] = [];

    updateLevelProgression(world, () => 0, SIMULATION_CONFIG, events);

    expect(world.progression.extraLevel).toBe(1);
    expect(world.progression.extraCycle).toBe(1);
    expect(world.state.status).toBe("upgradeSelect");
    expect(world.progression.pendingUpgradeChoices[0]).toBe("limitPower");
    expect(events).toContainEqual(
      expect.objectContaining({ type: "extra.level_up", extraLevel: 1, cycle: 1 }),
    );

    const selectedEvents: GameEvent[] = [];
    chooseUpgrade(world, 0, SIMULATION_CONFIG, selectedEvents);
    expect(world.progression.extraUpgradeRanks.limitPower).toBe(1);
    expect(world.runtime.projectileDamageMultiplier).toBeCloseTo(1.08);
    expect(world.state.status).toBe("playing");
    expect(selectedEvents).toContainEqual(
      expect.objectContaining({
        type: "extra.upgrade.selected",
        extraUpgradeId: "limitPower",
        rank: 1,
        cycle: 1,
        automatic: false,
      }),
    );

    for (let extraLevel = 2; extraLevel <= 3; extraLevel += 1) {
      world.progression.xp = world.progression.xpToNext;
      updateLevelProgression(world, () => 0, SIMULATION_CONFIG, []);
      expect(world.progression.pendingUpgradeChoices).not.toContain("limitPower");
      chooseUpgrade(world, 0, SIMULATION_CONFIG, []);
    }

    world.progression.xp = world.progression.xpToNext;
    const automaticEvents: GameEvent[] = [];
    updateLevelProgression(world, () => 0, SIMULATION_CONFIG, automaticEvents);

    expect(world.progression.extraLevel).toBe(4);
    expect(world.progression.extraUpgradeRanks).toEqual({
      limitPower: 1,
      limitCycle: 1,
      limitDrive: 1,
      limitCore: 1,
    });
    expect(world.runtime.projectileDamageMultiplier).toBeCloseTo(1.08);
    expect(world.runtime.fireIntervalMultiplier).toBeCloseTo(
      normalModifiers.fireIntervalMultiplier / 1.1,
    );
    expect(world.runtime.playerSpeedMultiplier).toBeCloseTo(
      normalModifiers.playerSpeedMultiplier * 1.06,
    );
    expect(world.runtime.maxHpBonus).toBe(normalModifiers.maxHpBonus + 8);
    expect(world.state.status).toBe("playing");
    expect(automaticEvents).toContainEqual(
      expect.objectContaining({
        type: "extra.upgrade.selected",
        extraUpgradeId: "limitCore",
        automatic: true,
      }),
    );
    expect(automaticEvents).toContainEqual({
      type: "extra.cycle.completed",
      cycle: 1,
      extraLevel: 4,
    });

    world.progression.xp = world.progression.xpToNext;
    updateLevelProgression(world, () => 0, SIMULATION_CONFIG, []);
    expect(world.progression.extraCycle).toBe(2);
    expect(world.progression.pendingUpgradeChoices).toContain("limitPower");
  });
});
