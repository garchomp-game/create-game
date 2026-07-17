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

const stageDefinitionSchema = z
  .object({
    id: contentId,
    titleKey: z.string().min(1),
    arena: arenaDefinitionSchema,
    obstacles: z.array(obstacleDefinitionSchema),
    encounterDeckId: contentId,
    enemyPoolId: contentId,
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
