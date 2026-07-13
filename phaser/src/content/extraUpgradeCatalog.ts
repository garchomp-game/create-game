import type { ExtraUpgradeDefinition, ExtraUpgradeId } from "../domain/types";

export const EXTRA_UPGRADE_DEFINITIONS: Record<ExtraUpgradeId, ExtraUpgradeDefinition> = {
  limitPower: {
    id: "limitPower",
    title: "Limit Power",
    description: "Increase projectile damage by 8% of base damage",
    maxRank: null,
    weight: 1,
    effect: { type: "projectileDamage", amountPerRank: 0.08 },
  },
  limitCycle: {
    id: "limitCycle",
    title: "Limit Cycle",
    description: "Increase fire rate by 10% of base fire rate",
    maxRank: 5,
    weight: 1,
    effect: { type: "fireRate", amountPerRank: 0.1, maximumBonus: 0.5 },
  },
  limitDrive: {
    id: "limitDrive",
    title: "Limit Drive",
    description: "Increase movement speed by 6% of base speed",
    maxRank: 5,
    weight: 0.9,
    effect: { type: "moveSpeed", amountPerRank: 0.06, maximumBonus: 0.3 },
  },
  limitCore: {
    id: "limitCore",
    title: "Limit Core",
    description: "Gain 8 max HP",
    maxRank: null,
    weight: 0.9,
    effect: { type: "maxHp", amountPerRank: 8 },
  },
};
