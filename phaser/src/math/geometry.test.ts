import { describe, expect, it } from "vitest";
import { circleCircle, circleRect, clamp, segmentCircleFirstIntersection } from "./geometry";

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

  it("allows circle-rect tangent contact at an edge", () => {
    expect(
      circleRect(
        { position: { x: 90, y: 50 }, radius: 10 },
        { id: "rect", x: 100, y: 25, width: 50, height: 50 },
      ),
    ).toBe(false);
  });

  it("detects circle-rect overlap past an edge", () => {
    expect(
      circleRect(
        { position: { x: 91, y: 50 }, radius: 10 },
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

  it("finds the first swept intersection with combined radii", () => {
    const hit = segmentCircleFirstIntersection(
      { x: 0, y: 10 },
      { x: 100, y: 10 },
      { position: { x: 50, y: 20 }, radius: 6 },
      4,
    );

    expect(hit?.t).toBeCloseTo(0.5);
    expect(hit?.position).toEqual({ x: 50, y: 10 });
  });

  it("detects a target crossed between frame endpoints", () => {
    const hit = segmentCircleFirstIntersection(
      { x: 0, y: 0 },
      { x: 80, y: 0 },
      { position: { x: 40, y: 0 }, radius: 11 },
      4,
    );

    expect(hit?.t).toBeCloseTo(0.3125);
    expect(hit?.position.x).toBeCloseTo(25);
  });

  it("returns null when a swept segment misses the target", () => {
    expect(
      segmentCircleFirstIntersection(
        { x: 0, y: 0 },
        { x: 100, y: 0 },
        { position: { x: 50, y: 30 }, radius: 10 },
        4,
      ),
    ).toBeNull();
  });
});
