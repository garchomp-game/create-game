import { describe, expect, it } from "vitest";
import {
  ARENA_DYNAMIC_WORLD_DEPTH,
  TUTORIAL_CHECKLIST_GRAPHICS_DEPTH,
  TUTORIAL_CHECKLIST_TEXT_DEPTH,
  TUTORIAL_OVERLAY_GRAPHICS_DEPTH,
  TUTORIAL_OVERLAY_TEXT_DEPTH,
} from "./PhaserArenaDepths";

describe("Phaser arena depth contract", () => {
  it("keeps the transfer checklist behind every dynamic world entity", () => {
    expect(TUTORIAL_CHECKLIST_GRAPHICS_DEPTH).toBeLessThan(
      TUTORIAL_CHECKLIST_TEXT_DEPTH,
    );
    expect(TUTORIAL_CHECKLIST_TEXT_DEPTH).toBeLessThan(
      ARENA_DYNAMIC_WORLD_DEPTH,
    );
  });

  it("keeps regular tutorial guidance above the dynamic world", () => {
    expect(TUTORIAL_OVERLAY_GRAPHICS_DEPTH).toBeGreaterThan(
      ARENA_DYNAMIC_WORLD_DEPTH,
    );
    expect(TUTORIAL_OVERLAY_TEXT_DEPTH).toBeGreaterThan(
      TUTORIAL_OVERLAY_GRAPHICS_DEPTH,
    );
  });
});
