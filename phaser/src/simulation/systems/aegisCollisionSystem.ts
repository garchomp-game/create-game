import type {
  Bullet,
  Enemy,
  EnemyProjectile,
  GameEvent,
  SimulationConfig,
  Vec2,
  WorldState,
} from "../../domain/types";
import {
  circleCircle,
  segmentCircleFirstIntersection,
} from "../../math/geometry";
import {
  getAegisInterceptionRadiusBonus,
  isAegisFanSelected,
  recordAegisInterception,
  shouldAegisProjectileSurviveIntercept,
} from "../protocols/aegisFan";
import { restoreReboundCapacityAfterRicochet } from "../protocols/reboundOverdrive";
import {
  planBulletFrame,
  type BulletMotionSegment,
  type PlannedBulletFrame,
} from "./bulletSystem";
import {
  resolveBulletEnemyHit,
  resolveEnemyContactDamage,
  resolveEnemyProjectilePlayerHit,
} from "./combatSystem";
import {
  planEnemyProjectileFrame,
  type EnemyProjectileFrameMotion,
} from "./enemyProjectileSystem";

export const COLLISION_TIME_EPSILON = 1e-7;
export const MIN_FRAME_T_ADVANCE = 1e-6;
export const MAX_COLLISION_EVENTS_PER_FRAME = 2048;
export const MAX_AEGIS_INTERCEPTION_CANDIDATES = 4096;

export type AegisCollisionFrameStats = {
  candidateCount: number;
  interceptionCandidateCount: number;
  resolvedEventCount: number;
};

type CandidateBase = {
  frameT: number;
  priority: 0 | 1 | 2 | 3 | 4;
  bulletOrdinal: number;
  enemyProjectileOrdinal: number;
  enemyOrdinal: number;
  localOrdinal: number;
};

type EnemyProjectileTerminationCandidate = CandidateBase & {
  kind: "enemy-projectile-termination";
  enemyProjectileId: string;
};

type InterceptionCandidate = CandidateBase & {
  kind: "interception";
  bulletId: string;
  enemyProjectileId: string;
};

type PlayerEndpointHitCandidate = CandidateBase & {
  kind: "player-endpoint-hit";
  enemyProjectileId: string;
};

type EnemyHitCandidate = CandidateBase & {
  kind: "enemy-hit";
  bulletId: string;
  enemyId: string;
  segment: BulletMotionSegment;
};

type BulletBoundaryCandidate = CandidateBase & {
  kind: "bullet-boundary";
  bulletId: string;
  segment: BulletMotionSegment;
  boundaryKind: "ricochet" | "termination";
};

type CollisionCandidate =
  | EnemyProjectileTerminationCandidate
  | InterceptionCandidate
  | PlayerEndpointHitCandidate
  | EnemyHitCandidate
  | BulletBoundaryCandidate;

export type RelativeSweepInput = {
  firstStart: Vec2;
  firstEnd: Vec2;
  firstRadius: number;
  secondStart: Vec2;
  secondEnd: Vec2;
  secondRadius: number;
  intervalStart: number;
  intervalEnd: number;
};

export function resolveAegisCollisionFrame(
  world: WorldState,
  dt: number,
  config: SimulationConfig,
  events: GameEvent[],
): AegisCollisionFrameStats {
  if (!config.features.exProtocols || !isAegisFanSelected(world)) {
    throw new Error(
      "Aegis global collision arbitration requires the selected Aegis Protocol.",
    );
  }

  const bullets = stableBullets(world.bullets);
  const enemyProjectiles = stableEnemyProjectiles(
    world.enemyProjectiles,
  );
  const enemies = stableEnemies(world.enemies);
  const bulletPlans = new Map<string, PlannedBulletFrame>();
  const enemyProjectilePlans = new Map<
    string,
    EnemyProjectileFrameMotion
  >();
  for (const bullet of bullets) {
    bulletPlans.set(
      bullet.id,
      planBulletFrame(bullet, dt, world.obstacles, config),
    );
  }
  for (const projectile of enemyProjectiles) {
    enemyProjectilePlans.set(
      projectile.id,
      planEnemyProjectileFrame(
        projectile,
        dt,
        world.obstacles,
        config,
      ),
    );
  }

  const candidatePlan = createCollisionCandidates(
    world,
    bullets,
    enemyProjectiles,
    enemies,
    bulletPlans,
    enemyProjectilePlans,
  );
  const candidates = candidatePlan.candidates;
  candidates.sort(compareCollisionCandidates);
  const plannedPlayerEndpointContacts = new Set(
    candidates
      .filter(
        (
          candidate,
        ): candidate is PlayerEndpointHitCandidate =>
          candidate.kind === "player-endpoint-hit",
      )
      .map((candidate) => candidate.enemyProjectileId),
  );

  const liveBulletIds = new Set(bullets.map(({ id }) => id));
  const liveEnemyProjectileIds = new Set(
    enemyProjectiles.map(({ id }) => id),
  );
  const deadEnemies = new Set<Enemy>();
  const bulletsById = new Map(bullets.map((bullet) => [bullet.id, bullet]));
  const enemyProjectilesById = new Map(
    enemyProjectiles.map((projectile) => [
      projectile.id,
      projectile,
    ]),
  );
  const enemiesById = new Map(
    enemies.map((enemy) => [enemy.id, enemy]),
  );
  let resolvedEvents = 0;
  const reserveCollisionEvent = () => {
    if (
      resolvedEvents >= MAX_COLLISION_EVENTS_PER_FRAME
    ) {
      throw new Error(
        `Aegis collision event budget exceeded (${MAX_COLLISION_EVENTS_PER_FRAME}).`,
      );
    }
    resolvedEvents += 1;
  };

  for (const candidate of candidates) {
    commitCandidate(
      candidate,
      world,
      config,
      events,
      bulletsById,
      enemyProjectilesById,
      enemiesById,
      liveBulletIds,
      liveEnemyProjectileIds,
      deadEnemies,
      plannedPlayerEndpointContacts,
      reserveCollisionEvent,
    );
  }

  world.bullets = bullets
    .filter((bullet) => {
      const plan = bulletPlans.get(bullet.id);
      if (
        !plan ||
        !liveBulletIds.has(bullet.id) ||
        bullet.hitsRemaining <= 0 ||
        !plan.motion.survives
      ) {
        return false;
      }
      commitBulletPhysicalState(bullet, plan.bullet);
      return true;
    });
  world.enemyProjectiles = enemyProjectiles
    .filter((projectile) => {
      const plan = enemyProjectilePlans.get(projectile.id);
      if (
        !plan ||
        !liveEnemyProjectileIds.has(projectile.id) ||
        plan.termination
      ) {
        return false;
      }
      projectile.position = { ...plan.plannedEnd };
      projectile.lifetime = plan.lifetimeAfter;
      return true;
    });
  world.enemies = enemies.filter((enemy) => !deadEnemies.has(enemy));
  resolveEnemyContactDamage(world, config, events);
  return {
    candidateCount: candidates.length,
    interceptionCandidateCount:
      candidatePlan.interceptionCandidateCount,
    resolvedEventCount: resolvedEvents,
  };
}

function createCollisionCandidates(
  world: WorldState,
  bullets: readonly Bullet[],
  enemyProjectiles: readonly EnemyProjectile[],
  enemies: readonly Enemy[],
  bulletPlans: ReadonlyMap<string, PlannedBulletFrame>,
  enemyProjectilePlans: ReadonlyMap<
    string,
    EnemyProjectileFrameMotion
  >,
): {
  candidates: CollisionCandidate[];
  interceptionCandidateCount: number;
} {
  const candidates: CollisionCandidate[] = [];
  let localOrdinal = 0;

  for (const projectile of enemyProjectiles) {
    const plan = enemyProjectilePlans.get(projectile.id);
    if (!plan) continue;
    if (plan.termination) {
      candidates.push({
        kind: "enemy-projectile-termination",
        frameT: plan.termination.frameT,
        priority: 0,
        bulletOrdinal: Number.MAX_SAFE_INTEGER,
        enemyProjectileOrdinal: getEnemyProjectileOrdinal(projectile),
        enemyOrdinal: Number.MAX_SAFE_INTEGER,
        localOrdinal: localOrdinal++,
        enemyProjectileId: projectile.id,
      });
    }
    if (
      circleCircle(
        {
          position: plan.plannedEnd,
          radius: projectile.radius,
        },
        world.player,
      )
    ) {
      candidates.push({
        kind: "player-endpoint-hit",
        frameT: 1,
        priority: 2,
        bulletOrdinal: Number.MAX_SAFE_INTEGER,
        enemyProjectileOrdinal: getEnemyProjectileOrdinal(projectile),
        enemyOrdinal: Number.MAX_SAFE_INTEGER,
        localOrdinal: localOrdinal++,
        enemyProjectileId: projectile.id,
      });
    }
  }

  let interceptionCandidates = 0;
  for (const bullet of bullets) {
    const plan = bulletPlans.get(bullet.id);
    if (!plan) continue;
    const aegisState = bullet.candidate?.protocolState;
    for (const segment of plan.motion.segments) {
      for (const enemy of enemies) {
        const hit = segmentCircleFirstIntersection(
          segment.start,
          segment.end,
          enemy,
          bullet.radius,
        );
        if (!hit) continue;
        candidates.push({
          kind: "enemy-hit",
          frameT:
            segment.frameT0 +
            (segment.frameT1 - segment.frameT0) * hit.t,
          priority: 3,
          bulletOrdinal: getBulletOrdinal(bullet),
          enemyProjectileOrdinal: Number.MAX_SAFE_INTEGER,
          enemyOrdinal: getEnemyOrdinal(enemy),
          localOrdinal: localOrdinal++,
          bulletId: bullet.id,
          enemyId: enemy.id,
          segment,
        });
      }

      if (
        aegisState?.kind !== "aegis-fan" ||
        aegisState.interceptsRemaining <= 0 ||
        segment.ricochetsUsed !== 0
      ) {
        continue;
      }
      for (const projectile of enemyProjectiles) {
        if (
          projectile.candidate?.category !== "standard" ||
          projectile.candidate.interceptible !== true
        ) {
          continue;
        }
        const projectilePlan = enemyProjectilePlans.get(projectile.id);
        if (!projectilePlan) continue;
        const intervalEnd = Math.min(
          segment.frameT1,
          projectilePlan.termination?.frameT ?? 1,
        );
        if (intervalEnd < segment.frameT0 - COLLISION_TIME_EPSILON) {
          continue;
        }
        const frameT = firstRelativeSweptCircleContact({
          firstStart: segment.start,
          firstEnd: positionOnSegment(segment, intervalEnd),
          firstRadius:
            bullet.radius + getAegisInterceptionRadiusBonus(world),
          secondStart: positionAt(
            projectilePlan.start,
            projectilePlan.plannedEnd,
            segment.frameT0,
          ),
          secondEnd: positionAt(
            projectilePlan.start,
            projectilePlan.plannedEnd,
            intervalEnd,
          ),
          secondRadius: projectile.radius,
          intervalStart: segment.frameT0,
          intervalEnd,
        });
        if (frameT === null) continue;
        if (
          segment.ricochetAfter &&
          frameT >= segment.frameT1 - COLLISION_TIME_EPSILON
        ) {
          continue;
        }
        interceptionCandidates += 1;
        if (
          interceptionCandidates >
          MAX_AEGIS_INTERCEPTION_CANDIDATES
        ) {
          throw new Error(
            `Aegis interception candidate budget exceeded (${MAX_AEGIS_INTERCEPTION_CANDIDATES}).`,
          );
        }
        candidates.push({
          kind: "interception",
          frameT,
          priority: 1,
          bulletOrdinal: getBulletOrdinal(bullet),
          enemyProjectileOrdinal:
            getEnemyProjectileOrdinal(projectile),
          enemyOrdinal: Number.MAX_SAFE_INTEGER,
          localOrdinal: localOrdinal++,
          bulletId: bullet.id,
          enemyProjectileId: projectile.id,
        });
      }
    }

    for (const segment of plan.motion.segments) {
      if (segment.ricochetAfter) {
        candidates.push({
          kind: "bullet-boundary",
          frameT: segment.frameT1,
          priority: 4,
          bulletOrdinal: getBulletOrdinal(bullet),
          enemyProjectileOrdinal: Number.MAX_SAFE_INTEGER,
          enemyOrdinal: Number.MAX_SAFE_INTEGER,
          localOrdinal: localOrdinal++,
          bulletId: bullet.id,
          segment,
          boundaryKind: "ricochet",
        });
      }
      if (segment.terminalAfter) {
        candidates.push({
          kind: "bullet-boundary",
          frameT: segment.frameT1,
          priority: 4,
          bulletOrdinal: getBulletOrdinal(bullet),
          enemyProjectileOrdinal: Number.MAX_SAFE_INTEGER,
          enemyOrdinal: Number.MAX_SAFE_INTEGER,
          localOrdinal: localOrdinal++,
          bulletId: bullet.id,
          segment,
          boundaryKind: "termination",
        });
      }
    }
  }

  return {
    candidates,
    interceptionCandidateCount: interceptionCandidates,
  };
}

function commitCandidate(
  candidate: CollisionCandidate,
  world: WorldState,
  config: SimulationConfig,
  events: GameEvent[],
  bulletsById: ReadonlyMap<string, Bullet>,
  enemyProjectilesById: ReadonlyMap<string, EnemyProjectile>,
  enemiesById: ReadonlyMap<string, Enemy>,
  liveBulletIds: Set<string>,
  liveEnemyProjectileIds: Set<string>,
  deadEnemies: Set<Enemy>,
  plannedPlayerEndpointContacts: ReadonlySet<string>,
  reserveCollisionEvent: () => void,
): boolean {
  if (candidate.kind === "enemy-projectile-termination") {
    if (!liveEnemyProjectileIds.has(candidate.enemyProjectileId)) {
      return false;
    }
    reserveCollisionEvent();
    liveEnemyProjectileIds.delete(candidate.enemyProjectileId);
    return true;
  }

  if (candidate.kind === "interception") {
    const bullet = bulletsById.get(candidate.bulletId);
    const projectile = enemyProjectilesById.get(
      candidate.enemyProjectileId,
    );
    const state = bullet?.candidate?.protocolState;
    if (
      !bullet ||
      !projectile ||
      !liveBulletIds.has(bullet.id) ||
      !liveEnemyProjectileIds.has(projectile.id) ||
      state?.kind !== "aegis-fan" ||
      state.interceptsRemaining <= 0
    ) {
      return false;
    }
    reserveCollisionEvent();
    state.interceptsRemaining -= 1;
    liveEnemyProjectileIds.delete(projectile.id);
    events.push({
      type: "ex.aegis.intercepted",
      volleyId: bullet.volleyId,
      side: state.side,
      enemyProjectileCategory: projectile.candidate!.category,
      plannedPlayerEndpointContact:
        plannedPlayerEndpointContacts.has(projectile.id),
      elapsed: world.state.elapsed,
    });
    recordAegisInterception(world, bullet, events);
    if (!shouldAegisProjectileSurviveIntercept(world)) {
      liveBulletIds.delete(bullet.id);
    }
    return true;
  }

  if (candidate.kind === "player-endpoint-hit") {
    const projectile = enemyProjectilesById.get(
      candidate.enemyProjectileId,
    );
    if (!projectile || !liveEnemyProjectileIds.has(projectile.id)) {
      return false;
    }
    reserveCollisionEvent();
    liveEnemyProjectileIds.delete(projectile.id);
    resolveEnemyProjectilePlayerHit(
      world,
      projectile,
      config,
      events,
    );
    return true;
  }

  if (candidate.kind === "enemy-hit") {
    const bullet = bulletsById.get(candidate.bulletId);
    const enemy = enemiesById.get(candidate.enemyId);
    if (
      !bullet ||
      !enemy ||
      !liveBulletIds.has(bullet.id) ||
      bullet.hitsRemaining <= 0 ||
      bullet.hitEnemyIds.includes(enemy.id) ||
      deadEnemies.has(enemy)
    ) {
      return false;
    }
    reserveCollisionEvent();
    resolveBulletEnemyHit(
      world,
      bullet,
      enemy,
      candidate.segment,
      deadEnemies,
      events,
    );
    if (bullet.hitsRemaining <= 0) {
      liveBulletIds.delete(bullet.id);
    }
    return true;
  }

  const bullet = bulletsById.get(candidate.bulletId);
  if (!bullet || !liveBulletIds.has(bullet.id)) return false;
  if (candidate.boundaryKind === "termination") {
    reserveCollisionEvent();
    liveBulletIds.delete(bullet.id);
    return true;
  }
  const ricochet = candidate.segment.ricochetAfter;
  if (!ricochet) return false;
  reserveCollisionEvent();
  bullet.ricochetRemaining = ricochet.ricochetsRemaining;
  bullet.ricochetsUsed = ricochet.ricochetsUsed;
  bullet.ricochetSurfaceKind = ricochet.surface.kind;
  bullet.ricochetBoundarySide =
    ricochet.surface.kind === "arenaBoundary"
      ? ricochet.surface.side
      : null;
  events.push({
    type: "bullet.ricocheted",
    bulletId: bullet.id,
    volleyId: bullet.volleyId,
    weaponType: bullet.weaponType,
    surfaceKind: ricochet.surface.kind,
    obstacleId:
      ricochet.surface.kind === "obstacle"
        ? ricochet.surface.obstacleId
        : null,
    boundarySide:
      ricochet.surface.kind === "arenaBoundary"
        ? ricochet.surface.side
        : null,
    position: { ...ricochet.position },
    ricochetsUsed: ricochet.ricochetsUsed,
    ricochetsRemaining: ricochet.ricochetsRemaining,
  });
  restoreReboundCapacityAfterRicochet(world, bullet, events);
  return true;
}

export function firstRelativeSweptCircleContact(
  input: RelativeSweepInput,
): number | null {
  const intervalLength = input.intervalEnd - input.intervalStart;
  if (intervalLength < -COLLISION_TIME_EPSILON) return null;
  const firstDelta = {
    x: input.firstEnd.x - input.firstStart.x,
    y: input.firstEnd.y - input.firstStart.y,
  };
  const secondDelta = {
    x: input.secondEnd.x - input.secondStart.x,
    y: input.secondEnd.y - input.secondStart.y,
  };
  const relativeStart = {
    x: input.firstStart.x - input.secondStart.x,
    y: input.firstStart.y - input.secondStart.y,
  };
  const relativeDelta = {
    x: firstDelta.x - secondDelta.x,
    y: firstDelta.y - secondDelta.y,
  };
  const radius = input.firstRadius + input.secondRadius;
  const c =
    relativeStart.x * relativeStart.x +
    relativeStart.y * relativeStart.y -
    radius * radius;
  if (c <= COLLISION_TIME_EPSILON) return input.intervalStart;

  const a =
    relativeDelta.x * relativeDelta.x +
    relativeDelta.y * relativeDelta.y;
  if (a <= COLLISION_TIME_EPSILON) return null;
  const b =
    2 *
    (relativeStart.x * relativeDelta.x +
      relativeStart.y * relativeDelta.y);
  let discriminant = b * b - 4 * a * c;
  if (discriminant < -COLLISION_TIME_EPSILON) return null;
  discriminant = Math.max(0, discriminant);
  const root = Math.sqrt(discriminant);
  const first = (-b - root) / (2 * a);
  const second = (-b + root) / (2 * a);
  const localT =
    first >= -COLLISION_TIME_EPSILON ? first : second;
  if (
    localT < -COLLISION_TIME_EPSILON ||
    localT > 1 + COLLISION_TIME_EPSILON
  ) {
    return null;
  }
  const clampedLocalT = Math.max(0, Math.min(1, localT));
  return (
    input.intervalStart +
    intervalLength * clampedLocalT
  );
}

function compareCollisionCandidates(
  left: CollisionCandidate,
  right: CollisionCandidate,
): number {
  if (
    Math.abs(left.frameT - right.frameT) >
    COLLISION_TIME_EPSILON
  ) {
    return left.frameT - right.frameT;
  }
  return (
    left.priority - right.priority ||
    left.bulletOrdinal - right.bulletOrdinal ||
    left.enemyProjectileOrdinal - right.enemyProjectileOrdinal ||
    left.enemyOrdinal - right.enemyOrdinal ||
    left.localOrdinal - right.localOrdinal
  );
}

function stableBullets(bullets: readonly Bullet[]): Bullet[] {
  return [...bullets].sort(
    (left, right) =>
      getBulletOrdinal(left) - getBulletOrdinal(right) ||
      left.id.localeCompare(right.id),
  );
}

function stableEnemyProjectiles(
  projectiles: readonly EnemyProjectile[],
): EnemyProjectile[] {
  return [...projectiles].sort(
    (left, right) =>
      getEnemyProjectileOrdinal(left) -
        getEnemyProjectileOrdinal(right) ||
      left.id.localeCompare(right.id),
  );
}

function stableEnemies(enemies: readonly Enemy[]): Enemy[] {
  return [...enemies].sort(
    (left, right) =>
      getEnemyOrdinal(left) - getEnemyOrdinal(right) ||
      left.id.localeCompare(right.id),
  );
}

function getBulletOrdinal(bullet: Bullet): number {
  return bullet.candidate?.creationOrdinal ?? Number.MAX_SAFE_INTEGER;
}

function getEnemyProjectileOrdinal(
  projectile: EnemyProjectile,
): number {
  return (
    projectile.candidate?.creationOrdinal ?? Number.MAX_SAFE_INTEGER
  );
}

function getEnemyOrdinal(enemy: Enemy): number {
  return enemy.candidate?.creationOrdinal ?? Number.MAX_SAFE_INTEGER;
}

function positionAt(start: Vec2, end: Vec2, frameT: number): Vec2 {
  return {
    x: start.x + (end.x - start.x) * frameT,
    y: start.y + (end.y - start.y) * frameT,
  };
}

function positionOnSegment(
  segment: BulletMotionSegment,
  frameT: number,
): Vec2 {
  const duration = segment.frameT1 - segment.frameT0;
  const localT =
    duration <= COLLISION_TIME_EPSILON
      ? 0
      : Math.max(
          0,
          Math.min(1, (frameT - segment.frameT0) / duration),
        );
  return positionAt(segment.start, segment.end, localT);
}

function commitBulletPhysicalState(
  bullet: Bullet,
  planned: Bullet,
): void {
  bullet.position = { ...planned.position };
  bullet.velocity = { ...planned.velocity };
  bullet.lifetime = planned.lifetime;
  bullet.ricochetRemaining = planned.ricochetRemaining;
  bullet.ricochetsUsed = planned.ricochetsUsed;
  bullet.ricochetSurfaceKind = planned.ricochetSurfaceKind;
  bullet.ricochetBoundarySide = planned.ricochetBoundarySide;
}
