import { describe, expect, it } from "vitest";
import { normalize } from "./vector";

describe("normalize", () => {
  it("returns zero vector for near-zero input", () => {
    expect(normalize(0, 0)).toEqual({ x: 0, y: 0 });
  });

  it("normalizes diagonal input to length 1", () => {
    const result = normalize(1, 1);
    expect(Math.hypot(result.x, result.y)).toBeCloseTo(1);
  });
});
