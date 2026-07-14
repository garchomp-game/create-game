export type Vec2 = {
  x: number;
  y: number;
};

export type RandomSource = () => number;

export type GameStatus =
  | "title"
  | "weaponSelect"
  | "playing"
  | "paused"
  | "upgradeSelect"
  | "contractSelect"
  | "gameOver";

export const ENEMY_TYPE_IDS = ["chaser", "brute", "fast", "ranged"] as const;
export type EnemyTypeId = (typeof ENEMY_TYPE_IDS)[number];
export type EnemyBehavior = "chase" | "ranged";

export const WEAPON_TYPE_IDS = ["pulse", "spread", "pierce"] as const;
export type WeaponTypeId = (typeof WEAPON_TYPE_IDS)[number];
export const ARENA_BOUNDARY_SIDES = ["left", "right", "top", "bottom"] as const;
export type ArenaBoundarySide = (typeof ARENA_BOUNDARY_SIDES)[number];

export const UPGRADE_IDS = [
  "rapidFire",
  "swiftStep",
  "vitalCore",
  "overdriveRounds",
  "splitShot",
  "pulseFocus",
  "piercingRounds",
  "pulseRicochet",
  "spreadSweep",
] as const;
export type UpgradeId = (typeof UPGRADE_IDS)[number];

export const EXTRA_UPGRADE_IDS = [
  "limitPower",
  "limitCycle",
  "limitDrive",
  "limitCore",
] as const;
export type ExtraUpgradeId = (typeof EXTRA_UPGRADE_IDS)[number];
export type ProgressionChoiceId = UpgradeId | ExtraUpgradeId;

export const UPGRADE_CATEGORIES = [
  "weapon",
  "mobility",
  "survival",
  "support",
  "capstone",
] as const;
export type UpgradeCategory = (typeof UPGRADE_CATEGORIES)[number];

export type SimulationFeatures = {
  pulseRicochet: boolean;
  pulseBoundaryRicochet: boolean;
  pulseFocus: boolean;
  spreadSweep: boolean;
  roleBasedEnemyHp: boolean;
  encounterDeck: boolean;
  endlessContract: boolean;
  arenaCollapse: boolean;
  enemyNavigation: boolean;
};

export type NavigationSimulationConfig = {
  cellSize: number;
  obstacleClearance: number;
};

export const CONTRACT_CHOICE_IDS = ["standard", "overdrive"] as const;
export type ContractChoiceId = (typeof CONTRACT_CHOICE_IDS)[number];

export const ENCOUNTER_IDS = ["rangedSurge", "swarmRush", "bruteSiege"] as const;
export type EncounterId = (typeof ENCOUNTER_IDS)[number];

export type EncounterDefinitionSimulationConfig = {
  warningDuration: number;
  activeDuration: number;
  recoveryDuration: number;
  spawnIntervalMultiplier: number;
  spawnBudget: number;
  enemyWeights: Partial<Record<EnemyTypeId, number>>;
};

export type EncounterDirectorSimulationConfig = {
  minStart: number;
  maxStart: number;
  minInterval: number;
  maxInterval: number;
  minimumInterval: number;
  intervalReductionPerThreatTier: number;
  definitions: Record<EncounterId, EncounterDefinitionSimulationConfig>;
};

export type EndlessContractSimulationConfig = {
  offerAt: number;
  enemySpeedMultiplier: number;
  scoreMultiplier: number;
};

export type ArenaCollapseSimulationConfig = {
  startsAt: number;
  stepSeconds: number;
  warningDuration: number;
  insetPerStep: number;
  damageInterval: number;
  baseDamage: number;
  damageGrowth: number;
};

export type EncounterSimulationConfig = {
  director: EncounterDirectorSimulationConfig;
  contract: EndlessContractSimulationConfig;
  collapse: ArenaCollapseSimulationConfig;
};

export type ThreatSimulationConfig = {
  pressureStartAt: number;
  pressureStepSeconds: number;
  spawnIntervalStep: number;
  minimumSpawnInterval: number;
  speedMultiplierStep: number;
  maximumSpeedMultiplier: number;
  maxEnemiesStep: number;
  maximumEnemies: number;
  spawnBudgetStepInterval: number;
  maximumSpawnBudget: number;
  statStartAt: number;
  statStepSeconds: number;
  enemyHpGrowth: number;
  enemyHpGrowthByType: Record<EnemyTypeId, number>;
  enemyDamageGrowth: number;
  enemyScoreGrowth: number;
  rangedProjectileSpeedGrowth: number;
  maximumProjectileSpeedMultiplier: number;
  rangedAttackSpeedGrowth: number;
  maximumAttackSpeedMultiplier: number;
  maximumEnemyProjectiles: number;
  healDropDecay: number;
  minimumHealDropMultiplier: number;
};

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
  hitCapacity: number;
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
  maxXp: number;
  upgradeChoiceCount: number;
  extra: {
    baseXp: number;
    growth: number;
    maxXp: number;
    upgradeChoiceCount: number;
  };
};

export type UpgradeEffect =
  | { type: "fireIntervalMultiplier"; multiplier: number }
  | { type: "moveSpeedMultiplier"; multiplier: number }
  | {
      type: "projectileSpeedMultiplier";
      multiplier: number;
      weaponMultipliers?: Partial<Record<WeaponTypeId, number>>;
    }
  | { type: "maxHp"; amount: number }
  | { type: "projectileCount"; amount: number }
  | { type: "hitCapacity"; amount: number }
  | { type: "ricochet"; amount: number }
  | {
      type: "pulseFocus";
      bonusPerStack: number;
      stacksPerRank: number;
      duration: number;
    }
  | {
      type: "spreadSweep";
      distinctTargets: number;
      nextIntervalMultiplier: number;
    };

export type UpgradeRequirements = {
  weaponIds?: WeaponTypeId[];
  minimumCategoryRanks?: Partial<Record<UpgradeCategory, number>>;
  featureFlag?: keyof SimulationFeatures;
};

export type UpgradeDefinition = {
  id: UpgradeId;
  title: string;
  description: string;
  category: UpgradeCategory;
  maxRank: number;
  weight: number;
  effect: UpgradeEffect;
  requirements?: UpgradeRequirements;
};

export type ExtraUpgradeEffect =
  | { type: "projectileDamage"; amountPerRank: number }
  | { type: "fireRate"; amountPerRank: number; maximumBonus: number }
  | { type: "moveSpeed"; amountPerRank: number; maximumBonus: number }
  | { type: "maxHp"; amountPerRank: number };

export type ExtraUpgradeDefinition = {
  id: ExtraUpgradeId;
  title: string;
  description: string;
  maxRank: number | null;
  weight: number;
  effect: ExtraUpgradeEffect;
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
  features: SimulationFeatures;
  arena: ArenaSimulationConfig;
  player: PlayerSimulationConfig;
  defaultWeapon: WeaponTypeId;
  weapons: Record<WeaponTypeId, WeaponSimulationConfig>;
  enemies: Record<EnemyTypeId, EnemySimulationConfig>;
  waves: WaveBand[];
  pickup: PickupSimulationConfig;
  leveling: LevelingSimulationConfig;
  upgrades: Record<UpgradeId, UpgradeDefinition>;
  extraUpgrades: Record<ExtraUpgradeId, ExtraUpgradeDefinition>;
  navigation: NavigationSimulationConfig;
  threat: ThreatSimulationConfig;
  encounter: EncounterSimulationConfig;
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
  volleyId: number;
  weaponType: WeaponTypeId;
  velocity: Vec2;
  lifetime: number;
  damage: number;
  hitsRemaining: number;
  ricochetRemaining: number;
  ricochetsUsed: number;
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
  pulseFocusStacks?: number;
  pulseFocusExpiresAt?: number;
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
  extraLevel: number;
  extraCycle: number;
  xp: number;
  xpToNext: number;
  buildCompletedAt: number | null;
  pendingUpgradeChoices: ProgressionChoiceId[];
  upgradeRanks: Record<UpgradeId, number>;
  extraUpgradeRanks: Record<ExtraUpgradeId, number>;
  extraCycleRemaining: ExtraUpgradeId[];
};

export type EncounterPhase = "pending" | "warning" | "active" | "recovery";

export type EncounterHistoryEntry = {
  encounterId: EncounterId;
  scheduledAt: number;
  warningStartedAt: number;
  activeStartedAt: number;
  recoveryStartedAt: number;
  completedAt: number;
};

export type EncounterState = {
  director: {
    phase: EncounterPhase;
    currentId: EncounterId | null;
    scheduledAt: number | null;
    warningStartedAt: number | null;
    activeStartedAt: number | null;
    recoveryStartedAt: number | null;
    completedCount: number;
    bag: EncounterId[];
    history: EncounterHistoryEntry[];
  };
  contract: {
    status: "pending" | "offered" | "selected";
    choice: ContractChoiceId | null;
    offeredAt: number | null;
    selectedAt: number | null;
    enemySpeedMultiplier: number;
    scoreMultiplier: number;
  };
  collapse: {
    stage: number;
    inset: number;
    damageTimer: number;
  };
};

export type RuntimeModifiers = {
  playerSpeedMultiplier: number;
  fireIntervalMultiplier: number;
  projectileSpeedMultiplier: number;
  projectileDamageMultiplier: number;
  maxHpBonus: number;
  projectileCountBonus: number;
  hitCapacityBonus: number;
  ricochetBonus: number;
  pulseFocusBonusPerStack: number;
  pulseFocusMaxStacks: number;
  pulseFocusDuration: number;
  spreadSweepDistinctTargets: number;
  spreadSweepNextIntervalMultiplier: number;
  healDropMissCount: number;
  healDropRollIndex: number;
};

export type WeaponRunStats = {
  shotsFired: number;
  projectilesFired: number;
  hits: number;
  kills: number;
};

export type WeaponComparisonRunStats = {
  hitVolleys: number;
  uniqueEnemiesHit: number;
  maxUniqueEnemiesHitPerVolley: number;
  hitsByEnemyType: Record<EnemyTypeId, number>;
  killsByEnemyType: Record<EnemyTypeId, number>;
};

export type UpgradeOfferRunStat = {
  elapsed: number;
  level: number;
  choices: UpgradeId[];
  availableUpgradeIds: UpgradeId[];
  lockedUpgradeIds: UpgradeId[];
  maxedUpgradeIds: UpgradeId[];
};

export type UpgradeSelectionRunStat = {
  elapsed: number;
  level: number;
  upgradeId: UpgradeId;
  rank: number;
};

export type ExtraUpgradeSelectionRunStat = {
  elapsed: number;
  level: number;
  extraLevel: number;
  cycle: number;
  automatic: boolean;
  extraUpgradeId: ExtraUpgradeId;
  rank: number;
};

export type ProgressionRunStats = {
  firstOfferAt: number | null;
  firstSelectionAt: number | null;
  lastSelectionAt: number | null;
  buildCompletedAt: number | null;
  longestMeaningfulChoiceGap: number;
  offers: UpgradeOfferRunStat[];
  selections: UpgradeSelectionRunStat[];
  extraStartedAt: number | null;
  extraOffers: number;
  extraSelections: ExtraUpgradeSelectionRunStat[];
};

export type CapstoneRunStats = {
  upgradeId: "pulseRicochet" | "spreadSweep" | null;
  acquiredAt: number | null;
  activations: number;
  followUpHits: number;
  followUpUniqueEnemiesHit: number;
  maxFollowUpUniqueEnemiesPerVolley: number;
  obstacleRicochets: number;
  boundaryRicochets: number;
  boundaryRicochetsBySide: Record<ArenaBoundarySide, number>;
  spreadSweepTriggers: number;
  spreadSweepConsumes: number;
};

export type WeaponIdentityRunStats = {
  pulseFocus: {
    enhancedHits: number;
    bonusDamage: number;
    maxStacks: number;
    killsByEnemyType: Record<EnemyTypeId, number>;
  };
  spreadSweep: {
    triggers: number;
    consumes: number;
    maxDistinctTargets: number;
  };
};

export type EncounterMovementWindow = {
  distance: number;
  vector: Vec2;
};

export type EncounterRunStats = {
  scheduledAt: number | null;
  warningStartedAt: number | null;
  activeStartedAt: number | null;
  recoveryStartedAt: number | null;
  completedAt: number | null;
  rangedEnemiesSpawned: number;
  damageTakenDuringActive: number;
  killsDuringActiveByEnemyType: Record<EnemyTypeId, number>;
  movement: {
    baseline: EncounterMovementWindow;
    warning: EncounterMovementWindow;
    active: EncounterMovementWindow;
    recovery: EncounterMovementWindow;
  };
  contractOfferedAt: number | null;
  contractSelectedAt: number | null;
  contractChoice: ContractChoiceId | null;
  eventCounts: Record<EncounterId, number>;
  eventsCompleted: number;
  collapseStartedAt: number | null;
  peakCollapseStage: number;
  collapseDamageTaken: number;
};

export type PlayerDamageSource =
  | { kind: "contact"; enemyId: string; enemyType: EnemyTypeId }
  | { kind: "projectile"; projectileId: string }
  | { kind: "collapse"; stage: number };

export type DamageTakenBySource = {
  contact: number;
  projectile: number;
  collapse: number;
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
  extraUpgradesChosen: number;
  movementDistance: number;
  navigationMetrics: EnemyNavigationRunStats;
  progressionMetrics: ProgressionRunStats;
  capstoneMetrics: CapstoneRunStats;
  weaponIdentityMetrics: WeaponIdentityRunStats;
  encounterMetrics: EncounterRunStats;
  weaponMetrics: Record<WeaponTypeId, WeaponRunStats>;
  weaponComparisonMetrics: Record<WeaponTypeId, WeaponComparisonRunStats>;
};

export type EnemyNavigationRunStats = {
  directFrames: number;
  pathFrames: number;
  fallbackFrames: number;
  fieldBuilds: number;
};

export type ActiveVolleyAnalytics = {
  weaponType: WeaponTypeId;
  enemyIds: string[];
  postRicochetEnemyIds: string[];
  spreadSweepEnemyIds: string[];
  spreadSweepTriggered: boolean;
};

export type RunAnalyticsState = {
  activeVolleys: Record<string, ActiveVolleyAnalytics>;
};

export type WeaponIdentityState = {
  spreadSweepCharge: boolean;
};

export type RunResultSummary = Omit<
  RunStats,
  | "damageTakenBySource"
  | "lastDamageSource"
  | "movementDistance"
  | "navigationMetrics"
  | "progressionMetrics"
  | "encounterMetrics"
  | "weaponComparisonMetrics"
> & {
  elapsed: number;
  score: number;
  hp: number;
  level: number;
  extraLevel: number;
  extraCycle: number;
  xp: number;
  threatTier: number;
  collapseStage: number;
  damageTakenBySource: DamageTakenBySource;
  lastDamageSource: PlayerDamageSource | null;
};

export type WorldState = {
  state: GameState;
  progression: ProgressionState;
  runtime: RuntimeModifiers;
  stats: RunStats;
  analytics: RunAnalyticsState;
  weaponIdentity: WeaponIdentityState;
  encounter: EncounterState;
  player: Player;
  bullets: Bullet[];
  enemies: Enemy[];
  enemyProjectiles: EnemyProjectile[];
  pickups: Pickup[];
  obstacles: Obstacle[];
  nextBulletId: number;
  nextVolleyId: number;
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
  contractChoicePressed?: number | null;
};

export type GameEvent =
  | { type: "game.started" }
  | { type: "game.restart.requested" }
  | { type: "game.title.requested" }
  | { type: "game.paused"; elapsed: number }
  | { type: "game.resumed"; elapsed: number }
  | {
      type: "shot.fired";
      volleyId: number;
      bulletIds: string[];
      weaponType: WeaponTypeId;
      position: Vec2;
      direction: Vec2;
      projectileCount: number;
    }
  | {
      type: "enemy.hit";
      bulletId: string;
      volleyId: number;
      enemyId: string;
      enemyType: EnemyTypeId;
      weaponType: WeaponTypeId;
      ricochetsUsed: number;
      damage: number;
      hpAfter: number;
    }
  | {
      type: "bullet.ricocheted";
      bulletId: string;
      volleyId: number;
      weaponType: WeaponTypeId;
      surfaceKind: "obstacle" | "arenaBoundary";
      obstacleId: string | null;
      boundarySide: ArenaBoundarySide | null;
      position: Vec2;
      ricochetsUsed: number;
      ricochetsRemaining: number;
    }
  | {
      type: "pulse.focus.hit";
      enemyId: string;
      enemyType: EnemyTypeId;
      stackBefore: number;
      stackAfter: number;
      bonusDamage: number;
      killed: boolean;
    }
  | {
      type: "spread.sweep.triggered";
      volleyId: number;
      distinctTargets: number;
    }
  | { type: "spread.sweep.consumed"; volleyId: number }
  | { type: "enemy.spawned"; enemyId: string; enemyType: EnemyTypeId; position: Vec2 }
  | {
      type: "enemy.killed";
      bulletId: string;
      volleyId: number;
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
  | {
      type: "upgrade.offered";
      level: number;
      choices: UpgradeId[];
      availableUpgradeIds: UpgradeId[];
      lockedUpgradeIds: UpgradeId[];
      maxedUpgradeIds: UpgradeId[];
    }
  | { type: "upgrade.selected"; upgradeId: UpgradeId; rank: number; level: number; effect: UpgradeEffect }
  | { type: "build.completed"; level: number; elapsed: number }
  | {
      type: "extra.level_up";
      level: number;
      extraLevel: number;
      cycle: number;
      choices: ExtraUpgradeId[];
    }
  | {
      type: "extra.upgrade.offered";
      level: number;
      extraLevel: number;
      cycle: number;
      choices: ExtraUpgradeId[];
    }
  | {
      type: "extra.upgrade.selected";
      extraUpgradeId: ExtraUpgradeId;
      rank: number;
      level: number;
      extraLevel: number;
      cycle: number;
      automatic: boolean;
      effect: ExtraUpgradeEffect;
    }
  | { type: "extra.cycle.completed"; cycle: number; extraLevel: number }
  | { type: "encounter.scheduled"; encounterId: EncounterId; scheduledAt: number }
  | { type: "encounter.warning.started"; encounterId: EncounterId; elapsed: number }
  | { type: "encounter.started"; encounterId: EncounterId; elapsed: number }
  | { type: "encounter.recovery.started"; encounterId: EncounterId; elapsed: number }
  | { type: "encounter.completed"; encounterId: EncounterId; elapsed: number }
  | { type: "collapse.advanced"; stage: number; inset: number; elapsed: number }
  | { type: "contract.offered"; elapsed: number }
  | {
      type: "contract.selected";
      choice: ContractChoiceId;
      elapsed: number;
      enemySpeedMultiplier: number;
      scoreMultiplier: number;
    }
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
        | "wave.max_enemies"
        | "endless.threat_tier"
        | "endless.collapse_stage";
      value: number;
    }
  | { type: "timing"; name: "frame.dt_ms" | "frame.raw_dt_ms"; valueMs: number };

export type StepWorldResult = {
  events: GameEvent[];
  metrics: GameMetric[];
};
