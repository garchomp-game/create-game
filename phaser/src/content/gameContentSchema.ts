import { z } from "zod";
import { ENEMY_TYPE_IDS } from "../domain/types";
import type { GameContentDefinitions } from "../domain/gameContent";

const contentId = z
  .string()
  .min(1)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "must be a stable kebab-case ID");
const positiveNumber = z.number().finite().positive();
const coordinate = z.number().finite().nonnegative();

const modeDefinitionSchema = z
  .object({
    id: contentId,
    titleKey: z.string().min(1),
    runtimeKind: z.enum(["endless", "expedition"]),
    stageIds: z.array(contentId).min(1),
    defaultStageId: contentId,
  })
  .strict();

const arenaDefinitionSchema = z
  .object({
    width: positiveNumber,
    height: positiveNumber,
    playerStart: z
      .object({ x: coordinate, y: coordinate })
      .strict(),
  })
  .strict();

const obstacleDefinitionSchema = z
  .object({
    id: contentId,
    x: coordinate,
    y: coordinate,
    width: positiveNumber,
    height: positiveNumber,
  })
  .strict();

const clearConditionSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("endless") }).strict(),
  z
    .object({
      type: z.literal("survive"),
      durationSeconds: positiveNumber,
    })
    .strict(),
  z
    .object({
      type: z.literal("bossDefeat"),
      bossId: contentId,
    })
    .strict(),
]);

const stageWaveSchema = z
  .object({
    start: coordinate,
    spawnInterval: positiveNumber,
    speedMultiplier: positiveNumber,
    maxEnemies: z.number().int().positive(),
    spawnBudget: positiveNumber,
    enemyWeights: z.partialRecord(z.enum(ENEMY_TYPE_IDS), positiveNumber),
  })
  .strict()
  .superRefine((value, context) => {
    if (Object.keys(value.enemyWeights).length === 0) {
      context.addIssue({
        code: "custom",
        message: "stage wave enemyWeights must include at least one enemy type",
        path: ["enemyWeights"],
      });
    }
  });

const stageDifficultySchema = z
  .object({
    waves: z.array(stageWaveSchema).min(1),
    enemyHpMultipliers: z
      .partialRecord(z.enum(ENEMY_TYPE_IDS), positiveNumber)
      .optional(),
    threat: z
      .object({
        pressureStartAt: coordinate,
        statStartAt: coordinate,
      })
      .strict(),
    rewardScaling: z
      .object({
        enemyXpMultiplier: positiveNumber,
        enemyScoreMultiplier: positiveNumber,
        healDropChanceMultiplier: positiveNumber,
      })
      .strict(),
  })
  .strict()
  .superRefine((value, context) => {
    if (value.waves[0]?.start !== 0) {
      context.addIssue({
        code: "custom",
        message: "the first stage wave must start at 0 seconds",
        path: ["waves", 0, "start"],
      });
    }
    for (let index = 1; index < value.waves.length; index += 1) {
      if (value.waves[index]!.start <= value.waves[index - 1]!.start) {
        context.addIssue({
          code: "custom",
          message: "stage wave starts must be strictly ascending",
          path: ["waves", index, "start"],
        });
      }
    }
  });

const stageProgressionSchema = z
  .object({
    extraXpCurve: z
      .object({
        baseXp: z.number().int().positive(),
        growth: z.number().finite().min(1),
        maxXp: z.number().int().positive(),
      })
      .strict(),
  })
  .strict()
  .superRefine((value, context) => {
    if (value.extraXpCurve.maxXp < value.extraXpCurve.baseXp) {
      context.addIssue({
        code: "custom",
        message: "extra XP max must be greater than or equal to base XP",
        path: ["extraXpCurve", "maxXp"],
      });
    }
  });

const stageDefinitionSchema = z
  .object({
    id: contentId,
    titleKey: z.string().min(1),
    campaign: z
      .object({
        order: z.number().int().positive(),
        role: z.enum(["standard", "final"]),
      })
      .strict()
      .optional(),
    arena: arenaDefinitionSchema,
    obstacles: z.array(obstacleDefinitionSchema),
    encounterDeckId: contentId,
    enemyPoolId: contentId,
    difficulty: stageDifficultySchema.optional(),
    progression: stageProgressionSchema.optional(),
    clearCondition: clearConditionSchema,
    bossId: contentId.optional(),
  })
  .strict();

const enemyPoolDefinitionSchema = z
  .object({
    id: contentId,
    enemyTypeIds: z.array(z.enum(ENEMY_TYPE_IDS)).min(1),
  })
  .strict();

const gameContentDefinitionsSchema = z
  .object({
    modes: z.array(modeDefinitionSchema).min(1),
    stages: z.array(stageDefinitionSchema).min(1),
    enemyPools: z.array(enemyPoolDefinitionSchema).min(1),
    encounterDeckIds: z.array(contentId).min(1),
    bossIds: z.array(contentId),
  })
  .strict();

export function parseGameContentDefinitions(
  value: unknown,
): GameContentDefinitions {
  return gameContentDefinitionsSchema.parse(value);
}
