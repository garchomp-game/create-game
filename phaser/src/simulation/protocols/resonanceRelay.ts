import { EX_PROTOCOL_CATALOG } from "../../content/exProtocolCatalog";
import { incrementExProtocolCounter } from "../../domain/exProtocolTelemetry";
import type {
  ResonanceRelayProjectileState,
} from "../../domain/exProtocols";
import type {
  Bullet,
  Enemy,
  GameEvent,
  Vec2,
  WorldState,
} from "../../domain/types";
import { hasClearNavigationPath } from "../navigationField";
import { resolveEnemyDamage } from "../systems/enemyDamageSystem";

export type ResonanceEndpointHit = {
  priorDirectHits: number;
  ricochetsUsed: number;
  stackAfter: number;
  maximumStacks: number;
  endpointSurvived: boolean;
  endpointPositionBeforeHit: Vec2;
};

type RelayCandidate = {
  enemy: Enemy;
  projection: number;
  creationOrdinal: number;
};

export function createResonanceRelayProjectileState(
  world: WorldState,
): ResonanceRelayProjectileState | null {
  const progression = world.progression.exProtocol;
  if (
    progression?.status !== "selected" ||
    progression.runtime.kind !== "resonance-relay"
  ) {
    return null;
  }
  return { kind: "resonance-relay" };
}

export function updateResonanceRelayLifecycle(world: WorldState): void {
  const progression = world.progression.exProtocol;
  if (
    progression?.status !== "selected" ||
    progression.runtime.kind !== "resonance-relay"
  ) {
    return;
  }
  const runtime = progression.runtime;
  const anchor = runtime.anchor;
  if (!anchor) return;
  const anchorEnemy = world.enemies.find(
    (enemy) => enemy.id === anchor.enemyId,
  );
  if (
    world.state.elapsed >= anchor.expiresAt ||
    !anchorEnemy ||
    anchorEnemy.hp <= 0
  ) {
    runtime.anchor = null;
  }
}

export function resolveResonanceAfterNormalHit(
  world: WorldState,
  bullet: Bullet,
  endpoint: Enemy,
  hit: ResonanceEndpointHit,
  deadEnemies: Set<Enemy>,
  events: GameEvent[],
): void {
  const progression = world.progression.exProtocol;
  if (
    progression?.status !== "selected" ||
    progression.runtime.kind !== "resonance-relay" ||
    bullet.candidate?.protocolState?.kind !== "resonance-relay" ||
    bullet.candidate.volleyKind !== "normal"
  ) {
    return;
  }
  updateResonanceRelayLifecycle(world);
  const runtime = progression.runtime;
  const priorAnchor = runtime.anchor;
  const anchorEnemy = priorAnchor
    ? world.enemies.find(
        (enemy) => enemy.id === priorAnchor.enemyId && enemy.hp > 0,
      ) ?? null
    : null;
  const endpointEligible =
    anchorEnemy !== null &&
    anchorEnemy.id !== endpoint.id &&
    bullet.volleyId > priorAnchor!.createdByVolleyId &&
    hit.priorDirectHits === 0 &&
    hit.ricochetsUsed === 0;

  if (endpointEligible) {
    const anchorPosition = { ...anchorEnemy.position };
    const endpointPosition = { ...hit.endpointPositionBeforeHit };
    const definition = EX_PROTOCOL_CATALOG.protocols[0];
    const blocked = !hasClearNavigationPath(
      anchorPosition,
      endpointPosition,
      definition.signature.relayHalfWidthPx,
      world.obstacles,
    );
    if (blocked) {
      events.push({
        type: "ex.relay.blocked",
        anchorEnemyId: anchorEnemy.id,
        endpointEnemyId: endpoint.id,
        elapsed: world.state.elapsed,
      });
      return;
    }

    const candidates = findRelayCandidates(
      world,
      bullet,
      anchorEnemy,
      endpoint,
      anchorPosition,
      endpointPosition,
      definition.signature.relayHalfWidthPx,
    );
    const denseConduit = definition.evolutionOne[1];
    const maximumTargets =
      progression.route.evolutionOneId === denseConduit.id
        ? denseConduit.maxIntermediateTargets
        : definition.signature.maxIntermediateTargets;
    const damageMultiplier =
      progression.route.masteryUnlocked &&
      candidates.length >=
        definition.mastery.minimumEligibleIntermediateTargets
        ? definition.mastery.damageMultiplier
        : definition.signature.damageMultiplier;
    const activationId = runtime.nextActivationId++;
    let totalDamage = 0;
    for (const candidate of candidates.slice(0, maximumTargets)) {
      const outcome = resolveEnemyDamage(
        world,
        candidate.enemy,
        {
          amount: bullet.damage * damageMultiplier,
          baselineWithoutAnyProtocol: 0,
          baselineForEffectAttribution: 0,
          source: {
            kind: "ex-protocol",
            protocolId: runtime.protocolId,
            activationId,
            effect: "relay",
            weaponType: bullet.weaponType,
          },
        },
        deadEnemies,
        events,
      );
      totalDamage += outcome.damage;
    }

    const residualAnchor = definition.evolutionTwo[0];
    const anchorFocusBeforeReset = anchorEnemy.pulseFocusStacks ?? 0;
    anchorEnemy.pulseFocusStacks =
      progression.route.evolutionTwoId === residualAnchor.id
        ? residualAnchor.remainingAnchorFocusStacks
        : definition.signature.resetAnchorFocusStacks;
    incrementExProtocolCounter(
      world.stats.exProtocolMetrics,
      "focusStacksConsumed",
      Math.max(
        0,
        anchorFocusBeforeReset - (anchorEnemy.pulseFocusStacks ?? 0),
      ),
    );
    runtime.anchor = null;

    const endpointPriming = definition.evolutionTwo[1];
    if (
      hit.endpointSurvived &&
      progression.route.evolutionTwoId === endpointPriming.id
    ) {
      endpoint.pulseFocusStacks = Math.min(
        hit.maximumStacks,
        (endpoint.pulseFocusStacks ?? 0) +
          endpointPriming.endpointBonusFocusStacks,
      );
    }
    events.push({
      type: "ex.relay.resolved",
      activationId,
      targetCount: Math.min(candidates.length, maximumTargets),
      damage: totalDamage,
      elapsed: world.state.elapsed,
    });
    if (
      hit.endpointSurvived &&
      hit.maximumStacks > 0 &&
      (endpoint.pulseFocusStacks ?? hit.stackAfter) >= hit.maximumStacks
    ) {
      commitAnchor(world, bullet, endpoint, events, false);
    }
    return;
  }

  if (
    priorAnchor &&
    priorAnchor.createdByVolleyId === bullet.volleyId &&
    priorAnchor.enemyId !== endpoint.id
  ) {
    return;
  }
  if (
    hit.endpointSurvived &&
    hit.maximumStacks > 0 &&
    hit.stackAfter >= hit.maximumStacks &&
    hit.ricochetsUsed === 0
  ) {
    commitAnchor(
      world,
      bullet,
      endpoint,
      events,
      priorAnchor?.enemyId === endpoint.id,
    );
  }
}

function commitAnchor(
  world: WorldState,
  bullet: Bullet,
  enemy: Enemy,
  events: GameEvent[],
  refreshed: boolean,
): void {
  const progression = world.progression.exProtocol;
  if (
    progression?.status !== "selected" ||
    progression.runtime.kind !== "resonance-relay"
  ) {
    return;
  }
  const definition = EX_PROTOCOL_CATALOG.protocols[0];
  const extendedCoupling = definition.evolutionOne[0];
  const lifetime =
    progression.route.evolutionOneId === extendedCoupling.id
      ? extendedCoupling.anchorLifetimeSeconds
      : definition.signature.anchorLifetimeSeconds;
  const expiresAt = world.state.elapsed + lifetime;
  progression.runtime.anchor = {
    enemyId: enemy.id,
    expiresAt,
    createdByVolleyId: bullet.volleyId,
  };
  events.push({
    type: "ex.relay.anchor.created",
    enemyId: enemy.id,
    volleyId: bullet.volleyId,
    refreshed,
    expiresAt,
    elapsed: world.state.elapsed,
  });
}

function findRelayCandidates(
  world: WorldState,
  bullet: Bullet,
  anchor: Enemy,
  endpoint: Enemy,
  start: Vec2,
  end: Vec2,
  halfWidth: number,
): RelayCandidate[] {
  const candidates: RelayCandidate[] = [];
  for (const enemy of world.enemies) {
    if (
      enemy === anchor ||
      enemy === endpoint ||
      enemy.hp <= 0 ||
      enemy.boss ||
      bullet.hitEnemyIds.includes(enemy.id)
    ) {
      continue;
    }
    const projection = projectPointOntoSegment(enemy.position, start, end);
    if (
      projection.t <= 0 ||
      projection.t >= 1 ||
      projection.distance > halfWidth + enemy.radius
    ) {
      continue;
    }
    candidates.push({
      enemy,
      projection: projection.t,
      creationOrdinal:
        enemy.candidate?.creationOrdinal ?? Number.MAX_SAFE_INTEGER,
    });
  }
  candidates.sort(
    (left, right) =>
      left.projection - right.projection ||
      left.creationOrdinal - right.creationOrdinal,
  );
  return candidates;
}

function projectPointOntoSegment(
  point: Vec2,
  start: Vec2,
  end: Vec2,
): { t: number; distance: number } {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const lengthSquared = dx * dx + dy * dy;
  if (lengthSquared <= Number.EPSILON) {
    return {
      t: 0,
      distance: Math.hypot(point.x - start.x, point.y - start.y),
    };
  }
  const t =
    ((point.x - start.x) * dx + (point.y - start.y) * dy) /
    lengthSquared;
  const projected = {
    x: start.x + dx * t,
    y: start.y + dy * t,
  };
  return {
    t,
    distance: Math.hypot(point.x - projected.x, point.y - projected.y),
  };
}
