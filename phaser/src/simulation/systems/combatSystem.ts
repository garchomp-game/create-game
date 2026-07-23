import type {
  Bullet,
  Enemy,
  EnemyProjectile,
  GameEvent,
  SimulationConfig,
  WorldState,
} from "../../domain/types";
import { circleCircle, segmentCircleFirstIntersection } from "../../math/geometry";
import type { BulletFrameMotions, BulletMotionSegment } from "./bulletSystem";
import { recordChargerPlayerHit } from "./chargerEnemySystem";
import { resolveEnemyDamage } from "./enemyDamageSystem";
import { applyPlayerDamage } from "./playerHealthSystem";
import {
  getRedlineFocusDurationBonus,
  resolveRedlineDamage,
} from "../protocols/redlineCore";
import {
  recordReboundPostRicochetHit,
  resolveReboundDamage,
  restoreReboundCapacityAfterRicochet,
} from "../protocols/reboundOverdrive";
import { resolveResonanceAfterNormalHit } from "../protocols/resonanceRelay";
import {
  isTransparentTidalDuplicate,
  recordTidalActivationHit,
  recordTidalNormalHit,
} from "../protocols/tidalSweep";
import { recordBreakwaterNormalHit } from "../protocols/breakwaterFan";
import { resolveAegisDamage } from "../protocols/aegisFan";

export function resolveCombat(
  world: WorldState,
  config: SimulationConfig,
  events: GameEvent[],
  bulletMotions?: BulletFrameMotions,
): void {
  const remainingBullets: Bullet[] = [];
  const deadEnemies = new Set<Enemy>();

  for (const bullet of world.bullets) {
    const motion = bulletMotions?.get(bullet.id) ?? createStationaryMotion(bullet);
    const segments = motion.segments;
    let stoppedByHitCapacity = false;

    for (const segment of segments) {
      const intersections = world.enemies
        .map((enemy, index) => ({
          enemy,
          index,
          hit: segmentCircleFirstIntersection(segment.start, segment.end, enemy, bullet.radius),
        }))
        .filter(
          (candidate) =>
            candidate.hit !== null &&
            !deadEnemies.has(candidate.enemy) &&
            !bullet.hitEnemyIds.includes(candidate.enemy.id),
        )
        .sort((a, b) => a.hit!.t - b.hit!.t || a.index - b.index);

      for (const { enemy } of intersections) {
        if (deadEnemies.has(enemy) || bullet.hitEnemyIds.includes(enemy.id)) continue;
        if (isTransparentTidalDuplicate(world, bullet, enemy)) continue;
        resolveBulletEnemyHit(world, bullet, enemy, segment, deadEnemies, events);
        if (bullet.hitsRemaining <= 0) {
          stoppedByHitCapacity = true;
          break;
        }
      }

      if (stoppedByHitCapacity) break;
      if (segment.ricochetAfter) {
        const ricochet = segment.ricochetAfter;
        events.push({
          type: "bullet.ricocheted",
          bulletId: bullet.id,
          volleyId: bullet.volleyId,
          weaponType: bullet.weaponType,
          surfaceKind: ricochet.surface.kind,
          obstacleId:
            ricochet.surface.kind === "obstacle" ? ricochet.surface.obstacleId : null,
          boundarySide:
            ricochet.surface.kind === "arenaBoundary" ? ricochet.surface.side : null,
          position: { ...ricochet.position },
          ricochetsUsed: ricochet.ricochetsUsed,
          ricochetsRemaining: ricochet.ricochetsRemaining,
        });
        restoreReboundCapacityAfterRicochet(world, bullet, events);
      }
    }

    if (!stoppedByHitCapacity && bullet.hitsRemaining > 0 && motion.survives) {
      remainingBullets.push(bullet);
    }
  }

  world.bullets = remainingBullets;
  world.enemies = world.enemies.filter((enemy) => !deadEnemies.has(enemy));
  resolveEnemyProjectileHits(world, config, events);
  resolveEnemyContactDamage(world, config, events);
}

function createStationaryMotion(bullet: Bullet): { segments: BulletMotionSegment[]; survives: true } {
  return {
    segments: [
      {
        start: { ...bullet.position },
        end: { ...bullet.position },
        frameT0: 0,
        frameT1: 0,
        ricochetsUsed: bullet.ricochetsUsed,
        ricochetSurfaceKind: bullet.ricochetSurfaceKind,
        ricochetBoundarySide: bullet.ricochetBoundarySide,
        ricochetAfter: null,
        terminalAfter: false,
      },
    ],
    survives: true,
  };
}

export function resolveBulletEnemyHit(
  world: WorldState,
  bullet: Bullet,
  enemy: Enemy,
  segment: BulletMotionSegment,
  deadEnemies: Set<Enemy>,
  events: GameEvent[],
): void {
  const focusHit = applyPulseFocus(
    world,
    bullet,
    enemy,
    segment.ricochetsUsed,
    bullet.hitEnemyIds.length,
  );
  const endpointPositionBeforeHit = { ...enemy.position };
  const normalResolvedDamage = bullet.damage + focusHit.bonusDamage;
  const redline = resolveRedlineDamage(
    world,
    bullet,
    enemy,
    segment.ricochetsUsed,
    focusHit.stackBefore,
    normalResolvedDamage,
  );
  const rebound = resolveReboundDamage(
    world,
    bullet,
    normalResolvedDamage,
  );
  const protocolDamage = redline ?? rebound;
  const aegis = resolveAegisDamage(
    world,
    bullet,
    normalResolvedDamage,
  );
  const resolvedProtocolDamage = protocolDamage ?? aegis;
  const damage =
    resolvedProtocolDamage?.damage ?? normalResolvedDamage;
  const tidalState =
    bullet.candidate?.protocolState?.kind ===
    "full-span-tidal-sweep"
      ? bullet.candidate.protocolState
      : null;
  bullet.hitEnemyIds.push(enemy.id);
  bullet.hitsRemaining -= 1;
  registerSpreadSweepHit(world, bullet, enemy, events);
  resolveEnemyDamage(
    world,
    enemy,
    {
      amount: damage,
      baselineWithoutAnyProtocol:
        tidalState
          ? 0
          : resolvedProtocolDamage?.baselineWithoutAnyProtocol ??
            damage,
      baselineForEffectAttribution:
        tidalState
          ? 0
          : resolvedProtocolDamage
              ?.baselineForEffectAttribution ?? damage,
      source: {
        kind: "player-projectile",
        bulletId: bullet.id,
        volleyId: bullet.volleyId,
        weaponType: bullet.weaponType,
        ricochetsUsed: segment.ricochetsUsed,
        ricochetSurfaceKind: segment.ricochetSurfaceKind,
        ricochetBoundarySide: segment.ricochetBoundarySide,
        ...(tidalState
          ? {
              protocolId:
                world.progression.exProtocol?.status === "selected"
                  ? world.progression.exProtocol.route.protocolId
                  : undefined,
              activationId: tidalState.activationId,
            }
          : resolvedProtocolDamage
            ? { protocolId: resolvedProtocolDamage.protocolId }
            : {}),
        attribution: tidalState
          ? "protocol-volley"
          : resolvedProtocolDamage?.attribution ?? "normal",
      },
    },
    deadEnemies,
    events,
    {
      afterHit: (outcome) => {
        if (focusHit.applied) {
          events.push({
            type: "pulse.focus.hit",
            enemyId: enemy.id,
            enemyType: enemy.typeId,
            stackBefore: focusHit.stackBefore,
            stackAfter: focusHit.stackAfter,
            lineStacks: focusHit.lineStacks,
            targetBonusDamage: focusHit.targetBonusDamage,
            lineBonusDamage: focusHit.lineBonusDamage,
            bonusDamage: focusHit.bonusDamage,
            killed: outcome.killed,
          });
        }
        if (redline?.redlineEvent) {
          events.push({
            type: "ex.redline.hit",
            projectileId: bullet.id,
            totalDamage: redline.redlineEvent.totalDamage,
            bonusDamageAttributed:
              redline.redlineEvent.bonusDamageAttributed,
            elapsed: world.state.elapsed,
          });
        }
        recordReboundPostRicochetHit(
          world,
          bullet,
          enemy,
          events,
        );
        resolveResonanceAfterNormalHit(
          world,
          bullet,
          enemy,
          {
            priorDirectHits: bullet.hitEnemyIds.length - 1,
            ricochetsUsed: segment.ricochetsUsed,
            stackAfter: focusHit.stackAfter,
            maximumStacks: world.runtime.pulseFocusMaxStacks,
            endpointSurvived: !outcome.killed,
            endpointPositionBeforeHit,
          },
          deadEnemies,
          events,
        );
        recordTidalNormalHit(world, bullet, enemy, events);
        recordTidalActivationHit(world, bullet, enemy, events);
        recordBreakwaterNormalHit(world, bullet, enemy, events);
      },
    },
  );
}

export function resolveEnemyProjectilePlayerHit(
  world: WorldState,
  projectile: EnemyProjectile,
  config: SimulationConfig,
  events: GameEvent[],
): void {
  if (world.state.damageCooldown > 0) return;

  const damage = applyPlayerDamage(world, projectile.damage);
  if (damage <= 0) return;
  world.state.damageCooldown = config.player.damageCooldown;
  events.push({
    type: "player.damaged",
    damage,
    hpAfter: world.state.hp,
    source: {
      kind: "projectile",
      projectileId: projectile.id,
      ...(projectile.source ?? {}),
    },
  });
}

export function resolveEnemyContactDamage(
  world: WorldState,
  config: SimulationConfig,
  events: GameEvent[],
): void {
  if (world.state.damageCooldown > 0) return;
  const touchingEnemy = world.enemies.find((enemy) =>
    circleCircle(enemy, world.player),
  );
  if (!touchingEnemy) return;

  const damage = applyPlayerDamage(world, touchingEnemy.damage);
  if (damage <= 0) return;
  world.state.damageCooldown = config.player.damageCooldown;
  recordChargerPlayerHit(touchingEnemy, damage, events);
  events.push({
    type: "player.damaged",
    damage,
    hpAfter: world.state.hp,
    source: {
      kind: "contact",
      enemyId: touchingEnemy.id,
      enemyType: touchingEnemy.typeId,
      ...(touchingEnemy.boss
        ? { bossId: touchingEnemy.boss.bossId }
        : {}),
      ...(touchingEnemy.bossAttackSource ?? {}),
    },
  });
}

function applyPulseFocus(
  world: WorldState,
  bullet: Bullet,
  enemy: Enemy,
  ricochetsUsed: number,
  priorDirectHits: number,
): {
  applied: boolean;
  stackBefore: number;
  stackAfter: number;
  lineStacks: number;
  targetBonusDamage: number;
  lineBonusDamage: number;
  bonusDamage: number;
} {
  if (
    bullet.weaponType !== "pulse" ||
    ricochetsUsed > 0 ||
    world.runtime.pulseFocusMaxStacks <= 0
  ) {
    return {
      applied: false,
      stackBefore: 0,
      stackAfter: 0,
      lineStacks: 0,
      targetBonusDamage: 0,
      lineBonusDamage: 0,
      bonusDamage: 0,
    };
  }

  const active = (enemy.pulseFocusExpiresAt ?? 0) >= world.state.elapsed;
  const stackBefore = active
    ? Math.min(world.runtime.pulseFocusMaxStacks, enemy.pulseFocusStacks ?? 0)
    : 0;
  const stackAfter = Math.min(world.runtime.pulseFocusMaxStacks, stackBefore + 1);
  const lineStacks = Math.min(world.runtime.pulseFocusMaxStacks, priorDirectHits);
  const targetBonusDamage =
    bullet.damage * world.runtime.pulseFocusBonusPerStack * stackBefore;
  const lineBonusDamage =
    bullet.damage * world.runtime.pulseLineBonusPerStack * lineStacks;
  const bonusDamage = targetBonusDamage + lineBonusDamage;
  enemy.pulseFocusStacks = stackAfter;
  enemy.pulseFocusExpiresAt = world.state.elapsed + world.runtime.pulseFocusDuration;
  enemy.pulseFocusExpiresAt += getRedlineFocusDurationBonus(world);
  return {
    applied: true,
    stackBefore,
    stackAfter,
    lineStacks,
    targetBonusDamage,
    lineBonusDamage,
    bonusDamage,
  };
}

function registerSpreadSweepHit(
  world: WorldState,
  bullet: Bullet,
  enemy: Enemy,
  events: GameEvent[],
): void {
  if (
    bullet.weaponType !== "spread" ||
    (bullet.candidate &&
      bullet.candidate.volleyKind !== "normal") ||
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

    resolveEnemyProjectilePlayerHit(world, projectile, config, events);
  }

  world.enemyProjectiles = remainingProjectiles;
}
