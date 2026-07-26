import type { EnemyTypeId, Vec2, ViewConfig } from "../../domain/types";
import {
  ARENA_ENTITY_VISUAL_CATALOG,
  type ArenaEntityVisualId,
} from "../../presentation/ArenaEntityVisualCatalog";

export {
  ARENA_ENTITY_VISUAL_CATALOG,
  type ArenaEntityVisualId,
} from "../../presentation/ArenaEntityVisualCatalog";

export const ARENA_ENTITY_TEXTURES = Object.values(
  ARENA_ENTITY_VISUAL_CATALOG,
).map(({ textureKey, path }) => ({ key: textureKey, path }));

export const PLAYER_TEXTURE_KEY =
  ARENA_ENTITY_VISUAL_CATALOG.player.textureKey;
export const BOSS_TEXTURE_KEY = ARENA_ENTITY_VISUAL_CATALOG.boss.textureKey;
export const XP_TEXTURE_KEY = ARENA_ENTITY_VISUAL_CATALOG.xp.textureKey;

export function getArenaEntitySpriteVisual(
  visualId: ArenaEntityVisualId,
  radius: number,
) {
  const spec = ARENA_ENTITY_VISUAL_CATALOG[visualId];
  const xpSize = visualId === "xp" ? getXpSpriteSize(radius) : null;
  return {
    textureKey: spec.textureKey,
    textureNose: spec.textureNose,
    width: xpSize ?? radius * spec.widthScale,
    height: xpSize ?? radius * spec.heightScale,
  };
}

export function getArenaEntitySpriteTint(
  visualId: ArenaEntityVisualId,
  viewConfig: ViewConfig,
): number | null {
  if (visualId === "xp") return viewConfig.pickup.xpColor;
  if (
    visualId === "chaser" ||
    visualId === "brute" ||
    visualId === "fast" ||
    visualId === "ranged"
  ) {
    return viewConfig.enemy[visualId].color;
  }
  return null;
}

export function getEnemySpriteVisual(typeId: EnemyTypeId, radius: number) {
  return getArenaEntitySpriteVisual(typeId, radius);
}

export function getPlayerSpriteSize(radius: number) {
  const visual = getArenaEntitySpriteVisual("player", radius);
  return {
    width: visual.width,
    height: visual.height,
  };
}

export function getBossSpriteSize(radius: number) {
  const visual = getArenaEntitySpriteVisual("boss", radius);
  return {
    width: visual.width,
    height: visual.height,
  };
}

export function getXpSpriteSize(radius: number): number {
  return Math.max(6, Math.min(9, radius * 1.25));
}

export function getSpriteRotation(
  direction: Vec2,
  textureNose: "up" | "down",
): number {
  if (Math.abs(direction.x) + Math.abs(direction.y) < 0.0001) return 0;
  const directionAngle = Math.atan2(direction.y, direction.x);
  return directionAngle + (textureNose === "up" ? Math.PI / 2 : -Math.PI / 2);
}
