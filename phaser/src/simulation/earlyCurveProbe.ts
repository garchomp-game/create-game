import { ArenaSession } from "../application/ArenaSession";
import { SIMULATION_CONFIG } from "../config/gameConfig";
import type {
  EnemyTypeId,
  GameEvent,
  InputSnapshot,
  SimulationConfig,
  WeaponTypeId,
  WorldState,
} from "../domain/types";
import type { RulesetProfileId } from "../domain/ruleset";
import { createAutoPilotAgent } from "./autoPilot";
import type {
  AutoPilotPatrolStrategy,
  AutoPilotProfileId,
} from "./autoPilotContracts";
import { getPlayerEffectiveMaxHp } from "./systems/playerHealthSystem";
import { getThreatTier } from "./threatDirector";

export const EARLY_CURVE_PROBE_SEEDS = Array.from(
  { length: 12 },
  (_, index) => 20260725 + index,
);

export type EarlyCurveWeaponType = Extract<
  WeaponTypeId,
  "pulse" | "spread"
>;

export type EarlyCurveProbeOptions = {
  config?: SimulationConfig;
  seeds: readonly number[];
  durationSeconds: number;
  frameRate?: number;
  pressureWindowSeconds?: number;
  pressureBinSeconds?: number;
  choiceDwellSeconds?: number;
  weaponTypes?: readonly EarlyCurveWeaponType[];
  profile?: AutoPilotProfileId;
  survivalControl?: "none" | "refresh-health";
  collectionControl?: "none" | "vacuum-xp";
  patrolStrategy?: AutoPilotPatrolStrategy;
  stopWhenExStarts?: boolean;
  rulesetProfileId?: RulesetProfileId;
};

export type EarlyCurveMilestone = {
  gameplayElapsed: number;
  wallElapsed: number;
  xpCollected: number;
};

export type EarlyCurveMilestones = {
  firstUpgrade: EarlyCurveMilestone | null;
  level2: EarlyCurveMilestone | null;
  level5: EarlyCurveMilestone | null;
  buildCompleted: EarlyCurveMilestone | null;
  protocolSelected: EarlyCurveMilestone | null;
  exStarted: EarlyCurveMilestone | null;
};

export type EarlyCurvePressureBin = {
  start: number;
  end: number;
  gameplayFrames: number;
  spawned: number;
  spawnedByType: Record<EnemyTypeId, number>;
  kills: number;
  killsByType: Record<EnemyTypeId, number>;
  xpCollected: number;
  xpPickupsCollected: number;
  healPickupsCollected: number;
  damageTaken: number;
  hitsTaken: number;
  choicesOpened: number;
  selectionPauseSeconds: number;
  averageOnScreenEnemies: number;
  maximumOnScreenEnemies: number;
  averageEnemyProjectiles: number;
  maximumEnemyProjectiles: number;
};

export type EarlyCurveProbeRun = {
  seed: number;
  weaponType: EarlyCurveWeaponType;
  survivedSeconds: number;
  wallElapsedSeconds: number;
  endedStatus: WorldState["state"]["status"];
  level: number;
  score: number;
  kills: number;
  xpCollected: number;
  selectedProtocolId: string | null;
  choiceCount: number;
  selectionPauseSeconds: number;
  extraLevel: number;
  extraCycle: number;
  threatTier: number;
  collapseStage: number;
  damageTaken: number;
  damageTakenBySource: WorldState["stats"]["damageTakenBySource"];
  lastDamageSource: WorldState["stats"]["lastDamageSource"];
  milestones: EarlyCurveMilestones;
  pressureBins: EarlyCurvePressureBin[];
  worldHash: string;
  violations: string[];
};

export type ProbePercentiles = {
  min: number;
  p25: number;
  p50: number;
  p75: number;
  max: number;
};

export type EarlyCurveMilestoneSummary = {
  reached: number;
  total: number;
  gameplayElapsed: ProbePercentiles | null;
  wallElapsed: ProbePercentiles | null;
  xpCollected: ProbePercentiles | null;
};

export type EarlyCurvePressureBinSummary = {
  start: number;
  end: number;
  spawned: ProbePercentiles;
  spawnedByTypeP50: Record<EnemyTypeId, number>;
  kills: ProbePercentiles;
  xpCollected: ProbePercentiles;
  damageTaken: ProbePercentiles;
  averageOnScreenEnemies: ProbePercentiles;
  maximumOnScreenEnemies: ProbePercentiles;
  averageEnemyProjectiles: ProbePercentiles;
  selectionPauseSeconds: ProbePercentiles;
  choicesOpened: ProbePercentiles;
};

export type EarlyCurveWeaponSummary = {
  runs: number;
  survivedSeconds: ProbePercentiles;
  milestones: Record<keyof EarlyCurveMilestones, EarlyCurveMilestoneSummary>;
  pressureBins: EarlyCurvePressureBinSummary[];
};

export type EarlyCurveProbeReport = {
  seeds: number[];
  durationSeconds: number;
  frameRate: number;
  pressureWindowSeconds: number;
  pressureBinSeconds: number;
  choiceDwellSeconds: number;
  profile: AutoPilotProfileId;
  survivalControl: "none" | "refresh-health";
  collectionControl: "none" | "vacuum-xp";
  patrolStrategy: AutoPilotPatrolStrategy;
  stopWhenExStarts: boolean;
  runs: EarlyCurveProbeRun[];
  summaries: Record<EarlyCurveWeaponType, EarlyCurveWeaponSummary>;
  violations: string[];
};

type PressureBinAccumulator = EarlyCurvePressureBin & {
  onScreenEnemyFrameTotal: number;
  enemyProjectileFrameTotal: number;
};

const BASE_INPUT: InputSnapshot = {
  move: { x: 0, y: 0 },
  aimWorld: null,
  startPressed: false,
  shootHeld: false,
  restartPressed: false,
  pausePressed: false,
  quitToTitlePressed: false,
  upgradeChoicePressed: null,
  contractChoicePressed: null,
};

const ENEMY_TYPES: readonly EnemyTypeId[] = [
  "chaser",
  "brute",
  "fast",
  "ranged",
];

const CHOICE_STATUSES = new Set<WorldState["state"]["status"]>([
  "upgradeSelect",
  "protocolSelect",
  "evolutionSelect",
  "contractSelect",
]);

export function runEarlyCurveProbe(
  options: EarlyCurveProbeOptions,
): EarlyCurveProbeReport {
  const config = options.config ?? SIMULATION_CONFIG;
  const frameRate = options.frameRate ?? 20;
  const pressureWindowSeconds = options.pressureWindowSeconds ?? 60;
  const pressureBinSeconds = options.pressureBinSeconds ?? 5;
  const choiceDwellSeconds = options.choiceDwellSeconds ?? 1.5;
  const profile = options.profile ?? "fair";
  const survivalControl = options.survivalControl ?? "none";
  const collectionControl = options.collectionControl ?? "none";
  const patrolStrategy = options.patrolStrategy ?? "periodic-v3";
  const stopWhenExStarts = options.stopWhenExStarts ?? false;
  const rulesetProfileId =
    options.rulesetProfileId ?? "candidate-ex-endless-c2";
  const weaponTypes = options.weaponTypes ?? ["pulse", "spread"];
  const runs: EarlyCurveProbeRun[] = [];

  for (const seed of options.seeds) {
    for (const weaponType of weaponTypes) {
      runs.push(
        runEarlyCurveProbeOnce({
          config,
          seed,
          weaponType,
          durationSeconds: options.durationSeconds,
          frameRate,
          pressureWindowSeconds,
          pressureBinSeconds,
          choiceDwellSeconds,
          profile,
          survivalControl,
          collectionControl,
          patrolStrategy,
          stopWhenExStarts,
          rulesetProfileId,
        }),
      );
    }
  }

  return {
    seeds: [...options.seeds],
    durationSeconds: options.durationSeconds,
    frameRate,
    pressureWindowSeconds,
    pressureBinSeconds,
    choiceDwellSeconds,
    profile,
    survivalControl,
    collectionControl,
    patrolStrategy,
    stopWhenExStarts,
    runs,
    summaries: {
      pulse: summarizeWeapon(
        runs.filter(({ weaponType }) => weaponType === "pulse"),
      ),
      spread: summarizeWeapon(
        runs.filter(({ weaponType }) => weaponType === "spread"),
      ),
    },
    violations: runs.flatMap((run) =>
      run.violations.map(
        (violation) => `${run.weaponType}/${run.seed}: ${violation}`,
      ),
    ),
  };
}

function runEarlyCurveProbeOnce(options: {
  config: SimulationConfig;
  seed: number;
  weaponType: EarlyCurveWeaponType;
  durationSeconds: number;
  frameRate: number;
  pressureWindowSeconds: number;
  pressureBinSeconds: number;
  choiceDwellSeconds: number;
  profile: AutoPilotProfileId;
  survivalControl: "none" | "refresh-health";
  collectionControl: "none" | "vacuum-xp";
  patrolStrategy: AutoPilotPatrolStrategy;
  stopWhenExStarts: boolean;
  rulesetProfileId: RulesetProfileId;
}): EarlyCurveProbeRun {
  const session = new ArenaSession(options.config);
  session.start({
    seed: options.seed,
    weaponType: options.weaponType,
    rulesetProfileId: options.rulesetProfileId,
  });
  const agent = createAutoPilotAgent(undefined, {
    profile: options.profile,
    patrolStrategy: options.patrolStrategy,
  });
  const dt = 1 / options.frameRate;
  const choiceDwellFrames = Math.ceil(
    options.choiceDwellSeconds * options.frameRate,
  );
  const maximumWallFrames = Math.ceil(
    (options.durationSeconds + 180) * options.frameRate,
  );
  const pressureBins = createPressureBins(
    options.pressureWindowSeconds,
    options.pressureBinSeconds,
  );
  const milestones = createEmptyMilestones();
  const violations: string[] = [];
  let wallElapsed = 0;
  let choiceKey: string | null = null;
  let choiceFramesRemaining = 0;
  let choiceCount = 0;
  let selectionPauseSeconds = 0;
  let stoppedAfterExStarted = false;

  for (
    let wallFrame = 0;
    wallFrame < maximumWallFrames &&
    session.world.state.elapsed < options.durationSeconds &&
    session.world.state.status !== "gameOver";
    wallFrame += 1
  ) {
    wallElapsed += dt;
    const status = session.world.state.status;
    const currentChoiceKey = CHOICE_STATUSES.has(status)
      ? createChoiceKey(session.world)
      : null;
    if (currentChoiceKey !== choiceKey) {
      choiceKey = currentChoiceKey;
      choiceFramesRemaining =
        currentChoiceKey === null ? 0 : choiceDwellFrames;
      if (currentChoiceKey !== null) {
        choiceCount += 1;
        const bin = getPressureBin(
          pressureBins,
          session.world.state.elapsed,
          options.pressureBinSeconds,
        );
        if (bin) bin.choicesOpened += 1;
      }
    }

    if (currentChoiceKey !== null && choiceFramesRemaining > 0) {
      choiceFramesRemaining -= 1;
      selectionPauseSeconds += dt;
      const bin = getPressureBin(
        pressureBins,
        session.world.state.elapsed,
        options.pressureBinSeconds,
      );
      if (bin) bin.selectionPauseSeconds += dt;
      session.step(BASE_INPUT, dt);
      continue;
    }

    const elapsedBefore = session.world.state.elapsed;
    if (
      options.survivalControl === "refresh-health" &&
      session.world.state.status === "playing"
    ) {
      session.world.state.hp = getPlayerEffectiveMaxHp(
        session.world,
        session.config,
      );
    }
    if (
      options.collectionControl === "vacuum-xp" &&
      session.world.state.status === "playing"
    ) {
      for (const pickup of session.world.pickups) {
        if (pickup.kind !== "xp") continue;
        pickup.position = { ...session.world.player.position };
      }
    }
    const input = createProbeInput(
      session.world,
      session.config,
      agent.decide(session.world, session.config).input,
      options.seed,
    );
    const result = session.step(input, dt);
    recordMilestones(
      milestones,
      result.events,
      session.world,
      wallElapsed,
    );
    if (
      options.stopWhenExStarts &&
      milestones.exStarted !== null
    ) {
      stoppedAfterExStarted = true;
      break;
    }
    if (session.world.state.elapsed > elapsedBefore) {
      recordPressureFrame(
        pressureBins,
        result.events,
        session.world,
        session.config,
        options.pressureBinSeconds,
      );
    }
    collectViolations(session.world, session.config, violations);
  }

  if (
    session.world.state.elapsed < options.durationSeconds &&
    session.world.state.status !== "gameOver" &&
    !stoppedAfterExStarted
  ) {
    violations.push("probe exceeded the wall-clock frame budget");
  }

  return {
    seed: options.seed,
    weaponType: options.weaponType,
    survivedSeconds: roundMetric(session.world.state.elapsed),
    wallElapsedSeconds: roundMetric(wallElapsed),
    endedStatus: session.world.state.status,
    level: session.world.progression.level,
    score: session.world.state.score,
    kills: session.world.stats.enemiesKilled,
    xpCollected: session.world.stats.xpCollected,
    selectedProtocolId:
      session.world.progression.exProtocol?.status === "selected"
        ? session.world.progression.exProtocol.route.protocolId
        : null,
    choiceCount,
    selectionPauseSeconds: roundMetric(selectionPauseSeconds),
    extraLevel: session.world.progression.extraLevel,
    extraCycle: session.world.progression.extraCycle,
    threatTier: getThreatTier(
      session.config,
      session.world.state.elapsed,
    ),
    collapseStage: session.world.encounter.collapse.stage,
    damageTaken: session.world.stats.damageTaken,
    damageTakenBySource: {
      ...session.world.stats.damageTakenBySource,
    },
    lastDamageSource: session.world.stats.lastDamageSource
      ? { ...session.world.stats.lastDamageSource }
      : null,
    milestones,
    pressureBins: pressureBins.map(finalizePressureBin),
    worldHash: stableHash(JSON.stringify(session.world)),
    violations: [...new Set(violations)],
  };
}

function createProbeInput(
  world: WorldState,
  config: SimulationConfig,
  autoPilotInput: InputSnapshot,
  seed: number,
): InputSnapshot {
  if (world.state.status === "protocolSelect") {
    const choices =
      world.progression.pendingChoice?.kind === "protocol"
        ? world.progression.pendingChoice.choices
        : [];
    return {
      ...BASE_INPUT,
      upgradeChoicePressed:
        choices.length > 0 ? seed % choices.length : null,
    };
  }
  if (world.state.status === "evolutionSelect") {
    const pending = world.progression.pendingChoice;
    const choices =
      pending?.kind === "evolution-one" ||
      pending?.kind === "evolution-two"
        ? pending.choices
        : [];
    const tierOffset = pending?.kind === "evolution-two" ? 1 : 0;
    return {
      ...BASE_INPUT,
      upgradeChoicePressed:
        choices.length > 0 ? (seed + tierOffset) % choices.length : null,
    };
  }

  return {
    ...autoPilotInput,
    specialPressed: shouldPressSpecial(world, config),
  };
}

function shouldPressSpecial(
  world: WorldState,
  _config: SimulationConfig,
): boolean {
  const progression = world.progression.exProtocol;
  if (progression?.status !== "selected") return false;
  const runtime = progression.runtime;
  if (runtime.kind === "rebound-overdrive") {
    return (
      runtime.armedUntil === null &&
      world.state.elapsed >= runtime.cooldownUntil
    );
  }
  if (runtime.kind === "full-span-tidal-sweep") {
    return runtime.charges > 0;
  }
  if (runtime.kind === "breakwater-fan") {
    return (
      runtime.charges > 0 &&
      world.state.elapsed >= runtime.cooldownUntil &&
      world.state.hp > runtime.hpCostAtSelection
    );
  }
  return false;
}

function createChoiceKey(world: WorldState): string {
  const pending = world.progression.pendingChoice;
  if (pending) {
    return `${world.state.status}:${pending.kind}:${pending.choices.join(",")}`;
  }
  return `${world.state.status}:${world.progression.pendingUpgradeChoices.join(",")}`;
}

function createEmptyMilestones(): EarlyCurveMilestones {
  return {
    firstUpgrade: null,
    level2: null,
    level5: null,
    buildCompleted: null,
    protocolSelected: null,
    exStarted: null,
  };
}

function recordMilestones(
  milestones: EarlyCurveMilestones,
  events: readonly GameEvent[],
  world: WorldState,
  wallElapsed: number,
): void {
  for (const event of events) {
    if (event.type === "upgrade.selected" && milestones.firstUpgrade === null) {
      milestones.firstUpgrade = createMilestone(world, wallElapsed);
    } else if (
      event.type === "player.level_up" &&
      event.level === 2 &&
      milestones.level2 === null
    ) {
      milestones.level2 = createMilestone(world, wallElapsed);
    } else if (
      event.type === "player.level_up" &&
      event.level === 5 &&
      milestones.level5 === null
    ) {
      milestones.level5 = createMilestone(world, wallElapsed);
    } else if (
      event.type === "build.completed" &&
      milestones.buildCompleted === null
    ) {
      milestones.buildCompleted = createMilestone(world, wallElapsed);
    } else if (
      event.type === "ex.protocol.selected" &&
      milestones.protocolSelected === null
    ) {
      milestones.protocolSelected = createMilestone(world, wallElapsed);
    } else if (
      event.type === "ex.level_up" &&
      event.exLevel === 1 &&
      milestones.exStarted === null
    ) {
      milestones.exStarted = createMilestone(world, wallElapsed);
    }
  }
}

function createMilestone(
  world: WorldState,
  wallElapsed: number,
): EarlyCurveMilestone {
  return {
    gameplayElapsed: roundMetric(world.state.elapsed),
    wallElapsed: roundMetric(wallElapsed),
    xpCollected: world.stats.xpCollected,
  };
}

function createPressureBins(
  windowSeconds: number,
  binSeconds: number,
): PressureBinAccumulator[] {
  const count = Math.ceil(windowSeconds / binSeconds);
  return Array.from({ length: count }, (_, index) => ({
    start: index * binSeconds,
    end: Math.min(windowSeconds, (index + 1) * binSeconds),
    gameplayFrames: 0,
    spawned: 0,
    spawnedByType: createEnemyTypeCounts(),
    kills: 0,
    killsByType: createEnemyTypeCounts(),
    xpCollected: 0,
    xpPickupsCollected: 0,
    healPickupsCollected: 0,
    damageTaken: 0,
    hitsTaken: 0,
    choicesOpened: 0,
    selectionPauseSeconds: 0,
    averageOnScreenEnemies: 0,
    maximumOnScreenEnemies: 0,
    averageEnemyProjectiles: 0,
    maximumEnemyProjectiles: 0,
    onScreenEnemyFrameTotal: 0,
    enemyProjectileFrameTotal: 0,
  }));
}

function createEnemyTypeCounts(): Record<EnemyTypeId, number> {
  return {
    chaser: 0,
    brute: 0,
    fast: 0,
    ranged: 0,
  };
}

function getPressureBin(
  bins: PressureBinAccumulator[],
  elapsed: number,
  binSeconds: number,
): PressureBinAccumulator | null {
  const index = Math.floor((elapsed + Number.EPSILON) / binSeconds);
  return bins[index] ?? null;
}

function recordPressureFrame(
  bins: PressureBinAccumulator[],
  events: readonly GameEvent[],
  world: WorldState,
  config: SimulationConfig,
  binSeconds: number,
): void {
  const bin = getPressureBin(bins, world.state.elapsed, binSeconds);
  if (!bin) return;
  const onScreenEnemies = world.enemies.filter((enemy) =>
    isOnScreen(
      enemy.position.x,
      enemy.position.y,
      enemy.radius,
      config,
    ),
  ).length;
  bin.gameplayFrames += 1;
  bin.onScreenEnemyFrameTotal += onScreenEnemies;
  bin.maximumOnScreenEnemies = Math.max(
    bin.maximumOnScreenEnemies,
    onScreenEnemies,
  );
  bin.enemyProjectileFrameTotal += world.enemyProjectiles.length;
  bin.maximumEnemyProjectiles = Math.max(
    bin.maximumEnemyProjectiles,
    world.enemyProjectiles.length,
  );

  for (const event of events) {
    if (event.type === "enemy.spawned") {
      bin.spawned += 1;
      bin.spawnedByType[event.enemyType] += 1;
    } else if (
      event.type === "enemy.killed" ||
      event.type === "enemy.protocol.killed"
    ) {
      bin.kills += 1;
      bin.killsByType[event.enemyType] += 1;
    } else if (
      event.type === "pickup.collected" &&
      event.pickupKind === "xp"
    ) {
      bin.xpCollected += event.xpValue;
      bin.xpPickupsCollected += 1;
    } else if (
      event.type === "pickup.collected" &&
      event.pickupKind === "heal"
    ) {
      bin.healPickupsCollected += 1;
    } else if (event.type === "player.damaged") {
      bin.damageTaken += event.damage;
      bin.hitsTaken += 1;
    }
  }
}

function isOnScreen(
  x: number,
  y: number,
  radius: number,
  config: SimulationConfig,
): boolean {
  return (
    x + radius >= 0 &&
    y + radius >= 0 &&
    x - radius <= config.arena.width &&
    y - radius <= config.arena.height
  );
}

function finalizePressureBin(
  bin: PressureBinAccumulator,
): EarlyCurvePressureBin {
  const frames = Math.max(1, bin.gameplayFrames);
  return {
    start: bin.start,
    end: bin.end,
    gameplayFrames: bin.gameplayFrames,
    spawned: bin.spawned,
    spawnedByType: { ...bin.spawnedByType },
    kills: bin.kills,
    killsByType: { ...bin.killsByType },
    xpCollected: bin.xpCollected,
    xpPickupsCollected: bin.xpPickupsCollected,
    healPickupsCollected: bin.healPickupsCollected,
    damageTaken: bin.damageTaken,
    hitsTaken: bin.hitsTaken,
    choicesOpened: bin.choicesOpened,
    selectionPauseSeconds: roundMetric(bin.selectionPauseSeconds),
    averageOnScreenEnemies: roundMetric(
      bin.onScreenEnemyFrameTotal / frames,
    ),
    maximumOnScreenEnemies: bin.maximumOnScreenEnemies,
    averageEnemyProjectiles: roundMetric(
      bin.enemyProjectileFrameTotal / frames,
    ),
    maximumEnemyProjectiles: bin.maximumEnemyProjectiles,
  };
}

function collectViolations(
  world: WorldState,
  config: SimulationConfig,
  violations: string[],
): void {
  if (!Number.isFinite(world.state.elapsed)) {
    violations.push("elapsed is not finite");
  }
  if (!Number.isFinite(world.player.position.x)) {
    violations.push("player.x is not finite");
  }
  if (!Number.isFinite(world.player.position.y)) {
    violations.push("player.y is not finite");
  }
  if (world.enemies.length > config.threat.maximumEnemies) {
    violations.push(
      `enemy count ${world.enemies.length} exceeded ${config.threat.maximumEnemies}`,
    );
  }
}

function summarizeWeapon(
  runs: EarlyCurveProbeRun[],
): EarlyCurveWeaponSummary {
  const milestoneKeys = Object.keys(
    createEmptyMilestones(),
  ) as Array<keyof EarlyCurveMilestones>;
  const pressureBinCount = Math.max(
    0,
    ...runs.map((run) => run.pressureBins.length),
  );
  return {
    runs: runs.length,
    survivedSeconds: percentiles(
      runs.map(({ survivedSeconds }) => survivedSeconds),
    ),
    milestones: Object.fromEntries(
      milestoneKeys.map((key) => [
        key,
        summarizeMilestone(
          runs.map((run) => run.milestones[key]),
          runs.length,
        ),
      ]),
    ) as Record<
      keyof EarlyCurveMilestones,
      EarlyCurveMilestoneSummary
    >,
    pressureBins: Array.from({ length: pressureBinCount }, (_, index) =>
      summarizePressureBin(
        runs
          .map((run) => run.pressureBins[index])
          .filter((bin): bin is EarlyCurvePressureBin => Boolean(bin)),
      ),
    ),
  };
}

function summarizeMilestone(
  milestones: Array<EarlyCurveMilestone | null>,
  total: number,
): EarlyCurveMilestoneSummary {
  const reached = milestones.filter(
    (milestone): milestone is EarlyCurveMilestone => milestone !== null,
  );
  return {
    reached: reached.length,
    total,
    gameplayElapsed:
      reached.length > 0
        ? percentiles(reached.map(({ gameplayElapsed }) => gameplayElapsed))
        : null,
    wallElapsed:
      reached.length > 0
        ? percentiles(reached.map(({ wallElapsed }) => wallElapsed))
        : null,
    xpCollected:
      reached.length > 0
        ? percentiles(reached.map(({ xpCollected }) => xpCollected))
        : null,
  };
}

function summarizePressureBin(
  bins: EarlyCurvePressureBin[],
): EarlyCurvePressureBinSummary {
  const fallback = createPressureBins(5, 5)[0]!;
  const first = bins[0] ?? finalizePressureBin(fallback);
  return {
    start: first.start,
    end: first.end,
    spawned: percentiles(bins.map(({ spawned }) => spawned)),
    spawnedByTypeP50: Object.fromEntries(
      ENEMY_TYPES.map((enemyType) => [
        enemyType,
        percentile(
          bins.map((bin) => bin.spawnedByType[enemyType]),
          0.5,
        ),
      ]),
    ) as Record<EnemyTypeId, number>,
    kills: percentiles(bins.map(({ kills }) => kills)),
    xpCollected: percentiles(bins.map(({ xpCollected }) => xpCollected)),
    damageTaken: percentiles(
      bins.map(({ damageTaken }) => damageTaken),
    ),
    averageOnScreenEnemies: percentiles(
      bins.map(({ averageOnScreenEnemies }) => averageOnScreenEnemies),
    ),
    maximumOnScreenEnemies: percentiles(
      bins.map(({ maximumOnScreenEnemies }) => maximumOnScreenEnemies),
    ),
    averageEnemyProjectiles: percentiles(
      bins.map(({ averageEnemyProjectiles }) => averageEnemyProjectiles),
    ),
    selectionPauseSeconds: percentiles(
      bins.map(({ selectionPauseSeconds }) => selectionPauseSeconds),
    ),
    choicesOpened: percentiles(
      bins.map(({ choicesOpened }) => choicesOpened),
    ),
  };
}

function percentiles(values: number[]): ProbePercentiles {
  return {
    min: roundMetric(percentile(values, 0)),
    p25: roundMetric(percentile(values, 0.25)),
    p50: roundMetric(percentile(values, 0.5)),
    p75: roundMetric(percentile(values, 0.75)),
    max: roundMetric(percentile(values, 1)),
  };
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

function roundMetric(value: number): number {
  return Math.round(value * 100) / 100;
}

function stableHash(value: string): string {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}
