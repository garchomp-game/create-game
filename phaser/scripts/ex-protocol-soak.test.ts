import { describe, expect, it } from "vitest";
import { runExProtocolSoakProbe } from "./exProtocolSoakProbe";

declare const process: { env: Record<string, string | undefined> };

const fullSoak = process.env.ARENA_EX_PROTOCOL_FULL_SOAK === "1";

describe("EX Protocol paired headless soak", () => {
  it(
    fullSoak
      ? "holds all absolute and paired release budgets"
      : "holds all absolute and paired smoke budgets",
    () => {
      const report = runExProtocolSoakProbe({
        durationSeconds: fullSoak ? 90 : 15,
      });
      console.log(JSON.stringify(report, null, 2));

      expect(report.runs).toHaveLength(8);
      expect(report.violations).toEqual([]);
      for (const run of report.runs) {
        expect(run.endedStatus).not.toBe("gameOver");
        expect(run.maximumEnemies).toBeLessThanOrEqual(96);
        expect(run.maximumPlayerBullets).toBeLessThanOrEqual(60);
        expect(run.maximumProjectiles).toBeLessThanOrEqual(300);
        expect(run.maximumPickups).toBeLessThanOrEqual(2_000);
        expect(run.maximumActivationTrackers).toBeLessThanOrEqual(16);
        expect(run.staleActivationTrackersAfterDrain).toBe(0);
        expect(run.maximumAegisCandidates).toBeLessThanOrEqual(4_096);
        expect(
          run.maximumAegisInterceptionCandidates,
        ).toBeLessThanOrEqual(4_096);
        expect(run.maximumCollisionResolved).toBeLessThanOrEqual(2_048);
      }
    },
    fullSoak ? 600_000 : 120_000,
  );
});
