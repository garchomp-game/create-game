import type { SimulationConfig, UpgradeId, WorldState } from "../domain/types";

export type UpgradePreviewStat =
  | "fireRate"
  | "moveSpeed"
  | "shotSpeed"
  | "maxHp"
  | "projectiles"
  | "pierce";

export type UpgradePreviewLabels = Record<UpgradePreviewStat, string>;

export type UpgradePreview = {
  stat: UpgradePreviewStat;
  before: string;
  after: string;
  unit: "perSecond" | null;
};

const DEFAULT_PREVIEW_LABELS: UpgradePreviewLabels = {
  fireRate: "Fire rate",
  moveSpeed: "Move speed",
  shotSpeed: "Shot speed",
  maxHp: "Max HP",
  projectiles: "Projectiles",
  pierce: "Pierce",
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
    return { stat: "fireRate", before: before.toFixed(1), after: after.toFixed(1), unit: "perSecond" };
  }

  if (effect.type === "moveSpeedMultiplier") {
    const before = config.player.speed * world.runtime.playerSpeedMultiplier;
    const after = before * effect.multiplier;
    return { stat: "moveSpeed", before: formatWhole(before), after: formatWhole(after), unit: null };
  }

  if (effect.type === "projectileSpeedMultiplier") {
    const before = weapon.speed * world.runtime.projectileSpeedMultiplier;
    const after = before * effect.multiplier;
    return { stat: "shotSpeed", before: formatWhole(before), after: formatWhole(after), unit: null };
  }

  if (effect.type === "maxHp") {
    const before = config.player.maxHp + world.runtime.maxHpBonus;
    const after = before + effect.amount;
    return { stat: "maxHp", before: formatWhole(before), after: formatWhole(after), unit: null };
  }

  if (effect.type === "projectileCount") {
    const before = weapon.projectileCount + world.runtime.projectileCountBonus;
    const after = before + effect.amount;
    return { stat: "projectiles", before: formatWhole(before), after: formatWhole(after), unit: null };
  }

  const before = weapon.pierceCount + world.runtime.pierceBonus;
  const after = before + effect.amount;
  return { stat: "pierce", before: formatWhole(before), after: formatWhole(after), unit: null };
}

export function formatUpgradePreview(
  preview: UpgradePreview,
  labels: UpgradePreviewLabels = DEFAULT_PREVIEW_LABELS,
  options: { separator?: string; perSecond?: string } = {},
): string {
  const separator = options.separator ?? " -> ";
  const perSecond = options.perSecond ?? "/s";
  return `${labels[preview.stat]}: ${formatValue(preview.before, preview.unit, perSecond)}${separator}${formatValue(
    preview.after,
    preview.unit,
    perSecond,
  )}`;
}

function getFireRate(baseInterval: number, intervalMultiplier: number): number {
  return 1 / Math.max(0.001, baseInterval * intervalMultiplier);
}

function formatWhole(value: number): string {
  return Math.round(value).toString();
}

function formatValue(value: string, unit: UpgradePreview["unit"], perSecond: string): string {
  if (unit === "perSecond") return `${value}${perSecond}`;
  return value;
}
