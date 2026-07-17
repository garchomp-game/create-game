import type { ArenaDefinition, ObstacleDefinition } from "./gameContent";
import type { EncounterDirection } from "./encounterDirector";
import type { RandomSource, Vec2 } from "./types";

export const SPAWN_GEOMETRY_IDS = [
  "perimeter-random",
  "arc",
  "pincer",
  "escort",
] as const;

export type SpawnGeometryId = (typeof SPAWN_GEOMETRY_IDS)[number];

export type StructuredSpawnRole = "standard" | "leader" | "escort";

export type SpawnSafetyRejectionReason =
  | "enemyCap"
  | "insideArena"
  | "outsideActiveArea"
  | "insufficientTelegraph"
  | "playerDistance"
  | "obstacle"
  | "unreachable"
  | "overlap";

export type StructuredSpawnRequest = {
  geometryId: SpawnGeometryId;
  fallbackGeometryId?: SpawnGeometryId;
  direction: EncounterDirection;
  count: number;
  arena: ArenaDefinition;
  obstacles: readonly ObstacleDefinition[];
  playerPosition: Vec2;
  enemyRadius: number;
  minimumPlayerDistance: number;
  spawnMargin: number;
  collapseInset: number;
  existingEnemyCount: number;
  maximumEnemies: number;
  telegraphStartedAt: number;
  spawnAt: number;
  isReachable?: (entryPoint: Vec2, radius: number) => boolean;
};

export type StructuredSpawnPlacement = {
  position: Vec2;
  entryPoint: Vec2;
  direction: EncounterDirection;
  role: StructuredSpawnRole;
  slot: number;
};

export type StructuredSpawnTelegraph = {
  directions: EncounterDirection[];
  startedAt: number;
  spawnAt: number;
  leadSeconds: number;
};

export type StructuredSpawnMetrics = {
  requestedCount: number;
  capacity: number;
  candidateCount: number;
  acceptedCount: number;
  fallbackUsed: boolean;
  rejectedByReason: Record<SpawnSafetyRejectionReason, number>;
};

export type StructuredSpawnPlan = {
  status: "ready" | "deferred";
  geometryId: SpawnGeometryId;
  placements: StructuredSpawnPlacement[];
  telegraph: StructuredSpawnTelegraph;
  metrics: StructuredSpawnMetrics;
  deferReason: SpawnSafetyRejectionReason | "noSafeCandidate" | null;
};

export type StructuredSpawnRandom = RandomSource;
