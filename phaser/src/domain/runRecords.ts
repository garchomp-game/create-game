import { z } from "zod";
import { UPGRADE_IDS, WEAPON_TYPE_IDS } from "./types";
import type {
  PlayerDamageSource,
  RunResultSummary,
  UpgradeId,
  WeaponTypeId,
} from "./types";

export const RUN_RECORD_SCHEMA_VERSION = 1 as const;
export const RUN_HISTORY_LIMIT = 50;
export const RUN_RANKING_LIMIT = 10;

export const RUN_ORIGINS = ["manual", "debug", "test"] as const;
export type RunOrigin = (typeof RUN_ORIGINS)[number];

export const SEED_CATEGORIES = ["random", "fixed"] as const;
export type SeedCategory = (typeof SEED_CATEGORIES)[number];

export const RANK_INELIGIBILITY_REASONS = [
  "debugRun",
  "automatedTest",
  "nonStandardRuleset",
] as const;
export type RankIneligibilityReason = (typeof RANK_INELIGIBILITY_REASONS)[number];

export type RankEligibility = {
  eligible: boolean;
  reasons: RankIneligibilityReason[];
};

export type RunComparisonKey = {
  modeId: string;
  stageId: string;
  difficultyId: string;
  rulesetVersion: string;
  seedCategory: SeedCategory;
};

export type RunContext = RunComparisonKey & {
  id: string;
  profileId: string;
  startedAt: string;
  weaponId: WeaponTypeId;
  modifierIds: string[];
  appVersion: string;
  buildCommit: string;
  seed: number;
  runOrigin: RunOrigin;
  rankEligibility: RankEligibility;
};

export type RunRecord = RunComparisonKey & {
  schemaVersion: typeof RUN_RECORD_SCHEMA_VERSION;
  id: string;
  profileId: string;
  capturedAt: string;
  weaponId: WeaponTypeId;
  modifierIds: string[];
  appVersion: string;
  buildCommit: string;
  seed: number;
  runOrigin: RunOrigin;
  rankEligibility: RankEligibility;
  elapsed: number;
  score: number;
  level: number;
  kills: number;
  damageTaken: number;
  lastDamageSource: PlayerDamageSource | null;
  shotsFired: number;
  hpRecovered: number;
  upgradesChosen: number;
  upgradeRanks: Record<UpgradeId, number>;
};

export type CreateRunRecordInput = {
  context: RunContext;
  capturedAt: string;
  summary: RunResultSummary;
  upgradeRanks: Record<UpgradeId, number>;
};

const damageSourceSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("contact"),
    enemyId: z.string().min(1),
    enemyType: z.enum(["chaser", "brute", "fast", "ranged"]),
  }),
  z.object({
    kind: z.literal("projectile"),
    projectileId: z.string().min(1),
  }),
]);

const upgradeRanksSchema = z.object(
  Object.fromEntries(
    UPGRADE_IDS.map((id) => [id, z.number().int().nonnegative()]),
  ) as Record<UpgradeId, z.ZodNumber>,
);

export const runRecordSchema: z.ZodType<RunRecord> = z.object({
  schemaVersion: z.literal(RUN_RECORD_SCHEMA_VERSION),
  id: z.string().min(1),
  profileId: z.string().min(1),
  capturedAt: z.string().datetime({ offset: true }),
  modeId: z.string().min(1),
  stageId: z.string().min(1),
  difficultyId: z.string().min(1),
  weaponId: z.enum(WEAPON_TYPE_IDS),
  modifierIds: z.array(z.string().min(1)),
  appVersion: z.string().min(1),
  rulesetVersion: z.string().min(1),
  buildCommit: z.string().min(1),
  seed: z.number().int().nonnegative(),
  seedCategory: z.enum(SEED_CATEGORIES),
  runOrigin: z.enum(RUN_ORIGINS),
  rankEligibility: z
    .object({
      eligible: z.boolean(),
      reasons: z.array(z.enum(RANK_INELIGIBILITY_REASONS)),
    })
    .superRefine((value, context) => {
      if (value.eligible !== (value.reasons.length === 0)) {
        context.addIssue({
          code: "custom",
          message: "Eligibility must match the absence of ineligibility reasons.",
        });
      }
    }),
  elapsed: z.number().nonnegative(),
  score: z.number().int().nonnegative(),
  level: z.number().int().positive(),
  kills: z.number().int().nonnegative(),
  damageTaken: z.number().nonnegative(),
  lastDamageSource: damageSourceSchema.nullable(),
  shotsFired: z.number().int().nonnegative(),
  hpRecovered: z.number().nonnegative(),
  upgradesChosen: z.number().int().nonnegative(),
  upgradeRanks: upgradeRanksSchema,
});
