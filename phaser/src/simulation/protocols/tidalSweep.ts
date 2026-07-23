import { EX_PROTOCOL_CATALOG } from "../../content/exProtocolCatalog";
import type {
  Bullet,
  Enemy,
  GameEvent,
  SimulationConfig,
  WorldState,
} from "../../domain/types";
import { getProjectileDirections } from "../systems/shootingSystem";

export function updateTidalLifecycle(world: WorldState): void {
  const progression = world.progression.exProtocol;
  if (
    progression?.status !== "selected" ||
    progression.runtime.kind !== "full-span-tidal-sweep"
  ) {
    return;
  }
  const activeBulletIds = new Set(world.bullets.map((bullet) => bullet.id));
  for (const [activationId, tracker] of Object.entries(
    progression.runtime.activations,
  )) {
    if (
      tracker.projectileIds.some((projectileId) =>
        activeBulletIds.has(projectileId),
      )
    ) {
      continue;
    }
    delete progression.runtime.activations[Number(activationId)];
  }
}

export function activateTidalSweep(
  world: WorldState,
  specialPressed: boolean,
  config: SimulationConfig,
  events: GameEvent[],
): void {
  const progression = world.progression.exProtocol;
  if (
    progression?.status !== "selected" ||
    progression.runtime.kind !== "full-span-tidal-sweep" ||
    !specialPressed
  ) {
    return;
  }
  const runtime = progression.runtime;
  if (runtime.charges <= 0) {
    events.push({
      type: "ex.special.rejected",
      protocolId: runtime.protocolId,
      reason: "not-charged",
      elapsed: world.state.elapsed,
    });
    return;
  }

  const definition = EX_PROTOCOL_CATALOG.protocols[3];
  const wideWake = definition.evolutionOne[0];
  const deepWake = definition.evolutionOne[1];
  const arc =
    progression.route.evolutionOneId === wideWake.id
      ? wideWake.arcRadians
      : definition.signature.arcRadians;
  const hitCapacity =
    progression.route.evolutionOneId === deepWake.id
      ? deepWake.hitCapacity
      : definition.signature.hitCapacity;
  if (world.state.weaponType !== "spread") {
    throw new Error("Tidal Sweep requires the Spread weapon.");
  }
  const activationId = runtime.nextActivationId++;
  const volleyId = world.nextVolleyId++;
  runtime.charges -= 1;
  const directions = getProjectileDirections(
    world.state.lastAim,
    definition.signature.projectileCount,
    arc,
  );
  const projectileIds = createTidalProjectiles(
    world,
    config,
    volleyId,
    activationId,
    directions,
    hitCapacity,
    definition.signature.damageMultiplier,
    definition.signature.speedMultiplier,
    definition.signature.lifetimeMultiplier,
  );
  runtime.activations[activationId] = {
    projectileIds: [...projectileIds],
    hitEnemyIds: [],
    backwashTriggered: false,
    secondCrestTriggered: false,
  };
  events.push({
    type: "ex.special.activated",
    protocolId: runtime.protocolId,
    activationId,
    elapsed: world.state.elapsed,
  });
  events.push({
    type: "ex.protocol.volley.fired",
    protocolId: runtime.protocolId,
    activationId,
    volleyId,
    projectileIds: [...projectileIds],
    projectileCount: projectileIds.length,
    elapsed: world.state.elapsed,
  });
}

export function recordTidalNormalHit(
  world: WorldState,
  bullet: Bullet,
  enemy: Enemy,
  events: GameEvent[],
): void {
  const progression = world.progression.exProtocol;
  const candidate = bullet.candidate;
  if (
    progression?.status !== "selected" ||
    progression.runtime.kind !== "full-span-tidal-sweep" ||
    !candidate ||
    candidate.volleyKind !== "normal"
  ) {
    return;
  }
  const volley = world.analytics.activeVolleys[bullet.volleyId];
  if (!volley) return;
  const enemyIds = (volley.tidalEnemyIds ??= []);
  if (!enemyIds.includes(enemy.id)) enemyIds.push(enemy.id);
  if (candidate.projectileRole === "edge") {
    const edgeIds =
      candidate.projectileIndex === 0
        ? (volley.tidalLeftEdgeEnemyIds ??= [])
        : (volley.tidalRightEdgeEnemyIds ??= []);
    if (!edgeIds.includes(enemy.id)) edgeIds.push(enemy.id);
  }
  if (volley.tidalChargeGranted) return;

  const definition = EX_PROTOCOL_CATALOG.protocols[3];
  const leftIds = volley.tidalLeftEdgeEnemyIds ?? [];
  const rightIds = volley.tidalRightEdgeEnemyIds ?? [];
  const distinctOuterPair = leftIds.some((leftId) =>
    rightIds.some((rightId) => rightId !== leftId),
  );
  if (
    enemyIds.length < definition.signature.chargeDistinctTargets ||
    !distinctOuterPair
  ) {
    return;
  }
  volley.tidalChargeGranted = true;
  const doubleReservoir = definition.evolutionTwo[0];
  const maximumCharges =
    progression.route.evolutionTwoId === doubleReservoir.id
      ? doubleReservoir.maxCharges
      : definition.signature.maxCharges;
  if (progression.runtime.charges >= maximumCharges) return;
  progression.runtime.charges += 1;
  events.push({
    type: "ex.tidal.charged",
    charge: progression.runtime.charges,
    maxCharge: maximumCharges,
    elapsed: world.state.elapsed,
  });
}

export function isTransparentTidalDuplicate(
  world: WorldState,
  bullet: Bullet,
  enemy: Enemy,
): boolean {
  const progression = world.progression.exProtocol;
  const state = bullet.candidate?.protocolState;
  if (
    progression?.status !== "selected" ||
    progression.runtime.kind !== "full-span-tidal-sweep" ||
    state?.kind !== "full-span-tidal-sweep"
  ) {
    return false;
  }
  return (
    progression.runtime.activations[state.activationId]?.hitEnemyIds.includes(
      enemy.id,
    ) ?? false
  );
}

export function recordTidalActivationHit(
  world: WorldState,
  bullet: Bullet,
  enemy: Enemy,
  events: GameEvent[],
): void {
  const progression = world.progression.exProtocol;
  const state = bullet.candidate?.protocolState;
  if (
    progression?.status !== "selected" ||
    progression.runtime.kind !== "full-span-tidal-sweep" ||
    state?.kind !== "full-span-tidal-sweep"
  ) {
    return;
  }
  const tracker = progression.runtime.activations[state.activationId];
  if (!tracker || tracker.hitEnemyIds.includes(enemy.id)) return;
  tracker.hitEnemyIds.push(enemy.id);
  const definition = EX_PROTOCOL_CATALOG.protocols[3];
  const threshold = definition.mastery.minimumDistinctActivationHits;
  if (tracker.hitEnemyIds.length < threshold) return;

  const backwash = definition.evolutionTwo[1];
  if (
    progression.route.evolutionTwoId === backwash.id &&
    !tracker.backwashTriggered
  ) {
    tracker.backwashTriggered = true;
    world.state.shotTimer =
      Math.max(0, world.state.shotTimer) *
      backwash.currentNormalShotTimerMultiplier;
    events.push({
      type: "ex.tidal.backwash.triggered",
      activationId: state.activationId,
      elapsed: world.state.elapsed,
    });
  }
  if (
    progression.route.masteryUnlocked &&
    !tracker.secondCrestTriggered
  ) {
    tracker.secondCrestTriggered = true;
    if (!world.weaponIdentity.spreadSweepCharge) {
      world.weaponIdentity.spreadSweepCharge = true;
    }
    events.push({
      type: "ex.tidal.second-crest.triggered",
      activationId: state.activationId,
      elapsed: world.state.elapsed,
    });
  }
}

function createTidalProjectiles(
  world: WorldState,
  config: SimulationConfig,
  volleyId: number,
  activationId: number,
  directions: readonly { x: number; y: number }[],
  hitCapacity: number,
  damageMultiplier: number,
  speedMultiplier: number,
  lifetimeMultiplier: number,
): string[] {
  const weaponConfig = config.weapons.spread;
  const projectileIds: string[] = [];
  for (const [projectileIndex, direction] of directions.entries()) {
    const creationOrdinal = world.nextBulletId++;
    const id = `bullet-${creationOrdinal}`;
    const offset =
      config.player.radius +
      weaponConfig.radius +
      2;
    projectileIds.push(id);
    world.bullets.push({
      id,
      volleyId,
      weaponType: "spread",
      position: {
        x: world.player.position.x + direction.x * offset,
        y: world.player.position.y + direction.y * offset,
      },
      velocity: {
        x:
          direction.x *
          weaponConfig.speed *
          world.runtime.projectileSpeedMultiplier *
          speedMultiplier,
        y:
          direction.y *
          weaponConfig.speed *
          world.runtime.projectileSpeedMultiplier *
          speedMultiplier,
      },
      radius: weaponConfig.radius,
      lifetime: weaponConfig.lifetime * lifetimeMultiplier,
      damage:
        weaponConfig.damage *
        world.runtime.projectileDamageMultiplier *
        damageMultiplier,
      hitsRemaining: hitCapacity,
      ricochetRemaining:
        weaponConfig.ricochetCount + world.runtime.ricochetBonus,
      ricochetsUsed: 0,
      ricochetSurfaceKind: null,
      ricochetBoundarySide: null,
      hitEnemyIds: [],
      candidate: {
        creationOrdinal,
        hitCapacityAtFire: hitCapacity,
        volleyKind: "ex.tidal",
        projectileIndex,
        projectileCount: directions.length,
        projectileRole: "protocol",
        activationId,
        consumedCoreSpreadSweep: false,
        protocolState: {
          kind: "full-span-tidal-sweep",
          activationId,
        },
      },
    });
  }
  return projectileIds;
}
