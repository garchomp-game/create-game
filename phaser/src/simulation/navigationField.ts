import Dijkstra from "rot-js/lib/path/dijkstra.js";
import type { Enemy, Obstacle, SimulationConfig, Vec2, WorldState } from "../domain/types";
import { normalize } from "../math/vector";

export type EnemyNavigationMode = "direct" | "path" | "fallback";

export type EnemyNavigationResult = {
  direction: Vec2;
  mode: EnemyNavigationMode;
  fieldBuilt: boolean;
};

export type PointNavigationPath = {
  reachable: boolean;
  direct: boolean;
  distance: number;
  waypoints: Vec2[];
};

type GridCell = { x: number; y: number };

type NavigationField = {
  columns: number;
  rows: number;
  pathfinder: Dijkstra;
  pathCache: Map<string, GridCell[]>;
  waypointCache: Map<string, Vec2 | null>;
  isWalkable(cell: GridCell): boolean;
};

type NavigationCache = {
  config: SimulationConfig;
  obstacles: readonly Obstacle[];
  targets: Map<string, Map<string, NavigationField>>;
};

const navigationCaches = new WeakMap<WorldState, NavigationCache>();
const MAX_CACHED_TARGETS = 64;

export function getEnemyApproachNavigation(
  world: WorldState,
  enemy: Enemy,
  config: SimulationConfig,
): EnemyNavigationResult {
  const target = world.player.position;
  const directDirection = normalize(
    target.x - enemy.position.x,
    target.y - enemy.position.y,
  );
  if (
    !config.features.enemyNavigation ||
    !enemy.enteredArena ||
    hasClearNavigationPath(
      enemy.position,
      target,
      enemy.radius,
      world.obstacles,
    )
  ) {
    return { direction: directDirection, mode: "direct", fieldBuilt: false };
  }

  return getBlockedPointNavigation(
    world,
    enemy.position,
    target,
    enemy.radius,
    config,
  );
}

export function getPointNavigation(
  world: WorldState,
  startPosition: Vec2,
  targetPosition: Vec2,
  radius: number,
  config: SimulationConfig,
): EnemyNavigationResult {
  const directDirection = normalize(
    targetPosition.x - startPosition.x,
    targetPosition.y - startPosition.y,
  );
  if (
    hasClearNavigationPath(
      startPosition,
      targetPosition,
      radius,
      world.obstacles,
    )
  ) {
    return { direction: directDirection, mode: "direct", fieldBuilt: false };
  }

  return getBlockedPointNavigation(
    world,
    startPosition,
    targetPosition,
    radius,
    config,
  );
}

export function estimatePointNavigationPath(
  world: WorldState,
  startPosition: Vec2,
  targetPosition: Vec2,
  radius: number,
  config: SimulationConfig,
): PointNavigationPath {
  const clearance = radius + config.navigation.obstacleClearance;
  if (
    hasClearNavigationPath(
      startPosition,
      targetPosition,
      clearance,
      world.obstacles,
    )
  ) {
    return {
      reachable: true,
      direct: true,
      distance: Math.hypot(
        targetPosition.x - startPosition.x,
        targetPosition.y - startPosition.y,
      ),
      waypoints: [{ ...startPosition }, { ...targetPosition }],
    };
  }

  const { field } = getNavigationField(world, radius, targetPosition, config);
  const start = findNearestWalkableCell(toGridCell(startPosition, config), field);
  if (!start) return createUnreachablePath(startPosition);
  const cells = getPath(field, start);
  if (cells.length === 0) return createUnreachablePath(startPosition);

  const rawWaypoints = [
    { ...startPosition },
    ...cells.slice(1).map((cell) => gridCellCenter(cell, config)),
  ];
  const finalWaypoint = rawWaypoints.at(-1) ?? startPosition;
  if (
    hasClearNavigationPath(
      finalWaypoint,
      targetPosition,
      clearance,
      world.obstacles,
    )
  ) {
    rawWaypoints.push({ ...targetPosition });
  }
  const waypoints = simplifyPath(
    rawWaypoints,
    clearance,
    world.obstacles,
  );
  return {
    reachable: waypoints.length >= 2,
    direct: false,
    distance: getPathDistance(waypoints),
    waypoints,
  };
}

function getBlockedPointNavigation(
  world: WorldState,
  startPosition: Vec2,
  targetPosition: Vec2,
  radius: number,
  config: SimulationConfig,
): EnemyNavigationResult {
  const directDirection = normalize(
    targetPosition.x - startPosition.x,
    targetPosition.y - startPosition.y,
  );
  const { field, built } = getNavigationField(
    world,
    radius,
    targetPosition,
    config,
  );
  const start = findNearestWalkableCell(toGridCell(startPosition, config), field);
  if (!start) {
    return { direction: directDirection, mode: "fallback", fieldBuilt: built };
  }

  const waypoint = getWaypoint(
    field,
    start,
    startPosition,
    radius,
    world.obstacles,
    config,
  );
  if (!waypoint) {
    return { direction: directDirection, mode: "fallback", fieldBuilt: built };
  }

  return {
    direction: normalize(
      waypoint.x - startPosition.x,
      waypoint.y - startPosition.y,
    ),
    mode: "path",
    fieldBuilt: built,
  };
}

export function hasClearNavigationPath(
  start: Vec2,
  end: Vec2,
  clearance: number,
  obstacles: readonly Obstacle[],
): boolean {
  return obstacles.every(
    (obstacle) => !segmentCrossesExpandedObstacle(start, end, clearance, obstacle),
  );
}

function getNavigationField(
  world: WorldState,
  radius: number,
  targetPosition: Vec2,
  config: SimulationConfig,
): { field: NavigationField; built: boolean } {
  let cache = navigationCaches.get(world);
  if (
    !cache ||
    cache.config !== config ||
    cache.obstacles !== world.obstacles
  ) {
    cache = {
      config,
      obstacles: world.obstacles,
      targets: new Map(),
    };
    navigationCaches.set(world, cache);
  }

  const targetCell = toGridCell(targetPosition, config);
  const targetKey = gridCellKey(targetCell);
  let fields = cache.targets.get(targetKey);
  if (!fields) {
    fields = new Map();
    cache.targets.set(targetKey, fields);
    if (cache.targets.size > MAX_CACHED_TARGETS) {
      cache.targets.delete(cache.targets.keys().next().value!);
    }
  } else {
    cache.targets.delete(targetKey);
    cache.targets.set(targetKey, fields);
  }

  const radiusKey = radius.toFixed(3);
  const existing = fields.get(radiusKey);
  if (existing) return { field: existing, built: false };

  const field = createNavigationField(world, radius, targetPosition, config);
  fields.set(radiusKey, field);
  return { field, built: true };
}

function createNavigationField(
  world: WorldState,
  radius: number,
  targetPosition: Vec2,
  config: SimulationConfig,
): NavigationField {
  const columns = Math.ceil(config.arena.width / config.navigation.cellSize);
  const rows = Math.ceil(config.arena.height / config.navigation.cellSize);
  const clearance = radius + config.navigation.obstacleClearance;
  const isWalkable = (cell: GridCell): boolean =>
    isCellInBounds(cell, columns, rows) &&
    isPointWalkable(
      gridCellCenter(cell, config),
      clearance,
      world.obstacles,
      config,
    );
  const target =
    findNearestWalkableCell(
      toGridCell(targetPosition, config),
      { columns, rows, isWalkable },
    ) ?? toGridCell(targetPosition, config);
  const pathfinder = new Dijkstra(
    target.x,
    target.y,
    (x, y) => isWalkable({ x, y }),
    { topology: 4 },
  );

  return {
    columns,
    rows,
    pathfinder,
    pathCache: new Map(),
    waypointCache: new Map(),
    isWalkable,
  };
}

function getWaypoint(
  field: NavigationField,
  startCell: GridCell,
  startPosition: Vec2,
  clearance: number,
  obstacles: readonly Obstacle[],
  config: SimulationConfig,
): Vec2 | null {
  const key = gridCellKey(startCell);
  let waypoint = field.waypointCache.get(key);
  if (waypoint === undefined) {
    waypoint = findVisibleWaypoint(
      gridCellCenter(startCell, config),
      getPath(field, startCell),
      clearance,
      obstacles,
      config,
    );
    field.waypointCache.set(key, waypoint);
  }
  if (
    waypoint &&
    hasClearNavigationPath(startPosition, waypoint, clearance, obstacles)
  ) {
    return waypoint;
  }
  return findVisibleWaypoint(
    startPosition,
    getPath(field, startCell),
    clearance,
    obstacles,
    config,
  );
}

function getPath(field: NavigationField, start: GridCell): GridCell[] {
  const key = gridCellKey(start);
  const cached = field.pathCache.get(key);
  if (cached) return cached;

  const path: GridCell[] = [];
  field.pathfinder.compute(start.x, start.y, (x, y) => path.push({ x, y }));
  field.pathCache.set(key, path);
  return path;
}

function findVisibleWaypoint(
  start: Vec2,
  path: readonly GridCell[],
  clearance: number,
  obstacles: readonly Obstacle[],
  config: SimulationConfig,
): Vec2 | null {
  for (let index = path.length - 1; index >= 1; index -= 1) {
    const waypoint = gridCellCenter(path[index]!, config);
    if (hasClearNavigationPath(start, waypoint, clearance, obstacles)) return waypoint;
  }
  if (path.length > 0) {
    const currentCellCenter = gridCellCenter(path[0]!, config);
    if (
      Math.hypot(currentCellCenter.x - start.x, currentCellCenter.y - start.y) > 0.5 &&
      hasClearNavigationPath(start, currentCellCenter, clearance, obstacles)
    ) {
      return currentCellCenter;
    }
  }
  return null;
}

function simplifyPath(
  path: readonly Vec2[],
  clearance: number,
  obstacles: readonly Obstacle[],
): Vec2[] {
  if (path.length <= 2) return path.map((point) => ({ ...point }));
  const simplified: Vec2[] = [{ ...path[0]! }];
  let currentIndex = 0;
  while (currentIndex < path.length - 1) {
    let nextIndex = path.length - 1;
    while (
      nextIndex > currentIndex + 1 &&
      !hasClearNavigationPath(
        path[currentIndex]!,
        path[nextIndex]!,
        clearance,
        obstacles,
      )
    ) {
      nextIndex -= 1;
    }
    simplified.push({ ...path[nextIndex]! });
    currentIndex = nextIndex;
  }
  return simplified;
}

function getPathDistance(path: readonly Vec2[]): number {
  let distance = 0;
  for (let index = 1; index < path.length; index += 1) {
    distance += Math.hypot(
      path[index]!.x - path[index - 1]!.x,
      path[index]!.y - path[index - 1]!.y,
    );
  }
  return distance;
}

function createUnreachablePath(startPosition: Vec2): PointNavigationPath {
  return {
    reachable: false,
    direct: false,
    distance: Number.POSITIVE_INFINITY,
    waypoints: [{ ...startPosition }],
  };
}

function findNearestWalkableCell(
  origin: GridCell,
  field: Pick<NavigationField, "columns" | "rows" | "isWalkable">,
): GridCell | null {
  const clamped = {
    x: Math.max(0, Math.min(field.columns - 1, origin.x)),
    y: Math.max(0, Math.min(field.rows - 1, origin.y)),
  };
  const maximumRadius = Math.max(field.columns, field.rows);
  for (let radius = 0; radius <= maximumRadius; radius += 1) {
    for (let y = clamped.y - radius; y <= clamped.y + radius; y += 1) {
      for (let x = clamped.x - radius; x <= clamped.x + radius; x += 1) {
        if (
          Math.max(Math.abs(x - clamped.x), Math.abs(y - clamped.y)) !== radius
        ) continue;
        const candidate = { x, y };
        if (field.isWalkable(candidate)) return candidate;
      }
    }
  }
  return null;
}

function toGridCell(position: Vec2, config: SimulationConfig): GridCell {
  return {
    x: Math.floor(position.x / config.navigation.cellSize),
    y: Math.floor(position.y / config.navigation.cellSize),
  };
}

function gridCellCenter(cell: GridCell, config: SimulationConfig): Vec2 {
  return {
    x: (cell.x + 0.5) * config.navigation.cellSize,
    y: (cell.y + 0.5) * config.navigation.cellSize,
  };
}

function isCellInBounds(cell: GridCell, columns: number, rows: number): boolean {
  return cell.x >= 0 && cell.x < columns && cell.y >= 0 && cell.y < rows;
}

function isPointWalkable(
  point: Vec2,
  clearance: number,
  obstacles: readonly Obstacle[],
  config: SimulationConfig,
): boolean {
  if (
    point.x < clearance ||
    point.x > config.arena.width - clearance ||
    point.y < clearance ||
    point.y > config.arena.height - clearance
  ) return false;

  return obstacles.every((obstacle) => {
    const closestX = Math.max(obstacle.x, Math.min(obstacle.x + obstacle.width, point.x));
    const closestY = Math.max(obstacle.y, Math.min(obstacle.y + obstacle.height, point.y));
    const dx = point.x - closestX;
    const dy = point.y - closestY;
    return dx * dx + dy * dy >= clearance * clearance;
  });
}

function segmentCrossesExpandedObstacle(
  start: Vec2,
  end: Vec2,
  clearance: number,
  obstacle: Obstacle,
): boolean {
  const tangentTolerance = 0.001;
  const expandedMinX = obstacle.x - clearance + tangentTolerance;
  const expandedMaxX = obstacle.x + obstacle.width + clearance - tangentTolerance;
  const expandedMinY = obstacle.y - clearance + tangentTolerance;
  const expandedMaxY = obstacle.y + obstacle.height + clearance - tangentTolerance;
  if (
    Math.max(start.x, end.x) < expandedMinX ||
    Math.min(start.x, end.x) > expandedMaxX ||
    Math.max(start.y, end.y) < expandedMinY ||
    Math.min(start.y, end.y) > expandedMaxY
  ) {
    return false;
  }

  if (segmentIntersectsObstacle(start, end, obstacle, tangentTolerance)) return true;

  const minimumDistanceSquared = Math.min(
    pointRectDistanceSquared(start, obstacle),
    pointRectDistanceSquared(end, obstacle),
    pointSegmentDistanceSquared(
      { x: obstacle.x, y: obstacle.y },
      start,
      end,
    ),
    pointSegmentDistanceSquared(
      { x: obstacle.x + obstacle.width, y: obstacle.y },
      start,
      end,
    ),
    pointSegmentDistanceSquared(
      { x: obstacle.x, y: obstacle.y + obstacle.height },
      start,
      end,
    ),
    pointSegmentDistanceSquared(
      { x: obstacle.x + obstacle.width, y: obstacle.y + obstacle.height },
      start,
      end,
    ),
  );
  const collisionClearance = Math.max(0, clearance - tangentTolerance);
  return minimumDistanceSquared < collisionClearance * collisionClearance;
}

function segmentIntersectsObstacle(
  start: Vec2,
  end: Vec2,
  obstacle: Obstacle,
  tolerance: number,
): boolean {
  const minX = obstacle.x + tolerance;
  const maxX = obstacle.x + obstacle.width - tolerance;
  const minY = obstacle.y + tolerance;
  const maxY = obstacle.y + obstacle.height - tolerance;
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  let enter = 0;
  let exit = 1;

  const xInterval = clipSegmentAxis(start.x, dx, minX, maxX, enter, exit);
  if (!xInterval) return false;
  enter = xInterval.enter;
  exit = xInterval.exit;
  const yInterval = clipSegmentAxis(start.y, dy, minY, maxY, enter, exit);
  if (!yInterval) return false;

  return yInterval.exit > 0.000001 && yInterval.enter < 0.999999;
}

function pointRectDistanceSquared(point: Vec2, obstacle: Obstacle): number {
  const closestX = Math.max(obstacle.x, Math.min(obstacle.x + obstacle.width, point.x));
  const closestY = Math.max(obstacle.y, Math.min(obstacle.y + obstacle.height, point.y));
  const dx = point.x - closestX;
  const dy = point.y - closestY;
  return dx * dx + dy * dy;
}

function pointSegmentDistanceSquared(point: Vec2, start: Vec2, end: Vec2): number {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const lengthSquared = dx * dx + dy * dy;
  if (lengthSquared < 0.000001) {
    const pointDx = point.x - start.x;
    const pointDy = point.y - start.y;
    return pointDx * pointDx + pointDy * pointDy;
  }
  const projection = Math.max(
    0,
    Math.min(1, ((point.x - start.x) * dx + (point.y - start.y) * dy) / lengthSquared),
  );
  const closestX = start.x + projection * dx;
  const closestY = start.y + projection * dy;
  const pointDx = point.x - closestX;
  const pointDy = point.y - closestY;
  return pointDx * pointDx + pointDy * pointDy;
}

function clipSegmentAxis(
  start: number,
  delta: number,
  minimum: number,
  maximum: number,
  enter: number,
  exit: number,
): { enter: number; exit: number } | null {
  if (Math.abs(delta) < 0.000001) {
    return start >= minimum && start <= maximum ? { enter, exit } : null;
  }
  const first = (minimum - start) / delta;
  const second = (maximum - start) / delta;
  const axisEnter = Math.min(first, second);
  const axisExit = Math.max(first, second);
  const nextEnter = Math.max(enter, axisEnter);
  const nextExit = Math.min(exit, axisExit);
  return nextEnter <= nextExit ? { enter: nextEnter, exit: nextExit } : null;
}

function gridCellKey(cell: GridCell): string {
  return `${cell.x},${cell.y}`;
}
