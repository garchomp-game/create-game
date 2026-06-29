export type Vec2 = {
  x: number;
  y: number;
};

export type RandomSource = () => number;

export type GameStatus = "title" | "playing" | "paused" | "upgradeSelect" | "gameOver";

export const ENEMY_TYPE_IDS = ["chaser", "brute", "fast", "ranged"] as const;
export type EnemyTypeId = (typeof ENEMY_TYPE_IDS)[number];
export type EnemyBehavior = "chase" | "ranged";

export const WEAPON_TYPE_IDS = ["pulse", "spread", "pierce"] as const;
export type WeaponTypeId = (typeof WEAPON_TYPE_IDS)[number];

export const UPGRADE_IDS = [
  "rapidFire",
  "swiftStep",
  "vitalCore",
  "overdriveRounds",
  "splitShot",
  "piercingRounds",
] as const;
export type UpgradeId = (typeof UPGRADE_IDS)[number];

export type Difficulty = {
  spawnInterval: number;
  speedMultiplier: number;
  maxEnemies: number;
};

export type WaveBand = Difficulty & {
  start: number;
  spawnBudget: number;
  enemyWeights: Partial<Record<EnemyTypeId, number>>;
};

export type ArenaSimulationConfig = {
  width: number;
  height: number;
};

export type PlayerSimulationConfig = {
  x: number;
  y: number;
  radius: number;
  speed: number;
  maxHp: number;
  damageCooldown: number;
};

export type WeaponSimulationConfig = {
  radius: number;
  speed: number;
  lifetime: number;
  interval: number;
  damage: number;
  projectileCount: number;
  spreadAngle: number;
  pierceCount: number;
  ricochetCount: number;
};

export type PickupSimulationConfig = {
  xpRadius: number;
  healRadius: number;
  magnetRadius: number;
  magnetSpeed: number;
  placementStep: number;
  placementRings: number;
  healDropChance: number;
  healDropPityThreshold: number;
  healDropPityBonus: number;
  healDropMaxChance: number;
  healRatio: number;
  healMinimum: number;
  healLifetime: number;
  healEnemyMultipliers: Record<EnemyTypeId, number>;
};

export type LevelingSimulationConfig = {
  baseXp: number;
  growth: number;
  upgradeChoiceCount: number;
};

export type UpgradeEffect =
  | { type: "fireIntervalMultiplier"; multiplier: number }
  | { type: "moveSpeedMultiplier"; multiplier: number }
  | { type: "projectileSpeedMultiplier"; multiplier: number }
  | { type: "maxHp"; amount: number }
  | { type: "projectileCount"; amount: number }
  | { type: "pierce"; amount: number };

export type UpgradeDefinition = {
  id: UpgradeId;
  title: string;
  description: string;
  maxRank: number;
  weight: number;
  effect: UpgradeEffect;
};

export type RangedEnemySimulationConfig = {
  preferredRange: number;
  attackInterval: number;
  projectileRadius: number;
  projectileSpeed: number;
  projectileLifetime: number;
  projectileDamage: number;
};

export type EnemySimulationConfig = {
  radius: number;
  hp: number;
  damage: number;
  speed: number;
  score: number;
  xpValue: number;
  spawnCost: number;
  behavior: EnemyBehavior;
  ranged?: RangedEnemySimulationConfig;
};

export type Obstacle = {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
};

export type SimulationConfig = {
  seed: number;
  arena: ArenaSimulationConfig;
  player: PlayerSimulationConfig;
  defaultWeapon: WeaponTypeId;
  weapons: Record<WeaponTypeId, WeaponSimulationConfig>;
  enemies: Record<EnemyTypeId, EnemySimulationConfig>;
  waves: WaveBand[];
  pickup: PickupSimulationConfig;
  leveling: LevelingSimulationConfig;
  upgrades: Record<UpgradeId, UpgradeDefinition>;
  obstacles: Obstacle[];
};

export type EnemyViewShape = "circle" | "square" | "diamond" | "triangle" | "hex";
export type EnemyViewMark = "ring" | "cross" | "slash" | "dot";

export type EnemyViewConfig = {
  color: number;
  stroke: number;
  shape: EnemyViewShape;
  mark: EnemyViewMark;
  markColor: number;
};

export type ViewConfig = {
  arena: {
    background: number;
    border: number;
  };
  player: {
    color: number;
    stroke: number;
  };
  bullet: {
    color: number;
  };
  enemy: Record<EnemyTypeId, EnemyViewConfig>;
  enemyProjectile: {
    color: number;
    stroke: number;
    core: number;
  };
  pickup: {
    xpColor: number;
    healFill: number;
    healStroke: number;
    healCross: number;
  };
  obstacle: {
    fill: number;
    stroke: number;
    radius: number;
  };
};

export type GameConfig = {
  simulation: SimulationConfig;
  view: ViewConfig;
};

export type CircleBody = {
  position: Vec2;
  radius: number;
};

export type Player = CircleBody & {
  id: "player";
};

export type Bullet = CircleBody & {
  id: string;
  weaponType: WeaponTypeId;
  velocity: Vec2;
  lifetime: number;
  damage: number;
  pierceRemaining: number;
  ricochetRemaining: number;
  hitEnemyIds: string[];
};

export type Enemy = CircleBody & {
  id: string;
  typeId: EnemyTypeId;
  hp: number;
  damage: number;
  speed: number;
  score: number;
  xpValue: number;
  behavior: EnemyBehavior;
  attackTimer: number;
  enteredArena: boolean;
};

export type EnemyProjectile = CircleBody & {
  id: string;
  velocity: Vec2;
  lifetime: number;
  damage: number;
};

export type Pickup = CircleBody & {
  id: string;
  kind: "xp" | "heal";
  xpValue: number;
  healValue: number;
  lifetime: number | null;
};

export type GameState = {
  status: GameStatus;
  elapsed: number;
  score: number;
  hp: number;
  spawnTimer: number;
  shotTimer: number;
  damageCooldown: number;
  lastAim: Vec2;
  weaponType: WeaponTypeId;
};

export type ProgressionState = {
  level: number;
  xp: number;
  xpToNext: number;
  pendingUpgradeChoices: UpgradeId[];
  upgradeRanks: Record<UpgradeId, number>;
};

export type RuntimeModifiers = {
  playerSpeedMultiplier: number;
  fireIntervalMultiplier: number;
  projectileSpeedMultiplier: number;
  maxHpBonus: number;
  projectileCountBonus: number;
  pierceBonus: number;
  healDropMissCount: number;
  healDropRollIndex: number;
};

export type WeaponRunStats = {
  shotsFired: number;
  projectilesFired: number;
  hits: number;
  kills: number;
};

export type PlayerDamageSource =
  | { kind: "contact"; enemyId: string; enemyType: EnemyTypeId }
  | { kind: "projectile"; projectileId: string };

export type DamageTakenBySource = {
  contact: number;
  projectile: number;
};

export type RunStats = {
  shotsFired: number;
  enemiesKilled: number;
  hitsTaken: number;
  damageTaken: number;
  damageTakenBySource: DamageTakenBySource;
  lastDamageSource: PlayerDamageSource | null;
  xpCollected: number;
  pickupsCollected: number;
  hpRecovered: number;
  healPickupsCollected: number;
  effectiveHealPickupsCollected: number;
  upgradesChosen: number;
  weaponMetrics: Record<WeaponTypeId, WeaponRunStats>;
};

export type RunResultSummary = Omit<RunStats, "damageTakenBySource" | "lastDamageSource"> & {
  elapsed: number;
  score: number;
  hp: number;
  level: number;
  xp: number;
  damageTakenBySource: DamageTakenBySource;
  lastDamageSource: PlayerDamageSource | null;
};

export type WorldState = {
  state: GameState;
  progression: ProgressionState;
  runtime: RuntimeModifiers;
  stats: RunStats;
  player: Player;
  bullets: Bullet[];
  enemies: Enemy[];
  enemyProjectiles: EnemyProjectile[];
  pickups: Pickup[];
  obstacles: Obstacle[];
  nextBulletId: number;
  nextEnemyId: number;
  nextEnemyProjectileId: number;
  nextPickupId: number;
};

export type InputSnapshot = {
  move: Vec2;
  aimWorld: Vec2 | null;
  startPressed: boolean;
  shootHeld: boolean;
  restartPressed: boolean;
  pausePressed: boolean;
  quitToTitlePressed: boolean;
  upgradeChoicePressed: number | null;
};

export type GameEvent =
  | { type: "game.started" }
  | { type: "game.restart.requested" }
  | { type: "game.title.requested" }
  | { type: "game.paused"; elapsed: number }
  | { type: "game.resumed"; elapsed: number }
  | {
      type: "shot.fired";
      bulletIds: string[];
      weaponType: WeaponTypeId;
      position: Vec2;
      direction: Vec2;
      projectileCount: number;
    }
  | {
      type: "enemy.hit";
      enemyId: string;
      enemyType: EnemyTypeId;
      weaponType: WeaponTypeId;
      damage: number;
      hpAfter: number;
    }
  | { type: "enemy.spawned"; enemyId: string; enemyType: EnemyTypeId; position: Vec2 }
  | {
      type: "enemy.killed";
      enemyId: string;
      enemyType: EnemyTypeId;
      weaponType: WeaponTypeId;
      scoreAwarded: number;
      xpAwarded: number;
      position: Vec2;
    }
  | {
      type: "pickup.spawned";
      pickupId: string;
      pickupKind: "xp";
      position: Vec2;
      xpValue: number;
      healValue: 0;
      lifetime: null;
    }
  | {
      type: "pickup.spawned";
      pickupId: string;
      pickupKind: "heal";
      position: Vec2;
      xpValue: 0;
      healValue: number;
      lifetime: number;
    }
  | {
      type: "pickup.collected";
      pickupId: string;
      pickupKind: "xp";
      xpValue: number;
      healValue: 0;
      hpRecovered: 0;
    }
  | {
      type: "pickup.collected";
      pickupId: string;
      pickupKind: "heal";
      xpValue: 0;
      healValue: number;
      hpRecovered: number;
    }
  | { type: "pickup.expired"; pickupId: string; pickupKind: "heal" }
  | { type: "player.level_up"; level: number; choices: UpgradeId[] }
  | { type: "upgrade.offered"; level: number; choices: UpgradeId[] }
  | { type: "upgrade.selected"; upgradeId: UpgradeId; rank: number; level: number; effect: UpgradeEffect }
  | {
      type: "enemy.projectile.fired";
      projectileId: string;
      enemyId: string;
      enemyType: EnemyTypeId;
      position: Vec2;
      direction: Vec2;
    }
  | { type: "player.damaged"; damage: number; hpAfter: number; source?: PlayerDamageSource }
  | { type: "game.over"; score: number; elapsed: number };

export type GameMetric =
  | {
      type: "gauge";
      name:
        | "world.bullets"
        | "world.enemies"
        | "world.enemy_projectiles"
        | "world.pickups"
        | "wave.start"
        | "wave.spawn_budget"
        | "wave.max_enemies";
      value: number;
    }
  | { type: "timing"; name: "frame.dt_ms" | "frame.raw_dt_ms"; valueMs: number };

export type StepWorldResult = {
  events: GameEvent[];
  metrics: GameMetric[];
};
