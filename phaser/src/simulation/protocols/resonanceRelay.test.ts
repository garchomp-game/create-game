import { describe, expect, it } from "vitest";
import { SIMULATION_CONFIG } from "../../config/gameConfig";
import { toExProtocolId } from "../../content/exProtocolCatalog";
import type {
  Enemy,
  GameEvent,
  Obstacle,
  SimulationConfig,
  WorldState,
} from "../../domain/types";
import { createWorld } from "../createWorld";
import { resolveCombat } from "../systems/combatSystem";
import { updateShooting } from "../systems/shootingSystem";

const CANDIDATE_CONFIG: SimulationConfig = {
  ...SIMULATION_CONFIG,
  features: {
    ...SIMULATION_CONFIG.features,
    exProtocols: true,
  },
  exProtocolOfferPolicy: "fixed-compatible",
};

describe("Resonance Relay", () => {
  it("damages stable intermediate targets between a prior anchor and later endpoint", () => {
    const world = createResonanceWorld();
    const events: GameEvent[] = [];
    const anchor = createAnchor(world, events);
    world.player.position = { x: 800, y: 270 };
    world.state.lastAim = { x: -1, y: 0 };
    world.state.shotTimer = 0;
    updateShooting(world, true, CANDIDATE_CONFIG, events);
    const endpointBullet = world.bullets[0]!;
    const endpoint = createEnemy(
      "enemy-endpoint",
      endpointBullet.position.x,
      270,
      100,
      6,
    );
    const near = createEnemy("enemy-near", 300, 270, 100, 2);
    const middle = createEnemy("enemy-middle", 450, 270, 100, 3);
    const far = createEnemy("enemy-far", 600, 270, 100, 4);
    const beyondLimit = createEnemy(
      "enemy-beyond-limit",
      700,
      270,
      100,
      5,
    );
    world.enemies = [
      anchor,
      beyondLimit,
      far,
      endpoint,
      near,
      middle,
    ];

    resolveCombat(world, CANDIDATE_CONFIG, events);

    expect(
      events
        .filter(
          (
            event,
          ): event is Extract<
            GameEvent,
            { type: "enemy.protocol.hit" }
          > => event.type === "enemy.protocol.hit",
        )
        .map((event) => event.enemyId),
    ).toEqual(["enemy-near", "enemy-middle", "enemy-far"]);
    expect(events).toContainEqual(
      expect.objectContaining({
        type: "ex.relay.resolved",
        targetCount: 3,
      }),
    );
    expect(anchor.pulseFocusStacks).toBe(0);
    expect(getRuntime(world).anchor).toBeNull();
    expect(near.hp).toBeCloseTo(
      100 - CANDIDATE_CONFIG.weapons.pulse.damage * 0.55,
    );
    expect(beyondLimit.hp).toBe(100);
  });

  it("keeps the prior anchor when an expanded obstacle blocks the corridor", () => {
    const world = createResonanceWorld();
    const events: GameEvent[] = [];
    const anchor = createAnchor(world, events);
    world.obstacles = [
      {
        id: "relay-wall",
        x: 430,
        y: 240,
        width: 30,
        height: 60,
      } satisfies Obstacle,
    ];
    world.player.position = { x: 800, y: 270 };
    world.state.lastAim = { x: -1, y: 0 };
    world.state.shotTimer = 0;
    updateShooting(world, true, CANDIDATE_CONFIG, events);
    const endpointBullet = world.bullets[0]!;
    const endpoint = createEnemy(
      "enemy-endpoint",
      endpointBullet.position.x,
      270,
      100,
      3,
    );
    const intermediate = createEnemy(
      "enemy-intermediate",
      500,
      270,
      100,
      2,
    );
    world.enemies = [anchor, endpoint, intermediate];

    resolveCombat(world, CANDIDATE_CONFIG, events);

    expect(events).toContainEqual(
      expect.objectContaining({
        type: "ex.relay.blocked",
        anchorEnemyId: anchor.id,
        endpointEnemyId: endpoint.id,
      }),
    );
    expect(
      events.some((event) => event.type === "enemy.protocol.hit"),
    ).toBe(false);
    expect(getRuntime(world).anchor?.enemyId).toBe(anchor.id);
  });

  it("does not consume or replace an anchor within its creation volley", () => {
    const world = createResonanceWorld();
    world.runtime.hitCapacityBonus = 1;
    const events: GameEvent[] = [];
    updateShooting(world, true, CANDIDATE_CONFIG, events);
    const bullet = world.bullets[0]!;
    const first = createEnemy(
      "enemy-first",
      bullet.position.x,
      270,
      100,
      1,
    );
    first.pulseFocusStacks = 2;
    first.pulseFocusExpiresAt = 10;
    const second = createEnemy(
      "enemy-second",
      bullet.position.x,
      270,
      100,
      2,
    );
    second.pulseFocusStacks = 2;
    second.pulseFocusExpiresAt = 10;
    world.enemies = [first, second];

    resolveCombat(world, CANDIDATE_CONFIG, events);

    expect(getRuntime(world).anchor?.enemyId).toBe(first.id);
    expect(
      events.some(
        (event) =>
          event.type === "ex.relay.resolved" ||
          event.type === "ex.relay.blocked",
      ),
    ).toBe(false);
  });
});

function createResonanceWorld(): WorldState {
  const world = createWorld(CANDIDATE_CONFIG);
  world.obstacles = [];
  world.player.position = { x: 100, y: 270 };
  world.state.lastAim = { x: 1, y: 0 };
  world.state.weaponType = "pulse";
  world.runtime.pulseFocusMaxStacks = 3;
  world.runtime.pulseFocusDuration = 0.9;
  const protocolId = toExProtocolId("pulse.resonance-relay");
  world.progression.exProtocol = {
    status: "selected",
    route: {
      protocolId,
      selectedAt: 0,
      evolutionOneId: null,
      evolutionOneSelectedAt: null,
      evolutionTwoId: null,
      evolutionTwoSelectedAt: null,
      masteryUnlocked: false,
      masteryUnlockedAt: null,
    },
    runtime: {
      kind: "resonance-relay",
      protocolId,
      nextActivationId: 1,
      anchor: null,
    },
  };
  return world;
}

function createAnchor(
  world: WorldState,
  events: GameEvent[],
): Enemy {
  updateShooting(world, true, CANDIDATE_CONFIG, events);
  const bullet = world.bullets[0]!;
  const anchor = createEnemy(
    "enemy-anchor",
    bullet.position.x,
    270,
    100,
    1,
  );
  anchor.pulseFocusStacks = 2;
  anchor.pulseFocusExpiresAt = 10;
  world.enemies = [anchor];
  resolveCombat(world, CANDIDATE_CONFIG, events);
  expect(getRuntime(world).anchor?.enemyId).toBe(anchor.id);
  return anchor;
}

function createEnemy(
  id: string,
  x: number,
  y: number,
  hp: number,
  creationOrdinal: number,
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
    candidate: { creationOrdinal },
  };
}

function getRuntime(world: WorldState) {
  const progression = world.progression.exProtocol;
  if (
    progression?.status !== "selected" ||
    progression.runtime.kind !== "resonance-relay"
  ) {
    throw new Error("Expected Resonance Relay runtime.");
  }
  return progression.runtime;
}
