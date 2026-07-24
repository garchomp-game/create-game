import { z } from "zod";
import {
  RUN_HISTORY_LIMIT,
  RUN_RANKING_GROUP_LIMIT,
  RUN_RANKING_LIMIT,
  RUN_RECORD_SCHEMA_VERSION_V3,
  type RunRecord,
  type RunRecordV2,
  type RunRecordV3,
} from "../../domain/runRecords";
import type {
  RunRecordLoadResult,
  RunRecordStorePort,
  RunRecordWriteResult,
  StorageLike,
} from "../../ports/RunRecordStorePort";
import {
  decodeV1EnvelopeRaw,
  decodeV2EnvelopeRaw,
  type LegacyCollectionDecode,
  type LegacyEnvelopeDecodeResult,
} from "./legacyRunRecordDecoder";
import {
  DEFAULT_RUN_RECORD_STORAGE_KEY,
  LEGACY_RUN_RECORD_STORAGE_KEY,
} from "./LocalRunRecordStore";
import {
  buildRunRecordRankings,
  mergeRunRecordCollections,
  sortRunRecordHistory,
} from "./runRecordCollections";
import {
  decodeRunRecordV3,
  migrateRunRecordV2ToV3,
} from "./runRecordV3Codec";

const STORE_SCHEMA_VERSION = 3 as const;
const DELETE_JOURNAL_SCHEMA_VERSION = 1 as const;
export const DEFAULT_RUN_RECORD_V3_STORAGE_KEY =
  "arena-core.run-records.v3";
export const DEFAULT_RUN_RECORD_V3_DELETE_JOURNAL_KEY =
  "arena-core.run-records.v3.delete-journal";
export const DEFAULT_RUN_RECORD_V3_DELETE_SEQUENCE_KEY =
  "arena-core.run-records.v3.delete-sequence";

type LegacySource = "v1" | "v2";
type RunRecordCollection = "history" | "rankings";

export type LegacySyncMetadata = {
  importedHistory: Record<string, LegacySource>;
  importedRankings: Record<string, LegacySource>;
};

type StoreEnvelopeV3 = {
  schemaVersion: typeof STORE_SCHEMA_VERSION;
  history: RunRecordV3[];
  rankings: RunRecordV3[];
  legacySync: LegacySyncMetadata;
};

export type PendingDeletionOperation = {
  schemaVersion: typeof DELETE_JOURNAL_SCHEMA_VERSION;
  operationId: string;
  scope:
    | {
        kind: "record";
        recordId: string;
        collections: RunRecordCollection[];
      }
    | {
        kind: "collection";
        collection: RunRecordCollection | "all";
      };
  legacyTargets: LegacySource[];
};

export type LocalRunRecordStoreV3Options = {
  storageKey?: string;
  v2StorageKey?: string;
  v1StorageKey?: string;
  deleteJournalKey?: string;
  deleteSequenceKey?: string;
  historyLimit?: number;
  rankingLimit?: number;
  rankingGroupLimit?: number;
  now?: () => number;
};

type LoadedState = {
  envelope: StoreEnvelopeV3;
  recovered: boolean;
  error?: string;
};

type LegacyState = {
  v1Raw: string | null;
  v2Raw: string | null;
  v1: LegacyEnvelopeDecodeResult;
  v2: LegacyEnvelopeDecodeResult;
};

const journalSchema = z.object({
  schemaVersion: z.literal(DELETE_JOURNAL_SCHEMA_VERSION),
  operationId: z.string().min(1),
  scope: z.union([
    z.object({
      kind: z.literal("record"),
      recordId: z.string().min(1),
      collections: z
        .array(z.enum(["history", "rankings"]))
        .min(1),
    }),
    z.object({
      kind: z.literal("collection"),
      collection: z.enum(["history", "rankings", "all"]),
    }),
  ]),
  legacyTargets: z.array(z.enum(["v1", "v2"])),
});

export class LocalRunRecordStoreV3 implements RunRecordStorePort {
  private readonly storageKey: string;
  private readonly v2StorageKey: string;
  private readonly v1StorageKey: string;
  private readonly deleteJournalKey: string;
  private readonly deleteSequenceKey: string;
  private readonly historyLimit: number;
  private readonly rankingLimit: number;
  private readonly rankingGroupLimit: number;
  private readonly now: () => number;

  constructor(
    private readonly storage: StorageLike,
    options: LocalRunRecordStoreV3Options = {},
  ) {
    this.storageKey =
      options.storageKey ?? DEFAULT_RUN_RECORD_V3_STORAGE_KEY;
    this.v2StorageKey =
      options.v2StorageKey ?? DEFAULT_RUN_RECORD_STORAGE_KEY;
    this.v1StorageKey =
      options.v1StorageKey ?? LEGACY_RUN_RECORD_STORAGE_KEY;
    this.deleteJournalKey =
      options.deleteJournalKey ??
      DEFAULT_RUN_RECORD_V3_DELETE_JOURNAL_KEY;
    this.deleteSequenceKey =
      options.deleteSequenceKey ??
      DEFAULT_RUN_RECORD_V3_DELETE_SEQUENCE_KEY;
    this.historyLimit = options.historyLimit ?? RUN_HISTORY_LIMIT;
    this.rankingLimit = options.rankingLimit ?? RUN_RANKING_LIMIT;
    this.rankingGroupLimit =
      options.rankingGroupLimit ?? RUN_RANKING_GROUP_LIMIT;
    this.now = options.now ?? Date.now;
  }

  load(): RunRecordLoadResult {
    return toLoadResult(this.loadState());
  }

  save(record: RunRecord): RunRecordWriteResult {
    if (record.schemaVersion !== RUN_RECORD_SCHEMA_VERSION_V3) {
      return emptyWriteResult(
        false,
        "The candidate store only accepts RunRecord v3.",
      );
    }
    const decoded = decodeRunRecordV3(record);
    if (!decoded.ok) return emptyWriteResult(false, decoded.error);

    const loaded = this.loadState();
    if (loaded.error && !loaded.recovered) {
      return toWriteResult(false, loaded.envelope, loaded.error);
    }
    const history = sortRunRecordHistory([
      decoded.record,
      ...loaded.envelope.history.filter(
        (candidate) => candidate.id !== decoded.record.id,
      ),
    ]).slice(0, this.historyLimit) as RunRecordV3[];
    const rankings = buildRunRecordRankings(
      [decoded.record, ...loaded.envelope.rankings],
      this.rankingLimit,
      this.rankingGroupLimit,
    ) as RunRecordV3[];
    const envelope = normalizeSyncMembership({
      ...loaded.envelope,
      history,
      rankings,
    });
    const error = this.writeEnvelope(envelope);
    return error
      ? toWriteResult(false, loaded.envelope, error)
      : toWriteResult(true, envelope);
  }

  delete(recordId: string): RunRecordWriteResult {
    return this.startDeletion({
      kind: "record",
      recordId,
      collections: ["history", "rankings"],
    });
  }

  clearHistory(): RunRecordWriteResult {
    return this.startDeletion({
      kind: "collection",
      collection: "history",
    });
  }

  clearRankings(): RunRecordWriteResult {
    return this.startDeletion({
      kind: "collection",
      collection: "rankings",
    });
  }

  clear(): RunRecordWriteResult {
    return this.startDeletion({
      kind: "collection",
      collection: "all",
    });
  }

  private loadState(): LoadedState {
    const currentRaw = this.readRaw(this.storageKey);
    if (currentRaw.error) {
      return {
        envelope: createEmptyEnvelope(),
        recovered: false,
        error: currentRaw.error,
      };
    }
    const current = currentRaw.raw === null
      ? {
          envelope: createEmptyEnvelope(),
          recovered: false,
        }
      : this.parseEnvelope(currentRaw.raw);
    if (current.error && !current.recovered) return current;

    const journalRaw = this.readRaw(this.deleteJournalKey);
    if (journalRaw.error) {
      return { ...current, error: journalRaw.error };
    }
    if (journalRaw.raw !== null) {
      const journal = this.parseJournal(journalRaw.raw);
      if (!journal.ok) {
        return {
          ...current,
          error:
            `Deletion journal is invalid; record operations are blocked: ${journal.error}`,
        };
      }
      const resumed = this.resumeDeletion(
        current.envelope,
        journal.operation,
      );
      if (resumed.error) {
        return {
          envelope: applyDeletionScope(
            current.envelope,
            journal.operation.scope,
          ),
          recovered: true,
          error: resumed.error,
        };
      }
      current.envelope = resumed.envelope;
      current.recovered = true;
    }

    const legacy = this.readLegacyState();
    if ("error" in legacy) {
      return { ...current, error: legacy.error };
    }
    const reconciled = reconcileLegacy(
      current.envelope,
      legacy,
      this.historyLimit,
      this.rankingLimit,
      this.rankingGroupLimit,
    );
    if (!reconciled.changed) {
      return {
        ...current,
        ...(mergeDiagnostics(current.error, reconciled.warning)
          ? {
              error: mergeDiagnostics(
                current.error,
                reconciled.warning,
              ),
              recovered: true,
            }
          : {}),
      };
    }
    const writeError = this.writeEnvelope(reconciled.envelope);
    if (writeError) {
      return {
        ...current,
        recovered: true,
        error: writeError,
      };
    }
    return {
      envelope: reconciled.envelope,
      recovered: true,
      ...(mergeDiagnostics(current.error, reconciled.warning)
        ? {
            error: mergeDiagnostics(
              current.error,
              reconciled.warning,
            ),
          }
        : {}),
    };
  }

  private parseEnvelope(raw: string): LoadedState {
    let value: unknown;
    try {
      value = JSON.parse(raw) as unknown;
    } catch (error) {
      this.quarantineV3(raw);
      return {
        envelope: createEmptyEnvelope(),
        recovered: true,
        error: getErrorMessage(error),
      };
    }
    if (
      !isObject(value) ||
      value.schemaVersion !== STORE_SCHEMA_VERSION ||
      !Array.isArray(value.history) ||
      !Array.isArray(value.rankings) ||
      !isLegacySyncMetadata(value.legacySync)
    ) {
      this.quarantineV3(raw);
      return {
        envelope: createEmptyEnvelope(),
        recovered: true,
        error: "Unsupported or invalid RunRecord v3 envelope.",
      };
    }
    const history = decodeV3Records(value.history);
    const rankings = decodeV3Records(value.rankings);
    if (!history.ok) {
      this.quarantineV3(raw);
      return {
        envelope: createEmptyEnvelope(),
        recovered: true,
        error: history.error,
      };
    }
    if (!rankings.ok) {
      this.quarantineV3(raw);
      return {
        envelope: createEmptyEnvelope(),
        recovered: true,
        error: rankings.error,
      };
    }
    return {
      envelope: {
        schemaVersion: STORE_SCHEMA_VERSION,
        history: history.records,
        rankings: rankings.records,
        legacySync: structuredClone(value.legacySync),
      },
      recovered: false,
    };
  }

  private startDeletion(
    scope: PendingDeletionOperation["scope"],
  ): RunRecordWriteResult {
    const loaded = this.loadState();
    if (loaded.error) {
      return toWriteResult(false, loaded.envelope, loaded.error);
    }
    const existingJournal = this.readRaw(this.deleteJournalKey);
    if (existingJournal.error) {
      return toWriteResult(
        false,
        loaded.envelope,
        existingJournal.error,
      );
    }
    if (existingJournal.raw !== null) {
      return toWriteResult(
        false,
        loaded.envelope,
        "A deletion operation is already pending.",
      );
    }

    const legacy = this.readLegacyState();
    if ("error" in legacy) {
      return toWriteResult(false, loaded.envelope, legacy.error);
    }
    const unsafeV1Reason = getUnsafeV1PartialDeletionReason(
      scope,
      legacy.v1,
    );
    if (unsafeV1Reason) {
      return toWriteResult(false, loaded.envelope, unsafeV1Reason);
    }
    const operation: PendingDeletionOperation = {
      schemaVersion: DELETE_JOURNAL_SCHEMA_VERSION,
      operationId: this.createOperationId(),
      scope,
      legacyTargets: getLegacyTargets(scope, legacy),
    };
    const journalError = this.writeAndVerify(
      this.deleteJournalKey,
      JSON.stringify(operation),
    );
    if (journalError) {
      return toWriteResult(false, loaded.envelope, journalError);
    }
    const resumed = this.resumeDeletion(loaded.envelope, operation);
    return resumed.error
      ? toWriteResult(
          false,
          applyDeletionScope(loaded.envelope, scope),
          resumed.error,
        )
      : toWriteResult(true, resumed.envelope);
  }

  private resumeDeletion(
    envelope: StoreEnvelopeV3,
    operation: PendingDeletionOperation,
  ): { envelope: StoreEnvelopeV3; error?: string } {
    for (const target of operation.legacyTargets) {
      const error = target === "v1"
        ? this.applyDeletionToV1(operation)
        : this.applyDeletionToV2(operation);
      if (error) {
        return {
          envelope: applyDeletionScope(envelope, operation.scope),
          error,
        };
      }
    }

    const nextEnvelope = normalizeSyncMembership(
      applyDeletionScope(envelope, operation.scope),
    );
    const v3Error = this.writeEnvelope(nextEnvelope);
    if (v3Error) return { envelope: nextEnvelope, error: v3Error };

    try {
      this.storage.removeItem(this.deleteJournalKey);
      if (this.storage.getItem(this.deleteJournalKey) !== null) {
        return {
          envelope: nextEnvelope,
          error: "Deletion journal removal could not be verified.",
        };
      }
    } catch (error) {
      return {
        envelope: nextEnvelope,
        error: getErrorMessage(error),
      };
    }
    return { envelope: nextEnvelope };
  }

  private applyDeletionToV1(
    operation: PendingDeletionOperation,
  ): string | undefined {
    const raw = this.readRaw(this.v1StorageKey);
    if (raw.error) return raw.error;
    if (raw.raw === null) return undefined;
    const decoded = decodeV1EnvelopeRaw(raw.raw);
    if (
      decoded.history.status !== "complete" ||
      decoded.rankings.status !== "complete"
    ) {
      return "Cannot safely apply pending deletion to the v1 store.";
    }
    const records = applyLegacyRecordDeletion(
      decoded.history.validRecords,
      operation.scope,
      "v1",
    );
    return this.writeAndVerify(
      this.v1StorageKey,
      JSON.stringify({ schemaVersion: 1, records }),
    );
  }

  private applyDeletionToV2(
    operation: PendingDeletionOperation,
  ): string | undefined {
    const raw = this.readRaw(this.v2StorageKey);
    if (raw.error) return raw.error;
    if (raw.raw === null) return undefined;
    const decoded = decodeV2EnvelopeRaw(raw.raw);
    if (
      decoded.history.status !== "complete" ||
      decoded.rankings.status !== "complete"
    ) {
      return "Cannot safely apply pending deletion to the v2 store.";
    }
    const history = appliesToCollection(operation.scope, "history")
      ? applyLegacyRecordDeletion(
          decoded.history.validRecords,
          operation.scope,
          "v2",
        )
      : decoded.history.validRecords;
    const rankings = appliesToCollection(operation.scope, "rankings")
      ? applyLegacyRecordDeletion(
          decoded.rankings.validRecords,
          operation.scope,
          "v2",
        )
      : decoded.rankings.validRecords;
    return this.writeAndVerify(
      this.v2StorageKey,
      JSON.stringify({ schemaVersion: 2, history, rankings }),
    );
  }

  private readLegacyState(): LegacyState | { error: string } {
    const v1 = this.readRaw(this.v1StorageKey);
    if (v1.error) return { error: v1.error };
    const v2 = this.readRaw(this.v2StorageKey);
    if (v2.error) return { error: v2.error };
    return {
      v1Raw: v1.raw,
      v2Raw: v2.raw,
      v1: decodeV1EnvelopeRaw(v1.raw),
      v2: decodeV2EnvelopeRaw(v2.raw),
    };
  }

  private parseJournal(
    raw: string,
  ):
    | { ok: true; operation: PendingDeletionOperation }
    | { ok: false; error: string } {
    try {
      const parsed = journalSchema.safeParse(JSON.parse(raw));
      return parsed.success
        ? {
            ok: true,
            operation: parsed.data as PendingDeletionOperation,
          }
        : {
            ok: false,
            error:
              parsed.error.issues[0]?.message ??
              "Invalid deletion journal.",
          };
    } catch (error) {
      return { ok: false, error: getErrorMessage(error) };
    }
  }

  private createOperationId(): string {
    const current = this.readRaw(this.deleteSequenceKey);
    const parsed = current.raw === null
      ? 0
      : Number.parseInt(current.raw, 10);
    const next = Number.isSafeInteger(parsed) && parsed >= 0
      ? parsed + 1
      : 1;
    try {
      this.storage.setItem(this.deleteSequenceKey, String(next));
    } catch {
      // The journal write is still the authoritative operation boundary.
    }
    return `${this.now()}-${next}`;
  }

  private writeEnvelope(
    envelope: StoreEnvelopeV3,
  ): string | undefined {
    return this.writeAndVerify(
      this.storageKey,
      JSON.stringify(envelope),
    );
  }

  private writeAndVerify(
    key: string,
    serialized: string,
  ): string | undefined {
    try {
      this.storage.setItem(key, serialized);
      if (this.storage.getItem(key) !== serialized) {
        return `Storage read-back validation failed for "${key}".`;
      }
      return undefined;
    } catch (error) {
      return getErrorMessage(error);
    }
  }

  private readRaw(
    key: string,
  ): { raw: string | null; error?: string } {
    try {
      return { raw: this.storage.getItem(key) };
    } catch (error) {
      return { raw: null, error: getErrorMessage(error) };
    }
  }

  private quarantineV3(raw: string): void {
    try {
      this.storage.setItem(
        `${this.storageKey}.corrupt.${this.now()}`,
        raw,
      );
    } catch {
      // Best effort. Only the candidate v3 key is ever quarantined here.
    }
    try {
      this.storage.removeItem(this.storageKey);
    } catch {
      // A later read reports unavailable storage.
    }
  }
}

function reconcileLegacy(
  envelope: StoreEnvelopeV3,
  legacy: LegacyState,
  historyLimit: number,
  rankingLimit: number,
  rankingGroupLimit: number,
): {
  envelope: StoreEnvelopeV3;
  changed: boolean;
  warning?: string;
} {
  const before = JSON.stringify(envelope);
  const history = reconcileCollection(
    envelope.history,
    envelope.legacySync.importedHistory,
    legacy.v1.history,
    legacy.v2.history,
  );
  const rankings = reconcileCollection(
    envelope.rankings,
    envelope.legacySync.importedRankings,
    legacy.v1.rankings,
    legacy.v2.rankings,
  );
  const next = normalizeSyncMembership({
    schemaVersion: STORE_SCHEMA_VERSION,
    history: history.records.slice(0, historyLimit),
    rankings: buildRunRecordRankings(
      rankings.records,
      rankingLimit,
      rankingGroupLimit,
    ) as RunRecordV3[],
    legacySync: {
      importedHistory: history.provenance,
      importedRankings: rankings.provenance,
    },
  });
  const warnings = [
    getLegacyWarning("v1", legacy.v1),
    getLegacyWarning("v2", legacy.v2),
  ].filter((warning): warning is string => Boolean(warning));
  return {
    envelope: next,
    changed: JSON.stringify(next) !== before,
    ...(warnings.length > 0
      ? { warning: warnings.join(" ") }
      : {}),
  };
}

function reconcileCollection(
  existing: RunRecordV3[],
  existingProvenance: Record<string, LegacySource>,
  v1: LegacyCollectionDecode,
  v2: LegacyCollectionDecode,
): {
  records: RunRecordV3[];
  provenance: Record<string, LegacySource>;
} {
  const effective = getEffectiveLegacyRecords(v1, v2);
  const records = [...existing];
  const provenance = { ...existingProvenance };
  for (const [id, sourceRecord] of effective) {
    const index = records.findIndex((record) => record.id === id);
    const alreadyImported = provenance[id] !== undefined;
    if (index < 0 || alreadyImported) {
      const migrated = migrateRunRecordV2ToV3(sourceRecord.record);
      if (index < 0) records.push(migrated);
      else records[index] = migrated;
      provenance[id] = sourceRecord.source;
    }
  }

  if (canReconcileMissing(v1, v2)) {
    for (const id of Object.keys(provenance)) {
      if (effective.has(id)) continue;
      const index = records.findIndex((record) => record.id === id);
      if (index >= 0) records.splice(index, 1);
      delete provenance[id];
    }
  }
  return { records, provenance };
}

function getEffectiveLegacyRecords(
  v1: LegacyCollectionDecode,
  v2: LegacyCollectionDecode,
): Map<string, { source: LegacySource; record: RunRecordV2 }> {
  const records = new Map<
    string,
    { source: LegacySource; record: RunRecordV2 }
  >();
  for (const record of getValidRecords(v1)) {
    records.set(record.id, { source: "v1", record });
  }
  for (const record of getValidRecords(v2)) {
    records.set(record.id, { source: "v2", record });
  }
  return records;
}

function getValidRecords(
  collection: LegacyCollectionDecode,
): RunRecordV2[] {
  return collection.status === "complete" ||
    collection.status === "partial"
    ? collection.validRecords
    : [];
}

function canReconcileMissing(
  v1: LegacyCollectionDecode,
  v2: LegacyCollectionDecode,
): boolean {
  return [v1, v2].every(
    (collection) =>
      collection.status === "complete" ||
      collection.status === "missing",
  );
}

function getLegacyWarning(
  source: LegacySource,
  result: LegacyEnvelopeDecodeResult,
): string | null {
  const states = [result.history.status, result.rankings.status];
  if (!states.some((status) => status === "partial" || status === "invalid")) {
    return null;
  }
  return `${source} legacy records were only partially readable; destructive reconciliation was skipped.`;
}

function decodeV3Records(
  values: unknown[],
):
  | { ok: true; records: RunRecordV3[] }
  | { ok: false; error: string } {
  const records: RunRecordV3[] = [];
  for (const value of values) {
    const decoded = decodeRunRecordV3(value);
    if (!decoded.ok) return decoded;
    records.push(decoded.record);
  }
  return { ok: true, records };
}

function createEmptyEnvelope(): StoreEnvelopeV3 {
  return {
    schemaVersion: STORE_SCHEMA_VERSION,
    history: [],
    rankings: [],
    legacySync: {
      importedHistory: {},
      importedRankings: {},
    },
  };
}

function normalizeSyncMembership(
  envelope: StoreEnvelopeV3,
): StoreEnvelopeV3 {
  const historyIds = new Set(envelope.history.map((record) => record.id));
  const rankingIds = new Set(
    envelope.rankings.map((record) => record.id),
  );
  return {
    ...envelope,
    legacySync: {
      importedHistory: filterProvenance(
        envelope.legacySync.importedHistory,
        historyIds,
      ),
      importedRankings: filterProvenance(
        envelope.legacySync.importedRankings,
        rankingIds,
      ),
    },
  };
}

function filterProvenance(
  provenance: Record<string, LegacySource>,
  ids: ReadonlySet<string>,
): Record<string, LegacySource> {
  return Object.fromEntries(
    Object.entries(provenance).filter(([id]) => ids.has(id)),
  );
}

function applyDeletionScope(
  envelope: StoreEnvelopeV3,
  scope: PendingDeletionOperation["scope"],
): StoreEnvelopeV3 {
  const deleteFrom = (
    records: RunRecordV3[],
    collection: RunRecordCollection,
  ) => {
    if (!appliesToCollection(scope, collection)) return records;
    if (scope.kind === "record") {
      return records.filter((record) => record.id !== scope.recordId);
    }
    return [];
  };
  const history = deleteFrom(envelope.history, "history");
  const rankings = deleteFrom(envelope.rankings, "rankings");
  return {
    ...envelope,
    history,
    rankings,
    legacySync: {
      importedHistory: removeDeletedProvenance(
        envelope.legacySync.importedHistory,
        scope,
        "history",
      ),
      importedRankings: removeDeletedProvenance(
        envelope.legacySync.importedRankings,
        scope,
        "rankings",
      ),
    },
  };
}

function removeDeletedProvenance(
  provenance: Record<string, LegacySource>,
  scope: PendingDeletionOperation["scope"],
  collection: RunRecordCollection,
): Record<string, LegacySource> {
  if (!appliesToCollection(scope, collection)) return provenance;
  if (scope.kind === "collection") return {};
  return Object.fromEntries(
    Object.entries(provenance).filter(([id]) => id !== scope.recordId),
  );
}

function appliesToCollection(
  scope: PendingDeletionOperation["scope"],
  collection: RunRecordCollection,
): boolean {
  return scope.kind === "record"
    ? scope.collections.includes(collection)
    : scope.collection === "all" || scope.collection === collection;
}

function applyLegacyRecordDeletion(
  records: RunRecordV2[],
  scope: PendingDeletionOperation["scope"],
  source: LegacySource,
): RunRecordV2[] {
  if (scope.kind === "record") {
    return records.filter((record) => record.id !== scope.recordId);
  }
  if (scope.collection === "all") return [];
  if (source === "v1") {
    throw new Error("A v1 store cannot represent a one-sided clear.");
  }
  return [];
}

function getUnsafeV1PartialDeletionReason(
  scope: PendingDeletionOperation["scope"],
  v1: LegacyEnvelopeDecodeResult,
): string | null {
  if (
    scope.kind === "collection" &&
    scope.collection !== "all"
  ) {
    const records = getValidRecords(v1.history);
    const v1ProvablyEmpty =
      v1.history.status === "missing" ||
      (v1.history.status === "complete" && records.length === 0);
    if (!v1ProvablyEmpty) {
      return "The v1 store cannot represent a history-only or rankings-only clear. Clear both collections explicitly.";
    }
  }
  return null;
}

function getLegacyTargets(
  scope: PendingDeletionOperation["scope"],
  legacy: LegacyState,
): LegacySource[] {
  const targets: LegacySource[] = [];
  if (
    legacy.v1Raw !== null &&
    (scope.kind !== "record" ||
      getValidRecords(legacy.v1.history).some(
        (record) => record.id === scope.recordId,
      ))
  ) {
    targets.push("v1");
  }
  if (legacy.v2Raw !== null) targets.push("v2");
  return targets;
}

function isLegacySyncMetadata(
  value: unknown,
): value is LegacySyncMetadata {
  if (!isObject(value)) return false;
  return (
    isProvenanceMap(value.importedHistory) &&
    isProvenanceMap(value.importedRankings)
  );
}

function isProvenanceMap(
  value: unknown,
): value is Record<string, LegacySource> {
  return (
    isObject(value) &&
    Object.values(value).every(
      (source) => source === "v1" || source === "v2",
    )
  );
}

function toLoadResult(state: LoadedState): RunRecordLoadResult {
  return {
    records: mergeRunRecordCollections(
      state.envelope.history,
      state.envelope.rankings,
    ),
    history: state.envelope.history,
    rankings: state.envelope.rankings,
    recovered: state.recovered,
    ...(state.error ? { error: state.error } : {}),
  };
}

function toWriteResult(
  ok: boolean,
  envelope: StoreEnvelopeV3,
  error?: string,
): RunRecordWriteResult {
  return {
    ok,
    records: mergeRunRecordCollections(
      envelope.history,
      envelope.rankings,
    ),
    history: envelope.history,
    rankings: envelope.rankings,
    ...(error ? { error } : {}),
  };
}

function emptyWriteResult(
  ok: boolean,
  error?: string,
): RunRecordWriteResult {
  return toWriteResult(ok, createEmptyEnvelope(), error);
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function mergeDiagnostics(
  ...messages: Array<string | undefined>
): string | undefined {
  const unique = [...new Set(messages.filter(Boolean))];
  return unique.length > 0 ? unique.join(" ") : undefined;
}
