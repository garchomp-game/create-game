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
    telegraphSeconds: [1.45, 1.15],
    executeSeconds: [0.3, 0.25],
    recoverySeconds: [1.75, 1.35],
    projectileCount: [5, 7],
    spreadRadians: [0.56, 0.72],
    projectileRadius: 6,
    projectileSpeed: [285, 330],
    projectileLifetime: 3.6,
    projectileDamage: [10, 12],
  },
  escortPincer: {
    telegraphSeconds: [1.7, 1.35],
    executeSeconds: [0.3, 0.25],
    recoverySeconds: [2.1, 1.65],
    escortCount: [4, 6],
    escortTypeIds: ["chaser", "fast"],
    minimumPlayerDistance: 180,
  },
};
