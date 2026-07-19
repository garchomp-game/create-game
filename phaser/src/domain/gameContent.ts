import type { EnemyTypeId, Obstacle, Vec2, WaveBand } from "./types";

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

export type StageDifficultyDefinition = {
  waves: WaveBand[];
  enemyHpMultipliers?: Partial<Record<EnemyTypeId, number>>;
  threat: {
    pressureStartAt: number;
    statStartAt: number;
  };
  rewardScaling: {
    enemyXpMultiplier: number;
    enemyScoreMultiplier: number;
    healDropChanceMultiplier: number;
  };
};

export type StageCampaignDefinition = {
  order: number;
  role: "standard" | "final";
};

export type StageProgressionDefinition = {
  extraXpCurve: {
    baseXp: number;
    growth: number;
    maxXp: number;
  };
};

export type StageCompletionScoringDefinition = {
  clearBonus: number;
  timeMedalSeconds: {
    gold: number;
    silver: number;
    bronze: number;
  };
};

export type StageDefinition = {
  id: string;
  titleKey: string;
  campaign?: StageCampaignDefinition;
  arena: ArenaDefinition;
  obstacles: ObstacleDefinition[];
  encounterDeckId: string;
  enemyPoolId: string;
  difficulty?: StageDifficultyDefinition;
  progression?: StageProgressionDefinition;
  completionScoring?: StageCompletionScoringDefinition;
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
