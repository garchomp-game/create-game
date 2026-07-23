import { describe, expect, it } from "vitest";
import { SIMULATION_CONFIG } from "../../config/gameConfig";
import {
  ENDLESS_RULESET_VERSION,
  EX_PROTOCOL_ENDLESS_RULESET_VERSION,
} from "../../config/version";
import {
  toExProtocolEvolutionId,
  toExProtocolId,
} from "../../content/exProtocolCatalog";
import {
  RUN_RECORD_SCHEMA_VERSION_V3,
  type RunRecordV3,
} from "../../domain/runRecords";
import { createWorld } from "../../simulation/createWorld";
import { createRunResultSummary } from "../../simulation/resultSummary";
import {
  createRankEligibility,
  createRunRecord,
} from "../../application/runRecords";
import {
  decodeRunRecordV3,
  migrateRunRecordV2ToV3,
} from "./runRecordV3Codec";

describe("RunRecord v3 codec", () => {
  it("round-trips a candidate record with a validated Protocol route", () => {
    const record = makeCandidateRecord();

    expect(decodeRunRecordV3(JSON.parse(JSON.stringify(record)))).toEqual({
      ok: true,
      record,
    });
  });

  it("rejects invalid route membership, order, and unknown counters", () => {
    const record = makeCandidateRecord();
    const selectedNotOffered = structuredClone(record);
    selectedNotOffered.exProtocol!.offeredIds = [
      toExProtocolId("pulse.rebound-overdrive"),
    ];
    expect(decodeRunRecordV3(selectedNotOffered)).toMatchObject({
      ok: false,
      error: "Selected EX Protocol must be present in offered IDs.",
    });

    const reversedTimeline = structuredClone(record);
    reversedTimeline.exProtocol!.evolutionOneAtElapsed = 5;
    expect(decodeRunRecordV3(reversedTimeline)).toMatchObject({
      ok: false,
      error: "EX Protocol progression elapsed values must be monotonic.",
    });

    const unknownCounter = structuredClone(record);
    unknownCounter.exProtocol!.counters["unbounded-user-key"] = 1;
    expect(decodeRunRecordV3(unknownCounter)).toMatchObject({
      ok: false,
      error: "EX Protocol counters contain an unknown key.",
    });
  });

  it("rejects a profile, ruleset, RNG, and eligibility mismatch", () => {
    const record = makeCandidateRecord();
    const wrongRng = {
      ...record,
      rngVersion: "arena-rng-v1",
    };
    expect(decodeRunRecordV3(wrongRng)).toMatchObject({
      ok: false,
      error: expect.stringContaining("Illegal RunRecord v3 ruleset tuple"),
    });

    const eligible = structuredClone(record);
    eligible.rankEligibility = { eligible: true, reasons: [] };
    expect(decodeRunRecordV3(eligible)).toMatchObject({
      ok: false,
      error: expect.stringContaining(
        "requires non-standard rank eligibility",
      ),
    });
  });

  it("converts known v2 provenance and leaves unknown legacy tuples explicit", () => {
    const known = createRunRecord({
      ...makeRecordInput(),
      context: {
        ...makeRecordInput().context,
        rulesetVersion: ENDLESS_RULESET_VERSION,
      },
    });
    if (known.schemaVersion !== 2) throw new Error("Expected v2 record.");
    expect(migrateRunRecordV2ToV3(known)).toMatchObject({
      schemaVersion: 3,
      rulesetProfileId: "legacy-endless-v068",
      rngVersion: "arena-rng-v1",
      exProtocol: null,
    });

    const unknown = createRunRecord(makeRecordInput());
    if (unknown.schemaVersion !== 2) throw new Error("Expected v2 record.");
    expect(migrateRunRecordV2ToV3(unknown)).toMatchObject({
      rulesetProfileId: "legacy-unknown",
      rngVersion: "legacy-unknown",
      exProtocol: null,
    });
  });
});

function makeCandidateRecord(): RunRecordV3 {
  const world = createWorld(SIMULATION_CONFIG);
  const protocolId = toExProtocolId("pulse.resonance-relay");
  world.stats.exProtocolMetrics = {
    ...world.stats.exProtocolMetrics,
    offeredIds: [
      protocolId,
      toExProtocolId("pulse.rebound-overdrive"),
      toExProtocolId("pulse.redline-core"),
    ],
    selectedId: protocolId,
    selectedAtElapsed: 10,
    evolutionOneId: toExProtocolEvolutionId(
      protocolId,
      "evolutionOne",
      "extended-coupling",
    ),
    evolutionOneAtElapsed: 20,
    evolutionTwoId: toExProtocolEvolutionId(
      protocolId,
      "evolutionTwo",
      "residual-anchor",
    ),
    evolutionTwoAtElapsed: 30,
    masteryId: "crosslink",
    masteryAtElapsed: 30,
    limitBreakFirstAtElapsed: 40,
    protocolSourceDamage: 12,
    protocolBonusDamageAttributed: 0,
    protocolSourceKills: 2,
    counters: {
      protocolExposureSeconds: 50,
      relayAttempts: 2,
      relayResolved: 2,
    },
  };
  const record = createRunRecord({
    context: {
      ...makeRecordInput().context,
      appVersion: "0.8.0-candidate.1",
      rulesetVersion: EX_PROTOCOL_ENDLESS_RULESET_VERSION,
      rulesetProfileId: "candidate-ex-endless-c1",
      rngVersion: "arena-rng-v2",
      runRecordSchemaVersion: RUN_RECORD_SCHEMA_VERSION_V3,
      exProtocolsEnabled: true,
      rankEligibility: createRankEligibility("manual", false),
    },
    capturedAt: "2026-07-23T09:01:00.000Z",
    summary: createRunResultSummary(world),
    upgradeRanks: world.progression.upgradeRanks,
    upgradeSelections: [],
    buildCompletedAt: 9,
    exProtocolMetrics: world.stats.exProtocolMetrics,
  });
  if (record.schemaVersion !== RUN_RECORD_SCHEMA_VERSION_V3) {
    throw new Error("Expected RunRecord v3.");
  }
  return record;
}

function makeRecordInput() {
  const world = createWorld(SIMULATION_CONFIG);
  return {
    context: {
      id: "run-v3-codec",
      profileId: "guest-1",
      startedAt: "2026-07-23T09:00:00.000Z",
      modeId: "endless",
      stageId: "arena-default",
      difficultyId: "standard",
      rulesetVersion: "unknown-ruleset",
      seedCategory: "fixed" as const,
      weaponId: "pulse" as const,
      modifierIds: [],
      appVersion: "0.7.0",
      buildCommit: "test",
      seed: 20260723,
      runOrigin: "manual" as const,
      rankEligibility: createRankEligibility("manual"),
      rulesetProfileId: "legacy-endless-v068" as const,
      rngVersion: "arena-rng-v1" as const,
      runRecordSchemaVersion: 2 as const,
      exProtocolsEnabled: false,
    },
    capturedAt: "2026-07-23T09:01:00.000Z",
    summary: createRunResultSummary(world),
    upgradeRanks: world.progression.upgradeRanks,
    upgradeSelections: [],
    buildCompletedAt: null,
  };
}
