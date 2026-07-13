import type {
  DamageTakenBySource,
  Enemy,
  GameEvent,
  InputSnapshot,
  PlayerDamageSource,
  SimulationConfig,
  Vec2,
  WeaponTypeId,
  WorldState,
} from "../domain/types";
import { createRandomStreams } from "../math/random";
import { normalize } from "../math/vector";
import { createWorld } from "./createWorld";
import { stepWorld } from "./stepWorld";
import { getWaveBand } from "./waveDirector";

export const BALANCE_INPUT_MODEL_IDS = [
  "noInput",
  "fixedAimShoot",
  "kiteCollect",
] as const;

export type BalanceInputModelId = (typeof BALANCE_INPUT_MODEL_IDS)[number];

export type BalanceProbeOptions = {
  config: SimulationConfig;
  seeds: number[];
  inputModels?: readonly BalanceInputModelId[];
  durationSeconds: number;
  frameRate?: number;
  weaponType?: WeaponTypeId;
};

export type BalanceProbeRun = {
  inputModel: BalanceInputModelId;
  seed: number;
  weaponType: WeaponTypeId;
  survivedSeconds: number;
  endedStatus: WorldState["state"]["status"];
  score: number;
  level: number;
  kills: number;
  scorePerMinute: number;
  killsPerMinute: number;
  projectilesFired: number;
  hits: number;
  projectileHitRate: number;
  hitVolleyRate: number;
  uniqueEnemiesPerHitVolley: number;
  hitsPerKill: number;
  firstDamageAt: number | null;
  firstUpgradeAt: number | null;
  upgradeOffers: number;
  upgradesChosen: number;
  longestMeaningfulChoiceGap: number;
  buildCompletedAt: number | null;
  movementDistance: number;
  encounterScheduledAt: number | null;
  encounterRangedEnemiesSpawned: number;
  encounterDamageTaken: number;
  encounterBaselineMovement: number;
  encounterWarningMovement: number;
  encounterActiveMovement: number;
  encounterDirectionChangeDegrees: number | null;
  capstoneAcquiredAt: number | null;
  capstoneActivations: number;
  capstoneFollowUpHits: number;
  capstoneFollowUpUniqueEnemiesHit: number;
  pulseFocusEnhancedHits: number;
  pulseFocusBonusDamage: number;
  pulseFocusMaxStacks: number;
  spreadSweepTriggers: number;
  spreadSweepConsumes: number;
  maxEnemies: number;
  maxBullets: number;
  maxPickups: number;
  waveStartReached: number;
  damageTaken: number;
  damageTakenBySource: DamageTakenBySource;
  lastDamageSource: PlayerDamageSource | null;
  hpRecovered: number;
  healPickupsCollected: number;
  effectiveHealPickupsCollected: number;
  waveBoundaryDamage: BalanceProbeWaveBoundaryDamage[];
  violations: string[];
};

export type BalanceProbeWaveBoundaryDamage = {
  waveStart: number;
  damageTaken: number;
  hitsTaken: number;
};

export type BalanceProbePercentiles = {
  min: number;
  p25: number;
  p50: number;
  p75: number;
  max: number;
};

export type BalanceProbeNullablePercentiles = {
  count: number;
  min: number | null;
  p25: number | null;
  p50: number | null;
  p75: number | null;
  max: number | null;
};

export type BalanceProbeModelSummary = {
  runs: number;
  survivalSeconds: BalanceProbePercentiles;
  scorePerMinute: BalanceProbePercentiles;
  killsPerMinute: BalanceProbePercentiles;
  maxEnemies: BalanceProbePercentiles;
  maxBullets: BalanceProbePercentiles;
  waveStartReached: BalanceProbePercentiles;
  hpRecovered: BalanceProbePercentiles;
  healPickupsCollected: BalanceProbePercentiles;
  effectiveHealPickupsCollected: BalanceProbePercentiles;
  firstDamageAt: BalanceProbeNullablePercentiles;
  firstUpgradeAt: BalanceProbeNullablePercentiles;
  upgradeOffers: BalanceProbePercentiles;
  upgradesChosen: BalanceProbePercentiles;
  longestMeaningfulChoiceGap: BalanceProbePercentiles;
  buildCompletedAt: BalanceProbeNullablePercentiles;
  movementDistance: BalanceProbePercentiles;
  projectileHitRate: BalanceProbePercentiles;
  hitVolleyRate: BalanceProbePercentiles;
  uniqueEnemiesPerHitVolley: BalanceProbePercentiles;
  hitsPerKill: BalanceProbePercentiles;
  damageTaken: BalanceProbePercentiles;
  encounterDamageTaken: BalanceProbePercentiles;
  encounterActiveMovement: BalanceProbePercentiles;
  capstoneActivations: BalanceProbePercentiles;
  capstoneFollowUpHits: BalanceProbePercentiles;
  pulseFocusEnhancedHits: BalanceProbePercentiles;
  pulseFocusBonusDamage: BalanceProbePercentiles;
  pulseFocusMaxStacks: BalanceProbePercentiles;
  spreadSweepTriggers: BalanceProbePercentiles;
  spreadSweepConsumes: BalanceProbePercentiles;
};

export type BalanceProbeSummary = {
  byModel: Record<BalanceInputModelId, BalanceProbeModelSummary>;
};

export type BalanceProbeReport = {
  runs: BalanceProbeRun[];
  summary: BalanceProbeSummary;
  violations: string[];
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

const UPGRADE_PRIORITY = [
  "pulseRicochet",
  "spreadSweep",
  "pulseFocus",
  "splitShot",
  "rapidFire",
  "piercingRounds",
  "swiftStep",
  "overdriveRounds",
  "vitalCore",
] as const;

export function runBalanceProbe(options: BalanceProbeOptions): BalanceProbeReport {
  const inputModels = options.inputModels ?? BALANCE_INPUT_MODEL_IDS;
  const runs: BalanceProbeRun[] = [];
  for (const inputModel of inputModels) {
    for (const seed of options.seeds) {
      runs.push(runBalanceProbeOnce({ ...options, inputModel, seed }));
    }
  }

  return {
    runs,
    summary: summarizeBalanceRuns(runs),
    violations: runs.flatMap((run) => run.violations.map((violation) => `${run.inputModel}/${run.seed}: ${violation}`)),
  };
}

export function runStartingWeaponComparison(
  options: Omit<BalanceProbeOptions, "weaponType">,
): Record<"pulse" | "spread", BalanceProbeReport> {
  return {
    pulse: runBalanceProbe({ ...options, weaponType: "pulse" }),
    spread: runBalanceProbe({ ...options, weaponType: "spread" }),
  };
}

function runBalanceProbeOnce(options: BalanceProbeOptions & {
  inputModel: BalanceInputModelId;
  seed: number;
}): BalanceProbeRun {
  const frameRate = options.frameRate ?? 30;
  const dt = 1 / frameRate;
  const maxFrames = Math.ceil(options.durationSeconds * frameRate);
  const random = createRandomStreams(options.seed);
  const world = createWorld(options.config);
  world.state.weaponType = options.weaponType ?? options.config.defaultWeapon;
  const violations: string[] = [];
  let firstDamageAt: number | null = null;
  let firstUpgradeAt: number | null = null;
  let maxEnemies = world.enemies.length;
  let maxBullets = world.bullets.length + world.enemyProjectiles.length;
  let maxPickups = world.pickups.length;
  let waveStartReached = getWaveBand(options.config, world.state.elapsed).start;
  const waveBoundaryDamage = options.config.waves.map((wave) => ({
    waveStart: wave.start,
    damageTaken: 0,
    hitsTaken: 0,
  }));

  for (let frame = 0; frame < maxFrames && world.state.status !== "gameOver"; frame += 1) {
    const input = createInputForModel(options.inputModel, world, options.config);
    const result = stepWorld(world, input, dt, random, options.config);

    recordEventTimes(result.events, world, {
      firstDamageAt: (elapsed) => {
        firstDamageAt ??= elapsed;
      },
      firstUpgradeAt: (elapsed) => {
        firstUpgradeAt ??= elapsed;
      },
    });
    recordWaveBoundaryDamage(result.events, world, options.config, waveBoundaryDamage);

    maxEnemies = Math.max(maxEnemies, world.enemies.length);
    maxBullets = Math.max(maxBullets, world.bullets.length + world.enemyProjectiles.length);
    maxPickups = Math.max(maxPickups, world.pickups.length);
    waveStartReached = Math.max(waveStartReached, getWaveBand(options.config, world.state.elapsed).start);
    collectWorldViolations(world, options.config, violations);
  }

  const minutes = Math.max(world.state.elapsed / 60, 1 / 60);
  const weaponMetrics = world.stats.weaponMetrics[world.state.weaponType];
  const comparisonMetrics = world.stats.weaponComparisonMetrics[world.state.weaponType];
  const encounterMovement = world.stats.encounterMetrics.movement;
  return {
    inputModel: options.inputModel,
    seed: options.seed,
    weaponType: world.state.weaponType,
    survivedSeconds: roundMetric(world.state.elapsed),
    endedStatus: world.state.status,
    score: world.state.score,
    level: world.progression.level,
    kills: world.stats.enemiesKilled,
    scorePerMinute: roundMetric(world.state.score / minutes),
    killsPerMinute: roundMetric(world.stats.enemiesKilled / minutes),
    projectilesFired: weaponMetrics.projectilesFired,
    hits: weaponMetrics.hits,
    projectileHitRate: roundMetric(
      weaponMetrics.hits / Math.max(1, weaponMetrics.projectilesFired),
    ),
    hitVolleyRate: roundMetric(
      comparisonMetrics.hitVolleys / Math.max(1, weaponMetrics.shotsFired),
    ),
    uniqueEnemiesPerHitVolley: roundMetric(
      comparisonMetrics.uniqueEnemiesHit / Math.max(1, comparisonMetrics.hitVolleys),
    ),
    hitsPerKill: roundMetric(weaponMetrics.hits / Math.max(1, world.stats.enemiesKilled)),
    firstDamageAt: firstDamageAt === null ? null : roundMetric(firstDamageAt),
    firstUpgradeAt: firstUpgradeAt === null ? null : roundMetric(firstUpgradeAt),
    upgradeOffers: world.stats.progressionMetrics.offers.length,
    upgradesChosen: world.stats.upgradesChosen,
    longestMeaningfulChoiceGap: roundMetric(
      world.stats.progressionMetrics.longestMeaningfulChoiceGap,
    ),
    buildCompletedAt:
      world.stats.progressionMetrics.buildCompletedAt === null
        ? null
        : roundMetric(world.stats.progressionMetrics.buildCompletedAt),
    movementDistance: roundMetric(world.stats.movementDistance),
    encounterScheduledAt: world.stats.encounterMetrics.scheduledAt,
    encounterRangedEnemiesSpawned: world.stats.encounterMetrics.rangedEnemiesSpawned,
    encounterDamageTaken: world.stats.encounterMetrics.damageTakenDuringActive,
    encounterBaselineMovement: roundMetric(encounterMovement.baseline.distance),
    encounterWarningMovement: roundMetric(encounterMovement.warning.distance),
    encounterActiveMovement: roundMetric(encounterMovement.active.distance),
    encounterDirectionChangeDegrees: getDirectionChangeDegrees(
      encounterMovement.baseline.vector,
      encounterMovement.active.vector,
    ),
    capstoneAcquiredAt: world.stats.capstoneMetrics.acquiredAt,
    capstoneActivations: world.stats.capstoneMetrics.activations,
    capstoneFollowUpHits: world.stats.capstoneMetrics.followUpHits,
    capstoneFollowUpUniqueEnemiesHit:
      world.stats.capstoneMetrics.followUpUniqueEnemiesHit,
    pulseFocusEnhancedHits: world.stats.weaponIdentityMetrics.pulseFocus.enhancedHits,
    pulseFocusBonusDamage: roundMetric(
      world.stats.weaponIdentityMetrics.pulseFocus.bonusDamage,
    ),
    pulseFocusMaxStacks: world.stats.weaponIdentityMetrics.pulseFocus.maxStacks,
    spreadSweepTriggers: world.stats.weaponIdentityMetrics.spreadSweep.triggers,
    spreadSweepConsumes: world.stats.weaponIdentityMetrics.spreadSweep.consumes,
    maxEnemies,
    maxBullets,
    maxPickups,
    waveStartReached,
    damageTaken: world.stats.damageTaken,
    damageTakenBySource: { ...world.stats.damageTakenBySource },
    lastDamageSource: world.stats.lastDamageSource ? { ...world.stats.lastDamageSource } : null,
    hpRecovered: world.stats.hpRecovered,
    healPickupsCollected: world.stats.healPickupsCollected,
    effectiveHealPickupsCollected: world.stats.effectiveHealPickupsCollected,
    waveBoundaryDamage: waveBoundaryDamage.map((entry) => ({ ...entry })),
    violations: [...new Set(violations)],
  };
}

function createInputForModel(
  inputModel: BalanceInputModelId,
  world: WorldState,
  config: SimulationConfig,
): InputSnapshot {
  if (world.state.status === "contractSelect") {
    return { ...BASE_INPUT, contractChoicePressed: 0 };
  }
  if (world.state.status === "upgradeSelect") {
    return { ...BASE_INPUT, upgradeChoicePressed: chooseUpgradeIndex(world) };
  }

  if (inputModel === "noInput") return { ...BASE_INPUT };

  if (inputModel === "fixedAimShoot") {
    return {
      ...BASE_INPUT,
      aimWorld: { x: world.player.position.x + 100, y: world.player.position.y },
      shootHeld: true,
    };
  }

  return createKiteCollectInput(world, config);
}

function createKiteCollectInput(world: WorldState, config: SimulationConfig): InputSnapshot {
  const nearestEnemy = findNearestEnemy(world);
  const nearestPickup = findNearestPickup(world);
  const nearestProjectile = findNearestProjectile(world);

  let move = getIdleOrbitMove(world);
  if (nearestProjectile && nearestProjectile.distance < 120) {
    move = normalize(
      world.player.position.x - nearestProjectile.position.x,
      world.player.position.y - nearestProjectile.position.y,
    );
  } else if (nearestEnemy && nearestEnemy.distance < 175) {
    move = normalize(
      world.player.position.x - nearestEnemy.enemy.position.x,
      world.player.position.y - nearestEnemy.enemy.position.y,
    );
  } else if (nearestPickup && nearestPickup.distance < config.pickup.magnetRadius * 1.75) {
    move = normalize(
      nearestPickup.position.x - world.player.position.x,
      nearestPickup.position.y - world.player.position.y,
    );
  }

  const aimWorld = nearestEnemy
    ? { ...nearestEnemy.enemy.position }
    : { x: world.player.position.x + 100, y: world.player.position.y };

  return {
    ...BASE_INPUT,
    move,
    aimWorld,
    shootHeld: true,
  };
}

function chooseUpgradeIndex(world: WorldState): number | null {
  let bestIndex: number | null = null;
  let bestRank = Number.POSITIVE_INFINITY;
  for (const upgradeId of UPGRADE_PRIORITY) {
    const index = world.progression.pendingUpgradeChoices.indexOf(upgradeId);
    if (index < 0) continue;
    const rank = world.progression.upgradeRanks[upgradeId];
    if (rank < bestRank) {
      bestIndex = index;
      bestRank = rank;
    }
  }
  return bestIndex ?? (world.progression.pendingUpgradeChoices.length > 0 ? 0 : null);
}

function recordEventTimes(
  events: GameEvent[],
  world: WorldState,
  setters: {
    firstDamageAt: (elapsed: number) => void;
    firstUpgradeAt: (elapsed: number) => void;
  },
): void {
  for (const event of events) {
    if (event.type === "player.damaged") setters.firstDamageAt(world.state.elapsed);
    if (event.type === "upgrade.selected") setters.firstUpgradeAt(world.state.elapsed);
  }
}

function recordWaveBoundaryDamage(
  events: GameEvent[],
  world: WorldState,
  config: SimulationConfig,
  waveBoundaryDamage: BalanceProbeWaveBoundaryDamage[],
): void {
  const damageEvents = events.filter((event) => event.type === "player.damaged");
  if (damageEvents.length === 0) return;

  const wave = getWaveBand(config, world.state.elapsed);
  if (world.state.elapsed < wave.start || world.state.elapsed >= wave.start + 10) return;

  const target = waveBoundaryDamage.find((entry) => entry.waveStart === wave.start);
  if (!target) return;

  for (const event of damageEvents) {
    target.damageTaken += event.damage;
    target.hitsTaken += 1;
  }
}

function collectWorldViolations(
  world: WorldState,
  config: SimulationConfig,
  violations: string[],
): void {
  const wave = getWaveBand(config, world.state.elapsed);
  if (world.enemies.length > wave.maxEnemies) {
    violations.push(`enemy count ${world.enemies.length} exceeded wave max ${wave.maxEnemies}`);
  }

  validateFinite("player.x", world.player.position.x, violations);
  validateFinite("player.y", world.player.position.y, violations);
  validateFinite("hp", world.state.hp, violations);
  validateFinite("score", world.state.score, violations);

  for (const enemy of world.enemies) validateBody(`enemy.${enemy.id}`, enemy, violations);
  for (const bullet of world.bullets) validateBody(`bullet.${bullet.id}`, bullet, violations);
  for (const projectile of world.enemyProjectiles) validateBody(`enemyProjectile.${projectile.id}`, projectile, violations);
  for (const pickup of world.pickups) validateBody(`pickup.${pickup.id}`, pickup, violations);
}

function validateBody(
  label: string,
  body: { position: Vec2; radius: number },
  violations: string[],
): void {
  validateFinite(`${label}.x`, body.position.x, violations);
  validateFinite(`${label}.y`, body.position.y, violations);
  validateFinite(`${label}.radius`, body.radius, violations);
}

function validateFinite(label: string, value: number, violations: string[]): void {
  if (!Number.isFinite(value)) violations.push(`${label} is not finite`);
}

function summarizeBalanceRuns(runs: BalanceProbeRun[]): BalanceProbeSummary {
  const byModel = Object.fromEntries(
    BALANCE_INPUT_MODEL_IDS.map((inputModel) => {
      const modelRuns = runs.filter((run) => run.inputModel === inputModel);
      return [inputModel, summarizeModelRuns(modelRuns)];
    }),
  ) as Record<BalanceInputModelId, BalanceProbeModelSummary>;
  return { byModel };
}

function summarizeModelRuns(runs: BalanceProbeRun[]): BalanceProbeModelSummary {
  return {
    runs: runs.length,
    survivalSeconds: percentiles(runs.map((run) => run.survivedSeconds)),
    scorePerMinute: percentiles(runs.map((run) => run.scorePerMinute)),
    killsPerMinute: percentiles(runs.map((run) => run.killsPerMinute)),
    maxEnemies: percentiles(runs.map((run) => run.maxEnemies)),
    maxBullets: percentiles(runs.map((run) => run.maxBullets)),
    waveStartReached: percentiles(runs.map((run) => run.waveStartReached)),
    hpRecovered: percentiles(runs.map((run) => run.hpRecovered)),
    healPickupsCollected: percentiles(runs.map((run) => run.healPickupsCollected)),
    effectiveHealPickupsCollected: percentiles(
      runs.map((run) => run.effectiveHealPickupsCollected),
    ),
    firstDamageAt: nullablePercentiles(runs.map((run) => run.firstDamageAt)),
    firstUpgradeAt: nullablePercentiles(runs.map((run) => run.firstUpgradeAt)),
    upgradeOffers: percentiles(runs.map((run) => run.upgradeOffers)),
    upgradesChosen: percentiles(runs.map((run) => run.upgradesChosen)),
    longestMeaningfulChoiceGap: percentiles(
      runs.map((run) => run.longestMeaningfulChoiceGap),
    ),
    buildCompletedAt: nullablePercentiles(runs.map((run) => run.buildCompletedAt)),
    movementDistance: percentiles(runs.map((run) => run.movementDistance)),
    projectileHitRate: percentiles(runs.map((run) => run.projectileHitRate)),
    hitVolleyRate: percentiles(runs.map((run) => run.hitVolleyRate)),
    uniqueEnemiesPerHitVolley: percentiles(
      runs.map((run) => run.uniqueEnemiesPerHitVolley),
    ),
    hitsPerKill: percentiles(runs.map((run) => run.hitsPerKill)),
    damageTaken: percentiles(runs.map((run) => run.damageTaken)),
    encounterDamageTaken: percentiles(runs.map((run) => run.encounterDamageTaken)),
    encounterActiveMovement: percentiles(runs.map((run) => run.encounterActiveMovement)),
    capstoneActivations: percentiles(runs.map((run) => run.capstoneActivations)),
    capstoneFollowUpHits: percentiles(runs.map((run) => run.capstoneFollowUpHits)),
    pulseFocusEnhancedHits: percentiles(runs.map((run) => run.pulseFocusEnhancedHits)),
    pulseFocusBonusDamage: percentiles(runs.map((run) => run.pulseFocusBonusDamage)),
    pulseFocusMaxStacks: percentiles(runs.map((run) => run.pulseFocusMaxStacks)),
    spreadSweepTriggers: percentiles(runs.map((run) => run.spreadSweepTriggers)),
    spreadSweepConsumes: percentiles(runs.map((run) => run.spreadSweepConsumes)),
  };
}

function getDirectionChangeDegrees(before: Vec2, after: Vec2): number | null {
  const beforeLength = Math.hypot(before.x, before.y);
  const afterLength = Math.hypot(after.x, after.y);
  if (beforeLength < 0.001 || afterLength < 0.001) return null;
  const cosine = Math.max(
    -1,
    Math.min(1, (before.x * after.x + before.y * after.y) / (beforeLength * afterLength)),
  );
  return roundMetric((Math.acos(cosine) * 180) / Math.PI);
}

function percentiles(values: number[]): BalanceProbePercentiles {
  if (values.length === 0) {
    return { min: 0, p25: 0, p50: 0, p75: 0, max: 0 };
  }

  const sorted = [...values].sort((a, b) => a - b);
  return {
    min: roundMetric(sorted[0]!),
    p25: roundMetric(pickPercentile(sorted, 0.25)),
    p50: roundMetric(pickPercentile(sorted, 0.5)),
    p75: roundMetric(pickPercentile(sorted, 0.75)),
    max: roundMetric(sorted[sorted.length - 1]!),
  };
}

function nullablePercentiles(values: Array<number | null>): BalanceProbeNullablePercentiles {
  const numericValues = values.filter((value): value is number => value !== null);
  if (numericValues.length === 0) {
    return { count: 0, min: null, p25: null, p50: null, p75: null, max: null };
  }

  return {
    count: numericValues.length,
    ...percentiles(numericValues),
  };
}

function pickPercentile(sortedValues: number[], percentile: number): number {
  const index = Math.floor((sortedValues.length - 1) * percentile);
  return sortedValues[index]!;
}

function roundMetric(value: number): number {
  return Math.round(value * 100) / 100;
}

function findNearestEnemy(world: WorldState): { enemy: Enemy; distance: number } | null {
  let nearest: { enemy: Enemy; distance: number } | null = null;
  for (const enemy of world.enemies) {
    const distance = Math.hypot(
      enemy.position.x - world.player.position.x,
      enemy.position.y - world.player.position.y,
    );
    if (!nearest || distance < nearest.distance) nearest = { enemy, distance };
  }
  return nearest;
}

function findNearestPickup(world: WorldState): { position: Vec2; distance: number } | null {
  let nearest: { position: Vec2; distance: number } | null = null;
  for (const pickup of world.pickups) {
    const distance = Math.hypot(
      pickup.position.x - world.player.position.x,
      pickup.position.y - world.player.position.y,
    );
    if (!nearest || distance < nearest.distance) nearest = { position: pickup.position, distance };
  }
  return nearest;
}

function findNearestProjectile(world: WorldState): { position: Vec2; distance: number } | null {
  let nearest: { position: Vec2; distance: number } | null = null;
  for (const projectile of world.enemyProjectiles) {
    const distance = Math.hypot(
      projectile.position.x - world.player.position.x,
      projectile.position.y - world.player.position.y,
    );
    if (!nearest || distance < nearest.distance) nearest = { position: projectile.position, distance };
  }
  return nearest;
}

function getIdleOrbitMove(world: WorldState): Vec2 {
  const centerOffset = normalize(480 - world.player.position.x, 270 - world.player.position.y);
  const orbit = normalize(Math.cos(world.state.elapsed * 0.85), Math.sin(world.state.elapsed * 0.65));
  return normalize(centerOffset.x * 0.35 + orbit.x, centerOffset.y * 0.35 + orbit.y);
}
