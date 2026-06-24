import type { GameEvent, Pickup, SimulationConfig, WorldState } from "../../domain/types";
import { circleCircle, circleRect } from "../../math/geometry";

export function updatePickups(
  world: WorldState,
  config: SimulationConfig,
  events: GameEvent[],
  dt = 0,
): void {
  spawnXpPickups(world, config, events);
  attractPickups(world, config, dt);
  collectPickups(world, events);
}

function spawnXpPickups(
  world: WorldState,
  config: SimulationConfig,
  events: GameEvent[],
): void {
  const killEvents = events.filter((event) => event.type === "enemy.killed");
  for (const event of killEvents) {
    if (event.xpAwarded <= 0) continue;

    const pickup: Pickup = {
      id: `pickup-${world.nextPickupId++}`,
      kind: "xp",
      position: findPickupPosition(world, config, event.position),
      radius: config.pickup.xpRadius,
      xpValue: event.xpAwarded,
    };
    world.pickups.push(pickup);
    events.push({
      type: "pickup.spawned",
      pickupId: pickup.id,
      position: { ...pickup.position },
      xpValue: pickup.xpValue,
    });
  }
}

function collectPickups(world: WorldState, events: GameEvent[]): void {
  const remaining: Pickup[] = [];
  for (const pickup of world.pickups) {
    if (!circleCircle(world.player, pickup)) {
      remaining.push(pickup);
      continue;
    }

    world.progression.xp += pickup.xpValue;
    events.push({
      type: "pickup.collected",
      pickupId: pickup.id,
      xpValue: pickup.xpValue,
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
  origin: { x: number; y: number },
): { x: number; y: number } {
  const radius = config.pickup.xpRadius;
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
  return !world.obstacles.some((obstacle) => circleRect({ position, radius }, obstacle));
}
