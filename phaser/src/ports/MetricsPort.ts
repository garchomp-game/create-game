import type { GameMetric } from "../domain/types";

export type MetricsSnapshot = {
  dtMs: number;
  p95DtMs: number;
  frameSamples: number;
  averageRawDtMs: number;
  p95RawDtMs: number;
  maxRawDtMs: number;
  framesOver50Ms: number;
  enemies: number;
  bullets: number;
};

export type MetricsPort = {
  record(metric: GameMetric): void;
};

export type MetricsReader = {
  getSnapshot(): MetricsSnapshot;
};
