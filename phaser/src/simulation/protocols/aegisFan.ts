import { EX_PROTOCOL_CATALOG } from "../../content/exProtocolCatalog";
import type {
  AegisFanProjectileState,
  ExProtocolId,
} from "../../domain/exProtocols";
import type {
  Bullet,
  GameEvent,
  WorldState,
} from "../../domain/types";

export type AegisVolleyPlan = {
  createProjectileState: (
    projectileIndex: number,
    baseDamage: number,
  ) => AegisFanProjectileState | null;
  getDamageMultiplier: (projectileIndex: number) => number;
};

export type AegisDamageResolution = {
  damage: number;
  baselineWithoutAnyProtocol: number;
  baselineForEffectAttribution: number;
  attribution: "protocol-modified-normal" | "uncredited-penalty";
  protocolId: ExProtocolId;
};

export function isAegisFanSelected(world: WorldState): boolean {
  const progression = world.progression.exProtocol;
  return (
    progression?.status === "selected" &&
    progression.runtime.kind === "aegis-fan"
  );
}

export function prepareAegisVolley(
  world: WorldState,
  volleyId: number,
  projectileCount: number,
  events: GameEvent[],
): AegisVolleyPlan | null {
  const progression = world.progression.exProtocol;
  if (
    progression?.status !== "selected" ||
    progression.runtime.kind !== "aegis-fan" ||
    world.state.weaponType !== "spread" ||
    projectileCount < 2
  ) {
    return null;
  }
  const definition = EX_PROTOCOL_CATALOG.protocols[5];
  const restoredEdge = definition.evolutionOne[0];
  const normalEdgeMultiplier =
    progression.route.evolutionOneId === restoredEdge.id
      ? restoredEdge.edgeEnemyDamageMultiplier
      : definition.signature.edgeEnemyDamageMultiplier;
  const empowered =
    progression.route.masteryUnlocked &&
    progression.runtime.perfectGuardCharges > 0;
  if (empowered) {
    progression.runtime.perfectGuardCharges -= 1;
    events.push({
      type: "ex.aegis.empowered.volley",
      volleyId,
      elapsed: world.state.elapsed,
    });
  }
  const actualEdgeMultiplier = empowered
    ? definition.mastery.nextVolleyEdgeEnemyDamageMultiplier
    : normalEdgeMultiplier;

  return {
    createProjectileState: (projectileIndex, baseDamage) => {
      const side = getEdgeSide(projectileIndex, projectileCount);
      if (!side) return null;
      return {
        kind: "aegis-fan",
        side,
        interceptsRemaining:
          definition.signature.interceptsPerEdgeProjectile,
        empowered,
        baselineWithoutAnyProtocolDamage: baseDamage,
        baselineForEffectAttributionDamage:
          baseDamage * normalEdgeMultiplier,
      };
    },
    getDamageMultiplier: (projectileIndex) =>
      getEdgeSide(projectileIndex, projectileCount)
        ? actualEdgeMultiplier
        : 1,
  };
}

export function resolveAegisDamage(
  world: WorldState,
  bullet: Bullet,
  resolvedDamage: number,
): AegisDamageResolution | null {
  const progression = world.progression.exProtocol;
  const state = bullet.candidate?.protocolState;
  if (
    progression?.status !== "selected" ||
    progression.runtime.kind !== "aegis-fan" ||
    state?.kind !== "aegis-fan"
  ) {
    return null;
  }
  return {
    damage: resolvedDamage,
    baselineWithoutAnyProtocol:
      state.baselineWithoutAnyProtocolDamage,
    baselineForEffectAttribution:
      state.baselineForEffectAttributionDamage,
    attribution: state.empowered
      ? "protocol-modified-normal"
      : "uncredited-penalty",
    protocolId: progression.route.protocolId,
  };
}

export function getAegisInterceptionRadiusBonus(
  world: WorldState,
): number {
  const progression = world.progression.exProtocol;
  if (
    progression?.status !== "selected" ||
    progression.runtime.kind !== "aegis-fan"
  ) {
    return 0;
  }
  const broadIntercept = EX_PROTOCOL_CATALOG.protocols[5].evolutionOne[1];
  return progression.route.evolutionOneId === broadIntercept.id
    ? broadIntercept.interceptionRadiusBonusPx
    : 0;
}

export function shouldAegisProjectileSurviveIntercept(
  world: WorldState,
): boolean {
  const progression = world.progression.exProtocol;
  if (
    progression?.status !== "selected" ||
    progression.runtime.kind !== "aegis-fan"
  ) {
    return false;
  }
  const carryThrough = EX_PROTOCOL_CATALOG.protocols[5].evolutionTwo[0];
  return progression.route.evolutionTwoId === carryThrough.id;
}

export function recordAegisInterception(
  world: WorldState,
  bullet: Bullet,
  events: GameEvent[],
): void {
  const progression = world.progression.exProtocol;
  const state = bullet.candidate?.protocolState;
  if (
    progression?.status !== "selected" ||
    progression.runtime.kind !== "aegis-fan" ||
    state?.kind !== "aegis-fan"
  ) {
    return;
  }
  const guardMomentum = EX_PROTOCOL_CATALOG.protocols[5].evolutionTwo[1];
  if (progression.route.evolutionTwoId === guardMomentum.id) {
    progression.runtime.guardMomentumUntil =
      world.state.elapsed + guardMomentum.durationSeconds;
  }
  const volley = world.analytics.activeVolleys[bullet.volleyId];
  if (!volley) return;
  const sides = (volley.aegisInterceptedSides ??= []);
  if (!sides.includes(state.side)) sides.push(state.side);
  if (
    !progression.route.masteryUnlocked ||
    volley.aegisPerfectGuardGranted ||
    !sides.includes("left") ||
    !sides.includes("right")
  ) {
    return;
  }
  volley.aegisPerfectGuardGranted = true;
  const maximumCharges =
    EX_PROTOCOL_CATALOG.protocols[5].mastery.maxCharges;
  if (progression.runtime.perfectGuardCharges >= maximumCharges) return;
  progression.runtime.perfectGuardCharges += 1;
  events.push({
    type: "ex.aegis.perfect-guard.charged",
    charge: progression.runtime.perfectGuardCharges,
    elapsed: world.state.elapsed,
  });
}

export function getAegisMovementMultiplier(
  world: WorldState,
): number {
  const progression = world.progression.exProtocol;
  if (
    progression?.status !== "selected" ||
    progression.runtime.kind !== "aegis-fan" ||
    world.state.elapsed >= progression.runtime.guardMomentumUntil
  ) {
    return 1;
  }
  return EX_PROTOCOL_CATALOG.protocols[5].evolutionTwo[1]
    .moveSpeedMultiplier;
}

function getEdgeSide(
  projectileIndex: number,
  projectileCount: number,
): "left" | "right" | null {
  if (projectileCount < 2) return null;
  if (projectileIndex === 0) return "left";
  if (projectileIndex === projectileCount - 1) return "right";
  return null;
}
