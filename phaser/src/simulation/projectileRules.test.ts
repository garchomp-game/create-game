import { describe, expect, it } from "vitest";
import { SIMULATION_CONFIG } from "../config/gameConfig";
import type { Bullet, Enemy, GameEvent } from "../domain/types";
import { createWorld } from "./createWorld";
import { resolveCombat } from "./systems/combatSystem";
import { getProjectileDirections } from "./systems/shootingSystem";

describe("projectile rules", () => {
  it("keeps even split shots symmetric and leaves the aim center open", () => {
    const [single] = getProjectileDirections({ x: 1, y: 0 }, 1, 0.12);
    const [upper, lower] = getProjectileDirections({ x: 1, y: 0 }, 2, 0.12);
    const three = getProjectileDirections({ x: 1, y: 0 }, 3, 0.12);

    expect(single).toEqual({ x: 1, y: 0 });
    expect(upper!.x).toBeCloseTo(lower!.x);
    expect(upper!.y).toBeCloseTo(-lower!.y);
    expect(Math.abs(upper!.y)).toBeGreaterThan(0);
    expect(three[1]).toEqual({ x: 1, y: 0 });
  });

  it.each([1, 2, 3])("uses hit capacity %i as the total number of distinct enemy hits", (capacity) => {
    const world = createWorld(SIMULATION_CONFIG);
    world.enemies = [1, 2, 3].map((index) => createEnemy(`enemy-${index}`));
    world.bullets = [createBullet(capacity)];
    const events: GameEvent[] = [];

    resolveCombat(world, SIMULATION_CONFIG, events);

    expect(events.filter((event) => event.type === "enemy.hit")).toHaveLength(capacity);
    expect(world.enemies).toHaveLength(3 - capacity);
    expect(world.bullets).toHaveLength(0);
  });
});

function createEnemy(id: string): Enemy {
  const definition = SIMULATION_CONFIG.enemies.chaser;
  return {
    id,
    typeId: "chaser",
    position: { x: 540, y: 270 },
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

function createBullet(hitsRemaining: number): Bullet {
  const definition = SIMULATION_CONFIG.weapons.pulse;
  return {
    id: "bullet-test",
    volleyId: 1,
    weaponType: "pulse",
    position: { x: 540, y: 270 },
    radius: definition.radius,
    velocity: { x: 0, y: 0 },
    lifetime: definition.lifetime,
    damage: definition.damage,
    hitsRemaining,
    ricochetRemaining: 0,
    ricochetsUsed: 0,
    ricochetSurfaceKind: null,
    ricochetBoundarySide: null,
    hitEnemyIds: [],
  };
}
