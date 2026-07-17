import { describe, expect, it } from "vitest";
import { SIMULATION_CONFIG } from "../../config/gameConfig";
import type { Bullet, Enemy, GameEvent, SimulationConfig } from "../../domain/types";
import { createWorld } from "../createWorld";
import { updateBullets } from "./bulletSystem";
import { resolveCombat } from "./combatSystem";

const BOUNDARY_RICOCHET_CONFIG: SimulationConfig = {
  ...SIMULATION_CONFIG,
  features: { ...SIMULATION_CONFIG.features, pulseBoundaryRicochet: true },
};

describe("continuous projectile motion", () => {
  it("hits a Fast enemy crossed by a maximum-speed Pulse during a 50ms frame", () => {
    const world = createWorld(SIMULATION_CONFIG);
    world.obstacles = [];
    world.enemies = [createEnemy("enemy-fast", "fast", 140, 270)];
    world.bullets = [createBullet({ x: 100, y: 270 }, { x: 1_405, y: 0 }, 1)];
    const events: GameEvent[] = [];

    const motions = updateBullets(world, 0.05, SIMULATION_CONFIG);
    resolveCombat(world, SIMULATION_CONFIG, events, motions);

    expect(world.enemies).toHaveLength(0);
    expect(events).toContainEqual(
      expect.objectContaining({ type: "enemy.hit", enemyId: "enemy-fast", ricochetsUsed: 0 }),
    );
  });

  it("resolves piercing hits from nearest to farthest instead of enemy insertion order", () => {
    const world = createWorld(SIMULATION_CONFIG);
    world.obstacles = [];
    world.enemies = [
      createEnemy("enemy-far", "chaser", 190, 270),
      createEnemy("enemy-near", "chaser", 130, 270),
      createEnemy("enemy-middle", "chaser", 160, 270),
    ];
    world.bullets = [createBullet({ x: 100, y: 270 }, { x: 2_000, y: 0 }, 2)];
    const events: GameEvent[] = [];

    const motions = updateBullets(world, 0.05, SIMULATION_CONFIG);
    resolveCombat(world, SIMULATION_CONFIG, events, motions);

    expect(
      events.filter((event) => event.type === "enemy.hit").map((event) => event.enemyId),
    ).toEqual(["enemy-near", "enemy-middle"]);
    expect(world.enemies.map((enemy) => enemy.id)).toEqual(["enemy-far"]);
  });

  it("reflects a capstone Pulse from the arena boundary and hits on the return segment", () => {
    const world = createWorld(BOUNDARY_RICOCHET_CONFIG);
    world.obstacles = [];
    world.enemies = [createEnemy("enemy-return", "chaser", 910, 270)];
    world.bullets = [
      createBullet({ x: 940, y: 270 }, { x: 1_405, y: 0 }, 1, { ricochetRemaining: 1 }),
    ];
    const events: GameEvent[] = [];

    const motions = updateBullets(world, 0.05, BOUNDARY_RICOCHET_CONFIG);
    resolveCombat(world, BOUNDARY_RICOCHET_CONFIG, events, motions);

    expect(world.enemies).toHaveLength(0);
    expect(events).toContainEqual(
      expect.objectContaining({
        type: "bullet.ricocheted",
        surfaceKind: "arenaBoundary",
        boundarySide: "right",
      }),
    );
    expect(events).toContainEqual(
      expect.objectContaining({
        type: "enemy.hit",
        enemyId: "enemy-return",
        ricochetsUsed: 1,
        ricochetSurfaceKind: "arenaBoundary",
        ricochetBoundarySide: "right",
      }),
    );
  });

  it("uses piercing capacity across outgoing and reflected paths in one frame", () => {
    const world = createWorld(BOUNDARY_RICOCHET_CONFIG);
    world.obstacles = [];
    world.enemies = [
      createEnemy("enemy-outgoing", "fast", 940, 245),
      createEnemy("enemy-return", "fast", 940, 277),
    ];
    world.bullets = [
      createBullet(
        { x: 925, y: 230 },
        { x: 993, y: 993 },
        2,
        { ricochetRemaining: 1 },
      ),
    ];
    const events: GameEvent[] = [];

    const motions = updateBullets(world, 0.05, BOUNDARY_RICOCHET_CONFIG);
    resolveCombat(world, BOUNDARY_RICOCHET_CONFIG, events, motions);

    expect(world.enemies).toHaveLength(0);
    expect(
      events
        .filter((event) => event.type === "enemy.hit")
        .map((event) => ({ enemyId: event.enemyId, ricochetsUsed: event.ricochetsUsed })),
    ).toEqual([
      { enemyId: "enemy-outgoing", ricochetsUsed: 0 },
      { enemyId: "enemy-return", ricochetsUsed: 1 },
    ]);
    expect(events.some((event) => event.type === "bullet.ricocheted")).toBe(true);
  });

  it("does not tunnel through an obstacle at maximum Pulse speed", () => {
    const world = createWorld(SIMULATION_CONFIG);
    world.obstacles = [{ id: "wall", x: 140, y: 220, width: 20, height: 100 }];
    world.bullets = [
      createBullet(
        { x: 100, y: 270 },
        { x: 1_405, y: 0 },
        1,
        { ricochetRemaining: 1 },
      ),
    ];
    const events: GameEvent[] = [];

    const motions = updateBullets(world, 0.05, SIMULATION_CONFIG);
    resolveCombat(world, SIMULATION_CONFIG, events, motions);

    expect(world.bullets).toHaveLength(1);
    expect(world.bullets[0]?.velocity.x).toBeLessThan(0);
    expect(events).toContainEqual(
      expect.objectContaining({
        type: "bullet.ricocheted",
        surfaceKind: "obstacle",
        obstacleId: "wall",
      }),
    );
  });

  it("keeps obstacle attribution when a reflected shot hits on a later frame", () => {
    const world = createWorld(SIMULATION_CONFIG);
    world.obstacles = [{ id: "wall", x: 140, y: 220, width: 20, height: 100 }];
    world.bullets = [
      createBullet(
        { x: 120, y: 270 },
        { x: 400, y: 0 },
        1,
        { ricochetRemaining: 1 },
      ),
    ];
    const firstEvents: GameEvent[] = [];

    const firstMotions = updateBullets(world, 0.05, SIMULATION_CONFIG);
    resolveCombat(world, SIMULATION_CONFIG, firstEvents, firstMotions);
    world.enemies = [createEnemy("enemy-later", "chaser", 100, 270)];
    const secondEvents: GameEvent[] = [];
    const secondMotions = updateBullets(world, 0.05, SIMULATION_CONFIG);
    resolveCombat(world, SIMULATION_CONFIG, secondEvents, secondMotions);

    expect(secondEvents).toContainEqual(
      expect.objectContaining({
        type: "enemy.hit",
        enemyId: "enemy-later",
        ricochetSurfaceKind: "obstacle",
        ricochetBoundarySide: null,
      }),
    );
  });

  it("uses the rounded swept-circle corner instead of a square expanded corner", () => {
    const obstacle = { id: "corner", x: 140, y: 220, width: 20, height: 100 };
    const world = createWorld(SIMULATION_CONFIG);
    world.obstacles = [obstacle];
    world.bullets = [
      createBullet(
        { x: 100, y: 217 },
        { x: 1_405, y: 0 },
        1,
        { ricochetRemaining: 1 },
      ),
    ];
    const events: GameEvent[] = [];

    const motions = updateBullets(world, 0.05, SIMULATION_CONFIG);
    resolveCombat(world, SIMULATION_CONFIG, events, motions);

    const ricochet = events.find((event) => event.type === "bullet.ricocheted");
    expect(ricochet?.type).toBe("bullet.ricocheted");
    if (ricochet?.type !== "bullet.ricocheted") return;
    expect(ricochet.position.x).toBeCloseTo(140 - Math.sqrt(7), 4);
    expect(ricochet.position.y).toBe(217);
    expect(world.bullets[0]?.velocity.y).toBeLessThan(0);

    const missWorld = createWorld(SIMULATION_CONFIG);
    missWorld.obstacles = [obstacle];
    missWorld.bullets = [
      createBullet(
        { x: 100, y: 215 },
        { x: 1_405, y: 0 },
        1,
        { ricochetRemaining: 1 },
      ),
    ];
    const missEvents: GameEvent[] = [];
    const missMotions = updateBullets(missWorld, 0.05, SIMULATION_CONFIG);
    resolveCombat(missWorld, SIMULATION_CONFIG, missEvents, missMotions);

    expect(missWorld.bullets).toHaveLength(1);
    expect(missEvents.some((event) => event.type === "bullet.ricocheted")).toBe(false);
  });

  it("removes Pulse shots at the boundary when the capstone is unavailable", () => {
    const world = createWorld(SIMULATION_CONFIG);
    world.obstacles = [];
    world.bullets = [createBullet({ x: 940, y: 270 }, { x: 1_405, y: 0 }, 1)];
    const events: GameEvent[] = [];

    const motions = updateBullets(world, 0.05, SIMULATION_CONFIG);
    resolveCombat(world, SIMULATION_CONFIG, events, motions);

    expect(world.bullets).toHaveLength(0);
    expect(events.some((event) => event.type === "bullet.ricocheted")).toBe(false);
  });

  it("does not resolve a stationary hit after the projectile lifetime has expired", () => {
    const world = createWorld(SIMULATION_CONFIG);
    world.obstacles = [];
    world.enemies = [createEnemy("enemy-overlap", "chaser", 100, 270)];
    world.bullets = [
      createBullet(
        { x: 100, y: 270 },
        { x: 1_405, y: 0 },
        1,
        { lifetime: 0 },
      ),
    ];
    const events: GameEvent[] = [];

    const motions = updateBullets(world, 0.05, SIMULATION_CONFIG);
    resolveCombat(world, SIMULATION_CONFIG, events, motions);

    expect(world.bullets).toHaveLength(0);
    expect(world.enemies).toHaveLength(1);
    expect(events.some((event) => event.type === "enemy.hit")).toBe(false);
  });

  it("keeps the boundary feature independently reversible", () => {
    const config: SimulationConfig = {
      ...BOUNDARY_RICOCHET_CONFIG,
      features: { ...BOUNDARY_RICOCHET_CONFIG.features, pulseBoundaryRicochet: false },
    };
    const world = createWorld(config);
    world.obstacles = [];
    world.bullets = [
      createBullet({ x: 940, y: 270 }, { x: 1_405, y: 0 }, 1, { ricochetRemaining: 1 }),
    ];
    const events: GameEvent[] = [];

    const motions = updateBullets(world, 0.05, config);
    resolveCombat(world, config, events, motions);

    expect(world.bullets).toHaveLength(0);
    expect(events.some((event) => event.type === "bullet.ricocheted")).toBe(false);
  });

  it("does not turn the Pulse boundary field into a Spread ricochet", () => {
    const world = createWorld(BOUNDARY_RICOCHET_CONFIG);
    world.obstacles = [];
    world.bullets = [
      createBullet(
        { x: 940, y: 270 },
        { x: 1_405, y: 0 },
        1,
        {
          weaponType: "spread",
          radius: SIMULATION_CONFIG.weapons.spread.radius,
          ricochetRemaining: 1,
        },
      ),
    ];
    const events: GameEvent[] = [];

    const motions = updateBullets(world, 0.05, BOUNDARY_RICOCHET_CONFIG);
    resolveCombat(world, BOUNDARY_RICOCHET_CONFIG, events, motions);

    expect(world.bullets).toHaveLength(0);
    expect(events.some((event) => event.type === "bullet.ricocheted")).toBe(false);
  });
});

function createEnemy(
  id: string,
  typeId: "chaser" | "fast",
  x: number,
  y: number,
): Enemy {
  const definition = SIMULATION_CONFIG.enemies[typeId];
  return {
    id,
    typeId,
    position: { x, y },
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

function createBullet(
  position: { x: number; y: number },
  velocity: { x: number; y: number },
  hitsRemaining: number,
  overrides: Partial<Bullet> = {},
): Bullet {
  const definition = SIMULATION_CONFIG.weapons.pulse;
  return {
    id: "bullet-test",
    volleyId: 1,
    weaponType: "pulse",
    position: { ...position },
    radius: definition.radius,
    velocity: { ...velocity },
    lifetime: definition.lifetime,
    damage: definition.damage,
    hitsRemaining,
    ricochetRemaining: 0,
    ricochetsUsed: 0,
    ricochetSurfaceKind: null,
    ricochetBoundarySide: null,
    hitEnemyIds: [],
    ...overrides,
  };
}
