import { describe, expect, it } from "vitest";
import {
  ARENA_DEFAULT_STAGE_DEFINITION,
  GAME_CONTENT_DEFINITIONS,
} from "../content/gameContentCatalog";
import { SIMULATION_CONFIG } from "../config/gameConfig";
import type { GameContentDefinitions } from "../domain/gameContent";
import { GameContentRegistry } from "./GameContentRegistry";

describe("GameContentRegistry", () => {
  it("resolves the default Endless stage and sources the existing arena config", () => {
    const registry = new GameContentRegistry(GAME_CONTENT_DEFINITIONS);

    expect(registry.resolveRun("endless", "arena-default")).toMatchObject({
      mode: { id: "endless", defaultStageId: "arena-default" },
      stage: {
        id: "arena-default",
        encounterDeckId: "endless-v1",
        enemyPoolId: "endless-core",
        clearCondition: { type: "endless" },
      },
      enemyPool: {
        enemyTypeIds: ["chaser", "brute", "fast", "ranged"],
      },
    });
    expect(SIMULATION_CONFIG.arena).toEqual({
      width: ARENA_DEFAULT_STAGE_DEFINITION.arena.width,
      height: ARENA_DEFAULT_STAGE_DEFINITION.arena.height,
    });
    expect(SIMULATION_CONFIG.obstacles).toEqual(
      ARENA_DEFAULT_STAGE_DEFINITION.obstacles,
    );
  });

  it("resolves the first Expedition as a separate data-driven run", () => {
    const registry = new GameContentRegistry(GAME_CONTENT_DEFINITIONS);

    expect(registry.resolveRun("expedition", "first-expedition")).toMatchObject({
      mode: {
        id: "expedition",
        runtimeKind: "expedition",
        defaultStageId: "first-expedition",
      },
      stage: {
        id: "first-expedition",
        encounterDeckId: "first-expedition-v1",
        enemyPoolId: "expedition-core",
        bossId: "first-command-ship",
        difficulty: {
          waves: [
            expect.objectContaining({
              start: 0,
              enemyWeights: { chaser: 1 },
            }),
            expect.anything(),
            expect.anything(),
            expect.objectContaining({
              start: 300,
              enemyWeights: expect.objectContaining({ ranged: 0.38 }),
            }),
          ],
          threat: { pressureStartAt: 540, statStartAt: 540 },
          rewardScaling: {
            enemyXpMultiplier: 1.75,
            enemyScoreMultiplier: 1.5,
            healDropChanceMultiplier: 1.35,
          },
        },
        clearCondition: { type: "bossDefeat", bossId: "first-command-ship" },
      },
    });
  });

  it("rejects unknown mode, stage, and mode-stage combinations", () => {
    const registry = new GameContentRegistry(GAME_CONTENT_DEFINITIONS);
    expect(() => registry.resolveRun("missing", "arena-default")).toThrow(
      'Unknown mode ID "missing".',
    );
    expect(() => registry.resolveRun("endless", "missing")).toThrow(
      'Stage "missing" is not available for mode "endless".',
    );
  });

  it("rejects empty enemy pools and unknown content references", () => {
    const emptyPool = cloneDefinitions();
    emptyPool.enemyPools[0]!.enemyTypeIds = [];
    expect(() => new GameContentRegistry(emptyPool)).toThrow();

    const unknownDeck = cloneDefinitions();
    unknownDeck.stages[0]!.encounterDeckId = "missing-deck";
    expect(() => new GameContentRegistry(unknownDeck)).toThrow(
      'references unknown encounter deck "missing-deck"',
    );
  });

  it("rejects contradictory clear conditions and invalid arena geometry", () => {
    const contradictory = cloneDefinitions();
    contradictory.bossIds = ["boss-alpha", "boss-beta"];
    contradictory.stages[0]!.bossId = "boss-alpha";
    contradictory.stages[0]!.clearCondition = {
      type: "bossDefeat",
      bossId: "boss-beta",
    };
    expect(() => new GameContentRegistry(contradictory)).toThrow(
      "boss clear condition must match bossId",
    );

    const outsideArena = cloneDefinitions();
    outsideArena.stages[0]!.obstacles[0]!.x = 900;
    expect(() => new GameContentRegistry(outsideArena)).toThrow(
      'obstacle "block-a" is outside the arena',
    );
  });

  it("rejects invalid stage difficulty wave ordering", () => {
    const invalidDifficulty = cloneDefinitions();
    invalidDifficulty.stages[1]!.difficulty!.waves[1]!.start = 0;
    expect(() => new GameContentRegistry(invalidDifficulty)).toThrow(
      "stage wave starts must be strictly ascending",
    );
  });
});

function cloneDefinitions(): GameContentDefinitions {
  return structuredClone(GAME_CONTENT_DEFINITIONS);
}
