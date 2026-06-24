import type { GameMetric } from "../../domain/types";
import type { MetricsPort, MetricsReader, MetricsSnapshot } from "../../ports/MetricsPort";

export class InMemoryMetrics implements MetricsPort, MetricsReader {
  private readonly dtSamples: number[] = [];
  private enemies = 0;
  private bullets = 0;

  record(metric: GameMetric): void {
    if (metric.type === "timing" && metric.name === "frame.dt_ms") {
      this.dtSamples.push(metric.valueMs);
      if (this.dtSamples.length > 120) {
        this.dtSamples.shift();
      }
      return;
    }

    if (metric.type === "gauge" && metric.name === "world.enemies") {
      this.enemies = metric.value;
      return;
    }

    if (metric.type === "gauge" && metric.name === "world.bullets") {
      this.bullets = metric.value;
    }
  }

  getSnapshot(): MetricsSnapshot {
    return {
      dtMs: this.dtSamples.at(-1) ?? 0,
      p95DtMs: percentile(this.dtSamples, 0.95),
      enemies: this.enemies,
      bullets: this.bullets,
    };
  }
}

function percentile(values: number[], ratio: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.floor((sorted.length - 1) * ratio));
  return sorted[index] ?? 0;
}
