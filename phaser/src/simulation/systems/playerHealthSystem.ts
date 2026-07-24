import { EX_PROTOCOL_CATALOG } from "../../content/exProtocolCatalog";
import type { SimulationConfig, WorldState } from "../../domain/types";

export type PlayerCapacitySnapshot = {
  grossMaxHp: number;
  effectiveMaxHp: number;
  reservedHp: number;
};

export function getPlayerGrossMaxHp(
  world: WorldState,
  config: SimulationConfig,
): number {
  return config.player.maxHp + world.runtime.maxHpBonus;
}

export function getPlayerEffectiveMaxHp(
  world: WorldState,
  config: SimulationConfig,
): number {
  const grossMaxHp = getPlayerGrossMaxHp(world, config);
  const progression = world.progression.exProtocol;
  if (
    !config.features.exProtocols ||
    progression?.status !== "selected" ||
    progression.runtime.kind !== "redline-core"
  ) {
    return grossMaxHp;
  }
  const redline = EX_PROTOCOL_CATALOG.protocols[2];
  const stabilized = redline.evolutionOne[0];
  const multiplier =
    progression.route.evolutionOneId === stabilized.id
      ? stabilized.effectiveMaxHpMultiplier
      : redline.signature.effectiveMaxHpMultiplier;
  return Math.max(1, Math.floor(grossMaxHp * multiplier));
}

export function getPlayerCapacity(
  world: WorldState,
  config: SimulationConfig,
): PlayerCapacitySnapshot {
  const grossMaxHp = getPlayerGrossMaxHp(world, config);
  const effectiveMaxHp = getPlayerEffectiveMaxHp(world, config);
  return {
    grossMaxHp,
    effectiveMaxHp,
    reservedHp: Math.max(0, grossMaxHp - effectiveMaxHp),
  };
}

export function clampPlayerHpToCapacity(
  world: WorldState,
  config: SimulationConfig,
): number {
  const hpBefore = world.state.hp;
  world.state.hp = Math.min(
    world.state.hp,
    getPlayerEffectiveMaxHp(world, config),
  );
  return hpBefore - world.state.hp;
}

export function applyPlayerDamage(
  world: WorldState,
  amount: number,
): number {
  const hpBefore = world.state.hp;
  world.state.hp = Math.max(0, hpBefore - Math.max(0, amount));
  return hpBefore - world.state.hp;
}

export function spendPlayerIntegrity(
  world: WorldState,
  amount: number,
  minimumHpAfter = 1,
): { accepted: boolean; spent: number } {
  const cost = Math.max(0, Math.ceil(amount));
  if (world.state.hp - cost < minimumHpAfter) {
    return { accepted: false, spent: 0 };
  }
  world.state.hp -= cost;
  return { accepted: true, spent: cost };
}

export function healPlayer(
  world: WorldState,
  config: SimulationConfig,
  amount: number,
): number {
  const hpBefore = world.state.hp;
  world.state.hp = Math.min(
    getPlayerEffectiveMaxHp(world, config),
    hpBefore + Math.max(0, amount),
  );
  return world.state.hp - hpBefore;
}

export function applyCapacityIncrease(
  world: WorldState,
  config: SimulationConfig,
  effectiveMaxHpBefore: number,
  healIncrease: boolean,
): number {
  const effectiveMaxHpAfter = getPlayerEffectiveMaxHp(world, config);
  const increase = Math.max(0, effectiveMaxHpAfter - effectiveMaxHpBefore);
  if (healIncrease) {
    world.state.hp += increase;
  }
  clampPlayerHpToCapacity(world, config);
  return increase;
}
