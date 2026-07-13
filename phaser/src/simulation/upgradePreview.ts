import type { SimulationConfig, UpgradeId, WorldState } from "../domain/types";

export type UpgradePreviewStat =
  | "fireRate"
  | "moveSpeed"
  | "shotSpeed"
  | "maxHp"
  | "projectiles"
  | "hitCapacity"
  | "ricochets"
  | "focusStacks"
  | "nextVolleyReduction";

export type UpgradePreviewLabels = Record<UpgradePreviewStat, string>;

export type UpgradePreview = {
  stat: UpgradePreviewStat;
  before: string;
  after: string;
  unit: "perSecond" | "percent" | null;
};

const DEFAULT_PREVIEW_LABELS: UpgradePreviewLabels = {
  fireRate: "Fire rate",
  moveSpeed: "Move speed",
  shotSpeed: "Shot speed",
  maxHp: "Max HP",
  projectiles: "Projectiles",
  hitCapacity: "Hit capacity",
  ricochets: "Ricochets",
  focusStacks: "Focus stacks",
  nextVolleyReduction: "Next volley reduction",
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
    const after = getFireRate(
      weapon.interval,
      world.runtime.fireIntervalMultiplier * effect.multiplier,
    );
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

  if (effect.type === "hitCapacity") {
    const before = weapon.hitCapacity + world.runtime.hitCapacityBonus;
    const after = before + effect.amount;
    return { stat: "hitCapacity", before: formatWhole(before), after: formatWhole(after), unit: null };
  }

  if (effect.type === "ricochet") {
    const before = weapon.ricochetCount + world.runtime.ricochetBonus;
    const after = before + effect.amount;
    return { stat: "ricochets", before: formatWhole(before), after: formatWhole(after), unit: null };
  }

  if (effect.type === "pulseFocus") {
    const before = world.runtime.pulseFocusMaxStacks;
    const after = before + effect.stacksPerRank;
    return { stat: "focusStacks", before: formatWhole(before), after: formatWhole(after), unit: null };
  }

  const before = 0;
  const after = (1 - effect.nextIntervalMultiplier) * 100;
  return {
    stat: "nextVolleyReduction",
    before: formatWhole(before),
    after: formatWhole(after),
    unit: "percent",
  };
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
  if (unit === "percent") return `${value}%`;
  return value;
}
