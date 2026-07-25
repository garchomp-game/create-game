import type {
  EnemyTypeId,
  Obstacle,
  ThreatSimulationConfig,
  Vec2,
  WaveBand,
} from "./types";

export type ModeDefinition = {
  id: string;
  titleKey: string;
  runtimeKind: "endless" | "expedition" | "training" | "story" | "practice";
  recordPolicy: "standard" | "none";
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
  | { type: "training" }
  | { type: "survive"; durationSeconds: number }
  | { type: "bossDefeat"; bossId: string };

export type StageDifficultyDefinition = {
  waves: WaveBand[];
  enemyHpMultipliers?: Partial<Record<EnemyTypeId, number>>;
  enemyDamageMultipliers?: Partial<Record<EnemyTypeId, number>>;
  threat: Pick<
    ThreatSimulationConfig,
    "pressureStartAt" | "statStartAt"
  > &
    Partial<
      Pick<
        ThreatSimulationConfig,
        | "statStepSeconds"
        | "enemyHpGrowth"
        | "enemyHpGrowthByType"
        | "enemyDamageGrowth"
        | "enemyScoreGrowth"
        | "rangedProjectileSpeedGrowth"
        | "rangedAttackSpeedGrowth"
        | "healDropDecay"
      >
    >;
  encounterTiming?: {
    minStart: number;
    maxStart: number;
    minInterval: number;
    maxInterval: number;
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
  normalXpCurve?: {
    baseXp: number;
    growth: number;
    maxXp: number;
  };
  normalUpgradeCadence?: {
    firstUpgradeNotBeforeSeconds: number;
    minimumUpgradeIntervalSeconds: number;
  };
  extraXpCurve?: {
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
  exProtocolOfferPolicy: "fixed-compatible" | "disabled";
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
