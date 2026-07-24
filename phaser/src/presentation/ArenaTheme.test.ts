import { describe, expect, it } from "vitest";
import {
  ARENA_PHASER_COLORS,
  ARENA_THEME,
  hexToPhaserColor,
} from "./ArenaTheme";
import {
  applyArenaDomTheme,
  ARENA_DOM_THEME_VARIABLES,
} from "../adapters/dom/applyArenaDomTheme";

describe("ArenaTheme", () => {
  it("provides equivalent CSS and Phaser color values", () => {
    expect(ARENA_THEME.colors.text).toBe("#f8fafc");
    expect(ARENA_PHASER_COLORS.text).toBe(0xf8fafc);
    expect(ARENA_PHASER_COLORS.overlay).toBe(0x020617);
  });

  it("rejects color formats Phaser cannot consume consistently", () => {
    expect(hexToPhaserColor("#22b8cf")).toBe(0x22b8cf);
    expect(() => hexToPhaserColor("#fff")).toThrow(/six-digit hex color/);
  });

  it("applies the canonical tokens without requiring a browser global", () => {
    const properties = new Map<string, string>();
    applyArenaDomTheme({
      style: {
        setProperty: (name, value) => properties.set(name, value),
      },
    });

    expect(Object.fromEntries(properties)).toEqual(ARENA_DOM_THEME_VARIABLES);
  });
});
