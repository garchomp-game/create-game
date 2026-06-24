import { describe, expect, it } from "vitest";
import { formatTime } from "./time";

describe("formatTime", () => {
  it("formats elapsed seconds as mm:ss", () => {
    expect(formatTime(0)).toBe("00:00");
    expect(formatTime(65)).toBe("01:05");
    expect(formatTime(599.9)).toBe("09:59");
  });
});
