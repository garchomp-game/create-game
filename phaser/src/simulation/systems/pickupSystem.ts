import type {
  BossHealDropSuppressionReason,
  EnemyTypeId,
  GameEvent,
  Pickup,
  SimulationConfig,
  Vec2,
  WorldState,
} from "../../domain/types";
import { circleCircle, circleRect } from "../../math/geometry";
import { getThreatMultipliers } from "../threatDirector";
import { getDifficultyElapsed } from "../difficultyClock";
import {
  getPlayerEffectiveMaxHp,
  healPlayer,
} from "./playerHealthSystem";

export function updatePickups(
  world: WorldState,
  config: SimulationConfig,
  events: GameEvent[],
  dt = 0,
): void {
  spawnPickupsFromKills(world, config, events);
  updatePickupLifetimes(world, events, dt);
  attractPickups(world, config, dt);
  collectPickups(world, config, events);
}

export function calculateHealDropChance(
  config: SimulationConfig,
  enemyType: EnemyTypeId,
  missCount: number,
  threatMultiplier = 1,
): number {
  const pitySteps = Math.max(0, missCount - config.pickup.healDropPityThreshold + 1);
  const pityBonus = pitySteps * config.pickup.healDropPityBonus;
  const enemyMultiplier = config.pickup.healEnemyMultipliers[enemyType];
  return Math.min(
    config.pickup.healDropMaxChance,
    Math.max(
      0,
      (config.pickup.healDropChance + pityBonus) * enemyMultiplier * threatMultiplier,
    ),
  );
}

export function rollHealDrop(
  config: SimulationConfig,
  enemyId: string,
  enemyType: EnemyTypeId,
  rollIndex: number,
  missCount: number,
  threatMultiplier = 1,
): boolean {
  const chance = calculateHealDropChance(config, enemyType, missCount, threatMultiplier);
  if (chance <= 0) return false;
  if (chance >= 1) return true;

  return hashToUnit(`${config.seed}:${enemyId}:${enemyType}:${rollIndex}`) < chance;
}

export function getCurrentMaxHp(world: WorldState, config: SimulationConfig): number {
  return getPlayerEffectiveMaxHp(world, config);
}

function spawnPickupsFromKills(
  world: WorldState,
  config: SimulationConfig,
  events: GameEvent[],
): void {
  const killEvents = events.filter((event) => event.type === "enemy.killed");
  const boss = world.expedition?.boss?.status === "active"
    ? world.expedition.boss
    : null;
  const suppressedHealDrops: Record<BossHealDropSuppressionReason, number> = {
    cooldown: 0,
    "repair-budget-exhausted": 0,
  };
  for (const event of killEvents) {
    if (event.xpAwarded > 0) {
      const xpPickup = createXpPickup(world, config, event.position, event.xpAwarded);
      world.pickups.push(xpPickup);
      events.push({
        type: "pickup.spawned",
        pickupId: xpPickup.id,
        pickupKind: "xp",
        position: { ...xpPickup.position },
        xpValue: xpPickup.xpValue,
        healValue: 0,
        lifetime: null,
      });
    }

    if (boss && event.enemyId === boss.enemyId) continue;

    if (boss?.sustain.repairBudgetRemaining === 0) {
      suppressedHealDrops["repair-budget-exhausted"] += 1;
      continue;
    }
    if (boss && world.state.elapsed < boss.sustain.nextHealDropAt) {
      suppressedHealDrops.cooldown += 1;
      continue;
    }

    const rollIndex = world.runtime.healDropRollIndex;
    const shouldSpawnHeal = boss
      ? true
      : rollHealDrop(
          config,
          event.enemyId,
          event.enemyType,
          rollIndex,
          world.runtime.healDropMissCount,
          getThreatMultipliers(config, getDifficultyElapsed(world)).healDrop,
        );
    world.runtime.healDropRollIndex += 1;

    if (!shouldSpawnHeal) {
      world.runtime.healDropMissCount += 1;
      continue;
    }

    world.runtime.healDropMissCount = 0;
    if (boss) {
      boss.sustain.nextHealDropAt =
        world.state.elapsed + boss.sustain.healDropMinimumIntervalSeconds;
    }
    const healPickup = createHealPickup(
      world,
      config,
      event.position,
      boss?.sustain.repairBudgetRemaining ?? undefined,
    );
    if (boss && boss.sustain.repairBudgetRemaining !== null) {
      boss.sustain.repairBudgetRemaining = Math.max(
        0,
        boss.sustain.repairBudgetRemaining - healPickup.healValue,
      );
    }
    world.pickups.push(healPickup);
    events.push({
      type: "pickup.spawned",
      pickupId: healPickup.id,
      pickupKind: "heal",
      position: { ...healPickup.position },
      xpValue: 0,
      healValue: healPickup.healValue,
      lifetime: config.pickup.healLifetime,
    });
  }
  if (boss) {
    for (const reason of [
      "cooldown",
      "repair-budget-exhausted",
    ] as const) {
      const count = suppressedHealDrops[reason];
      if (count <= 0) continue;
      events.push({
        type: "boss.heal-drop.suppressed",
        bossId: boss.bossId,
        count,
        reason,
        elapsed: world.state.elapsed,
      });
    }
  }
}

function createXpPickup(
  world: WorldState,
  config: SimulationConfig,
  origin: Vec2,
  xpValue: number,
): Pickup {
  return {
    id: `pickup-${world.nextPickupId++}`,
    kind: "xp",
    position: findPickupPosition(world, config, origin, config.pickup.xpRadius),
    radius: config.pickup.xpRadius,
    xpValue,
    healValue: 0,
    lifetime: null,
  };
}

function createHealPickup(
  world: WorldState,
  config: SimulationConfig,
  origin: Vec2,
  maximumHealValue = Number.POSITIVE_INFINITY,
): Pickup {
  return {
    id: `pickup-${world.nextPickupId++}`,
    kind: "heal",
    position: findPickupPosition(world, config, origin, config.pickup.healRadius),
    radius: config.pickup.healRadius,
    xpValue: 0,
    healValue: Math.min(
      maximumHealValue,
      Math.max(
        config.pickup.healMinimum,
        Math.floor(getCurrentMaxHp(world, config) * config.pickup.healRatio),
      ),
    ),
    lifetime: config.pickup.healLifetime,
  };
}

function updatePickupLifetimes(world: WorldState, events: GameEvent[], dt: number): void {
  if (dt <= 0) return;

  const remaining: Pickup[] = [];
  for (const pickup of world.pickups) {
    if (pickup.kind !== "heal" || pickup.lifetime === null) {
      remaining.push(pickup);
      continue;
    }

    pickup.lifetime -= dt;
    if (pickup.lifetime > 0) {
      remaining.push(pickup);
      continue;
    }

    events.push({
      type: "pickup.expired",
      pickupId: pickup.id,
      pickupKind: "heal",
    });
  }
  world.pickups = remaining;
}

function collectPickups(
  world: WorldState,
  config: SimulationConfig,
  events: GameEvent[],
): void {
  if (world.state.hp <= 0) return;

  const remaining: Pickup[] = [];
  for (const pickup of world.pickups) {
    if (!circleCircle(world.player, pickup)) {
      remaining.push(pickup);
      continue;
    }

    if (pickup.kind === "xp") {
      world.progression.xp += pickup.xpValue;
      events.push({
        type: "pickup.collected",
        pickupId: pickup.id,
        pickupKind: "xp",
        xpValue: pickup.xpValue,
        healValue: 0,
        hpRecovered: 0,
      });
      continue;
    }

    const hpRecovered = healPlayer(world, config, pickup.healValue);
    events.push({
      type: "pickup.collected",
      pickupId: pickup.id,
      pickupKind: "heal",
      xpValue: 0,
      healValue: pickup.healValue,
      hpRecovered,
    });
  }
  world.pickups = remaining;
}

function attractPickups(
  world: WorldState,
  config: SimulationConfig,
  dt: number,
): void {
  if (dt <= 0) return;

  const magnetRadius = config.pickup.magnetRadius;
  const maxStep = config.pickup.magnetSpeed * dt;
  for (const pickup of world.pickups) {
    const dx = world.player.position.x - pickup.position.x;
    const dy = world.player.position.y - pickup.position.y;
    const distance = Math.hypot(dx, dy);
    if (distance <= 0 || distance > magnetRadius) continue;

    const step = Math.min(distance, maxStep);
    pickup.position.x += (dx / distance) * step;
    pickup.position.y += (dy / distance) * step;
  }
}

function findPickupPosition(
  world: WorldState,
  config: SimulationConfig,
  origin: Vec2,
  radius: number,
): { x: number; y: number } {
  const clampedOrigin = {
    x: Math.max(radius, Math.min(config.arena.width - radius, origin.x)),
    y: Math.max(radius, Math.min(config.arena.height - radius, origin.y)),
  };

  if (isPickupPositionClear(world, radius, clampedOrigin)) return clampedOrigin;

  const step = config.pickup.placementStep;
  for (let ring = 1; ring <= config.pickup.placementRings; ring += 1) {
    for (let gridY = -ring; gridY <= ring; gridY += 1) {
      for (let gridX = -ring; gridX <= ring; gridX += 1) {
        if (Math.abs(gridX) !== ring && Math.abs(gridY) !== ring) continue;
        const position = clampPickupPosition(config, radius, {
          x: clampedOrigin.x + gridX * step,
          y: clampedOrigin.y + gridY * step,
        });
        if (isPickupPositionClear(world, radius, position)) return position;
      }
    }
  }

  for (let y = radius; y <= config.arena.height - radius; y += step) {
    for (let x = radius; x <= config.arena.width - radius; x += step) {
      const position = { x, y };
      if (isPickupPositionClear(world, radius, position)) return position;
    }
  }

  return clampedOrigin;
}

function clampPickupPosition(
  config: SimulationConfig,
  radius: number,
  position: { x: number; y: number },
): { x: number; y: number } {
  return {
    x: Math.max(radius, Math.min(config.arena.width - radius, position.x)),
    y: Math.max(radius, Math.min(config.arena.height - radius, position.y)),
  };
}

function isPickupPositionClear(
  world: WorldState,
  radius: number,
  position: { x: number; y: number },
): boolean {
  const candidate = { position, radius };
  return (
    !world.obstacles.some((obstacle) => circleRect(candidate, obstacle)) &&
    !world.pickups.some((pickup) => circleCircle(candidate, pickup))
  );
}

function hashToUnit(input: string): number {
  let hash = 2166136261;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) / 0x100000000;
}
