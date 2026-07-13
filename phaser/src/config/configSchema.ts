import { z } from "zod";
import {
  ENEMY_TYPE_IDS,
  EXTRA_UPGRADE_IDS,
  UPGRADE_CATEGORIES,
  UPGRADE_IDS,
  WEAPON_TYPE_IDS,
} from "../domain/types";
import type {
  EnemyViewConfig,
  EnemyTypeId,
  ExtraUpgradeId,
  SimulationConfig,
  UpgradeId,
  ViewConfig,
  WeaponTypeId,
} from "../domain/types";

const finiteNumber = z.number().finite();
const positiveNumber = finiteNumber.positive();
const nonNegativeNumber = finiteNumber.nonnegative();
const chanceNumber = nonNegativeNumber.max(1);
const colorNumber = z.number().int().min(0).max(0xffffff);

const arenaSimulationSchema = z
  .object({
    width: positiveNumber,
    height: positiveNumber,
  })
  .strict();

const playerSimulationSchema = z
  .object({
    x: finiteNumber,
    y: finiteNumber,
    radius: positiveNumber,
    speed: positiveNumber,
    maxHp: positiveNumber,
    damageCooldown: nonNegativeNumber,
  })
  .strict();

const weaponSimulationSchema = z
  .object({
    radius: positiveNumber,
    speed: positiveNumber,
    lifetime: positiveNumber,
    interval: positiveNumber,
    damage: positiveNumber,
    projectileCount: z.number().int().positive(),
    spreadAngle: nonNegativeNumber,
    hitCapacity: z.number().int().positive(),
    ricochetCount: z.number().int().nonnegative(),
  })
  .strict();

const weaponDefinitionsSchema = z
  .object(
    Object.fromEntries(
      WEAPON_TYPE_IDS.map((typeId) => [typeId, weaponSimulationSchema]),
    ) as Record<WeaponTypeId, typeof weaponSimulationSchema>,
  )
  .strict();

const healEnemyMultiplierSchema = z
  .object(
    Object.fromEntries(
      ENEMY_TYPE_IDS.map((typeId) => [typeId, positiveNumber]),
    ) as Record<EnemyTypeId, typeof positiveNumber>,
  )
  .strict();

const pickupSimulationSchema = z
  .object({
    xpRadius: positiveNumber,
    healRadius: positiveNumber,
    magnetRadius: positiveNumber,
    magnetSpeed: positiveNumber,
    placementStep: positiveNumber,
    placementRings: z.number().int().nonnegative(),
    healDropChance: chanceNumber,
    healDropPityThreshold: z.number().int().nonnegative(),
    healDropPityBonus: chanceNumber,
    healDropMaxChance: chanceNumber,
    healRatio: positiveNumber,
    healMinimum: nonNegativeNumber,
    healLifetime: positiveNumber,
    healEnemyMultipliers: healEnemyMultiplierSchema,
  })
  .strict();

const levelingSimulationSchema = z
  .object({
    baseXp: z.number().int().positive(),
    growth: z.number().finite().min(1),
    maxXp: z.number().int().positive(),
    upgradeChoiceCount: z.number().int().min(1).max(UPGRADE_IDS.length),
    extra: z
      .object({
        baseXp: z.number().int().positive(),
        growth: z.number().finite().min(1),
        maxXp: z.number().int().positive(),
        upgradeChoiceCount: z.number().int().min(1).max(EXTRA_UPGRADE_IDS.length),
      })
      .strict(),
  })
  .strict();

const upgradeEffectSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("fireIntervalMultiplier"), multiplier: positiveNumber.max(1) }).strict(),
  z.object({ type: z.literal("moveSpeedMultiplier"), multiplier: positiveNumber }).strict(),
  z.object({ type: z.literal("projectileSpeedMultiplier"), multiplier: positiveNumber }).strict(),
  z.object({ type: z.literal("maxHp"), amount: positiveNumber }).strict(),
  z.object({ type: z.literal("projectileCount"), amount: z.number().int().positive() }).strict(),
  z.object({ type: z.literal("hitCapacity"), amount: z.number().int().positive() }).strict(),
  z.object({ type: z.literal("ricochet"), amount: z.number().int().positive() }).strict(),
]);

const categoryRankRequirementsSchema = z
  .object({
    weapon: z.number().int().nonnegative().optional(),
    mobility: z.number().int().nonnegative().optional(),
    survival: z.number().int().nonnegative().optional(),
    support: z.number().int().nonnegative().optional(),
    capstone: z.number().int().nonnegative().optional(),
  })
  .strict();

const upgradeRequirementsSchema = z
  .object({
    weaponIds: z.array(z.enum(WEAPON_TYPE_IDS)).min(1).optional(),
    minimumCategoryRanks: categoryRankRequirementsSchema.optional(),
    featureFlag: z.literal("pulseRicochet").optional(),
  })
  .strict();

const upgradeDefinitionSchema = z
  .object({
    id: z.enum(UPGRADE_IDS),
    title: z.string().min(1),
    description: z.string().min(1),
    category: z.enum(UPGRADE_CATEGORIES),
    maxRank: z.number().int().positive(),
    weight: positiveNumber,
    effect: upgradeEffectSchema,
    requirements: upgradeRequirementsSchema.optional(),
  })
  .strict();

const upgradeDefinitionsSchema = z
  .object(
    Object.fromEntries(
      UPGRADE_IDS.map((upgradeId) => [upgradeId, upgradeDefinitionSchema]),
    ) as Record<UpgradeId, typeof upgradeDefinitionSchema>,
  )
  .strict()
  .superRefine((value, context) => {
    for (const upgradeId of UPGRADE_IDS) {
      if (value[upgradeId].id !== upgradeId) {
        context.addIssue({
          code: "custom",
          message: "upgrade definition id must match its record key",
          path: [upgradeId, "id"],
        });
      }
    }
  });

const extraUpgradeEffectSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("projectileDamage"), amountPerRank: positiveNumber }).strict(),
  z
    .object({
      type: z.literal("fireRate"),
      amountPerRank: positiveNumber,
      maximumBonus: positiveNumber,
    })
    .strict(),
  z
    .object({
      type: z.literal("moveSpeed"),
      amountPerRank: positiveNumber,
      maximumBonus: positiveNumber,
    })
    .strict(),
  z.object({ type: z.literal("maxHp"), amountPerRank: positiveNumber }).strict(),
]);

const extraUpgradeDefinitionSchema = z
  .object({
    id: z.enum(EXTRA_UPGRADE_IDS),
    title: z.string().min(1),
    description: z.string().min(1),
    maxRank: z.number().int().positive().nullable(),
    weight: positiveNumber,
    effect: extraUpgradeEffectSchema,
  })
  .strict();

const extraUpgradeDefinitionsSchema = z
  .object(
    Object.fromEntries(
      EXTRA_UPGRADE_IDS.map((id) => [id, extraUpgradeDefinitionSchema]),
    ) as Record<ExtraUpgradeId, typeof extraUpgradeDefinitionSchema>,
  )
  .strict()
  .superRefine((value, context) => {
    for (const id of EXTRA_UPGRADE_IDS) {
      if (value[id].id !== id) {
        context.addIssue({
          code: "custom",
          message: "extra upgrade definition id must match its record key",
          path: [id, "id"],
        });
      }
    }
  });

const rangedEnemySimulationSchema = z
  .object({
    preferredRange: positiveNumber,
    attackInterval: positiveNumber,
    projectileRadius: positiveNumber,
    projectileSpeed: positiveNumber,
    projectileLifetime: positiveNumber,
    projectileDamage: positiveNumber,
  })
  .strict();

const enemySimulationSchema = z
  .object({
    radius: positiveNumber,
    hp: positiveNumber,
    damage: positiveNumber,
    speed: positiveNumber,
    score: nonNegativeNumber,
    xpValue: nonNegativeNumber,
    spawnCost: positiveNumber,
    behavior: z.enum(["chase", "ranged"]),
    ranged: rangedEnemySimulationSchema.optional(),
  })
  .strict()
  .superRefine((value, context) => {
    if (value.behavior === "ranged" && !value.ranged) {
      context.addIssue({
        code: "custom",
        message: "ranged enemy definitions require ranged projectile config",
        path: ["ranged"],
      });
    }
  });

const enemyDefinitionsSchema = z
  .object(
    Object.fromEntries(
      ENEMY_TYPE_IDS.map((typeId) => [typeId, enemySimulationSchema]),
    ) as Record<EnemyTypeId, typeof enemySimulationSchema>,
  )
  .strict();

const waveBandSchema = z
  .object({
    start: nonNegativeNumber,
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
        message: "wave enemyWeights must include at least one enemy type",
        path: ["enemyWeights"],
      });
    }
  });

const encounterDefinitionSchema = z
  .object({
    warningDuration: positiveNumber,
    activeDuration: positiveNumber,
    recoveryDuration: positiveNumber,
    spawnIntervalMultiplier: positiveNumber.max(1),
    spawnBudget: z.number().int().positive(),
    enemyWeights: z.partialRecord(z.enum(ENEMY_TYPE_IDS), positiveNumber),
  })
  .strict();

const obstacleSchema = z
  .object({
    id: z.string().min(1),
    x: finiteNumber,
    y: finiteNumber,
    width: positiveNumber,
    height: positiveNumber,
  })
  .strict();

export const simulationConfigSchema: z.ZodType<SimulationConfig> = z
  .object({
    seed: z.number().int(),
    features: z
      .object({
        pulseRicochet: z.boolean(),
        encounterDeck: z.boolean(),
        endlessContract: z.boolean(),
        arenaCollapse: z.boolean(),
        enemyNavigation: z.boolean(),
      })
      .strict(),
    arena: arenaSimulationSchema,
    player: playerSimulationSchema,
    defaultWeapon: z.enum(WEAPON_TYPE_IDS),
    weapons: weaponDefinitionsSchema,
    enemies: enemyDefinitionsSchema,
    waves: z
      .array(waveBandSchema)
      .min(1)
      .superRefine((waves, context) => {
        for (let index = 1; index < waves.length; index += 1) {
          if (waves[index]!.start <= waves[index - 1]!.start) {
            context.addIssue({
              code: "custom",
              message: "wave starts must be strictly ascending",
              path: [index, "start"],
            });
          }
        }
      }),
    pickup: pickupSimulationSchema,
    leveling: levelingSimulationSchema,
    upgrades: upgradeDefinitionsSchema,
    extraUpgrades: extraUpgradeDefinitionsSchema,
    navigation: z
      .object({
        cellSize: positiveNumber,
        obstacleClearance: nonNegativeNumber,
      })
      .strict(),
    threat: z
      .object({
        pressureStartAt: nonNegativeNumber,
        pressureStepSeconds: positiveNumber,
        spawnIntervalStep: nonNegativeNumber,
        minimumSpawnInterval: positiveNumber,
        speedMultiplierStep: nonNegativeNumber,
        maximumSpeedMultiplier: positiveNumber,
        maxEnemiesStep: z.number().int().nonnegative(),
        maximumEnemies: z.number().int().positive(),
        spawnBudgetStepInterval: z.number().int().positive(),
        maximumSpawnBudget: z.number().int().positive(),
        statStartAt: nonNegativeNumber,
        statStepSeconds: positiveNumber,
        enemyHpGrowth: z.number().min(1),
        enemyDamageGrowth: z.number().min(1),
        enemyScoreGrowth: z.number().min(1),
        rangedProjectileSpeedGrowth: z.number().min(1),
        maximumProjectileSpeedMultiplier: z.number().min(1),
        rangedAttackSpeedGrowth: z.number().min(1),
        maximumAttackSpeedMultiplier: z.number().min(1),
        healDropDecay: positiveNumber.max(1),
        minimumHealDropMultiplier: positiveNumber.max(1),
      })
      .strict(),
    encounter: z
      .object({
        director: z
          .object({
            minStart: nonNegativeNumber,
            maxStart: positiveNumber,
            minInterval: positiveNumber,
            maxInterval: positiveNumber,
            minimumInterval: positiveNumber,
            intervalReductionPerThreatTier: nonNegativeNumber,
            definitions: z
              .object({
                rangedSurge: encounterDefinitionSchema,
                swarmRush: encounterDefinitionSchema,
                bruteSiege: encounterDefinitionSchema,
              })
              .strict(),
          })
          .strict()
          .superRefine((value, context) => {
            if (value.maxStart < value.minStart) {
              context.addIssue({ code: "custom", message: "maxStart must be at least minStart" });
            }
            if (value.maxInterval < value.minInterval) {
              context.addIssue({ code: "custom", message: "maxInterval must be at least minInterval" });
            }
          }),
        contract: z
          .object({
            offerAt: positiveNumber,
            enemySpeedMultiplier: positiveNumber,
            scoreMultiplier: positiveNumber,
          })
          .strict(),
        collapse: z
          .object({
            startsAt: nonNegativeNumber,
            stepSeconds: positiveNumber,
            warningDuration: nonNegativeNumber,
            insetPerStep: positiveNumber,
            damageInterval: positiveNumber,
            baseDamage: positiveNumber,
            damageGrowth: z.number().min(1),
          })
          .strict(),
      })
      .strict(),
    obstacles: z.array(obstacleSchema).min(1),
  })
  .strict()
  .superRefine((value, context) => {
    if (value.waves[0]?.start !== 0) {
      context.addIssue({
        code: "custom",
        message: "first wave must start at 0",
        path: ["waves", 0, "start"],
      });
    }

    value.waves.forEach((wave, waveIndex) => {
      for (const typeId of Object.keys(wave.enemyWeights) as EnemyTypeId[]) {
        const definition = value.enemies[typeId];
        if (definition.spawnCost > wave.spawnBudget) {
          context.addIssue({
            code: "custom",
            message: "weighted enemy spawnCost must fit within wave spawnBudget",
            path: ["waves", waveIndex, "enemyWeights", typeId],
          });
        }
      }
    });
  });

const entityColorSchema = z
  .object({
    color: colorNumber,
    stroke: colorNumber,
  })
  .strict();

const enemyViewSchema: z.ZodType<EnemyViewConfig> = z
  .object({
    color: colorNumber,
    stroke: colorNumber,
    shape: z.enum(["circle", "square", "diamond", "triangle", "hex"]),
    mark: z.enum(["ring", "cross", "slash", "dot"]),
    markColor: colorNumber,
  })
  .strict();

export const viewConfigSchema: z.ZodType<ViewConfig> = z
  .object({
    arena: z
      .object({
        background: colorNumber,
        border: colorNumber,
      })
      .strict(),
    player: entityColorSchema,
    bullet: z
      .object({
        color: colorNumber,
      })
      .strict(),
    enemy: z
      .object(
        Object.fromEntries(
          ENEMY_TYPE_IDS.map((typeId) => [typeId, enemyViewSchema]),
        ) as Record<EnemyTypeId, typeof enemyViewSchema>,
      )
      .strict(),
    enemyProjectile: z
      .object({
        color: colorNumber,
        stroke: colorNumber,
        core: colorNumber,
      })
      .strict(),
    pickup: z
      .object({
        xpColor: colorNumber,
        healFill: colorNumber,
        healStroke: colorNumber,
        healCross: colorNumber,
      })
      .strict(),
    obstacle: z
      .object({
        fill: colorNumber,
        stroke: colorNumber,
        radius: nonNegativeNumber,
      })
      .strict(),
  })
  .strict();

export function parseSimulationConfig(input: unknown): SimulationConfig {
  return simulationConfigSchema.parse(input);
}

export function parseViewConfig(input: unknown): ViewConfig {
  return viewConfigSchema.parse(input);
}
