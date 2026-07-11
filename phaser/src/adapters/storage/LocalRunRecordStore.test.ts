import { describe, expect, it } from "vitest";
import { createRankEligibility, createRunRecord } from "../../application/runRecords";
import type { RunRecord } from "../../domain/runRecords";
import type { StorageLike } from "../../ports/RunRecordStorePort";
import {
  DEFAULT_RUN_RECORD_STORAGE_KEY,
  LEGACY_RUN_RECORD_STORAGE_KEY,
  LocalRunRecordStore,
} from "./LocalRunRecordStore";

describe("LocalRunRecordStore", () => {
  it("saves, reloads, and replaces a duplicate run id", () => {
    const storage = new MemoryStorage();
    const store = new LocalRunRecordStore(storage);

    expect(store.save(makeRecord("run-a", 100)).ok).toBe(true);
    expect(store.save(makeRecord("run-a", 500)).ok).toBe(true);

    expect(store.load().records).toHaveLength(1);
    expect(store.load().records[0]?.score).toBe(500);
  });

  it("keeps only the newest configured number of history records", () => {
    const storage = new MemoryStorage();
    const store = new LocalRunRecordStore(storage, { historyLimit: 2 });

    store.save(makeRecord("run-a", 100, "2026-07-10T10:00:00Z"));
    store.save(makeRecord("run-b", 200, "2026-07-10T10:01:00Z"));
    store.save(makeRecord("run-c", 300, "2026-07-10T10:02:00Z"));

    expect(store.load().history.map((record) => record.id)).toEqual(["run-c", "run-b"]);
    expect(store.load().rankings.map((record) => record.id)).toEqual([
      "run-c",
      "run-b",
      "run-a",
    ]);
  });

  it("preserves an older personal best after it leaves recent history", () => {
    const storage = new MemoryStorage();
    const store = new LocalRunRecordStore(storage, { historyLimit: 2, rankingLimit: 2 });

    store.save(makeRecord("old-best", 10_000, "2026-07-10T10:00:00Z"));
    store.save(makeRecord("recent-a", 100, "2026-07-10T10:01:00Z"));
    store.save(makeRecord("recent-b", 200, "2026-07-10T10:02:00Z"));

    const loaded = store.load();
    expect(loaded.history.map((record) => record.id)).toEqual(["recent-b", "recent-a"]);
    expect(loaded.rankings.map((record) => record.id)).toEqual(["old-best", "recent-b"]);
  });

  it("keeps a separate ranking for every comparison key", () => {
    const storage = new MemoryStorage();
    const store = new LocalRunRecordStore(storage);

    for (let index = 0; index < 21; index += 1) {
      const record = makeRecord(`run-${index}`, 100 + index);
      record.stageId = `arena-${index}`;
      expect(store.save(record).ok).toBe(true);
    }

    expect(new Set(store.load().rankings.map((record) => record.stageId)).size).toBe(21);
  });

  it("quarantines invalid JSON without throwing", () => {
    const storage = new MemoryStorage();
    storage.setItem(DEFAULT_RUN_RECORD_STORAGE_KEY, "{broken");
    const store = new LocalRunRecordStore(storage, { now: () => 123 });

    expect(store.load()).toMatchObject({ records: [], recovered: true });
    expect(storage.getItem(DEFAULT_RUN_RECORD_STORAGE_KEY)).toBeNull();
    expect(storage.getItem(`${DEFAULT_RUN_RECORD_STORAGE_KEY}.corrupt.123`)).toBe("{broken");
  });

  it("keeps valid records when one stored item is invalid", () => {
    const storage = new MemoryStorage();
    storage.setItem(
      DEFAULT_RUN_RECORD_STORAGE_KEY,
      JSON.stringify({
        schemaVersion: 1,
        records: [makeRecord("valid", 100), { id: "invalid" }],
      }),
    );
    const store = new LocalRunRecordStore(storage);

    const result = store.load();
    expect(result.recovered).toBe(true);
    expect(result.records.map((record) => record.id)).toEqual(["valid"]);
  });

  it("migrates the legacy storage key into the current envelope", () => {
    const storage = new MemoryStorage();
    storage.setItem(
      LEGACY_RUN_RECORD_STORAGE_KEY,
      JSON.stringify({ schemaVersion: 1, records: [makeRecord("legacy", 900)] }),
    );
    const store = new LocalRunRecordStore(storage);

    const result = store.load();

    expect(result.records.map((record) => record.id)).toEqual(["legacy"]);
    expect(result.recovered).toBe(true);
    expect(storage.getItem(LEGACY_RUN_RECORD_STORAGE_KEY)).toBeNull();
    expect(JSON.parse(storage.getItem(DEFAULT_RUN_RECORD_STORAGE_KEY)!)).toMatchObject({
      schemaVersion: 2,
      history: [{ id: "legacy" }],
      rankings: [{ id: "legacy" }],
    });
  });

  it("returns a failure instead of throwing when storage writes fail", () => {
    const storage = new MemoryStorage();
    storage.failWrites = true;
    const store = new LocalRunRecordStore(storage);

    expect(store.save(makeRecord("run-a", 100))).toMatchObject({
      ok: false,
      records: [],
      error: "quota exceeded",
    });
  });

  it("clears only the run record key", () => {
    const storage = new MemoryStorage();
    const store = new LocalRunRecordStore(storage);
    store.save(makeRecord("run-a", 100));
    storage.setItem("arena-core.profile.v1", "keep");

    expect(store.clear()).toEqual({
      ok: true,
      records: [],
      history: [],
      rankings: [],
    });
    expect(storage.getItem(DEFAULT_RUN_RECORD_STORAGE_KEY)).toBeNull();
    expect(storage.getItem("arena-core.profile.v1")).toBe("keep");
  });

  it("clears history without deleting preserved rankings", () => {
    const storage = new MemoryStorage();
    const store = new LocalRunRecordStore(storage);
    store.save(makeRecord("run-a", 100));

    const result = store.clearHistory();
    expect(result.ok).toBe(true);
    expect(result.history).toEqual([]);
    expect(result.rankings.map((record) => record.id)).toEqual(["run-a"]);
  });

  it("clears rankings without deleting recent history", () => {
    const storage = new MemoryStorage();
    const store = new LocalRunRecordStore(storage);
    store.save(makeRecord("run-a", 100));

    const result = store.clearRankings();
    expect(result.ok).toBe(true);
    expect(result.history.map((record) => record.id)).toEqual(["run-a"]);
    expect(result.rankings).toEqual([]);
  });
});

class MemoryStorage implements StorageLike {
  readonly items = new Map<string, string>();
  failWrites = false;

  getItem(key: string): string | null {
    return this.items.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    if (this.failWrites) throw new Error("quota exceeded");
    this.items.set(key, value);
  }

  removeItem(key: string): void {
    this.items.delete(key);
  }
}

function makeRecord(id: string, score: number, capturedAt = "2026-07-10T10:00:00Z"): RunRecord {
  return createRunRecord({
    context: {
      id,
      profileId: "guest-1",
      startedAt: "2026-07-10T09:59:00Z",
      modeId: "endless",
      stageId: "arena-default",
      difficultyId: "standard",
      rulesetVersion: "rules-v1",
      seedCategory: "random",
      weaponId: "pulse",
      modifierIds: [],
      appVersion: "0.5",
      buildCommit: "test",
      seed: 42,
      runOrigin: "manual",
      rankEligibility: createRankEligibility("manual"),
    },
    capturedAt,
    summary: {
      elapsed: 60,
      score,
      hp: 0,
      level: 3,
      xp: 0,
      shotsFired: 20,
      enemiesKilled: 10,
      hitsTaken: 2,
      damageTaken: 100,
      damageTakenBySource: { contact: 100, projectile: 0 },
      lastDamageSource: null,
      xpCollected: 10,
      pickupsCollected: 10,
      hpRecovered: 0,
      healPickupsCollected: 0,
      effectiveHealPickupsCollected: 0,
      upgradesChosen: 2,
      weaponMetrics: {
        pulse: { shotsFired: 20, projectilesFired: 20, hits: 10, kills: 10 },
        spread: { shotsFired: 0, projectilesFired: 0, hits: 0, kills: 0 },
        pierce: { shotsFired: 0, projectilesFired: 0, hits: 0, kills: 0 },
      },
    },
    upgradeRanks: {
      rapidFire: 1,
      swiftStep: 1,
      vitalCore: 0,
      overdriveRounds: 0,
      splitShot: 0,
      piercingRounds: 0,
    },
  });
}
