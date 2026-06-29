import { describe, expect, it } from "vitest";
import { SIMULATION_CONFIG } from "../config/gameConfig";
import { createRandom } from "../math/random";
import { runBalanceProbe } from "./balanceProbe";
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
};

const balanceProbeSeeds = [20260619, 20260620, 20260621, 20260622, 20260623];

const balanceBaseline = {
  noInputSurvivalP50: 6.77,
  fixedAimShootSurvivalP50: 6.77,
  kiteCollectSurvivalP50: 161.77,
  kiteCollectKillsPerMinuteP50: 165.47,
  kiteCollectScorePerMinuteP50: 2269.74,
  kiteCollectFirstDamageP50: 101.57,
  kiteCollectFirstUpgradeP50: 7.13,
  kiteCollectWaveReachedP50: 90,
  kiteCollectMaxEnemiesMax: 34,
  kiteCollectMaxBulletsMax: 32,
  kiteCollectHpRecoveredP50: 88,
  kiteCollectHealPickupsCollectedP50: 29,
  kiteCollectEffectiveHealPickupsCollectedP50: 8,
};

describe("balance simulation", () => {
  it("keeps a fixed 60 second run within population budgets", () => {
    const world = createWorld(SIMULATION_CONFIG);
    world.state.hp = 100_000;
    const random = createRandom(SIMULATION_CONFIG.seed);
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

    // v0.4 Obstacle Layout balance baseline. These probes are regression sentries,
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
});

function expectWithinBaseline(value: number, baseline: number, tolerance = 0.2): void {
  const lower = baseline * (1 - tolerance);
  const upper = baseline * (1 + tolerance);
  expect(value).toBeGreaterThanOrEqual(lower);
  expect(value).toBeLessThanOrEqual(upper);
}
