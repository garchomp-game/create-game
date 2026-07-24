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
import { resolveCombat } from "../systems/combatSystem";
import { updateShooting } from "../systems/shootingSystem";
import {
  activateTidalSweep,
  recordTidalActivationHit,
  recordTidalNormalHit,
  updateTidalLifecycle,
} from "./tidalSweep";

const CANDIDATE_CONFIG: SimulationConfig = {
  ...SIMULATION_CONFIG,
  features: {
    ...SIMULATION_CONFIG.features,
    exProtocols: true,
  },
  exProtocolOfferPolicy: "fixed-compatible",
};

describe("Full-span Tidal Sweep", () => {
  it("charges from three distinct normal targets without requiring both outer projectiles", () => {
    const world = createTidalWorld();
    const events: GameEvent[] = [];
    updateShooting(world, true, CANDIDATE_CONFIG, events);
    expect(world.bullets).toHaveLength(3);
    const bullet = world.bullets[1]!;

    for (let index = 0; index < 3; index += 1) {
      recordTidalNormalHit(
        world,
        bullet,
        createEnemy(`enemy-${index}`, 100 + index * 20, 270),
        events,
      );
    }

    expect(getRuntime(world).charges).toBe(1);
    expect(events).toContainEqual(
      expect.objectContaining({
        type: "ex.tidal.charged",
        charge: 1,
        maxCharge: 1,
      }),
    );
  });

  it("fires nine Protocol projectiles and damages one enemy once per activation", () => {
    const world = createTidalWorld();
    getRuntime(world).charges = 1;
    world.state.shotTimer = 0.2;
    const events: GameEvent[] = [];

    activateTidalSweep(world, true, CANDIDATE_CONFIG, events);

    expect(getRuntime(world).charges).toBe(0);
    expect(world.state.shotTimer).toBe(0.2);
    expect(world.bullets).toHaveLength(9);
    expect(
      world.bullets.every(
        (bullet) =>
          bullet.candidate?.volleyKind === "ex.tidal" &&
          bullet.candidate.projectileRole === "protocol",
      ),
    ).toBe(true);
    expect(events.slice(0, 2).map((event) => event.type)).toEqual([
      "ex.special.activated",
      "ex.protocol.volley.fired",
    ]);

    const target = createEnemy("enemy-shared", 500, 270, 100);
    for (const bullet of world.bullets) {
      bullet.position = { ...target.position };
      bullet.velocity = { x: 0, y: 0 };
    }
    world.enemies = [target];
    resolveCombat(world, CANDIDATE_CONFIG, events);

    expect(
      events.filter((event) => event.type === "enemy.protocol.hit"),
    ).toHaveLength(1);
    expect(target.hp).toBeCloseTo(
      100 -
        CANDIDATE_CONFIG.weapons.spread.damage *
          0.65,
    );
    expect(
      world.bullets.filter((bullet) => bullet.hitsRemaining === 2),
    ).toHaveLength(8);
  });

  it("applies Backwash and Second Crest once at five activation targets", () => {
    const world = createTidalWorld({
      evolutionTwoId: "backwash-cycle",
      masteryUnlocked: true,
    });
    getRuntime(world).charges = 1;
    const events: GameEvent[] = [];
    activateTidalSweep(world, true, CANDIDATE_CONFIG, events);
    const bullet = world.bullets[0]!;
    world.state.shotTimer = 4;

    for (let index = 0; index < 5; index += 1) {
      recordTidalActivationHit(
        world,
        bullet,
        createEnemy(`enemy-${index}`, 100 + index * 20, 270),
        events,
      );
    }
    recordTidalActivationHit(
      world,
      bullet,
      createEnemy("enemy-extra", 300, 270),
      events,
    );

    expect(world.state.shotTimer).toBe(2);
    expect(world.weaponIdentity.spreadSweepCharge).toBe(true);
    expect(
      events.filter(
        (event) => event.type === "ex.tidal.backwash.triggered",
      ),
    ).toHaveLength(1);
    expect(
      events.filter(
        (event) =>
          event.type === "ex.tidal.second-crest.triggered",
      ),
    ).toHaveLength(1);

    world.bullets = [];
    updateTidalLifecycle(world);
    expect(Object.keys(getRuntime(world).activations)).toHaveLength(0);
  });
});

function createTidalWorld(options?: {
  evolutionTwoId: "backwash-cycle";
  masteryUnlocked: boolean;
}): WorldState {
  const world = createWorld(CANDIDATE_CONFIG);
  world.state.weaponType = "spread";
  const protocolId = toExProtocolId(
    "spread.full-span-tidal-sweep",
  );
  world.progression.exProtocol = {
    status: "selected",
    route: {
      protocolId,
      selectedAt: 0,
      evolutionOneId: null,
      evolutionOneSelectedAt: null,
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
      kind: "full-span-tidal-sweep",
      protocolId,
      charges: 0,
      nextActivationId: 1,
      activations: {},
    },
  };
  return world;
}

function getRuntime(world: WorldState) {
  const progression = world.progression.exProtocol;
  if (
    progression?.status !== "selected" ||
    progression.runtime.kind !== "full-span-tidal-sweep"
  ) {
    throw new Error("Expected Tidal Sweep runtime.");
  }
  return progression.runtime;
}

function createEnemy(
  id: string,
  x: number,
  y: number,
  hp = 10,
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
