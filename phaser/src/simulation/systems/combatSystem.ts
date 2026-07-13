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

      const focusHit = applyPulseFocus(world, bullet, enemy);
      const damage = bullet.damage + focusHit.bonusDamage;
      enemy.hp -= damage;
      bullet.hitEnemyIds.push(enemy.id);
      bullet.hitsRemaining -= 1;
      registerSpreadSweepHit(world, bullet, enemy, events);
      events.push({
        type: "enemy.hit",
        bulletId: bullet.id,
        volleyId: bullet.volleyId,
        enemyId: enemy.id,
        enemyType: enemy.typeId,
        weaponType: bullet.weaponType,
        ricochetsUsed: bullet.ricochetsUsed,
        damage,
        hpAfter: Math.max(0, enemy.hp),
      });

      if (focusHit.applied) {
        events.push({
          type: "pulse.focus.hit",
          enemyId: enemy.id,
          enemyType: enemy.typeId,
          stackBefore: focusHit.stackBefore,
          stackAfter: focusHit.stackAfter,
          bonusDamage: focusHit.bonusDamage,
          killed: enemy.hp <= 0,
        });
      }

      if (enemy.hp <= 0) {
        deadEnemies.add(enemy);
        const scoreAwarded = Math.round(
          enemy.score * world.encounter.contract.scoreMultiplier,
        );
        world.state.score += scoreAwarded;
        events.push({
          type: "enemy.killed",
          bulletId: bullet.id,
          volleyId: bullet.volleyId,
          enemyId: enemy.id,
          enemyType: enemy.typeId,
          weaponType: bullet.weaponType,
          scoreAwarded,
          xpAwarded: enemy.xpValue,
          position: { ...enemy.position },
        });
      }

      if (bullet.hitsRemaining <= 0) break;
    }
    if (bullet.hitsRemaining > 0) remainingBullets.push(bullet);
  }

  world.bullets = remainingBullets;
  world.enemies = world.enemies.filter((enemy) => !deadEnemies.has(enemy));
  resolveEnemyProjectileHits(world, config, events);

  if (world.state.damageCooldown <= 0) {
    const touchingEnemy = world.enemies.find((enemy) => circleCircle(enemy, world.player));
    if (touchingEnemy) {
      const hpBefore = world.state.hp;
      world.state.hp = Math.max(0, hpBefore - touchingEnemy.damage);
      const damage = hpBefore - world.state.hp;
      if (damage > 0) {
        world.state.damageCooldown = config.player.damageCooldown;
        events.push({
          type: "player.damaged",
          damage,
          hpAfter: world.state.hp,
          source: {
            kind: "contact",
            enemyId: touchingEnemy.id,
            enemyType: touchingEnemy.typeId,
          },
        });
      }
    }
  }
}

function applyPulseFocus(
  world: WorldState,
  bullet: Bullet,
  enemy: Enemy,
): {
  applied: boolean;
  stackBefore: number;
  stackAfter: number;
  bonusDamage: number;
} {
  if (
    bullet.weaponType !== "pulse" ||
    bullet.ricochetsUsed > 0 ||
    world.runtime.pulseFocusMaxStacks <= 0
  ) {
    return { applied: false, stackBefore: 0, stackAfter: 0, bonusDamage: 0 };
  }

  const active = (enemy.pulseFocusExpiresAt ?? 0) >= world.state.elapsed;
  const stackBefore = active
    ? Math.min(world.runtime.pulseFocusMaxStacks, enemy.pulseFocusStacks ?? 0)
    : 0;
  const stackAfter = Math.min(world.runtime.pulseFocusMaxStacks, stackBefore + 1);
  const bonusDamage = bullet.damage * world.runtime.pulseFocusBonusPerStack * stackBefore;
  enemy.pulseFocusStacks = stackAfter;
  enemy.pulseFocusExpiresAt = world.state.elapsed + world.runtime.pulseFocusDuration;
  return { applied: true, stackBefore, stackAfter, bonusDamage };
}

function registerSpreadSweepHit(
  world: WorldState,
  bullet: Bullet,
  enemy: Enemy,
  events: GameEvent[],
): void {
  if (
    bullet.weaponType !== "spread" ||
    world.runtime.spreadSweepDistinctTargets <= 0
  ) return;

  const volley = (world.analytics.activeVolleys[bullet.volleyId] ??= {
    weaponType: bullet.weaponType,
    enemyIds: [],
    postRicochetEnemyIds: [],
    spreadSweepEnemyIds: [],
    spreadSweepTriggered: false,
  });
  if (!volley.spreadSweepEnemyIds.includes(enemy.id)) {
    volley.spreadSweepEnemyIds.push(enemy.id);
  }
  if (
    volley.spreadSweepTriggered ||
    volley.spreadSweepEnemyIds.length < world.runtime.spreadSweepDistinctTargets
  ) return;

  volley.spreadSweepTriggered = true;
  if (world.weaponIdentity.spreadSweepCharge) return;

  world.weaponIdentity.spreadSweepCharge = true;
  world.state.shotTimer = Math.max(
    0,
    world.state.shotTimer * world.runtime.spreadSweepNextIntervalMultiplier,
  );
  events.push({
    type: "spread.sweep.triggered",
    volleyId: bullet.volleyId,
    distinctTargets: volley.spreadSweepEnemyIds.length,
  });
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
    const damage = hpBefore - world.state.hp;
    if (damage > 0) {
      world.state.damageCooldown = config.player.damageCooldown;
      events.push({
        type: "player.damaged",
        damage,
        hpAfter: world.state.hp,
        source: {
          kind: "projectile",
          projectileId: projectile.id,
        },
      });
    }
  }

  world.enemyProjectiles = remainingProjectiles;
}
