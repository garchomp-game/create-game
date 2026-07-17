import type { EnemyTypeId } from "../domain/types";

export type CommanderEliteDefinition = {
  id: "commander";
  baseEnemyTypeId: EnemyTypeId;
  trait: "reinforcement";
  radiusMultiplier: number;
  maximumHp: number;
  damageMultiplier: number;
  speedMultiplier: number;
  scoreMultiplier: number;
  xpMultiplier: number;
  initialTraitDelaySeconds: number;
  traitIntervalSeconds: number;
  telegraphSeconds: number;
  retryDelaySeconds: number;
  reinforcementCount: number;
  maximumActiveReinforcements: number;
  reinforcementTypeId: EnemyTypeId;
  reinforcementSpeedMultiplier: number;
  minimumPlayerDistance: number;
};

export const COMMANDER_ELITE_DEFINITION: CommanderEliteDefinition = {
  id: "commander",
  baseEnemyTypeId: "ranged",
  trait: "reinforcement",
  radiusMultiplier: 1.42,
  maximumHp: 500,
  damageMultiplier: 1.15,
  speedMultiplier: 0.78,
  scoreMultiplier: 26,
  xpMultiplier: 25,
  initialTraitDelaySeconds: 3.5,
  traitIntervalSeconds: 7,
  telegraphSeconds: 1.2,
  retryDelaySeconds: 2,
  reinforcementCount: 3,
  maximumActiveReinforcements: 9,
  reinforcementTypeId: "chaser",
  reinforcementSpeedMultiplier: 1.12,
  minimumPlayerDistance: 180,
};
