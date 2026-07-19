import type { RunRecord } from "../domain/runRecords";

export type StorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem">;

export type RunRecordLoadResult = {
  records: RunRecord[];
  history: RunRecord[];
  rankings: RunRecord[];
  recovered: boolean;
  error?: string;
};

export type RunRecordWriteResult = {
  ok: boolean;
  records: RunRecord[];
  history: RunRecord[];
  rankings: RunRecord[];
  error?: string;
};

export interface RunRecordStorePort {
  load(): RunRecordLoadResult;
  save(record: RunRecord): RunRecordWriteResult;
  delete(recordId: string): RunRecordWriteResult;
  clearHistory(): RunRecordWriteResult;
  clearRankings(): RunRecordWriteResult;
  clear(): RunRecordWriteResult;
}
