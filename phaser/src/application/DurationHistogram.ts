export type DurationHistogramSnapshot = {
  samples: number;
  averageMs: number;
  p95Ms: number;
  maxMs: number;
};

export class DurationHistogram {
  private readonly buckets: Uint32Array;
  private samples = 0;
  private totalMs = 0;
  private maxMs = 0;

  constructor(
    private readonly maximumMs = 100,
    private readonly bucketSizeMs = 0.25,
  ) {
    if (maximumMs <= 0 || bucketSizeMs <= 0) {
      throw new Error("Duration histogram bounds must be positive.");
    }
    this.buckets = new Uint32Array(
      Math.ceil(maximumMs / bucketSizeMs) + 1,
    );
  }

  record(durationMs: number): void {
    if (!Number.isFinite(durationMs) || durationMs < 0) return;
    this.samples += 1;
    this.totalMs += durationMs;
    this.maxMs = Math.max(this.maxMs, durationMs);
    const bucket = Math.min(
      this.buckets.length - 1,
      Math.floor(durationMs / this.bucketSizeMs),
    );
    this.buckets[bucket] += 1;
  }

  reset(): void {
    this.buckets.fill(0);
    this.samples = 0;
    this.totalMs = 0;
    this.maxMs = 0;
  }

  getSnapshot(): DurationHistogramSnapshot {
    return {
      samples: this.samples,
      averageMs: this.samples > 0 ? this.totalMs / this.samples : 0,
      p95Ms: this.percentile(0.95),
      maxMs: this.maxMs,
    };
  }

  private percentile(ratio: number): number {
    if (this.samples === 0) return 0;
    const target = Math.max(1, Math.ceil(this.samples * ratio));
    let seen = 0;
    for (let index = 0; index < this.buckets.length; index += 1) {
      seen += this.buckets[index] ?? 0;
      if (seen >= target) return index * this.bucketSizeMs;
    }
    return this.maximumMs;
  }
}
