import { describe, expect, it } from "vitest";
import type { TutorialTarget } from "../domain/tutorial";
import {
  getCurrentRouteDestination,
  getTutorialCueKeys,
} from "./TutorialCueLayout";

const routeTarget: TutorialTarget = {
  kind: "zone",
  id: null,
  position: { x: 400, y: 166 },
  radius: 32,
  guidePath: [
    { x: 190, y: 116 },
    { x: 370, y: 116 },
  ],
};

describe("TutorialCueLayout", () => {
  it("shows every movement direction immediately for the first task", () => {
    expect(
      [...getTutorialCueKeys("move", { x: 480, y: 270 }, null)],
    ).toEqual(["W", "A", "S", "D"]);
  });

  it("reduces the active first task to the one required direction", () => {
    const rightTarget: TutorialTarget = {
      kind: "zone",
      id: null,
      position: { x: 600, y: 270 },
      radius: 28,
    };

    expect(
      [...getTutorialCueKeys("move", { x: 480, y: 270 }, rightTarget)],
    ).toEqual(["D"]);
  });

  it("shows only the safe vertical keys for the horizontal dodge drill", () => {
    expect(
      [...getTutorialCueKeys("dodge", { x: 480, y: 270 }, null)],
    ).toEqual(["W", "S"]);
  });

  it("follows the current waypoint instead of pointing through the wall", () => {
    expect(getCurrentRouteDestination({ x: 160, y: 166 }, routeTarget)).toEqual({
      x: 190,
      y: 116,
    });
    expect(
      [...getTutorialCueKeys("route", { x: 160, y: 166 }, routeTarget)],
    ).toEqual(["D", "W"]);

    expect(getCurrentRouteDestination({ x: 190, y: 116 }, routeTarget)).toEqual({
      x: 370,
      y: 116,
    });
    expect(
      [...getTutorialCueKeys("route", { x: 190, y: 116 }, routeTarget)],
    ).toEqual(["D"]);
  });

  it("derives pickup directions from the live player and target positions", () => {
    const pickupTarget: TutorialTarget = {
      kind: "pickup",
      id: "pickup-1",
      position: { x: 240, y: 120 },
      radius: 20,
    };

    expect(
      [
        ...getTutorialCueKeys(
          "route",
          { x: 180, y: 200 },
          pickupTarget,
        ),
      ],
    ).toEqual(["D", "W"]);
  });
});
