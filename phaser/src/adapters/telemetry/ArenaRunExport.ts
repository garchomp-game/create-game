import { resolveSeedCategory } from "../../application/runEnvironment";
import { createRankEligibility } from "../../application/runRecords";
import {
  SIMULATION_CONFIG_VERSION,
} from "../../config/gameConfig";
import {
  APP_VERSION,
  DEFAULT_DIFFICULTY_ID,
  DEFAULT_MODE_ID,
  DEFAULT_STAGE_ID,
  RULESET_VERSION,
} from "../../config/version";
import type { RunContext, RunOrigin } from "../../domain/runRecords";
import type {
  CircleBody,
  EnemyTypeId,
  GameEvent,
  SimulationConfig,
  WorldState,
} from "../../domain/types";
import { circleRect } from "../../math/geometry";
import type { RandomStreams } from "../../math/random";
import { createRunResultSummary } from "../../simulation/resultSummary";
import { composeBuild } from "../../simulation/buildComposer";
import { getDifficultyElapsed } from "../../simulation/difficultyClock";
import { getWaveBand } from "../../simulation/waveDirector";
import type {
  ArenaObstacleContactCounts,
  ArenaPerformanceSnapshot,
  ArenaRunExport,
} from "../phaser/ArenaDebugBridge";
import type { ArenaRenderPerformanceSnapshot } from "../phaser/PhaserArenaRenderer";

export type CreateArenaRunExportInput = {
  capturedAt: string;
  buildCommit: string;
  context: RunContext | null;
  profileId: string;
  baseRunOrigin: RunOrigin;
  fixedSeed: number | null;
  runSeed: number;
  randomStreams: RandomStreams;
  runConfig: SimulationConfig;
  world: WorldState;
  performance: ArenaPerformanceSnapshot;
  renderPerformance: ArenaRenderPerformanceSnapshot;
  lastEvents: readonly GameEvent[];
};

export function createArenaRunExport(input: CreateArenaRunExportInput): ArenaRunExport {
  const { context, world } = input;
  const difficultyElapsed = getDifficultyElapsed(world);
  return {
    capturedAt: input.capturedAt,
    game: "arena-core-phaser",
    appVersion: APP_VERSION,
    rulesetVersion: RULESET_VERSION,
    configVersion: SIMULATION_CONFIG_VERSION,
    buildCommit: input.buildCommit,
    runId: context?.id ?? "unknown",
    profileId: context?.profileId ?? input.profileId,
    modeId: context?.modeId ?? DEFAULT_MODE_ID,
    stageId: context?.stageId ?? DEFAULT_STAGE_ID,
    difficultyId: context?.difficultyId ?? DEFAULT_DIFFICULTY_ID,
    runOrigin: context?.runOrigin ?? input.baseRunOrigin,
    rankEligibility: context?.rankEligibility ?? createRankEligibility(input.baseRunOrigin),
    seed: input.runSeed,
    seedCategory: context?.seedCategory ?? resolveSeedCategory(input.fixedSeed),
    randomStreams: {
      version: input.randomStreams.version,
      rootSeed: input.randomStreams.rootSeed,
      seeds: { ...input.randomStreams.seeds },
    },
    status: world.state.status,
    performance: { ...input.performance },
    renderPerformance: structuredClone(input.renderPerformance),
    elapsed: world.state.elapsed,
    difficultyElapsed,
    wave: { ...getWaveBand(input.runConfig, difficultyElapsed) },
    resultSummary: createRunResultSummary(world, input.runConfig),
    stats: copyRunStats(world),
    counts: {
      bullets: world.bullets.length,
      enemies: world.enemies.length,
      enemyTypes: getArenaEnemyTypeCounts(world),
      enemyProjectiles: world.enemyProjectiles.length,
      pickups: world.pickups.length,
      obstacleContacts: getArenaObstacleContactCounts(world),
    },
    player: { ...world.player.position },
    lastAim: { ...world.state.lastAim },
    buildCompletedAt: world.progression.buildCompletedAt,
    extraLevel: world.progression.extraLevel,
    extraCycle: world.progression.extraCycle,
    pendingUpgradeChoices: [...world.progression.pendingUpgradeChoices],
    upgradeRanks: { ...world.progression.upgradeRanks },
    extraUpgradeRanks: { ...world.progression.extraUpgradeRanks },
    extraCycleRemaining: [...world.progression.extraCycleRemaining],
    runtime: { ...world.runtime },
    buildComposition: composeBuild(
      input.runConfig,
      world.state.weaponType,
      world.progression.upgradeRanks,
      [],
      world.progression.extraUpgradeRanks,
    ),
    encounter: structuredClone(world.encounter),
    expedition: world.expedition ? structuredClone(world.expedition) : null,
    lastEvents: input.lastEvents.map((event) => structuredClone(event)),
  };
}

export function getArenaEnemyTypeCounts(world: WorldState): Record<EnemyTypeId, number> {
  return world.enemies.reduce(
    (counts, enemy) => {
      counts[enemy.typeId] += 1;
      return counts;
    },
    { chaser: 0, brute: 0, fast: 0, ranged: 0 },
  );
}

export function getArenaObstacleContactCounts(world: WorldState): ArenaObstacleContactCounts {
  return {
    player: countObstacleContacts(world, [world.player]),
    enemies: countObstacleContacts(world, world.enemies),
    bullets: countObstacleContacts(world, world.bullets),
    enemyProjectiles: countObstacleContacts(world, world.enemyProjectiles),
    pickups: countObstacleContacts(world, world.pickups),
  };
}

export function copyRunStats(world: WorldState): WorldState["stats"] {
  return structuredClone(world.stats);
}

function countObstacleContacts(world: WorldState, bodies: CircleBody[]): number {
  return bodies.reduce(
    (count, body) =>
      count + (world.obstacles.some((obstacle) => circleRect(body, obstacle)) ? 1 : 0),
    0,
  );
}
