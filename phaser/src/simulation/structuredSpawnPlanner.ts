import type { EncounterDirection } from "../domain/encounterDirector";
import type {
  SpawnGeometryId,
  SpawnSafetyRejectionReason,
  StructuredSpawnMetrics,
  StructuredSpawnPlacement,
  StructuredSpawnPlan,
  StructuredSpawnRandom,
  StructuredSpawnRequest,
  StructuredSpawnRole,
} from "../domain/structuredSpawning";
import type { Obstacle, Vec2 } from "../domain/types";

const DIRECTION_ORDER: EncounterDirection[] = ["north", "east", "south", "west"];
const CANDIDATES_PER_SLOT = 6;
const MINIMUM_TELEGRAPH_SECONDS = 0.6;

type SpawnCandidate = StructuredSpawnPlacement;

export function planStructuredSpawn(
  request: StructuredSpawnRequest,
  random: StructuredSpawnRandom,
): StructuredSpawnPlan {
  const capacity = Math.max(
    0,
    Math.min(request.count, request.maximumEnemies - request.existingEnemyCount),
  );
  const metrics = createMetrics(request.count, capacity);
  const telegraph = {
    directions: getGeometryDirections(request.geometryId, request.direction),
    startedAt: request.telegraphStartedAt,
    spawnAt: request.spawnAt,
    leadSeconds: Math.max(0, request.spawnAt - request.telegraphStartedAt),
  };

  if (telegraph.leadSeconds < MINIMUM_TELEGRAPH_SECONDS) {
    metrics.rejectedByReason.insufficientTelegraph = request.count;
    return deferredPlan(
      request.geometryId,
      telegraph,
      metrics,
      "insufficientTelegraph",
    );
  }

  if (capacity === 0) {
    metrics.rejectedByReason.enemyCap = request.count;
    return deferredPlan(request.geometryId, telegraph, metrics, "enemyCap");
  }

  let placements = collectSafePlacements(
    request,
    request.geometryId,
    capacity,
    random,
    metrics,
  );
  let geometryId = request.geometryId;

  if (placements.length === 0 && request.fallbackGeometryId) {
    metrics.fallbackUsed = true;
    geometryId = request.fallbackGeometryId;
    const fallbackRequest = {
      ...request,
      direction: rotateDirection(request.direction, 1),
    };
    placements = collectSafePlacements(
      fallbackRequest,
      geometryId,
      capacity,
      random,
      metrics,
    );
    telegraph.directions = getGeometryDirections(geometryId, fallbackRequest.direction);
  }

  if (placements.length === 0) {
    return deferredPlan(geometryId, telegraph, metrics, "noSafeCandidate");
  }

  metrics.acceptedCount = placements.length;
  return {
    status: "ready",
    geometryId,
    placements,
    telegraph,
    metrics,
    deferReason: null,
  };
}

export function getGeometryDirections(
  geometryId: SpawnGeometryId,
  direction: EncounterDirection,
): EncounterDirection[] {
  if (geometryId !== "pincer") return [direction];
  return [direction, oppositeDirection(direction)];
}

export function hasTelegraphLeadTime(plan: StructuredSpawnPlan): boolean {
  return plan.telegraph.leadSeconds >= MINIMUM_TELEGRAPH_SECONDS;
}

function collectSafePlacements(
  request: StructuredSpawnRequest,
  geometryId: SpawnGeometryId,
  capacity: number,
  random: StructuredSpawnRandom,
  metrics: StructuredSpawnMetrics,
): StructuredSpawnPlacement[] {
  const placements: StructuredSpawnPlacement[] = [];
  const candidateCount = Math.max(12, capacity * CANDIDATES_PER_SLOT);
  const phase = random();

  for (let index = 0; index < candidateCount && placements.length < capacity; index += 1) {
    const candidate = createCandidate(
      request,
      geometryId,
      index,
      candidateCount,
      phase,
      placements.length,
      random,
    );
    metrics.candidateCount += 1;
    const rejection = getRejectionReason(request, candidate, placements);
    if (rejection) {
      metrics.rejectedByReason[rejection] += 1;
      continue;
    }
    placements.push(candidate);
  }

  return placements;
}

function createCandidate(
  request: StructuredSpawnRequest,
  geometryId: SpawnGeometryId,
  candidateIndex: number,
  candidateCount: number,
  phase: number,
  acceptedIndex: number,
  random: StructuredSpawnRandom,
): SpawnCandidate {
  const directions = getGeometryDirections(geometryId, request.direction);
  const direction = directions[candidateIndex % directions.length]!;
  const laneIndex = Math.floor(candidateIndex / directions.length);
  const laneCount = Math.ceil(candidateCount / directions.length);
  const normalized = getLanePosition(geometryId, laneIndex, laneCount, phase, random);
  const edgePoint = pointOnEdge(request, direction, normalized);

  return {
    position: spawnPointOutsideArena(request, direction, edgePoint),
    entryPoint: entryPointInsideActiveArea(request, direction, edgePoint),
    direction,
    role: getRole(geometryId, acceptedIndex),
    slot: acceptedIndex,
  };
}

function getLanePosition(
  geometryId: SpawnGeometryId,
  index: number,
  count: number,
  phase: number,
  random: StructuredSpawnRandom,
): number {
  const centered = count <= 1 ? 0.5 : index / (count - 1);
  if (geometryId === "arc") return clamp01(0.2 + ((centered + phase) % 1) * 0.6);
  if (geometryId === "pincer") return clamp01(0.28 + ((centered + phase * 0.5) % 1) * 0.44);
  if (geometryId === "escort") {
    const escortOffsets = [0, -0.14, 0.14, -0.28, 0.28, -0.42, 0.42];
    return clamp01(0.5 + (escortOffsets[index % escortOffsets.length] ?? 0));
  }
  return clamp01((centered + phase + random() * 0.12) % 1);
}

function getRole(geometryId: SpawnGeometryId, acceptedIndex: number): StructuredSpawnRole {
  if (geometryId !== "escort") return "standard";
  return acceptedIndex === 0 ? "leader" : "escort";
}

function pointOnEdge(
  request: StructuredSpawnRequest,
  direction: EncounterDirection,
  normalized: number,
): Vec2 {
  const { width, height } = request.arena;
  if (direction === "north" || direction === "south") {
    return { x: normalized * width, y: direction === "north" ? 0 : height };
  }
  return { x: direction === "west" ? 0 : width, y: normalized * height };
}

function spawnPointOutsideArena(
  request: StructuredSpawnRequest,
  direction: EncounterDirection,
  edgePoint: Vec2,
): Vec2 {
  const distance = request.spawnMargin + request.enemyRadius;
  if (direction === "north") return { x: edgePoint.x, y: -distance };
  if (direction === "south") return { x: edgePoint.x, y: request.arena.height + distance };
  if (direction === "west") return { x: -distance, y: edgePoint.y };
  return { x: request.arena.width + distance, y: edgePoint.y };
}

function entryPointInsideActiveArea(
  request: StructuredSpawnRequest,
  direction: EncounterDirection,
  edgePoint: Vec2,
): Vec2 {
  const inset = request.collapseInset + request.enemyRadius;
  const minX = inset;
  const maxX = request.arena.width - inset;
  const minY = inset;
  const maxY = request.arena.height - inset;
  return {
    x:
      direction === "west"
        ? minX
        : direction === "east"
          ? maxX
          : clamp(edgePoint.x, minX, maxX),
    y:
      direction === "north"
        ? minY
        : direction === "south"
          ? maxY
          : clamp(edgePoint.y, minY, maxY),
  };
}

function getRejectionReason(
  request: StructuredSpawnRequest,
  candidate: SpawnCandidate,
  accepted: readonly StructuredSpawnPlacement[],
): Exclude<SpawnSafetyRejectionReason, "enemyCap"> | null {
  if (isInsideArena(candidate.position, request.arena.width, request.arena.height)) {
    return "insideArena";
  }
  if (!isInsideActiveArea(candidate.entryPoint, request)) return "outsideActiveArea";
  if (distance(candidate.entryPoint, request.playerPosition) < request.minimumPlayerDistance) {
    return "playerDistance";
  }
  if (
    request.obstacles.some(
      (obstacle) =>
        circleIntersectsRect(candidate.entryPoint, request.enemyRadius, obstacle) ||
        segmentIntersectsExpandedRect(
          candidate.position,
          candidate.entryPoint,
          request.enemyRadius,
          obstacle,
        ),
    )
  ) {
    return "obstacle";
  }
  if (request.isReachable && !request.isReachable(candidate.entryPoint, request.enemyRadius)) {
    return "unreachable";
  }
  const minimumSeparation = request.enemyRadius * 2 + 6;
  if (
    accepted.some(
      (placement) => distance(placement.position, candidate.position) < minimumSeparation,
    )
  ) {
    return "overlap";
  }
  return null;
}

function isInsideActiveArea(point: Vec2, request: StructuredSpawnRequest): boolean {
  const inset = request.collapseInset + request.enemyRadius;
  return (
    point.x >= inset &&
    point.x <= request.arena.width - inset &&
    point.y >= inset &&
    point.y <= request.arena.height - inset
  );
}

function isInsideArena(point: Vec2, width: number, height: number): boolean {
  return point.x >= 0 && point.x <= width && point.y >= 0 && point.y <= height;
}

function circleIntersectsRect(point: Vec2, radius: number, obstacle: Obstacle): boolean {
  const closestX = clamp(point.x, obstacle.x, obstacle.x + obstacle.width);
  const closestY = clamp(point.y, obstacle.y, obstacle.y + obstacle.height);
  const dx = point.x - closestX;
  const dy = point.y - closestY;
  return dx * dx + dy * dy < radius * radius;
}

function segmentIntersectsExpandedRect(
  start: Vec2,
  end: Vec2,
  radius: number,
  obstacle: Obstacle,
): boolean {
  const minX = obstacle.x - radius;
  const maxX = obstacle.x + obstacle.width + radius;
  const minY = obstacle.y - radius;
  const maxY = obstacle.y + obstacle.height + radius;
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  let near = 0;
  let far = 1;

  for (const [origin, delta, minimum, maximum] of [
    [start.x, dx, minX, maxX],
    [start.y, dy, minY, maxY],
  ] as const) {
    if (Math.abs(delta) < 1e-9) {
      if (origin < minimum || origin > maximum) return false;
      continue;
    }
    const first = (minimum - origin) / delta;
    const second = (maximum - origin) / delta;
    near = Math.max(near, Math.min(first, second));
    far = Math.min(far, Math.max(first, second));
    if (near > far) return false;
  }
  return true;
}

function oppositeDirection(direction: EncounterDirection): EncounterDirection {
  return DIRECTION_ORDER[(DIRECTION_ORDER.indexOf(direction) + 2) % 4]!;
}

function rotateDirection(
  direction: EncounterDirection,
  clockwiseSteps: number,
): EncounterDirection {
  return DIRECTION_ORDER[
    (DIRECTION_ORDER.indexOf(direction) + clockwiseSteps) % DIRECTION_ORDER.length
  ]!;
}

function createMetrics(requestedCount: number, capacity: number): StructuredSpawnMetrics {
  return {
    requestedCount,
    capacity,
    candidateCount: 0,
    acceptedCount: 0,
    fallbackUsed: false,
    rejectedByReason: {
      enemyCap: 0,
      insideArena: 0,
      outsideActiveArea: 0,
      insufficientTelegraph: 0,
      playerDistance: 0,
      obstacle: 0,
      unreachable: 0,
      overlap: 0,
    },
  };
}

function deferredPlan(
  geometryId: SpawnGeometryId,
  telegraph: StructuredSpawnPlan["telegraph"],
  metrics: StructuredSpawnMetrics,
  deferReason: StructuredSpawnPlan["deferReason"],
): StructuredSpawnPlan {
  return {
    status: "deferred",
    geometryId,
    placements: [],
    telegraph,
    metrics,
    deferReason,
  };
}

function distance(left: Vec2, right: Vec2): number {
  return Math.hypot(left.x - right.x, left.y - right.y);
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.max(minimum, Math.min(maximum, value));
}

function clamp01(value: number): number {
  return clamp(value, 0, 1);
}
