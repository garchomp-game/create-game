import { describe, expect, it } from "vitest";
import { DurationHistogram } from "./DurationHistogram";

describe("DurationHistogram", () => {
  it("summarizes bounded durations without retaining frame samples", () => {
    const histogram = new DurationHistogram(10, 1);
    [1.2, 2.7, 4.1, 20].forEach((duration) => histogram.record(duration));
    histogram.record(Number.NaN);
    histogram.record(-1);

    expect(histogram.getSnapshot()).toEqual({
      samples: 4,
      averageMs: 7,
      p95Ms: 10,
      maxMs: 20,
    });
  });

  it("resets all accumulated values", () => {
    const histogram = new DurationHistogram();
    histogram.record(3.5);
    histogram.reset();

    expect(histogram.getSnapshot()).toEqual({
      samples: 0,
      averageMs: 0,
      p95Ms: 0,
      maxMs: 0,
    });
  });
});
