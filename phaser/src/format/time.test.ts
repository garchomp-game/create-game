import { describe, expect, it } from "vitest";
import { formatTime, formatTimePrecise } from "./time";

describe("formatTime", () => {
  it("formats elapsed seconds as mm:ss", () => {
    expect(formatTime(0)).toBe("00:00");
    expect(formatTime(65)).toBe("01:05");
    expect(formatTime(599.9)).toBe("09:59");
  });
});

describe("formatTimePrecise", () => {
  it("rounds and displays centiseconds", () => {
    expect(formatTimePrecise(0)).toBe("00:00.00");
    expect(formatTimePrecise(65.678)).toBe("01:05.68");
    expect(formatTimePrecise(59.999)).toBe("01:00.00");
  });
});
