import type { GameEvent, SimulationConfig, Vec2, WorldState } from "../../domain/types";
import { applyPlayerDamage } from "./playerHealthSystem";

export type CollapseSafeBounds = {
  left: number;
  top: number;
  right: number;
  bottom: number;
};

export function updateArenaCollapse(
  world: WorldState,
  dt: number,
  config: SimulationConfig,
  events: GameEvent[],
): void {
  if (!config.features.arenaCollapse) return;

  const targetStage = getCollapseStage(config, world.state.elapsed);
  if (targetStage > world.encounter.collapse.stage) {
    world.encounter.collapse.stage = targetStage;
    world.encounter.collapse.inset = getCollapseInset(config, targetStage);
    events.push({
      type: "collapse.advanced",
      stage: targetStage,
      inset: world.encounter.collapse.inset,
      elapsed: world.state.elapsed,
    });
  }

  if (world.encounter.collapse.stage === 0) return;
  const bounds = getCollapseSafeBounds(config, world.encounter.collapse.inset);
  if (isInsideCollapseSafeArea(world.player.position, world.player.radius, bounds)) {
    world.encounter.collapse.damageTimer = 0;
    return;
  }

  world.encounter.collapse.damageTimer -= dt;
  if (world.encounter.collapse.damageTimer > 0) return;
  world.encounter.collapse.damageTimer += config.encounter.collapse.damageInterval;
  const damage = Math.ceil(
    config.encounter.collapse.baseDamage *
      config.encounter.collapse.damageGrowth ** (world.encounter.collapse.stage - 1),
  );
  const resolvedDamage = applyPlayerDamage(world, damage);
  events.push({
    type: "player.damaged",
    damage: resolvedDamage,
    hpAfter: world.state.hp,
    source: { kind: "collapse", stage: world.encounter.collapse.stage },
  });
}

export function getCollapseStage(config: SimulationConfig, elapsed: number): number {
  if (!config.features.arenaCollapse || elapsed < config.encounter.collapse.startsAt) return 0;
  return (
    1 +
    Math.floor(
      (elapsed - config.encounter.collapse.startsAt) / config.encounter.collapse.stepSeconds,
    )
  );
}

export function getCollapseInset(config: SimulationConfig, stage: number): number {
  return Math.min(
    Math.min(config.arena.width, config.arena.height) / 2,
    Math.max(0, stage) * config.encounter.collapse.insetPerStep,
  );
}

export function getCollapseSafeBounds(
  config: SimulationConfig,
  inset: number,
): CollapseSafeBounds {
  return {
    left: inset,
    top: inset,
    right: config.arena.width - inset,
    bottom: config.arena.height - inset,
  };
}

export function getNextCollapseAt(config: SimulationConfig, stage: number): number {
  return config.encounter.collapse.startsAt + Math.max(0, stage) * config.encounter.collapse.stepSeconds;
}

export function isInsideCollapseSafeArea(
  position: Vec2,
  radius: number,
  bounds: CollapseSafeBounds,
): boolean {
  return (
    bounds.left + radius < bounds.right - radius &&
    bounds.top + radius < bounds.bottom - radius &&
    position.x >= bounds.left + radius &&
    position.x <= bounds.right - radius &&
    position.y >= bounds.top + radius &&
    position.y <= bounds.bottom - radius
  );
}
