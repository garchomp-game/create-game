import { describe, expect, it } from "vitest";
import {
  toExProtocolEvolutionId,
  toExProtocolId,
} from "../../content/exProtocolCatalog";
import { SIMULATION_CONFIG } from "../../config/gameConfig";
import {
  ENDLESS_RULESET_VERSION,
  EX_PROTOCOL_CANDIDATE_APP_VERSION,
  EX_PROTOCOL_ENDLESS_RULESET_VERSION,
} from "../../config/version";
import {
  RUN_RECORD_SCHEMA_VERSION_V3,
  type RunRecordV2,
  type RunRecordV3,
} from "../../domain/runRecords";
import type { StorageLike } from "../../ports/RunRecordStorePort";
import {
  createRankEligibility,
  createRunRecord,
} from "../../application/runRecords";
import { createWorld } from "../../simulation/createWorld";
import { createRunResultSummary } from "../../simulation/resultSummary";
import {
  DEFAULT_RUN_RECORD_STORAGE_KEY,
  LEGACY_RUN_RECORD_STORAGE_KEY,
} from "./LocalRunRecordStore";
import {
  DEFAULT_RUN_RECORD_V3_DELETE_JOURNAL_KEY,
  DEFAULT_RUN_RECORD_V3_STORAGE_KEY,
  LocalRunRecordStoreV3,
} from "./LocalRunRecordStoreV3";

describe("LocalRunRecordStoreV3", () => {
  it("writes candidate runs only to v3 and round-trips them", () => {
    const storage = new FaultStorage();
    const store = new LocalRunRecordStoreV3(storage);
    const record = makeCandidateRecord("candidate-1", 200);

    expect(store.save(record).ok).toBe(true);
    expect(store.load().history).toEqual([record]);
    expect(storage.getItem(DEFAULT_RUN_RECORD_V3_STORAGE_KEY)).not.toBeNull();
    expect(storage.getItem(DEFAULT_RUN_RECORD_STORAGE_KEY)).toBeNull();
    expect(storage.getItem(LEGACY_RUN_RECORD_STORAGE_KEY)).toBeNull();
  });

  it("imports v2 without changing a single legacy byte", () => {
    const storage = new FaultStorage();
    const legacy = makeV2Envelope(
      [makeV2Record("legacy-a", 100)],
      [makeV2Record("legacy-a", 100)],
    );
    storage.setItem(DEFAULT_RUN_RECORD_STORAGE_KEY, legacy);
    const store = new LocalRunRecordStoreV3(storage);

    const loaded = store.load();

    expect(loaded.history).toMatchObject([
      {
        id: "legacy-a",
        schemaVersion: 3,
        rulesetProfileId: "legacy-endless-v068",
        rngVersion: "arena-rng-v1",
        exProtocol: null,
      },
    ]);
    expect(storage.getItem(DEFAULT_RUN_RECORD_STORAGE_KEY)).toBe(legacy);
  });

  it("updates imported provenance when an old build moves a v1 record to v2", () => {
    const storage = new FaultStorage();
    const record = makeV2Record("legacy-transition", 100);
    const v1Raw = JSON.stringify({
      schemaVersion: 1,
      records: [toV1Record(record)],
    });
    storage.setItem(LEGACY_RUN_RECORD_STORAGE_KEY, v1Raw);
    const store = new LocalRunRecordStoreV3(storage);

    expect(store.load().records).toHaveLength(1);
    expect(readV3Envelope(storage).legacySync.importedHistory).toEqual({
      "legacy-transition": "v1",
    });

    const v2Raw = makeV2Envelope([record], [record]);
    storage.removeItem(LEGACY_RUN_RECORD_STORAGE_KEY);
    storage.setItem(DEFAULT_RUN_RECORD_STORAGE_KEY, v2Raw);
    const reloaded = store.load();

    expect(reloaded.history.map(({ id }) => id)).toEqual([
      "legacy-transition",
    ]);
    expect(reloaded.rankings.map(({ id }) => id)).toEqual([
      "legacy-transition",
    ]);
    expect(readV3Envelope(storage).legacySync).toEqual({
      importedHistory: { "legacy-transition": "v2" },
      importedRankings: { "legacy-transition": "v2" },
    });
    expect(storage.getItem(DEFAULT_RUN_RECORD_STORAGE_KEY)).toBe(v2Raw);
    expect(storage.getItem(LEGACY_RUN_RECORD_STORAGE_KEY)).toBeNull();
  });

  it("reconciles old-build additions and collection-specific removal", () => {
    const storage = new FaultStorage();
    const a = makeV2Record("legacy-a", 100);
    const b = makeV2Record("legacy-b", 200);
    storage.setItem(
      DEFAULT_RUN_RECORD_STORAGE_KEY,
      makeV2Envelope([a, b], [a, b]),
    );
    const store = new LocalRunRecordStoreV3(storage);
    expect(store.load().history.map(({ id }) => id)).toEqual([
      "legacy-a",
      "legacy-b",
    ]);

    const c = makeV2Record("legacy-c", 300);
    const rollbackRaw = makeV2Envelope([b, c], [a, b, c]);
    storage.setItem(DEFAULT_RUN_RECORD_STORAGE_KEY, rollbackRaw);
    const reloaded = store.load();

    expect(reloaded.history.map(({ id }) => id)).toEqual([
      "legacy-b",
      "legacy-c",
    ]);
    expect(reloaded.rankings.map(({ id }) => id)).toEqual(
      expect.arrayContaining(["legacy-a", "legacy-b", "legacy-c"]),
    );
    expect(storage.getItem(DEFAULT_RUN_RECORD_STORAGE_KEY)).toBe(
      rollbackRaw,
    );
  });

  it("does not interpret partial legacy data as proof of deletion", () => {
    const storage = new FaultStorage();
    const a = makeV2Record("legacy-a", 100);
    storage.setItem(
      DEFAULT_RUN_RECORD_STORAGE_KEY,
      makeV2Envelope([a], [a]),
    );
    const store = new LocalRunRecordStoreV3(storage);
    expect(store.load().history).toHaveLength(1);
    const partialRaw = JSON.stringify({
      schemaVersion: 2,
      history: [{ broken: true }],
      rankings: [a],
    });
    storage.setItem(DEFAULT_RUN_RECORD_STORAGE_KEY, partialRaw);

    const loaded = store.load();

    expect(loaded.history.map(({ id }) => id)).toContain("legacy-a");
    expect(loaded.error).toContain("partially readable");
    expect(storage.getItem(DEFAULT_RUN_RECORD_STORAGE_KEY)).toBe(
      partialRaw,
    );
  });

  it("updates v2 and v3 through a verified deletion journal", () => {
    const storage = new FaultStorage();
    const a = makeV2Record("legacy-a", 100);
    storage.setItem(
      DEFAULT_RUN_RECORD_STORAGE_KEY,
      makeV2Envelope([a], [a]),
    );
    const store = new LocalRunRecordStoreV3(storage);
    expect(store.load().records).toHaveLength(1);

    const result = store.delete("legacy-a");

    expect(result.ok).toBe(true);
    expect(result.records).toEqual([]);
    expect(
      storage.getItem(DEFAULT_RUN_RECORD_V3_DELETE_JOURNAL_KEY),
    ).toBeNull();
    expect(
      JSON.parse(storage.getItem(DEFAULT_RUN_RECORD_STORAGE_KEY) ?? "{}"),
    ).toEqual({ schemaVersion: 2, history: [], rankings: [] });
  });

  it("keeps a tombstone after failure and resumes idempotently on load", () => {
    const storage = new FaultStorage();
    const a = makeV2Record("legacy-a", 100);
    storage.setItem(
      DEFAULT_RUN_RECORD_STORAGE_KEY,
      makeV2Envelope([a], [a]),
    );
    const store = new LocalRunRecordStoreV3(storage);
    expect(store.load().records).toHaveLength(1);
    storage.failNextSetFor(DEFAULT_RUN_RECORD_STORAGE_KEY);

    const failed = store.delete("legacy-a");

    expect(failed.ok).toBe(false);
    expect(failed.records).toEqual([]);
    expect(
      storage.getItem(DEFAULT_RUN_RECORD_V3_DELETE_JOURNAL_KEY),
    ).not.toBeNull();

    const resumed = new LocalRunRecordStoreV3(storage).load();
    expect(resumed.records).toEqual([]);
    expect(
      storage.getItem(DEFAULT_RUN_RECORD_V3_DELETE_JOURNAL_KEY),
    ).toBeNull();
  });

  it("refuses a one-sided clear while a populated v1 store exists", () => {
    const storage = new FaultStorage();
    const record = makeV2Record("legacy-v1", 50);
    const v1 = toV1Record(record);
    const raw = JSON.stringify({ schemaVersion: 1, records: [v1] });
    storage.setItem(LEGACY_RUN_RECORD_STORAGE_KEY, raw);
    const store = new LocalRunRecordStoreV3(storage);
    expect(store.load().records).toHaveLength(1);

    const result = store.clearHistory();

    expect(result.ok).toBe(false);
    expect(result.error).toContain("cannot represent");
    expect(storage.getItem(LEGACY_RUN_RECORD_STORAGE_KEY)).toBe(raw);
    expect(
      storage.getItem(DEFAULT_RUN_RECORD_V3_DELETE_JOURNAL_KEY),
    ).toBeNull();
  });

  it("quarantines only invalid v3 data and leaves v2 untouched", () => {
    const storage = new FaultStorage();
    const legacy = makeV2Envelope(
      [makeV2Record("legacy-a", 100)],
      [],
    );
    storage.setItem(DEFAULT_RUN_RECORD_STORAGE_KEY, legacy);
    storage.setItem(DEFAULT_RUN_RECORD_V3_STORAGE_KEY, "{");
    const store = new LocalRunRecordStoreV3(storage, {
      now: () => 123,
    });

    const loaded = store.load();

    expect(loaded.recovered).toBe(true);
    expect(storage.getItem(DEFAULT_RUN_RECORD_STORAGE_KEY)).toBe(legacy);
    expect(
      storage.getItem(
        `${DEFAULT_RUN_RECORD_V3_STORAGE_KEY}.corrupt.123`,
      ),
    ).toBe("{");
    expect(loaded.error).toBeTruthy();
  });

  it("leaves legacy bytes untouched when v3 quota writes fail", () => {
    const storage = new FaultStorage();
    const v1Raw = JSON.stringify({
      schemaVersion: 1,
      records: [toV1Record(makeV2Record("legacy-v1", 50))],
    });
    const v2Raw = makeV2Envelope(
      [makeV2Record("legacy-v2", 100)],
      [makeV2Record("legacy-v2", 100)],
    );
    storage.setItem(LEGACY_RUN_RECORD_STORAGE_KEY, v1Raw);
    storage.setItem(DEFAULT_RUN_RECORD_STORAGE_KEY, v2Raw);
    storage.failAllSetsFor(DEFAULT_RUN_RECORD_V3_STORAGE_KEY);
    const store = new LocalRunRecordStoreV3(storage);

    const result = store.save(makeCandidateRecord("candidate-quota", 200));

    expect(result.ok).toBe(false);
    expect(result.error).toContain("injected write failure");
    expect(storage.getItem(DEFAULT_RUN_RECORD_V3_STORAGE_KEY)).toBeNull();
    expect(storage.getItem(LEGACY_RUN_RECORD_STORAGE_KEY)).toBe(v1Raw);
    expect(storage.getItem(DEFAULT_RUN_RECORD_STORAGE_KEY)).toBe(v2Raw);
  });

  it("keeps the committed max-size v3 record below the review threshold", () => {
    const v2 = makeMaxSizeV2Record();
    const v3 = makeMaxSizeCandidateRecord();
    const v2Bytes = new TextEncoder().encode(JSON.stringify(v2)).length;
    const v3Bytes = new TextEncoder().encode(JSON.stringify(v3)).length;
    const reviewThreshold = Math.min(v2Bytes * 2, 64 * 1024);

    expect(v3Bytes).toBeLessThanOrEqual(reviewThreshold);
  });
});

class FaultStorage implements StorageLike {
  private readonly items = new Map<string, string>();
  private readonly failNextSetKeys = new Set<string>();
  private readonly failAllSetKeys = new Set<string>();

  getItem(key: string): string | null {
    return this.items.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    if (
      this.failAllSetKeys.has(key) ||
      this.failNextSetKeys.delete(key)
    ) {
      throw new Error(`injected write failure: ${key}`);
    }
    this.items.set(key, value);
  }

  removeItem(key: string): void {
    this.items.delete(key);
  }

  failNextSetFor(key: string): void {
    this.failNextSetKeys.add(key);
  }

  failAllSetsFor(key: string): void {
    this.failAllSetKeys.add(key);
  }
}

function makeCandidateRecord(id: string, score: number): RunRecordV3 {
  const world = createWorld(SIMULATION_CONFIG);
  world.state.score = score;
  const record = createRunRecord({
    context: {
      id,
      profileId: "guest-1",
      startedAt: "2026-07-23T00:00:00.000Z",
      modeId: "endless",
      stageId: "arena-default",
      difficultyId: "standard",
      rulesetVersion: EX_PROTOCOL_ENDLESS_RULESET_VERSION,
      seedCategory: "fixed",
      weaponId: "pulse",
      modifierIds: [],
      appVersion: EX_PROTOCOL_CANDIDATE_APP_VERSION,
      buildCommit: "test",
      seed: 20260723,
      runOrigin: "manual",
      rankEligibility: createRankEligibility("manual", false),
      rulesetProfileId: "candidate-ex-endless-c2",
      rngVersion: "arena-rng-v2",
      runRecordSchemaVersion: RUN_RECORD_SCHEMA_VERSION_V3,
      exProtocolsEnabled: true,
    },
    capturedAt: `2026-07-23T00:01:${String(score % 60).padStart(2, "0")}.000Z`,
    summary: createRunResultSummary(world),
    upgradeRanks: world.progression.upgradeRanks,
    upgradeSelections: [],
    buildCompletedAt: null,
    exProtocolMetrics: world.stats.exProtocolMetrics,
  });
  if (record.schemaVersion !== 3) throw new Error("Expected v3 record.");
  return record;
}

function makeV2Record(id: string, score: number): RunRecordV2 {
  const world = createWorld(SIMULATION_CONFIG);
  world.state.score = score;
  const record = createRunRecord({
    context: {
      id,
      profileId: "guest-1",
      startedAt: "2026-07-22T00:00:00.000Z",
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
    capturedAt: `2026-07-22T00:01:${String(score % 60).padStart(2, "0")}.000Z`,
    summary: createRunResultSummary(world),
    upgradeRanks: world.progression.upgradeRanks,
    upgradeSelections: [],
    buildCompletedAt: null,
  });
  if (record.schemaVersion !== 2) throw new Error("Expected v2 record.");
  return record;
}

function makeV2Envelope(
  history: RunRecordV2[],
  rankings: RunRecordV2[],
): string {
  return JSON.stringify({ schemaVersion: 2, history, rankings });
}

function makeMaxSizeV2Record(): RunRecordV2 {
  const record = makeV2Record("max-size-v2", 999_999);
  record.modifierIds = Array.from(
    { length: 32 },
    (_, index) => `modifier-${String(index).padStart(2, "0")}`,
  );
  record.upgradeSelections = Array.from(
    { length: 25 },
    (_, index) => ({
      elapsed: index + 1,
      level: index + 2,
      upgradeId: "rapidFire" as const,
      rank: index + 1,
    }),
  );
  return record;
}

function makeMaxSizeCandidateRecord(): RunRecordV3 {
  const record = makeCandidateRecord("max-size-v3", 999_999);
  const protocolId = toExProtocolId("pulse.resonance-relay");
  record.modifierIds = Array.from(
    { length: 32 },
    (_, index) => `modifier-${String(index).padStart(2, "0")}`,
  );
  record.upgradeSelections = Array.from(
    { length: 25 },
    (_, index) => ({
      elapsed: index + 1,
      level: index + 2,
      upgradeId: "rapidFire" as const,
      rank: index + 1,
    }),
  );
  record.exProtocol = {
    offeredIds: [
      protocolId,
      toExProtocolId("pulse.rebound-overdrive"),
      toExProtocolId("pulse.redline-core"),
    ],
    selectedId: protocolId,
    selectedAtElapsed: 120,
    evolutionOneId: toExProtocolEvolutionId(
      protocolId,
      "evolutionOne",
      "extended-coupling",
    ),
    evolutionOneAtElapsed: 140,
    evolutionTwoId: toExProtocolEvolutionId(
      protocolId,
      "evolutionTwo",
      "endpoint-priming",
    ),
    evolutionTwoAtElapsed: 160,
    masteryId: "crosslink",
    masteryAtElapsed: 160,
    firstLimitBreakAtElapsed: 180,
    exposureSeconds: 480,
    protocolSourceDamage: 12_345.67,
    protocolBonusDamageAttributed: 2_345.67,
    protocolSourceKills: 123,
    protocolBonusFinisherKills: 23,
    specialPresses: 99,
    specialAccepted: 80,
    specialRejectedByReason: {
      cooldown: 10,
      "already-armed": 9,
    },
    activeUseIntervalCount: 79,
    activeUseIntervalSumSeconds: 240,
    activeUseIntervalMaxSeconds: 12,
    counters: {
      "relay.anchor.created": 200,
      "relay.anchor.consumed": 180,
      "relay.damage.targets": 500,
      "relay.blocked": 20,
    },
  };
  return record;
}

function readV3Envelope(storage: FaultStorage): {
  legacySync: {
    importedHistory: Record<string, string>;
    importedRankings: Record<string, string>;
  };
} {
  const raw = storage.getItem(DEFAULT_RUN_RECORD_V3_STORAGE_KEY);
  if (!raw) throw new Error("Expected a v3 envelope.");
  return JSON.parse(raw) as {
    legacySync: {
      importedHistory: Record<string, string>;
      importedRankings: Record<string, string>;
    };
  };
}

function toV1Record(record: RunRecordV2) {
  const legacy = {
    ...structuredClone(record),
    schemaVersion: 1,
    upgradeRanks: {
      rapidFire: record.upgradeRanks.rapidFire,
      swiftStep: record.upgradeRanks.swiftStep,
      vitalCore: record.upgradeRanks.vitalCore,
      overdriveRounds: record.upgradeRanks.overdriveRounds,
      splitShot: record.upgradeRanks.splitShot,
      piercingRounds: record.upgradeRanks.piercingRounds,
    },
  } as Record<string, unknown>;
  delete legacy.upgradeSelections;
  delete legacy.buildCompletedAt;
  delete legacy.capstoneMetrics;
  return legacy;
}
