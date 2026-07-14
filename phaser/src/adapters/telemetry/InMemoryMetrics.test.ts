import { describe, expect, it } from "vitest";
import { InMemoryMetrics } from "./InMemoryMetrics";

describe("InMemoryMetrics", () => {
  it("keeps fixed-size run frame statistics alongside the rolling debug window", () => {
    const metrics = new InMemoryMetrics();

    for (let index = 0; index < 100; index += 1) {
      metrics.record({ type: "timing", name: "frame.raw_dt_ms", valueMs: index });
      metrics.record({ type: "timing", name: "frame.dt_ms", valueMs: Math.min(index, 50) });
    }
    metrics.record({ type: "gauge", name: "world.enemies", value: 42 });
    metrics.record({ type: "gauge", name: "world.bullets", value: 18 });

    expect(metrics.getSnapshot()).toMatchObject({
      dtMs: 50,
      p95DtMs: 50,
      frameSamples: 100,
      averageRawDtMs: 49.5,
      p95RawDtMs: 94,
      maxRawDtMs: 99,
      framesOver50Ms: 50,
      enemies: 42,
      bullets: 18,
    });
  });

  it("resets run-scoped samples without retaining a previous play session", () => {
    const metrics = new InMemoryMetrics();
    metrics.record({ type: "timing", name: "frame.raw_dt_ms", valueMs: 60 });
    metrics.record({ type: "timing", name: "frame.dt_ms", valueMs: 50 });

    metrics.reset();

    expect(metrics.getSnapshot()).toEqual({
      dtMs: 0,
      p95DtMs: 0,
      frameSamples: 0,
      averageRawDtMs: 0,
      p95RawDtMs: 0,
      maxRawDtMs: 0,
      framesOver50Ms: 0,
      enemies: 0,
      bullets: 0,
    });
  });
});
