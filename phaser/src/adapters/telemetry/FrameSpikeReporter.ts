import type { GameMetric } from "../../domain/types";
import type { LoggerPort } from "../../ports/LoggerPort";
import type { MetricsReader } from "../../ports/MetricsPort";

export class FrameSpikeReporter {
  private lastWarningAt = 0;

  constructor(
    private readonly logger: LoggerPort,
    private readonly metrics: MetricsReader,
    private readonly thresholdMs = 50,
    private readonly cooldownMs = 1000,
  ) {}

  report(metrics: GameMetric[]): void {
    const frameMetric = metrics.find(
      (metric) => metric.type === "timing" && metric.name === "frame.raw_dt_ms",
    );
    if (!frameMetric || frameMetric.type !== "timing") return;
    if (frameMetric.valueMs < this.thresholdMs) return;

    const now = performance.now();
    if (now - this.lastWarningAt < this.cooldownMs) return;
    this.lastWarningAt = now;

    const snapshot = this.metrics.getSnapshot();
    this.logger.warn("performance.frame_spike", {
      rawDtMs: Number(frameMetric.valueMs.toFixed(1)),
      dtMs: Number(snapshot.dtMs.toFixed(1)),
      p95DtMs: Number(snapshot.p95DtMs.toFixed(1)),
      enemies: snapshot.enemies,
      bullets: snapshot.bullets,
    });
  }
}
