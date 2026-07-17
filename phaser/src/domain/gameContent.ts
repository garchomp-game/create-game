import type { EnemyTypeId, Obstacle, Vec2 } from "./types";

export type ModeDefinition = {
  id: string;
  titleKey: string;
  runtimeKind: "endless" | "expedition";
  stageIds: string[];
  defaultStageId: string;
};

export type ArenaDefinition = {
  width: number;
  height: number;
  playerStart: Vec2;
};

export type ObstacleDefinition = Obstacle;

export type ClearConditionDefinition =
  | { type: "endless" }
  | { type: "survive"; durationSeconds: number }
  | { type: "bossDefeat"; bossId: string };

export type StageDefinition = {
  id: string;
  titleKey: string;
  arena: ArenaDefinition;
  obstacles: ObstacleDefinition[];
  encounterDeckId: string;
  enemyPoolId: string;
  clearCondition: ClearConditionDefinition;
  bossId?: string;
};

export type EnemyPoolDefinition = {
  id: string;
  enemyTypeIds: EnemyTypeId[];
};

export type GameContentDefinitions = {
  modes: ModeDefinition[];
  stages: StageDefinition[];
  enemyPools: EnemyPoolDefinition[];
  encounterDeckIds: string[];
  bossIds: string[];
};

export type ResolvedRunContent = {
  mode: ModeDefinition;
  stage: StageDefinition;
  enemyPool: EnemyPoolDefinition;
};
