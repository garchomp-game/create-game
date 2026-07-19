import {
  createRunComparisonQuery,
  isRankableRun,
  selectRanking,
} from "../../application/runRecords";
import {
  RUN_HISTORY_LIMIT,
  RUN_RANKING_GROUP_LIMIT,
  RUN_RANKING_LIMIT,
  runRecordSchema,
} from "../../domain/runRecords";
import type { RunComparisonKey, RunRecord } from "../../domain/runRecords";
import type {
  RunRecordLoadResult,
  RunRecordStorePort,
  RunRecordWriteResult,
  StorageLike,
} from "../../ports/RunRecordStorePort";

const STORE_SCHEMA_VERSION = 2 as const;
const LEGACY_STORE_SCHEMA_VERSION = 1 as const;
export const DEFAULT_RUN_RECORD_STORAGE_KEY = "arena-core.run-records.v2";
export const LEGACY_RUN_RECORD_STORAGE_KEY = "arena-core.run-records.v1";

type StoreEnvelope = {
  schemaVersion: typeof STORE_SCHEMA_VERSION;
  history: RunRecord[];
  rankings: RunRecord[];
};

export type LocalRunRecordStoreOptions = {
  storageKey?: string;
  legacyStorageKey?: string;
  historyLimit?: number;
  rankingLimit?: number;
  rankingGroupLimit?: number;
  now?: () => number;
};

export class LocalRunRecordStore implements RunRecordStorePort {
  private readonly storageKey: string;
  private readonly legacyStorageKey: string;
  private readonly historyLimit: number;
  private readonly rankingLimit: number;
  private readonly rankingGroupLimit: number;
  private readonly now: () => number;

  constructor(
    private readonly storage: StorageLike,
    options: LocalRunRecordStoreOptions = {},
  ) {
    this.storageKey = options.storageKey ?? DEFAULT_RUN_RECORD_STORAGE_KEY;
    this.legacyStorageKey = options.legacyStorageKey ?? LEGACY_RUN_RECORD_STORAGE_KEY;
    this.historyLimit = options.historyLimit ?? RUN_HISTORY_LIMIT;
    this.rankingLimit = options.rankingLimit ?? RUN_RANKING_LIMIT;
    this.rankingGroupLimit = options.rankingGroupLimit ?? RUN_RANKING_GROUP_LIMIT;
    this.now = options.now ?? Date.now;
  }

  load(): RunRecordLoadResult {
    const current = this.readRaw(this.storageKey);
    if (current.error) return emptyLoadResult(false, current.error);
    if (current.raw !== null) return this.parseCurrent(current.raw);

    const legacy = this.readRaw(this.legacyStorageKey);
    if (legacy.error) return emptyLoadResult(false, legacy.error);
    if (legacy.raw === null) return emptyLoadResult(false);

    const migrated = this.parseEnvelope(legacy.raw, this.legacyStorageKey);
    if (migrated.records.length > 0 || migrated.recovered) {
      const writeError = this.write(migrated.history, migrated.rankings);
      if (!writeError) this.removeKey(this.legacyStorageKey);
      return { ...migrated, ...(writeError ? { error: writeError } : {}) };
    }
    return migrated;
  }

  save(record: RunRecord): RunRecordWriteResult {
    const parsedRecord = runRecordSchema.safeParse(record);
    if (!parsedRecord.success) return emptyWriteResult(false, "Run record validation failed.");

    const loaded = this.load();
    if (loaded.error && !loaded.recovered) {
      return {
        ok: false,
        records: loaded.records,
        history: loaded.history,
        rankings: loaded.rankings,
        error: loaded.error,
      };
    }

    const history = sortHistory([
      parsedRecord.data,
      ...loaded.history.filter((item) => item.id !== parsedRecord.data.id),
    ]).slice(0, this.historyLimit);
    const rankings = buildRankings(
      [parsedRecord.data, ...loaded.rankings],
      this.rankingLimit,
      this.rankingGroupLimit,
    );
    const error = this.write(history, rankings);
    return error
      ? {
          ok: false,
          records: loaded.records,
          history: loaded.history,
          rankings: loaded.rankings,
          error,
        }
      : createWriteResult(true, history, rankings);
  }

  delete(recordId: string): RunRecordWriteResult {
    const loaded = this.load();
    if (loaded.error && !loaded.recovered) return emptyWriteResult(false, loaded.error);
    const history = loaded.history.filter((record) => record.id !== recordId);
    const rankings = buildRankings(
      loaded.rankings.filter((record) => record.id !== recordId),
      this.rankingLimit,
      this.rankingGroupLimit,
    );
    const error = this.write(history, rankings);
    return error
      ? createWriteResult(false, loaded.history, loaded.rankings, error)
      : createWriteResult(true, history, rankings);
  }

  clearHistory(): RunRecordWriteResult {
    const loaded = this.load();
    if (loaded.error && !loaded.recovered) return emptyWriteResult(false, loaded.error);
    const error = this.write([], loaded.rankings);
    return error
      ? createWriteResult(false, loaded.history, loaded.rankings, error)
      : createWriteResult(true, [], loaded.rankings);
  }

  clearRankings(): RunRecordWriteResult {
    const loaded = this.load();
    if (loaded.error && !loaded.recovered) return emptyWriteResult(false, loaded.error);
    const error = this.write(loaded.history, []);
    return error
      ? createWriteResult(false, loaded.history, loaded.rankings, error)
      : createWriteResult(true, loaded.history, []);
  }

  clear(): RunRecordWriteResult {
    try {
      this.storage.removeItem(this.storageKey);
      this.storage.removeItem(this.legacyStorageKey);
      return emptyWriteResult(true);
    } catch (error) {
      const loaded = this.load();
      return createWriteResult(
        false,
        loaded.history,
        loaded.rankings,
        getErrorMessage(error),
      );
    }
  }

  private parseCurrent(raw: string): RunRecordLoadResult {
    return this.parseEnvelope(raw, this.storageKey);
  }

  private parseEnvelope(raw: string, sourceKey: string): RunRecordLoadResult {
    let value: unknown;
    try {
      value = JSON.parse(raw) as unknown;
    } catch (error) {
      this.quarantine(sourceKey, raw);
      return emptyLoadResult(true, getErrorMessage(error));
    }

    if (!isObject(value)) {
      this.quarantine(sourceKey, raw);
      return emptyLoadResult(true, "Unsupported or invalid run record store.");
    }

    let historyCandidates: unknown[];
    let rankingCandidates: unknown[];
    let recovered = sourceKey !== this.storageKey;
    if (
      value.schemaVersion === STORE_SCHEMA_VERSION &&
      Array.isArray(value.history) &&
      Array.isArray(value.rankings)
    ) {
      historyCandidates = value.history;
      rankingCandidates = value.rankings;
    } else if (
      value.schemaVersion === LEGACY_STORE_SCHEMA_VERSION &&
      Array.isArray(value.records)
    ) {
      historyCandidates = value.records;
      rankingCandidates = value.records;
      recovered = true;
    } else {
      this.quarantine(sourceKey, raw);
      return emptyLoadResult(true, "Unsupported or invalid run record store.");
    }

    const parsedHistory = parseRecords(historyCandidates);
    const parsedRankings = parseRecords(rankingCandidates);
    recovered ||= parsedHistory.recovered || parsedRankings.recovered;
    const history = sortHistory(parsedHistory.records).slice(0, this.historyLimit);
    const rankings = buildRankings(
      parsedRankings.records,
      this.rankingLimit,
      this.rankingGroupLimit,
    );
    recovered ||=
      history.length !== historyCandidates.length || rankings.length !== rankingCandidates.length;

    if (recovered && sourceKey === this.storageKey) {
      const writeError = this.write(history, rankings);
      return createLoadResult(history, rankings, true, writeError);
    }
    return createLoadResult(history, rankings, recovered);
  }

  private readRaw(key: string): { raw: string | null; error?: string } {
    try {
      return { raw: this.storage.getItem(key) };
    } catch (error) {
      return { raw: null, error: getErrorMessage(error) };
    }
  }

  private write(history: RunRecord[], rankings: RunRecord[]): string | undefined {
    const envelope: StoreEnvelope = {
      schemaVersion: STORE_SCHEMA_VERSION,
      history,
      rankings,
    };
    try {
      this.storage.setItem(this.storageKey, JSON.stringify(envelope));
      return undefined;
    } catch (error) {
      return getErrorMessage(error);
    }
  }

  private quarantine(key: string, raw: string): void {
    try {
      this.storage.setItem(`${key}.corrupt.${this.now()}`, raw);
    } catch {
      // The backup is best-effort. Removing the broken primary value is more important.
    }
    this.removeKey(key);
  }

  private removeKey(key: string): void {
    try {
      this.storage.removeItem(key);
    } catch {
      // A fully unavailable storage implementation is reported by later reads and writes.
    }
  }
}

function parseRecords(candidates: unknown[]): { records: RunRecord[]; recovered: boolean } {
  const records: RunRecord[] = [];
  let recovered = false;
  for (const candidate of candidates) {
    const result = runRecordSchema.safeParse(candidate);
    if (result.success) {
      records.push(result.data);
      if (!isObject(candidate) || candidate.schemaVersion !== result.data.schemaVersion) {
        recovered = true;
      }
    }
    else recovered = true;
  }
  return { records, recovered };
}

function buildRankings(
  records: RunRecord[],
  limit: number,
  groupLimit: number,
): RunRecord[] {
  const groups = new Map<string, RunRecord[]>();
  for (const record of deduplicate(records)) {
    if (!isRankableRun(record)) continue;
    const serializedKey = comparisonGroupToString(record);
    const group = groups.get(serializedKey) ?? [];
    group.push(record);
    groups.set(serializedKey, group);
  }

  const selected = [...groups.entries()]
    .sort(([leftKey, left], [rightKey, right]) =>
      getLatestCapturedAt(right).localeCompare(getLatestCapturedAt(left)) ||
      leftKey.localeCompare(rightKey)
    )
    .slice(0, Math.max(0, groupLimit))
    .flatMap(([, group]) => {
      const source = group[0]!;
      const overall = selectRanking(
        group,
        createRunComparisonQuery(source, "overall"),
        limit,
      );
      const byWeapon = [...new Set(group.map((record) => record.weaponId))]
        .sort()
        .flatMap((weaponId) => {
          const weaponSource = group.find((record) => record.weaponId === weaponId)!;
          return selectRanking(
            group,
            createRunComparisonQuery(weaponSource, "weapon"),
            limit,
          );
        });
      return deduplicate([...overall, ...byWeapon]);
    });
  return deduplicate(selected);
}

function getLatestCapturedAt(records: readonly RunRecord[]): string {
  return records.reduce(
    (latest, record) => record.capturedAt > latest ? record.capturedAt : latest,
    "",
  );
}

function comparisonGroupToString(key: RunComparisonKey & Pick<RunRecord, "seed">): string {
  return [
    key.profileId,
    key.modeId,
    key.stageId,
    key.difficultyId,
    key.rulesetVersion,
    key.seedCategory,
    key.seedCategory === "fixed" ? key.seed : "random",
  ].join("\u001f");
}

function deduplicate(records: RunRecord[]): RunRecord[] {
  const byId = new Map<string, RunRecord>();
  for (const record of records) {
    if (!byId.has(record.id)) byId.set(record.id, record);
  }
  return [...byId.values()];
}

function sortHistory(records: RunRecord[]): RunRecord[] {
  return deduplicate(records).sort(
    (left, right) =>
      right.capturedAt.localeCompare(left.capturedAt) || right.id.localeCompare(left.id),
  );
}

function createLoadResult(
  history: RunRecord[],
  rankings: RunRecord[],
  recovered: boolean,
  error?: string,
): RunRecordLoadResult {
  return {
    records: mergeCollections(history, rankings),
    history,
    rankings,
    recovered,
    ...(error ? { error } : {}),
  };
}

function emptyLoadResult(recovered: boolean, error?: string): RunRecordLoadResult {
  return createLoadResult([], [], recovered, error);
}

function createWriteResult(
  ok: boolean,
  history: RunRecord[],
  rankings: RunRecord[],
  error?: string,
): RunRecordWriteResult {
  return {
    ok,
    records: mergeCollections(history, rankings),
    history,
    rankings,
    ...(error ? { error } : {}),
  };
}

function emptyWriteResult(ok: boolean, error?: string): RunRecordWriteResult {
  return createWriteResult(ok, [], [], error);
}

function mergeCollections(history: RunRecord[], rankings: RunRecord[]): RunRecord[] {
  return deduplicate([...history, ...rankings]);
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
