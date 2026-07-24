import { describe, expect, it } from "vitest";
import { SIMULATION_CONFIG } from "../../config/gameConfig";
import {
  toExProtocolEvolutionId,
  toExProtocolId,
} from "../../content/exProtocolCatalog";
import type {
  Bullet,
  Enemy,
  EnemyProjectile,
  GameEvent,
  SimulationConfig,
  WorldState,
} from "../../domain/types";
import { createWorld } from "../createWorld";
import {
  firstRelativeSweptCircleContact,
  MAX_COLLISION_EVENTS_PER_FRAME,
  resolveAegisCollisionFrame,
} from "./aegisCollisionSystem";

const CANDIDATE_CONFIG: SimulationConfig = {
  ...SIMULATION_CONFIG,
  features: {
    ...SIMULATION_CONFIG.features,
    exProtocols: true,
  },
  exProtocolOfferPolicy: "fixed-compatible",
};

describe("Aegis global collision arbitration", () => {
  it("solves crossing, initial overlap, tangent, and zero-relative-speed sweeps", () => {
    expect(
      firstRelativeSweptCircleContact({
        firstStart: { x: 0, y: 0 },
        firstEnd: { x: 10, y: 0 },
        firstRadius: 1,
        secondStart: { x: 10, y: 0 },
        secondEnd: { x: 0, y: 0 },
        secondRadius: 1,
        intervalStart: 0,
        intervalEnd: 1,
      }),
    ).toBeCloseTo(0.4);
    expect(
      firstRelativeSweptCircleContact({
        firstStart: { x: 0, y: 0 },
        firstEnd: { x: 0, y: 0 },
        firstRadius: 1,
        secondStart: { x: 1, y: 0 },
        secondEnd: { x: 1, y: 0 },
        secondRadius: 1,
        intervalStart: 0.2,
        intervalEnd: 0.8,
      }),
    ).toBe(0.2);
    expect(
      firstRelativeSweptCircleContact({
        firstStart: { x: 0, y: 0 },
        firstEnd: { x: 10, y: 0 },
        firstRadius: 1,
        secondStart: { x: 5, y: 2 },
        secondEnd: { x: 5, y: 2 },
        secondRadius: 1,
        intervalStart: 0,
        intervalEnd: 1,
      }),
    ).toBeCloseTo(0.5);
    expect(
      firstRelativeSweptCircleContact({
        firstStart: { x: 0, y: 0 },
        firstEnd: { x: 10, y: 0 },
        firstRadius: 1,
        secondStart: { x: 5, y: 5 },
        secondEnd: { x: 15, y: 5 },
        secondRadius: 1,
        intervalStart: 0,
        intervalEnd: 1,
      }),
    ).toBeNull();
  });

  it("intercepts only explicitly standard interceptible projectiles", () => {
    const standardWorld = createAegisWorld();
    standardWorld.bullets = [
      createEdgeBullet(1, "left", { x: 100, y: 100 }, { x: 1_000, y: 0 }),
    ];
    standardWorld.enemyProjectiles = [
      createEnemyProjectile(
        1,
        { x: 150, y: 100 },
        { x: -1_000, y: 0 },
      ),
    ];
    const events: GameEvent[] = [];

    resolveAegisCollisionFrame(
      standardWorld,
      0.05,
      CANDIDATE_CONFIG,
      events,
    );

    expect(standardWorld.bullets).toHaveLength(0);
    expect(standardWorld.enemyProjectiles).toHaveLength(0);
    expect(events).toContainEqual(
      expect.objectContaining({
        type: "ex.aegis.intercepted",
        side: "left",
        enemyProjectileCategory: "standard",
      }),
    );

    const bossWorld = createAegisWorld();
    bossWorld.bullets = [
      createEdgeBullet(1, "left", { x: 100, y: 100 }, { x: 1_000, y: 0 }),
    ];
    bossWorld.enemyProjectiles = [
      createEnemyProjectile(
        1,
        { x: 150, y: 100 },
        { x: -1_000, y: 0 },
        { category: "boss", interceptible: false },
      ),
    ];
    const bossEvents: GameEvent[] = [];

    resolveAegisCollisionFrame(
      bossWorld,
      0.05,
      CANDIDATE_CONFIG,
      bossEvents,
    );

    expect(bossWorld.bullets).toHaveLength(1);
    expect(bossWorld.enemyProjectiles).toHaveLength(1);
    expect(
      bossEvents.some(
        (event) => event.type === "ex.aegis.intercepted",
      ),
    ).toBe(false);
  });

  it("uses Broad Intercept radius without changing the enemy-hit radius", () => {
    const run = (broad: boolean) => {
      const world = createAegisWorld(
        broad ? { evolutionOneId: "broad-intercept" } : {},
      );
      world.bullets = [
        createEdgeBullet(
          1,
          "left",
          { x: 100, y: 100 },
          { x: 1_000, y: 0 },
        ),
      ];
      world.enemyProjectiles = [
        createEnemyProjectile(
          1,
          { x: 150, y: 113 },
          { x: -1_000, y: 0 },
        ),
      ];
      resolveAegisCollisionFrame(
        world,
        0.05,
        CANDIDATE_CONFIG,
        [],
      );
      return world;
    };

    expect(run(false).enemyProjectiles).toHaveLength(1);
    expect(run(true).enemyProjectiles).toHaveLength(0);
  });

  it("does not intercept on a post-ricochet segment", () => {
    const world = createAegisWorld();
    world.obstacles = [
      { id: "wall", x: 130, y: 80, width: 20, height: 40 },
    ];
    world.bullets = [
      createEdgeBullet(
        1,
        "left",
        { x: 100, y: 100 },
        { x: 800, y: 0 },
        { ricochetRemaining: 1 },
      ),
    ];
    world.enemyProjectiles = [
      createEnemyProjectile(
        1,
        { x: 85, y: 100 },
        { x: 400, y: 0 },
      ),
    ];
    const events: GameEvent[] = [];

    resolveAegisCollisionFrame(
      world,
      0.05,
      CANDIDATE_CONFIG,
      events,
    );

    expect(world.bullets).toHaveLength(1);
    expect(world.enemyProjectiles).toHaveLength(1);
    expect(
      events.some(
        (event) => event.type === "ex.aegis.intercepted",
      ),
    ).toBe(false);
    expect(events).toContainEqual(
      expect.objectContaining({
        type: "bullet.ricocheted",
        obstacleId: "wall",
      }),
    );
  });

  it("preserves the edge and its enemy-hit capacity with Carry Through", () => {
    const world = createAegisWorld({
      evolutionTwoId: "carry-through",
    });
    world.bullets = [
      createEdgeBullet(1, "left", { x: 100, y: 100 }, { x: 2_000, y: 0 }),
    ];
    world.enemyProjectiles = [
      createEnemyProjectile(
        1,
        { x: 125, y: 100 },
        { x: -200, y: 0 },
      ),
    ];
    world.enemies = [createEnemy(1, { x: 180, y: 100 })];
    const events: GameEvent[] = [];

    resolveAegisCollisionFrame(
      world,
      0.05,
      CANDIDATE_CONFIG,
      events,
    );

    expect(world.enemyProjectiles).toHaveLength(0);
    expect(world.enemies).toHaveLength(0);
    expect(events.map((event) => event.type)).toEqual([
      "ex.aegis.intercepted",
      "enemy.hit",
      "enemy.killed",
    ]);
  });

  it("uses the lower bullet ordinal when both edges reach one projectile together", () => {
    const world = createAegisWorld();
    world.bullets = [
      createEdgeBullet(2, "right", { x: 100, y: 100 }, { x: 100, y: 0 }),
      createEdgeBullet(1, "left", { x: 100, y: 100 }, { x: 100, y: 0 }),
    ];
    world.enemyProjectiles = [
      createEnemyProjectile(1, { x: 107, y: 100 }, { x: 0, y: 0 }),
    ];
    const events: GameEvent[] = [];

    resolveAegisCollisionFrame(
      world,
      0.05,
      CANDIDATE_CONFIG,
      events,
    );

    expect(world.bullets.map((bullet) => bullet.id)).toEqual([
      "bullet-2",
    ]);
    expect(events).toContainEqual(
      expect.objectContaining({
        type: "ex.aegis.intercepted",
        side: "left",
      }),
    );
  });

  it("grants Perfect Guard when both sides of one volley intercept", () => {
    const world = createAegisWorld({ masteryUnlocked: true });
    world.analytics.activeVolleys[1] = {
      weaponType: "spread",
      enemyIds: [],
      postRicochetEnemyIds: [],
      spreadSweepEnemyIds: [],
      spreadSweepTriggered: false,
    };
    world.bullets = [
      createEdgeBullet(1, "left", { x: 100, y: 90 }, { x: 1_000, y: 0 }),
      createEdgeBullet(2, "right", { x: 100, y: 110 }, { x: 1_000, y: 0 }),
    ];
    world.enemyProjectiles = [
      createEnemyProjectile(1, { x: 140, y: 90 }, { x: -1_000, y: 0 }),
      createEnemyProjectile(2, { x: 140, y: 110 }, { x: -1_000, y: 0 }),
    ];
    const events: GameEvent[] = [];

    resolveAegisCollisionFrame(
      world,
      0.05,
      CANDIDATE_CONFIG,
      events,
    );

    expect(getAegisRuntime(world).perfectGuardCharges).toBe(1);
    expect(
      events.filter(
        (event) =>
          event.type === "ex.aegis.perfect-guard.charged",
      ),
    ).toHaveLength(1);
  });

  it("lets projectile termination beat a simultaneous interception", () => {
    const world = createAegisWorld();
    world.bullets = [
      createEdgeBullet(1, "left", { x: 100, y: 100 }, { x: 100, y: 0 }),
    ];
    world.enemyProjectiles = [
      createEnemyProjectile(
        1,
        { x: 107, y: 100 },
        { x: 0, y: 0 },
        { lifetime: 0 },
      ),
    ];
    const events: GameEvent[] = [];

    resolveAegisCollisionFrame(
      world,
      0.05,
      CANDIDATE_CONFIG,
      events,
    );

    expect(world.bullets).toHaveLength(1);
    expect(world.enemyProjectiles).toHaveLength(0);
    expect(
      events.some(
        (event) => event.type === "ex.aegis.intercepted",
      ),
    ).toBe(false);
  });

  it("intercepts before the legacy endpoint player hit", () => {
    const world = createAegisWorld();
    world.player.position = { x: 150, y: 100 };
    world.state.hp = 100;
    world.bullets = [
      createEdgeBullet(1, "left", { x: 130, y: 100 }, { x: -400, y: 0 }),
    ];
    world.enemyProjectiles = [
      createEnemyProjectile(
        1,
        { x: 100, y: 100 },
        { x: 1_000, y: 0 },
      ),
    ];
    const events: GameEvent[] = [];

    resolveAegisCollisionFrame(
      world,
      0.05,
      CANDIDATE_CONFIG,
      events,
    );

    expect(world.state.hp).toBe(100);
    expect(
      events.some((event) => event.type === "player.damaged"),
    ).toBe(false);
    expect(events[0]?.type).toBe("ex.aegis.intercepted");
  });

  it("drops an intercepted edge without committing its future ricochet", () => {
    const world = createAegisWorld();
    world.obstacles = [
      { id: "wall", x: 130, y: 80, width: 20, height: 40 },
    ];
    world.bullets = [
      createEdgeBullet(
        1,
        "left",
        { x: 100, y: 100 },
        { x: 800, y: 0 },
        { ricochetRemaining: 1 },
      ),
    ];
    world.enemyProjectiles = [
      createEnemyProjectile(1, { x: 108, y: 100 }, { x: 0, y: 0 }),
    ];
    const events: GameEvent[] = [];

    resolveAegisCollisionFrame(
      world,
      0.05,
      CANDIDATE_CONFIG,
      events,
    );

    expect(world.bullets).toHaveLength(0);
    expect(
      events.some((event) => event.type === "bullet.ricocheted"),
    ).toBe(false);
  });

  it("produces the same kill owner and digest after entity arrays are shuffled", () => {
    const first = createPermutationWorld();
    const second = structuredClone(first);
    second.bullets.reverse();
    second.enemyProjectiles.reverse();
    second.enemies.reverse();
    const firstEvents: GameEvent[] = [];
    const secondEvents: GameEvent[] = [];

    resolveAegisCollisionFrame(
      first,
      0.05,
      CANDIDATE_CONFIG,
      firstEvents,
    );
    resolveAegisCollisionFrame(
      second,
      0.05,
      CANDIDATE_CONFIG,
      secondEvents,
    );

    expect(secondEvents).toEqual(firstEvents);
    expect(projectCollisionResult(second)).toEqual(
      projectCollisionResult(first),
    );
    expect(
      firstEvents.find((event) => event.type === "enemy.killed"),
    ).toMatchObject({ bulletId: "bullet-1" });
  });

  it("keeps interception outcomes stable across 30, 60, and 120 Hz substeps", () => {
    const run = (steps: number) => {
      const world = createAegisWorld();
      world.bullets = [
        createEdgeBullet(1, "left", { x: 100, y: 100 }, { x: 900, y: 0 }),
      ];
      world.enemyProjectiles = [
        createEnemyProjectile(
          1,
          { x: 130, y: 100 },
          { x: -300, y: 0 },
        ),
      ];
      const events: GameEvent[] = [];
      for (let index = 0; index < steps; index += 1) {
        resolveAegisCollisionFrame(
          world,
          1 / 30 / steps,
          CANDIDATE_CONFIG,
          events,
        );
      }
      return {
        bullets: world.bullets.length,
        projectiles: world.enemyProjectiles.length,
        intercepts: events.filter(
          (event) => event.type === "ex.aegis.intercepted",
        ).length,
      };
    };

    expect(run(1)).toEqual(run(2));
    expect(run(2)).toEqual(run(4));
  });

  it("fails on the 2049th resolved collision event", () => {
    const world = createAegisWorld();
    world.enemyProjectiles = Array.from(
      { length: MAX_COLLISION_EVENTS_PER_FRAME + 1 },
      (_, index) =>
        createEnemyProjectile(
          index + 1,
          { x: 200, y: 200 },
          { x: 0, y: 0 },
          { lifetime: 0 },
        ),
    );

    expect(() =>
      resolveAegisCollisionFrame(
        world,
        0.05,
        CANDIDATE_CONFIG,
        [],
      ),
    ).toThrow("Aegis collision event budget exceeded");
  });
});

type AegisWorldOptions = {
  evolutionOneId?: "restored-edge" | "broad-intercept";
  evolutionTwoId?: "carry-through" | "guard-momentum";
  masteryUnlocked?: boolean;
};

function createAegisWorld(
  options: AegisWorldOptions = {},
): WorldState {
  const world = createWorld(CANDIDATE_CONFIG);
  world.obstacles = [];
  world.state.weaponType = "spread";
  const protocolId = toExProtocolId("spread.aegis-fan");
  world.progression.exProtocol = {
    status: "selected",
    route: {
      protocolId,
      selectedAt: 0,
      evolutionOneId: options.evolutionOneId
        ? toExProtocolEvolutionId(
            protocolId,
            "evolutionOne",
            options.evolutionOneId,
          )
        : null,
      evolutionOneSelectedAt: options.evolutionOneId ? 0 : null,
      evolutionTwoId: options.evolutionTwoId
        ? toExProtocolEvolutionId(
            protocolId,
            "evolutionTwo",
            options.evolutionTwoId,
          )
        : null,
      evolutionTwoSelectedAt: options.evolutionTwoId ? 0 : null,
      masteryUnlocked: options.masteryUnlocked ?? false,
      masteryUnlockedAt: options.masteryUnlocked ? 0 : null,
    },
    runtime: {
      kind: "aegis-fan",
      protocolId,
      perfectGuardCharges: 0,
      guardMomentumUntil: 0,
    },
  };
  return world;
}

function createEdgeBullet(
  creationOrdinal: number,
  side: "left" | "right",
  position: { x: number; y: number },
  velocity: { x: number; y: number },
  options: { ricochetRemaining?: number; volleyId?: number } = {},
): Bullet {
  return {
    id: `bullet-${creationOrdinal}`,
    volleyId: options.volleyId ?? 1,
    weaponType: "spread",
    position: { ...position },
    velocity: { ...velocity },
    radius: 4,
    lifetime: 1,
    damage: 0.6,
    hitsRemaining: 1,
    ricochetRemaining: options.ricochetRemaining ?? 0,
    ricochetsUsed: 0,
    ricochetSurfaceKind: null,
    ricochetBoundarySide: null,
    hitEnemyIds: [],
    candidate: {
      creationOrdinal,
      hitCapacityAtFire: 1,
      volleyKind: "normal",
      projectileIndex: side === "left" ? 0 : 2,
      projectileCount: 3,
      projectileRole: "edge",
      activationId: null,
      consumedCoreSpreadSweep: false,
      protocolState: {
        kind: "aegis-fan",
        side,
        interceptsRemaining: 1,
        empowered: false,
        baselineWithoutAnyProtocolDamage: 1,
        baselineForEffectAttributionDamage: 0.6,
      },
    },
  };
}

function createEnemyProjectile(
  creationOrdinal: number,
  position: { x: number; y: number },
  velocity: { x: number; y: number },
  options: {
    category?: "standard" | "boss" | "beam" | "hazard";
    interceptible?: boolean;
    lifetime?: number;
  } = {},
): EnemyProjectile {
  return {
    id: `enemy-projectile-${creationOrdinal}`,
    position: { ...position },
    velocity: { ...velocity },
    radius: 4,
    lifetime: options.lifetime ?? 1,
    damage: 7,
    candidate: {
      creationOrdinal,
      category: options.category ?? "standard",
      interceptible: options.interceptible ?? true,
    },
  };
}

function createEnemy(
  creationOrdinal: number,
  position: { x: number; y: number },
): Enemy {
  const definition = CANDIDATE_CONFIG.enemies.chaser;
  return {
    id: `enemy-${creationOrdinal}`,
    typeId: "chaser",
    position: { ...position },
    radius: definition.radius,
    hp: 0.5,
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

function createPermutationWorld(): WorldState {
  const world = createAegisWorld();
  world.bullets = [
    createEdgeBullet(3, "right", { x: 100, y: 100 }, { x: 1_000, y: 0 }),
    createCenterBullet(1, { x: 100, y: 100 }, { x: 1_000, y: 0 }),
    createEdgeBullet(2, "right", { x: 100, y: 100 }, { x: 1_000, y: 0 }),
  ];
  world.enemies = [createEnemy(2, { x: 140, y: 100 })];
  world.enemyProjectiles = [
    createEnemyProjectile(
      2,
      { x: 300, y: 300 },
      { x: 20, y: 0 },
    ),
    createEnemyProjectile(
      1,
      { x: 350, y: 350 },
      { x: 0, y: 20 },
    ),
  ];
  return world;
}

function createCenterBullet(
  creationOrdinal: number,
  position: { x: number; y: number },
  velocity: { x: number; y: number },
): Bullet {
  const bullet = createEdgeBullet(
    creationOrdinal,
    "left",
    position,
    velocity,
  );
  bullet.damage = 1;
  bullet.candidate!.projectileIndex = 1;
  bullet.candidate!.projectileRole = "center";
  bullet.candidate!.protocolState = null;
  return bullet;
}

function getAegisRuntime(world: WorldState) {
  const progression = world.progression.exProtocol;
  if (
    progression?.status !== "selected" ||
    progression.runtime.kind !== "aegis-fan"
  ) {
    throw new Error("Expected Aegis Fan runtime.");
  }
  return progression.runtime;
}

function projectCollisionResult(world: WorldState) {
  return {
    score: world.state.score,
    bullets: world.bullets.map((bullet) => ({
      id: bullet.id,
      position: bullet.position,
      lifetime: bullet.lifetime,
      hitsRemaining: bullet.hitsRemaining,
    })),
    projectiles: world.enemyProjectiles.map((projectile) => ({
      id: projectile.id,
      position: projectile.position,
      lifetime: projectile.lifetime,
    })),
    enemies: world.enemies.map((enemy) => ({
      id: enemy.id,
      hp: enemy.hp,
    })),
  };
}
