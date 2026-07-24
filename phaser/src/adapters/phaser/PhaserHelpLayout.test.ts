import { describe, expect, it } from "vitest";
import {
  getHelpCloseButtonBounds,
  getHelpHudButtonBounds,
  getHelpTabButtonBounds,
  isPointInHelpBounds,
} from "./PhaserHelpLayout";

describe("PhaserHelpLayout", () => {
  it("keeps the in-run help target inside the lower-right arena edge", () => {
    const bounds = getHelpHudButtonBounds(960, 540);

    expect(bounds).toEqual({ x: 904, y: 484, width: 36, height: 36 });
    expect(isPointInHelpBounds(bounds, 922, 502)).toBe(true);
    expect(isPointInHelpBounds(bounds, 903, 502)).toBe(false);
  });

  it("centers the close action below the legend", () => {
    expect(getHelpCloseButtonBounds(960, 540)).toEqual({
      x: 350,
      y: 478,
      width: 260,
      height: 42,
    });
  });

  it("centers three stable help tabs above the page content", () => {
    expect(getHelpTabButtonBounds(960)).toEqual([
      {
        action: "helpControls",
        page: "controls",
        x: 245,
        y: 92,
        width: 150,
        height: 38,
      },
      {
        action: "helpEnemies",
        page: "enemies",
        x: 405,
        y: 92,
        width: 150,
        height: 38,
      },
      {
        action: "helpField",
        page: "field",
        x: 565,
        y: 92,
        width: 150,
        height: 38,
      },
    ]);
  });
});
