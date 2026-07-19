import { describe, expect, it, vi } from "vitest";
import { InMemoryMetrics } from "../adapters/telemetry/InMemoryMetrics";
import { PerformanceMonitor } from "./PerformanceMonitor";

describe("PerformanceMonitor", () => {
  it("records observed raw delta and freezes the game-over snapshot", () => {
    const metrics = new InMemoryMetrics();
    const reporter = { report: vi.fn() };
    const monitor = new PerformanceMonitor(metrics, reporter);

    monitor.record(
      [
        { type: "timing", name: "frame.raw_dt_ms", valueMs: 16 },
        { type: "timing", name: "frame.dt_ms", valueMs: 16 },
      ],
      24,
      60,
      true,
    );
    monitor.record(
      [{ type: "timing", name: "frame.raw_dt_ms", valueMs: 40 }],
      40,
      30,
    );

    expect(reporter.report).toHaveBeenCalledTimes(2);
    expect(reporter.report.mock.calls[0]?.[0]).toContainEqual({
      type: "timing",
      name: "frame.raw_dt_ms",
      valueMs: 24,
    });
    expect(monitor.getSnapshot(30)).toMatchObject({
      frameSamples: 1,
      averageRawDtMs: 24,
      actualFps: 60,
    });
  });

  it("resets aggregate and finalized state", () => {
    const monitor = new PerformanceMonitor(new InMemoryMetrics(), {
      report: () => undefined,
    });
    monitor.record(
      [{ type: "timing", name: "frame.raw_dt_ms", valueMs: 20 }],
      undefined,
      50,
      true,
    );

    monitor.reset();

    expect(monitor.getSnapshot(Number.NaN)).toEqual({
      frameSamples: 0,
      averageRawDtMs: 0,
      p95RawDtMs: 0,
      maxRawDtMs: 0,
      framesOver50Ms: 0,
      estimatedFps: 0,
      actualFps: 0,
    });
  });
});
