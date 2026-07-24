import type { RunStats, WorldState } from "../domain/types";

export type LegacyWorldProjection = Omit<WorldState, "stats"> & {
  stats: Omit<RunStats, "exProtocolMetrics">;
};

export function projectLegacyWorldForDigest(
  world: WorldState,
): LegacyWorldProjection {
  const clone = structuredClone(world);
  const {
    exProtocolMetrics: _candidateTelemetry,
    ...legacyStats
  } = clone.stats;
  return {
    ...clone,
    stats: legacyStats,
  };
}
