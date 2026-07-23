import { describe, expect, it } from "vitest";
import { SIMULATION_CONFIG } from "../../config/gameConfig";
import {
  toExProtocolEvolutionId,
  toExProtocolId,
} from "../../content/exProtocolCatalog";
import type {
  Enemy,
  GameEvent,
  SimulationConfig,
  WorldState,
} from "../../domain/types";
import { createWorld } from "../createWorld";
import { updateBullets } from "../systems/bulletSystem";
import { resolveCombat } from "../systems/combatSystem";
import { updateShooting } from "../systems/shootingSystem";
import { updateReboundLifecycle } from "./reboundOverdrive";

const CANDIDATE_CONFIG: SimulationConfig = {
  ...SIMULATION_CONFIG,
  features: {
    ...SIMULATION_CONFIG.features,
    exProtocols: true,
    pulseBoundaryRicochet: true,
  },
  exProtocolOfferPolicy: "fixed-compatible",
};

describe("Rebound Overdrive", () => {
  it("arms before shooting and restores capacity only after a real ricochet", () => {
    const world = createReboundWorld();
    world.player.position = { x: 910, y: 270 };
    world.state.lastAim = { x: 1, y: 0 };
    world.runtime.hitCapacityBonus = 1;
    world.runtime.ricochetBonus = 1;
    const events: GameEvent[] = [];

    updateReboundLifecycle(world, true, events);
    updateShooting(world, true, CANDIDATE_CONFIG, events);
    const bullet = world.bullets[0]!;
    world.enemies = [createEnemy("enemy-outgoing", 945, 270)];
    const motions = updateBullets(world, 0.05, CANDIDATE_CONFIG);
    resolveCombat(world, CANDIDATE_CONFIG, events, motions);

    expect(events.slice(0, 2).map((event) => event.type)).toEqual([
      "ex.special.armed",
      "shot.fired",
    ]);
    expect(events).toContainEqual(
      expect.objectContaining({
        type: "ex.rebound.restored",
        restoredCapacity: 1,
      }),
    );
    expect(bullet.hitsRemaining).toBe(2);
    expect(bullet.candidate?.protocolState).toMatchObject({
      kind: "rebound-overdrive",
      capacityRestored: true,
      postRicochet: true,
    });
  });

  it("expires without a volley and neither restarts nor refunds cooldown", () => {
    const world = createReboundWorld();
    const events: GameEvent[] = [];

    updateReboundLifecycle(world, true, events);
    updateReboundLifecycle(world, true, events);
    world.state.elapsed = 1.26;
    updateReboundLifecycle(world, false, events);

    expect(events.map((event) => event.type)).toEqual([
      "ex.special.armed",
      "ex.special.rejected",
      "ex.special.expired",
    ]);
    expect(
      events.find((event) => event.type === "ex.special.rejected"),
    ).toMatchObject({ reason: "already-armed" });
    expect(
      world.progression.exProtocol?.status === "selected" &&
        world.progression.exProtocol.runtime.kind ===
          "rebound-overdrive"
        ? world.progression.exProtocol.runtime.cooldownUntil
        : null,
    ).toBe(6);
  });

  it("applies Return Surge and refunds remaining cooldown after three post-ricochet targets", () => {
    const world = createReboundWorld({
      evolutionOneId: "deep-return",
      evolutionTwoId: "return-surge",
      masteryUnlocked: true,
    });
    world.player.position = { x: 910, y: 270 };
    world.state.lastAim = { x: 1, y: 0 };
    world.runtime.hitCapacityBonus = 1;
    world.runtime.ricochetBonus = 1;
    const events: GameEvent[] = [];
    updateReboundLifecycle(world, true, events);
    updateShooting(world, true, CANDIDATE_CONFIG, events);
    const bullet = world.bullets[0]!;
    world.enemies = [createEnemy("enemy-outgoing", 945, 270)];
    resolveCombat(
      world,
      CANDIDATE_CONFIG,
      events,
      updateBullets(world, 0.05, CANDIDATE_CONFIG),
    );

    world.enemies = [
      createEnemy("enemy-return-1", 950, 270, 100),
      createEnemy("enemy-return-2", 940, 270, 100),
      createEnemy("enemy-return-3", 930, 270, 100),
    ];
    resolveCombat(
      world,
      CANDIDATE_CONFIG,
      events,
      updateBullets(world, 0.05, CANDIDATE_CONFIG),
    );

    const hitEvents = events.filter(
      (
        event,
      ): event is Extract<GameEvent, { type: "enemy.hit" }> =>
        event.type === "enemy.hit" &&
        event.enemyId.startsWith("enemy-return"),
    );
    expect(hitEvents).toHaveLength(3);
    for (const event of hitEvents) {
      expect(event.damage).toBeCloseTo(
        CANDIDATE_CONFIG.weapons.pulse.damage * 1.3,
      );
    }
    expect(events).toContainEqual(
      expect.objectContaining({
        type: "ex.rebound.cooldown.refunded",
        volleyId: bullet.volleyId,
        remainingBefore: 6,
        remainingAfter: 3,
      }),
    );
  });
});

function createReboundWorld(options?: {
  evolutionOneId: "deep-return";
  evolutionTwoId: "return-surge";
  masteryUnlocked: boolean;
}): WorldState {
  const world = createWorld(CANDIDATE_CONFIG);
  world.state.weaponType = "pulse";
  const protocolId = toExProtocolId("pulse.rebound-overdrive");
  world.progression.exProtocol = {
    status: "selected",
    route: {
      protocolId,
      selectedAt: 0,
      evolutionOneId: options
        ? toExProtocolEvolutionId(
            protocolId,
            "evolutionOne",
            options.evolutionOneId,
          )
        : null,
      evolutionOneSelectedAt: options ? 0 : null,
      evolutionTwoId: options
        ? toExProtocolEvolutionId(
            protocolId,
            "evolutionTwo",
            options.evolutionTwoId,
          )
        : null,
      evolutionTwoSelectedAt: options ? 0 : null,
      masteryUnlocked: options?.masteryUnlocked ?? false,
      masteryUnlockedAt: options?.masteryUnlocked ? 0 : null,
    },
    runtime: {
      kind: "rebound-overdrive",
      protocolId,
      armedUntil: null,
      cooldownUntil: 0,
      armedVolleyId: null,
    },
  };
  return world;
}

function createEnemy(
  id: string,
  x: number,
  y: number,
  hp = 1,
): Enemy {
  const definition = CANDIDATE_CONFIG.enemies.chaser;
  return {
    id,
    typeId: "chaser",
    position: { x, y },
    radius: definition.radius,
    hp,
    damage: definition.damage,
    speed: definition.speed,
    score: definition.score,
    xpValue: definition.xpValue,
    behavior: definition.behavior,
    attackTimer: 0,
    enteredArena: true,
  };
}
