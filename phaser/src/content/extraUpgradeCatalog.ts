import type { ExtraUpgradeDefinition, ExtraUpgradeId } from "../domain/types";

export const EXTRA_UPGRADE_DEFINITIONS: Record<ExtraUpgradeId, ExtraUpgradeDefinition> = {
  limitPower: {
    id: "limitPower",
    title: "Limit Power",
    description: "Increase projectile damage by 8% of base damage",
    weight: 1,
    effect: { type: "projectileDamage", amountPerRank: 0.08 },
  },
  limitCycle: {
    id: "limitCycle",
    title: "Limit Cycle",
    description: "Increase fire rate with diminishing returns",
    weight: 1,
    effect: { type: "fireRate", amountPerRank: 0.025, maximumBonus: 0.5 },
  },
  limitDrive: {
    id: "limitDrive",
    title: "Limit Drive",
    description: "Increase movement speed with diminishing returns",
    weight: 0.9,
    effect: { type: "moveSpeed", amountPerRank: 0.015, maximumBonus: 0.3 },
  },
  limitCore: {
    id: "limitCore",
    title: "Limit Core",
    description: "Gain 8 max HP",
    weight: 0.9,
    effect: { type: "maxHp", amountPerRank: 8 },
  },
};
