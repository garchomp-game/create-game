import { describe, expect, it } from "vitest";
import {
  EARLY_CURVE_PROBE_SEEDS,
  runEarlyCurveProbe,
} from "../src/simulation/earlyCurveProbe";

declare const process: { env: Record<string, string | undefined> };

const fullProbe = process.env.ARENA_V08_EARLY_CURVE_FULL === "1";
const rulesetProfileId =
  process.env.ARENA_V08_UPGRADE_CATEGORY_FLOOR === "1"
    ? "candidate-upgrade-floor-endless-v08"
    : "candidate-ex-endless-c2";
const seeds = fullProbe
  ? EARLY_CURVE_PROBE_SEEDS
  : EARLY_CURVE_PROBE_SEEDS.slice(0, 2);
const pressureDurationSeconds = fullProbe ? 150 : 90;
const pressureWindowSeconds = fullProbe ? 125 : 60;

describe("v0.8 beginner curve baseline probe", () => {
  it(
    fullProbe
      ? "captures the 12-seed release baseline"
      : "captures the deterministic development baseline",
    () => {
      const pressureReport = runEarlyCurveProbe({
        seeds,
        durationSeconds: pressureDurationSeconds,
        frameRate: 20,
        pressureWindowSeconds,
        pressureBinSeconds: 5,
        choiceDwellSeconds: 1.5,
        profile: "fair",
        rulesetProfileId,
      });
      const progressionReport = fullProbe
        ? runEarlyCurveProbe({
            seeds,
            durationSeconds: 650,
            frameRate: 20,
            pressureWindowSeconds: 60,
            pressureBinSeconds: 5,
            choiceDwellSeconds: 1.5,
            profile: "fair",
            survivalControl: "refresh-health",
            collectionControl: "vacuum-xp",
            patrolStrategy: "periodic-v3",
            stopWhenExStarts: true,
            rulesetProfileId,
          })
        : pressureReport;
      console.log(
        JSON.stringify(
          {
            seeds: pressureReport.seeds,
            frameRate: pressureReport.frameRate,
            pressureWindowSeconds:
              pressureReport.pressureWindowSeconds,
            pressureBinSeconds: pressureReport.pressureBinSeconds,
            choiceDwellSeconds: pressureReport.choiceDwellSeconds,
            rulesetProfileId,
            pressure: {
              profile: pressureReport.profile,
              durationSeconds: pressureReport.durationSeconds,
              summaries: pressureReport.summaries,
            },
            progression: {
              profile: progressionReport.profile,
              survivalControl: progressionReport.survivalControl,
              collectionControl:
                progressionReport.collectionControl,
              patrolStrategy: progressionReport.patrolStrategy,
              stopWhenExStarts: progressionReport.stopWhenExStarts,
              durationSeconds: progressionReport.durationSeconds,
              summaries: Object.fromEntries(
                Object.entries(progressionReport.summaries).map(
                  ([weaponType, summary]) => [
                    weaponType,
                    {
                      runs: summary.runs,
                      survivedSeconds: summary.survivedSeconds,
                      milestones: summary.milestones,
                    },
                  ],
                ),
              ),
            },
            ...(process.env.ARENA_V08_EARLY_CURVE_VERBOSE === "1"
              ? {
                  pressureRuns: pressureReport.runs,
                  progressionRuns: progressionReport.runs,
                }
              : {}),
          },
          null,
          2,
        ),
      );

      expect(pressureReport.violations).toEqual([]);
      expect(progressionReport.violations).toEqual([]);
      expect(pressureReport.runs).toHaveLength(seeds.length * 2);
      for (const run of pressureReport.runs) {
        expect(run.pressureBins).toHaveLength(
          Math.ceil(pressureWindowSeconds / 5),
        );
        expect(run.milestones.level2).not.toBeNull();
        expect(run.milestones.firstUpgrade).not.toBeNull();
        expect(run.milestones.firstUpgrade!.gameplayElapsed).toBe(
          run.milestones.level2!.gameplayElapsed,
        );
      }
      for (const weaponType of ["pulse", "spread"] as const) {
        const summary = pressureReport.summaries[weaponType];
        expect(summary.runs).toBe(
          seeds.length,
        );
        if (fullProbe) {
          expect(
            summary.milestones.level5.reached,
          ).toBeGreaterThan(0);
          const beforeBoundary = summary.pressureBins.find(
            (bin) => bin.start === 25,
          )!;
          const afterBoundary = summary.pressureBins.find(
            (bin) => bin.start === 30,
          )!;
          const bruteIntroduction = summary.pressureBins.find(
            (bin) => bin.start === 60,
          )!;
          const fastIntroduction = summary.pressureBins.find(
            (bin) => bin.start === 120,
          )!;
          expect(afterBoundary.spawned.p50).toBeGreaterThanOrEqual(4);
          expect(afterBoundary.spawned.p50).toBeLessThanOrEqual(6);
          expect(afterBoundary.spawned.p50).toBeLessThanOrEqual(
            beforeBoundary.spawned.p50 * 1.5,
          );
          expect(afterBoundary.averageOnScreenEnemies.p50).toBeLessThanOrEqual(
            beforeBoundary.averageOnScreenEnemies.p50 * 1.5,
          );
          expect(afterBoundary.spawnedByTypeP50.fast).toBe(0);
          expect(afterBoundary.spawnedByTypeP50.ranged).toBe(0);
          expect(bruteIntroduction.spawnedByTypeP50.brute).toBeGreaterThan(0);
          expect(bruteIntroduction.spawnedByTypeP50.fast).toBe(0);
          expect(bruteIntroduction.spawnedByTypeP50.ranged).toBe(0);
          expect(fastIntroduction.spawnedByTypeP50.fast).toBeGreaterThan(0);
          expect(fastIntroduction.spawnedByTypeP50.ranged).toBe(0);
        }
      }
    },
    fullProbe ? 900_000 : 120_000,
  );

  it("replays an identical seed to the same report", () => {
    const options = {
      seeds: [EARLY_CURVE_PROBE_SEEDS[0]!],
      durationSeconds: 45,
      frameRate: 20,
      pressureWindowSeconds: 45,
      pressureBinSeconds: 5,
      choiceDwellSeconds: 0.2,
    };
    const first = runEarlyCurveProbe(options);
    const second = runEarlyCurveProbe(options);

    expect(second.runs).toEqual(first.runs);
  }, 120_000);
});
