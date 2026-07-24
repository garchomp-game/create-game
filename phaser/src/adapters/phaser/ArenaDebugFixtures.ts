import type {
  BossAttackId,
  Enemy,
  EnemyProjectile,
  EnemyTypeId,
  InputSnapshot,
  Pickup,
  SimulationConfig,
  WorldState,
} from "../../domain/types";
import { COMMANDER_ELITE_DEFINITION } from "../../content/eliteCatalog";
import { FINAL_COMMAND_SHIP_DEFINITION } from "../../content/bossCatalog";
import { TELEGRAPH_CHARGER_DEFINITION } from "../../content/chargerCatalog";
import { spawnFinalExpeditionBoss } from "../../simulation/systems/bossSystem";

export type EnemyVisualFixtureBand = "wave2" | "wave3";
export type HealPickupFixtureMode = "damaged" | "full" | "fatal" | "visual";

export function applyHudStressFixture(world: WorldState, config: SimulationConfig): void {
  world.state.status = "playing";
  world.state.elapsed = 672.2;
  world.state.score = 92_728;
  world.runtime.maxHpBonus = 104;
  world.state.hp = config.player.maxHp + world.runtime.maxHpBonus;
  world.progression.level = 38;
  world.progression.extraLevel = 12;
  world.progression.extraCycle = 3;
  world.progression.xp = 49;
  world.progression.xpToNext = 72;
  world.progression.buildCompletedAt = 276.25;
  world.progression.pendingUpgradeChoices = [];
}

export function createDebugInput(input: Partial<InputSnapshot>): InputSnapshot {
  return {
    move: input.move ?? { x: 0, y: 0 },
    aimWorld: input.aimWorld ?? null,
    startPressed: input.startPressed ?? false,
    shootHeld: input.shootHeld ?? false,
    restartPressed: input.restartPressed ?? false,
    pausePressed: input.pausePressed ?? false,
    quitToTitlePressed: input.quitToTitlePressed ?? false,
    upgradeChoicePressed: input.upgradeChoicePressed ?? null,
    contractChoicePressed: input.contractChoicePressed ?? null,
    tutorialContinuePressed: input.tutorialContinuePressed ?? false,
    specialPressed: input.specialPressed ?? false,
  };
}

export function applyEnemyVisualFixture(
  world: WorldState,
  config: SimulationConfig,
  band: EnemyVisualFixtureBand = "wave3",
): void {
  const enemyLayout: Array<{ typeId: EnemyTypeId; x: number; y: number }> =
    band === "wave2"
      ? [
          { typeId: "chaser", x: 660, y: 205 },
          { typeId: "brute", x: 745, y: 205 },
          { typeId: "fast", x: 830, y: 205 },
        ]
      : [
          { typeId: "chaser", x: 620, y: 205 },
          { typeId: "brute", x: 705, y: 205 },
          { typeId: "fast", x: 790, y: 205 },
          { typeId: "ranged", x: 875, y: 205 },
        ];

  world.player.position = { x: 280, y: 390 };
  world.state.lastAim = { x: 0.98, y: -0.2 };
  world.enemies = enemyLayout.map((item, index) =>
    createDebugEnemy(config, item.typeId, { x: item.x, y: item.y }, index + 1),
  );

  const ranged = config.enemies.ranged.ranged;
  world.enemyProjectiles =
    band === "wave3" && ranged
      ? [
          {
            id: "debug-enemy-projectile-1",
            position: { x: 760, y: 295 },
            velocity: { x: -ranged.projectileSpeed, y: 0 },
            radius: ranged.projectileRadius,
            lifetime: ranged.projectileLifetime,
            damage: ranged.projectileDamage,
          } satisfies EnemyProjectile,
        ]
      : [];
  world.bullets = [];
  world.pickups = [];
  world.nextEnemyId = world.enemies.length + 1;
  world.nextEnemyProjectileId = world.enemyProjectiles.length + 1;
}

export function applyObstacleFrictionFixture(
  world: WorldState,
  config: SimulationConfig,
): boolean {
  const obstacle = config.obstacles[0];
  if (!obstacle) return false;

  world.player.position = {
    x: obstacle.x - config.player.radius,
    y: obstacle.y + obstacle.height / 2,
  };
  world.state.lastAim = { x: 1, y: 0 };
  world.enemies = [];
  world.bullets = [];
  world.enemyProjectiles = [];
  world.pickups = [];
  return true;
}

export function applyHealPickupFixture(
  world: WorldState,
  config: SimulationConfig,
  mode: HealPickupFixtureMode = "damaged",
): void {
  const maxHp = config.player.maxHp + world.runtime.maxHpBonus;
  const healValue = getDebugHealValue(world, config);

  world.state.status = "playing";
  world.state.damageCooldown = 0;
  world.player.position = mode === "visual" ? { x: 280, y: 390 } : { ...world.player.position };
  world.state.lastAim = { x: 1, y: 0 };
  world.enemies = [];
  world.bullets = [];
  world.enemyProjectiles = [];
  world.pickups = [];

  if (mode === "full") {
    world.state.hp = maxHp;
  } else if (mode === "fatal") {
    world.state.hp = 1;
  } else {
    world.state.hp = Math.max(1, maxHp - 40);
  }

  if (mode === "visual") {
    world.state.hp = Math.max(1, maxHp - 32);
    world.pickups = [
      {
        id: "debug-xp-pickup",
        kind: "xp",
        position: { x: 620, y: 300 },
        radius: config.pickup.xpRadius,
        xpValue: 1,
        healValue: 0,
        lifetime: null,
      },
      createDebugHealPickup(config, "debug-heal-pickup", { x: 665, y: 300 }, healValue),
    ];
    world.enemies = [createDebugEnemy(config, "chaser", { x: 740, y: 300 }, 1)];
    const ranged = config.enemies.ranged.ranged;
    if (ranged) {
      world.enemyProjectiles = [
        {
          id: "debug-heal-projectile",
          position: { x: 705, y: 300 },
          velocity: { x: 0, y: 0 },
          radius: ranged.projectileRadius,
          lifetime: ranged.projectileLifetime,
          damage: ranged.projectileDamage,
        },
      ];
    }
  } else {
    world.pickups = [
      createDebugHealPickup(
        config,
        "debug-heal-pickup",
        { ...world.player.position },
        healValue,
      ),
    ];
  }

  if (mode === "fatal") {
    const ranged = config.enemies.ranged.ranged;
    world.enemyProjectiles = [
      {
        id: "debug-fatal-projectile",
        position: { ...world.player.position },
        velocity: { x: 0, y: 0 },
        radius: ranged?.projectileRadius ?? 6,
        lifetime: ranged?.projectileLifetime ?? 1,
        damage: maxHp,
      },
    ];
  }
}

export function applyOffscreenEnemyIndicatorFixture(
  world: WorldState,
  config: SimulationConfig,
): void {
  const { width, height } = config.arena;
  world.state.status = "playing";
  world.state.elapsed = 64;
  world.player.position = { x: width / 2, y: height / 2 };
  world.state.lastAim = { x: 1, y: 0 };
  world.enemies = [
    createDebugEnemy(config, "chaser", { x: width * 0.48, y: -34 }, 1, false),
    createDebugEnemy(config, "brute", { x: width + 34, y: height * 0.35 }, 2, false),
    createDebugEnemy(config, "fast", { x: width * 0.7, y: height + 34 }, 3, false),
    createDebugEnemy(config, "ranged", { x: -34, y: height * 0.68 }, 4, false),
  ];
  world.enemyProjectiles = [];
  world.bullets = [];
  world.pickups = [];
  world.nextEnemyId = world.enemies.length + 1;
}

export function applyExpeditionCommanderFixture(
  world: WorldState,
  config: SimulationConfig,
): boolean {
  const expedition = world.expedition;
  if (!expedition) return false;

  world.state.status = "playing";
  world.state.elapsed = 182.2;
  world.state.score = 8_420;
  world.player.position = { x: 330, y: 270 };
  world.state.lastAim = { x: 1, y: 0 };
  expedition.status = "active";
  expedition.actId = "counterattack";
  expedition.actTitleKey = "act.counterattack.title";
  expedition.actStartedAt = 180;
  expedition.objective = "指揮個体を撃破する";
  expedition.reachedActIds = ["perimeter-watch", "first-assault", "counterattack"];
  expedition.currentCardTitleKey = "encounter.commander-counterattack.title";
  expedition.currentDirection = "east";
  expedition.currentGeometryId = "escort";
  expedition.deployedCardKey = "commander-counterattack:180";
  expedition.spawnOverride = {
    intervalMultiplier: 0.84,
    budget: 5,
    enemyWeights: { chaser: 1.2, ranged: 1.1 },
  };
  expedition.director = {
    ...expedition.director,
    phase: "active",
    runElapsed: 182.2,
    actElapsed: 180,
    activeElapsed: 0,
    actClockBlocked: true,
    actId: "counterattack",
    selectedActId: "counterattack",
    cardId: "commander-counterattack",
    direction: "east",
    selectedAt: 180,
    selectedAtActElapsed: 180,
    deploymentStartedAt: 182.2,
    deploymentDeadlineAt: 192.2,
    nextDeploymentAttemptAt: null,
    deploymentAttempts: 1,
    deploymentLastReason: null,
    activeStartedAt: 182.2,
    recoveryStartedAt: null,
    finishedAt: null,
    completionReason: null,
  };

  const commander = createDebugEnemy(config, "ranged", { x: 740, y: 270 }, 1);
  commander.radius *= COMMANDER_ELITE_DEFINITION.radiusMultiplier;
  commander.hp = COMMANDER_ELITE_DEFINITION.maximumHp;
  commander.elite = {
    kind: "commander",
    trait: "reinforcement",
    maximumHp: COMMANDER_ELITE_DEFINITION.maximumHp,
    phase: "cooldown",
    spawnedAt: 180,
    nextTraitAt: 190,
    telegraphStartedAt: null,
    reinforcementSpawnAt: null,
    reinforcementDirection: null,
    activations: 0,
  };
  world.enemies = [
    commander,
    createDebugEnemy(config, "chaser", { x: 695, y: 225 }, 2),
    createDebugEnemy(config, "chaser", { x: 695, y: 315 }, 3),
    createDebugEnemy(config, "ranged", { x: 805, y: 270 }, 4),
  ];
  world.eliteState = { commanderIds: [commander.id] };
  world.enemyActionState = { chargerIds: [] };
  world.bullets = [];
  world.enemyProjectiles = [];
  world.pickups = [
    {
      id: "debug-expedition-xp",
      kind: "xp",
      position: { x: 560, y: 330 },
      radius: config.pickup.xpRadius,
      xpValue: 2,
      healValue: 0,
      lifetime: null,
    },
    createDebugHealPickup(
      config,
      "debug-expedition-heal",
      { x: 605, y: 330 },
      getDebugHealValue(world, config),
    ),
  ];
  world.nextEnemyId = 5;
  world.stats.encounterMetrics.commander!.spawned = 1;
  return true;
}

export function applyExpeditionChargerFixture(
  world: WorldState,
  config: SimulationConfig,
): boolean {
  const expedition = world.expedition;
  if (!expedition) return false;

  world.state.status = "playing";
  world.state.elapsed = 302.2;
  world.state.score = 12_640;
  world.player.position = { x: 330, y: 270 };
  world.state.lastAim = { x: 1, y: 0 };
  expedition.status = "active";
  expedition.actId = "breakthrough";
  expedition.actTitleKey = "act.breakthrough.title";
  expedition.actStartedAt = 300;
  expedition.objective = "高速体と射撃体の包囲を突破する";
  expedition.reachedActIds = [
    "perimeter-watch",
    "first-assault",
    "counterattack",
    "breakthrough",
  ];
  expedition.currentCardTitleKey = "encounter.charger-breakthrough.title";
  expedition.currentDirection = "east";
  expedition.currentGeometryId = "arc";
  expedition.deployedCardKey = "charger-breakthrough:300";
  expedition.spawnOverride = {
    intervalMultiplier: 0.72,
    budget: 6,
    enemyWeights: { chaser: 0.7, fast: 1.6, ranged: 0.6 },
  };
  expedition.director = {
    ...expedition.director,
    phase: "active",
    runElapsed: 302.2,
    actElapsed: 302.2,
    activeElapsed: 0.2,
    actClockBlocked: false,
    actId: "breakthrough",
    selectedActId: "breakthrough",
    cardId: "charger-breakthrough",
    direction: "east",
    selectedAt: 300,
    selectedAtActElapsed: 300,
    deploymentStartedAt: null,
    deploymentDeadlineAt: null,
    nextDeploymentAttemptAt: null,
    deploymentAttempts: 0,
    deploymentLastReason: null,
    activeStartedAt: 302,
    recoveryStartedAt: null,
    finishedAt: null,
    completionReason: null,
  };

  const charger = createDebugEnemy(config, "fast", { x: 720, y: 270 }, 1);
  charger.radius *= TELEGRAPH_CHARGER_DEFINITION.radiusMultiplier;
  charger.hp = Math.ceil(charger.hp * TELEGRAPH_CHARGER_DEFINITION.hpMultiplier);
  charger.damage = Math.ceil(
    charger.damage * TELEGRAPH_CHARGER_DEFINITION.damageMultiplier,
  );
  charger.speed *= TELEGRAPH_CHARGER_DEFINITION.approachSpeedMultiplier;
  charger.score = Math.round(
    charger.score * TELEGRAPH_CHARGER_DEFINITION.scoreMultiplier,
  );
  charger.xpValue = Math.round(
    charger.xpValue * TELEGRAPH_CHARGER_DEFINITION.xpMultiplier,
  );
  charger.action = {
    kind: "charger",
    phase: "telegraph",
    spawnedAt: 300,
    phaseStartedAt: 302,
    phaseEndsAt: 302 + TELEGRAPH_CHARGER_DEFINITION.telegraphSeconds,
    chargeDirection: { x: -1, y: 0 },
    chargeStartPosition: { ...charger.position },
    charges: 0,
    hitPlayerDuringCharge: false,
  };
  world.enemies = [
    charger,
    createDebugEnemy(config, "fast", { x: 760, y: 205 }, 2),
    createDebugEnemy(config, "chaser", { x: 760, y: 335 }, 3),
  ];
  world.eliteState = { commanderIds: [] };
  world.enemyActionState = { chargerIds: [charger.id] };
  world.bullets = [];
  world.enemyProjectiles = [];
  world.pickups = [];
  world.nextEnemyId = 4;
  world.stats.encounterMetrics.charger!.spawned = 1;
  world.stats.encounterMetrics.charger!.telegraphs = 1;
  return true;
}

export function applyExpeditionBossFixture(
  world: WorldState,
  config: SimulationConfig,
  attackId: BossAttackId = "targeted-salvo",
  phase: 1 | 2 = 1,
): boolean {
  const expedition = world.expedition;
  if (!expedition) return false;

  world.state.status = "playing";
  world.state.elapsed = 421.4;
  world.state.score = 15_800;
  world.player.position = { x: 300, y: 310 };
  world.state.lastAim = { x: 0.72, y: -0.69 };
  world.enemies = [];
  world.enemyProjectiles = [];
  world.bullets = [];
  world.pickups = [];
  world.nextEnemyId = 1;
  expedition.status = "active";
  expedition.actId = "command-ship";
  expedition.actTitleKey = "act.command-ship.title";
  expedition.actStartedAt = 390;
  expedition.objective = "指揮艦と増援を同時に撃破する";
  expedition.reachedActIds = [
    "perimeter-watch",
    "first-assault",
    "counterattack",
    "breakthrough",
    "command-ship",
  ];
  expedition.currentCardTitleKey = "encounter.command-ship-showdown.title";
  expedition.currentDirection = "north";
  expedition.currentGeometryId = "escort";
  expedition.deployedCardKey = null;
  expedition.spawnOverride = null;
  expedition.boss = null;
  expedition.director = {
    ...expedition.director,
    phase: "active",
    runElapsed: 421.4,
    actElapsed: 421.4,
    activeElapsed: 0,
    actClockBlocked: false,
    actId: "command-ship",
    selectedActId: "command-ship",
    cardId: "command-ship-showdown",
    direction: "north",
    selectedAt: 419,
    selectedAtActElapsed: 419,
    deploymentStartedAt: null,
    deploymentDeadlineAt: null,
    nextDeploymentAttemptAt: null,
    deploymentAttempts: 0,
    deploymentLastReason: null,
    activeStartedAt: 421.4,
    recoveryStartedAt: null,
    finishedAt: null,
    completionReason: null,
  };

  spawnFinalExpeditionBoss(world, []);
  const boss = expedition.boss!;
  const enemy = world.enemies.find((candidate) => candidate.id === boss.enemyId)!;
  enemy.hp = phase === 2 ? 1_530 : 2_720;
  boss.phase = phase;
  boss.phaseChangedAt = phase === 2 ? world.state.elapsed - 0.35 : null;
  const timing = attackId === "targeted-salvo"
    ? FINAL_COMMAND_SHIP_DEFINITION.targetedSalvo
    : attackId === "escort-pincer"
      ? FINAL_COMMAND_SHIP_DEFINITION.escortPincer
      : FINAL_COMMAND_SHIP_DEFINITION.commandPulse;
  boss.action = {
    attackId,
    phase: "telegraph",
    startedAt: world.state.elapsed,
    endsAt:
      world.state.elapsed +
      timing.telegraphSeconds[phase - 1],
    aimDirection: attackId === "command-pulse" ? null : { x: -0.2, y: 0.98 },
    ingressDirection: attackId === "escort-pincer" ? "east" : null,
  };
  world.stats.encounterMetrics.boss = {
    bossId: boss.bossId,
    spawnedAt: 421.4,
    defeatedAt: null,
    remainingHp: enemy.hp,
    maximumHp: boss.maxHp,
    phaseReached: phase,
    phaseChanges: phase - 1,
    lastAttackId: null,
    attacksTelegraphed: {
      "targeted-salvo": attackId === "targeted-salvo" ? 1 : 0,
      "escort-pincer": attackId === "escort-pincer" ? 1 : 0,
      "command-pulse": attackId === "command-pulse" ? 1 : 0,
    },
    attacksExecuted: {
      "targeted-salvo": 0,
      "escort-pincer": 0,
      "command-pulse": 0,
    },
    playerHitsByAttack: {
      "targeted-salvo": 0,
      "escort-pincer": 0,
      "command-pulse": 0,
    },
    damageTakenByAttack: {
      "targeted-salvo": 0,
      "escort-pincer": 0,
      "command-pulse": 0,
    },
    escortsSpawned: 0,
    killsDuringBoss: 0,
    damageTakenDuringBoss: 0,
    healPickupsSpawned: 0,
    healValueSuppliedDuringBoss: 0,
    healDropsSuppressed: 0,
    healDropsSuppressedByReason: {
      cooldown: 0,
      "repair-budget-exhausted": 0,
    },
    healPickupsCollected: 0,
    healPickupsCollectedAtFullHp: 0,
    healPickupsExpired: 0,
    hpRecoveredDuringBoss: 0,
    repairBudgetInitial: boss.sustain.repairBudgetInitial,
    repairBudgetSpent: 0,
    repairBudgetRemaining: boss.sustain.repairBudgetRemaining,
    commandPulseResults: { hit: 0, blocked: 0, outside: 0, invulnerable: 0 },
    defeatedByWeapon: null,
  };
  return true;
}

export function armExpeditionBossDefeatFixture(world: WorldState): boolean {
  const boss = world.expedition?.boss;
  if (!boss || boss.status !== "active") return false;
  const enemy = world.enemies.find((candidate) => candidate.id === boss.enemyId);
  if (!enemy) return false;

  enemy.hp = 1;
  const volleyId = world.nextVolleyId++;
  world.bullets.push({
    id: `bullet-${world.nextBulletId++}`,
    volleyId,
    weaponType: world.state.weaponType,
    position: { ...enemy.position },
    velocity: { x: 0, y: 0 },
    radius: 4,
    lifetime: 1,
    damage: 2,
    hitsRemaining: 1,
    ricochetRemaining: 0,
    ricochetsUsed: 0,
    ricochetSurfaceKind: null,
    ricochetBoundarySide: null,
    hitEnemyIds: [],
  });
  return true;
}

function createDebugHealPickup(
  config: SimulationConfig,
  id: string,
  position: { x: number; y: number },
  healValue: number,
): Pickup {
  return {
    id,
    kind: "heal",
    position,
    radius: config.pickup.healRadius,
    xpValue: 0,
    healValue,
    lifetime: config.pickup.healLifetime,
  };
}

function createDebugEnemy(
  config: SimulationConfig,
  typeId: EnemyTypeId,
  position: { x: number; y: number },
  index: number,
  enteredArena = true,
): Enemy {
  const definition = config.enemies[typeId];
  return {
    id: `debug-enemy-${index}`,
    typeId,
    position,
    radius: definition.radius,
    hp: definition.hp,
    damage: definition.damage,
    speed: definition.speed,
    score: definition.score,
    xpValue: definition.xpValue,
    behavior: definition.behavior,
    attackTimer: definition.ranged ? definition.ranged.attackInterval : 0,
    enteredArena,
  };
}

function getDebugHealValue(world: WorldState, config: SimulationConfig): number {
  const maxHp = config.player.maxHp + world.runtime.maxHpBonus;
  return Math.max(config.pickup.healMinimum, Math.floor(maxHp * config.pickup.healRatio));
}
