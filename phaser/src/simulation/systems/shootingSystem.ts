import type {
  Bullet,
  GameEvent,
  ProjectileRole,
  SimulationConfig,
  Vec2,
  WorldState,
} from "../../domain/types";
import { createRedlineProjectileState } from "../protocols/redlineCore";

export function updateShooting(
  world: WorldState,
  shootHeld: boolean,
  config: SimulationConfig,
  events: GameEvent[],
): void {
  if (!shootHeld || world.state.shotTimer > 0) return;

  const weapon = config.weapons[world.state.weaponType];
  const aim = world.state.lastAim;
  const projectileCount = weapon.projectileCount + world.runtime.projectileCountBonus;
  const hitCapacity = weapon.hitCapacity + world.runtime.hitCapacityBonus;
  const directions = getProjectileDirections(aim, projectileCount, weapon.spreadAngle);
  const volleyId = world.nextVolleyId++;
  const consumesSpreadSweep =
    world.state.weaponType === "spread" &&
    world.runtime.spreadSweepDistinctTargets > 0 &&
    world.weaponIdentity.spreadSweepCharge;
  if (consumesSpreadSweep) world.weaponIdentity.spreadSweepCharge = false;
  world.analytics.activeVolleys[volleyId] = {
    weaponType: world.state.weaponType,
    enemyIds: [],
    postRicochetEnemyIds: [],
    spreadSweepEnemyIds: [],
    spreadSweepTriggered: false,
  };
  const bulletIds: string[] = [];
  for (const [projectileIndex, direction] of directions.entries()) {
    const offset = config.player.radius + weapon.radius + 2;
    const creationOrdinal = world.nextBulletId++;
    const bullet: Bullet = {
      id: `bullet-${creationOrdinal}`,
      volleyId,
      weaponType: world.state.weaponType,
      position: {
        x: world.player.position.x + direction.x * offset,
        y: world.player.position.y + direction.y * offset,
      },
      velocity: {
        x: direction.x * weapon.speed * world.runtime.projectileSpeedMultiplier,
        y: direction.y * weapon.speed * world.runtime.projectileSpeedMultiplier,
      },
      radius: weapon.radius,
      lifetime: weapon.lifetime,
      damage: weapon.damage * world.runtime.projectileDamageMultiplier,
      hitsRemaining: hitCapacity,
      ricochetRemaining: weapon.ricochetCount + world.runtime.ricochetBonus,
      ricochetsUsed: 0,
      ricochetSurfaceKind: null,
      ricochetBoundarySide: null,
      hitEnemyIds: [],
      ...(config.features.exProtocols
        ? {
            candidate: {
              creationOrdinal,
              hitCapacityAtFire: hitCapacity,
              volleyKind: "normal" as const,
              projectileIndex,
              projectileCount: directions.length,
              projectileRole: getProjectileRole(
                projectileIndex,
                directions.length,
              ),
              activationId: null,
              consumedCoreSpreadSweep: consumesSpreadSweep,
              protocolState: createRedlineProjectileState(world),
            },
          }
        : {}),
    };
    world.bullets.push(bullet);
    bulletIds.push(bullet.id);
  }
  world.state.shotTimer = Math.max(
    0.04,
    weapon.interval * world.runtime.fireIntervalMultiplier,
  );
  events.push({
    type: "shot.fired",
    volleyId,
    bulletIds,
    weaponType: world.state.weaponType,
    position: { ...world.bullets[world.bullets.length - directions.length]!.position },
    direction: { ...aim },
    projectileCount: bulletIds.length,
  });
  if (consumesSpreadSweep) {
    events.push({ type: "spread.sweep.consumed", volleyId });
  }
}

export function getProjectileRole(
  projectileIndex: number,
  projectileCount: number,
): ProjectileRole {
  if (projectileCount <= 1) return "center";
  if (projectileIndex === 0 || projectileIndex === projectileCount - 1) {
    return "edge";
  }
  if (
    projectileCount % 2 === 1 &&
    projectileIndex === Math.floor(projectileCount / 2)
  ) {
    return "center";
  }
  return "inner";
}

export function getProjectileDirections(
  aim: Vec2,
  projectileCount: number,
  spreadAngle: number,
): Vec2[] {
  if (projectileCount === 1) return [aim];

  const startAngle = -spreadAngle / 2;
  const step = spreadAngle / (projectileCount - 1);
  return Array.from({ length: projectileCount }, (_, index) => rotate(aim, startAngle + step * index));
}

function rotate(vector: Vec2, angle: number): Vec2 {
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  return {
    x: vector.x * cos - vector.y * sin,
    y: vector.x * sin + vector.y * cos,
  };
}
