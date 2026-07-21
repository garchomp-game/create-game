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

  it("resolves the final Expedition as campaign stage ten", () => {
    const registry = new GameContentRegistry(GAME_CONTENT_DEFINITIONS);

    expect(registry.resolveRun("expedition", "final-expedition")).toMatchObject({
      mode: {
        id: "expedition",
        runtimeKind: "expedition",
        defaultStageId: "final-expedition",
      },
      stage: {
        id: "final-expedition",
        campaign: { order: 10, role: "final" },
        encounterDeckId: "final-expedition-v1",
        enemyPoolId: "expedition-core",
        bossId: "final-command-ship",
        difficulty: {
          waves: [
            expect.objectContaining({
              start: 0,
              enemyWeights: { chaser: 1 },
            }),
            expect.anything(),
            expect.anything(),
            expect.anything(),
            expect.objectContaining({
              start: 390,
              enemyWeights: expect.objectContaining({ ranged: 0.9 }),
            }),
          ],
          enemyHpMultipliers: { brute: 2.5 },
          threat: { pressureStartAt: 390, statStartAt: 450 },
          rewardScaling: {
            enemyXpMultiplier: 1.75,
            enemyScoreMultiplier: 1.5,
            healDropChanceMultiplier: 1.35,
          },
        },
        progression: {
          extraXpCurve: { baseXp: 180, growth: 1.12, maxXp: 900 },
        },
        clearCondition: { type: "bossDefeat", bossId: "final-command-ship" },
      },
    });
  });

  it("resolves basic training as a non-recording runtime", () => {
    const registry = new GameContentRegistry(GAME_CONTENT_DEFINITIONS);

    expect(registry.resolveRun("training", "basic-training")).toMatchObject({
      mode: {
        id: "training",
        runtimeKind: "training",
        recordPolicy: "none",
      },
      stage: {
        id: "basic-training",
        clearCondition: { type: "training" },
        difficulty: { waves: [{ maxEnemies: 0 }] },
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

  it("rejects zero-enemy waves in recorded Standard stages", () => {
    const zeroEnemyStandard = cloneDefinitions();
    zeroEnemyStandard.stages[1]!.difficulty!.waves[0]!.maxEnemies = 0;

    expect(() => new GameContentRegistry(zeroEnemyStandard)).toThrow(
      'Standard stage "final-expedition" must not declare a zero-enemy wave.',
    );

    expect(
      new GameContentRegistry(GAME_CONTENT_DEFINITIONS).resolveRun(
        "training",
        "basic-training",
      ).stage.difficulty?.waves[0]?.maxEnemies,
    ).toBe(0);
  });

  it("rejects an extra XP cap below its stage base requirement", () => {
    const invalidProgression = cloneDefinitions();
    invalidProgression.stages[0]!.progression = {
      extraXpCurve: { baseXp: 180, growth: 1.04, maxXp: 179 },
    };

    expect(() => new GameContentRegistry(invalidProgression)).toThrow(
      "extra XP max must be greater than or equal to base XP",
    );
  });
});

function cloneDefinitions(): GameContentDefinitions {
  return structuredClone(GAME_CONTENT_DEFINITIONS);
}
