import { describe, expect, it } from "vitest";
import { SIMULATION_CONFIG } from "../../config/gameConfig";
import { toExProtocolId } from "../../content/exProtocolCatalog";
import type { Enemy, GameEvent } from "../../domain/types";
import { createWorld } from "../createWorld";
import { resolveEnemyDamage } from "./enemyDamageSystem";
import { updatePickups } from "./pickupSystem";

describe("enemyDamageSystem", () => {
  it("resolves a Protocol kill and its rewards exactly once without a fake bullet", () => {
    const world = createWorld(SIMULATION_CONFIG);
    const enemy = createEnemy();
    world.enemies = [enemy];
    const deadEnemies = new Set<Enemy>();
    const events: GameEvent[] = [];
    const source = {
      kind: "ex-protocol" as const,
      protocolId: toExProtocolId("spread.breakwater-fan"),
      activationId: 7,
      effect: "breakwater" as const,
      weaponType: "spread" as const,
    };

    const outcome = resolveEnemyDamage(
      world,
      enemy,
      {
        amount: enemy.hp,
        baselineWithoutAnyProtocol: 0,
        baselineForEffectAttribution: 0,
        source,
      },
      deadEnemies,
      events,
    );
    const duplicate = resolveEnemyDamage(
      world,
      enemy,
      {
        amount: enemy.hp,
        baselineWithoutAnyProtocol: 0,
        baselineForEffectAttribution: 0,
        source,
      },
      deadEnemies,
      events,
    );

    expect(outcome).toMatchObject({
      applied: true,
      killed: true,
      scoreAwarded: enemy.score,
    });
    expect(duplicate.applied).toBe(false);
    expect(world.state.score).toBe(enemy.score);
    expect(events.map((event) => event.type)).toEqual([
      "enemy.protocol.hit",
      "enemy.protocol.killed",
    ]);
    expect(events[0]).not.toHaveProperty("bulletId");
    expect(events[1]).not.toHaveProperty("bulletId");

    updatePickups(world, SIMULATION_CONFIG, events, 0);
    expect(
      events.filter(
        (event) =>
          event.type === "pickup.spawned" &&
          event.pickupKind === "xp",
      ),
    ).toHaveLength(1);
  });
});

function createEnemy(): Enemy {
  const definition = SIMULATION_CONFIG.enemies.chaser;
  return {
    id: "enemy-protocol-target",
    typeId: "chaser",
    position: { x: 100, y: 100 },
    radius: definition.radius,
    hp: definition.hp,
    damage: definition.damage,
    speed: definition.speed,
    score: definition.score,
    xpValue: definition.xpValue,
    behavior: definition.behavior,
    attackTimer: 0,
    enteredArena: true,
  };
}
