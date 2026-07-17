import type { EncounterPhase, Vec2 } from "../domain/types";
import type {
  AutoPilotCoverageSnapshot,
  AutoPilotCoverageTransitionReason,
  AutoPilotCoverageZoneId,
  AutoPilotFrame,
  AutoPilotIntentMode,
  AutoPilotNavigationPort,
  AutoPilotPatrolStrategy,
} from "./autoPilotContracts";
import {
  clamp,
  distanceBetween,
  getObstacleClearance,
  getSafeArenaEdgeClearance,
} from "./autoPilotMath";

export const AUTO_PILOT_COVERAGE_ZONE_IDS: readonly AutoPilotCoverageZoneId[] = [
  "north-west",
  "north",
  "north-east",
  "west",
  "center",
  "east",
  "south-west",
  "south",
  "south-east",
];

const COVERAGE_REFRESH_SECONDS = 1;
const COVERAGE_STALL_SECONDS = 0.9;
const COVERAGE_BLOCK_SECONDS = 2;
const UNVISITED_ZONE_AGE_SECONDS = 0;
const MINIMUM_VISIT_RADIUS = 72;
const MAXIMUM_VISIT_RADIUS = 80;

export type AutoPilotCoverageZone = {
  id: AutoPilotCoverageZoneId;
  position: Vec2;
  pathDistance: number;
  eta: number;
  visitRadius: number;
  escapeClearance: number;
  xpPickupCount: number;
};

type AutoPilotCoverageTarget = {
  zoneId: AutoPilotCoverageZoneId;
  position: Vec2;
  eta: number;
  xpPickupCount: number;
  lastDistance: number;
  lastProgressAt: number;
};

type AutoPilotCoverageMemory = {
  clock: number;
  lastElapsed: number | null;
  lastPhase: EncounterPhase | null;
  visits: Partial<Record<AutoPilotCoverageZoneId, number>>;
  blockedUntil: Partial<Record<AutoPilotCoverageZoneId, number>>;
  zones: AutoPilotCoverageZone[];
  target: AutoPilotCoverageTarget | null;
  nextRefreshAt: number;
  arenaSignature: string;
};

export type AutoPilotCoverageTracker = {
  update(
    frame: AutoPilotFrame,
    navigation: AutoPilotNavigationPort,
    strategy: AutoPilotPatrolStrategy,
    previousIntentMode: AutoPilotIntentMode | null,
  ): AutoPilotCoverageSnapshot;
  reset(): void;
};

export function createAutoPilotCoverageTracker(): AutoPilotCoverageTracker {
  let memory = createCoverageMemory();

  return {
    update(frame, navigation, strategy, previousIntentMode) {
      if (
        memory.lastElapsed !== null &&
        frame.world.state.elapsed + 0.000001 < memory.lastElapsed
      ) {
        memory = createCoverageMemory();
      }
      const transition = updateCoverageMemory(
        memory,
        frame,
        navigation,
        strategy,
        previousIntentMode,
      );
      return createCoverageSnapshot(memory, strategy, transition);
    },
    reset() {
      memory = createCoverageMemory();
    },
  };
}

export function createAutoPilotCoverageZones(
  frame: AutoPilotFrame,
  navigation: AutoPilotNavigationPort,
): AutoPilotCoverageZone[] {
  const { world, config } = frame;
  const inset = world.encounter.collapse.inset;
  const requiredClearance =
    config.player.radius + config.navigation.obstacleClearance + 6;
  const left = inset + requiredClearance;
  const right = config.arena.width - inset - requiredClearance;
  const top = inset + requiredClearance;
  const bottom = config.arena.height - inset - requiredClearance;
  if (right <= left || bottom <= top) return [];

  const cellWidth = (right - left) / 3;
  const cellHeight = (bottom - top) / 3;
  const visitRadius = clamp(
    Math.min(cellWidth, cellHeight) * 0.28,
    MINIMUM_VISIT_RADIUS,
    MAXIMUM_VISIT_RADIUS,
  );
  const speed = config.player.speed * world.runtime.playerSpeedMultiplier;
  const zones: AutoPilotCoverageZone[] = [];

  for (let index = 0; index < AUTO_PILOT_COVERAGE_ZONE_IDS.length; index += 1) {
    const row = Math.floor(index / 3);
    const column = index % 3;
    const zoneLeft = left + column * cellWidth;
    const zoneTop = top + row * cellHeight;
    const densityLeft = column === 0 ? inset : zoneLeft;
    const densityTop = row === 0 ? inset : zoneTop;
    const densityRight = column === 2
      ? config.arena.width - inset
      : zoneLeft + cellWidth;
    const densityBottom = row === 2
      ? config.arena.height - inset
      : zoneTop + cellHeight;
    const candidates = createZoneCandidates(
      zoneLeft,
      zoneTop,
      cellWidth,
      cellHeight,
    ).filter((point) =>
      getSafeArenaEdgeClearance(point, world, config) >= requiredClearance &&
      getObstacleClearance(point, world.obstacles) >= requiredClearance
    );
    candidates.sort((first, second) => {
      const clearanceDifference = getLocalClearance(second, frame) -
        getLocalClearance(first, frame);
      if (Math.abs(clearanceDifference) > 0.000001) return clearanceDifference;
      return first.x - second.x || first.y - second.y;
    });

    for (const position of candidates) {
      const path = navigation.estimatePath(
        frame,
        world.player.position,
        position,
        config.player.radius,
      );
      if (!path.reachable) continue;
      zones.push({
        id: AUTO_PILOT_COVERAGE_ZONE_IDS[index]!,
        position: { ...position },
        pathDistance: path.distance,
        eta: path.distance / Math.max(1, speed),
        visitRadius,
        escapeClearance: getLocalClearance(position, frame),
        xpPickupCount: countXpPickupsInCell(
          frame,
          densityLeft,
          densityTop,
          densityRight - densityLeft,
          densityBottom - densityTop,
        ),
      });
      break;
    }
  }

  return zones;
}

function createCoverageMemory(): AutoPilotCoverageMemory {
  return {
    clock: 0,
    lastElapsed: null,
    lastPhase: null,
    visits: {},
    blockedUntil: {},
    zones: [],
    target: null,
    nextRefreshAt: 0,
    arenaSignature: "",
  };
}

function updateCoverageMemory(
  memory: AutoPilotCoverageMemory,
  frame: AutoPilotFrame,
  navigation: AutoPilotNavigationPort,
  strategy: AutoPilotPatrolStrategy,
  previousIntentMode: AutoPilotIntentMode | null,
): AutoPilotCoverageTransitionReason {
  advanceCoverageClock(memory, frame);
  const arenaSignature = getCoverageArenaSignature(frame);
  let transition: AutoPilotCoverageTransitionReason = "none";
  if (
    arenaSignature !== memory.arenaSignature ||
    frame.world.state.elapsed >= memory.nextRefreshAt
  ) {
    const arenaChanged = memory.arenaSignature !== "" &&
      arenaSignature !== memory.arenaSignature;
    memory.zones = createAutoPilotCoverageZones(frame, navigation);
    memory.arenaSignature = arenaSignature;
    memory.nextRefreshAt = frame.world.state.elapsed + COVERAGE_REFRESH_SECONDS;
    if (arenaChanged && memory.target) transition = "arenaChanged";
    if (memory.target) {
      const refreshed = memory.zones.find((zone) => zone.id === memory.target!.zoneId);
      if (!refreshed) {
        memory.blockedUntil[memory.target.zoneId] =
          memory.clock + COVERAGE_BLOCK_SECONDS;
        memory.target = null;
        transition = "unreachable";
      } else {
        memory.target.position = { ...refreshed.position };
        memory.target.eta = refreshed.eta;
        memory.target.xpPickupCount = refreshed.xpPickupCount;
      }
    }
  }

  const reachedTarget = markVisitedZones(memory, frame.world.player.position);
  if (reachedTarget) {
    memory.target = null;
    memory.nextRefreshAt = frame.world.state.elapsed;
    transition = "reached";
  }

  if (memory.target && previousIntentMode === "patrol") {
    const distance = distanceBetween(
      frame.world.player.position,
      memory.target.position,
    );
    if (memory.target.lastDistance - distance >= 2) {
      memory.target.lastDistance = distance;
      memory.target.lastProgressAt = memory.clock;
    } else if (
      memory.clock - memory.target.lastProgressAt >= COVERAGE_STALL_SECONDS
    ) {
      memory.blockedUntil[memory.target.zoneId] =
        memory.clock + COVERAGE_BLOCK_SECONDS;
      memory.target = null;
      transition = "stalled";
    }
  } else if (memory.target) {
    memory.target.lastDistance = distanceBetween(
      frame.world.player.position,
      memory.target.position,
    );
    memory.target.lastProgressAt = memory.clock;
  }

  if (strategy === "periodic-v3") {
    if (memory.target) {
      memory.target = null;
      return "strategyDisabled";
    }
    return transition;
  }

  const phase = frame.world.encounter.director.phase;
  const canSelectTarget = phase === "pending" || phase === "recovery";
  if (!memory.target && transition === "none" && canSelectTarget) {
    const selected = selectCoverageTarget(memory);
    if (selected) {
      memory.target = {
        zoneId: selected.id,
        position: { ...selected.position },
        eta: selected.eta,
        xpPickupCount: selected.xpPickupCount,
        lastDistance: distanceBetween(
          frame.world.player.position,
          selected.position,
        ),
        lastProgressAt: memory.clock,
      };
      transition = "selected";
    }
  }
  return transition;
}

function advanceCoverageClock(
  memory: AutoPilotCoverageMemory,
  frame: AutoPilotFrame,
): void {
  const elapsed = frame.world.state.elapsed;
  if (memory.lastElapsed !== null) {
    const delta = Math.max(0, elapsed - memory.lastElapsed);
    if (memory.lastPhase === "pending" || memory.lastPhase === "recovery") {
      memory.clock += delta;
    }
  }
  memory.lastElapsed = elapsed;
  memory.lastPhase = frame.world.encounter.director.phase;
}

function markVisitedZones(
  memory: AutoPilotCoverageMemory,
  playerPosition: Vec2,
): boolean {
  let reachedTarget = false;
  for (const zone of memory.zones) {
    if (distanceBetween(playerPosition, zone.position) > zone.visitRadius) continue;
    memory.visits[zone.id] = memory.clock;
    if (memory.target?.zoneId === zone.id) reachedTarget = true;
  }
  return reachedTarget;
}

function selectCoverageTarget(
  memory: AutoPilotCoverageMemory,
): AutoPilotCoverageZone | null {
  const fieldXpCount = memory.zones.reduce(
    (total, zone) => total + zone.xpPickupCount,
    0,
  );
  const hasOlderAlternative = memory.zones.some(
    (zone) => getZoneAge(memory, zone.id) >= 3,
  );
  const hasUnvisitedZone = memory.zones.some(
    (zone) => memory.visits[zone.id] === undefined,
  );
  let selected: AutoPilotCoverageZone | null = null;
  let selectedScore = Number.NEGATIVE_INFINITY;
  for (const zone of memory.zones) {
    if ((memory.blockedUntil[zone.id] ?? 0) > memory.clock) continue;
    if (hasUnvisitedZone && memory.visits[zone.id] !== undefined) continue;
    const age = getZoneAge(memory, zone.id);
    if (hasOlderAlternative && age < 3) continue;
    const ageValue = Math.min(2.5, age / 30);
    const etaPenalty = clamp(zone.eta / 8, 0, 1) * 0.25;
    const escapeValue = clamp(zone.escapeClearance / 120, 0, 1) * 0.12;
    const densityValue = fieldXpCount > 50
      ? Math.min(1.2, zone.xpPickupCount / 8) +
        zone.xpPickupCount / Math.max(1, fieldXpCount) * 0.8
      : Math.min(0.18, zone.xpPickupCount * 0.02);
    const score = ageValue + densityValue + escapeValue - etaPenalty;
    if (
      score > selectedScore + 0.000001 ||
      Math.abs(score - selectedScore) <= 0.000001 &&
        (!selected || zone.id < selected.id)
    ) {
      selected = zone;
      selectedScore = score;
    }
  }
  return selected;
}

function createCoverageSnapshot(
  memory: AutoPilotCoverageMemory,
  strategy: AutoPilotPatrolStrategy,
  transitionReason: AutoPilotCoverageTransitionReason,
): AutoPilotCoverageSnapshot {
  const reachableZoneIds = memory.zones.map((zone) => zone.id);
  const visitedZoneIds30Seconds = reachableZoneIds.filter((zoneId) =>
    wasVisitedWithin(memory, zoneId, 30)
  );
  const visitedZoneIds120Seconds = reachableZoneIds.filter((zoneId) =>
    wasVisitedWithin(memory, zoneId, 120)
  );
  const oldestZoneAgeSeconds = reachableZoneIds.reduce(
    (oldest, zoneId) => Math.max(oldest, getZoneAge(memory, zoneId)),
    0,
  );
  return {
    strategy,
    clock: memory.clock,
    targetZoneId: memory.target?.zoneId ?? null,
    targetPosition: memory.target ? { ...memory.target.position } : null,
    targetEta: memory.target?.eta ?? null,
    targetXpPickupCount: memory.target?.xpPickupCount ?? 0,
    transitionReason,
    reachableZoneIds,
    visitedZoneIds30Seconds,
    visitedZoneIds120Seconds,
    oldestZoneAgeSeconds,
  };
}

function getZoneAge(
  memory: AutoPilotCoverageMemory,
  zoneId: AutoPilotCoverageZoneId,
): number {
  const visitedAt = memory.visits[zoneId];
  return visitedAt === undefined
    ? UNVISITED_ZONE_AGE_SECONDS + memory.clock
    : Math.max(0, memory.clock - visitedAt);
}

function wasVisitedWithin(
  memory: AutoPilotCoverageMemory,
  zoneId: AutoPilotCoverageZoneId,
  seconds: number,
): boolean {
  const visitedAt = memory.visits[zoneId];
  return visitedAt !== undefined && memory.clock - visitedAt <= seconds;
}

function createZoneCandidates(
  left: number,
  top: number,
  width: number,
  height: number,
): Vec2[] {
  const offsets: readonly [number, number][] = [
    [0, 0],
    [-0.18, 0],
    [0.18, 0],
    [0, -0.18],
    [0, 0.18],
    [-0.18, -0.18],
    [0.18, -0.18],
    [-0.18, 0.18],
    [0.18, 0.18],
  ];
  return offsets.map(([offsetX, offsetY]) => ({
    x: left + width * (0.5 + offsetX),
    y: top + height * (0.5 + offsetY),
  }));
}

function countXpPickupsInCell(
  frame: AutoPilotFrame,
  left: number,
  top: number,
  width: number,
  height: number,
): number {
  const right = left + width;
  const bottom = top + height;
  let count = 0;
  for (const pickup of frame.world.pickups) {
    if (pickup.kind !== "xp") continue;
    if (
      pickup.position.x >= left && pickup.position.x < right &&
      pickup.position.y >= top && pickup.position.y < bottom
    ) count += 1;
  }
  return count;
}

function getLocalClearance(point: Vec2, frame: AutoPilotFrame): number {
  return Math.min(
    getSafeArenaEdgeClearance(point, frame.world, frame.config),
    getObstacleClearance(point, frame.world.obstacles),
  );
}

function getCoverageArenaSignature(frame: AutoPilotFrame): string {
  return [
    frame.world.encounter.collapse.inset,
    frame.config.arena.width,
    frame.config.arena.height,
    ...frame.world.obstacles.flatMap((obstacle) => [
      obstacle.id,
      obstacle.x,
      obstacle.y,
      obstacle.width,
      obstacle.height,
    ]),
  ].join(":");
}
