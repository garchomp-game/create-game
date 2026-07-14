import type { GameMetric } from "../../domain/types";
import type { MetricsPort, MetricsReader, MetricsSnapshot } from "../../ports/MetricsPort";

const RAW_DT_HISTOGRAM_MAX_MS = 250;

export class InMemoryMetrics implements MetricsPort, MetricsReader {
  private readonly dtSamples: number[] = [];
  private readonly rawDtHistogram = Array<number>(RAW_DT_HISTOGRAM_MAX_MS + 1).fill(0);
  private frameSamples = 0;
  private rawDtTotalMs = 0;
  private maxRawDtMs = 0;
  private framesOver50Ms = 0;
  private enemies = 0;
  private bullets = 0;

  record(metric: GameMetric): void {
    if (metric.type === "timing" && metric.name === "frame.raw_dt_ms") {
      this.recordRawDt(metric.valueMs);
      return;
    }

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
      frameSamples: this.frameSamples,
      averageRawDtMs: this.frameSamples > 0 ? this.rawDtTotalMs / this.frameSamples : 0,
      p95RawDtMs: histogramPercentile(
        this.rawDtHistogram,
        this.frameSamples,
        0.95,
      ),
      maxRawDtMs: this.maxRawDtMs,
      framesOver50Ms: this.framesOver50Ms,
      enemies: this.enemies,
      bullets: this.bullets,
    };
  }

  reset(): void {
    this.dtSamples.length = 0;
    this.rawDtHistogram.fill(0);
    this.frameSamples = 0;
    this.rawDtTotalMs = 0;
    this.maxRawDtMs = 0;
    this.framesOver50Ms = 0;
    this.enemies = 0;
    this.bullets = 0;
  }

  private recordRawDt(valueMs: number): void {
    if (!Number.isFinite(valueMs) || valueMs < 0) return;
    this.frameSamples += 1;
    this.rawDtTotalMs += valueMs;
    this.maxRawDtMs = Math.max(this.maxRawDtMs, valueMs);
    if (valueMs >= 50) this.framesOver50Ms += 1;
    const bucket = Math.min(RAW_DT_HISTOGRAM_MAX_MS, Math.floor(valueMs));
    this.rawDtHistogram[bucket] += 1;
  }
}

function percentile(values: number[], ratio: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.floor((sorted.length - 1) * ratio));
  return sorted[index] ?? 0;
}

function histogramPercentile(histogram: readonly number[], total: number, ratio: number): number {
  if (total <= 0) return 0;
  const target = Math.max(1, Math.ceil(total * ratio));
  let seen = 0;
  for (let index = 0; index < histogram.length; index += 1) {
    seen += histogram[index] ?? 0;
    if (seen >= target) return index;
  }
  return histogram.length - 1;
}
