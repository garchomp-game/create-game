import type { GameContentDefinitions } from "../domain/gameContent";
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
  clearCondition: { type: "survive", durationSeconds: 420 },
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
  bossIds: [],
} satisfies GameContentDefinitions;
