import type { GameContentDefinitions } from "../domain/gameContent";
import { FIRST_COMMAND_SHIP_BOSS_ID } from "./bossCatalog";
import { ENDLESS_ENCOUNTER_DECK_ID } from "./endlessEncounterCards";
import { FIRST_EXPEDITION_ENCOUNTER_DECK_ID } from "./expeditionEncounterCards";

export const ARENA_DEFAULT_STAGE_DEFINITION = {
  id: "arena-default",
  titleKey: "stage.arena-default.title",
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
  clearCondition: { type: "endless" },
} satisfies GameContentDefinitions["stages"][number];

export const FIRST_EXPEDITION_STAGE_DEFINITION = {
  id: "first-expedition",
  titleKey: "stage.first-expedition.title",
  arena: { ...ARENA_DEFAULT_STAGE_DEFINITION.arena },
  obstacles: ARENA_DEFAULT_STAGE_DEFINITION.obstacles.map((obstacle) => ({
    ...obstacle,
  })),
  encounterDeckId: FIRST_EXPEDITION_ENCOUNTER_DECK_ID,
  enemyPoolId: "expedition-core",
  difficulty: {
    waves: [
      {
        start: 0,
        spawnInterval: 1.05,
        speedMultiplier: 1,
        maxEnemies: 18,
        spawnBudget: 1,
        enemyWeights: { chaser: 1 },
      },
      {
        start: 75,
        spawnInterval: 0.86,
        speedMultiplier: 1.04,
        maxEnemies: 24,
        spawnBudget: 2,
        enemyWeights: { chaser: 1, fast: 0.55 },
      },
      {
        start: 180,
        spawnInterval: 0.72,
        speedMultiplier: 1.08,
        maxEnemies: 30,
        spawnBudget: 3,
        enemyWeights: { chaser: 1, brute: 0.42, fast: 0.65 },
      },
      {
        start: 300,
        spawnInterval: 0.62,
        speedMultiplier: 1.14,
        maxEnemies: 36,
        spawnBudget: 3,
        enemyWeights: {
          chaser: 0.9,
          brute: 0.42,
          fast: 0.8,
          ranged: 0.38,
        },
      },
    ],
    threat: {
      pressureStartAt: 540,
      statStartAt: 540,
    },
    rewardScaling: {
      enemyXpMultiplier: 1.75,
      enemyScoreMultiplier: 1.5,
      healDropChanceMultiplier: 1.35,
    },
  },
  clearCondition: { type: "bossDefeat", bossId: FIRST_COMMAND_SHIP_BOSS_ID },
  bossId: FIRST_COMMAND_SHIP_BOSS_ID,
} satisfies GameContentDefinitions["stages"][number];

export const GAME_CONTENT_DEFINITIONS = {
  modes: [
    {
      id: "endless",
      titleKey: "mode.endless.title",
      runtimeKind: "endless",
      stageIds: ["arena-default"],
      defaultStageId: "arena-default",
    },
    {
      id: "expedition",
      titleKey: "mode.expedition.title",
      runtimeKind: "expedition",
      stageIds: ["first-expedition"],
      defaultStageId: "first-expedition",
    },
  ],
  stages: [ARENA_DEFAULT_STAGE_DEFINITION, FIRST_EXPEDITION_STAGE_DEFINITION],
  enemyPools: [
    {
      id: "endless-core",
      enemyTypeIds: ["chaser", "brute", "fast", "ranged"],
    },
    {
      id: "expedition-core",
      enemyTypeIds: ["chaser", "brute", "fast", "ranged"],
    },
  ],
  encounterDeckIds: [
    ENDLESS_ENCOUNTER_DECK_ID,
    FIRST_EXPEDITION_ENCOUNTER_DECK_ID,
  ],
  bossIds: [FIRST_COMMAND_SHIP_BOSS_ID],
} satisfies GameContentDefinitions;
