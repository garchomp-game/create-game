import { describe, expect, it } from "vitest";
import {
  getTacticalStatusDockBounds,
  HUD_LEFT_PANEL_BOUNDS,
} from "./PhaserHudLayout";

describe("PhaserHudLayout", () => {
  it("keeps the tactical dock inside the existing top HUD band", () => {
    const arenaWidth = 960;
    const bounds = getTacticalStatusDockBounds(arenaWidth);
    const rightPanelX = arenaWidth - 286;

    expect(bounds).toEqual({
      x: 370,
      y: 14,
      width: 298,
      maxHeight: 82,
    });
    expect(bounds.x).toBeGreaterThanOrEqual(
      HUD_LEFT_PANEL_BOUNDS.x + HUD_LEFT_PANEL_BOUNDS.width + 6,
    );
    expect(bounds.x + bounds.width).toBeLessThanOrEqual(rightPanelX - 6);
    expect(bounds.y + bounds.maxHeight).toBeLessThanOrEqual(96);
  });
});
