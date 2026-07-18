import { describe, expect, it } from "vitest";
import { FINAL_EXPEDITION_STAGE_DEFINITION } from "../../content/gameContentCatalog";
import { SIMULATION_CONFIG } from "../../config/gameConfig";
import type { GameEvent, WorldState } from "../../domain/types";
import { createRandomStreams } from "../../math/random";
import { ExpeditionController } from "../ExpeditionController";
import { createWorld } from "../createWorld";
import { spawnFinalExpeditionBoss } from "./bossSystem";
import { updatePickups } from "./pickupSystem";
import { updateRunStats } from "./statsSystem";

describe("boss-fight pickup sustain", () => {
  it("allows at most one heal drop per configured cooldown window", () => {
    const world = createWorld(SIMULATION_CONFIG);
    const random = createRandomStreams(707);
    new ExpeditionController(FINAL_EXPEDITION_STAGE_DEFINITION).initialize(
      world,
      random,
    );
    world.state.elapsed = 400;
    spawnFinalExpeditionBoss(world, []);
    const config = {
      ...SIMULATION_CONFIG,
      pickup: {
        ...SIMULATION_CONFIG.pickup,
        healDropChance: 1,
        healDropMaxChance: 1,
        healDropPityBonus: 0,
      },
    };
    const events: GameEvent[] = Array.from({ length: 5 }, (_, index) =>
      createKill(world, index),
    );

    updatePickups(world, config, events);
    updateRunStats(world, events);

    expect(
      events.filter(
        (event) => event.type === "pickup.spawned" && event.pickupKind === "heal",
      ),
    ).toHaveLength(1);
    expect(events).toContainEqual(
      expect.objectContaining({
        type: "boss.heal-drop.suppressed",
        count: 4,
        reason: "cooldown",
      }),
    );
    expect(world.runtime.healDropRollIndex).toBe(1);
    expect(world.stats.encounterMetrics.boss).toMatchObject({
      killsDuringBoss: 5,
      healPickupsSpawned: 1,
      healDropsSuppressed: 4,
    });

    world.state.elapsed += 1;
    const nextEvents: GameEvent[] = [createKill(world, 5)];
    updatePickups(world, config, nextEvents);
    expect(
      nextEvents.filter(
        (event) => event.type === "pickup.spawned" && event.pickupKind === "heal",
      ),
    ).toHaveLength(1);
  });
});

function createKill(
  world: WorldState,
  index: number,
): Extract<GameEvent, { type: "enemy.killed" }> {
  return {
    type: "enemy.killed",
    bulletId: `bullet-${index}`,
    volleyId: index + 1,
    enemyId: `enemy-kill-${index}`,
    enemyType: "chaser",
    weaponType: "pulse",
    scoreAwarded: 10,
    xpAwarded: 1,
    position: { x: 80 + index * 24, y: 80 },
  };
}
