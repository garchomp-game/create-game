import type { GameConfig } from "../domain/types";
import { parseSimulationConfig, parseViewConfig } from "./configSchema";

const rawSimulationConfig = {
  seed: 20260619,
  arena: {
    width: 960,
    height: 540,
  },
  player: {
    x: 480,
    y: 270,
    radius: 16,
    speed: 240,
    maxHp: 100,
    damageCooldown: 0.25,
  },
  defaultWeapon: "pulse",
  weapons: {
    pulse: {
      radius: 4,
      speed: 520,
      lifetime: 1.1,
      interval: 0.16,
      damage: 1,
      projectileCount: 1,
      spreadAngle: 0,
      pierceCount: 1,
    },
    spread: {
      radius: 4,
      speed: 480,
      lifetime: 0.95,
      interval: 0.32,
      damage: 1,
      projectileCount: 3,
      spreadAngle: 0.52,
      pierceCount: 1,
    },
    pierce: {
      radius: 4,
      speed: 560,
      lifetime: 1.2,
      interval: 0.42,
      damage: 1,
      projectileCount: 1,
      spreadAngle: 0,
      pierceCount: 3,
    },
  },
  enemies: {
    chaser: {
      radius: 14,
      hp: 1,
      damage: 12,
      speed: 85,
      score: 10,
      xpValue: 1,
      spawnCost: 1,
      behavior: "chase",
    },
    brute: {
      radius: 20,
      hp: 3,
      damage: 18,
      speed: 55,
      score: 30,
      xpValue: 3,
      spawnCost: 3,
      behavior: "chase",
    },
    fast: {
      radius: 11,
      hp: 1,
      damage: 8,
      speed: 155,
      score: 12,
      xpValue: 1,
      spawnCost: 1,
      behavior: "chase",
    },
    ranged: {
      radius: 13,
      hp: 2,
      damage: 10,
      speed: 75,
      score: 25,
      xpValue: 2,
      spawnCost: 2,
      behavior: "ranged",
      ranged: {
        preferredRange: 220,
        attackInterval: 1.35,
        projectileRadius: 5,
        projectileSpeed: 260,
        projectileLifetime: 2.6,
        projectileDamage: 8,
      },
    },
  },
  waves: [
    {
      start: 0,
      spawnInterval: 1,
      speedMultiplier: 1,
      maxEnemies: 30,
      spawnBudget: 1,
      enemyWeights: {
        chaser: 1,
      },
    },
    {
      start: 30,
      spawnInterval: 0.75,
      speedMultiplier: 1.18,
      maxEnemies: 45,
      spawnBudget: 3,
      enemyWeights: {
        chaser: 1,
        brute: 0.65,
        fast: 0.9,
      },
    },
    {
      start: 60,
      spawnInterval: 0.55,
      speedMultiplier: 1.35,
      maxEnemies: 60,
      spawnBudget: 3,
      enemyWeights: {
        chaser: 0.8,
        brute: 0.75,
        fast: 1.15,
        ranged: 0.65,
      },
    },
  ],
  pickup: {
    xpRadius: 6,
    magnetRadius: 92,
    magnetSpeed: 380,
    placementStep: 24,
    placementRings: 4,
  },
  leveling: {
    baseXp: 3,
    growth: 1.4,
    upgradeChoiceCount: 3,
  },
  upgrades: {
    rapidFire: {
      id: "rapidFire",
      title: "Rapid Fire",
      description: "Shoot 15% faster",
      maxRank: 5,
      weight: 1,
      effect: { type: "fireIntervalMultiplier", multiplier: 0.85 },
    },
    swiftStep: {
      id: "swiftStep",
      title: "Swift Step",
      description: "Move 12% faster",
      maxRank: 5,
      weight: 1,
      effect: { type: "moveSpeedMultiplier", multiplier: 1.12 },
    },
    vitalCore: {
      id: "vitalCore",
      title: "Vital Core",
      description: "Gain 20 max HP",
      maxRank: 4,
      weight: 0.8,
      effect: { type: "maxHp", amount: 20 },
    },
    overdriveRounds: {
      id: "overdriveRounds",
      title: "Overdrive Rounds",
      description: "Projectiles fly 15% faster",
      maxRank: 5,
      weight: 0.9,
      effect: { type: "projectileSpeedMultiplier", multiplier: 1.15 },
    },
    splitShot: {
      id: "splitShot",
      title: "Split Shot",
      description: "Add one projectile",
      maxRank: 2,
      weight: 0.7,
      effect: { type: "projectileCount", amount: 1 },
    },
    piercingRounds: {
      id: "piercingRounds",
      title: "Piercing Rounds",
      description: "Add one pierce",
      maxRank: 3,
      weight: 0.8,
      effect: { type: "pierce", amount: 1 },
    },
  },
  obstacles: [
    { id: "block-a", x: 220, y: 150, width: 120, height: 32 },
    { id: "block-b", x: 620, y: 150, width: 120, height: 32 },
    { id: "block-c", x: 220, y: 360, width: 120, height: 32 },
    { id: "block-d", x: 620, y: 360, width: 120, height: 32 },
    { id: "block-e", x: 444, y: 220, width: 72, height: 32 },
  ],
};

const rawViewConfig = {
  arena: {
    background: 0x111318,
    border: 0x6b7280,
  },
  player: {
    color: 0x38bdf8,
    stroke: 0x075985,
  },
  bullet: {
    color: 0xfacc15,
  },
  enemy: {
    chaser: {
      color: 0xfb7185,
      stroke: 0x7f1d1d,
    },
    brute: {
      color: 0xf97316,
      stroke: 0x7c2d12,
    },
    fast: {
      color: 0xa3e635,
      stroke: 0x365314,
    },
    ranged: {
      color: 0xc084fc,
      stroke: 0x581c87,
    },
  },
  enemyProjectile: {
    color: 0xf472b6,
  },
  pickup: {
    xpColor: 0x22c55e,
  },
  obstacle: {
    fill: 0x475569,
    stroke: 0x94a3b8,
    radius: 5,
  },
};

export const SIMULATION_CONFIG = parseSimulationConfig(rawSimulationConfig);
export const VIEW_CONFIG = parseViewConfig(rawViewConfig);

export const GAME_CONFIG: GameConfig = {
  simulation: SIMULATION_CONFIG,
  view: VIEW_CONFIG,
};
