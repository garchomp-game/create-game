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

export function updateEnemies(
  world: WorldState,
  dt: number,
  config: SimulationConfig,
  events: GameEvent[],
): void {
  for (const enemy of world.enemies) {
    const directionToPlayer = getDirectionToPlayer(world, enemy);
    const movement = getEnemyMovement(enemy, directionToPlayer, world, config);
    moveCircleWithObstacles(world, enemy, movement.x * enemy.speed * dt, 0);
    moveCircleWithObstacles(world, enemy, 0, movement.y * enemy.speed * dt);
    updateRangedAttack(world, enemy, directionToPlayer, dt, config, events);

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
): Vec2 {
  if (enemy.behavior !== "ranged") return directionToPlayer;

  const ranged = config.enemies[enemy.typeId].ranged;
  if (!ranged) return directionToPlayer;

  const distanceToPlayer = Math.hypot(
    world.player.position.x - enemy.position.x,
    world.player.position.y - enemy.position.y,
  );
  if (distanceToPlayer > ranged.preferredRange) return directionToPlayer;
  if (distanceToPlayer < ranged.preferredRange * 0.65) {
    return { x: -directionToPlayer.x, y: -directionToPlayer.y };
  }
  return { x: 0, y: 0 };
}

function updateRangedAttack(
  world: WorldState,
  enemy: Enemy,
  directionToPlayer: Vec2,
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
  if (enemy.attackTimer > 0 || distanceToPlayer > ranged.preferredRange * 1.2) return;

  enemy.attackTimer += ranged.attackInterval / threat.attackSpeed;
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
