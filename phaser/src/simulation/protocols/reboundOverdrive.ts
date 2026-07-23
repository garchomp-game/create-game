import { EX_PROTOCOL_CATALOG } from "../../content/exProtocolCatalog";
import type {
  ReboundOverdriveProjectileState,
} from "../../domain/exProtocols";
import type {
  Bullet,
  Enemy,
  GameEvent,
  WorldState,
} from "../../domain/types";

export type ReboundVolleyPlan = {
  createProjectileState: () => ReboundOverdriveProjectileState;
  ricochetCapacityBonus: number;
};

export type ReboundDamageResolution = {
  damage: number;
  baselineWithoutAnyProtocol: number;
  baselineForEffectAttribution: number;
  attribution: "normal" | "protocol-restored-capacity";
  protocolId: Extract<
    WorldState["progression"]["exProtocol"],
    { status: "selected" }
  >["route"]["protocolId"];
};

export function updateReboundLifecycle(
  world: WorldState,
  specialPressed: boolean,
  events: GameEvent[],
): void {
  const progression = world.progression.exProtocol;
  if (
    progression?.status !== "selected" ||
    progression.runtime.kind !== "rebound-overdrive"
  ) {
    return;
  }
  const runtime = progression.runtime;
  if (
    runtime.armedUntil !== null &&
    world.state.elapsed > runtime.armedUntil
  ) {
    runtime.armedUntil = null;
    events.push({
      type: "ex.special.expired",
      protocolId: runtime.protocolId,
      reason: "no-volley",
      elapsed: world.state.elapsed,
    });
  }
  if (
    runtime.armedVolleyId !== null &&
    !world.bullets.some(
      (bullet) => bullet.volleyId === runtime.armedVolleyId,
    )
  ) {
    runtime.armedVolleyId = null;
  }
  if (!specialPressed) return;

  if (runtime.armedUntil !== null) {
    events.push({
      type: "ex.special.rejected",
      protocolId: runtime.protocolId,
      reason: "already-armed",
      elapsed: world.state.elapsed,
    });
    return;
  }
  if (world.state.elapsed < runtime.cooldownUntil) {
    events.push({
      type: "ex.special.rejected",
      protocolId: runtime.protocolId,
      reason: "cooldown",
      elapsed: world.state.elapsed,
    });
    return;
  }

  const definition = EX_PROTOCOL_CATALOG.protocols[1];
  const rapidChamber = definition.evolutionOne[0];
  const cooldown =
    progression.route.evolutionOneId === rapidChamber.id
      ? rapidChamber.cooldownSeconds
      : definition.signature.cooldownSeconds;
  runtime.armedUntil =
    world.state.elapsed + definition.signature.armDurationSeconds;
  runtime.cooldownUntil = world.state.elapsed + cooldown;
  events.push({
    type: "ex.special.armed",
    protocolId: runtime.protocolId,
    elapsed: world.state.elapsed,
  });
}

export function prepareReboundVolley(
  world: WorldState,
  volleyId: number,
): ReboundVolleyPlan | null {
  const progression = world.progression.exProtocol;
  if (
    progression?.status !== "selected" ||
    progression.runtime.kind !== "rebound-overdrive" ||
    progression.runtime.armedUntil === null ||
    world.state.elapsed > progression.runtime.armedUntil
  ) {
    return null;
  }

  const definition = EX_PROTOCOL_CATALOG.protocols[1];
  const doubleReflection = definition.evolutionTwo[0];
  progression.runtime.armedUntil = null;
  progression.runtime.armedVolleyId = volleyId;
  return {
    createProjectileState: () => ({
      kind: "rebound-overdrive",
      capacityRestored: false,
      postRicochet: false,
    }),
    ricochetCapacityBonus:
      progression.route.evolutionTwoId === doubleReflection.id
        ? doubleReflection.armedVolleyRicochetCapacityBonus
        : 0,
  };
}

export function restoreReboundCapacityAfterRicochet(
  world: WorldState,
  bullet: Bullet,
  events: GameEvent[],
): void {
  const progression = world.progression.exProtocol;
  const state = bullet.candidate?.protocolState;
  if (
    progression?.status !== "selected" ||
    progression.runtime.kind !== "rebound-overdrive" ||
    state?.kind !== "rebound-overdrive" ||
    state.capacityRestored
  ) {
    return;
  }

  const definition = EX_PROTOCOL_CATALOG.protocols[1];
  const deepReturn = definition.evolutionOne[1];
  const capacityBonus =
    progression.route.evolutionOneId === deepReturn.id
      ? deepReturn.capacityBonus
      : definition.signature.capacityBonus;
  const targetCapacity =
    bullet.candidate!.hitCapacityAtFire + capacityBonus;
  const before = bullet.hitsRemaining;
  bullet.hitsRemaining = Math.max(before, targetCapacity);
  state.capacityRestored = true;
  state.postRicochet = true;
  events.push({
    type: "ex.rebound.restored",
    volleyId: bullet.volleyId,
    restoredCapacity: bullet.hitsRemaining - before,
    elapsed: world.state.elapsed,
  });
}

export function resolveReboundDamage(
  world: WorldState,
  bullet: Bullet,
  normalResolvedDamage: number,
): ReboundDamageResolution | null {
  const progression = world.progression.exProtocol;
  const candidate = bullet.candidate;
  const state = candidate?.protocolState;
  if (
    progression?.status !== "selected" ||
    progression.runtime.kind !== "rebound-overdrive" ||
    !candidate ||
    state?.kind !== "rebound-overdrive" ||
    !state.postRicochet
  ) {
    return null;
  }
  const definition = EX_PROTOCOL_CATALOG.protocols[1];
  const returnSurge = definition.evolutionTwo[1];
  const multiplier =
    progression.route.evolutionTwoId === returnSurge.id
      ? returnSurge.postRicochetDamageMultiplier
      : 1;
  const damage = normalResolvedDamage * multiplier;
  const restoredCapacityHit =
    bullet.hitEnemyIds.length >= candidate.hitCapacityAtFire;
  return {
    damage,
    baselineWithoutAnyProtocol: restoredCapacityHit
      ? 0
      : normalResolvedDamage,
    baselineForEffectAttribution: restoredCapacityHit
      ? 0
      : normalResolvedDamage,
    attribution: restoredCapacityHit
      ? "protocol-restored-capacity"
      : "normal",
    protocolId: progression.route.protocolId,
  };
}

export function recordReboundPostRicochetHit(
  world: WorldState,
  bullet: Bullet,
  enemy: Enemy,
  events: GameEvent[],
): void {
  const progression = world.progression.exProtocol;
  const state = bullet.candidate?.protocolState;
  if (
    progression?.status !== "selected" ||
    progression.runtime.kind !== "rebound-overdrive" ||
    state?.kind !== "rebound-overdrive" ||
    !state.postRicochet
  ) {
    return;
  }
  const volley = world.analytics.activeVolleys[bullet.volleyId];
  if (!volley) return;
  const enemyIds = (volley.reboundPostRicochetEnemyIds ??= []);
  if (!enemyIds.includes(enemy.id)) enemyIds.push(enemy.id);
  if (
    !progression.route.masteryUnlocked ||
    volley.reboundMasteryRefunded ||
    enemyIds.length < EX_PROTOCOL_CATALOG.protocols[1].mastery.uniquePostRicochetHits
  ) {
    return;
  }

  volley.reboundMasteryRefunded = true;
  const remainingBefore = Math.max(
    0,
    progression.runtime.cooldownUntil - world.state.elapsed,
  );
  const remainingAfter =
    remainingBefore *
    EX_PROTOCOL_CATALOG.protocols[1].mastery.remainingCooldownMultiplier;
  progression.runtime.cooldownUntil = world.state.elapsed + remainingAfter;
  events.push({
    type: "ex.rebound.cooldown.refunded",
    volleyId: bullet.volleyId,
    remainingBefore,
    remainingAfter,
    elapsed: world.state.elapsed,
  });
}
