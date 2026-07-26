import { describe, expect, it } from "vitest";
import { VIEW_CONFIG } from "../../config/gameConfig";
import {
  ARENA_ENTITY_TEXTURES,
  ARENA_ENTITY_VISUAL_CATALOG,
  getArenaEntitySpriteTint,
  getArenaEntitySpriteVisual,
  getBossSpriteSize,
  getEnemySpriteVisual,
  getPlayerSpriteSize,
  getSpriteRotation,
  getXpSpriteSize,
} from "./PhaserArenaEntityVisuals";

describe("PhaserArenaEntityVisuals", () => {
  it("keeps every runtime and reference-screen entity in one asset catalog", () => {
    expect(Object.keys(ARENA_ENTITY_VISUAL_CATALOG)).toEqual([
      "player",
      "chaser",
      "brute",
      "fast",
      "ranged",
      "boss",
      "xp",
    ]);
    expect(ARENA_ENTITY_TEXTURES).toEqual(
      Object.values(ARENA_ENTITY_VISUAL_CATALOG).map(
        ({ textureKey, path }) => ({
          key: textureKey,
          path,
        }),
      ),
    );
    expect(
      new Set(ARENA_ENTITY_TEXTURES.map(({ path }) => path)).size,
    ).toBe(ARENA_ENTITY_TEXTURES.length);
  });

  it("assigns a distinct silhouette texture to every regular enemy role", () => {
    const textureKeys = ["chaser", "brute", "fast", "ranged"].map(
      (typeId) =>
        getEnemySpriteVisual(
          typeId as "chaser" | "brute" | "fast" | "ranged",
          10,
        ).textureKey,
    );

    expect(new Set(textureKeys).size).toBe(textureKeys.length);
    expect(new Set(ARENA_ENTITY_TEXTURES.map(({ key }) => key)).size).toBe(
      ARENA_ENTITY_TEXTURES.length,
    );
  });

  it("keeps sprite dimensions proportional to simulation hit radii", () => {
    expect(getPlayerSpriteSize(16)).toEqual({ width: 42.4, height: 32 });
    expect(getBossSpriteSize(44)).toEqual({ width: 154, height: 103.4 });
    const brute = getEnemySpriteVisual("brute", 20);
    expect(brute.width).toBeCloseTo(52);
    expect(brute.height).toBeCloseTo(42.4);
    expect(getXpSpriteSize(6)).toBe(7.5);
  });

  it("shares role tint and source orientation with preview components", () => {
    expect(getArenaEntitySpriteTint("player", VIEW_CONFIG)).toBeNull();
    expect(getArenaEntitySpriteTint("boss", VIEW_CONFIG)).toBeNull();
    expect(getArenaEntitySpriteTint("chaser", VIEW_CONFIG)).toBe(
      VIEW_CONFIG.enemy.chaser.color,
    );
    expect(getArenaEntitySpriteTint("xp", VIEW_CONFIG)).toBe(
      VIEW_CONFIG.pickup.xpColor,
    );
    expect(getArenaEntitySpriteVisual("player", 16).textureNose).toBe("up");
    expect(getArenaEntitySpriteVisual("ranged", 13).textureNose).toBe("down");
  });

  it("aligns player and enemy source art with their travel direction", () => {
    expect(getSpriteRotation({ x: 0, y: -1 }, "up")).toBeCloseTo(0);
    expect(getSpriteRotation({ x: 0, y: 1 }, "down")).toBeCloseTo(0);
    expect(getSpriteRotation({ x: 1, y: 0 }, "up")).toBeCloseTo(Math.PI / 2);
    expect(getSpriteRotation({ x: 1, y: 0 }, "down")).toBeCloseTo(-Math.PI / 2);
  });
});
