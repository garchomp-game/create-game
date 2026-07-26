import type {
  Bullet,
  Enemy,
  EnemyProjectile,
  EnemyTypeId,
  Pickup,
  SimulationConfig,
  WorldState,
} from "../../domain/types";
import { applyExpeditionBossFixture } from "./ArenaDebugFixtures";

export const ARENA_CAPTURE_SCENARIO_IDS = [
  "rc6-control",
  "object-semantics-control",
  "maximum-density-performance",
] as const;

export type ArenaCaptureScenarioId =
  (typeof ARENA_CAPTURE_SCENARIO_IDS)[number];

export type ArenaCaptureLayerSnapshot = {
  player: number;
  obstacles: number;
  enemies: number;
  bosses: number;
  playerProjectiles: number;
  enemyProjectiles: number;
  xpPickups: number;
  healPickups: number;
  hazardTelegraphs: number;
  hudVisible: boolean;
};

export type ArenaCaptureScenarioDefinition = {
  id: ArenaCaptureScenarioId;
  baseline: "rc6" | "v08-phase-a";
  purpose:
    | "capture-harness-control"
    | "object-semantics-control"
    | "performance-stress";
  expectedBoss: boolean;
  expectsExpeditionAudioCue: boolean;
  expectedLayers: ArenaCaptureLayerSnapshot;
};

export const OBJECT_SEMANTICS_MAGNET_ANCHORS = [
  { phase: "before", distance: 110 },
  { phase: "start", distance: 92 },
  { phase: "during", distance: 52 },
  { phase: "near", distance: 22 },
] as const;

export const ARENA_CAPTURE_SCENARIOS: Record<
  ArenaCaptureScenarioId,
  ArenaCaptureScenarioDefinition
> = {
  "rc6-control": {
    id: "rc6-control",
    baseline: "rc6",
    purpose: "capture-harness-control",
    expectedBoss: true,
    expectsExpeditionAudioCue: true,
    expectedLayers: {
      player: 1,
      obstacles: 4,
      enemies: 9,
      bosses: 1,
      playerProjectiles: 4,
      enemyProjectiles: 6,
      xpPickups: 4,
      healPickups: 2,
      hazardTelegraphs: 1,
      hudVisible: true,
    },
  },
  "object-semantics-control": {
    id: "object-semantics-control",
    baseline: "v08-phase-a",
    purpose: "object-semantics-control",
    expectedBoss: false,
    expectsExpeditionAudioCue: false,
    expectedLayers: {
      player: 1,
      obstacles: 0,
      enemies: 2,
      bosses: 0,
      playerProjectiles: 2,
      enemyProjectiles: 4,
      xpPickups: 7,
      healPickups: 3,
      hazardTelegraphs: 0,
      hudVisible: true,
    },
  },
  "maximum-density-performance": {
    id: "maximum-density-performance",
    baseline: "v08-phase-a",
    purpose: "performance-stress",
    expectedBoss: false,
    expectsExpeditionAudioCue: false,
    expectedLayers: {
      player: 1,
      obstacles: 4,
      enemies: 96,
      bosses: 0,
      playerProjectiles: 60,
      enemyProjectiles: 256,
      xpPickups: 1_000,
      healPickups: 24,
      hazardTelegraphs: 0,
      hudVisible: true,
    },
  },
};

export function applyArenaCaptureScenario(
  world: WorldState,
  config: SimulationConfig,
  scenarioId: ArenaCaptureScenarioId,
): boolean {
  if (scenarioId === "object-semantics-control") {
    applyObjectSemanticsCaptureScenario(world, config);
    return true;
  }
  if (scenarioId === "maximum-density-performance") {
    applyMaximumDensityCaptureScenario(world, config);
    return true;
  }
  if (scenarioId !== "rc6-control") return false;
  if (!applyExpeditionBossFixture(world, config, "targeted-salvo", 2)) {
    return false;
  }

  world.state.status = "playing";
  world.state.hp = Math.max(
    1,
    config.player.maxHp + world.runtime.maxHpBonus - 32,
  );
  world.state.score = 18_420;
  world.player.position = { x: 480, y: 270 };
  world.state.lastAim = { x: 0, y: -1 };
  world.progression.level = 24;
  world.progression.extraLevel = 3;
  world.progression.xp = 41;
  world.progression.xpToNext = 120;

  world.enemies.push(
    createCaptureEnemy(config, "chaser", { x: 120, y: 100 }, 1),
    createCaptureEnemy(config, "brute", { x: 350, y: 96 }, 2),
    createCaptureEnemy(config, "fast", { x: 610, y: 96 }, 3),
    createCaptureEnemy(config, "ranged", { x: 840, y: 120 }, 4),
    createCaptureEnemy(config, "chaser", { x: 850, y: 420 }, 5),
    createCaptureEnemy(config, "brute", { x: 610, y: 455 }, 6),
    createCaptureEnemy(config, "fast", { x: 350, y: 455 }, 7),
    createCaptureEnemy(config, "ranged", { x: 110, y: 390 }, 8),
  );
  world.enemyProjectiles = createCaptureEnemyProjectiles(config);
  world.bullets = createCapturePlayerProjectiles(config);
  world.pickups = createCapturePickups(world, config);
  world.nextEnemyId = Math.max(world.nextEnemyId, 10);
  world.nextEnemyProjectileId = 7;
  world.nextBulletId = 5;
  world.nextVolleyId = 5;
  world.nextPickupId = 7;
  return true;
}

function applyMaximumDensityCaptureScenario(
  world: WorldState,
  config: SimulationConfig,
): void {
  world.state.status = "playing";
  world.state.hp = config.player.maxHp + world.runtime.maxHpBonus;
  world.state.score = 99_999;
  world.state.lastAim = { x: 1, y: 0 };
  world.player.position = {
    x: config.arena.width / 2,
    y: config.arena.height / 2,
  };
  world.expedition = undefined;
  world.bullets = Array.from({ length: 60 }, (_, index) =>
    createCapturePlayerProjectile(
      config,
      gridPosition(index, 10, 60, 45, 93, 86),
      index + 1,
    ),
  );
  world.enemies = Array.from({ length: 96 }, (_, index) =>
    createCaptureEnemy(
      config,
      (["chaser", "brute", "fast", "ranged"] as const)[index % 4]!,
      gridPosition(index, 12, 40, 38, 80, 66),
      index + 1,
    ),
  );
  world.enemyProjectiles = Array.from({ length: 256 }, (_, index) =>
    createCaptureEnemyProjectile(
      config,
      gridPosition(index, 16, 24, 18, 60, 33.5),
      index + 1,
    ),
  );
  const healValue = Math.max(
    config.pickup.healMinimum,
    Math.floor(
      (config.player.maxHp + world.runtime.maxHpBonus) *
        config.pickup.healRatio,
    ),
  );
  world.pickups = [
    ...Array.from({ length: 1_000 }, (_, index) =>
      createCapturePickup(
        config,
        "xp",
        gridPosition(index, 40, 12, 10, 24, 21.5),
        index + 1,
        healValue,
      ),
    ),
    ...Array.from({ length: 24 }, (_, index) =>
      createCapturePickup(
        config,
        "heal",
        gridPosition(index, 6, 90, 80, 156, 126),
        index + 1_001,
        healValue,
      ),
    ),
  ];
  world.nextEnemyId = 97;
  world.nextEnemyProjectileId = 257;
  world.nextBulletId = 61;
  world.nextVolleyId = 61;
  world.nextPickupId = 1_025;
}

export function readArenaCaptureLayers(
  world: WorldState,
  config: SimulationConfig,
): ArenaCaptureLayerSnapshot {
  const boss = world.expedition?.boss;
  const chargerTelegraphs = world.enemies.filter(
    (enemy) =>
      enemy.action?.kind === "charger" &&
      (enemy.action.phase === "telegraph" || enemy.action.phase === "prepare"),
  ).length;
  const encounterTelegraph = Number(
    world.encounter.director.phase === "warning",
  );
  const bossTelegraph = Number(boss?.action.phase === "telegraph");

  return {
    player: 1,
    obstacles: world.obstacles.length,
    enemies: world.enemies.length,
    bosses: world.enemies.filter((enemy) => enemy.boss !== undefined).length,
    playerProjectiles: world.bullets.length,
    enemyProjectiles: world.enemyProjectiles.length,
    xpPickups: world.pickups.filter((pickup) => pickup.kind === "xp").length,
    healPickups: world.pickups.filter((pickup) => pickup.kind === "heal").length,
    hazardTelegraphs:
      chargerTelegraphs + encounterTelegraph + bossTelegraph,
    hudVisible:
      world.state.status !== "title" && world.state.status !== "weaponSelect",
  };
}

function applyObjectSemanticsCaptureScenario(
  world: WorldState,
  config: SimulationConfig,
): void {
  world.state.status = "playing";
  world.state.hp = Math.max(
    1,
    config.player.maxHp + world.runtime.maxHpBonus - 24,
  );
  world.state.score = 0;
  world.state.lastAim = { x: 0, y: 1 };
  world.player.position = { x: 480, y: 390 };
  world.obstacles = [];
  world.bullets = [];
  world.enemies = [];
  world.enemyProjectiles = [];
  world.pickups = [];
  world.expedition = undefined;

  const healValue = Math.max(
    config.pickup.healMinimum,
    Math.floor(
      (config.player.maxHp + world.runtime.maxHpBonus) *
        config.pickup.healRatio,
    ),
  );
  world.enemies.push(
    createCaptureEnemy(config, "chaser", { x: 120, y: 120 }, 1),
    createCaptureEnemy(config, "chaser", { x: 480, y: 250 }, 2),
  );
  world.enemyProjectiles.push(
    createCaptureEnemyProjectile(config, { x: 300, y: 120 }, 1),
    createCaptureEnemyProjectile(config, { x: 300, y: 250 }, 2),
    createCaptureEnemyProjectile(config, { x: 660, y: 250 }, 3),
    createCaptureEnemyProjectile(config, { x: 480, y: 250 }, 4),
  );
  world.bullets.push(
    createCapturePlayerProjectile(config, { x: 480, y: 120 }, 1),
    createCapturePlayerProjectile(config, { x: 480, y: 250 }, 2),
  );
  world.pickups.push(
    createCapturePickup(config, "xp", { x: 660, y: 120 }, 1, healValue),
    createCapturePickup(config, "heal", { x: 840, y: 120 }, 2, healValue),
    createCapturePickup(config, "xp", { x: 300, y: 250 }, 3, healValue),
    createCapturePickup(config, "heal", { x: 660, y: 250 }, 4, healValue),
    createCapturePickup(config, "xp", { x: 480, y: 250 }, 5, healValue),
    createCapturePickup(config, "heal", { x: 480, y: 250 }, 6, healValue),
    ...OBJECT_SEMANTICS_MAGNET_ANCHORS.map((anchor, index) =>
      createCapturePickup(
        config,
        "xp",
        {
          x: world.player.position.x + anchor.distance,
          y: world.player.position.y,
        },
        index + 7,
        healValue,
      ),
    ),
  );
  world.nextEnemyId = 3;
  world.nextEnemyProjectileId = 5;
  world.nextBulletId = 3;
  world.nextVolleyId = 3;
  world.nextPickupId = 11;
}

function createCaptureEnemy(
  config: SimulationConfig,
  typeId: EnemyTypeId,
  position: { x: number; y: number },
  index: number,
): Enemy {
  const definition = config.enemies[typeId];
  return {
    id: `capture-enemy-${index}`,
    typeId,
    position,
    radius: definition.radius,
    hp: definition.hp,
    damage: definition.damage,
    speed: definition.speed,
    score: definition.score,
    xpValue: definition.xpValue,
    behavior: definition.behavior,
    attackTimer: definition.ranged?.attackInterval ?? 0,
    enteredArena: true,
  };
}

function createCaptureEnemyProjectiles(
  config: SimulationConfig,
): EnemyProjectile[] {
  const ranged = config.enemies.ranged.ranged;
  const radius = ranged?.projectileRadius ?? 5;
  const lifetime = ranged?.projectileLifetime ?? 2.6;
  const damage = ranged?.projectileDamage ?? 8;
  const positions = [
    { x: 390, y: 270 },
    { x: 570, y: 270 },
    { x: 480, y: 190 },
    { x: 480, y: 350 },
    { x: 420, y: 215 },
    { x: 540, y: 325 },
  ];
  return positions.map((position, index) => ({
    id: `capture-enemy-projectile-${index + 1}`,
    position,
    velocity: { x: 0, y: 0 },
    radius,
    lifetime,
    damage,
  }));
}

function createCaptureEnemyProjectile(
  config: SimulationConfig,
  position: { x: number; y: number },
  index: number,
): EnemyProjectile {
  const ranged = config.enemies.ranged.ranged;
  return {
    id: `capture-enemy-projectile-${index}`,
    position,
    velocity: { x: 0, y: 0 },
    radius: ranged?.projectileRadius ?? 5,
    lifetime: ranged?.projectileLifetime ?? 2.6,
    damage: ranged?.projectileDamage ?? 8,
  };
}

function createCapturePlayerProjectiles(config: SimulationConfig): Bullet[] {
  const weapon = config.weapons.pulse;
  const positions = [
    { x: 480, y: 238 },
    { x: 505, y: 225 },
    { x: 530, y: 212 },
    { x: 555, y: 199 },
  ];
  return positions.map((position, index) => ({
    id: `capture-bullet-${index + 1}`,
    volleyId: index + 1,
    weaponType: "pulse",
    position,
    velocity: { x: 0, y: -weapon.speed },
    radius: weapon.radius,
    lifetime: weapon.lifetime,
    damage: weapon.damage,
    hitsRemaining: weapon.hitCapacity,
    ricochetRemaining: weapon.ricochetCount,
    ricochetsUsed: 0,
    ricochetSurfaceKind: null,
    ricochetBoundarySide: null,
    hitEnemyIds: [],
  }));
}

function createCapturePlayerProjectile(
  config: SimulationConfig,
  position: { x: number; y: number },
  index: number,
): Bullet {
  const weapon = config.weapons.pulse;
  return {
    id: `capture-bullet-${index}`,
    volleyId: index,
    weaponType: "pulse",
    position,
    velocity: { x: 0, y: -weapon.speed },
    radius: weapon.radius,
    lifetime: weapon.lifetime,
    damage: weapon.damage,
    hitsRemaining: weapon.hitCapacity,
    ricochetRemaining: weapon.ricochetCount,
    ricochetsUsed: 0,
    ricochetSurfaceKind: null,
    ricochetBoundarySide: null,
    hitEnemyIds: [],
  };
}

function createCapturePickups(
  world: WorldState,
  config: SimulationConfig,
): Pickup[] {
  const healValue = Math.max(
    config.pickup.healMinimum,
    Math.floor(
      (config.player.maxHp + world.runtime.maxHpBonus) * config.pickup.healRatio,
    ),
  );
  return [
    createCapturePickup(config, "xp", { x: 365, y: 245 }, 1, healValue),
    createCapturePickup(config, "xp", { x: 390, y: 325 }, 2, healValue),
    createCapturePickup(config, "xp", { x: 585, y: 235 }, 3, healValue),
    createCapturePickup(config, "xp", { x: 610, y: 315 }, 4, healValue),
    createCapturePickup(config, "heal", { x: 355, y: 305 }, 5, healValue),
    createCapturePickup(config, "heal", { x: 605, y: 285 }, 6, healValue),
  ];
}

function createCapturePickup(
  config: SimulationConfig,
  kind: Pickup["kind"],
  position: { x: number; y: number },
  index: number,
  healValue: number,
): Pickup {
  return {
    id: `capture-pickup-${index}`,
    kind,
    position,
    radius: kind === "heal" ? config.pickup.healRadius : config.pickup.xpRadius,
    xpValue: kind === "xp" ? 1 : 0,
    healValue: kind === "heal" ? healValue : 0,
    lifetime: kind === "heal" ? config.pickup.healLifetime : null,
  };
}

function gridPosition(
  index: number,
  columns: number,
  startX: number,
  startY: number,
  stepX: number,
  stepY: number,
): { x: number; y: number } {
  return {
    x: startX + (index % columns) * stepX,
    y: startY + Math.floor(index / columns) * stepY,
  };
}
