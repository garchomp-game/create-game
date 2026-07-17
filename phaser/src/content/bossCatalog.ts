import type { BossAttackId, EnemyTypeId } from "../domain/types";

export const FIRST_COMMAND_SHIP_BOSS_ID = "first-command-ship";

export type FirstCommandShipDefinition = {
  id: typeof FIRST_COMMAND_SHIP_BOSS_ID;
  baseEnemyTypeId: EnemyTypeId;
  radius: number;
  maximumHp: number;
  contactDamage: number;
  score: number;
  xpValue: number;
  spawnPosition: { x: number; y: number };
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
};

export const FIRST_COMMAND_SHIP_DEFINITION: FirstCommandShipDefinition = {
  id: FIRST_COMMAND_SHIP_BOSS_ID,
  baseEnemyTypeId: "brute",
  radius: 44,
  maximumHp: 3_600,
  contactDamage: 28,
  score: 2_500,
  xpValue: 160,
  spawnPosition: { x: 480, y: 92 },
  phaseTwoHpRatio: 0.5,
  phaseTransitionRecoverySeconds: 1.1,
  attackOrder: ["targeted-salvo", "escort-pincer"],
  targetedSalvo: {
    telegraphSeconds: [1.35, 1],
    executeSeconds: [0.25, 0.2],
    recoverySeconds: [1.2, 0.85],
    projectileCount: [5, 9],
    spreadRadians: [0.56, 0.88],
    projectileRadius: 6,
    projectileSpeed: [300, 350],
    projectileLifetime: 3.6,
    projectileDamage: [9, 11],
  },
  escortPincer: {
    telegraphSeconds: [1.55, 1.15],
    executeSeconds: [0.25, 0.2],
    recoverySeconds: [1.35, 1],
    escortCount: [3, 5],
    escortTypeIds: ["chaser", "fast"],
    minimumPlayerDistance: 180,
    suppressiveSalvo: {
      projectileCount: [3, 6],
      spreadRadians: [0.34, 0.7],
      projectileRadius: 5,
      projectileSpeed: [250, 305],
      projectileLifetime: 3.6,
      projectileDamage: [7, 9],
    },
  },
};
