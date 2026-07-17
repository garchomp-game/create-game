import { z } from "zod";
import { ENCOUNTER_DIRECTIONS } from "../domain/encounterDirector";
import { ENEMY_TYPE_IDS } from "../domain/types";
import type {
  EncounterActDefinition,
  EncounterCardDefinition,
  EncounterDeckDefinition,
} from "../domain/encounterDirector";

const stableId = z.string().min(1).regex(/^[A-Za-z0-9]+(?:-[A-Za-z0-9]+)*$/);
const positiveNumber = z.number().finite().positive();
const nonNegativeNumber = z.number().finite().nonnegative();

const signalConditionSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("duration") }).strict(),
  z
    .object({ type: z.literal("signal"), signalId: stableId })
    .strict(),
]);

const encounterCardDefinitionSchema = z
  .object({
    id: stableId,
    titleKey: z.string().min(1),
    tags: z.array(stableId).min(1),
    actIds: z.array(stableId).min(1),
    timing: z
      .object({
        telegraphSeconds: positiveNumber,
        activeSeconds: positiveNumber,
        recoverySeconds: positiveNumber,
      })
      .strict(),
    spawn: z
      .object({
        intervalMultiplier: positiveNumber,
        budget: z.number().int().positive(),
        enemyWeights: z.partialRecord(z.enum(ENEMY_TYPE_IDS), positiveNumber),
        geometryId: stableId,
      })
      .strict()
      .refine((value) => Object.keys(value.enemyWeights).length > 0, {
        message: "enemyWeights must not be empty",
      }),
    minimumThreatTier: z.number().int().nonnegative(),
    cooldownSeconds: nonNegativeNumber,
    weight: z.number().int().positive(),
    completionCondition: signalConditionSchema,
    failureSignalIds: z.array(stableId),
    interruptSignalIds: z.array(stableId),
  })
  .strict();

const encounterActDefinitionSchema = z
  .object({
    id: stableId,
    titleKey: z.string().min(1),
    startsAt: nonNegativeNumber,
  })
  .strict();

const rangeSchema = z
  .object({ minSeconds: nonNegativeNumber, maxSeconds: nonNegativeNumber })
  .strict()
  .refine((value) => value.maxSeconds >= value.minSeconds, {
    message: "maxSeconds must be greater than or equal to minSeconds",
  });

const encounterDeckDefinitionSchema = z
  .object({
    id: stableId,
    cardIds: z.array(stableId).min(1),
    directionIds: z.array(z.enum(ENCOUNTER_DIRECTIONS)).min(1),
    initialDelay: rangeSchema,
    interval: rangeSchema,
    retryDelaySeconds: positiveNumber,
  })
  .strict();

export function parseEncounterCards(value: unknown): EncounterCardDefinition[] {
  return z.array(encounterCardDefinitionSchema).min(1).parse(value);
}

export function parseEncounterActs(value: unknown): EncounterActDefinition[] {
  return z.array(encounterActDefinitionSchema).min(1).parse(value);
}

export function parseEncounterDeck(value: unknown): EncounterDeckDefinition {
  return encounterDeckDefinitionSchema.parse(value);
}
