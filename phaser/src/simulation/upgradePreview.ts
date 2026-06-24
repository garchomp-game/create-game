import type { SimulationConfig, UpgradeId, WorldState } from "../domain/types";

export type UpgradePreview = {
  label: string;
  before: string;
  after: string;
};

export function createUpgradePreview(
  world: WorldState,
  config: SimulationConfig,
  upgradeId: UpgradeId,
): UpgradePreview {
  const upgrade = config.upgrades[upgradeId];
  const effect = upgrade.effect;
  const weapon = config.weapons[world.state.weaponType];

  if (effect.type === "fireIntervalMultiplier") {
    const before = getFireRate(weapon.interval, world.runtime.fireIntervalMultiplier);
    const after = getFireRate(weapon.interval, world.runtime.fireIntervalMultiplier * effect.multiplier);
    return { label: "Fire rate", before: `${before.toFixed(1)}/s`, after: `${after.toFixed(1)}/s` };
  }

  if (effect.type === "moveSpeedMultiplier") {
    const before = config.player.speed * world.runtime.playerSpeedMultiplier;
    const after = before * effect.multiplier;
    return { label: "Move speed", before: formatWhole(before), after: formatWhole(after) };
  }

  if (effect.type === "projectileSpeedMultiplier") {
    const before = weapon.speed * world.runtime.projectileSpeedMultiplier;
    const after = before * effect.multiplier;
    return { label: "Shot speed", before: formatWhole(before), after: formatWhole(after) };
  }

  if (effect.type === "maxHp") {
    const before = config.player.maxHp + world.runtime.maxHpBonus;
    const after = before + effect.amount;
    return { label: "Max HP", before: formatWhole(before), after: formatWhole(after) };
  }

  if (effect.type === "projectileCount") {
    const before = weapon.projectileCount + world.runtime.projectileCountBonus;
    const after = before + effect.amount;
    return { label: "Projectiles", before: formatWhole(before), after: formatWhole(after) };
  }

  const before = weapon.pierceCount + world.runtime.pierceBonus;
  const after = before + effect.amount;
  return { label: "Pierce", before: formatWhole(before), after: formatWhole(after) };
}

export function formatUpgradePreview(preview: UpgradePreview): string {
  return `${preview.label}: ${preview.before} -> ${preview.after}`;
}

function getFireRate(baseInterval: number, intervalMultiplier: number): number {
  return 1 / Math.max(0.001, baseInterval * intervalMultiplier);
}

function formatWhole(value: number): string {
  return Math.round(value).toString();
}
