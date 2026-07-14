import { z } from "zod";
import { EXTRA_UPGRADE_IDS, UPGRADE_IDS, WEAPON_TYPE_IDS } from "./types";
import type {
  CapstoneRunStats,
  EncounterRunStats,
  ExtraUpgradeId,
  ExtraUpgradeSelectionRunStat,
  PlayerDamageSource,
  RunResultSummary,
  UpgradeId,
  UpgradeSelectionRunStat,
  WeaponIdentityRunStats,
  WeaponTypeId,
} from "./types";

export const RUN_RECORD_SCHEMA_VERSION = 2 as const;
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
  extraLevel: number;
  extraCycle: number;
  threatTier: number;
  collapseStage: number;
  kills: number;
  damageTaken: number;
  lastDamageSource: PlayerDamageSource | null;
  shotsFired: number;
  hpRecovered: number;
  upgradesChosen: number;
  extraUpgradesChosen: number;
  upgradeRanks: Record<UpgradeId, number>;
  upgradeSelections: UpgradeSelectionRunStat[];
  extraUpgradeRanks: Record<ExtraUpgradeId, number>;
  extraUpgradeSelections: ExtraUpgradeSelectionRunStat[];
  buildCompletedAt: number | null;
  capstoneMetrics: CapstoneRunStats;
  weaponIdentityMetrics: WeaponIdentityRunStats;
  encounterMetrics: EncounterRunStats;
};

export type CreateRunRecordInput = {
  context: RunContext;
  capturedAt: string;
  summary: RunResultSummary;
  upgradeRanks: Record<UpgradeId, number>;
  upgradeSelections: UpgradeSelectionRunStat[];
  extraUpgradeRanks?: Record<ExtraUpgradeId, number>;
  extraUpgradeSelections?: ExtraUpgradeSelectionRunStat[];
  buildCompletedAt: number | null;
  encounterMetrics?: EncounterRunStats;
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
  z.object({
    kind: z.literal("collapse"),
    stage: z.number().int().positive(),
  }),
]);

const upgradeRanksSchema = z.object({
  rapidFire: z.number().int().nonnegative(),
  swiftStep: z.number().int().nonnegative(),
  vitalCore: z.number().int().nonnegative(),
  overdriveRounds: z.number().int().nonnegative(),
  splitShot: z.number().int().nonnegative(),
  pulseFocus: z.number().int().nonnegative().default(0),
  piercingRounds: z.number().int().nonnegative(),
  pulseRicochet: z.number().int().nonnegative(),
  spreadSweep: z.number().int().nonnegative().default(0),
});

const legacyUpgradeRanksSchema = z.object({
  rapidFire: z.number().int().nonnegative(),
  swiftStep: z.number().int().nonnegative(),
  vitalCore: z.number().int().nonnegative(),
  overdriveRounds: z.number().int().nonnegative(),
  splitShot: z.number().int().nonnegative(),
  piercingRounds: z.number().int().nonnegative(),
});

const extraUpgradeRanksSchema = z.object(
  Object.fromEntries(
    EXTRA_UPGRADE_IDS.map((id) => [id, z.number().int().nonnegative()]),
  ) as Record<ExtraUpgradeId, z.ZodNumber>,
);

const upgradeSelectionSchema = z.object({
  elapsed: z.number().nonnegative(),
  level: z.number().int().positive(),
  upgradeId: z.enum(UPGRADE_IDS),
  rank: z.number().int().positive(),
});

const extraUpgradeSelectionSchema = z.object({
  elapsed: z.number().nonnegative(),
  level: z.number().int().positive(),
  extraLevel: z.number().int().positive(),
  cycle: z.number().int().nonnegative().default(0),
  automatic: z.boolean().default(false),
  extraUpgradeId: z.enum(EXTRA_UPGRADE_IDS),
  rank: z.number().int().positive(),
});

const capstoneMetricsSchema = z.object({
  upgradeId: z.enum(["pulseRicochet", "spreadSweep"]).nullable().default(null),
  acquiredAt: z.number().nonnegative().nullable(),
  activations: z.number().int().nonnegative(),
  followUpHits: z.number().int().nonnegative(),
  followUpUniqueEnemiesHit: z.number().int().nonnegative(),
  maxFollowUpUniqueEnemiesPerVolley: z.number().int().nonnegative(),
  obstacleRicochets: z.number().int().nonnegative().default(0),
  boundaryRicochets: z.number().int().nonnegative().default(0),
  boundaryRicochetsBySide: z
    .object({
      left: z.number().int().nonnegative(),
      right: z.number().int().nonnegative(),
      top: z.number().int().nonnegative(),
      bottom: z.number().int().nonnegative(),
    })
    .default({ left: 0, right: 0, top: 0, bottom: 0 }),
  spreadSweepTriggers: z.number().int().nonnegative().default(0),
  spreadSweepConsumes: z.number().int().nonnegative().default(0),
});

const encounterMovementWindowSchema = z.object({
  distance: z.number().nonnegative(),
  vector: z.object({ x: z.number().finite(), y: z.number().finite() }),
});

const enemyTypeCountsSchema = z.object({
  chaser: z.number().int().nonnegative(),
  brute: z.number().int().nonnegative(),
  fast: z.number().int().nonnegative(),
  ranged: z.number().int().nonnegative(),
});

const weaponIdentityMetricsSchema = z.object({
  pulseFocus: z.object({
    enhancedHits: z.number().int().nonnegative(),
    bonusDamage: z.number().nonnegative(),
    maxStacks: z.number().int().nonnegative(),
    killsByEnemyType: enemyTypeCountsSchema,
  }),
  spreadSweep: z.object({
    triggers: z.number().int().nonnegative(),
    consumes: z.number().int().nonnegative(),
    maxDistinctTargets: z.number().int().nonnegative(),
  }),
});

const encounterMetricsSchema = z.object({
  scheduledAt: z.number().nonnegative().nullable(),
  warningStartedAt: z.number().nonnegative().nullable(),
  activeStartedAt: z.number().nonnegative().nullable(),
  recoveryStartedAt: z.number().nonnegative().nullable(),
  completedAt: z.number().nonnegative().nullable(),
  rangedEnemiesSpawned: z.number().int().nonnegative(),
  damageTakenDuringActive: z.number().nonnegative(),
  killsDuringActiveByEnemyType: enemyTypeCountsSchema,
  movement: z.object({
    baseline: encounterMovementWindowSchema,
    warning: encounterMovementWindowSchema,
    active: encounterMovementWindowSchema,
    recovery: encounterMovementWindowSchema,
  }),
  contractOfferedAt: z.number().nonnegative().nullable(),
  contractSelectedAt: z.number().nonnegative().nullable(),
  contractChoice: z.enum(["standard", "overdrive"]).nullable(),
  eventCounts: z
    .object({
      rangedSurge: z.number().int().nonnegative(),
      swarmRush: z.number().int().nonnegative(),
      bruteSiege: z.number().int().nonnegative(),
    })
    .default({ rangedSurge: 0, swarmRush: 0, bruteSiege: 0 }),
  eventsCompleted: z.number().int().nonnegative().default(0),
  collapseStartedAt: z.number().nonnegative().nullable().default(null),
  peakCollapseStage: z.number().int().nonnegative().default(0),
  collapseDamageTaken: z.number().nonnegative().default(0),
});

const runRecordV2Schema = z.object({
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
  extraLevel: z.number().int().nonnegative().default(0),
  extraCycle: z.number().int().nonnegative().default(0),
  threatTier: z.number().int().nonnegative().default(0),
  collapseStage: z.number().int().nonnegative().default(0),
  kills: z.number().int().nonnegative(),
  damageTaken: z.number().nonnegative(),
  lastDamageSource: damageSourceSchema.nullable(),
  shotsFired: z.number().int().nonnegative(),
  hpRecovered: z.number().nonnegative(),
  upgradesChosen: z.number().int().nonnegative(),
  extraUpgradesChosen: z.number().int().nonnegative().default(0),
  upgradeRanks: upgradeRanksSchema,
  upgradeSelections: z.array(upgradeSelectionSchema),
  extraUpgradeRanks: extraUpgradeRanksSchema.default(createEmptyExtraUpgradeRanks),
  extraUpgradeSelections: z.array(extraUpgradeSelectionSchema).default([]),
  buildCompletedAt: z.number().nonnegative().nullable(),
  capstoneMetrics: capstoneMetricsSchema,
  weaponIdentityMetrics: weaponIdentityMetricsSchema.default(createEmptyWeaponIdentityMetrics),
  encounterMetrics: encounterMetricsSchema.default(createEmptyEncounterMetrics),
});

const runRecordV1Schema = runRecordV2Schema
  .omit({
    schemaVersion: true,
    upgradeRanks: true,
    upgradeSelections: true,
    buildCompletedAt: true,
    capstoneMetrics: true,
  })
  .extend({
    schemaVersion: z.literal(1),
    upgradeRanks: legacyUpgradeRanksSchema,
  });

export const runRecordSchema: z.ZodType<RunRecord> = z.union([
  runRecordV2Schema,
  runRecordV1Schema.transform((record) => ({
    ...record,
    schemaVersion: RUN_RECORD_SCHEMA_VERSION,
    upgradeRanks: {
      ...record.upgradeRanks,
      pulseFocus: 0,
      pulseRicochet: 0,
      spreadSweep: 0,
    },
    upgradeSelections: [],
    extraUpgradeRanks: createEmptyExtraUpgradeRanks(),
    extraUpgradeSelections: [],
    extraUpgradesChosen: 0,
    extraLevel: 0,
    extraCycle: 0,
    threatTier: 0,
    collapseStage: 0,
    buildCompletedAt: null,
    capstoneMetrics: createEmptyCapstoneMetrics(),
    encounterMetrics: createEmptyEncounterMetrics(),
  })),
]);

function createEmptyCapstoneMetrics(): CapstoneRunStats {
  return {
    upgradeId: null,
    acquiredAt: null,
    activations: 0,
    followUpHits: 0,
    followUpUniqueEnemiesHit: 0,
    maxFollowUpUniqueEnemiesPerVolley: 0,
    obstacleRicochets: 0,
    boundaryRicochets: 0,
    boundaryRicochetsBySide: { left: 0, right: 0, top: 0, bottom: 0 },
    spreadSweepTriggers: 0,
    spreadSweepConsumes: 0,
  };
}

function createEmptyWeaponIdentityMetrics(): WeaponIdentityRunStats {
  return {
    pulseFocus: {
      enhancedHits: 0,
      bonusDamage: 0,
      maxStacks: 0,
      killsByEnemyType: { chaser: 0, brute: 0, fast: 0, ranged: 0 },
    },
    spreadSweep: { triggers: 0, consumes: 0, maxDistinctTargets: 0 },
  };
}

function createEmptyExtraUpgradeRanks(): Record<ExtraUpgradeId, number> {
  return Object.fromEntries(EXTRA_UPGRADE_IDS.map((id) => [id, 0])) as Record<
    ExtraUpgradeId,
    number
  >;
}

function createEmptyEncounterMetrics(): EncounterRunStats {
  return {
    scheduledAt: null,
    warningStartedAt: null,
    activeStartedAt: null,
    recoveryStartedAt: null,
    completedAt: null,
    rangedEnemiesSpawned: 0,
    damageTakenDuringActive: 0,
    killsDuringActiveByEnemyType: { chaser: 0, brute: 0, fast: 0, ranged: 0 },
    movement: {
      baseline: { distance: 0, vector: { x: 0, y: 0 } },
      warning: { distance: 0, vector: { x: 0, y: 0 } },
      active: { distance: 0, vector: { x: 0, y: 0 } },
      recovery: { distance: 0, vector: { x: 0, y: 0 } },
    },
    contractOfferedAt: null,
    contractSelectedAt: null,
    contractChoice: null,
    eventCounts: { rangedSurge: 0, swarmRush: 0, bruteSiege: 0 },
    eventsCompleted: 0,
    collapseStartedAt: null,
    peakCollapseStage: 0,
    collapseDamageTaken: 0,
  };
}
