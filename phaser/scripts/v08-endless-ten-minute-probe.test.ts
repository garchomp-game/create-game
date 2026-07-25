import { describe, expect, it } from "vitest";
import {
  EARLY_CURVE_PROBE_SEEDS,
  runEarlyCurveProbe,
} from "../src/simulation/earlyCurveProbe";

declare const process: { env: Record<string, string | undefined> };

const releaseProbe =
  process.env.ARENA_V08_ENDLESS_TEN_MINUTE_FULL === "1";
const profile =
  process.env.ARENA_V08_ENDLESS_PROFILE === "fair"
    ? ("fair" as const)
    : ("ceiling" as const);
const durationSeconds = releaseProbe ? 1_500 : 1_000;
const seedCount = Number(
  process.env.ARENA_V08_ENDLESS_SEED_COUNT ?? 3,
);
const seeds = EARLY_CURVE_PROBE_SEEDS.slice(
  0,
  releaseProbe ? 3 : seedCount,
);

describe("v0.8 Endless ten-minute survival curve", () => {
  it(
    releaseProbe
      ? "holds the preregistered long-run release bounds"
      : "screens both weapons through the collapse boundary",
    () => {
      const report = runEarlyCurveProbe({
        seeds,
        durationSeconds,
        frameRate: 20,
        pressureWindowSeconds: 0,
        pressureBinSeconds: 5,
        choiceDwellSeconds: 0.2,
        profile,
        patrolStrategy: "periodic-v3",
      });
      console.log(
        JSON.stringify(
          {
            seeds: report.seeds,
            durationSeconds,
            summaries: report.summaries,
            runs: report.runs.map((run) => ({
              seed: run.seed,
              weaponType: run.weaponType,
              survivedSeconds: run.survivedSeconds,
              endedStatus: run.endedStatus,
              level: run.level,
              extraLevel: run.extraLevel,
              extraCycle: run.extraCycle,
              score: run.score,
              kills: run.kills,
              xpCollected: run.xpCollected,
              threatTier: run.threatTier,
              collapseStage: run.collapseStage,
              damageTaken: run.damageTaken,
              damageTakenBySource: run.damageTakenBySource,
              lastDamageSource: run.lastDamageSource,
              milestones: run.milestones,
              worldHash: run.worldHash,
            })),
          },
          null,
          2,
        ),
      );

      expect(report.violations).toEqual([]);
      expect(report.runs).toHaveLength(seeds.length * 2);
      for (const run of report.runs) {
        expect(run.milestones.firstUpgrade).not.toBeNull();
        expect(run.milestones.firstUpgrade!.gameplayElapsed).toBeGreaterThanOrEqual(
          25,
        );
      }

      if (releaseProbe) {
        for (const weaponType of ["pulse", "spread"] as const) {
          const runs = report.runs.filter(
            (run) => run.weaponType === weaponType,
          );
          expect(
            runs.some((run) => run.survivedSeconds >= 900),
          ).toBe(true);
          expect(
            runs.every(
              (run) =>
                run.endedStatus === "gameOver" &&
                run.survivedSeconds <= 1_500,
            ),
          ).toBe(true);
        }
      }
    },
    releaseProbe ? 900_000 : 300_000,
  );

  it("replays the long-run opening deterministically", () => {
    const options = {
      seeds: [EARLY_CURVE_PROBE_SEEDS[0]!],
      durationSeconds: 180,
      frameRate: 20,
      pressureWindowSeconds: 0,
      pressureBinSeconds: 5,
      choiceDwellSeconds: 0.2,
      profile,
      patrolStrategy: "periodic-v3" as const,
    };

    expect(runEarlyCurveProbe(options).runs).toEqual(
      runEarlyCurveProbe(options).runs,
    );
  }, 180_000);
});
