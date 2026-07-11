import { describe, expect, it } from "vitest";
import type { RunResultSummary } from "../domain/types";
import type { RunComparisonKey, RunContext, RunRecord } from "../domain/runRecords";
import { runRecordSchema } from "../domain/runRecords";
import {
  compareRunRecords,
  createRankEligibility,
  createRunRecord,
  selectPersonalBest,
  selectRanking,
} from "./runRecords";

const comparisonKey: RunComparisonKey = {
  modeId: "endless",
  stageId: "arena-default",
  difficultyId: "standard",
  rulesetVersion: "rules-v1",
  seedCategory: "random",
};

describe("run records", () => {
  it("marks manual standard runs eligible and excludes debug or test runs", () => {
    expect(createRankEligibility("manual")).toEqual({ eligible: true, reasons: [] });
    expect(createRankEligibility("debug")).toEqual({
      eligible: false,
      reasons: ["debugRun"],
    });
    expect(createRankEligibility("test", false)).toEqual({
      eligible: false,
      reasons: ["automatedTest", "nonStandardRuleset"],
    });
  });

  it("creates a compact immutable record from a run summary", () => {
    const context = makeContext();
    const summary = makeSummary({ score: 4200 });
    const upgradeRanks = makeUpgradeRanks();
    const record = createRunRecord({
      context,
      capturedAt: "2026-07-10T10:05:00.000Z",
      summary,
      upgradeRanks,
    });

    context.modifierIds.push("late-change");
    context.rankEligibility.reasons.push("debugRun");
    upgradeRanks.rapidFire = 5;

    expect(record).toMatchObject({
      schemaVersion: 1,
      id: "run-1",
      score: 4200,
      kills: 80,
      modifierIds: ["auto-fire:on"],
      rankEligibility: { eligible: true, reasons: [] },
      upgradeRanks: { rapidFire: 2 },
    });
  });

  it("ranks only eligible records from the same comparison key", () => {
    const records = [
      makeRecord({ id: "low", score: 1000, elapsed: 80 }),
      makeRecord({ id: "best", score: 2200, elapsed: 100 }),
      makeRecord({ id: "debug", score: 9000, origin: "debug" }),
      makeRecord({ id: "fixed", score: 5000, seedCategory: "fixed" }),
    ];

    expect(selectRanking(records, comparisonKey).map((record) => record.id)).toEqual([
      "best",
      "low",
    ]);
    expect(selectPersonalBest(records, comparisonKey)?.id).toBe("best");
  });

  it("uses elapsed, captured time, and id as deterministic tie breakers", () => {
    const records = [
      makeRecord({ id: "b", score: 100, elapsed: 30, capturedAt: "2026-07-10T10:00:00Z" }),
      makeRecord({ id: "a", score: 100, elapsed: 30, capturedAt: "2026-07-10T10:00:00Z" }),
      makeRecord({ id: "long", score: 100, elapsed: 31 }),
    ];

    expect([...records].sort(compareRunRecords).map((record) => record.id)).toEqual([
      "long",
      "a",
      "b",
    ]);
  });

  it("rejects contradictory rank eligibility data", () => {
    const record = makeRecord();
    record.rankEligibility = { eligible: true, reasons: ["debugRun"] };
    expect(runRecordSchema.safeParse(record).success).toBe(false);
  });

  it("rejects a record with an invalid capture timestamp", () => {
    const record = makeRecord();
    record.capturedAt = "not-a-timestamp";
    expect(runRecordSchema.safeParse(record).success).toBe(false);
  });
});

function makeContext(): RunContext {
  return {
    id: "run-1",
    profileId: "guest-1",
    startedAt: "2026-07-10T10:00:00.000Z",
    ...comparisonKey,
    weaponId: "pulse",
    modifierIds: ["auto-fire:on"],
    appVersion: "0.5",
    buildCommit: "abc123",
    seed: 42,
    runOrigin: "manual",
    rankEligibility: createRankEligibility("manual"),
  };
}

function makeSummary(overrides: Partial<RunResultSummary> = {}): RunResultSummary {
  return {
    elapsed: 120,
    score: 2000,
    hp: 0,
    level: 8,
    xp: 4,
    shotsFired: 200,
    enemiesKilled: 80,
    hitsTaken: 4,
    damageTaken: 100,
    damageTakenBySource: { contact: 80, projectile: 20 },
    lastDamageSource: { kind: "contact", enemyId: "enemy-1", enemyType: "chaser" },
    xpCollected: 90,
    pickupsCollected: 90,
    hpRecovered: 12,
    healPickupsCollected: 2,
    effectiveHealPickupsCollected: 1,
    upgradesChosen: 7,
    weaponMetrics: {
      pulse: { shotsFired: 200, projectilesFired: 200, hits: 90, kills: 80 },
      spread: { shotsFired: 0, projectilesFired: 0, hits: 0, kills: 0 },
      pierce: { shotsFired: 0, projectilesFired: 0, hits: 0, kills: 0 },
    },
    ...overrides,
  };
}

function makeUpgradeRanks() {
  return {
    rapidFire: 2,
    swiftStep: 1,
    vitalCore: 0,
    overdriveRounds: 2,
    splitShot: 1,
    piercingRounds: 1,
  };
}

function makeRecord(
  overrides: {
    id?: string;
    score?: number;
    elapsed?: number;
    capturedAt?: string;
    origin?: RunContext["runOrigin"];
    seedCategory?: RunContext["seedCategory"];
  } = {},
): RunRecord {
  const context = makeContext();
  context.id = overrides.id ?? context.id;
  context.runOrigin = overrides.origin ?? context.runOrigin;
  context.seedCategory = overrides.seedCategory ?? context.seedCategory;
  context.rankEligibility = createRankEligibility(context.runOrigin);

  return createRunRecord({
    context,
    capturedAt: overrides.capturedAt ?? "2026-07-10T10:05:00.000Z",
    summary: makeSummary({
      score: overrides.score ?? 2000,
      elapsed: overrides.elapsed ?? 120,
    }),
    upgradeRanks: makeUpgradeRanks(),
  });
}
