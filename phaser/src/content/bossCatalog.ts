import type { BossAttackId, EnemyTypeId } from "../domain/types";

export const FINAL_COMMAND_SHIP_BOSS_ID = "final-command-ship";

export type FinalCommandShipDefinition = {
  id: typeof FINAL_COMMAND_SHIP_BOSS_ID;
  baseEnemyTypeId: EnemyTypeId;
  radius: number;
  maximumHp: number;
  contactDamage: number;
  score: number;
  xpValue: number;
  spawnPosition: { x: number; y: number };
  movementSpeed: [number, number];
  phaseTwoHpRatio: number;
  phaseTransitionRecoverySeconds: number;
  attackOrder: BossAttackId[];
  targetedSalvo: {
    telegraphSeconds: [number, number];
    executeSeconds: [number, number];
    recoverySeconds: [number, number];
    projectileCount: [number, number];
    spreadRadians: [number, number];
    projectileRadius: number;
    projectileSpeed: [number, number];
    projectileLifetime: number;
    projectileDamage: [number, number];
  };
  escortPincer: {
    telegraphSeconds: [number, number];
    executeSeconds: [number, number];
    recoverySeconds: [number, number];
    escortCount: [number, number];
    escortTypeIds: EnemyTypeId[];
    minimumPlayerDistance: number;
    suppressiveSalvo: {
      projectileCount: [number, number];
      spreadRadians: [number, number];
      projectileRadius: number;
      projectileSpeed: [number, number];
      projectileLifetime: number;
      projectileDamage: [number, number];
    };
  };
  commandPulse: {
    telegraphSeconds: [number, number];
    executeSeconds: [number, number];
    recoverySeconds: [number, number];
    radius: [number, number];
    damage: [number, number];
  };
  sustain: {
    healDropMinimumIntervalSeconds: number;
  };
};

export const FINAL_COMMAND_SHIP_DEFINITION: FinalCommandShipDefinition = {
  id: FINAL_COMMAND_SHIP_BOSS_ID,
  baseEnemyTypeId: "brute",
  radius: 44,
  maximumHp: 3_400,
  contactDamage: 28,
  score: 2_500,
  xpValue: 160,
  spawnPosition: { x: 480, y: 92 },
  movementSpeed: [72, 96],
  phaseTwoHpRatio: 0.5,
  phaseTransitionRecoverySeconds: 1.1,
  attackOrder: ["targeted-salvo", "escort-pincer", "command-pulse"],
  targetedSalvo: {
    telegraphSeconds: [1.2, 0.85],
    executeSeconds: [0.25, 0.2],
    recoverySeconds: [0.8, 0.55],
    projectileCount: [13, 21],
    spreadRadians: [1.28, 1.72],
    projectileRadius: 6,
    projectileSpeed: [320, 390],
    projectileLifetime: 3.8,
    projectileDamage: [8, 10],
  },
  escortPincer: {
    telegraphSeconds: [1.35, 1],
    executeSeconds: [0.25, 0.2],
    recoverySeconds: [0.95, 0.65],
    escortCount: [5, 7],
    escortTypeIds: ["chaser", "fast"],
    minimumPlayerDistance: 180,
    suppressiveSalvo: {
      projectileCount: [9, 15],
      spreadRadians: [0.9, 1.4],
      projectileRadius: 5,
      projectileSpeed: [285, 340],
      projectileLifetime: 3.6,
      projectileDamage: [7, 9],
    },
  },
  commandPulse: {
    telegraphSeconds: [1.35, 1.05],
    executeSeconds: [0.22, 0.18],
    recoverySeconds: [0.9, 0.68],
    radius: [175, 220],
    damage: [22, 34],
  },
  sustain: {
    healDropMinimumIntervalSeconds: 1,
  },
};
