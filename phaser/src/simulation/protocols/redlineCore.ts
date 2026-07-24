import { EX_PROTOCOL_CATALOG } from "../../content/exProtocolCatalog";
import type {
  ExProtocolId,
  RedlineCoreProjectileState,
} from "../../domain/exProtocols";
import type {
  Bullet,
  Enemy,
  WorldState,
} from "../../domain/types";

export type RedlineDamageResolution = {
  damage: number;
  baselineWithoutAnyProtocol: number;
  baselineForEffectAttribution: number;
  attribution:
    | "normal"
    | "protocol-modified-normal"
    | "protocol-restored-capacity";
  effectDetail:
    | "redline-restored-capacity"
    | "redline-mastery"
    | null;
  protocolId: ExProtocolId;
  redlineEvent: {
    totalDamage: number;
    bonusDamageAttributed: number;
  } | null;
};

export function createRedlineProjectileState(
  world: WorldState,
): RedlineCoreProjectileState | null {
  const progression = world.progression.exProtocol;
  if (
    progression?.status !== "selected" ||
    progression.runtime.kind !== "redline-core"
  ) {
    return null;
  }
  return {
    kind: "redline-core",
    capacityRestored: false,
    redlineResolvedDamage: null,
    masteryExtraHitConsumed: false,
  };
}

export function resolveRedlineDamage(
  world: WorldState,
  bullet: Bullet,
  enemy: Enemy,
  ricochetsUsed: number,
  stackBefore: number,
  stackAfter: number,
  normalResolvedDamage: number,
): RedlineDamageResolution | null {
  const progression = world.progression.exProtocol;
  const candidate = bullet.candidate;
  const projectileState = candidate?.protocolState;
  if (
    progression?.status !== "selected" ||
    progression.runtime.kind !== "redline-core" ||
    !candidate ||
    projectileState?.kind !== "redline-core"
  ) {
    return null;
  }

  const definition = EX_PROTOCOL_CATALOG.protocols[2];
  const protocolId = progression.route.protocolId;
  const restoredCapacityHit =
    bullet.hitEnemyIds.length >= candidate.hitCapacityAtFire &&
    projectileState.capacityRestored;
  if (restoredCapacityHit) {
    const masteryExtraHit =
      progression.route.masteryUnlocked &&
      projectileState.redlineResolvedDamage !== null &&
      !projectileState.masteryExtraHitConsumed &&
      !enemy.boss;
    if (masteryExtraHit) {
      projectileState.masteryExtraHitConsumed = true;
    }
    const damage = masteryExtraHit
      ? projectileState.redlineResolvedDamage! *
        definition.mastery.extraCapacityHitDamageMultiplier
      : normalResolvedDamage;
    return {
      damage,
      baselineWithoutAnyProtocol: 0,
      baselineForEffectAttribution: 0,
      attribution: "protocol-restored-capacity",
      effectDetail: masteryExtraHit
        ? "redline-mastery"
        : "redline-restored-capacity",
      protocolId,
      redlineEvent: {
        totalDamage: damage,
        bonusDamageAttributed: 0,
      },
    };
  }

  const qualifiesForRedline =
    ricochetsUsed === 0 &&
    world.runtime.pulseFocusMaxStacks > 0 &&
    (definition.signature.requiresStackBeforeAtMaximum
      ? stackBefore
      : stackAfter) >= world.runtime.pulseFocusMaxStacks;
  if (!qualifiesForRedline) {
    return {
      damage: normalResolvedDamage,
      baselineWithoutAnyProtocol: normalResolvedDamage,
      baselineForEffectAttribution: normalResolvedDamage,
      attribution: "normal",
      effectDetail: null,
      protocolId,
      redlineEvent: null,
    };
  }

  const overpressure = definition.evolutionOne[1];
  const multiplier =
    progression.route.evolutionOneId === overpressure.id
      ? overpressure.redlineDamageMultiplier
      : definition.signature.redlineDamageMultiplier;
  const damage = normalResolvedDamage * multiplier;
  if (!projectileState.capacityRestored) {
    const deepBore = definition.evolutionTwo[1];
    const restoredCapacity =
      progression.route.evolutionTwoId === deepBore.id
        ? deepBore.capacityRestore
        : definition.signature.capacityRestore;
    bullet.hitsRemaining += restoredCapacity;
    projectileState.capacityRestored = true;
    projectileState.redlineResolvedDamage = damage;
  }
  return {
    damage,
    baselineWithoutAnyProtocol: normalResolvedDamage,
    baselineForEffectAttribution: normalResolvedDamage,
    attribution: "protocol-modified-normal",
    effectDetail: null,
    protocolId,
    redlineEvent: {
      totalDamage: damage,
      bonusDamageAttributed: Math.max(0, damage - normalResolvedDamage),
    },
  };
}

export function getRedlineFocusDurationBonus(world: WorldState): number {
  const progression = world.progression.exProtocol;
  if (
    progression?.status !== "selected" ||
    progression.runtime.kind !== "redline-core"
  ) {
    return 0;
  }
  const definition = EX_PROTOCOL_CATALOG.protocols[2];
  const longBurn = definition.evolutionTwo[0];
  return progression.route.evolutionTwoId === longBurn.id
    ? longBurn.focusDurationBonusSeconds
    : 0;
}
