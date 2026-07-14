import type {
  ArenaBoundarySide,
  Bullet,
  Obstacle,
  SimulationConfig,
  Vec2,
  WorldState,
} from "../../domain/types";
import { clamp, segmentCircleFirstIntersection } from "../../math/geometry";

const MOTION_EPSILON = 0.000001;
const POSITION_EPSILON = 0.001;
const RICOCHET_LIFETIME_CAP = 0.35;
const MAX_SURFACE_COLLISIONS_PER_FRAME = 4;

export type BulletRicochetSurface =
  | { kind: "obstacle"; obstacleId: string }
  | { kind: "arenaBoundary"; side: ArenaBoundarySide };

export type BulletRicochetMotion = {
  surface: BulletRicochetSurface;
  position: Vec2;
  ricochetsUsed: number;
  ricochetsRemaining: number;
};

export type BulletMotionSegment = {
  start: Vec2;
  end: Vec2;
  ricochetsUsed: number;
  ricochetAfter: BulletRicochetMotion | null;
};

export type BulletFrameMotion = {
  segments: BulletMotionSegment[];
  survives: boolean;
};

export type BulletFrameMotions = ReadonlyMap<string, BulletFrameMotion>;

type SurfaceCollision = {
  t: number;
  position: Vec2;
  normal: Vec2;
  surface: BulletRicochetSurface;
};

export function updateBullets(
  world: WorldState,
  dt: number,
  config: SimulationConfig,
): BulletFrameMotions {
  const motions = new Map<string, BulletFrameMotion>();
  for (const bullet of world.bullets) {
    motions.set(bullet.id, advanceBullet(bullet, dt, world.obstacles, config));
  }
  return motions;
}

function advanceBullet(
  bullet: Bullet,
  dt: number,
  obstacles: readonly Obstacle[],
  config: SimulationConfig,
): BulletFrameMotion {
  const segments: BulletMotionSegment[] = [];
  let frameTimeRemaining = Math.max(0, dt);
  let survives = bullet.lifetime > MOTION_EPSILON;
  let surfaceCollisions = 0;

  while (
    survives &&
    frameTimeRemaining > MOTION_EPSILON &&
    surfaceCollisions < MAX_SURFACE_COLLISIONS_PER_FRAME
  ) {
    const travelTime = Math.min(frameTimeRemaining, bullet.lifetime);
    if (travelTime <= MOTION_EPSILON) {
      survives = false;
      break;
    }

    const start = { ...bullet.position };
    const projectedEnd = {
      x: start.x + bullet.velocity.x * travelTime,
      y: start.y + bullet.velocity.y * travelTime,
    };
    const collision = findFirstSurfaceCollision(
      start,
      projectedEnd,
      bullet.radius,
      obstacles,
      config,
    );

    if (!collision) {
      segments.push({
        start,
        end: projectedEnd,
        ricochetsUsed: bullet.ricochetsUsed,
        ricochetAfter: null,
      });
      bullet.position = projectedEnd;
      bullet.lifetime = Math.max(0, bullet.lifetime - travelTime);
      frameTimeRemaining = Math.max(0, frameTimeRemaining - travelTime);
      if (bullet.lifetime <= MOTION_EPSILON) survives = false;
      continue;
    }

    const timeToCollision = travelTime * collision.t;
    bullet.position = { ...collision.position };
    bullet.lifetime = Math.max(0, bullet.lifetime - timeToCollision);
    frameTimeRemaining = Math.max(0, frameTimeRemaining - timeToCollision);

    const canRicochet = canRicochetFrom(bullet, collision.surface, config);
    const segment: BulletMotionSegment = {
      start,
      end: { ...collision.position },
      ricochetsUsed: bullet.ricochetsUsed,
      ricochetAfter: null,
    };

    if (!canRicochet || bullet.lifetime <= MOTION_EPSILON) {
      segments.push(segment);
      survives = false;
      break;
    }

    bullet.ricochetRemaining -= 1;
    bullet.ricochetsUsed += 1;
    segment.ricochetAfter = {
      surface: collision.surface,
      position: { ...collision.position },
      ricochetsUsed: bullet.ricochetsUsed,
      ricochetsRemaining: bullet.ricochetRemaining,
    };
    segments.push(segment);

    reflectVelocity(bullet.velocity, collision.normal);
    bullet.position = {
      x: collision.position.x + collision.normal.x * POSITION_EPSILON,
      y: collision.position.y + collision.normal.y * POSITION_EPSILON,
    };
    bullet.lifetime = Math.min(bullet.lifetime, RICOCHET_LIFETIME_CAP);
    surfaceCollisions += 1;
  }

  if (surfaceCollisions >= MAX_SURFACE_COLLISIONS_PER_FRAME && frameTimeRemaining > 0) {
    survives = false;
  }

  return { segments, survives };
}

function canRicochetFrom(
  bullet: Bullet,
  surface: BulletRicochetSurface,
  config: SimulationConfig,
): boolean {
  if (bullet.ricochetRemaining <= 0) return false;
  if (surface.kind === "obstacle") return true;
  return config.features.pulseBoundaryRicochet && bullet.weaponType === "pulse";
}

function findFirstSurfaceCollision(
  start: Vec2,
  end: Vec2,
  radius: number,
  obstacles: readonly Obstacle[],
  config: SimulationConfig,
): SurfaceCollision | null {
  let first = findArenaBoundaryCollision(start, end, radius, config);

  for (const obstacle of obstacles) {
    const collision = sweepCircleAgainstRect(start, end, radius, obstacle);
    if (!collision || (first && collision.t >= first.t - MOTION_EPSILON)) continue;
    first = {
      ...collision,
      surface: { kind: "obstacle", obstacleId: obstacle.id },
    };
  }

  return first;
}

function findArenaBoundaryCollision(
  start: Vec2,
  end: Vec2,
  radius: number,
  config: SimulationConfig,
): SurfaceCollision | null {
  const minX = radius;
  const maxX = config.arena.width - radius;
  const minY = radius;
  const maxY = config.arena.height - radius;
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const candidates: SurfaceCollision[] = [];

  addBoundaryCandidate(candidates, start, dx, dy, "left", minX, start.x, end.x <= minX);
  addBoundaryCandidate(candidates, start, dx, dy, "right", maxX, start.x, end.x >= maxX);
  addBoundaryCandidate(candidates, start, dy, dx, "top", minY, start.y, end.y <= minY);
  addBoundaryCandidate(candidates, start, dy, dx, "bottom", maxY, start.y, end.y >= maxY);

  const valid = candidates.filter((candidate) => {
    if (candidate.t < -MOTION_EPSILON || candidate.t > 1 + MOTION_EPSILON) return false;
    return (
      candidate.position.x >= minX - MOTION_EPSILON &&
      candidate.position.x <= maxX + MOTION_EPSILON &&
      candidate.position.y >= minY - MOTION_EPSILON &&
      candidate.position.y <= maxY + MOTION_EPSILON
    );
  });
  valid.sort((a, b) => a.t - b.t);
  const first = valid[0];
  if (!first) return null;

  const corner = valid.find(
    (candidate) =>
      candidate !== first && Math.abs(candidate.t - first.t) <= MOTION_EPSILON,
  );
  if (corner) {
    first.normal = {
      x: first.normal.x + corner.normal.x,
      y: first.normal.y + corner.normal.y,
    };
  }
  return first;
}

function addBoundaryCandidate(
  candidates: SurfaceCollision[],
  start: Vec2,
  primaryDelta: number,
  secondaryDelta: number,
  side: ArenaBoundarySide,
  boundary: number,
  primaryStart: number,
  crossesBoundary: boolean,
): void {
  if (!crossesBoundary || Math.abs(primaryDelta) <= MOTION_EPSILON) return;
  const t = (boundary - primaryStart) / primaryDelta;
  const horizontal = side === "left" || side === "right";
  candidates.push({
    t,
    position: horizontal
      ? { x: boundary, y: start.y + secondaryDelta * t }
      : { x: start.x + secondaryDelta * t, y: boundary },
    normal:
      side === "left"
        ? { x: 1, y: 0 }
        : side === "right"
          ? { x: -1, y: 0 }
          : side === "top"
            ? { x: 0, y: 1 }
            : { x: 0, y: -1 },
    surface: { kind: "arenaBoundary", side },
  });
}

function sweepCircleAgainstRect(
  start: Vec2,
  end: Vec2,
  radius: number,
  obstacle: Obstacle,
): Omit<SurfaceCollision, "surface"> | null {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const left = obstacle.x;
  const right = obstacle.x + obstacle.width;
  const top = obstacle.y;
  const bottom = obstacle.y + obstacle.height;
  const closest = {
    x: clamp(start.x, left, right),
    y: clamp(start.y, top, bottom),
  };
  const overlapX = start.x - closest.x;
  const overlapY = start.y - closest.y;
  const overlapDistance = Math.hypot(overlapX, overlapY);
  if (overlapDistance <= radius + MOTION_EPSILON) {
    return {
      t: 0,
      position: { ...start },
      normal:
        overlapDistance > MOTION_EPSILON
          ? { x: overlapX / overlapDistance, y: overlapY / overlapDistance }
          : getNearestRectFaceNormal(start, obstacle),
    };
  }

  const candidates: Array<Omit<SurfaceCollision, "surface">> = [];
  if (dx > MOTION_EPSILON) {
    addRectFaceCandidate(candidates, start, dx, dy, "x", left - radius, top, bottom, {
      x: -1,
      y: 0,
    });
  } else if (dx < -MOTION_EPSILON) {
    addRectFaceCandidate(candidates, start, dx, dy, "x", right + radius, top, bottom, {
      x: 1,
      y: 0,
    });
  }
  if (dy > MOTION_EPSILON) {
    addRectFaceCandidate(candidates, start, dy, dx, "y", top - radius, left, right, {
      x: 0,
      y: -1,
    });
  } else if (dy < -MOTION_EPSILON) {
    addRectFaceCandidate(candidates, start, dy, dx, "y", bottom + radius, left, right, {
      x: 0,
      y: 1,
    });
  }

  addRectCornerCandidate(candidates, start, end, radius, { x: left, y: top }, "topLeft");
  addRectCornerCandidate(candidates, start, end, radius, { x: right, y: top }, "topRight");
  addRectCornerCandidate(candidates, start, end, radius, { x: left, y: bottom }, "bottomLeft");
  addRectCornerCandidate(candidates, start, end, radius, { x: right, y: bottom }, "bottomRight");

  candidates.sort((a, b) => a.t - b.t);
  return candidates[0] ?? null;
}

function addRectFaceCandidate(
  candidates: Array<Omit<SurfaceCollision, "surface">>,
  start: Vec2,
  primaryDelta: number,
  secondaryDelta: number,
  axis: "x" | "y",
  boundary: number,
  secondaryMinimum: number,
  secondaryMaximum: number,
  normal: Vec2,
): void {
  const primaryStart = axis === "x" ? start.x : start.y;
  const secondaryStart = axis === "x" ? start.y : start.x;
  const t = (boundary - primaryStart) / primaryDelta;
  if (t < -MOTION_EPSILON || t > 1 + MOTION_EPSILON) return;
  const secondary = secondaryStart + secondaryDelta * t;
  if (
    secondary < secondaryMinimum - MOTION_EPSILON ||
    secondary > secondaryMaximum + MOTION_EPSILON
  ) return;
  candidates.push({
    t: clamp(t, 0, 1),
    position:
      axis === "x"
        ? { x: boundary, y: secondary }
        : { x: secondary, y: boundary },
    normal,
  });
}

function addRectCornerCandidate(
  candidates: Array<Omit<SurfaceCollision, "surface">>,
  start: Vec2,
  end: Vec2,
  radius: number,
  corner: Vec2,
  quadrant: "topLeft" | "topRight" | "bottomLeft" | "bottomRight",
): void {
  const hit = segmentCircleFirstIntersection(
    start,
    end,
    { position: corner, radius: 0 },
    radius,
  );
  if (!hit || !isInCornerQuadrant(hit.position, corner, quadrant)) return;
  const normalX = hit.position.x - corner.x;
  const normalY = hit.position.y - corner.y;
  const normalLength = Math.hypot(normalX, normalY);
  if (normalLength <= MOTION_EPSILON) return;
  candidates.push({
    t: hit.t,
    position: hit.position,
    normal: { x: normalX / normalLength, y: normalY / normalLength },
  });
}

function isInCornerQuadrant(
  position: Vec2,
  corner: Vec2,
  quadrant: "topLeft" | "topRight" | "bottomLeft" | "bottomRight",
): boolean {
  const left = position.x <= corner.x + MOTION_EPSILON;
  const top = position.y <= corner.y + MOTION_EPSILON;
  if (quadrant === "topLeft") return left && top;
  if (quadrant === "topRight") return !left && top;
  if (quadrant === "bottomLeft") return left && !top;
  return !left && !top;
}

function getNearestRectFaceNormal(position: Vec2, obstacle: Obstacle): Vec2 {
  const distances = [
    { distance: Math.abs(position.x - obstacle.x), normal: { x: -1, y: 0 } },
    {
      distance: Math.abs(position.x - (obstacle.x + obstacle.width)),
      normal: { x: 1, y: 0 },
    },
    { distance: Math.abs(position.y - obstacle.y), normal: { x: 0, y: -1 } },
    {
      distance: Math.abs(position.y - (obstacle.y + obstacle.height)),
      normal: { x: 0, y: 1 },
    },
  ];
  distances.sort((a, b) => a.distance - b.distance);
  return distances[0]!.normal;
}

function reflectVelocity(velocity: Vec2, normal: Vec2): void {
  const length = Math.hypot(normal.x, normal.y);
  if (length <= MOTION_EPSILON) return;
  const normalX = normal.x / length;
  const normalY = normal.y / length;
  const projection = velocity.x * normalX + velocity.y * normalY;
  velocity.x -= 2 * projection * normalX;
  velocity.y -= 2 * projection * normalY;
}
