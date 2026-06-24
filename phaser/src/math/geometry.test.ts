import { describe, expect, it } from "vitest";
import { circleCircle, circleRect, clamp } from "./geometry";

describe("geometry", () => {
  it("clamps values to the given range", () => {
    expect(clamp(-1, 0, 10)).toBe(0);
    expect(clamp(5, 0, 10)).toBe(5);
    expect(clamp(11, 0, 10)).toBe(10);
  });

  it("detects circle-circle contact at the boundary", () => {
    expect(
      circleCircle(
        { position: { x: 0, y: 0 }, radius: 10 },
        { position: { x: 20, y: 0 }, radius: 10 },
      ),
    ).toBe(true);
  });

  it("detects circle-rect contact at an edge", () => {
    expect(
      circleRect(
        { position: { x: 90, y: 50 }, radius: 10 },
        { id: "rect", x: 100, y: 25, width: 50, height: 50 },
      ),
    ).toBe(true);
  });

  it("returns false when the circle is outside the rectangle radius", () => {
    expect(
      circleRect(
        { position: { x: 80, y: 50 }, radius: 10 },
        { id: "rect", x: 100, y: 25, width: 50, height: 50 },
      ),
    ).toBe(false);
  });
});
