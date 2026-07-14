import type {
  Enemy,
  EnemyProjectile,
  GameEvent,
  SimulationConfig,
  Vec2,
  WorldState,
} from "../../domain/types";
import { clamp } from "../../math/geometry";
import { normalize } from "../../math/vector";
import { moveCircleWithObstacles } from "./movement";
import { getThreatMultipliers } from "../threatDirector";
import {
  getEnemyApproachNavigation,
  hasClearNavigationPath,
  type EnemyNavigationMode,
} from "../navigationField";

type EnemyMovement = {
  direction: Vec2;
  navigationMode: EnemyNavigationMode;
  fieldBuilt: boolean;
  hasLineOfSight?: boolean;
};

export function updateEnemies(
  world: WorldState,
  dt: number,
  config: SimulationConfig,
  events: GameEvent[],
): void {
  for (const enemy of world.enemies) {
    const directionToPlayer = getDirectionToPlayer(world, enemy);
    const movement = getEnemyMovement(enemy, directionToPlayer, world, config);
    world.stats.navigationMetrics[`${movement.navigationMode}Frames`] += 1;
    if (movement.fieldBuilt) world.stats.navigationMetrics.fieldBuilds += 1;
    moveCircleWithObstacles(world, enemy, movement.direction.x * enemy.speed * dt, 0);
    moveCircleWithObstacles(world, enemy, 0, movement.direction.y * enemy.speed * dt);
    updateRangedAttack(
      world,
      enemy,
      directionToPlayer,
      movement.hasLineOfSight,
      dt,
      config,
      events,
    );

    if (
      enemy.position.x >= enemy.radius &&
      enemy.position.x <= config.arena.width - enemy.radius &&
      enemy.position.y >= enemy.radius &&
      enemy.position.y <= config.arena.height - enemy.radius
    ) {
      enemy.enteredArena = true;
    }

    if (enemy.enteredArena) {
      enemy.position.x = clamp(enemy.position.x, enemy.radius, config.arena.width - enemy.radius);
      enemy.position.y = clamp(enemy.position.y, enemy.radius, config.arena.height - enemy.radius);
    }
  }
}

function getDirectionToPlayer(world: WorldState, enemy: Enemy): Vec2 {
  const dx = world.player.position.x - enemy.position.x;
  const dy = world.player.position.y - enemy.position.y;
  if (dx === 0 && dy === 0) return { x: 1, y: 0 };
  return normalize(dx, dy);
}

function getEnemyMovement(
  enemy: Enemy,
  directionToPlayer: Vec2,
  world: WorldState,
  config: SimulationConfig,
): EnemyMovement {
  if (enemy.behavior !== "ranged") {
    const navigation = getEnemyApproachNavigation(
      world,
      enemy,
      config,
    );
    return {
      direction: navigation.direction,
      navigationMode: navigation.mode,
      fieldBuilt: navigation.fieldBuilt,
    };
  }

  const ranged = config.enemies[enemy.typeId].ranged;
  if (!ranged) {
    return { direction: directionToPlayer, navigationMode: "fallback", fieldBuilt: false };
  }

  const distanceToPlayer = Math.hypot(
    world.player.position.x - enemy.position.x,
    world.player.position.y - enemy.position.y,
  );
  const hasLineOfSight = hasClearNavigationPath(
    enemy.position,
    world.player.position,
    ranged.projectileRadius,
    world.obstacles,
  );
  if (distanceToPlayer > ranged.preferredRange || !hasLineOfSight) {
    const navigation = getEnemyApproachNavigation(
      world,
      enemy,
      config,
    );
    return {
      direction: navigation.direction,
      navigationMode: navigation.mode,
      fieldBuilt: navigation.fieldBuilt,
      hasLineOfSight,
    };
  }
  if (distanceToPlayer < ranged.preferredRange * 0.65) {
    return {
      direction: { x: -directionToPlayer.x, y: -directionToPlayer.y },
      navigationMode: "direct",
      fieldBuilt: false,
      hasLineOfSight,
    };
  }
  return {
    direction: { x: 0, y: 0 },
    navigationMode: "direct",
    fieldBuilt: false,
    hasLineOfSight,
  };
}

function updateRangedAttack(
  world: WorldState,
  enemy: Enemy,
  directionToPlayer: Vec2,
  hasLineOfSight: boolean | undefined,
  dt: number,
  config: SimulationConfig,
  events: GameEvent[],
): void {
  if (enemy.behavior !== "ranged") return;

  const ranged = config.enemies[enemy.typeId].ranged;
  if (!ranged) return;
  const threat = getThreatMultipliers(config, world.state.elapsed);

  const distanceToPlayer = Math.hypot(
    world.player.position.x - enemy.position.x,
    world.player.position.y - enemy.position.y,
  );
  enemy.attackTimer -= dt;
  if (
    enemy.attackTimer > 0 ||
    distanceToPlayer > ranged.preferredRange * 1.2 ||
    hasLineOfSight === false
  ) return;

  enemy.attackTimer += ranged.attackInterval / threat.attackSpeed;
  if (world.enemyProjectiles.length >= config.threat.maximumEnemyProjectiles) return;
  const offset = enemy.radius + ranged.projectileRadius + 2;
  const projectile: EnemyProjectile = {
    id: `enemy-projectile-${world.nextEnemyProjectileId++}`,
    position: {
      x: enemy.position.x + directionToPlayer.x * offset,
      y: enemy.position.y + directionToPlayer.y * offset,
    },
    velocity: {
      x: directionToPlayer.x * ranged.projectileSpeed * threat.projectileSpeed,
      y: directionToPlayer.y * ranged.projectileSpeed * threat.projectileSpeed,
    },
    radius: ranged.projectileRadius,
    lifetime: ranged.projectileLifetime,
    damage: Math.ceil(ranged.projectileDamage * threat.damage),
  };
  world.enemyProjectiles.push(projectile);
  events.push({
    type: "enemy.projectile.fired",
    projectileId: projectile.id,
    enemyId: enemy.id,
    enemyType: enemy.typeId,
    position: { ...projectile.position },
    direction: { ...directionToPlayer },
  });
}
