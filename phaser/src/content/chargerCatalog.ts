import type { EnemyTypeId } from "../domain/types";

export type TelegraphChargerDefinition = {
  id: "telegraph-charger";
  baseEnemyTypeId: EnemyTypeId;
  radiusMultiplier: number;
  hpMultiplier: number;
  damageMultiplier: number;
  approachSpeedMultiplier: number;
  scoreMultiplier: number;
  xpMultiplier: number;
  initialDelaySeconds: number;
  triggerRange: number;
  minimumClearChargeDistance: number;
  telegraphSeconds: number;
  prepareSeconds: number;
  chargeSeconds: number;
  chargeSpeed: number;
  recoverySeconds: number;
  cooldownSeconds: number;
  maximumConcurrentCharges: number;
};

export const TELEGRAPH_CHARGER_DEFINITION: TelegraphChargerDefinition = {
  id: "telegraph-charger",
  baseEnemyTypeId: "fast",
  radiusMultiplier: 1.12,
  hpMultiplier: 2.2,
  damageMultiplier: 1.35,
  approachSpeedMultiplier: 0.72,
  scoreMultiplier: 2.6,
  xpMultiplier: 2,
  initialDelaySeconds: 1.2,
  triggerRange: 300,
  minimumClearChargeDistance: 84,
  telegraphSeconds: 0.6,
  prepareSeconds: 0.3,
  chargeSeconds: 0.65,
  chargeSpeed: 430,
  recoverySeconds: 1.05,
  cooldownSeconds: 1.4,
  maximumConcurrentCharges: 2,
};
