import { UPGRADE_IDS } from "../domain/types";
import type {
  SimulationConfig,
  WeaponComparisonRunStats,
  WeaponRunStats,
  WorldState,
} from "../domain/types";

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
      buildCompletedAt: null,
      pendingUpgradeChoices: [],
      upgradeRanks,
    },
    runtime: {
      playerSpeedMultiplier: 1,
      fireIntervalMultiplier: 1,
      projectileSpeedMultiplier: 1,
      maxHpBonus: 0,
      projectileCountBonus: 0,
      hitCapacityBonus: 0,
      ricochetBonus: 0,
      healDropMissCount: 0,
      healDropRollIndex: 0,
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
      hpRecovered: 0,
      healPickupsCollected: 0,
      effectiveHealPickupsCollected: 0,
      upgradesChosen: 0,
      movementDistance: 0,
      progressionMetrics: {
        firstOfferAt: null,
        firstSelectionAt: null,
        lastSelectionAt: null,
        buildCompletedAt: null,
        longestMeaningfulChoiceGap: 0,
        offers: [],
        selections: [],
      },
      capstoneMetrics: {
        upgradeId: "pulseRicochet",
        acquiredAt: null,
        activations: 0,
        followUpHits: 0,
        followUpUniqueEnemiesHit: 0,
        maxFollowUpUniqueEnemiesPerVolley: 0,
      },
      encounterMetrics: {
        scheduledAt: null,
        warningStartedAt: null,
        activeStartedAt: null,
        recoveryStartedAt: null,
        completedAt: null,
        rangedEnemiesSpawned: 0,
        damageTakenDuringActive: 0,
        killsDuringActiveByEnemyType: { chaser: 0, brute: 0, fast: 0, ranged: 0 },
        movement: {
          baseline: { distance: 0, vector: { x: 0, y: 0 } },
          warning: { distance: 0, vector: { x: 0, y: 0 } },
          active: { distance: 0, vector: { x: 0, y: 0 } },
          recovery: { distance: 0, vector: { x: 0, y: 0 } },
        },
        contractOfferedAt: null,
        contractSelectedAt: null,
        contractChoice: null,
      },
      weaponMetrics: {
        pulse: createWeaponRunStats(),
        spread: createWeaponRunStats(),
        pierce: createWeaponRunStats(),
      },
      weaponComparisonMetrics: {
        pulse: createWeaponComparisonRunStats(),
        spread: createWeaponComparisonRunStats(),
        pierce: createWeaponComparisonRunStats(),
      },
    },
    analytics: {
      activeVolleys: {},
    },
    encounter: {
      rangedSurge: {
        phase: "pending",
        scheduledAt: null,
        warningStartedAt: null,
        activeStartedAt: null,
        recoveryStartedAt: null,
        completedAt: null,
      },
      contract: {
        status: "pending",
        choice: null,
        offeredAt: null,
        selectedAt: null,
        enemySpeedMultiplier: 1,
        scoreMultiplier: 1,
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
    nextVolleyId: 1,
    nextEnemyId: 1,
    nextEnemyProjectileId: 1,
    nextPickupId: 1,
  };
}

function createWeaponRunStats(): WeaponRunStats {
  return {
    shotsFired: 0,
    projectilesFired: 0,
    hits: 0,
    kills: 0,
  };
}

function createWeaponComparisonRunStats(): WeaponComparisonRunStats {
  return {
    hitVolleys: 0,
    uniqueEnemiesHit: 0,
    maxUniqueEnemiesHitPerVolley: 0,
    hitsByEnemyType: { chaser: 0, brute: 0, fast: 0, ranged: 0 },
    killsByEnemyType: { chaser: 0, brute: 0, fast: 0, ranged: 0 },
  };
}
