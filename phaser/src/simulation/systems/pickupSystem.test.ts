import { describe, expect, it } from "vitest";
import { FINAL_EXPEDITION_STAGE_DEFINITION } from "../../content/gameContentCatalog";
import {
  FINAL_COMMAND_SHIP_DEFINITION,
  FINAL_COMMAND_SHIP_REPAIR_BUDGET_CANDIDATE_A,
} from "../../content/bossCatalog";
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
    const bossEvents: GameEvent[] = [];
    spawnFinalExpeditionBoss(world, bossEvents);
    updateRunStats(world, bossEvents);
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
      healDropsSuppressedByReason: {
        cooldown: 4,
        "repair-budget-exhausted": 0,
      },
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

  it("consumes finite supply at spawn and emits one partial pickup before exhaustion", () => {
    const world = createWorld(SIMULATION_CONFIG);
    const random = createRandomStreams(708);
    new ExpeditionController(FINAL_EXPEDITION_STAGE_DEFINITION).initialize(
      world,
      random,
    );
    world.state.elapsed = 400;
    const definition = {
      ...FINAL_COMMAND_SHIP_REPAIR_BUDGET_CANDIDATE_A,
      sustain: {
        ...FINAL_COMMAND_SHIP_DEFINITION.sustain,
        repairBudget: { initialSupply: 20 },
      },
    };
    const bossEvents: GameEvent[] = [];
    spawnFinalExpeditionBoss(world, bossEvents, definition);
    updateRunStats(world, bossEvents);

    const firstEvents: GameEvent[] = [createKill(world, 0)];
    updatePickups(world, SIMULATION_CONFIG, firstEvents);
    updateRunStats(world, firstEvents);
    expect(
      firstEvents.find(
        (event) => event.type === "pickup.spawned" && event.pickupKind === "heal",
      ),
    ).toMatchObject({ healValue: 12 });

    world.state.elapsed += 1;
    const secondEvents: GameEvent[] = [createKill(world, 1), createKill(world, 2)];
    updatePickups(world, SIMULATION_CONFIG, secondEvents);
    updateRunStats(world, secondEvents);
    expect(
      secondEvents.find(
        (event) => event.type === "pickup.spawned" && event.pickupKind === "heal",
      ),
    ).toMatchObject({ healValue: 8 });
    expect(secondEvents).toContainEqual(expect.objectContaining({
      type: "boss.heal-drop.suppressed",
      count: 1,
      reason: "repair-budget-exhausted",
    }));

    world.state.elapsed += 1;
    const exhaustedEvents: GameEvent[] = [createKill(world, 3), createKill(world, 4)];
    updatePickups(world, SIMULATION_CONFIG, exhaustedEvents);
    updateRunStats(world, exhaustedEvents);

    expect(exhaustedEvents).toContainEqual(expect.objectContaining({
      type: "boss.heal-drop.suppressed",
      count: 2,
      reason: "repair-budget-exhausted",
    }));
    expect(world.expedition?.boss?.sustain).toMatchObject({
      repairBudgetInitial: 20,
      repairBudgetRemaining: 0,
    });
    expect(world.stats.encounterMetrics.boss).toMatchObject({
      healPickupsSpawned: 2,
      healValueSuppliedDuringBoss: 20,
      repairBudgetInitial: 20,
      repairBudgetSpent: 20,
      repairBudgetRemaining: 0,
      healDropsSuppressedByReason: {
        cooldown: 0,
        "repair-budget-exhausted": 3,
      },
    });
  });

  it("does not spend boss sustain on the boss defeat pickup", () => {
    const world = createWorld(SIMULATION_CONFIG);
    const random = createRandomStreams(709);
    new ExpeditionController(FINAL_EXPEDITION_STAGE_DEFINITION).initialize(
      world,
      random,
    );
    world.state.elapsed = 400;
    const bossEvents: GameEvent[] = [];
    const boss = spawnFinalExpeditionBoss(
      world,
      bossEvents,
      FINAL_COMMAND_SHIP_REPAIR_BUDGET_CANDIDATE_A,
    )!;
    updateRunStats(world, bossEvents);
    const bossKill = {
      ...createKill(world, 0),
      enemyId: boss.id,
      enemyType: boss.typeId,
      xpAwarded: boss.xpValue,
    } satisfies Extract<GameEvent, { type: "enemy.killed" }>;
    const events: GameEvent[] = [bossKill];

    updatePickups(world, SIMULATION_CONFIG, events);
    updateRunStats(world, events);

    expect(events).toContainEqual(expect.objectContaining({
      type: "pickup.spawned",
      pickupKind: "xp",
      xpValue: boss.xpValue,
    }));
    expect(events).not.toContainEqual(expect.objectContaining({
      type: "pickup.spawned",
      pickupKind: "heal",
    }));
    expect(world.expedition?.boss?.sustain.repairBudgetRemaining).toBe(2_400);
    expect(world.stats.encounterMetrics.boss).toMatchObject({
      killsDuringBoss: 1,
      healPickupsSpawned: 0,
      healValueSuppliedDuringBoss: 0,
      repairBudgetSpent: 0,
      repairBudgetRemaining: 2_400,
    });
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
