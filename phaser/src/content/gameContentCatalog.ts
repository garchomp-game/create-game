import type { GameContentDefinitions } from "../domain/gameContent";
import { FINAL_COMMAND_SHIP_BOSS_ID } from "./bossCatalog";
import { ENDLESS_ENCOUNTER_DECK_ID } from "./endlessEncounterCards";
import { FINAL_EXPEDITION_ENCOUNTER_DECK_ID } from "./expeditionEncounterCards";

const ENDLESS_NORMAL_XP_CURVE = {
  baseXp: 15,
  growth: 1.05,
  maxXp: 60,
};

export const ARENA_DEFAULT_STAGE_DEFINITION = {
  id: "arena-default",
  titleKey: "stage.arena-default.title",
  exProtocolOfferPolicy: "fixed-compatible",
  arena: {
    width: 960,
    height: 540,
    playerStart: { x: 480, y: 270 },
  },
  obstacles: [
    { id: "block-a", x: 220, y: 150, width: 120, height: 32 },
    { id: "block-b", x: 620, y: 150, width: 120, height: 32 },
    { id: "block-c", x: 220, y: 360, width: 120, height: 32 },
    { id: "block-d", x: 620, y: 360, width: 120, height: 32 },
  ],
  encounterDeckId: ENDLESS_ENCOUNTER_DECK_ID,
  enemyPoolId: "endless-core",
  difficulty: {
    waves: [
      {
        start: 0,
        spawnInterval: 1,
        speedMultiplier: 1,
        maxEnemies: 30,
        spawnBudget: 1,
        enemyWeights: { chaser: 1 },
      },
      {
        start: 30,
        spawnInterval: 0.75,
        speedMultiplier: 1.02,
        maxEnemies: 32,
        spawnBudget: 1,
        enemyWeights: { chaser: 1 },
      },
      {
        start: 45,
        spawnInterval: 1.3,
        speedMultiplier: 1.04,
        maxEnemies: 36,
        spawnBudget: 3,
        enemyWeights: { chaser: 1, brute: 0.5 },
      },
      {
        start: 60,
        spawnInterval: 0.95,
        speedMultiplier: 1.1,
        maxEnemies: 42,
        spawnBudget: 3,
        enemyWeights: { chaser: 1, brute: 0.55, fast: 0.75 },
      },
      {
        start: 75,
        spawnInterval: 0.78,
        speedMultiplier: 1.18,
        maxEnemies: 50,
        spawnBudget: 3,
        enemyWeights: {
          chaser: 0.9,
          brute: 0.6,
          fast: 1,
          ranged: 0.35,
        },
      },
      {
        start: 90,
        spawnInterval: 0.55,
        speedMultiplier: 1.35,
        maxEnemies: 60,
        spawnBudget: 3,
        enemyWeights: {
          chaser: 0.75,
          brute: 0.75,
          fast: 1.1,
          ranged: 0.7,
        },
      },
    ],
    enemyDamageMultipliers: {
      chaser: 0.75,
      brute: 0.7,
      fast: 0.375,
      ranged: 0.25,
    },
    threat: {
      pressureStartAt: 90,
      statStartAt: 240,
      statStepSeconds: 45,
      enemyHpGrowth: 1.12,
      enemyHpGrowthByType: {
        chaser: 1.12,
        brute: 1.17,
        fast: 1.1,
        ranged: 1.15,
      },
      enemyDamageGrowth: 1.1,
      enemyScoreGrowth: 1.08,
      rangedProjectileSpeedGrowth: 1.04,
      rangedAttackSpeedGrowth: 1.05,
      healDropDecay: 0.96,
    },
    encounterTiming: {
      minStart: 180,
      maxStart: 210,
      minInterval: 48,
      maxInterval: 68,
    },
    rewardScaling: {
      enemyXpMultiplier: 1,
      enemyScoreMultiplier: 1,
      healDropChanceMultiplier: 1,
    },
  },
  progression: {
    normalXpCurve: { ...ENDLESS_NORMAL_XP_CURVE },
    normalUpgradeCadence: {
      firstUpgradeNotBeforeSeconds: 0,
      minimumUpgradeIntervalSeconds: 0,
    },
  },
  clearCondition: { type: "endless" },
} satisfies GameContentDefinitions["stages"][number];

export const FINAL_EXPEDITION_STAGE_DEFINITION = {
  id: "final-expedition",
  titleKey: "stage.final-expedition.title",
  exProtocolOfferPolicy: "fixed-compatible",
  campaign: { order: 10, role: "final" },
  arena: { ...ARENA_DEFAULT_STAGE_DEFINITION.arena },
  obstacles: ARENA_DEFAULT_STAGE_DEFINITION.obstacles.map((obstacle) => ({
    ...obstacle,
  })),
  encounterDeckId: FINAL_EXPEDITION_ENCOUNTER_DECK_ID,
  enemyPoolId: "expedition-core",
  difficulty: {
    waves: [
      {
        start: 0,
        spawnInterval: 0.9,
        speedMultiplier: 1,
        maxEnemies: 24,
        spawnBudget: 2,
        enemyWeights: { chaser: 1 },
      },
      {
        start: 75,
        spawnInterval: 0.72,
        speedMultiplier: 1.05,
        maxEnemies: 32,
        spawnBudget: 3,
        enemyWeights: { chaser: 1, brute: 0.55 },
      },
      {
        start: 180,
        spawnInterval: 0.58,
        speedMultiplier: 1.12,
        maxEnemies: 40,
        spawnBudget: 4,
        enemyWeights: { chaser: 0.9, brute: 0.6, fast: 0.75 },
      },
      {
        start: 300,
        spawnInterval: 0.46,
        speedMultiplier: 1.2,
        maxEnemies: 50,
        spawnBudget: 4,
        enemyWeights: {
          chaser: 0.85,
          brute: 0.65,
          fast: 0.95,
          ranged: 0.55,
        },
      },
      {
        start: 390,
        spawnInterval: 0.32,
        speedMultiplier: 1.3,
        maxEnemies: 64,
        spawnBudget: 6,
        enemyWeights: {
          chaser: 0.75,
          brute: 0.8,
          fast: 1.15,
          ranged: 0.9,
        },
      },
    ],
    enemyHpMultipliers: { brute: 2.5 },
    threat: {
      pressureStartAt: 390,
      statStartAt: 450,
    },
    rewardScaling: {
      enemyXpMultiplier: 1.75,
      enemyScoreMultiplier: 1.5,
      healDropChanceMultiplier: 1.35,
    },
  },
  progression: {
    normalXpCurve: {
      ...ENDLESS_NORMAL_XP_CURVE,
      baseXp: 20,
    },
    extraXpCurve: {
      baseXp: 180,
      growth: 1.12,
      maxXp: 900,
    },
  },
  completionScoring: {
    clearBonus: 15_000,
    timeMedalSeconds: {
      gold: 540,
      silver: 600,
      bronze: 720,
    },
  },
  clearCondition: { type: "bossDefeat", bossId: FINAL_COMMAND_SHIP_BOSS_ID },
  bossId: FINAL_COMMAND_SHIP_BOSS_ID,
} satisfies GameContentDefinitions["stages"][number];

export const BASIC_TRAINING_STAGE_DEFINITION = {
  id: "basic-training",
  titleKey: "stage.basic-training.title",
  exProtocolOfferPolicy: "disabled",
  arena: { ...ARENA_DEFAULT_STAGE_DEFINITION.arena },
  obstacles: ARENA_DEFAULT_STAGE_DEFINITION.obstacles.map((obstacle) => ({
    ...obstacle,
  })),
  encounterDeckId: ENDLESS_ENCOUNTER_DECK_ID,
  enemyPoolId: "endless-core",
  difficulty: {
    waves: [
      {
        start: 0,
        spawnInterval: 60,
        speedMultiplier: 1,
        maxEnemies: 0,
        spawnBudget: 1,
        enemyWeights: { chaser: 1 },
      },
    ],
    threat: {
      pressureStartAt: Number.MAX_SAFE_INTEGER,
      statStartAt: Number.MAX_SAFE_INTEGER,
    },
    rewardScaling: {
      enemyXpMultiplier: 1,
      enemyScoreMultiplier: 1,
      healDropChanceMultiplier: 1,
    },
  },
  clearCondition: { type: "training" },
} satisfies GameContentDefinitions["stages"][number];

export const STORY_INTRO_STAGE_DEFINITION = {
  ...BASIC_TRAINING_STAGE_DEFINITION,
  id: "story-intro",
  titleKey: "stage.story-intro.title",
  campaign: { order: 1, role: "standard" },
} satisfies GameContentDefinitions["stages"][number];

export const PRACTICE_ARENA_STAGE_DEFINITION = {
  id: "practice-arena",
  titleKey: "stage.practice-arena.title",
  exProtocolOfferPolicy: "disabled",
  arena: { ...ARENA_DEFAULT_STAGE_DEFINITION.arena },
  obstacles: ARENA_DEFAULT_STAGE_DEFINITION.obstacles.map((obstacle) => ({
    ...obstacle,
  })),
  encounterDeckId: ENDLESS_ENCOUNTER_DECK_ID,
  enemyPoolId: "practice-core",
  difficulty: {
    waves: [
      {
        start: 0,
        spawnInterval: 1.4,
        speedMultiplier: 0.75,
        maxEnemies: 6,
        spawnBudget: 1,
        enemyWeights: { chaser: 1, brute: 0.65 },
      },
    ],
    enemyHpMultipliers: {
      chaser: 0.8,
      brute: 0.8,
      fast: 0.8,
      ranged: 0.8,
    },
    threat: {
      pressureStartAt: Number.MAX_SAFE_INTEGER,
      statStartAt: Number.MAX_SAFE_INTEGER,
    },
    rewardScaling: {
      enemyXpMultiplier: 1,
      enemyScoreMultiplier: 1,
      healDropChanceMultiplier: 1,
    },
  },
  clearCondition: { type: "endless" },
} satisfies GameContentDefinitions["stages"][number];

export const DEBUG_EX_PROTOCOL_STAGE_DEFINITION = {
  ...ARENA_DEFAULT_STAGE_DEFINITION,
  id: "debug-ex-protocol",
  titleKey: "stage.debug-ex-protocol.title",
  obstacles: ARENA_DEFAULT_STAGE_DEFINITION.obstacles.map((obstacle) => ({
    ...obstacle,
  })),
  progression: {
    extraXpCurve: {
      baseXp: 1,
      growth: 1,
      maxXp: 1,
    },
  },
} satisfies GameContentDefinitions["stages"][number];

export const GAME_CONTENT_DEFINITIONS = {
  modes: [
    {
      id: "endless",
      titleKey: "mode.endless.title",
      runtimeKind: "endless",
      recordPolicy: "standard",
      stageIds: ["arena-default"],
      defaultStageId: "arena-default",
    },
    {
      id: "expedition",
      titleKey: "mode.expedition.title",
      runtimeKind: "expedition",
      recordPolicy: "standard",
      stageIds: ["final-expedition"],
      defaultStageId: "final-expedition",
    },
    {
      id: "training",
      titleKey: "mode.training.title",
      runtimeKind: "training",
      recordPolicy: "none",
      stageIds: ["basic-training"],
      defaultStageId: "basic-training",
    },
    {
      id: "story",
      titleKey: "mode.story.title",
      runtimeKind: "story",
      recordPolicy: "none",
      stageIds: ["story-intro"],
      defaultStageId: "story-intro",
    },
    {
      id: "practice",
      titleKey: "mode.practice.title",
      runtimeKind: "practice",
      recordPolicy: "none",
      stageIds: ["practice-arena"],
      defaultStageId: "practice-arena",
    },
    {
      id: "debug-ex",
      titleKey: "mode.debug-ex.title",
      runtimeKind: "endless",
      recordPolicy: "none",
      stageIds: ["debug-ex-protocol"],
      defaultStageId: "debug-ex-protocol",
    },
  ],
  stages: [
    ARENA_DEFAULT_STAGE_DEFINITION,
    FINAL_EXPEDITION_STAGE_DEFINITION,
    BASIC_TRAINING_STAGE_DEFINITION,
    STORY_INTRO_STAGE_DEFINITION,
    PRACTICE_ARENA_STAGE_DEFINITION,
    DEBUG_EX_PROTOCOL_STAGE_DEFINITION,
  ],
  enemyPools: [
    {
      id: "endless-core",
      enemyTypeIds: ["chaser", "brute", "fast", "ranged"],
    },
    {
      id: "expedition-core",
      enemyTypeIds: ["chaser", "brute", "fast", "ranged"],
    },
    {
      id: "practice-core",
      enemyTypeIds: ["chaser", "brute", "fast", "ranged"],
    },
  ],
  encounterDeckIds: [
    ENDLESS_ENCOUNTER_DECK_ID,
    FINAL_EXPEDITION_ENCOUNTER_DECK_ID,
  ],
  bossIds: [FINAL_COMMAND_SHIP_BOSS_ID],
} satisfies GameContentDefinitions;
