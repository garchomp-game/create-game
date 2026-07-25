import { describe, expect, it } from "vitest";
import { SIMULATION_CONFIG } from "../config/gameConfig";
import {
  ENDLESS_RULESET_VERSION,
  EX_PROTOCOL_ENDLESS_RULESET_VERSION,
} from "../config/version";
import {
  migrateRunRecordV2ToV3,
} from "../adapters/storage/runRecordV3Codec";
import type { RunRecord, RunRecordV2, RunRecordV3 } from "../domain/runRecords";
import {
  normalizeRunModifiers,
  resolveRunRecordContract,
} from "../domain/runRecordContract";
import { createWorld } from "../simulation/createWorld";
import { createRunResultSummary } from "../simulation/resultSummary";
import { getRulesetProfiles } from "./RulesetProfileRegistry";
import {
  createRankEligibility,
  createRunComparisonQuery,
  createRunRecord,
  selectPersonalBest,
  selectRanking,
} from "./runRecords";
import {
  classifyPersistedRunRecord,
  createRunComparisonPartition,
} from "./runRecordContract";

describe("run record axis contract", () => {
  it("normalizes versioned modifiers without depending on input order", () => {
    expect(
      normalizeRunModifiers([
        {
          id: "assist.telegraph-window",
          version: 2,
          impact: "simulation",
        },
        {
          id: "accessibility.subtitle",
          version: 1,
          impact: "neutral",
        },
        {
          id: "assist.telegraph-window",
          version: 2,
          impact: "simulation",
        },
      ]),
    ).toEqual([
      {
        id: "accessibility.subtitle",
        version: 1,
        impact: "neutral",
        canonicalId: "accessibility.subtitle@v1",
      },
      {
        id: "assist.telegraph-window",
        version: 2,
        impact: "simulation",
        canonicalId: "assist.telegraph-window@v2",
      },
    ]);
  });

  it("rejects invalid IDs, versions, and conflicting modifier definitions", () => {
    expect(() =>
      normalizeRunModifiers([
        { id: "Assist Damage", version: 1, impact: "simulation" },
      ])
    ).toThrow("lowercase dot/hyphen segments");
    expect(() =>
      normalizeRunModifiers([
        {
          id: "assist.damage-taken",
          version: 0,
          impact: "simulation",
        },
      ])
    ).toThrow("positive integer");
    expect(() =>
      normalizeRunModifiers([
        {
          id: "assist.damage-taken",
          version: 1,
          impact: "simulation",
        },
        {
          id: "assist.damage-taken",
          version: 2,
          impact: "simulation",
        },
      ])
    ).toThrow("conflicting definitions");
    expect(() =>
      normalizeRunModifiers([
        {
          id: "assist.damage-taken",
          version: 1,
          impact: "unknown" as "simulation",
        },
      ])
    ).toThrow("Unknown run modifier impact");
  });

  it("keeps neutral accessibility settings in Standard", () => {
    expect(
      resolveRunRecordContract({
        storagePolicy: "record",
        requestedComparisonPolicy: "standard",
        runOrigin: "manual",
        modifiers: [
          {
            id: "accessibility.subtitle",
            version: 1,
            impact: "neutral",
          },
        ],
      }),
    ).toEqual({
      storagePolicy: "record",
      comparisonPolicy: "standard",
      standardPbEligible: true,
      normalizedModifierIds: ["accessibility.subtitle@v1"],
      comparisonModifierIds: [],
      exclusionReasons: [],
    });
  });

  it("fails closed when a simulation modifier requests Standard", () => {
    expect(
      resolveRunRecordContract({
        storagePolicy: "record",
        requestedComparisonPolicy: "standard",
        runOrigin: "manual",
        modifiers: [assistDamageModifier()],
      }),
    ).toMatchObject({
      comparisonPolicy: "none",
      standardPbEligible: false,
      exclusionReasons: [
        "simulationModifierRequiresScopedComparison",
      ],
    });
  });

  it("creates order-independent condition-scoped Assist partitions", () => {
    const contractA = resolveRunRecordContract({
      storagePolicy: "record",
      requestedComparisonPolicy: "condition-scoped",
      runOrigin: "manual",
      modifiers: [
        {
          id: "assist.telegraph-window",
          version: 1,
          impact: "simulation",
        },
        assistDamageModifier(),
      ],
    });
    const contractB = resolveRunRecordContract({
      storagePolicy: "record",
      requestedComparisonPolicy: "condition-scoped",
      runOrigin: "manual",
      modifiers: [
        assistDamageModifier(),
        {
          id: "assist.telegraph-window",
          version: 1,
          impact: "simulation",
        },
      ],
    });
    const source = makeStandardRecord("assist-source", 100);

    const partitionA = createRunComparisonPartition(
      source,
      "weapon",
      contractA,
    );
    const partitionB = createRunComparisonPartition(
      source,
      "weapon",
      contractB,
    );

    expect(partitionA).toEqual(partitionB);
    expect(partitionA).toMatchObject({
      comparisonPolicy: "condition-scoped",
      comparisonModifierIds: [
        "assist.damage-taken@v1",
        "assist.telegraph-window@v1",
      ],
    });

    const changedVersion = resolveRunRecordContract({
      storagePolicy: "record",
      requestedComparisonPolicy: "condition-scoped",
      runOrigin: "manual",
      modifiers: [
        {
          ...assistDamageModifier(),
          version: 2,
        },
      ],
    });
    expect(
      createRunComparisonPartition(
        source,
        "weapon",
        changedVersion,
      )?.partitionKey,
    ).not.toBe(partitionA?.partitionKey);
  });

  it("does not create comparison partitions for Practice or invalid Assist", () => {
    const practice = resolveRunRecordContract({
      storagePolicy: "none",
      requestedComparisonPolicy: "none",
      runOrigin: "manual",
      modifiers: [],
    });
    const invalidAssist = resolveRunRecordContract({
      storagePolicy: "record",
      requestedComparisonPolicy: "condition-scoped",
      runOrigin: "manual",
      modifiers: [],
    });
    const source = makeStandardRecord("no-partition", 100);

    expect(
      createRunComparisonPartition(source, "overall", practice),
    ).toBeNull();
    expect(invalidAssist).toMatchObject({
      comparisonPolicy: "none",
      exclusionReasons: ["conditionScopeRequiresSimulationModifier"],
    });
    expect(
      createRunComparisonPartition(
        source,
        "overall",
        invalidAssist,
      ),
    ).toBeNull();
  });

  it("keeps candidate-off Standard queries and ranking results unchanged", () => {
    const records = [
      makeStandardRecord("low", 100),
      makeStandardRecord("best", 300),
      makeStandardRecord("middle", 200),
    ];
    const source = records[0]!;
    const currentQuery = createRunComparisonQuery(source, "overall");
    const standardContract = resolveRunRecordContract({
      storagePolicy: "record",
      requestedComparisonPolicy: "standard",
      runOrigin: "manual",
      modifiers: [],
    });
    const partition = createRunComparisonPartition(
      source,
      "overall",
      standardContract,
    );

    expect(partition?.query).toEqual(currentQuery);
    expect(
      selectRanking(records, partition!.query).map(({ id }) => id),
    ).toEqual(
      selectRanking(records, currentQuery).map(({ id }) => id),
    );
    expect(
      selectPersonalBest(records, partition!.query)?.id,
    ).toBe(selectPersonalBest(records, currentQuery)?.id);
  });

  it("preserves fixed seed, weapon, ruleset, and profile comparison axes", () => {
    const source = makeStandardRecord("fixed-spread", 100);
    source.seedCategory = "fixed";
    source.seed = 987654;
    source.weaponId = "spread";
    const contract = resolveRunRecordContract({
      storagePolicy: "record",
      requestedComparisonPolicy: "standard",
      runOrigin: "manual",
      modifiers: [],
    });

    expect(
      createRunComparisonPartition(source, "weapon", contract)?.query,
    ).toEqual({
      profileId: "guest-contract",
      modeId: "endless",
      stageId: "arena-default",
      difficultyId: "standard",
      rulesetVersion: ENDLESS_RULESET_VERSION,
      seedCategory: "fixed",
      comparisonScope: "weapon",
      weaponId: "spread",
      seed: 987654,
    });
  });

  it("keeps known v2 and v3 Standard records while isolating unknown provenance", () => {
    const v2 = makeStandardRecord("known-v2", 100);
    if (v2.schemaVersion !== 2) throw new Error("Expected v2.");
    const v3 = migrateRunRecordV2ToV3(v2);
    const unknownV2 = structuredClone(v2);
    unknownV2.rulesetVersion = "legacy-unmapped-ruleset";
    const unknownV3 = migrateRunRecordV2ToV3(unknownV2);
    const invalidTuple = structuredClone(v3);
    invalidTuple.rngVersion = "arena-rng-v2";

    expect(
      classifyPersistedRunRecord(v2, getRulesetProfiles()),
    ).toMatchObject({
      comparisonPolicy: "standard",
      rulesetProfileId: "legacy-endless-v068",
      exclusionReason: null,
    });
    expect(
      classifyPersistedRunRecord(v3, getRulesetProfiles()),
    ).toMatchObject({
      comparisonPolicy: "standard",
      rulesetProfileId: "legacy-endless-v068",
      exclusionReason: null,
    });
    expect(
      classifyPersistedRunRecord(unknownV3, getRulesetProfiles()),
    ).toMatchObject({
      comparisonPolicy: "none",
      rulesetProfileId: "legacy-unknown",
      exclusionReason: "unknownRuleset",
    });
    expect(
      classifyPersistedRunRecord(invalidTuple, getRulesetProfiles()),
    ).toMatchObject({
      comparisonPolicy: "none",
      exclusionReason: "invalidRulesetTuple",
    });
  });

  it("isolates non-standard rulesets and unknown legacy modifiers", () => {
    const standard = makeStandardRecord("legacy-standard", 100);
    if (standard.schemaVersion !== 2) throw new Error("Expected v2.");
    const candidate = makeNonStandardV3(standard);
    const unsupported = structuredClone(standard);
    unsupported.modifierIds.push("assist:unversioned");

    expect(
      classifyPersistedRunRecord(candidate, getRulesetProfiles()),
    ).toMatchObject({
      comparisonPolicy: "none",
      exclusionReason: "rulesetNotStandard",
    });
    expect(
      classifyPersistedRunRecord(
        unsupported,
        getRulesetProfiles(),
      ),
    ).toMatchObject({
      comparisonPolicy: "none",
      exclusionReason: "unsupportedLegacyModifier",
    });
  });
});

function assistDamageModifier() {
  return {
    id: "assist.damage-taken",
    version: 1,
    impact: "simulation" as const,
  };
}

function makeStandardRecord(
  id: string,
  score: number,
): RunRecord {
  const world = createWorld(SIMULATION_CONFIG);
  world.state.score = score;
  const record = createRunRecord({
    context: {
      id,
      profileId: "guest-contract",
      startedAt: "2026-07-25T00:00:00.000Z",
      modeId: "endless",
      stageId: "arena-default",
      difficultyId: "standard",
      rulesetVersion: ENDLESS_RULESET_VERSION,
      seedCategory: "random",
      weaponId: "pulse",
      modifierIds: ["auto-fire:on"],
      appVersion: "0.7.0",
      buildCommit: "contract-test",
      seed: 20260725,
      runOrigin: "manual",
      rankEligibility: createRankEligibility("manual"),
      rulesetProfileId: "legacy-endless-v068",
      rngVersion: "arena-rng-v1",
      runRecordSchemaVersion: 2,
      exProtocolsEnabled: false,
    },
    capturedAt: `2026-07-25T00:00:${String(score % 60).padStart(2, "0")}.000Z`,
    summary: createRunResultSummary(world),
    upgradeRanks: world.progression.upgradeRanks,
    upgradeSelections: [],
    buildCompletedAt: null,
  });
  record.score = score;
  return record;
}

function makeNonStandardV3(record: RunRecordV2): RunRecordV3 {
  return {
    ...structuredClone(record),
    schemaVersion: 3,
    rulesetVersion: EX_PROTOCOL_ENDLESS_RULESET_VERSION,
    rulesetProfileId: "candidate-ex-endless-c2",
    rngVersion: "arena-rng-v2",
    rankEligibility: createRankEligibility("manual", false),
    exProtocol: null,
  };
}
