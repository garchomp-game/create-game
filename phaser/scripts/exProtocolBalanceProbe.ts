import { ArenaSession } from "../src/application/ArenaSession";
import {
  EX_PROTOCOL_CATALOG,
  type ExProtocolDefinition,
} from "../src/content/exProtocolCatalog";
import { SIMULATION_CONFIG } from "../src/config/gameConfig";
import type {
  GameEvent,
  GameMetric,
  SimulationConfig,
  WeaponTypeId,
  WorldState,
} from "../src/domain/types";
import { createAutoPilotAgent } from "../src/simulation/autoPilot";
import { composeBuild } from "../src/simulation/buildComposer";
import {
  chooseExProtocol,
  chooseExProtocolEvolution,
  offerExProtocolEvolution,
} from "../src/simulation/exProtocolProgression";
import {
  completeBuild,
} from "../src/simulation/systems/levelSystem";
import { updateRunStats } from "../src/simulation/systems/statsSystem";
import {
  createExProtocolProbeInput,
  type ExProtocolProbePath,
} from "./exProtocolProbePolicy";

export const EX_PROTOCOL_BALANCE_SEEDS = Array.from(
  { length: 20 },
  (_, index) => 20260701 + index,
);

export type ExProtocolBalanceRun = {
  variantId: "baseline" | string;
  weaponId: WeaponTypeId;
  seed: number;
  pathId: string | null;
  startElapsed: number;
  elapsed: number;
  score: number;
  kills: number;
  hits: number;
  damageTaken: number;
  survived: boolean;
  protocolExposureSeconds: number;
  protocolDamageShare: number;
  opportunityCount: number;
  effectCount: number;
  specialPresses: number;
  specialAccepted: number;
  protocolCounters: Record<string, number>;
  maximumEnemies: number;
  maximumProjectiles: number;
  maximumPickups: number;
  maximumActivationTrackers: number;
  maximumAegisCandidates: number;
  maximumCollisionResolved: number;
  decisionP95Ms: number;
  worldHash: string;
  violations: string[];
};

export type PairedMetricSummary = {
  median: number;
  lower95: number;
  upper95: number;
};

export type ExProtocolBalanceSummary = {
  protocolId: string;
  runs: number;
  scoreRateRelativeDelta: PairedMetricSummary;
  killRateRelativeDelta: PairedMetricSummary;
  survivalRelativeDelta: PairedMetricSummary;
  exposureQualifiedRuns: number;
  totalOpportunityCount: number;
  totalEffectCount: number;
  zeroEffectQualifiedRate: number;
  medianProtocolDamageShare: number;
  scriptedSpecialAcceptanceRate: number | null;
  maximumDecisionP95Ms: number;
  reviewTriggers: string[];
};

export type ExProtocolBalanceReport = {
  seeds: number[];
  startElapsedSeconds: number;
  durationSeconds: number;
  frameRate: number;
  runs: ExProtocolBalanceRun[];
  summaries: ExProtocolBalanceSummary[];
  violations: string[];
};

export type CompletedExProtocolProbeSession = {
  session: ArenaSession;
  path: ExProtocolProbePath | null;
};

export function createCompletedExProtocolProbeSession(options: {
  seed: number;
  weaponId: WeaponTypeId;
  protocolId: string | null;
  pathIndex?: number;
  startElapsedSeconds?: number;
  baseConfig?: SimulationConfig;
}): CompletedExProtocolProbeSession {
  const protocol =
    options.protocolId === null
      ? null
      : EX_PROTOCOL_CATALOG.protocols.find(
          ({ id }) => id === options.protocolId,
        ) ?? null;
  if (options.protocolId !== null && !protocol) {
    throw new Error(`Unknown EX Protocol "${options.protocolId}".`);
  }
  if (protocol && protocol.weaponId !== options.weaponId) {
    throw new Error(
      `${protocol.id} is not compatible with ${options.weaponId}.`,
    );
  }
  const session = new ArenaSession(
    options.baseConfig ?? SIMULATION_CONFIG,
  );
  session.start({
    seed: options.seed,
    weaponType: options.weaponId,
    rulesetProfileId: protocol
      ? "candidate-ex-endless-c2"
      : undefined,
  });
  const startElapsedSeconds = options.startElapsedSeconds ?? 300;
  session.world.state.elapsed = startElapsedSeconds;
  selectStandardContractForProbe(
    session.world,
    startElapsedSeconds,
  );
  return {
    session,
    path: prepareCompletedBuild(
      session,
      protocol,
      options.pathIndex ?? 0,
    ),
  };
}

export function runExProtocolBalanceMatrix(options: {
  seeds: number[];
  durationSeconds: number;
  frameRate?: number;
  startElapsedSeconds?: number;
}): ExProtocolBalanceReport {
  const frameRate = options.frameRate ?? 20;
  const startElapsedSeconds = options.startElapsedSeconds ?? 300;
  const runs: ExProtocolBalanceRun[] = [];
  for (const weaponId of ["pulse", "spread"] as const) {
    for (const [seedIndex, seed] of options.seeds.entries()) {
      runs.push(
        runBalanceVariant({
          seed,
          weaponId,
          durationSeconds: options.durationSeconds,
          frameRate,
          startElapsedSeconds,
          protocol: null,
          pathIndex: 0,
        }),
      );
      for (const protocol of EX_PROTOCOL_CATALOG.protocols.filter(
        ({ weaponId: candidateWeapon }) =>
          candidateWeapon === weaponId,
      )) {
        runs.push(
          runBalanceVariant({
            seed,
            weaponId,
            durationSeconds: options.durationSeconds,
            frameRate,
            startElapsedSeconds,
            protocol,
            pathIndex: seedIndex % 4,
          }),
        );
      }
    }
  }
  const summaries = EX_PROTOCOL_CATALOG.protocols.map((protocol) =>
    summarizeProtocol(protocol, options.seeds, runs),
  );
  return {
    seeds: [...options.seeds],
    startElapsedSeconds,
    durationSeconds: options.durationSeconds,
    frameRate,
    runs,
    summaries,
    violations: runs.flatMap((run) =>
      run.violations.map(
        (violation) => `${run.variantId}/${run.seed}: ${violation}`,
      ),
    ),
  };
}

function runBalanceVariant(options: {
  seed: number;
  weaponId: WeaponTypeId;
  durationSeconds: number;
  frameRate: number;
  startElapsedSeconds: number;
  protocol: ExProtocolDefinition | null;
  pathIndex: number;
}): ExProtocolBalanceRun {
  const { session, path } = createCompletedExProtocolProbeSession({
    seed: options.seed,
    weaponId: options.weaponId,
    protocolId: options.protocol?.id ?? null,
    pathIndex: options.pathIndex,
    startElapsedSeconds: options.startElapsedSeconds,
  });
  const decisionDurations: number[] = [];
  const agent = createAutoPilotAgent(undefined, {
    profile: "fair",
    patrolStrategy: "visit-history-v1",
    onPhaseTiming: (phase, durationMs) => {
      if (phase === "total") decisionDurations.push(durationMs);
    },
  });
  const dt = 1 / options.frameRate;
  const maximumFrames = Math.ceil(
    options.durationSeconds * options.frameRate,
  );
  let maximumEnemies = 0;
  let maximumProjectiles = 0;
  let maximumPickups = 0;
  let maximumActivationTrackers = 0;
  let maximumAegisCandidates = 0;
  let maximumCollisionResolved = 0;
  const violations: string[] = [];

  for (
    let frame = 0;
    frame < maximumFrames &&
    session.world.state.status !== "gameOver";
    frame += 1
  ) {
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
    const result = session.step(input, dt);
    maximumEnemies = Math.max(
      maximumEnemies,
      session.world.enemies.length,
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
      readGauge(result.metrics, "ex.aegis.interception_candidates"),
    );
    maximumCollisionResolved = Math.max(
      maximumCollisionResolved,
      readGauge(result.metrics, "ex.aegis.collision_resolved"),
    );
    collectLimitViolation(
      violations,
      "enemies",
      session.world.enemies.length,
      96,
    );
    collectLimitViolation(
      violations,
      "projectiles",
      session.world.bullets.length +
        session.world.enemyProjectiles.length,
      300,
    );
    collectLimitViolation(
      violations,
      "pickups",
      session.world.pickups.length,
      2_000,
    );
    collectLimitViolation(
      violations,
      "activation trackers",
      readGauge(
        result.metrics,
        "ex.protocol.activation_trackers",
      ),
      16,
    );
  }

  const stats = session.world.stats;
  const protocolStats = stats.exProtocolMetrics;
  const totalProtocolDamage =
    protocolStats.protocolSourceDamage +
    protocolStats.protocolBonusDamageAttributed;
  const [opportunityCount, effectCount] = getEffectCounts(
    options.protocol?.id ?? null,
    protocolStats.counters,
  );
  return {
    variantId: options.protocol?.id ?? "baseline",
    weaponId: options.weaponId,
    seed: options.seed,
    pathId: path
      ? `${path.evolutionOneId}/${path.evolutionTwoId}`
      : null,
    startElapsed: options.startElapsedSeconds,
    elapsed: session.world.state.elapsed,
    score: session.world.state.score,
    kills: stats.enemiesKilled,
    hits: stats.weaponMetrics[options.weaponId].hits,
    damageTaken: stats.damageTaken,
    survived: session.world.state.status !== "gameOver",
    protocolExposureSeconds:
      protocolStats.counters.protocolExposureSeconds ?? 0,
    protocolDamageShare:
      protocolStats.totalPlayerDamage > 0
        ? totalProtocolDamage / protocolStats.totalPlayerDamage
        : 0,
    opportunityCount,
    effectCount,
    specialPresses: protocolStats.specialPresses,
    specialAccepted: protocolStats.specialAccepted,
    protocolCounters: { ...protocolStats.counters },
    maximumEnemies,
    maximumProjectiles,
    maximumPickups,
    maximumActivationTrackers,
    maximumAegisCandidates,
    maximumCollisionResolved,
    decisionP95Ms: percentile(decisionDurations, 0.95),
    worldHash: stableHash(JSON.stringify(session.world)),
    violations: [...new Set(violations)],
  };
}

function selectStandardContractForProbe(
  world: WorldState,
  selectedAt: number,
): void {
  world.encounter.contract.status = "selected";
  world.encounter.contract.choice = "standard";
  world.encounter.contract.offeredAt = selectedAt;
  world.encounter.contract.selectedAt = selectedAt;
  world.encounter.contract.enemySpeedMultiplier = 1;
  world.encounter.contract.scoreMultiplier = 1;
  delete world.encounter.contract.notBefore;
}

function prepareCompletedBuild(
  session: ArenaSession,
  protocol: ExProtocolDefinition | null,
  pathIndex: number,
): ExProtocolProbePath | null {
  const world = session.world;
  completeNormalBuild(world, session.config);
  Object.assign(
    world.runtime,
    composeBuild(
      session.config,
      world.state.weaponType,
      world.progression.upgradeRanks,
      [],
      world.progression.extraUpgradeRanks,
    ).modifiers,
  );
  world.state.hp =
    session.config.player.maxHp + world.runtime.maxHpBonus;
  const buildEvents: GameEvent[] = [];
  completeBuild(world, session.config, buildEvents);
  updateRunStats(world, buildEvents);
  if (!protocol) {
    world.state.status = "playing";
    return null;
  }

  const compatible = EX_PROTOCOL_CATALOG.protocols.filter(
    ({ weaponId }) => weaponId === protocol.weaponId,
  );
  const protocolIndex = compatible.findIndex(
    ({ id }) => id === protocol.id,
  );
  const protocolEvents: GameEvent[] = [];
  if (
    protocolIndex < 0 ||
    !chooseExProtocol(
      world,
      protocolIndex,
      session.config,
      protocolEvents,
    )
  ) {
    throw new Error(`Failed to select ${protocol.id}.`);
  }
  updateRunStats(world, protocolEvents);

  const evolutionOneIndex = Math.floor(pathIndex / 2);
  const evolutionTwoIndex = pathIndex % 2;
  for (const [tier, choiceIndex] of [
    [1, evolutionOneIndex],
    [2, evolutionTwoIndex],
  ] as const) {
    world.progression.extraLevel = tier;
    const events: GameEvent[] = [];
    if (!offerExProtocolEvolution(world, tier, events)) {
      throw new Error(`Failed to offer ${protocol.id} E${tier}.`);
    }
    if (
      !chooseExProtocolEvolution(
        world,
        choiceIndex,
        session.config,
        events,
      )
    ) {
      throw new Error(`Failed to select ${protocol.id} E${tier}.`);
    }
    updateRunStats(world, events);
  }
  world.state.status = "playing";
  return {
    protocolId: protocol.id,
    evolutionOneId: protocol.evolutionOne[evolutionOneIndex]!.id,
    evolutionTwoId: protocol.evolutionTwo[evolutionTwoIndex]!.id,
  };
}

function completeNormalBuild(
  world: WorldState,
  config: SimulationConfig,
): void {
  for (const upgradeId of Object.keys(
    world.progression.upgradeRanks,
  ) as Array<keyof typeof world.progression.upgradeRanks>) {
    const definition = config.upgrades[upgradeId];
    const weaponIds = definition.requirements?.weaponIds;
    if (weaponIds && !weaponIds.includes(world.state.weaponType)) {
      continue;
    }
    world.progression.upgradeRanks[upgradeId] = definition.maxRank;
  }
}

function summarizeProtocol(
  protocol: ExProtocolDefinition,
  seeds: number[],
  runs: ExProtocolBalanceRun[],
): ExProtocolBalanceSummary {
  const baselineBySeed = new Map(
    runs
      .filter(
        (run) =>
          run.variantId === "baseline" &&
          run.weaponId === protocol.weaponId,
      )
      .map((run) => [run.seed, run]),
  );
  const candidates = runs.filter(
    (run) => run.variantId === protocol.id,
  );
  const scoreRateDelta = candidates.map((run) =>
    relativeDelta(
      perMinute(run.score, runDuration(run)),
      perMinute(
        requireBaseline(run, baselineBySeed).score,
        runDuration(requireBaseline(run, baselineBySeed)),
      ),
    ),
  );
  const killRateDelta = candidates.map((run) =>
    relativeDelta(
      perMinute(run.kills, runDuration(run)),
      perMinute(
        requireBaseline(run, baselineBySeed).kills,
        runDuration(requireBaseline(run, baselineBySeed)),
      ),
    ),
  );
  const survivalDelta = candidates.map((run) =>
    relativeDelta(
      runDuration(run),
      runDuration(requireBaseline(run, baselineBySeed)),
    ),
  );
  const exposureQualified = candidates.filter(
    (run) => run.protocolExposureSeconds >= 60,
  );
  const effectQualified = exposureQualified.filter(
    (run) => run.opportunityCount > 0,
  );
  const zeroEffectQualifiedRate =
    effectQualified.length > 0
      ? effectQualified.filter((run) => run.effectCount === 0).length /
        effectQualified.length
      : 0;
  const scoreSummary = summarizePaired(scoreRateDelta, seeds[0] ?? 1);
  const killSummary = summarizePaired(killRateDelta, seeds[0] ?? 1);
  const survivalSummary = summarizePaired(
    survivalDelta,
    seeds.at(-1) ?? 1,
  );
  const reviewTriggers: string[] = [];
  if (zeroEffectQualifiedRate > 0.2) {
    reviewTriggers.push(
      `effect counter is zero in ${(zeroEffectQualifiedRate * 100).toFixed(1)}% of qualified runs`,
    );
  }
  const damageShares = candidates.map(
    ({ protocolDamageShare }) => protocolDamageShare,
  );
  if (median(damageShares) > 0.5) {
    reviewTriggers.push("median Protocol damage share exceeds 50%");
  }
  if (
    effectQualified.length > 0 &&
    median(damageShares) < 0.05
  ) {
    reviewTriggers.push("median Protocol damage share is below 5%");
  }
  if (
    exposureQualified.length > 0 &&
    exposureQualified.every((run) => run.opportunityCount === 0)
  ) {
    reviewTriggers.push(
      "no mechanic opportunity was observed in exposure-qualified runs; probe coverage is insufficient",
    );
  }
  reviewTriggers.push(
    ...createPeerReviewTriggers(protocol, seeds, runs),
  );
  const specialPresses = candidates.reduce(
    (total, run) => total + run.specialPresses,
    0,
  );
  const specialAccepted = candidates.reduce(
    (total, run) => total + run.specialAccepted,
    0,
  );
  return {
    protocolId: protocol.id,
    runs: candidates.length,
    scoreRateRelativeDelta: scoreSummary,
    killRateRelativeDelta: killSummary,
    survivalRelativeDelta: survivalSummary,
    exposureQualifiedRuns: exposureQualified.length,
    totalOpportunityCount: candidates.reduce(
      (total, run) => total + run.opportunityCount,
      0,
    ),
    totalEffectCount: candidates.reduce(
      (total, run) => total + run.effectCount,
      0,
    ),
    zeroEffectQualifiedRate,
    medianProtocolDamageShare: median(damageShares),
    scriptedSpecialAcceptanceRate:
      specialPresses > 0 ? specialAccepted / specialPresses : null,
    maximumDecisionP95Ms: Math.max(
      0,
      ...candidates.map(({ decisionP95Ms }) => decisionP95Ms),
    ),
    reviewTriggers,
  };
}

function createPeerReviewTriggers(
  protocol: ExProtocolDefinition,
  seeds: number[],
  runs: ExProtocolBalanceRun[],
): string[] {
  const candidates = runs.filter(
    ({ variantId }) => variantId === protocol.id,
  );
  const candidateBySeed = new Map(
    candidates.map((run) => [run.seed, run]),
  );
  const peers = EX_PROTOCOL_CATALOG.protocols.filter(
    ({ id, weaponId }) =>
      weaponId === protocol.weaponId && id !== protocol.id,
  );
  const peerComparisons = peers.map((peer, peerIndex) => {
    const peerBySeed = new Map(
      runs
        .filter(({ variantId }) => variantId === peer.id)
        .map((run) => [run.seed, run]),
    );
    const attackDeltas = seeds.map((seed) => {
      const candidate = requireRun(candidateBySeed, protocol.id, seed);
      const peerRun = requireRun(peerBySeed, peer.id, seed);
      return relativeDelta(
        perMinute(candidate.kills, runDuration(candidate)),
        perMinute(peerRun.kills, runDuration(peerRun)),
      );
    });
    const survivalDeltas = seeds.map((seed) => {
      const candidate = requireRun(candidateBySeed, protocol.id, seed);
      const peerRun = requireRun(peerBySeed, peer.id, seed);
      return relativeDelta(
        runDuration(candidate),
        runDuration(peerRun),
      );
    });
    return {
      attack: summarizePaired(
        attackDeltas,
        (seeds[0] ?? 1) + peerIndex * 17,
      ),
      survival: summarizePaired(
        survivalDeltas,
        (seeds.at(-1) ?? 1) + peerIndex * 31,
      ),
    };
  });

  const triggers: string[] = [];
  if (
    peerComparisons.length > 0 &&
    peerComparisons.every(
      ({ attack, survival }) =>
        attack.median >= 0.15 &&
        survival.median >= 0.15 &&
        attack.lower95 > 0 &&
        survival.lower95 > 0,
    )
  ) {
    triggers.push(
      "paired attack and survival dominate every same-weapon Protocol by at least 15%",
    );
  }

  const attackAgainstWeaponMedian = seeds.map((seed) => {
    const candidate = requireRun(candidateBySeed, protocol.id, seed);
    const weaponRuns = requireWeaponProtocolRuns(
      protocol.weaponId,
      seed,
      runs,
    );
    return relativeDelta(
      perMinute(candidate.kills, runDuration(candidate)),
      median(
        weaponRuns.map((run) =>
          perMinute(run.kills, runDuration(run)),
        ),
      ),
    );
  });
  const survivalAgainstWeaponMedian = seeds.map((seed) => {
    const candidate = requireRun(candidateBySeed, protocol.id, seed);
    return relativeDelta(
      runDuration(candidate),
      median(
        requireWeaponProtocolRuns(
          protocol.weaponId,
          seed,
          runs,
        ).map((run) => runDuration(run)),
      ),
    );
  });
  const attackSummary = summarizePaired(
    attackAgainstWeaponMedian,
    (seeds[0] ?? 1) + 101,
  );
  const survivalSummary = summarizePaired(
    survivalAgainstWeaponMedian,
    (seeds.at(-1) ?? 1) + 211,
  );
  if (
    attackSummary.median <= -0.2 &&
    survivalSummary.median <= -0.2 &&
    attackSummary.upper95 < 0 &&
    survivalSummary.upper95 < 0
  ) {
    triggers.push(
      "paired attack and survival trail the same-weapon median by at least 20%",
    );
  }
  return triggers;
}

function requireWeaponProtocolRuns(
  weaponId: WeaponTypeId,
  seed: number,
  runs: ExProtocolBalanceRun[],
): ExProtocolBalanceRun[] {
  const matching = runs.filter(
    (run) =>
      run.weaponId === weaponId &&
      run.seed === seed &&
      run.variantId !== "baseline",
  );
  if (matching.length !== 3) {
    throw new Error(
      `Expected three ${weaponId} Protocol runs for seed ${seed}, received ${matching.length}.`,
    );
  }
  return matching;
}

function requireRun(
  runs: ReadonlyMap<number, ExProtocolBalanceRun>,
  variantId: string,
  seed: number,
): ExProtocolBalanceRun {
  const run = runs.get(seed);
  if (!run) {
    throw new Error(`Missing ${variantId}/${seed} probe run.`);
  }
  return run;
}

function requireBaseline(
  run: ExProtocolBalanceRun,
  baselines: ReadonlyMap<number, ExProtocolBalanceRun>,
): ExProtocolBalanceRun {
  const baseline = baselines.get(run.seed);
  if (!baseline) {
    throw new Error(`Missing ${run.weaponId}/${run.seed} baseline.`);
  }
  return baseline;
}

function summarizePaired(
  values: number[],
  seed: number,
): PairedMetricSummary {
  if (values.length === 0) {
    return { median: 0, lower95: 0, upper95: 0 };
  }
  const random = seededRandom(seed);
  const bootstraps = Array.from({ length: 1_000 }, () => {
    const sample = Array.from(
      { length: values.length },
      () => values[Math.floor(random() * values.length)]!,
    );
    return median(sample);
  }).sort((left, right) => left - right);
  return {
    median: median(values),
    lower95: percentile(bootstraps, 0.025),
    upper95: percentile(bootstraps, 0.975),
  };
}

function getEffectCounts(
  protocolId: string | null,
  counters: Readonly<Record<string, number>>,
): [number, number] {
  if (protocolId === "pulse.resonance-relay") {
    return [counters.anchorsCreated ?? 0, counters.relayResolved ?? 0];
  }
  if (protocolId === "pulse.rebound-overdrive") {
    return [counters.arms ?? 0, counters.ricochetsRestored ?? 0];
  }
  if (protocolId === "pulse.redline-core") {
    return [counters.redlineHits ?? 0, counters.redlineHits ?? 0];
  }
  if (protocolId === "spread.full-span-tidal-sweep") {
    return [counters.chargeEvents ?? 0, counters.activations ?? 0];
  }
  if (protocolId === "spread.breakwater-fan") {
    return [counters.chargeEvents ?? 0, counters.activations ?? 0];
  }
  if (protocolId === "spread.aegis-fan") {
    return [counters.edgeShots ?? 0, counters.intercepts ?? 0];
  }
  return [0, 0];
}

function collectLimitViolation(
  violations: string[],
  label: string,
  actual: number,
  limit: number,
): void {
  if (actual > limit) {
    violations.push(`${label} ${actual} exceeds ${limit}`);
  }
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

function relativeDelta(candidate: number, baseline: number): number {
  return (candidate - baseline) / Math.max(1, Math.abs(baseline));
}

function perMinute(value: number, elapsed: number): number {
  return value / Math.max(1 / 60, elapsed / 60);
}

function runDuration(run: ExProtocolBalanceRun): number {
  return Math.max(0, run.elapsed - run.startElapsed);
}

function median(values: number[]): number {
  return percentile(values, 0.5);
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

function seededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4_294_967_296;
  };
}

function stableHash(value: string): string {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}
