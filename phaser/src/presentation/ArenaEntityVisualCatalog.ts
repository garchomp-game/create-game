import type { EnemyTypeId } from "../domain/types";

export type ArenaEntityVisualId =
  | "player"
  | EnemyTypeId
  | "boss"
  | "xp";

export type ArenaEntityVisualSpec = {
  textureKey: string;
  path: string;
  widthScale: number;
  heightScale: number;
  textureNose: "up" | "down";
};

export const ARENA_ENTITY_VISUAL_CATALOG = {
  player: {
    textureKey: "arena-player-interceptor",
    path: "/assets/kenney/space-shooter/player-interceptor.png",
    widthScale: 2.65,
    heightScale: 2,
    textureNose: "up",
  },
  chaser: {
    textureKey: "arena-enemy-chaser",
    path: "/assets/kenney/space-shooter/enemy-chaser.png",
    widthScale: 2.45,
    heightScale: 2.2,
    textureNose: "down",
  },
  brute: {
    textureKey: "arena-enemy-brute",
    path: "/assets/kenney/space-shooter/enemy-brute.png",
    widthScale: 2.6,
    heightScale: 2.12,
    textureNose: "down",
  },
  fast: {
    textureKey: "arena-enemy-fast",
    path: "/assets/kenney/space-shooter/enemy-fast.png",
    widthScale: 2.5,
    heightScale: 2.16,
    textureNose: "down",
  },
  ranged: {
    textureKey: "arena-enemy-ranged",
    path: "/assets/kenney/space-shooter/enemy-ranged.png",
    widthScale: 2.18,
    heightScale: 2.24,
    textureNose: "down",
  },
  boss: {
    textureKey: "arena-boss-command-ship",
    path: "/assets/kenney/space-shooter/boss-command-ship.png",
    widthScale: 3.5,
    heightScale: 2.35,
    textureNose: "up",
  },
  xp: {
    textureKey: "arena-xp-shard",
    path: "/assets/kenney/space-shooter/xp-shard.png",
    widthScale: 1,
    heightScale: 1,
    textureNose: "up",
  },
} as const satisfies Record<ArenaEntityVisualId, ArenaEntityVisualSpec>;
