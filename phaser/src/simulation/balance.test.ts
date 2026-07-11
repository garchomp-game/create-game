import { describe, expect, it } from "vitest";
import { SIMULATION_CONFIG } from "../config/gameConfig";
import { createRandomStreams } from "../math/random";
import { runBalanceProbe, runStartingWeaponComparison } from "./balanceProbe";
import { createWorld } from "./createWorld";
import { stepWorld } from "./stepWorld";

const neutralInput = {
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

const balanceProbeSeeds = [20260619, 20260620, 20260621, 20260622, 20260623];

const balanceBaseline = {
  noInputSurvivalP50: 6.3,
  fixedAimShootSurvivalP50: 6.3,
  kiteCollectSurvivalP50: 171.23,
  kiteCollectKillsPerMinuteP50: 184.62,
  kiteCollectScorePerMinuteP50: 2776.38,
  kiteCollectFirstDamageP50: 89,
  kiteCollectFirstUpgradeP50: 7.13,
  kiteCollectWaveReachedP50: 90,
  kiteCollectMaxEnemiesMax: 61,
  kiteCollectMaxBulletsMax: 48,
  kiteCollectHpRecoveredP50: 72,
  kiteCollectHealPickupsCollectedP50: 31,
  kiteCollectEffectiveHealPickupsCollectedP50: 6,
};

describe("balance simulation", () => {
  it("keeps a fixed 60 second run within population budgets", () => {
    const world = createWorld(SIMULATION_CONFIG);
    world.state.hp = 100_000;
    const random = createRandomStreams(SIMULATION_CONFIG.seed);
    let spawnEvents = 0;
    let maxEnemyCount = 0;
    let maxBulletCount = 0;
    let frames = 0;
    let lateWaveSpawnEvents = 0;

    while ((world.state.elapsed < 60 || lateWaveSpawnEvents === 0) && frames < 60 * 75) {
      const result = stepWorld(world, neutralInput, 1 / 60, random, SIMULATION_CONFIG);
      frames += 1;
      const spawnedThisFrame = result.events.filter((event) => event.type === "enemy.spawned").length;
      spawnEvents += spawnedThisFrame;
      if (world.state.elapsed >= 60) {
        lateWaveSpawnEvents += spawnedThisFrame;
      }
      maxEnemyCount = Math.max(maxEnemyCount, world.enemies.length);
      maxBulletCount = Math.max(maxBulletCount, world.bullets.length + world.enemyProjectiles.length);

      if (world.state.status === "gameOver") break;
      if (world.state.status === "upgradeSelect") {
        stepWorld(
          world,
          { ...neutralInput, upgradeChoicePressed: 0 },
          1 / 60,
          random,
          SIMULATION_CONFIG,
        );
      }
    }

    expect(world.state.elapsed).toBeGreaterThanOrEqual(60);
    expect(lateWaveSpawnEvents).toBeGreaterThan(0);
    expect(maxEnemyCount).toBeLessThanOrEqual(60);
    expect(maxBulletCount).toBeLessThanOrEqual(80);
    expect(spawnEvents).toBeLessThanOrEqual(180);
  });

  it("profiles deterministic balance probes across seeds and input models", () => {
    const report = runBalanceProbe({
      config: SIMULATION_CONFIG,
      seeds: balanceProbeSeeds,
      durationSeconds: 180,
      frameRate: 30,
    });

    expect(report.violations).toEqual([]);
    expect(report.runs).toHaveLength(15);

    const noInput = report.summary.byModel.noInput;
    const fixedAimShoot = report.summary.byModel.fixedAimShoot;
    const kiteCollect = report.summary.byModel.kiteCollect;

    expect(noInput.runs).toBe(5);
    expect(fixedAimShoot.runs).toBe(5);
    expect(kiteCollect.runs).toBe(5);
    expect(kiteCollect.firstDamageAt.count).toBeGreaterThan(0);
    expect(report.runs.every((run) => run.waveBoundaryDamage.some((entry) => entry.waveStart === 60))).toBe(
      true,
    );

    // v0.6 independent-random-stream baseline. These probes are regression sentries,
    // not a claim that the input models are correct human play.
    expectWithinBaseline(noInput.survivalSeconds.p50, balanceBaseline.noInputSurvivalP50);
    expectWithinBaseline(
      fixedAimShoot.survivalSeconds.p50,
      balanceBaseline.fixedAimShootSurvivalP50,
    );
    expectWithinBaseline(
      kiteCollect.survivalSeconds.p50,
      balanceBaseline.kiteCollectSurvivalP50,
    );
    expectWithinBaseline(
      kiteCollect.killsPerMinute.p50,
      balanceBaseline.kiteCollectKillsPerMinuteP50,
    );
    expectWithinBaseline(
      kiteCollect.scorePerMinute.p50,
      balanceBaseline.kiteCollectScorePerMinuteP50,
    );
    expectWithinBaseline(
      kiteCollect.firstDamageAt.p50 ?? 0,
      balanceBaseline.kiteCollectFirstDamageP50,
    );
    expectWithinBaseline(
      kiteCollect.firstUpgradeAt.p50 ?? 0,
      balanceBaseline.kiteCollectFirstUpgradeP50,
    );
    expectWithinBaseline(
      kiteCollect.waveStartReached.p50,
      balanceBaseline.kiteCollectWaveReachedP50,
    );
    expectWithinBaseline(kiteCollect.maxEnemies.max, balanceBaseline.kiteCollectMaxEnemiesMax);
    expectWithinBaseline(kiteCollect.maxBullets.max, balanceBaseline.kiteCollectMaxBulletsMax);
    expectWithinBaseline(
      kiteCollect.hpRecovered.p50,
      balanceBaseline.kiteCollectHpRecoveredP50,
    );
    expectWithinBaseline(
      kiteCollect.healPickupsCollected.p50,
      balanceBaseline.kiteCollectHealPickupsCollectedP50,
    );
    expectWithinBaseline(
      kiteCollect.effectiveHealPickupsCollected.p50,
      balanceBaseline.kiteCollectEffectiveHealPickupsCollectedP50,
    );
    expect(noInput.healPickupsCollected.max).toBe(0);
    expect(fixedAimShoot.healPickupsCollected.max).toBe(0);
  });

  it("keeps a 15 minute accelerated endless run finite and bounded", () => {
    const soakConfig = {
      ...SIMULATION_CONFIG,
      player: { ...SIMULATION_CONFIG.player, maxHp: 1_000_000_000 },
    };
    const world = createWorld(soakConfig);
    const random = createRandomStreams(20260710);
    const frameRate = 30;
    const frames = 15 * 60 * frameRate;
    let maxEnemies = 0;
    let maxProjectiles = 0;
    let maxPickups = 0;
    const startedAt = performance.now();

    for (let frame = 0; frame < frames; frame += 1) {
      const angle = frame / 180;
      const target = {
        x: SIMULATION_CONFIG.arena.width / 2 + Math.cos(angle) * 170,
        y: SIMULATION_CONFIG.arena.height / 2 + Math.sin(angle) * 105,
      };
      const dx = target.x - world.player.position.x;
      const dy = target.y - world.player.position.y;
      const length = Math.hypot(dx, dy) || 1;
      const nearestEnemy = world.enemies.reduce<(typeof world.enemies)[number] | null>(
        (nearest, enemy) => {
          if (!nearest) return enemy;
          const nearestDistance = Math.hypot(
            nearest.position.x - world.player.position.x,
            nearest.position.y - world.player.position.y,
          );
          const enemyDistance = Math.hypot(
            enemy.position.x - world.player.position.x,
            enemy.position.y - world.player.position.y,
          );
          return enemyDistance < nearestDistance ? enemy : nearest;
        },
        null,
      );
      const input =
        world.state.status === "contractSelect"
          ? { ...neutralInput, contractChoicePressed: 0 }
          : world.state.status === "upgradeSelect"
          ? { ...neutralInput, upgradeChoicePressed: 0 }
          : {
              ...neutralInput,
              move: { x: dx / length, y: dy / length },
              aimWorld: nearestEnemy?.position ?? {
                x: world.player.position.x + 100,
                y: world.player.position.y,
              },
              shootHeld: true,
            };

      stepWorld(world, input, 1 / frameRate, random, soakConfig);
      maxEnemies = Math.max(maxEnemies, world.enemies.length);
      maxProjectiles = Math.max(
        maxProjectiles,
        world.bullets.length + world.enemyProjectiles.length,
      );
      maxPickups = Math.max(maxPickups, world.pickups.length);
    }

    expect(world.state.elapsed).toBeGreaterThanOrEqual(899);
    expect(world.state.status).not.toBe("gameOver");
    expect(maxEnemies).toBeLessThanOrEqual(76);
    expect(maxProjectiles).toBeLessThanOrEqual(220);
    expect(maxPickups).toBeLessThanOrEqual(2_000);
    expect(Number.isFinite(world.player.position.x)).toBe(true);
    expect(Number.isFinite(world.player.position.y)).toBe(true);
    expect(performance.now() - startedAt).toBeLessThan(5_000);
  });

  it("compares Pulse and Spread across ten fixed seeds with build and encounter KPIs", () => {
    const seeds = Array.from({ length: 10 }, (_, index) => 20260619 + index);
    const comparison = runStartingWeaponComparison({
      config: SIMULATION_CONFIG,
      seeds,
      inputModels: ["kiteCollect"],
      durationSeconds: 180,
      frameRate: 30,
    });

    expect(comparison.pulse.runs).toHaveLength(10);
    expect(comparison.spread.runs).toHaveLength(10);
    expect(comparison.pulse.runs.every((run) => run.weaponType === "pulse")).toBe(true);
    expect(comparison.spread.runs.every((run) => run.weaponType === "spread")).toBe(true);
    expect(comparison.pulse.violations).toEqual([]);
    expect(comparison.spread.violations).toEqual([]);
    for (const report of [comparison.pulse, comparison.spread]) {
      const summary = report.summary.byModel.kiteCollect;
      expect(summary.projectileHitRate.p50).toBeGreaterThan(0);
      expect(summary.uniqueEnemiesPerHitVolley.p50).toBeGreaterThanOrEqual(1);
      expect(summary.encounterActiveMovement.p50).toBeGreaterThan(0);
      expect(report.runs.every((run) => run.encounterScheduledAt !== null)).toBe(true);
    }
  });
});

function expectWithinBaseline(value: number, baseline: number, tolerance = 0.2): void {
  const lower = baseline * (1 - tolerance);
  const upper = baseline * (1 + tolerance);
  expect(value).toBeGreaterThanOrEqual(lower);
  expect(value).toBeLessThanOrEqual(upper);
}
