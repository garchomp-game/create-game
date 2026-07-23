import type {
  EncounterDirection,
  EncounterDirectorHistoryEntry,
  EncounterDirectorState,
} from "./encounterDirector";
import type { SpawnGeometryId } from "./structuredSpawning";
import type { TutorialStepId } from "./tutorial";
import type {
  ExProtocolEvolutionId,
  ExProtocolId,
  ExProtocolProgressionState,
  ExProtocolProjectileState,
} from "./exProtocols";

export type Vec2 = {
  x: number;
  y: number;
};

export type RandomSource = () => number;

export type GameStatus =
  | "title"
  | "weaponSelect"
  | "trainingBriefing"
  | "playing"
  | "paused"
  | "upgradeSelect"
  | "protocolSelect"
  | "evolutionSelect"
  | "contractSelect"
  | "trainingComplete"
  | "gameOver";

export const ENEMY_TYPE_IDS = ["chaser", "brute", "fast", "ranged"] as const;
export type EnemyTypeId = (typeof ENEMY_TYPE_IDS)[number];
export type EnemyBehavior = "chase" | "ranged";

export const BOSS_ATTACK_IDS = [
  "targeted-salvo",
  "escort-pincer",
  "command-pulse",
] as const;
export type BossAttackId = (typeof BOSS_ATTACK_IDS)[number];

export const WEAPON_TYPE_IDS = ["pulse", "spread", "pierce"] as const;
export type WeaponTypeId = (typeof WEAPON_TYPE_IDS)[number];
export const ARENA_BOUNDARY_SIDES = ["left", "right", "top", "bottom"] as const;
export type ArenaBoundarySide = (typeof ARENA_BOUNDARY_SIDES)[number];
export type RicochetSurfaceKind = "obstacle" | "arenaBoundary";

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

export type ProgressionPendingChoice =
  | { kind: "upgrade"; choices: UpgradeId[] }
  | { kind: "protocol"; choices: ExProtocolId[] }
  | {
      kind: "evolution-one";
      protocolId: ExProtocolId;
      choices: ExProtocolEvolutionId[];
    }
  | {
      kind: "evolution-two";
      protocolId: ExProtocolId;
      choices: ExProtocolEvolutionId[];
    }
  | { kind: "limit-break"; choices: ExtraUpgradeId[] };

export const UPGRADE_CATEGORIES = [
  "weapon",
  "mobility",
  "survival",
  "support",
  "capstone",
] as const;
export type UpgradeCategory = (typeof UPGRADE_CATEGORIES)[number];

export type SimulationFeatures = {
  exProtocols: boolean;
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
      lineBonusPerStack: number;
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
  exProtocolOfferPolicy?: "fixed-compatible" | "disabled";
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

export type VolleyKind = "normal" | "ex.tidal";

export type ProjectileRole = "center" | "inner" | "edge" | "protocol";

export type CandidateBulletMetadata = {
  creationOrdinal: number;
  hitCapacityAtFire: number;
  volleyKind: VolleyKind;
  projectileIndex: number;
  projectileCount: number;
  projectileRole: ProjectileRole;
  activationId: number | null;
  consumedCoreSpreadSweep: boolean;
  protocolState: ExProtocolProjectileState | null;
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
  ricochetSurfaceKind: RicochetSurfaceKind | null;
  ricochetBoundarySide: ArenaBoundarySide | null;
  hitEnemyIds: string[];
  candidate?: CandidateBulletMetadata;
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
  boss?: { bossId: string };
  bossAttackSource?: { bossId: string; bossAttackId: BossAttackId };
  elite?: CommanderEliteState;
  support?: CommanderSupportState;
  action?: ChargerActionState;
  pulseFocusStacks?: number;
  pulseFocusExpiresAt?: number;
  candidate?: {
    creationOrdinal: number;
  };
};

export type CommanderEliteState = {
  kind: "commander";
  trait: "reinforcement";
  maximumHp: number;
  phase: "cooldown" | "telegraph";
  spawnedAt: number;
  nextTraitAt: number;
  telegraphStartedAt: number | null;
  reinforcementSpawnAt: number | null;
  reinforcementDirection: "north" | "east" | "south" | "west" | null;
  activations: number;
};

export type CommanderSupportState = {
  sourceEnemyId: string;
  speedMultiplier: number;
};

export type ChargerActionState = {
  kind: "charger";
  phase: "approach" | "telegraph" | "prepare" | "charge" | "recovery";
  spawnedAt: number;
  phaseStartedAt: number;
  phaseEndsAt: number;
  chargeDirection: Vec2 | null;
  chargeStartPosition: Vec2 | null;
  charges: number;
  hitPlayerDuringCharge: boolean;
};

export type EnemyProjectileCategory = "standard" | "boss" | "beam" | "hazard";

export type EnemyProjectile = CircleBody & {
  id: string;
  velocity: Vec2;
  lifetime: number;
  damage: number;
  source?: { bossId: string; bossAttackId: BossAttackId };
  candidate?: {
    creationOrdinal: number;
    category: EnemyProjectileCategory;
    interceptible: boolean;
  };
};

export type ExProtocolDamageEffect = "relay" | "tidal" | "breakwater";

export type ExProtocolEnemyDamageSource = {
  kind: "ex-protocol";
  protocolId: ExProtocolId;
  activationId: number;
  effect: ExProtocolDamageEffect;
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
  pendingChoice?: ProgressionPendingChoice;
  exProtocol?: ExProtocolProgressionState;
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
    notBefore?: number;
  };
  collapse: {
    stage: number;
    inset: number;
    damageTimer: number;
  };
};

export type ExpeditionOutcome = "victory" | "defeat";
export const EXPEDITION_TIME_MEDALS = ["gold", "silver", "bronze"] as const;
export type ExpeditionTimeMedal = (typeof EXPEDITION_TIME_MEDALS)[number];

export type BossActionPhase = "telegraph" | "execute" | "recovery";

export type ExpeditionBossActionState = {
  attackId: BossAttackId;
  phase: BossActionPhase;
  startedAt: number;
  endsAt: number;
  aimDirection: Vec2 | null;
  ingressDirection: EncounterDirection | null;
};

export type ExpeditionBossState = {
  bossId: string;
  enemyId: string;
  status: "active" | "defeated" | "interrupted";
  maxHp: number;
  phase: 1 | 2;
  phaseChangedAt: number | null;
  spawnedAt: number;
  defeatedAt: number | null;
  nextAttackIndex: number;
  action: ExpeditionBossActionState;
  sustain: {
    healDropMinimumIntervalSeconds: number;
    nextHealDropAt: number;
    repairBudgetInitial: number | null;
    repairBudgetRemaining: number | null;
  };
};

export type ExpeditionState = {
  status: "active" | ExpeditionOutcome;
  director: EncounterDirectorState;
  actId: string;
  actTitleKey: string;
  actStartedAt: number;
  objective: string;
  reachedActIds: string[];
  currentCardTitleKey: string | null;
  currentDirection: EncounterDirection | null;
  currentGeometryId: SpawnGeometryId | null;
  spawnOverride: {
    intervalMultiplier: number;
    budget: number;
    enemyWeights: Partial<Record<EnemyTypeId, number>>;
  } | null;
  deployedCardKey: string | null;
  boss: ExpeditionBossState | null;
  outcome: ExpeditionOutcome | null;
  completedAt: number | null;
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
  pulseLineBonusPerStack: number;
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
  obstacleFollowUpHits: number;
  obstacleFollowUpKills: number;
  boundaryFollowUpHits: number;
  boundaryFollowUpKills: number;
  boundaryFollowUpHitsBySide: Record<ArenaBoundarySide, number>;
  spreadSweepTriggers: number;
  spreadSweepConsumes: number;
};

export type WeaponIdentityRunStats = {
  pulseFocus: {
    enhancedHits: number;
    bonusDamage: number;
    targetEnhancedHits: number;
    lineEnhancedHits: number;
    targetBonusDamage: number;
    lineBonusDamage: number;
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
  commander?: CommanderEncounterRunStats;
  charger?: ChargerEncounterRunStats;
  expedition?: ExpeditionEncounterRunStats;
  boss?: BossEncounterRunStats;
};

export type ExpeditionEncounterRunStats = {
  outcome: ExpeditionOutcome | null;
  reachedActId: string | null;
  reachedActIds: string[];
  actChanges: number;
  cardsSelected: number;
  cardsCompleted: number;
  cardsFailed: number;
  cardsInterrupted: number;
  cardsDeferred: number;
  structuredEnemiesSpawned: number;
  structuredSpawnsDeferred: number;
  longestMeaningfulGap: number;
  completedAt: number | null;
  tacticalScore: number;
  scoreBeforeBonus: number;
  clearScoreBonus: number;
  timeScoreBonus: number;
  timeMedal: ExpeditionTimeMedal | null;
  bossFightDuration: number | null;
  cardHistory: EncounterDirectorHistoryEntry[];
};

export type BossCommandPulseResult =
  | "hit"
  | "blocked"
  | "outside"
  | "invulnerable";

export type BossHealDropSuppressionReason =
  | "cooldown"
  | "repair-budget-exhausted";

export type BossEncounterRunStats = {
  bossId: string | null;
  spawnedAt: number | null;
  defeatedAt: number | null;
  remainingHp: number | null;
  maximumHp: number | null;
  phaseReached: 0 | 1 | 2;
  phaseChanges: number;
  lastAttackId: BossAttackId | null;
  attacksTelegraphed: Record<BossAttackId, number>;
  attacksExecuted: Record<BossAttackId, number>;
  playerHitsByAttack: Record<BossAttackId, number>;
  damageTakenByAttack: Record<BossAttackId, number>;
  escortsSpawned: number;
  killsDuringBoss: number;
  damageTakenDuringBoss: number;
  healPickupsSpawned: number;
  healValueSuppliedDuringBoss: number;
  healDropsSuppressed: number;
  healDropsSuppressedByReason: Record<BossHealDropSuppressionReason, number>;
  healPickupsCollected: number;
  healPickupsCollectedAtFullHp: number;
  healPickupsExpired: number;
  hpRecoveredDuringBoss: number;
  repairBudgetInitial: number | null;
  repairBudgetSpent: number;
  repairBudgetRemaining: number | null;
  commandPulseResults: Record<BossCommandPulseResult, number>;
  defeatedByWeapon: WeaponTypeId | null;
};

export type CommanderEncounterRunStats = {
  spawned: number;
  killed: number;
  telegraphs: number;
  traitActivations: number;
  reinforcementsSpawned: number;
  pressureReleases: number;
  supportUnitsReleased: number;
  lifetimeTotal: number;
  killsByWeapon: Record<WeaponTypeId, number>;
};

export type ChargerEncounterRunStats = {
  spawned: number;
  telegraphs: number;
  charges: number;
  playerHits: number;
  avoided: number;
  obstacleInterruptions: number;
  boundaryInterruptions: number;
  recoveries: number;
  killed: number;
  killsByWeapon: Record<WeaponTypeId, number>;
};

export type PlayerDamageSource =
  | {
      kind: "contact";
      enemyId: string;
      enemyType: EnemyTypeId;
      bossId?: string;
      bossAttackId?: BossAttackId;
    }
  | {
      kind: "projectile";
      projectileId: string;
      bossId?: string;
      bossAttackId?: BossAttackId;
    }
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
  reboundPostRicochetEnemyIds?: string[];
  reboundMasteryRefunded?: boolean;
  tidalEnemyIds?: string[];
  tidalLeftEdgeEnemyIds?: string[];
  tidalRightEdgeEnemyIds?: string[];
  tidalChargeGranted?: boolean;
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
  eliteState?: {
    commanderIds: string[];
  };
  enemyActionState?: {
    chargerIds: string[];
  };
  encounter: EncounterState;
  expedition?: ExpeditionState;
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
  tutorialContinuePressed?: boolean;
  specialPressed?: boolean;
};

export type GameEvent =
  | { type: "game.started" }
  | { type: "game.restart.requested" }
  | { type: "game.title.requested" }
  | {
      type: "tutorial.step.started";
      stepId: TutorialStepId;
      stepNumber: number;
    }
  | {
      type: "tutorial.step.activated";
      stepId: TutorialStepId;
      stepNumber: number;
    }
  | {
      type: "tutorial.step.completed";
      stepId: TutorialStepId;
      elapsed: number;
    }
  | {
      type: "tutorial.step.retried";
      stepId: TutorialStepId;
      retryCount: number;
      reason: "enemyProjectile" | "damage";
    }
  | { type: "tutorial.completed"; elapsed: number }
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
      ricochetSurfaceKind: RicochetSurfaceKind | null;
      ricochetBoundarySide: ArenaBoundarySide | null;
      damage: number;
      hpAfter: number;
    }
  | {
      type: "enemy.protocol.hit";
      source: ExProtocolEnemyDamageSource;
      enemyId: string;
      enemyType: EnemyTypeId;
      weaponType: WeaponTypeId;
      damage: number;
      hpAfter: number;
    }
  | {
      type: "bullet.ricocheted";
      bulletId: string;
      volleyId: number;
      weaponType: WeaponTypeId;
      surfaceKind: RicochetSurfaceKind;
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
      lineStacks: number;
      targetBonusDamage: number;
      lineBonusDamage: number;
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
      type: "elite.commander.spawned";
      enemyId: string;
      position: Vec2;
      trait: "reinforcement";
    }
  | {
      type: "elite.commander.reinforcement.telegraphed";
      enemyId: string;
      direction: "north" | "east" | "south" | "west";
      position: Vec2;
      spawnAt: number;
    }
  | {
      type: "elite.commander.reinforcement.deployed";
      enemyId: string;
      direction: "north" | "east" | "south" | "west";
      reinforcementIds: string[];
      position: Vec2;
    }
  | {
      type: "elite.commander.reinforcement.deferred";
      enemyId: string;
      reason: string;
    }
  | {
      type: "elite.commander.killed";
      enemyId: string;
      weaponType: WeaponTypeId;
      lifetime: number;
      traitActivations: number;
      position: Vec2;
    }
  | {
      type: "elite.commander.pressure.lowered";
      enemyId: string;
      releasedEnemyIds: string[];
      position: Vec2;
    }
  | {
      type: "elite.commander.retired";
      enemyId: string;
      reason: string;
      elapsed: number;
      position: Vec2;
    }
  | {
      type: "enemy.charger.spawned";
      enemyId: string;
      position: Vec2;
    }
  | {
      type: "enemy.charger.telegraph.started";
      enemyId: string;
      position: Vec2;
      direction: Vec2;
      duration: number;
    }
  | {
      type: "enemy.charger.prepare.started";
      enemyId: string;
      position: Vec2;
      direction: Vec2;
      duration: number;
    }
  | {
      type: "enemy.charger.charge.started";
      enemyId: string;
      position: Vec2;
      direction: Vec2;
      duration: number;
    }
  | {
      type: "enemy.charger.charge.ended";
      enemyId: string;
      position: Vec2;
      reason: "timeout" | "obstacle" | "arenaBoundary";
      hitPlayer: boolean;
      recoveryEndsAt: number;
    }
  | {
      type: "enemy.charger.recovered";
      enemyId: string;
      position: Vec2;
    }
  | {
      type: "enemy.charger.player.hit";
      enemyId: string;
      damage: number;
    }
  | {
      type: "enemy.charger.killed";
      enemyId: string;
      weaponType: WeaponTypeId;
      phase: ChargerActionState["phase"];
      position: Vec2;
    }
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
      type: "enemy.protocol.killed";
      source: ExProtocolEnemyDamageSource;
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
      lifetime: number | null;
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
      type: "ex.protocol.offered";
      weaponId: WeaponTypeId;
      exLevel: 0;
      choices: ExProtocolId[];
      elapsed: number;
    }
  | {
      type: "ex.protocol.selected";
      weaponId: WeaponTypeId;
      protocolId: ExProtocolId;
      interaction: "passive" | "active";
      exLevel: 0;
      elapsed: number;
    }
  | {
      type: "ex.protocol.skipped";
      weaponId: WeaponTypeId;
      reason: "unsupported-weapon";
      elapsed: number;
    }
  | {
      type: "ex.evolution.offered";
      protocolId: ExProtocolId;
      tier: 1 | 2;
      exLevel: number;
      choices: ExProtocolEvolutionId[];
      elapsed: number;
    }
  | {
      type: "ex.level_up";
      level: number;
      exLevel: number;
      elapsed: number;
    }
  | {
      type: "ex.evolution.selected";
      protocolId: ExProtocolId;
      tier: 1 | 2;
      evolutionId: ExProtocolEvolutionId;
      exLevel: number;
      elapsed: number;
    }
  | {
      type: "ex.mastery.unlocked";
      protocolId: ExProtocolId;
      masteryId: string;
      exLevel: number;
      elapsed: number;
    }
  | {
      type: "ex.limit_break.connected";
      protocolId: ExProtocolId | null;
      exLevel: number;
      elapsed: number;
    }
  | {
      type: "ex.redline.hit";
      projectileId: string;
      totalDamage: number;
      bonusDamageAttributed: number;
      elapsed: number;
    }
  | {
      type: "ex.special.rejected";
      protocolId: ExProtocolId;
      reason:
        | "already-armed"
        | "cooldown"
        | "not-charged"
        | "insufficient-hp";
      elapsed: number;
    }
  | {
      type: "ex.special.armed";
      protocolId: ExProtocolId;
      elapsed: number;
    }
  | {
      type: "ex.special.expired";
      protocolId: ExProtocolId;
      reason: "no-volley";
      elapsed: number;
    }
  | {
      type: "ex.rebound.restored";
      volleyId: number;
      restoredCapacity: number;
      elapsed: number;
    }
  | {
      type: "ex.rebound.cooldown.refunded";
      volleyId: number;
      remainingBefore: number;
      remainingAfter: number;
      elapsed: number;
    }
  | {
      type: "ex.relay.anchor.created";
      enemyId: string;
      volleyId: number;
      refreshed: boolean;
      expiresAt: number;
      elapsed: number;
    }
  | {
      type: "ex.relay.resolved";
      activationId: number;
      targetCount: number;
      damage: number;
      elapsed: number;
    }
  | {
      type: "ex.relay.blocked";
      anchorEnemyId: string;
      endpointEnemyId: string;
      elapsed: number;
    }
  | {
      type: "ex.tidal.charged";
      charge: number;
      maxCharge: number;
      elapsed: number;
    }
  | {
      type: "ex.special.activated";
      protocolId: ExProtocolId;
      activationId: number;
      elapsed: number;
    }
  | {
      type: "ex.protocol.volley.fired";
      protocolId: ExProtocolId;
      activationId: number;
      volleyId: number;
      projectileIds: string[];
      projectileCount: number;
      elapsed: number;
    }
  | {
      type: "ex.tidal.backwash.triggered";
      activationId: number;
      elapsed: number;
    }
  | {
      type: "ex.tidal.second-crest.triggered";
      activationId: number;
      elapsed: number;
    }
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
  | {
      type: "expedition.act.changed";
      actId: string;
      titleKey: string;
      elapsed: number;
    }
  | {
      type: "expedition.encounter.selected";
      cardId: string;
      titleKey: string;
      actId: string;
      direction: EncounterDirection;
      elapsed: number;
    }
  | {
      type:
        | "expedition.encounter.active.started"
        | "expedition.encounter.recovery.started";
      cardId: string;
      elapsed: number;
    }
  | {
      type: "expedition.encounter.deployment.requested";
      cardId: string;
      attempt: number;
      elapsed: number;
      deadlineAt: number;
    }
  | {
      type: "expedition.encounter.deployment.deferred";
      cardId: string;
      attempt: number;
      elapsed: number;
      reason: string;
      nextAttemptAt: number;
    }
  | {
      type:
        | "expedition.encounter.completed"
        | "expedition.encounter.failed"
        | "expedition.encounter.interrupted";
      cardId: string;
      elapsed: number;
      reason: string;
    }
  | { type: "expedition.encounter.deferred"; actId: string; elapsed: number }
  | {
      type: "expedition.spawn.deployed";
      cardId: string;
      enemyIds: string[];
      elapsed: number;
    }
  | {
      type: "expedition.spawn.deferred";
      cardId: string;
      reason: string;
      elapsed: number;
    }
  | {
      type: "boss.spawned";
      bossId: string;
      enemyId: string;
      position: Vec2;
      maximumHp: number;
      repairBudgetInitial: number | null;
      elapsed: number;
    }
  | {
      type: "boss.phase.changed";
      bossId: string;
      enemyId: string;
      phase: 2;
      elapsed: number;
    }
  | {
      type: "boss.attack.telegraphed";
      bossId: string;
      enemyId: string;
      attackId: BossAttackId;
      phase: 1 | 2;
      duration: number;
      aimDirection: Vec2 | null;
      ingressDirection: EncounterDirection | null;
      elapsed: number;
    }
  | {
      type: "boss.attack.executed";
      bossId: string;
      enemyId: string;
      attackId: BossAttackId;
      phase: 1 | 2;
      projectileIds: string[];
      elapsed: number;
    }
  | {
      type: "boss.attack.recovery.started";
      bossId: string;
      enemyId: string;
      attackId: BossAttackId;
      phase: 1 | 2;
      recoveryEndsAt: number;
      elapsed: number;
    }
  | {
      type: "boss.command-pulse.resolved";
      bossId: string;
      enemyId: string;
      phase: 1 | 2;
      radius: number;
      damage: number;
      result: BossCommandPulseResult;
      elapsed: number;
    }
  | {
      type: "boss.heal-drop.suppressed";
      bossId: string;
      count: number;
      reason: BossHealDropSuppressionReason;
      elapsed: number;
    }
  | {
      type: "boss.escort.deployed";
      bossId: string;
      attackId: "escort-pincer";
      direction: EncounterDirection;
      enemyIds: string[];
      elapsed: number;
    }
  | {
      type: "boss.escort.deferred";
      bossId: string;
      attackId: "escort-pincer";
      reason: string;
      elapsed: number;
    }
  | {
      type: "boss.defeated";
      bossId: string;
      enemyId: string;
      weaponType: WeaponTypeId;
      position: Vec2;
      elapsed: number;
    }
  | {
      type: "expedition.completed";
      actId: string;
      elapsed: number;
      score: number;
      tacticalScore: number;
      scoreBeforeBonus: number;
      clearScoreBonus: number;
      timeScoreBonus: number;
      timeMedal: ExpeditionTimeMedal | null;
      bossFightDuration: number | null;
    }
  | {
      type: "expedition.failed";
      actId: string;
      elapsed: number;
      score: number;
      tacticalScore: number;
      scoreBeforeBonus: number;
      clearScoreBonus: number;
      timeScoreBonus: number;
      timeMedal: ExpeditionTimeMedal | null;
      bossFightDuration: number | null;
    }
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
        | "world.difficulty_elapsed"
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
