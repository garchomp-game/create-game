import { describe, expect, it } from "vitest";
import {
  EX_PROTOCOL_BALANCE_SEEDS,
  runExProtocolBalanceMatrix,
} from "./exProtocolBalanceProbe";

declare const process: { env: Record<string, string | undefined> };

const fullMatrix = process.env.ARENA_EX_PROTOCOL_FULL_PROBE === "1";
const developmentSeedCount = readPositiveInteger(
  process.env.ARENA_EX_PROTOCOL_PROBE_SEED_COUNT,
  2,
);
const seeds = fullMatrix
  ? EX_PROTOCOL_BALANCE_SEEDS
  : EX_PROTOCOL_BALANCE_SEEDS.slice(0, developmentSeedCount);
const durationSeconds = fullMatrix
  ? 75
  : readPositiveInteger(
      process.env.ARENA_EX_PROTOCOL_PROBE_DURATION,
      30,
    );

describe("EX Protocol paired balance probe", () => {
  it(
    fullMatrix
      ? "runs the release 20-seed paired matrix"
      : "runs the deterministic PR smoke matrix",
    () => {
      const report = runExProtocolBalanceMatrix({
        seeds,
        durationSeconds,
      });
      console.log(
        JSON.stringify(
          {
            seeds: report.seeds,
            startElapsedSeconds: report.startElapsedSeconds,
            durationSeconds: report.durationSeconds,
            summaries: report.summaries,
            ...(process.env.ARENA_EX_PROTOCOL_PROBE_VERBOSE === "1"
              ? { runs: report.runs }
              : {}),
          },
          null,
          2,
        ),
      );

      expect(report.violations).toEqual([]);
      expect(report.summaries).toHaveLength(6);
      for (const summary of report.summaries) {
        expect(summary.runs).toBe(seeds.length);
      }
      for (const run of report.runs) {
        expect(run.maximumEnemies).toBeLessThanOrEqual(96);
        expect(run.maximumProjectiles).toBeLessThanOrEqual(300);
        expect(run.maximumPickups).toBeLessThanOrEqual(2_000);
        expect(run.maximumActivationTrackers).toBeLessThanOrEqual(16);
        expect(run.maximumAegisCandidates).toBeLessThanOrEqual(4_096);
        expect(run.maximumCollisionResolved).toBeLessThanOrEqual(2_048);
      }
      if (fullMatrix) {
        for (const summary of report.summaries) {
          expect(summary.runs).toBe(20);
        }
        for (const protocolId of report.summaries.map(
          ({ protocolId }) => protocolId,
        )) {
          const paths = report.runs
            .filter(({ variantId }) => variantId === protocolId)
            .reduce<Record<string, number>>((counts, run) => {
              counts[run.pathId!] = (counts[run.pathId!] ?? 0) + 1;
              return counts;
            }, {});
          expect(Object.values(paths).sort()).toEqual([5, 5, 5, 5]);
        }
      }
    },
    fullMatrix ? 900_000 : 120_000,
  );

  it("replays a fixed smoke matrix to identical world hashes", () => {
    const options = {
      seeds: [EX_PROTOCOL_BALANCE_SEEDS[0]!],
      durationSeconds: 12,
    };
    const first = runExProtocolBalanceMatrix(options);
    const second = runExProtocolBalanceMatrix(options);

    expect(second.runs.map(({ worldHash }) => worldHash)).toEqual(
      first.runs.map(({ worldHash }) => worldHash),
    );
  }, 120_000);
});

function readPositiveInteger(
  value: string | undefined,
  fallback: number,
): number {
  if (!value) return fallback;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`Expected a positive integer, received "${value}".`);
  }
  return parsed;
}
