import { describe, expect, it } from "vitest";
import { SIMULATION_CONFIG } from "../../config/gameConfig";
import type { Bullet, Enemy, GameEvent, WeaponTypeId } from "../../domain/types";
import { createWorld } from "../createWorld";
import { resolveCombat } from "./combatSystem";
import { updateShooting } from "./shootingSystem";
import { updateRunStats } from "./statsSystem";

describe("weapon identity mechanics", () => {
  it("builds Pulse focus on direct repeat hits and resets after the focus window", () => {
    const world = createWorld(SIMULATION_CONFIG);
    world.runtime.pulseFocusBonusPerStack = 0.2;
    world.runtime.pulseLineBonusPerStack = 0.2;
    world.runtime.pulseFocusMaxStacks = 2;
    world.runtime.pulseFocusDuration = 0.9;
    world.enemies = [createEnemy("target", "brute", 100, 100, 100)];

    const damages = [
      hitTarget(world, createBullet("pulse-1", 1, "pulse", 100, 100)),
      hitTarget(world, createBullet("pulse-2", 2, "pulse", 100, 100)),
      hitTarget(world, createBullet("pulse-3", 3, "pulse", 100, 100)),
    ];

    world.state.elapsed = 1;
    damages.push(hitTarget(world, createBullet("pulse-4", 4, "pulse", 100, 100)));
    const bounced = createBullet("pulse-bounced", 5, "pulse", 100, 100);
    bounced.ricochetsUsed = 1;
    damages.push(hitTarget(world, bounced));

    expect(damages).toHaveLength(5);
    [1, 1.2, 1.4, 1, 1].forEach((expected, index) => {
      expect(damages[index]).toBeCloseTo(expected);
    });
    expect(world.enemies[0]).toMatchObject({ pulseFocusStacks: 1, pulseFocusExpiresAt: 1.9 });
    expect(world.stats.weaponIdentityMetrics.pulseFocus).toMatchObject({
      enhancedHits: 2,
      targetEnhancedHits: 2,
      lineEnhancedHits: 0,
      lineBonusDamage: 0,
      maxStacks: 2,
    });
    expect(world.stats.weaponIdentityMetrics.pulseFocus.bonusDamage).toBeCloseTo(0.6);
    expect(world.stats.weaponIdentityMetrics.pulseFocus.targetBonusDamage).toBeCloseTo(0.6);
  });

  it("amplifies direct Pulse damage as one shot pierces a line of enemies", () => {
    const world = createWorld(SIMULATION_CONFIG);
    world.runtime.pulseFocusBonusPerStack = 0.2;
    world.runtime.pulseLineBonusPerStack = 0.2;
    world.runtime.pulseFocusMaxStacks = 4;
    world.runtime.pulseFocusDuration = 0.9;
    world.enemies = [
      createEnemy("line-a", "chaser", 100, 100, 100),
      createEnemy("line-b", "chaser", 100, 100, 100),
      createEnemy("line-c", "chaser", 100, 100, 100),
    ];
    const bullet = createBullet("pulse-line", 1, "pulse", 100, 100);
    bullet.hitsRemaining = 3;
    world.bullets = [bullet];
    const events: GameEvent[] = [];

    resolveCombat(world, SIMULATION_CONFIG, events);
    updateRunStats(world, events);

    const hits = events.filter(
      (event): event is Extract<GameEvent, { type: "enemy.hit" }> =>
        event.type === "enemy.hit",
    );
    expect(hits).toHaveLength(3);
    [1, 1.2, 1.4].forEach((expected, index) => {
      expect(hits[index]?.damage).toBeCloseTo(expected);
    });
    const focusHits = events.filter(
      (event): event is Extract<GameEvent, { type: "pulse.focus.hit" }> =>
        event.type === "pulse.focus.hit",
    );
    expect(focusHits.map((event) => event.lineStacks)).toEqual([0, 1, 2]);
    expect(focusHits.map((event) => event.stackBefore)).toEqual([0, 0, 0]);
    expect(world.stats.weaponIdentityMetrics.pulseFocus).toMatchObject({
      enhancedHits: 2,
      targetEnhancedHits: 0,
      lineEnhancedHits: 2,
      targetBonusDamage: 0,
      maxStacks: 1,
    });
    expect(world.stats.weaponIdentityMetrics.pulseFocus.bonusDamage).toBeCloseTo(0.6);
    expect(world.stats.weaponIdentityMetrics.pulseFocus.lineBonusDamage).toBeCloseTo(0.6);
  });

  it("charges Spread sweep on three distinct targets and accelerates only the next volley", () => {
    const world = createWorld(SIMULATION_CONFIG);
    world.state.weaponType = "spread";
    world.state.shotTimer = 0.5;
    world.runtime.spreadSweepDistinctTargets = 3;
    world.runtime.spreadSweepNextIntervalMultiplier = 0.7;
    world.enemies = [
      createEnemy("enemy-a", "chaser", 100, 100),
      createEnemy("enemy-b", "fast", 200, 100),
      createEnemy("enemy-c", "ranged", 300, 100),
    ];
    world.bullets = [
      createBullet("spread-a", 1, "spread", 100, 100),
      createBullet("spread-b", 1, "spread", 200, 100),
      createBullet("spread-c", 1, "spread", 300, 100),
    ];
    const hitEvents: GameEvent[] = [];

    resolveCombat(world, SIMULATION_CONFIG, hitEvents);
    updateRunStats(world, hitEvents);

    expect(hitEvents.filter((event) => event.type === "spread.sweep.triggered")).toHaveLength(1);
    expect(world.weaponIdentity.spreadSweepCharge).toBe(true);
    expect(world.state.shotTimer).toBeCloseTo(0.35);
    expect(world.stats.weaponIdentityMetrics.spreadSweep).toMatchObject({
      triggers: 1,
      maxDistinctTargets: 3,
    });

    world.state.shotTimer = 0;
    const shotEvents: GameEvent[] = [];
    updateShooting(world, true, SIMULATION_CONFIG, shotEvents);
    updateRunStats(world, shotEvents);

    expect(world.weaponIdentity.spreadSweepCharge).toBe(false);
    expect(world.state.shotTimer).toBeCloseTo(SIMULATION_CONFIG.weapons.spread.interval);
    expect(shotEvents).toContainEqual(
      expect.objectContaining({ type: "spread.sweep.consumed" }),
    );
    expect(world.stats.weaponIdentityMetrics.spreadSweep.consumes).toBe(1);
  });

  it("retains distinct targets when a Spread volley lands across multiple frames", () => {
    const world = createWorld(SIMULATION_CONFIG);
    world.state.weaponType = "spread";
    world.state.shotTimer = 0.5;
    world.runtime.spreadSweepDistinctTargets = 3;
    world.runtime.spreadSweepNextIntervalMultiplier = 0.7;
    world.enemies = [
      createEnemy("enemy-a", "chaser", 100, 100),
      createEnemy("enemy-b", "fast", 200, 100),
      createEnemy("enemy-c", "ranged", 300, 100),
    ];
    world.bullets = [
      createBullet("spread-a", 7, "spread", 100, 100),
      createBullet("spread-b", 7, "spread", 500, 100),
      createBullet("spread-c", 7, "spread", 600, 100),
    ];
    const firstFrameEvents: GameEvent[] = [
      {
        type: "shot.fired",
        volleyId: 7,
        bulletIds: ["spread-a", "spread-b", "spread-c"],
        weaponType: "spread",
        position: { x: 100, y: 100 },
        direction: { x: 1, y: 0 },
        projectileCount: 3,
      },
    ];

    resolveCombat(world, SIMULATION_CONFIG, firstFrameEvents);
    updateRunStats(world, firstFrameEvents);
    expect(world.analytics.activeVolleys[7]?.spreadSweepEnemyIds).toEqual(["enemy-a"]);

    world.bullets[0]!.position = { x: 200, y: 100 };
    world.bullets[1]!.position = { x: 300, y: 100 };
    const secondFrameEvents: GameEvent[] = [];
    resolveCombat(world, SIMULATION_CONFIG, secondFrameEvents);
    updateRunStats(world, secondFrameEvents);

    expect(secondFrameEvents.filter((event) => event.type === "spread.sweep.triggered")).toHaveLength(
      1,
    );
    expect(world.weaponIdentity.spreadSweepCharge).toBe(true);
    expect(world.state.shotTimer).toBeCloseTo(0.35);
  });
});

function hitTarget(world: ReturnType<typeof createWorld>, bullet: Bullet): number {
  world.bullets = [bullet];
  const events: GameEvent[] = [];
  resolveCombat(world, SIMULATION_CONFIG, events);
  updateRunStats(world, events);
  const hit = events.find(
    (event): event is Extract<GameEvent, { type: "enemy.hit" }> => event.type === "enemy.hit",
  );
  if (!hit) throw new Error("Expected the test bullet to hit its target.");
  return hit.damage;
}

function createEnemy(
  id: string,
  typeId: Enemy["typeId"],
  x: number,
  y: number,
  hp = 10,
): Enemy {
  const definition = SIMULATION_CONFIG.enemies[typeId];
  return {
    id,
    typeId,
    position: { x, y },
    radius: definition.radius,
    hp,
    damage: definition.damage,
    speed: definition.speed,
    score: definition.score,
    xpValue: definition.xpValue,
    behavior: definition.behavior,
    attackTimer: 1,
    enteredArena: true,
  };
}

function createBullet(
  id: string,
  volleyId: number,
  weaponType: WeaponTypeId,
  x: number,
  y: number,
): Bullet {
  return {
    id,
    volleyId,
    weaponType,
    position: { x, y },
    radius: 4,
    velocity: { x: 0, y: 0 },
    lifetime: 1,
    damage: 1,
    hitsRemaining: 1,
    ricochetRemaining: 0,
    ricochetsUsed: 0,
    ricochetSurfaceKind: null,
    ricochetBoundarySide: null,
    hitEnemyIds: [],
  };
}
