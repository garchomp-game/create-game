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
  updateAndCollectPickups(world, config, events, dt);
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
  const sourceEventCount = events.length;
  const hasKillEvent = events.some(
    (event) =>
      event.type === "enemy.killed" ||
      event.type === "enemy.protocol.killed",
  );
  if (!hasKillEvent) return;
  const placementGrid = new PickupPlacementGrid(world.pickups, config);
  const boss = world.expedition?.boss?.status === "active"
    ? world.expedition.boss
    : null;
  const suppressedHealDrops: Record<BossHealDropSuppressionReason, number> = {
    cooldown: 0,
    "repair-budget-exhausted": 0,
  };
  for (let eventIndex = 0; eventIndex < sourceEventCount; eventIndex += 1) {
    const event = events[eventIndex]!;
    if (
      event.type !== "enemy.killed" &&
      event.type !== "enemy.protocol.killed"
    ) {
      continue;
    }
    if (event.xpAwarded > 0) {
      const xpPickup = createXpPickup(
        world,
        config,
        event.position,
        event.xpAwarded,
        placementGrid,
      );
      world.pickups.push(xpPickup);
      placementGrid.add(xpPickup);
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
      placementGrid,
      boss?.sustain.repairBudgetRemaining ?? undefined,
    );
    if (boss && boss.sustain.repairBudgetRemaining !== null) {
      boss.sustain.repairBudgetRemaining = Math.max(
        0,
        boss.sustain.repairBudgetRemaining - healPickup.healValue,
      );
    }
    world.pickups.push(healPickup);
    placementGrid.add(healPickup);
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
  placementGrid: PickupPlacementGrid,
): Pickup {
  return {
    id: `pickup-${world.nextPickupId++}`,
    kind: "xp",
    position: findPickupPosition(
      world,
      config,
      origin,
      config.pickup.xpRadius,
      placementGrid,
    ),
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
  placementGrid: PickupPlacementGrid,
  maximumHealValue = Number.POSITIVE_INFINITY,
): Pickup {
  return {
    id: `pickup-${world.nextPickupId++}`,
    kind: "heal",
    position: findPickupPosition(
      world,
      config,
      origin,
      config.pickup.healRadius,
      placementGrid,
    ),
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

function updateAndCollectPickups(
  world: WorldState,
  config: SimulationConfig,
  events: GameEvent[],
  dt: number,
): void {
  const pickups = world.pickups;
  const canCollect = world.state.hp > 0;
  const magnetRadius = config.pickup.magnetRadius;
  const maxStep = dt > 0 ? config.pickup.magnetSpeed * dt : 0;
  let expiredEvents: GameEvent[] | null = null;
  let collectedEvents: GameEvent[] | null = null;
  const remaining: Pickup[] = [];

  for (const pickup of pickups) {
    if (dt > 0 && pickup.kind === "heal" && pickup.lifetime !== null) {
      pickup.lifetime -= dt;
      if (pickup.lifetime <= 0) {
        (expiredEvents ??= []).push({
          type: "pickup.expired",
          pickupId: pickup.id,
          pickupKind: "heal",
        });
        continue;
      }
    }

    if (maxStep > 0) {
      attractPickup(
        pickup,
        world.player.position,
        magnetRadius,
        maxStep,
      );
    }

    if (!canCollect || !circleCircle(world.player, pickup)) {
      remaining.push(pickup);
      continue;
    }

    if (pickup.kind === "xp") {
      world.progression.xp += pickup.xpValue;
      (collectedEvents ??= []).push({
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
    (collectedEvents ??= []).push({
      type: "pickup.collected",
      pickupId: pickup.id,
      pickupKind: "heal",
      xpValue: 0,
      healValue: pickup.healValue,
      hpRecovered,
    });
  }
  // AutoPilot pickup-density caches use this collection reference as their key.
  world.pickups = remaining;
  if (expiredEvents) events.push(...expiredEvents);
  if (collectedEvents) events.push(...collectedEvents);
}

function attractPickup(
  pickup: Pickup,
  target: Vec2,
  magnetRadius: number,
  maxStep: number,
): void {
  const dx = target.x - pickup.position.x;
  const dy = target.y - pickup.position.y;
  const distance = Math.hypot(dx, dy);
  if (distance <= 0 || distance > magnetRadius) return;

  const step = Math.min(distance, maxStep);
  pickup.position.x += (dx / distance) * step;
  pickup.position.y += (dy / distance) * step;
}

function findPickupPosition(
  world: WorldState,
  config: SimulationConfig,
  origin: Vec2,
  radius: number,
  placementGrid: PickupPlacementGrid,
): { x: number; y: number } {
  const clampedOrigin = {
    x: Math.max(radius, Math.min(config.arena.width - radius, origin.x)),
    y: Math.max(radius, Math.min(config.arena.height - radius, origin.y)),
  };

  if (isPickupPositionClear(world, radius, clampedOrigin, placementGrid)) {
    return clampedOrigin;
  }

  const step = config.pickup.placementStep;
  for (let ring = 1; ring <= config.pickup.placementRings; ring += 1) {
    for (let gridY = -ring; gridY <= ring; gridY += 1) {
      for (let gridX = -ring; gridX <= ring; gridX += 1) {
        if (Math.abs(gridX) !== ring && Math.abs(gridY) !== ring) continue;
        const position = clampPickupPosition(config, radius, {
          x: clampedOrigin.x + gridX * step,
          y: clampedOrigin.y + gridY * step,
        });
        if (isPickupPositionClear(world, radius, position, placementGrid)) {
          return position;
        }
      }
    }
  }

  for (let y = radius; y <= config.arena.height - radius; y += step) {
    for (let x = radius; x <= config.arena.width - radius; x += step) {
      const position = { x, y };
      if (isPickupPositionClear(world, radius, position, placementGrid)) {
        return position;
      }
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
  placementGrid: PickupPlacementGrid,
): boolean {
  const candidate = { position, radius };
  return (
    !world.obstacles.some((obstacle) => circleRect(candidate, obstacle)) &&
    !placementGrid.overlaps(position, radius)
  );
}

class PickupPlacementGrid {
  private readonly buckets = new Map<number, Pickup[]>();
  private readonly cellSize: number;
  private readonly columns: number;
  private readonly rows: number;
  private readonly maximumPickupRadius: number;

  constructor(
    pickups: readonly Pickup[],
    config: SimulationConfig,
  ) {
    this.maximumPickupRadius = Math.max(
      config.pickup.xpRadius,
      config.pickup.healRadius,
    );
    this.cellSize = Math.max(
      config.pickup.placementStep,
      this.maximumPickupRadius * 2,
    );
    this.columns = Math.max(1, Math.ceil(config.arena.width / this.cellSize));
    this.rows = Math.max(1, Math.ceil(config.arena.height / this.cellSize));
    for (const pickup of pickups) this.add(pickup);
  }

  add(pickup: Pickup): void {
    const key = this.keyFor(pickup.position);
    const bucket = this.buckets.get(key);
    if (bucket) bucket.push(pickup);
    else this.buckets.set(key, [pickup]);
  }

  overlaps(position: Vec2, radius: number): boolean {
    const range = radius + this.maximumPickupRadius;
    const minCellX = this.clampCellX(
      Math.floor((position.x - range) / this.cellSize),
    );
    const maxCellX = this.clampCellX(
      Math.floor((position.x + range) / this.cellSize),
    );
    const minCellY = this.clampCellY(
      Math.floor((position.y - range) / this.cellSize),
    );
    const maxCellY = this.clampCellY(
      Math.floor((position.y + range) / this.cellSize),
    );

    for (let cellY = minCellY; cellY <= maxCellY; cellY += 1) {
      for (let cellX = minCellX; cellX <= maxCellX; cellX += 1) {
        const bucket = this.buckets.get(cellY * this.columns + cellX);
        if (!bucket) continue;
        for (const pickup of bucket) {
          const dx = position.x - pickup.position.x;
          const dy = position.y - pickup.position.y;
          const combinedRadius = radius + pickup.radius;
          if (dx * dx + dy * dy <= combinedRadius * combinedRadius) {
            return true;
          }
        }
      }
    }
    return false;
  }

  private keyFor(position: Vec2): number {
    const cellX = this.clampCellX(Math.floor(position.x / this.cellSize));
    const cellY = this.clampCellY(Math.floor(position.y / this.cellSize));
    return cellY * this.columns + cellX;
  }

  private clampCellX(cellX: number): number {
    return Math.max(0, Math.min(this.columns - 1, cellX));
  }

  private clampCellY(cellY: number): number {
    return Math.max(0, Math.min(this.rows - 1, cellY));
  }
}

function hashToUnit(input: string): number {
  let hash = 2166136261;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) / 0x100000000;
}
