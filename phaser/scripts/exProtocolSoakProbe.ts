import { EX_PROTOCOL_CATALOG } from "../src/content/exProtocolCatalog";
import { SIMULATION_CONFIG } from "../src/config/gameConfig";
import type {
  GameMetric,
  InputSnapshot,
  SimulationConfig,
  WeaponTypeId,
} from "../src/domain/types";
import { createAutoPilotAgent } from "../src/simulation/autoPilot";
import { getPlayerEffectiveMaxHp } from "../src/simulation/systems/playerHealthSystem";
import {
  createCompletedExProtocolProbeSession,
} from "./exProtocolBalanceProbe";
import { createExProtocolProbeInput } from "./exProtocolProbePolicy";

export type ExProtocolSoakRun = {
  variantId: "baseline" | string;
  weaponId: WeaponTypeId;
  frames: number;
  simulationSeconds: number;
  endedStatus: string;
  maximumEnemies: number;
  maximumPlayerBullets: number;
  maximumEnemyProjectiles: number;
  maximumProjectiles: number;
  maximumPickups: number;
  maximumActivationTrackers: number;
  staleActivationTrackersAfterDrain: number;
  maximumAegisCandidates: number;
  maximumAegisInterceptionCandidates: number;
  maximumCollisionResolved: number;
  maximumEventsPerFrame: number;
  eventsPerSecond: number;
  stepP95Ms: number;
  framesOver50MsRatio: number;
  violations: string[];
};

export type ExProtocolSoakReport = {
  seed: number;
  startElapsedSeconds: number;
  durationSeconds: number;
  frameRate: number;
  runs: ExProtocolSoakRun[];
  violations: string[];
};

const NEUTRAL_INPUT: InputSnapshot = {
  move: { x: 0, y: 0 },
  aimWorld: null,
  startPressed: false,
  shootHeld: false,
  restartPressed: false,
  pausePressed: false,
  quitToTitlePressed: false,
  upgradeChoicePressed: null,
  contractChoicePressed: null,
  tutorialContinuePressed: false,
  specialPressed: false,
};

export function runExProtocolSoakProbe(options: {
  seed?: number;
  startElapsedSeconds?: number;
  durationSeconds: number;
  frameRate?: number;
}): ExProtocolSoakReport {
  const seed = options.seed ?? 20260723;
  const startElapsedSeconds = options.startElapsedSeconds ?? 540;
  const frameRate = options.frameRate ?? 30;
  const baseConfig = createStressConfig();
  const runs: ExProtocolSoakRun[] = [];
  for (const weaponId of ["pulse", "spread"] as const) {
    runs.push(
      runSoakVariant({
        seed,
        startElapsedSeconds,
        durationSeconds: options.durationSeconds,
        frameRate,
        weaponId,
        protocolId: null,
        baseConfig,
      }),
    );
    for (const protocol of EX_PROTOCOL_CATALOG.protocols.filter(
      ({ weaponId: candidateWeapon }) =>
        candidateWeapon === weaponId,
    )) {
      runs.push(
        runSoakVariant({
          seed,
          startElapsedSeconds,
          durationSeconds: options.durationSeconds,
          frameRate,
          weaponId,
          protocolId: protocol.id,
          baseConfig,
        }),
      );
    }
  }
  const violations = [
    ...runs.flatMap((run) =>
      run.violations.map(
        (violation) => `${run.variantId}: ${violation}`,
      ),
    ),
    ...collectRelativePerformanceViolations(runs),
  ];
  return {
    seed,
    startElapsedSeconds,
    durationSeconds: options.durationSeconds,
    frameRate,
    runs,
    violations,
  };
}

function runSoakVariant(options: {
  seed: number;
  startElapsedSeconds: number;
  durationSeconds: number;
  frameRate: number;
  weaponId: WeaponTypeId;
  protocolId: string | null;
  baseConfig: SimulationConfig;
}): ExProtocolSoakRun {
  const { session, path } = createCompletedExProtocolProbeSession({
    seed: options.seed,
    weaponId: options.weaponId,
    protocolId: options.protocolId,
    pathIndex: 3,
    startElapsedSeconds: options.startElapsedSeconds,
    baseConfig: options.baseConfig,
  });
  const agent = createAutoPilotAgent(undefined, {
    profile: "fair",
    patrolStrategy: "visit-history-v1",
  });
  const dt = 1 / options.frameRate;
  const frameCount = Math.ceil(
    options.durationSeconds * options.frameRate,
  );
  const stepDurations: number[] = [];
  let maximumEnemies = 0;
  let maximumPlayerBullets = 0;
  let maximumEnemyProjectiles = 0;
  let maximumProjectiles = 0;
  let maximumPickups = 0;
  let maximumActivationTrackers = 0;
  let maximumAegisCandidates = 0;
  let maximumAegisInterceptionCandidates = 0;
  let maximumCollisionResolved = 0;
  let maximumEventsPerFrame = 0;
  let eventCount = 0;

  for (let frame = 0; frame < frameCount; frame += 1) {
    restoreHealth(session.world, session.config);
    const decision = agent.decide(session.world, session.config);
    const input =
      path === null
        ? decision.input
        : createExProtocolProbeInput(
            session.world,
            session.config,
            decision.input,
            path,
          );
    const startedAt = performance.now();
    const result = session.step(input, dt);
    stepDurations.push(performance.now() - startedAt);
    eventCount += result.events.length;
    maximumEventsPerFrame = Math.max(
      maximumEventsPerFrame,
      result.events.length,
    );
    maximumEnemies = Math.max(
      maximumEnemies,
      session.world.enemies.length,
    );
    maximumPlayerBullets = Math.max(
      maximumPlayerBullets,
      session.world.bullets.length,
    );
    maximumEnemyProjectiles = Math.max(
      maximumEnemyProjectiles,
      session.world.enemyProjectiles.length,
    );
    maximumProjectiles = Math.max(
      maximumProjectiles,
      session.world.bullets.length +
        session.world.enemyProjectiles.length,
    );
    maximumPickups = Math.max(
      maximumPickups,
      session.world.pickups.length,
    );
    maximumActivationTrackers = Math.max(
      maximumActivationTrackers,
      readGauge(result.metrics, "ex.protocol.activation_trackers"),
    );
    maximumAegisCandidates = Math.max(
      maximumAegisCandidates,
      readGauge(result.metrics, "ex.aegis.collision_candidates"),
    );
    maximumAegisInterceptionCandidates = Math.max(
      maximumAegisInterceptionCandidates,
      readGauge(result.metrics, "ex.aegis.interception_candidates"),
    );
    maximumCollisionResolved = Math.max(
      maximumCollisionResolved,
      readGauge(result.metrics, "ex.aegis.collision_resolved"),
    );
    if (session.world.state.status === "gameOver") break;
  }

  let staleActivationTrackersAfterDrain = 0;
  for (let frame = 0; frame < options.frameRate * 2; frame += 1) {
    restoreHealth(session.world, session.config);
    const result = session.step(NEUTRAL_INPUT, dt);
    staleActivationTrackersAfterDrain = readGauge(
      result.metrics,
      "ex.protocol.activation_trackers",
    );
  }

  const violations: string[] = [];
  checkLimit(violations, "enemies", maximumEnemies, 96);
  checkLimit(
    violations,
    "player bullets",
    maximumPlayerBullets,
    60,
  );
  checkLimit(
    violations,
    "enemy projectiles",
    maximumEnemyProjectiles,
    session.config.threat.maximumEnemyProjectiles,
  );
  checkLimit(violations, "all projectiles", maximumProjectiles, 300);
  checkLimit(violations, "pickups", maximumPickups, 2_000);
  checkLimit(
    violations,
    "activation trackers",
    maximumActivationTrackers,
    16,
  );
  checkLimit(
    violations,
    "Aegis collision candidates",
    maximumAegisCandidates,
    4_096,
  );
  checkLimit(
    violations,
    "Aegis interception candidates",
    maximumAegisInterceptionCandidates,
    4_096,
  );
  checkLimit(
    violations,
    "collision events resolved",
    maximumCollisionResolved,
    2_048,
  );
  if (staleActivationTrackersAfterDrain !== 0) {
    violations.push(
      `${staleActivationTrackersAfterDrain} activation trackers remained after drain`,
    );
  }
  if (session.world.state.status === "gameOver") {
    violations.push("stress run ended in gameOver");
  }

  const elapsed = Math.max(
    1 / options.frameRate,
    stepDurations.length / options.frameRate,
  );
  return {
    variantId: options.protocolId ?? "baseline",
    weaponId: options.weaponId,
    frames: stepDurations.length,
    simulationSeconds: elapsed,
    endedStatus: session.world.state.status,
    maximumEnemies,
    maximumPlayerBullets,
    maximumEnemyProjectiles,
    maximumProjectiles,
    maximumPickups,
    maximumActivationTrackers,
    staleActivationTrackersAfterDrain,
    maximumAegisCandidates,
    maximumAegisInterceptionCandidates,
    maximumCollisionResolved,
    maximumEventsPerFrame,
    eventsPerSecond: eventCount / elapsed,
    stepP95Ms: percentile(stepDurations, 0.95),
    framesOver50MsRatio:
      stepDurations.filter((duration) => duration > 50).length /
      Math.max(1, stepDurations.length),
    violations,
  };
}

function createStressConfig(): SimulationConfig {
  return {
    ...SIMULATION_CONFIG,
    player: {
      ...SIMULATION_CONFIG.player,
      maxHp: 500,
    },
    enemies: {
      chaser: {
        ...SIMULATION_CONFIG.enemies.chaser,
        hp: 10_000,
        damage: 0,
      },
      brute: {
        ...SIMULATION_CONFIG.enemies.brute,
        hp: 10_000,
        damage: 0,
      },
      fast: {
        ...SIMULATION_CONFIG.enemies.fast,
        hp: 10_000,
        damage: 0,
      },
      ranged: {
        ...SIMULATION_CONFIG.enemies.ranged,
        hp: 10_000,
        damage: 0,
        ranged: {
          ...SIMULATION_CONFIG.enemies.ranged.ranged!,
          projectileDamage: 0,
        },
      },
    },
    encounter: {
      ...SIMULATION_CONFIG.encounter,
      collapse: {
        ...SIMULATION_CONFIG.encounter.collapse,
        baseDamage: 0,
      },
    },
  };
}

function restoreHealth(
  world: Parameters<typeof getPlayerEffectiveMaxHp>[0],
  config: SimulationConfig,
): void {
  world.state.hp = getPlayerEffectiveMaxHp(world, config);
}

function collectRelativePerformanceViolations(
  runs: ExProtocolSoakRun[],
): string[] {
  const violations: string[] = [];
  for (const candidate of runs.filter(
    ({ variantId }) => variantId !== "baseline",
  )) {
    const baseline = runs.find(
      (run) =>
        run.variantId === "baseline" &&
        run.weaponId === candidate.weaponId,
    );
    if (!baseline) {
      violations.push(
        `missing ${candidate.weaponId} performance baseline`,
      );
      continue;
    }
    const allowedP95Increase = Math.max(
      4,
      baseline.stepP95Ms * 0.2,
    );
    if (
      candidate.stepP95Ms - baseline.stepP95Ms >
      allowedP95Increase
    ) {
      violations.push(
        `${candidate.variantId} p95 increase ${(candidate.stepP95Ms - baseline.stepP95Ms).toFixed(3)}ms exceeds ${allowedP95Increase.toFixed(3)}ms`,
      );
    }
    if (
      candidate.framesOver50MsRatio -
        baseline.framesOver50MsRatio >
      0.005
    ) {
      violations.push(
        `${candidate.variantId} >50ms frame ratio increase exceeds 0.5 percentage point`,
      );
    }
  }
  return violations;
}

function readGauge(
  metrics: readonly GameMetric[],
  name: Extract<GameMetric, { type: "gauge" }>["name"],
): number {
  const metric = metrics.find(
    (candidate) =>
      candidate.type === "gauge" && candidate.name === name,
  );
  return metric?.type === "gauge" ? metric.value : 0;
}

function checkLimit(
  violations: string[],
  label: string,
  actual: number,
  limit: number,
): void {
  if (actual > limit) {
    violations.push(`${label} ${actual} exceeds ${limit}`);
  }
}

function percentile(values: number[], quantile: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((left, right) => left - right);
  const index = Math.min(
    sorted.length - 1,
    Math.max(0, Math.floor((sorted.length - 1) * quantile)),
  );
  return sorted[index]!;
}
