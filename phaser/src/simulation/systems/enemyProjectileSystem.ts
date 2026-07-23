import type {
  EnemyProjectile,
  Obstacle,
  SimulationConfig,
  Vec2,
  WorldState,
} from "../../domain/types";
import { circleRect } from "../../math/geometry";
import { findFirstSurfaceCollision } from "./bulletSystem";

const MOTION_EPSILON = 0.000001;

export type EnemyProjectileTerminationKind =
  | "surface"
  | "arena"
  | "lifetime";

export type EnemyProjectileFrameMotion = {
  start: Vec2;
  plannedEnd: Vec2;
  lifetimeAfter: number;
  termination: {
    kind: EnemyProjectileTerminationKind;
    frameT: number;
    position: Vec2;
  } | null;
};

export function updateEnemyProjectiles(
  world: WorldState,
  dt: number,
  config: SimulationConfig,
): void {
  for (const projectile of world.enemyProjectiles) {
    projectile.position.x += projectile.velocity.x * dt;
    projectile.position.y += projectile.velocity.y * dt;
    projectile.lifetime -= dt;
  }

  world.enemyProjectiles = world.enemyProjectiles.filter((projectile) => {
    if (projectile.lifetime <= 0) return false;
    if (
      projectile.position.x < 0 ||
      projectile.position.x > config.arena.width ||
      projectile.position.y < 0 ||
      projectile.position.y > config.arena.height
    ) {
      return false;
    }
    return !world.obstacles.some((obstacle) => circleRect(projectile, obstacle));
  });
}

export function planEnemyProjectileFrame(
  projectile: EnemyProjectile,
  dt: number,
  obstacles: readonly Obstacle[],
  config: SimulationConfig,
): EnemyProjectileFrameMotion {
  const frameDuration = Math.max(0, dt);
  const start = { ...projectile.position };
  const plannedEnd = {
    x: start.x + projectile.velocity.x * frameDuration,
    y: start.y + projectile.velocity.y * frameDuration,
  };
  const lifetimeAfter = projectile.lifetime - frameDuration;
  const lifetimeFrameT =
    frameDuration > MOTION_EPSILON &&
    projectile.lifetime <= frameDuration + MOTION_EPSILON
      ? Math.max(0, Math.min(1, projectile.lifetime / frameDuration))
      : null;
  const surface = findFirstSurfaceCollision(
    start,
    plannedEnd,
    projectile.radius,
    obstacles,
    config,
  );
  const surfaceFrameT = surface
    ? Math.max(0, Math.min(1, surface.t))
    : null;

  if (
    lifetimeFrameT !== null &&
    (surfaceFrameT === null ||
      lifetimeFrameT <= surfaceFrameT + MOTION_EPSILON)
  ) {
    return {
      start,
      plannedEnd,
      lifetimeAfter,
      termination: {
        kind: "lifetime",
        frameT: lifetimeFrameT,
        position: interpolate(start, plannedEnd, lifetimeFrameT),
      },
    };
  }

  if (surface && surfaceFrameT !== null) {
    return {
      start,
      plannedEnd,
      lifetimeAfter,
      termination: {
        kind:
          surface.surface.kind === "obstacle"
            ? "surface"
            : "arena",
        frameT: surfaceFrameT,
        position: { ...surface.position },
      },
    };
  }

  return {
    start,
    plannedEnd,
    lifetimeAfter,
    termination: null,
  };
}

function interpolate(start: Vec2, end: Vec2, t: number): Vec2 {
  return {
    x: start.x + (end.x - start.x) * t,
    y: start.y + (end.y - start.y) * t,
  };
}
