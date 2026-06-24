import { UPGRADE_IDS } from "../domain/types";
import type { SimulationConfig, WorldState } from "../domain/types";

export function createWorld(config: SimulationConfig): WorldState {
  const upgradeRanks = Object.fromEntries(
    UPGRADE_IDS.map((id) => [id, 0]),
  ) as WorldState["progression"]["upgradeRanks"];

  return {
    state: {
      status: "playing",
      elapsed: 0,
      score: 0,
      hp: config.player.maxHp,
      spawnTimer: 0.25,
      shotTimer: 0,
      damageCooldown: 0,
      lastAim: { x: 1, y: 0 },
      weaponType: config.defaultWeapon,
    },
    progression: {
      level: 1,
      xp: 0,
      xpToNext: config.leveling.baseXp,
      pendingUpgradeChoices: [],
      upgradeRanks,
    },
    runtime: {
      playerSpeedMultiplier: 1,
      fireIntervalMultiplier: 1,
      projectileSpeedMultiplier: 1,
      maxHpBonus: 0,
      projectileCountBonus: 0,
      pierceBonus: 0,
    },
    stats: {
      shotsFired: 0,
      enemiesKilled: 0,
      hitsTaken: 0,
      damageTaken: 0,
      damageTakenBySource: { contact: 0, projectile: 0 },
      lastDamageSource: null,
      xpCollected: 0,
      pickupsCollected: 0,
      upgradesChosen: 0,
      weaponMetrics: {
        pulse: { shotsFired: 0, projectilesFired: 0, hits: 0, kills: 0 },
        spread: { shotsFired: 0, projectilesFired: 0, hits: 0, kills: 0 },
        pierce: { shotsFired: 0, projectilesFired: 0, hits: 0, kills: 0 },
      },
    },
    player: {
      id: "player",
      position: { x: config.player.x, y: config.player.y },
      radius: config.player.radius,
    },
    bullets: [],
    enemies: [],
    enemyProjectiles: [],
    pickups: [],
    obstacles: config.obstacles.map((obstacle) => ({ ...obstacle })),
    nextBulletId: 1,
    nextEnemyId: 1,
    nextEnemyProjectileId: 1,
    nextPickupId: 1,
  };
}
