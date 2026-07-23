import {
  incrementExProtocolCounter,
  setExProtocolCounter,
  type ExSpecialRejectReason,
} from "../../domain/exProtocolTelemetry";
import type { ExProtocolId } from "../../domain/exProtocols";
import type {
  GameEvent,
  WorldState,
} from "../../domain/types";
import { EX_PROTOCOL_CATALOG } from "../../content/exProtocolCatalog";

export type ExProtocolDamageAttributionInput = {
  damage: number;
  hpBefore: number;
  killed: boolean;
  baselineWithoutAnyProtocol: number;
  baselineForEffectAttribution: number;
  protocolId: ExProtocolId | null;
  attribution:
    | "normal"
    | "protocol-modified-normal"
    | "protocol-restored-capacity"
    | "protocol-volley"
    | "protocol-source"
    | "uncredited-penalty";
  effectDetail?: ExProtocolDamageEffectDetail;
};

export type ExProtocolDamageEffectDetail =
  | "rebound-restored-capacity"
  | "rebound-return-surge"
  | "redline-restored-capacity"
  | "redline-mastery"
  | "aegis-perfect-guard";

export function recordExProtocolDamageOutcome(
  world: WorldState,
  input: ExProtocolDamageAttributionInput,
): void {
  if (input.damage <= 0) return;
  const stats = world.stats.exProtocolMetrics;
  stats.totalPlayerDamage += input.damage;
  if (!input.protocolId || input.attribution === "normal") return;

  const sourceOnly =
    input.attribution === "protocol-restored-capacity" ||
    input.attribution === "protocol-volley" ||
    input.attribution === "protocol-source";
  const modifiedNormal = input.attribution === "protocol-modified-normal";
  if (sourceOnly) {
    stats.protocolSourceDamage += input.damage;
  } else if (modifiedNormal) {
    stats.protocolBonusDamageAttributed += Math.max(
      0,
      input.damage - input.baselineForEffectAttribution,
    );
  }

  if (input.killed) {
    if (input.baselineWithoutAnyProtocol === 0) {
      stats.protocolSourceKills += 1;
    } else if (
      input.hpBefore > input.baselineWithoutAnyProtocol &&
      input.hpBefore <= input.damage
    ) {
      stats.protocolBonusFinisherKills += 1;
    }
  }

  if (input.effectDetail === "rebound-restored-capacity") {
    incrementExProtocolCounter(
      stats,
      "restoredCapacityHitDamage",
      input.damage,
    );
  } else if (input.effectDetail === "rebound-return-surge") {
    incrementExProtocolCounter(
      stats,
      "returnSurgeBonusDamage",
      Math.max(0, input.damage - input.baselineForEffectAttribution),
    );
  } else if (input.effectDetail === "redline-restored-capacity") {
    incrementExProtocolCounter(stats, "capacityRestored");
  } else if (input.effectDetail === "redline-mastery") {
    incrementExProtocolCounter(stats, "masteryHits");
    incrementExProtocolCounter(stats, "masterySourceDamage", input.damage);
  } else if (input.effectDetail === "aegis-perfect-guard") {
    incrementExProtocolCounter(
      stats,
      "perfectGuardBonusDamage",
      Math.max(0, input.damage - input.baselineForEffectAttribution),
    );
  }
}

export function recordExProtocolEvent(
  world: WorldState,
  event: GameEvent,
): void {
  const stats = world.stats.exProtocolMetrics;
  if (event.type === "ex.protocol.offered") {
    stats.offeredIds = [...event.choices];
    incrementExProtocolCounter(stats, "choiceCountProtocol");
  } else if (event.type === "ex.protocol.selected") {
    stats.selectedId = event.protocolId;
    stats.selectedAtElapsed = event.elapsed;
  } else if (event.type === "ex.evolution.offered") {
    incrementExProtocolCounter(stats, "choiceCountEvolution");
  } else if (event.type === "ex.evolution.selected") {
    if (event.tier === 1) {
      stats.evolutionOneId = event.evolutionId;
      stats.evolutionOneAtElapsed = event.elapsed;
    } else {
      stats.evolutionTwoId = event.evolutionId;
      stats.evolutionTwoAtElapsed = event.elapsed;
    }
  } else if (event.type === "ex.mastery.unlocked") {
    stats.masteryId = event.masteryId;
    stats.masteryAtElapsed = event.elapsed;
  } else if (event.type === "ex.limit_break.connected") {
    stats.limitBreakFirstAtElapsed ??= event.elapsed;
  } else if (event.type === "ex.special.rejected") {
    stats.specialPresses += 1;
    const reason = event.reason as ExSpecialRejectReason;
    stats.specialRejectedByReason[reason] =
      (stats.specialRejectedByReason[reason] ?? 0) + 1;
    if (
      event.protocolId === "spread.breakwater-fan" &&
      event.reason === "insufficient-hp"
    ) {
      incrementExProtocolCounter(stats, "insufficientHpRejects");
    }
  } else if (
    event.type === "ex.special.armed" ||
    event.type === "ex.special.activated"
  ) {
    recordAcceptedSpecial(world, event.elapsed);
    if (
      event.type === "ex.special.armed" &&
      event.protocolId === "pulse.rebound-overdrive"
    ) {
      incrementExProtocolCounter(stats, "arms");
    }
    if (
      event.type === "ex.special.activated" &&
      event.protocolId === "spread.full-span-tidal-sweep"
    ) {
      incrementExProtocolCounter(stats, "activations");
    } else if (
      event.type === "ex.special.activated" &&
      event.protocolId === "spread.breakwater-fan"
    ) {
      incrementExProtocolCounter(stats, "activations");
    }
  } else if (
    event.type === "ex.special.expired" &&
    event.protocolId === "pulse.rebound-overdrive"
  ) {
    incrementExProtocolCounter(stats, "armExpired");
  } else if (event.type === "ex.relay.anchor.created") {
    incrementExProtocolCounter(stats, "anchorsCreated");
  } else if (event.type === "ex.relay.blocked") {
    incrementExProtocolCounter(stats, "relayAttempts");
    incrementExProtocolCounter(stats, "relayBlocked");
  } else if (event.type === "ex.relay.resolved") {
    incrementExProtocolCounter(stats, "relayAttempts");
    incrementExProtocolCounter(stats, "relayResolved");
    incrementExProtocolCounter(stats, "relayTargets", event.targetCount);
    incrementExProtocolCounter(stats, "relayDamage", event.damage);
  } else if (event.type === "ex.rebound.restored") {
    incrementExProtocolCounter(stats, "ricochetsRestored");
    incrementExProtocolCounter(
      stats,
      "restoredCapacity",
      event.restoredCapacity,
    );
  } else if (event.type === "ex.rebound.cooldown.refunded") {
    incrementExProtocolCounter(stats, "masteryRefunds");
  } else if (event.type === "ex.redline.hit") {
    incrementExProtocolCounter(stats, "redlineHits");
    incrementExProtocolCounter(
      stats,
      "redlineBonusDamage",
      event.bonusDamageAttributed,
    );
  } else if (event.type === "ex.tidal.charged") {
    incrementExProtocolCounter(stats, "chargeEvents");
  } else if (event.type === "ex.tidal.backwash.triggered") {
    incrementExProtocolCounter(stats, "backwashTriggers");
  } else if (event.type === "ex.tidal.second-crest.triggered") {
    incrementExProtocolCounter(stats, "secondCrestTriggers");
  } else if (
    event.type === "ex.protocol.volley.fired" &&
    event.protocolId === "spread.full-span-tidal-sweep"
  ) {
    // Activation count comes from ex.special.activated. This event verifies the
    // emitted projectile set without double-counting the input.
  } else if (
    event.type === "enemy.protocol.hit" &&
    event.source.effect === "tidal"
  ) {
    incrementExProtocolCounter(stats, "activationTargets");
    incrementExProtocolCounter(stats, "tidalDamage", event.damage);
  } else if (event.type === "ex.breakwater.charged") {
    incrementExProtocolCounter(stats, "chargeEvents");
  } else if (event.type === "player.integrity.spent") {
    incrementExProtocolCounter(stats, "hpSpent", event.amount);
  } else if (event.type === "ex.breakwater.resolved") {
    incrementExProtocolCounter(
      stats,
      "affectedTargets",
      event.targetCount,
    );
    incrementExProtocolCounter(
      stats,
      "pushedTargets",
      event.pushedTargets,
    );
    incrementExProtocolCounter(
      stats,
      "breakwaterDamage",
      event.damage,
    );
  } else if (event.type === "ex.breakwater.escape-current.triggered") {
    incrementExProtocolCounter(stats, "escapeCurrentTriggers");
  } else if (event.type === "ex.aegis.intercepted") {
    incrementExProtocolCounter(stats, "intercepts");
    incrementExProtocolCounter(
      stats,
      event.side === "left" ? "leftInterceptions" : "rightInterceptions",
    );
    if (event.plannedPlayerEndpointContact) {
      incrementExProtocolCounter(
        stats,
        "interceptedWithPlannedPlayerEndpointContact",
      );
    }
  } else if (event.type === "ex.aegis.perfect-guard.charged") {
    incrementExProtocolCounter(stats, "perfectGuardCharges");
  } else if (event.type === "ex.aegis.empowered.volley") {
    incrementExProtocolCounter(stats, "empoweredVolleys");
  }
}

export function refreshExProtocolExposureStats(world: WorldState): void {
  const stats = world.stats.exProtocolMetrics;
  const elapsed = world.state.elapsed;
  setExposure(
    stats,
    "protocolExposureSeconds",
    stats.selectedAtElapsed,
    elapsed,
  );
  setExposure(
    stats,
    "evolutionOneExposureSeconds",
    stats.evolutionOneAtElapsed,
    elapsed,
  );
  setExposure(
    stats,
    "evolutionTwoExposureSeconds",
    stats.evolutionTwoAtElapsed,
    elapsed,
  );
  setExposure(
    stats,
    "masteryExposureSeconds",
    stats.masteryAtElapsed,
    elapsed,
  );

  const progression = world.progression.exProtocol;
  if (
    progression?.status === "selected" &&
    progression.runtime.kind === "redline-core"
  ) {
    const definition = EX_PROTOCOL_CATALOG.protocols[2];
    const stabilized = definition.evolutionOne[0];
    const effectiveMultiplier =
      progression.route.evolutionOneId === stabilized.id
        ? stabilized.effectiveMaxHpMultiplier
        : definition.signature.effectiveMaxHpMultiplier;
    const grossMaxHp = progression.runtime.grossMaxHpAtSelection;
    const effectiveMaxHp = Math.max(
      1,
      Math.floor(grossMaxHp * effectiveMultiplier),
    );
    setExProtocolCounter(
      stats,
      "hpReservedPeak",
      Math.max(
        stats.counters.hpReservedPeak ?? 0,
        grossMaxHp - effectiveMaxHp,
      ),
    );
  } else if (
    progression?.status === "selected" &&
    progression.runtime.kind === "full-span-tidal-sweep"
  ) {
    setExProtocolCounter(
      stats,
      "chargeAtRunEnd",
      progression.runtime.charges,
    );
  }
}

function recordAcceptedSpecial(world: WorldState, elapsed: number): void {
  const stats = world.stats.exProtocolMetrics;
  stats.specialPresses += 1;
  stats.specialAccepted += 1;
  if (stats.lastAcceptedSpecialAtElapsed !== null) {
    const interval = Math.max(
      0,
      elapsed - stats.lastAcceptedSpecialAtElapsed,
    );
    stats.activeUseIntervalCount += 1;
    stats.activeUseIntervalSumSeconds += interval;
    stats.activeUseIntervalMaxSeconds = Math.max(
      stats.activeUseIntervalMaxSeconds,
      interval,
    );
  }
  stats.lastAcceptedSpecialAtElapsed = elapsed;
}

function setExposure(
  stats: WorldState["stats"]["exProtocolMetrics"],
  key:
    | "protocolExposureSeconds"
    | "evolutionOneExposureSeconds"
    | "evolutionTwoExposureSeconds"
    | "masteryExposureSeconds",
  startedAt: number | null,
  elapsed: number,
): void {
  setExProtocolCounter(
    stats,
    key,
    startedAt === null ? 0 : Math.max(0, elapsed - startedAt),
  );
}
