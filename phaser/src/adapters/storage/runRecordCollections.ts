import {
  createRunComparisonQuery,
  isRankableRun,
  selectRanking,
} from "../../application/runRecords";
import type {
  RunComparisonKey,
  RunRecord,
} from "../../domain/runRecords";

export function buildRunRecordRankings(
  records: RunRecord[],
  limit: number,
  groupLimit: number,
): RunRecord[] {
  const groups = new Map<string, RunRecord[]>();
  for (const record of deduplicateRunRecords(records)) {
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
          const weaponSource = group.find(
            (record) => record.weaponId === weaponId,
          )!;
          return selectRanking(
            group,
            createRunComparisonQuery(weaponSource, "weapon"),
            limit,
          );
        });
      return deduplicateRunRecords([...overall, ...byWeapon]);
    });
  return deduplicateRunRecords(selected);
}

export function sortRunRecordHistory(
  records: RunRecord[],
): RunRecord[] {
  return deduplicateRunRecords(records).sort(
    (left, right) =>
      right.capturedAt.localeCompare(left.capturedAt) ||
      right.id.localeCompare(left.id),
  );
}

export function mergeRunRecordCollections(
  history: RunRecord[],
  rankings: RunRecord[],
): RunRecord[] {
  return deduplicateRunRecords([...history, ...rankings]);
}

export function deduplicateRunRecords(
  records: RunRecord[],
): RunRecord[] {
  const byId = new Map<string, RunRecord>();
  for (const record of records) {
    if (!byId.has(record.id)) byId.set(record.id, record);
  }
  return [...byId.values()];
}

function getLatestCapturedAt(records: readonly RunRecord[]): string {
  return records.reduce(
    (latest, record) =>
      record.capturedAt > latest ? record.capturedAt : latest,
    "",
  );
}

function comparisonGroupToString(
  key: RunComparisonKey & Pick<RunRecord, "seed">,
): string {
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
