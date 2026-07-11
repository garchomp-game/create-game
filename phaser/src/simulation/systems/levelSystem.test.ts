import { describe, expect, it } from "vitest";
import { SIMULATION_CONFIG } from "../../config/gameConfig";
import type { GameEvent } from "../../domain/types";
import { createRandomStreams } from "../../math/random";
import { createWorld } from "../createWorld";
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
});
