import { describe, expect, it } from "vitest";
import {
  decodeV1EnvelopeRaw,
  decodeV2EnvelopeRaw,
} from "./legacyRunRecordDecoder";
import {
  ENDLESS_RULESET_VERSION,
} from "../../config/version";
import { createWorld } from "../../simulation/createWorld";
import { SIMULATION_CONFIG } from "../../config/gameConfig";
import { createRunResultSummary } from "../../simulation/resultSummary";
import {
  createRankEligibility,
  createRunRecord,
} from "../../application/runRecords";

describe("read-only legacy run record decoding", () => {
  it("keeps v2 history and rankings completeness independent", () => {
    const record = makeV2Record();
    const result = decodeV2EnvelopeRaw(
      JSON.stringify({
        schemaVersion: 2,
        history: [record, { invalid: true }],
        rankings: [record],
      }),
    );

    expect(result.history).toMatchObject({
      status: "partial",
      rejectedCount: 1,
      validRecords: [record],
    });
    expect(result.rankings).toEqual({
      status: "complete",
      validRecords: [record],
      orderedIds: [record.id],
    });
  });

  it("projects a v1 records list into both memberships without mutation", () => {
    const record = makeV2Record();
    const legacyRecord = {
      ...record,
      schemaVersion: 1,
      upgradeRanks: {
        rapidFire: 0,
        swiftStep: 0,
        vitalCore: 0,
        overdriveRounds: 0,
        splitShot: 0,
        piercingRounds: 0,
      },
    };
    delete (legacyRecord as Partial<typeof legacyRecord>).upgradeSelections;
    delete (legacyRecord as Partial<typeof legacyRecord>).buildCompletedAt;
    delete (legacyRecord as Partial<typeof legacyRecord>).capstoneMetrics;
    const raw = JSON.stringify({
      schemaVersion: 1,
      records: [legacyRecord],
    });

    const result = decodeV1EnvelopeRaw(raw);

    expect(result.history.status).toBe("complete");
    expect(result.rankings.status).toBe("complete");
    expect(raw).toBe(
      JSON.stringify({ schemaVersion: 1, records: [legacyRecord] }),
    );
  });

  it("reports malformed raw as invalid rather than missing", () => {
    expect(decodeV2EnvelopeRaw("{")).toMatchObject({
      history: { status: "invalid" },
      rankings: { status: "invalid" },
    });
    expect(decodeV1EnvelopeRaw(null)).toEqual({
      source: "v1",
      history: { status: "missing" },
      rankings: { status: "missing" },
    });
  });
});

function makeV2Record() {
  const world = createWorld(SIMULATION_CONFIG);
  const record = createRunRecord({
    context: {
      id: "legacy-record",
      profileId: "guest-1",
      startedAt: "2026-07-23T00:00:00.000Z",
      modeId: "endless",
      stageId: "arena-default",
      difficultyId: "standard",
      rulesetVersion: ENDLESS_RULESET_VERSION,
      seedCategory: "random",
      weaponId: "pulse",
      modifierIds: [],
      appVersion: "0.7.0",
      buildCommit: "test",
      seed: 7,
      runOrigin: "manual",
      rankEligibility: createRankEligibility("manual"),
      rulesetProfileId: "legacy-endless-v068",
      rngVersion: "arena-rng-v1",
      runRecordSchemaVersion: 2,
      exProtocolsEnabled: false,
    },
    capturedAt: "2026-07-23T00:01:00.000Z",
    summary: createRunResultSummary(world),
    upgradeRanks: world.progression.upgradeRanks,
    upgradeSelections: [],
    buildCompletedAt: null,
  });
  if (record.schemaVersion !== 2) throw new Error("Expected v2 record.");
  return record;
}
