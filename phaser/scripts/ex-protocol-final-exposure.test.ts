import { describe, expect, it } from "vitest";
import type { ExProtocolProbePath } from "./exProtocolProbePolicy";
import {
  EX_PROTOCOL_BALANCE_SEEDS,
} from "./exProtocolBalanceProbe";
import {
  executeExpedition,
  type ProbeResult,
} from "./v07ExpeditionProbe";

declare const process: { env: Record<string, string | undefined> };

const fullProbe =
  process.env.ARENA_EX_PROTOCOL_FINAL_EXPOSURE_FULL === "1";
const seeds = fullProbe
  ? EX_PROTOCOL_BALANCE_SEEDS
  : EX_PROTOCOL_BALANCE_SEEDS.slice(0, 1);
const weapons: Array<"pulse" | "spread"> = fullProbe
  ? ["pulse", "spread"]
  : ["pulse"];

const PATHS: Record<"pulse" | "spread", ExProtocolProbePath> = {
  pulse: {
    protocolId: "pulse.rebound-overdrive",
    evolutionOneId: "rapid-chamber",
    evolutionTwoId: "double-reflection",
  },
  spread: {
    protocolId: "spread.full-span-tidal-sweep",
    evolutionOneId: "wide-wake",
    evolutionTwoId: "double-reservoir",
  },
};

describe("EX Protocol Final Expedition exposure", () => {
  it(
    fullProbe
      ? "meets the release exposure gate across 20 paired seeds"
      : "reaches Protocol selection in the fixed-seed smoke run",
    () => {
      const results = weapons.flatMap((weaponId) =>
        seeds.map((seed) =>
          executeExpedition(weaponId, seed, {
            rulesetProfileId: "candidate-ex-final-expedition-c1",
            exProtocolPath: PATHS[weaponId],
          }).result,
        ),
      );
      const summary = summarizeExposure(results);
      console.log(JSON.stringify({ summary, results }, null, 2));

      expect(summary.coreCompletingRuns).toBeGreaterThan(0);
      expect(
        results.every(
          ({ exProtocolSelectedId }) => exProtocolSelectedId !== null,
        ),
      ).toBe(true);
      if (fullProbe) {
        expect(summary.exposureAtLeast60Rate).toBeGreaterThanOrEqual(0.9);
        expect(summary.medianExposureSeconds).toBeGreaterThanOrEqual(120);
      }
    },
    fullProbe ? 3_600_000 : 300_000,
  );
});

function summarizeExposure(results: ProbeResult[]): {
  runs: number;
  coreCompletingRuns: number;
  exposureAtLeast60Rate: number;
  medianExposureSeconds: number;
  evolutionOneReachRate: number;
  evolutionTwoMasteryReachRate: number;
  firstLimitBreakReachRate: number;
} {
  const coreCompleting = results.filter(
    ({ exProtocolSelectedAt }) => exProtocolSelectedAt !== null,
  );
  const divisor = Math.max(1, coreCompleting.length);
  return {
    runs: results.length,
    coreCompletingRuns: coreCompleting.length,
    exposureAtLeast60Rate:
      coreCompleting.filter(
        ({ exProtocolExposureSeconds }) =>
          exProtocolExposureSeconds >= 60,
      ).length / divisor,
    medianExposureSeconds: median(
      coreCompleting.map(
        ({ exProtocolExposureSeconds }) =>
          exProtocolExposureSeconds,
      ),
    ),
    evolutionOneReachRate:
      coreCompleting.filter(
        ({ exProtocolEvolutionOneReached }) =>
          exProtocolEvolutionOneReached,
      ).length / divisor,
    evolutionTwoMasteryReachRate:
      coreCompleting.filter(
        ({ exProtocolEvolutionTwoReached, exProtocolMasteryReached }) =>
          exProtocolEvolutionTwoReached &&
          exProtocolMasteryReached,
      ).length / divisor,
    firstLimitBreakReachRate:
      coreCompleting.filter(
        ({ exProtocolLimitBreakReached }) =>
          exProtocolLimitBreakReached,
      ).length / divisor,
  };
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((left, right) => left - right);
  return sorted[Math.floor((sorted.length - 1) / 2)]!;
}
