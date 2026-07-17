import type { GameContentDefinitions } from "../domain/gameContent";
import { ENDLESS_ENCOUNTER_DECK_ID } from "./endlessEncounterCards";

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

export const GAME_CONTENT_DEFINITIONS = {
  modes: [
    {
      id: "endless",
      titleKey: "mode.endless.title",
      stageIds: ["arena-default"],
      defaultStageId: "arena-default",
    },
  ],
  stages: [ARENA_DEFAULT_STAGE_DEFINITION],
  enemyPools: [
    {
      id: "endless-core",
      enemyTypeIds: ["chaser", "brute", "fast", "ranged"],
    },
  ],
  encounterDeckIds: [ENDLESS_ENCOUNTER_DECK_ID],
  bossIds: [],
} satisfies GameContentDefinitions;
