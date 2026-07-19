import type { GameMetric } from "../domain/types";
import type { MetricsPort, MetricsReader } from "../ports/MetricsPort";

export type ArenaPerformanceSnapshot = {
  frameSamples: number;
  averageRawDtMs: number;
  p95RawDtMs: number;
  maxRawDtMs: number;
  framesOver50Ms: number;
  estimatedFps: number;
  actualFps: number;
};

type ResettableMetrics = MetricsPort & MetricsReader & { reset(): void };
type FrameMetricReporter = { report(metrics: GameMetric[]): void };

export class PerformanceMonitor {
  private finalizedSnapshot: ArenaPerformanceSnapshot | null = null;

  constructor(
    private readonly metrics: ResettableMetrics,
    private readonly frameReporter: FrameMetricReporter,
  ) {}

  reset(): void {
    this.metrics.reset();
    this.finalizedSnapshot = null;
  }

  record(
    sourceMetrics: readonly GameMetric[],
    observedRawDtMs: number | undefined,
    actualFps: number,
    finalize = false,
  ): void {
    const metrics = sourceMetrics.map((metric) =>
      metric.type === "timing" &&
      metric.name === "frame.raw_dt_ms" &&
      observedRawDtMs !== undefined
        ? { ...metric, valueMs: observedRawDtMs }
        : metric,
    );
    for (const metric of metrics) this.metrics.record(metric);
    this.frameReporter.report(metrics);
    if (finalize) this.finalizedSnapshot = this.createSnapshot(actualFps);
  }

  getSnapshot(actualFps: number): ArenaPerformanceSnapshot {
    return this.finalizedSnapshot ?? this.createSnapshot(actualFps);
  }

  get metricsReader(): MetricsReader {
    return this.metrics;
  }

  private createSnapshot(actualFps: number): ArenaPerformanceSnapshot {
    const metrics = this.metrics.getSnapshot();
    return {
      frameSamples: metrics.frameSamples,
      averageRawDtMs: metrics.averageRawDtMs,
      p95RawDtMs: metrics.p95RawDtMs,
      maxRawDtMs: metrics.maxRawDtMs,
      framesOver50Ms: metrics.framesOver50Ms,
      estimatedFps:
        metrics.averageRawDtMs > 0 ? 1_000 / metrics.averageRawDtMs : 0,
      actualFps: Number.isFinite(actualFps) ? actualFps : 0,
    };
  }
}
