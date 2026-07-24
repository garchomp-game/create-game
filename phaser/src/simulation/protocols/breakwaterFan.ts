import { EX_PROTOCOL_CATALOG } from "../../content/exProtocolCatalog";
import type {
  Bullet,
  Enemy,
  GameEvent,
  SimulationConfig,
  Vec2,
  WorldState,
} from "../../domain/types";
import { hasClearNavigationPath } from "../navigationField";
import { resolveEnemyDamage } from "../systems/enemyDamageSystem";
import { moveCircleSafely } from "../systems/movement";
import { spendPlayerIntegrity } from "../systems/playerHealthSystem";

type BreakwaterClass =
  | "chaser"
  | "fast"
  | "brute"
  | "ranged"
  | "commander"
  | "charger"
  | "boss";

type BreakwaterTarget = {
  enemy: Enemy;
  classId: BreakwaterClass;
  distance: number;
  direction: Vec2;
  creationOrdinal: number;
};

export function activateBreakwaterFan(
  world: WorldState,
  specialPressed: boolean,
  config: SimulationConfig,
  events: GameEvent[],
): void {
  const progression = world.progression.exProtocol;
  if (
    progression?.status !== "selected" ||
    progression.runtime.kind !== "breakwater-fan" ||
    !specialPressed
  ) {
    return;
  }
  if (world.state.weaponType !== "spread") {
    throw new Error("Breakwater Fan requires the Spread weapon.");
  }
  const runtime = progression.runtime;
  if (world.state.elapsed < runtime.cooldownUntil) {
    reject(world, "cooldown", events);
    return;
  }
  if (runtime.charges <= 0) {
    reject(world, "not-charged", events);
    return;
  }

  const definition = EX_PROTOCOL_CATALOG.protocols[4];
  const efficientVenting = definition.evolutionOne[0];
  const costRatio =
    progression.route.evolutionOneId === efficientVenting.id
      ? efficientVenting.costGrossHpSnapshotRatio
      : definition.signature.costGrossHpSnapshotRatio;
  const cost = Math.ceil(runtime.grossMaxHpAtSelection * costRatio);
  const longBreak = definition.evolutionTwo[0];
  const wideBreak = definition.evolutionTwo[1];
  const range =
    progression.route.evolutionTwoId === longBreak.id
      ? longBreak.rangePx
      : progression.route.evolutionTwoId === wideBreak.id
        ? wideBreak.rangePx
        : definition.signature.rangePx;
  const coneAngleDegrees =
    progression.route.evolutionTwoId === longBreak.id
      ? longBreak.coneAngleDegrees
      : progression.route.evolutionTwoId === wideBreak.id
        ? wideBreak.coneAngleDegrees
        : definition.signature.coneAngleDegrees;
  const targets = findBreakwaterTargets(
    world,
    world.state.lastAim,
    range,
    coneAngleDegrees,
    definition.signature.maxTargets,
  );
  const integrity = spendPlayerIntegrity(
    world,
    cost,
    definition.signature.minimumHpAfterCost,
  );
  if (!integrity.accepted) {
    reject(world, "insufficient-hp", events);
    return;
  }

  const activationId = runtime.nextActivationId++;
  runtime.charges -= 1;
  runtime.cooldownUntil =
    world.state.elapsed + definition.signature.cooldownSeconds;
  events.push({
    type: "player.integrity.spent",
    protocolId: runtime.protocolId,
    amount: integrity.spent,
    hpAfter: world.state.hp,
    elapsed: world.state.elapsed,
  });
  events.push({
    type: "ex.special.activated",
    protocolId: runtime.protocolId,
    activationId,
    elapsed: world.state.elapsed,
  });

  const hardBreak = definition.evolutionOne[1];
  const evolutionDamageMultiplier =
    progression.route.evolutionOneId === hardBreak.id
      ? hardBreak.activationDamageMultiplier
      : 1;
  const baseDamage =
    config.weapons.spread.damage *
    world.runtime.projectileDamageMultiplier;
  const deadEnemies = new Set<Enemy>();
  const survivors: BreakwaterTarget[] = [];
  let totalDamage = 0;
  let affectedNonBossTargets = 0;
  for (const target of targets) {
    const damage =
      baseDamage *
      definition.signature.damageMultipliers[target.classId] *
      evolutionDamageMultiplier;
    const outcome = resolveEnemyDamage(
      world,
      target.enemy,
      {
        amount: damage,
        baselineWithoutAnyProtocol: 0,
        baselineForEffectAttribution: 0,
        source: {
          kind: "ex-protocol",
          protocolId: runtime.protocolId,
          activationId,
          effect: "breakwater",
          weaponType: "spread",
        },
      },
      deadEnemies,
      events,
    );
    if (!outcome.applied) continue;
    totalDamage += outcome.damage;
    if (target.classId !== "boss") affectedNonBossTargets += 1;
    if (!outcome.killed) survivors.push(target);
  }
  if (deadEnemies.size > 0) {
    world.enemies = world.enemies.filter(
      (enemy) => !deadEnemies.has(enemy),
    );
  }

  let pushedTargets = 0;
  for (const target of survivors) {
    const pushDistance =
      definition.signature.pushDistancePx[target.classId];
    if (pushDistance <= 0) continue;
    const moved = moveCircleSafely(
      world,
      target.enemy,
      target.direction.x * pushDistance,
      target.direction.y * pushDistance,
      config,
    );
    if (moved > 0) pushedTargets += 1;
  }

  if (
    progression.route.masteryUnlocked &&
    affectedNonBossTargets >=
      definition.mastery.minimumAffectedNonBossTargets
  ) {
    runtime.escapeCurrentUntil =
      world.state.elapsed + definition.mastery.durationSeconds;
    events.push({
      type: "ex.breakwater.escape-current.triggered",
      activationId,
      expiresAt: runtime.escapeCurrentUntil,
      elapsed: world.state.elapsed,
    });
  }
  events.push({
    type: "ex.breakwater.resolved",
    activationId,
    targetCount: targets.length,
    pushedTargets,
    damage: totalDamage,
    elapsed: world.state.elapsed,
  });
}

export function recordBreakwaterNormalHit(
  world: WorldState,
  bullet: Bullet,
  enemy: Enemy,
  events: GameEvent[],
): void {
  const progression = world.progression.exProtocol;
  const candidate = bullet.candidate;
  if (
    progression?.status !== "selected" ||
    progression.runtime.kind !== "breakwater-fan" ||
    !candidate ||
    candidate.volleyKind !== "normal"
  ) {
    return;
  }
  const distance = Math.hypot(
    enemy.position.x - world.player.position.x,
    enemy.position.y - world.player.position.y,
  );
  const definition = EX_PROTOCOL_CATALOG.protocols[4];
  if (distance > definition.signature.chargeRangePx) return;
  const volley = world.analytics.activeVolleys[bullet.volleyId];
  if (!volley) return;
  const enemyIds = (volley.breakwaterCloseEnemyIds ??= []);
  if (!enemyIds.includes(enemy.id)) enemyIds.push(enemy.id);
  if (
    volley.breakwaterChargeGranted ||
    enemyIds.length < definition.signature.chargeDistinctTargets
  ) {
    return;
  }
  volley.breakwaterChargeGranted = true;
  if (progression.runtime.charges >= definition.signature.maxCharges) {
    return;
  }
  progression.runtime.charges += 1;
  events.push({
    type: "ex.breakwater.charged",
    charge: progression.runtime.charges,
    elapsed: world.state.elapsed,
  });
}

export function getBreakwaterMovementMultiplier(
  world: WorldState,
): number {
  const progression = world.progression.exProtocol;
  if (
    progression?.status !== "selected" ||
    progression.runtime.kind !== "breakwater-fan" ||
    world.state.elapsed >= progression.runtime.escapeCurrentUntil
  ) {
    return 1;
  }
  return EX_PROTOCOL_CATALOG.protocols[4].mastery.moveSpeedMultiplier;
}

function findBreakwaterTargets(
  world: WorldState,
  aim: Vec2,
  range: number,
  coneAngleDegrees: number,
  maximumTargets: number,
): BreakwaterTarget[] {
  const aimLength = Math.hypot(aim.x, aim.y);
  const normalizedAim =
    aimLength > Number.EPSILON
      ? { x: aim.x / aimLength, y: aim.y / aimLength }
      : { x: 1, y: 0 };
  const minimumDot = Math.cos((coneAngleDegrees * Math.PI) / 360);
  const targets: BreakwaterTarget[] = [];
  for (const enemy of world.enemies) {
    if (enemy.hp <= 0) continue;
    const dx = enemy.position.x - world.player.position.x;
    const dy = enemy.position.y - world.player.position.y;
    const distance = Math.hypot(dx, dy);
    if (distance > range) continue;
    const direction =
      distance > Number.EPSILON
        ? { x: dx / distance, y: dy / distance }
        : { ...normalizedAim };
    const dot =
      direction.x * normalizedAim.x +
      direction.y * normalizedAim.y;
    if (dot < minimumDot) continue;
    if (
      !hasClearNavigationPath(
        world.player.position,
        enemy.position,
        0,
        world.obstacles,
      )
    ) {
      continue;
    }
    targets.push({
      enemy,
      classId: getBreakwaterClass(enemy),
      distance,
      direction,
      creationOrdinal:
        enemy.candidate?.creationOrdinal ?? Number.MAX_SAFE_INTEGER,
    });
  }
  targets.sort(
    (left, right) =>
      left.distance - right.distance ||
      left.creationOrdinal - right.creationOrdinal,
  );
  return targets.slice(0, maximumTargets);
}

function getBreakwaterClass(enemy: Enemy): BreakwaterClass {
  if (enemy.boss) return "boss";
  if (enemy.action?.kind === "charger") return "charger";
  if (enemy.elite?.kind === "commander") return "commander";
  return enemy.typeId;
}

function reject(
  world: WorldState,
  reason: Extract<
    GameEvent,
    { type: "ex.special.rejected" }
  >["reason"],
  events: GameEvent[],
): void {
  const progression = world.progression.exProtocol;
  if (
    progression?.status !== "selected" ||
    progression.runtime.kind !== "breakwater-fan"
  ) {
    return;
  }
  events.push({
    type: "ex.special.rejected",
    protocolId: progression.runtime.protocolId,
    reason,
    elapsed: world.state.elapsed,
  });
}
