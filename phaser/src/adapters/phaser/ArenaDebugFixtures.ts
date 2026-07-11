import type {
  Enemy,
  EnemyProjectile,
  EnemyTypeId,
  InputSnapshot,
  Pickup,
  SimulationConfig,
  WorldState,
} from "../../domain/types";

export type EnemyVisualFixtureBand = "wave2" | "wave3";
export type HealPickupFixtureMode = "damaged" | "full" | "fatal" | "visual";

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
