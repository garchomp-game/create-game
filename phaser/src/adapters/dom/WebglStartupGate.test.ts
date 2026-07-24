import { describe, expect, it } from "vitest";
import { canStartWebgl } from "./WebglStartupGate";

describe("canStartWebgl", () => {
  it("accepts WebGL 2 and falls back to WebGL 1", () => {
    expect(
      canStartWebgl(() => ({
        getContext: (contextId) => (contextId === "webgl2" ? {} : null),
      })),
    ).toBe(true);
    expect(
      canStartWebgl(() => ({
        getContext: (contextId) => (contextId === "webgl" ? {} : null),
      })),
    ).toBe(true);
  });

  it("rejects missing or throwing WebGL contexts", () => {
    expect(
      canStartWebgl(() => ({
        getContext: () => null,
      })),
    ).toBe(false);
    expect(
      canStartWebgl(() => {
        throw new Error("canvas unavailable");
      }),
    ).toBe(false);
  });
});
