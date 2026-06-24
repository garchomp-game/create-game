import type {
  Bullet,
  Enemy,
  EnemyProjectile,
  GameEvent,
  SimulationConfig,
  WorldState,
} from "../../domain/types";
import { circleCircle } from "../../math/geometry";

export function resolveCombat(
  world: WorldState,
  config: SimulationConfig,
  events: GameEvent[],
): void {
  const remainingBullets: Bullet[] = [];
  const deadEnemies = new Set<Enemy>();

  for (const bullet of world.bullets) {
    for (const enemy of world.enemies) {
      if (
        deadEnemies.has(enemy) ||
        bullet.hitEnemyIds.includes(enemy.id) ||
        !circleCircle(bullet, enemy)
      ) {
        continue;
      }

      enemy.hp -= bullet.damage;
      bullet.hitEnemyIds.push(enemy.id);
      bullet.pierceRemaining -= 1;
      events.push({
        type: "enemy.hit",
        enemyId: enemy.id,
        enemyType: enemy.typeId,
        weaponType: bullet.weaponType,
        damage: bullet.damage,
        hpAfter: Math.max(0, enemy.hp),
      });

      if (enemy.hp <= 0) {
        deadEnemies.add(enemy);
        world.state.score += enemy.score;
        events.push({
          type: "enemy.killed",
          enemyId: enemy.id,
          enemyType: enemy.typeId,
          weaponType: bullet.weaponType,
          scoreAwarded: enemy.score,
          xpAwarded: enemy.xpValue,
          position: { ...enemy.position },
        });
      }

      if (bullet.pierceRemaining <= 0) break;
    }
    if (bullet.pierceRemaining > 0) remainingBullets.push(bullet);
  }

  world.bullets = remainingBullets;
  world.enemies = world.enemies.filter((enemy) => !deadEnemies.has(enemy));
  resolveEnemyProjectileHits(world, config, events);

  if (world.state.damageCooldown <= 0) {
    const touchingEnemy = world.enemies.find((enemy) => circleCircle(enemy, world.player));
    if (touchingEnemy) {
      const hpBefore = world.state.hp;
      world.state.hp = Math.max(0, hpBefore - touchingEnemy.damage);
      world.state.damageCooldown = config.player.damageCooldown;
      events.push({
        type: "player.damaged",
        damage: hpBefore - world.state.hp,
        hpAfter: world.state.hp,
      });
    }
  }
}

function resolveEnemyProjectileHits(
  world: WorldState,
  config: SimulationConfig,
  events: GameEvent[],
): void {
  const remainingProjectiles: EnemyProjectile[] = [];

  for (const projectile of world.enemyProjectiles) {
    if (!circleCircle(projectile, world.player)) {
      remainingProjectiles.push(projectile);
      continue;
    }

    if (world.state.damageCooldown > 0) continue;

    const hpBefore = world.state.hp;
    world.state.hp = Math.max(0, hpBefore - projectile.damage);
    world.state.damageCooldown = config.player.damageCooldown;
    events.push({
      type: "player.damaged",
      damage: hpBefore - world.state.hp,
      hpAfter: world.state.hp,
    });
  }

  world.enemyProjectiles = remainingProjectiles;
}
