import { describe, expect, it } from "vitest";
import {
  getPracticeSettingsButtonBounds,
  isPointInPracticeControl,
} from "./PhaserPracticeLayout";

describe("PhaserPracticeLayout", () => {
  it("keeps the live settings control centered between the HUD panels", () => {
    const bounds = getPracticeSettingsButtonBounds(960);

    expect(bounds).toEqual({ x: 420, y: 14, width: 120, height: 34 });
    expect(isPointInPracticeControl(bounds, 480, 31)).toBe(true);
    expect(isPointInPracticeControl(bounds, 419, 31)).toBe(false);
  });
});
