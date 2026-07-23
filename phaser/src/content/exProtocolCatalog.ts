import { z } from "zod";
import type {
  ExProtocolEvolutionId,
  ExProtocolId,
} from "../domain/exProtocols";
import type { WeaponTypeId } from "../domain/types";
import rawCatalog from "./ex-protocols.v1.json";

const finiteNumber = z.number().finite();
const positiveNumber = finiteNumber.positive();
const nonNegativeNumber = finiteNumber.nonnegative();
const positiveInteger = z.number().int().positive();
const nonNegativeInteger = z.number().int().nonnegative();
const protocolWeaponId = z.enum(["pulse", "spread"]);
const displayFields = {
  displayNameJa: z.string().min(1),
  displayNameEn: z.string().min(1),
};

function protocolIdAt(index: number): z.ZodLiteral<string> {
  const protocol = rawCatalog.protocols[index];
  if (!protocol) throw new Error(`Missing EX Protocol catalog entry at index ${index}.`);
  return z.literal(protocol.id);
}

const relayProtocolSchema = z
  .object({
    id: protocolIdAt(0),
    weaponId: z.literal("pulse"),
    ...displayFields,
    interaction: z.literal("passive"),
    identity: z.array(z.string().min(1)).min(1),
    signature: z
      .object({
        anchorLifetimeSeconds: positiveNumber,
        relayHalfWidthPx: positiveNumber,
        maxIntermediateTargets: positiveInteger,
        damageMultiplier: positiveNumber,
        bossEligibleAsIntermediate: z.boolean(),
        blockedByObstacles: z.boolean(),
        consumeOnUnblockedAttempt: z.boolean(),
        resetAnchorFocusStacks: nonNegativeInteger,
        anchorPositionMode: z.literal("live-center-at-endpoint-collision"),
        endpointRequiresLaterNormalVolley: z.boolean(),
        endpointRequiresFirstEnemyHit: z.boolean(),
        refreshAnchorOnSurvivingMaxFocusDirectHit: z.boolean(),
        resolveRelayFromLethalEndpointSnapshot: z.boolean(),
        createAnchorFromLethalHit: z.boolean(),
      })
      .strict(),
    evolutionOne: z
      .tuple([
        z
          .object({
            id: z.string().min(1),
            ...displayFields,
            anchorLifetimeSeconds: positiveNumber,
          })
          .strict(),
        z
          .object({
            id: z.string().min(1),
            ...displayFields,
            maxIntermediateTargets: positiveInteger,
          })
          .strict(),
      ]),
    evolutionTwo: z
      .tuple([
        z
          .object({
            id: z.string().min(1),
            ...displayFields,
            remainingAnchorFocusStacks: nonNegativeInteger,
          })
          .strict(),
        z
          .object({
            id: z.string().min(1),
            ...displayFields,
            endpointBonusFocusStacks: positiveInteger,
            activateOnBlockedRelay: z.boolean(),
          })
          .strict(),
      ]),
    mastery: z
      .object({
        id: z.string().min(1),
        ...displayFields,
        minimumEligibleIntermediateTargets: positiveInteger,
        damageMultiplier: positiveNumber,
      })
      .strict(),
  })
  .strict();

const reboundProtocolSchema = z
  .object({
    id: protocolIdAt(1),
    weaponId: z.literal("pulse"),
    ...displayFields,
    interaction: z.literal("active"),
    identity: z.array(z.string().min(1)).min(1),
    signature: z
      .object({
        armDurationSeconds: positiveNumber,
        cooldownSeconds: positiveNumber,
        capacityRestoreMode: z.literal("at-least-capacity-at-fire"),
        capacityBonus: nonNegativeInteger,
        restoreOnRicochetOrdinal: positiveInteger,
        clearHitEnemyIds: z.boolean(),
        refundOnMiss: z.boolean(),
      })
      .strict(),
    evolutionOne: z
      .tuple([
        z
          .object({
            id: z.string().min(1),
            ...displayFields,
            cooldownSeconds: positiveNumber,
          })
          .strict(),
        z
          .object({
            id: z.string().min(1),
            ...displayFields,
            capacityBonus: positiveInteger,
          })
          .strict(),
      ]),
    evolutionTwo: z
      .tuple([
        z
          .object({
            id: z.string().min(1),
            ...displayFields,
            armedVolleyRicochetCapacityBonus: positiveInteger,
          })
          .strict(),
        z
          .object({
            id: z.string().min(1),
            ...displayFields,
            postRicochetDamageMultiplier: positiveNumber,
          })
          .strict(),
      ]),
    mastery: z
      .object({
        id: z.string().min(1),
        ...displayFields,
        uniquePostRicochetHits: positiveInteger,
        remainingCooldownMultiplier: positiveNumber.max(1),
        maxRefundsPerVolley: positiveInteger,
      })
      .strict(),
  })
  .strict();

const redlineProtocolSchema = z
  .object({
    id: protocolIdAt(2),
    weaponId: z.literal("pulse"),
    ...displayFields,
    interaction: z.literal("passive"),
    identity: z.array(z.string().min(1)).min(1),
    signature: z
      .object({
        effectiveMaxHpMultiplier: positiveNumber.max(1),
        redlineDamageMultiplier: positiveNumber,
        capacityRestore: positiveInteger,
        requiresStackBeforeAtMaximum: z.boolean(),
        directPreRicochetHitOnly: z.boolean(),
      })
      .strict(),
    evolutionOne: z
      .tuple([
        z
          .object({
            id: z.string().min(1),
            ...displayFields,
            effectiveMaxHpMultiplier: positiveNumber.max(1),
            healOnCapacityIncrease: z.boolean(),
          })
          .strict(),
        z
          .object({
            id: z.string().min(1),
            ...displayFields,
            redlineDamageMultiplier: positiveNumber,
          })
          .strict(),
      ]),
    evolutionTwo: z
      .tuple([
        z
          .object({
            id: z.string().min(1),
            ...displayFields,
            focusDurationBonusSeconds: positiveNumber,
          })
          .strict(),
        z
          .object({
            id: z.string().min(1),
            ...displayFields,
            capacityRestore: positiveInteger,
          })
          .strict(),
      ]),
    mastery: z
      .object({
        id: z.string().min(1),
        ...displayFields,
        damageBase: z.literal("captured-trigger-redline-resolved-damage"),
        extraCapacityHitDamageMultiplier: positiveNumber,
        maxEmpoweredExtraHitsPerProjectile: positiveInteger,
        bossEligible: z.boolean(),
        consumeOnIneligibleBoss: z.boolean(),
      })
      .strict(),
  })
  .strict();

const tidalProtocolSchema = z
  .object({
    id: protocolIdAt(3),
    weaponId: z.literal("spread"),
    ...displayFields,
    interaction: z.literal("active"),
    identity: z.array(z.string().min(1)).min(1),
    signature: z
      .object({
        chargeDistinctTargets: positiveInteger,
        initialCharges: nonNegativeInteger,
        requireBothOuterProjectiles: z.boolean(),
        requireDistinctOuterTargets: z.boolean(),
        maxCharges: positiveInteger,
        projectileCount: positiveInteger,
        arcRadians: positiveNumber,
        damageMultiplier: positiveNumber,
        hitCapacity: positiveInteger,
        speedMultiplier: positiveNumber,
        lifetimeMultiplier: positiveNumber,
        maxHitsPerEnemyPerActivation: positiveInteger,
        duplicateSharedHitCollision: z.literal("transparent-no-capacity-cost"),
      })
      .strict(),
    evolutionOne: z
      .tuple([
        z
          .object({
            id: z.string().min(1),
            ...displayFields,
            arcRadians: positiveNumber,
          })
          .strict(),
        z
          .object({
            id: z.string().min(1),
            ...displayFields,
            hitCapacity: positiveInteger,
          })
          .strict(),
      ]),
    evolutionTwo: z
      .tuple([
        z
          .object({
            id: z.string().min(1),
            ...displayFields,
            maxCharges: positiveInteger,
            grantChargeOnSelection: z.boolean(),
          })
          .strict(),
        z
          .object({
            id: z.string().min(1),
            ...displayFields,
            minimumDistinctActivationHits: positiveInteger,
            currentNormalShotTimerMultiplier: positiveNumber.max(1),
            maxTriggersPerActivation: positiveInteger,
          })
          .strict(),
      ]),
    mastery: z
      .object({
        id: z.string().min(1),
        ...displayFields,
        minimumDistinctActivationHits: positiveInteger,
        grantCoreSpreadSweepCharge: positiveInteger,
        maxTriggersPerActivation: positiveInteger,
      })
      .strict(),
  })
  .strict();

const breakwaterClassSchema = z
  .object({
    chaser: nonNegativeNumber,
    fast: nonNegativeNumber,
    brute: nonNegativeNumber,
    ranged: nonNegativeNumber,
    commander: nonNegativeNumber,
    charger: nonNegativeNumber,
    boss: nonNegativeNumber,
  })
  .strict();

const breakwaterProtocolSchema = z
  .object({
    id: protocolIdAt(4),
    weaponId: z.literal("spread"),
    ...displayFields,
    interaction: z.literal("active"),
    identity: z.array(z.string().min(1)).min(1),
    signature: z
      .object({
        chargeDistinctTargets: positiveInteger,
        initialCharges: nonNegativeInteger,
        chargeRangePx: positiveNumber,
        maxCharges: positiveInteger,
        cooldownSeconds: positiveNumber,
        costGrossHpSnapshotRatio: positiveNumber.max(1),
        minimumHpAfterCost: positiveNumber,
        coneAngleDegrees: positiveNumber.max(360),
        rangePx: positiveNumber,
        maxTargets: positiveInteger,
        requiresLineOfSight: z.boolean(),
        targetOrder: z.tuple([z.literal("distance"), z.literal("creation-ordinal")]),
        classPriority: z.tuple([
          z.literal("boss"),
          z.literal("charger"),
          z.literal("commander"),
          z.literal("base-type"),
        ]),
        resolveImmediatelyInSpecialPhase: z.boolean(),
        consumeOnZeroTargets: z.boolean(),
        damageMultipliers: breakwaterClassSchema,
        pushDistancePx: breakwaterClassSchema,
      })
      .strict(),
    evolutionOne: z
      .tuple([
        z
          .object({
            id: z.string().min(1),
            ...displayFields,
            costGrossHpSnapshotRatio: positiveNumber.max(1),
          })
          .strict(),
        z
          .object({
            id: z.string().min(1),
            ...displayFields,
            activationDamageMultiplier: positiveNumber,
          })
          .strict(),
      ]),
    evolutionTwo: z
      .tuple([
        z
          .object({
            id: z.string().min(1),
            ...displayFields,
            rangePx: positiveNumber,
            coneAngleDegrees: positiveNumber.max(360),
          })
          .strict(),
        z
          .object({
            id: z.string().min(1),
            ...displayFields,
            rangePx: positiveNumber,
            coneAngleDegrees: positiveNumber.max(360),
          })
          .strict(),
      ]),
    mastery: z
      .object({
        id: z.string().min(1),
        ...displayFields,
        minimumAffectedNonBossTargets: positiveInteger,
        moveSpeedMultiplier: positiveNumber,
        durationSeconds: positiveNumber,
        stackMode: z.literal("refresh"),
      })
      .strict(),
  })
  .strict();

const aegisProtocolSchema = z
  .object({
    id: protocolIdAt(5),
    weaponId: z.literal("spread"),
    ...displayFields,
    interaction: z.literal("passive"),
    identity: z.array(z.string().min(1)).min(1),
    signature: z
      .object({
        edgeProjectileIndices: z.literal("first-and-last"),
        edgeEnemyDamageMultiplier: positiveNumber.max(1),
        interceptsPerEdgeProjectile: positiveInteger,
        consumeEdgeProjectileOnIntercept: z.boolean(),
        interceptibleProjectileCategory: z.literal("standard"),
        bossProjectilesInterceptible: z.boolean(),
        collisionMode: z.literal("relative-swept"),
        interceptionRequiresPreRicochet: z.boolean(),
        eventPriority: z.tuple([
          z.literal("enemy-projectile-termination"),
          z.literal("enemy-projectile-interception"),
          z.literal("legacy-player-endpoint-hit"),
          z.literal("player-bullet-enemy-hit"),
          z.literal("player-bullet-motion-boundary"),
        ]),
        tieBreaker: z.tuple([
          z.literal("player-bullet-creation-ordinal"),
          z.literal("enemy-projectile-creation-ordinal"),
          z.literal("enemy-creation-ordinal"),
          z.literal("local-event-ordinal"),
        ]),
        collisionTimeEpsilon: positiveNumber,
        minimumFrameTimeAdvance: positiveNumber,
        maxCollisionEventsPerFrame: positiveInteger,
      })
      .strict(),
    evolutionOne: z
      .tuple([
        z
          .object({
            id: z.string().min(1),
            ...displayFields,
            edgeEnemyDamageMultiplier: positiveNumber.max(1),
          })
          .strict(),
        z
          .object({
            id: z.string().min(1),
            ...displayFields,
            interceptionRadiusBonusPx: positiveNumber,
          })
          .strict(),
      ]),
    evolutionTwo: z
      .tuple([
        z
          .object({
            id: z.string().min(1),
            ...displayFields,
            consumeEdgeProjectileOnIntercept: z.boolean(),
            remainingInterceptsAfterIntercept: nonNegativeInteger,
            preserveEnemyHitCapacity: z.boolean(),
          })
          .strict(),
        z
          .object({
            id: z.string().min(1),
            ...displayFields,
            moveSpeedMultiplier: positiveNumber,
            durationSeconds: positiveNumber,
            stackMode: z.literal("refresh"),
          })
          .strict(),
      ]),
    mastery: z
      .object({
        id: z.string().min(1),
        ...displayFields,
        requiresBothEdgesOfSameVolley: z.boolean(),
        initialCharges: nonNegativeInteger,
        maxCharges: positiveInteger,
        nextVolleyEdgeEnemyDamageMultiplier: positiveNumber,
        consumeOnNextNormalVolley: z.boolean(),
      })
      .strict(),
  })
  .strict();

export const exProtocolCatalogSchema = z
  .object({
    $schema: z.string().min(1),
    catalogVersion: z.literal("ex-protocols-v1"),
    offerPolicy: z
      .object({
        initial: z.literal("fixed-all-compatible"),
        consumeRng: z.literal(false),
        training: z.literal("disabled"),
        unsupportedWeapon: z.literal("skip-to-limit-break"),
      })
      .strict(),
    progression: z
      .object({
        normalCoreRanks: z.literal(25),
        signatureExLevel: z.literal(0),
        evolutionOneExLevel: z.literal(1),
        evolutionTwoExLevel: z.literal(2),
        masteryUnlock: z.literal("with-evolution-two"),
        limitBreakStartsAtExLevel: z.literal(3),
      })
      .strict(),
    input: z
      .object({
        semanticAction: z.literal("specialPressed"),
        bindings: z.tuple([z.literal("MouseRight"), z.literal("KeyE")]),
        bufferWhileBlocked: z.literal(false),
        specialBeforeNormalShooting: z.literal(true),
      })
      .strict(),
    protocols: z.tuple([
      relayProtocolSchema,
      reboundProtocolSchema,
      redlineProtocolSchema,
      tidalProtocolSchema,
      breakwaterProtocolSchema,
      aegisProtocolSchema,
    ]),
  })
  .strict()
  .superRefine((catalog, context) => {
    const protocolIds = new Set<string>();
    const protocolCountByWeapon = new Map<string, number>();
    for (const [index, protocol] of catalog.protocols.entries()) {
      if (protocolIds.has(protocol.id)) {
        context.addIssue({
          code: "custom",
          message: `Duplicate EX Protocol ID "${protocol.id}".`,
          path: ["protocols", index, "id"],
        });
      }
      protocolIds.add(protocol.id);
      protocolCountByWeapon.set(
        protocol.weaponId,
        (protocolCountByWeapon.get(protocol.weaponId) ?? 0) + 1,
      );
      if (!protocol.id.startsWith(`${protocol.weaponId}.`)) {
        context.addIssue({
          code: "custom",
          message: "Protocol ID must start with its weapon ID.",
          path: ["protocols", index, "id"],
        });
      }
      for (const evolutionKey of ["evolutionOne", "evolutionTwo"] as const) {
        const optionIds = protocol[evolutionKey].map((option) => option.id);
        if (new Set(optionIds).size !== optionIds.length) {
          context.addIssue({
            code: "custom",
            message: `${evolutionKey} option IDs must be unique.`,
            path: ["protocols", index, evolutionKey],
          });
        }
      }
    }
    for (const weaponId of ["pulse", "spread"] as const) {
      if (protocolCountByWeapon.get(weaponId) !== 3) {
        context.addIssue({
          code: "custom",
          message: `Weapon "${weaponId}" must have exactly three Protocols.`,
          path: ["protocols"],
        });
      }
    }
  });

export type ExProtocolCatalog = z.infer<typeof exProtocolCatalogSchema>;
export type ExProtocolDefinition = ExProtocolCatalog["protocols"][number];
export type ExProtocolEvolutionOneId = ExProtocolEvolutionId;
export type ExProtocolEvolutionTwoId = ExProtocolEvolutionId;
export type { ExProtocolEvolutionId, ExProtocolId };

export function parseExProtocolCatalog(input: unknown): ExProtocolCatalog {
  return exProtocolCatalogSchema.parse(input);
}

export const EX_PROTOCOL_CATALOG = parseExProtocolCatalog(rawCatalog);
export const EX_PROTOCOL_CATALOG_VERSION = EX_PROTOCOL_CATALOG.catalogVersion;

export function getCompatibleExProtocols(
  weaponId: WeaponTypeId,
): ExProtocolDefinition[] {
  if (weaponId !== "pulse" && weaponId !== "spread") return [];
  return EX_PROTOCOL_CATALOG.protocols.filter(
    (protocol) => protocol.weaponId === weaponId,
  );
}

export function getExProtocolDefinition(
  protocolId: string,
): ExProtocolDefinition | null {
  return (
    EX_PROTOCOL_CATALOG.protocols.find(
      (protocol) => protocol.id === protocolId,
    ) ?? null
  );
}

export function toExProtocolId(protocolId: string): ExProtocolId {
  if (!getExProtocolDefinition(protocolId)) {
    throw new Error(`Unknown EX Protocol ID "${protocolId}".`);
  }
  return protocolId as ExProtocolId;
}

export function toExProtocolEvolutionId(
  protocolId: ExProtocolId,
  tier: "evolutionOne" | "evolutionTwo",
  evolutionId: string,
): ExProtocolEvolutionId {
  const protocol = getExProtocolDefinition(protocolId);
  if (!protocol?.[tier].some((option) => option.id === evolutionId)) {
    throw new Error(
      `Unknown ${tier} ID "${evolutionId}" for Protocol "${protocolId}".`,
    );
  }
  return evolutionId as ExProtocolEvolutionId;
}
