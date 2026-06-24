import { describe, expect, it } from "vitest";
import { SIMULATION_CONFIG as GAME_CONFIG } from "../config/gameConfig";
import type { Bullet, Enemy, EnemyTypeId, WeaponTypeId } from "../domain/types";
import { createRandom } from "../math/random";
import { createWorld } from "./createWorld";
import { selectUpgradeChoices } from "./systems/levelSystem";
import { updatePickups } from "./systems/pickupSystem";
import { stepWorld } from "./stepWorld";
import { getWaveBand, selectEnemyTypeForWave } from "./waveDirector";

const neutralInput = {
  move: { x: 0, y: 0 },
  aimWorld: { x: GAME_CONFIG.player.x + 100, y: GAME_CONFIG.player.y },
  startPressed: false,
  shootHeld: false,
  restartPressed: false,
  pausePressed: false,
  quitToTitlePressed: false,
  upgradeChoicePressed: null,
};

function createTestEnemy(typeId: EnemyTypeId = "chaser", overrides: Partial<Enemy> = {}): Enemy {
  const definition = GAME_CONFIG.enemies[typeId];
  return {
    id: "enemy-test",
    typeId,
    position: { x: 540, y: 270 },
    radius: definition.radius,
    hp: definition.hp,
    damage: definition.damage,
    speed: definition.speed,
    score: definition.score,
    xpValue: definition.xpValue,
    behavior: definition.behavior,
    attackTimer: definition.ranged ? definition.ranged.attackInterval : 0,
    enteredArena: true,
    ...overrides,
  };
}

function createTestBullet(
  weaponType: WeaponTypeId = "pulse",
  overrides: Partial<Bullet> = {},
): Bullet {
  const definition = GAME_CONFIG.weapons[weaponType];
  return {
    id: "bullet-test",
    weaponType,
    position: { x: 540, y: 270 },
    radius: definition.radius,
    velocity: { x: 0, y: 0 },
    lifetime: definition.lifetime,
    damage: definition.damage,
    pierceRemaining: definition.pierceCount,
    hitEnemyIds: [],
    ...overrides,
  };
}

describe("stepWorld", () => {
  it("keeps the initial aim when aimWorld is null", () => {
    const world = createWorld(GAME_CONFIG);
    stepWorld(
      world,
      { ...neutralInput, aimWorld: null },
      1 / 60,
      createRandom(GAME_CONFIG.seed),
      GAME_CONFIG,
    );

    expect(world.state.lastAim).toEqual({ x: 1, y: 0 });
  });

  it("fires one bullet when shooting is held and cooldown is ready", () => {
    const world = createWorld(GAME_CONFIG);
    const result = stepWorld(
      world,
      { ...neutralInput, shootHeld: true },
      1 / 60,
      createRandom(GAME_CONFIG.seed),
      GAME_CONFIG,
    );

    expect(world.bullets).toHaveLength(1);
    expect(world.state.shotTimer).toBe(GAME_CONFIG.weapons.pulse.interval);
    expect(world.stats.shotsFired).toBe(1);
    expect(world.stats.weaponMetrics.pulse.shotsFired).toBe(1);
    expect(world.stats.weaponMetrics.pulse.projectilesFired).toBe(1);
    expect(result.events).toContainEqual(
      expect.objectContaining({
        type: "shot.fired",
        bulletIds: ["bullet-1"],
        weaponType: "pulse",
        projectileCount: 1,
      }),
    );
  });

  it("fires to the initial right aim when space is pressed before pointer aim exists", () => {
    const world = createWorld(GAME_CONFIG);
    stepWorld(
      world,
      { ...neutralInput, aimWorld: null, shootHeld: true },
      1 / 60,
      createRandom(GAME_CONFIG.seed),
      GAME_CONFIG,
    );

    expect(world.bullets).toHaveLength(1);
    expect(world.bullets[0]?.velocity.x).toBe(GAME_CONFIG.weapons.pulse.speed);
    expect(world.bullets[0]?.velocity.y).toBe(0);
  });

  it("fires spread weapon projectiles across the configured angle", () => {
    const world = createWorld(GAME_CONFIG);
    world.state.weaponType = "spread";
    const result = stepWorld(
      world,
      { ...neutralInput, aimWorld: null, shootHeld: true },
      1 / 60,
      createRandom(GAME_CONFIG.seed),
      GAME_CONFIG,
    );

    expect(world.bullets).toHaveLength(GAME_CONFIG.weapons.spread.projectileCount);
    expect(world.bullets.map((bullet) => bullet.weaponType)).toEqual(["spread", "spread", "spread"]);
    expect(world.bullets[0]!.velocity.y).toBeLessThan(0);
    expect(world.bullets[1]!.velocity.y).toBeCloseTo(0);
    expect(world.bullets[2]!.velocity.y).toBeGreaterThan(0);
    expect(result.events.filter((event) => event.type === "shot.fired")).toHaveLength(1);
    expect(result.events).toContainEqual(
      expect.objectContaining({
        type: "shot.fired",
        bulletIds: ["bullet-1", "bullet-2", "bullet-3"],
        projectileCount: 3,
      }),
    );
    expect(world.stats.shotsFired).toBe(1);
    expect(world.stats.weaponMetrics.spread.shotsFired).toBe(1);
    expect(world.stats.weaponMetrics.spread.projectilesFired).toBe(3);
  });

  it("does not exceed the current wave spawn budget in a single frame catch-up", () => {
    const world = createWorld(GAME_CONFIG);
    world.state.spawnTimer = -3;
    const result = stepWorld(
      world,
      neutralInput,
      1 / 60,
      createRandom(GAME_CONFIG.seed),
      GAME_CONFIG,
    );

    expect(world.enemies).toHaveLength(1);
    expect(result.events.filter((event) => event.type === "enemy.spawned")).toHaveLength(1);
  });

  it("selects enemy types by elapsed unlocks and weights", () => {
    expect(selectEnemyTypeForWave(GAME_CONFIG, getWaveBand(GAME_CONFIG, 0), 1, () => 0.99)).toBe(
      "chaser",
    );
    expect(selectEnemyTypeForWave(GAME_CONFIG, getWaveBand(GAME_CONFIG, 35), 3, () => 0.5)).toBe(
      "brute",
    );
    expect(selectEnemyTypeForWave(GAME_CONFIG, getWaveBand(GAME_CONFIG, 35), 1, () => 0.99)).toBe(
      "fast",
    );
    expect(selectEnemyTypeForWave(GAME_CONFIG, getWaveBand(GAME_CONFIG, 60), 3, () => 0.95)).toBe(
      "ranged",
    );
  });

  it("spawns chaser enemies before other enemy types unlock", () => {
    const world = createWorld(GAME_CONFIG);
    world.state.spawnTimer = 0;

    const result = stepWorld(world, neutralInput, 1 / 60, () => 0.99, GAME_CONFIG);

    expect(world.enemies[0]?.typeId).toBe("chaser");
    expect(result.events).toContainEqual(
      expect.objectContaining({ type: "enemy.spawned", enemyType: "chaser" }),
    );
  });

  it("moves the player but keeps them inside arena bounds", () => {
    const world = createWorld(GAME_CONFIG);
    world.player.position.x = GAME_CONFIG.arena.width - GAME_CONFIG.player.radius - 1;

    stepWorld(
      world,
      { ...neutralInput, move: { x: 1, y: 0 } },
      1,
      createRandom(GAME_CONFIG.seed),
      GAME_CONFIG,
    );

    expect(world.player.position.x).toBe(GAME_CONFIG.arena.width - GAME_CONFIG.player.radius);
  });

  it("blocks player movement through obstacles", () => {
    const world = createWorld(GAME_CONFIG);
    world.player.position = {
      x: GAME_CONFIG.obstacles[0]!.x - GAME_CONFIG.player.radius - 1,
      y: GAME_CONFIG.obstacles[0]!.y + GAME_CONFIG.obstacles[0]!.height / 2,
    };

    stepWorld(
      world,
      { ...neutralInput, move: { x: 1, y: 0 } },
      1 / 60,
      createRandom(GAME_CONFIG.seed),
      GAME_CONFIG,
    );

    expect(world.player.position.x).toBe(
      GAME_CONFIG.obstacles[0]!.x - GAME_CONFIG.player.radius - 1,
    );
  });

  it("kills an enemy with a bullet and awards score", () => {
    const world = createWorld(GAME_CONFIG);
    world.enemies.push(createTestEnemy());
    world.bullets.push(createTestBullet());

    const result = stepWorld(world, neutralInput, 1 / 60, createRandom(GAME_CONFIG.seed), GAME_CONFIG);

    expect(world.enemies).toHaveLength(0);
    expect(world.bullets).toHaveLength(0);
    expect(world.state.score).toBe(GAME_CONFIG.enemies.chaser.score);
    expect(world.stats.enemiesKilled).toBe(1);
    expect(result.events).toContainEqual(
      expect.objectContaining({
        type: "enemy.killed",
        enemyId: "enemy-test",
        enemyType: "chaser",
        weaponType: "pulse",
        xpAwarded: GAME_CONFIG.enemies.chaser.xpValue,
      }),
    );
    expect(world.stats.weaponMetrics.pulse.hits).toBe(1);
    expect(world.stats.weaponMetrics.pulse.kills).toBe(1);
  });

  it("spawns and collects XP pickups from enemy kills", () => {
    const world = createWorld(GAME_CONFIG);
    world.enemies.push(createTestEnemy());
    world.bullets.push(createTestBullet());

    const killResult = stepWorld(
      world,
      neutralInput,
      1 / 60,
      createRandom(GAME_CONFIG.seed),
      GAME_CONFIG,
    );

    expect(world.pickups).toHaveLength(1);
    expect(world.pickups[0]?.xpValue).toBe(GAME_CONFIG.enemies.chaser.xpValue);
    expect(killResult.events).toContainEqual(
      expect.objectContaining({ type: "pickup.spawned", xpValue: GAME_CONFIG.enemies.chaser.xpValue }),
    );

    world.player.position = { ...world.pickups[0]!.position };
    const collectResult = stepWorld(
      world,
      neutralInput,
      1 / 60,
      createRandom(GAME_CONFIG.seed),
      GAME_CONFIG,
    );

    expect(world.pickups).toHaveLength(0);
    expect(world.progression.xp).toBe(GAME_CONFIG.enemies.chaser.xpValue);
    expect(world.stats.pickupsCollected).toBe(1);
    expect(world.stats.xpCollected).toBe(GAME_CONFIG.enemies.chaser.xpValue);
    expect(collectResult.events).toContainEqual(expect.objectContaining({ type: "pickup.collected" }));
  });

  it("magnetizes nearby XP pickups toward the player before collection", () => {
    const world = createWorld(GAME_CONFIG);
    world.pickups.push(
      {
        id: "near-pickup",
        kind: "xp",
        position: { x: world.player.position.x + 80, y: world.player.position.y },
        radius: GAME_CONFIG.pickup.xpRadius,
        xpValue: 1,
      },
      {
        id: "far-pickup",
        kind: "xp",
        position: { x: world.player.position.x + GAME_CONFIG.pickup.magnetRadius + 20, y: world.player.position.y },
        radius: GAME_CONFIG.pickup.xpRadius,
        xpValue: 1,
      },
    );

    stepWorld(world, neutralInput, 1 / 60, createRandom(GAME_CONFIG.seed), GAME_CONFIG);

    expect(world.pickups.find((pickup) => pickup.id === "near-pickup")?.position.x).toBeLessThan(
      world.player.position.x + 80,
    );
    expect(world.pickups.find((pickup) => pickup.id === "far-pickup")?.position.x).toBe(
      world.player.position.x + GAME_CONFIG.pickup.magnetRadius + 20,
    );
  });

  it("keeps spawned pickups out of obstacles when possible", () => {
    const world = createWorld(GAME_CONFIG);
    const events = [
      {
        type: "enemy.killed" as const,
        enemyId: "enemy-in-obstacle",
        enemyType: "chaser" as const,
        weaponType: "pulse" as const,
        scoreAwarded: GAME_CONFIG.enemies.chaser.score,
        xpAwarded: GAME_CONFIG.enemies.chaser.xpValue,
        position: {
          x: GAME_CONFIG.obstacles[0]!.x + GAME_CONFIG.obstacles[0]!.width / 2,
          y: GAME_CONFIG.obstacles[0]!.y + GAME_CONFIG.obstacles[0]!.height / 2,
        },
      },
    ];

    updatePickups(world, GAME_CONFIG, events);

    expect(world.pickups).toHaveLength(1);
    expect(world.obstacles.some((obstacle) => {
      const pickup = world.pickups[0]!;
      const closestX = Math.max(obstacle.x, Math.min(obstacle.x + obstacle.width, pickup.position.x));
      const closestY = Math.max(obstacle.y, Math.min(obstacle.y + obstacle.height, pickup.position.y));
      const dx = pickup.position.x - closestX;
      const dy = pickup.position.y - closestY;
      return dx * dx + dy * dy <= pickup.radius * pickup.radius;
    })).toBe(false);
  });

  it("uses arena-wide pickup placement fallback when local candidates are blocked", () => {
    const world = createWorld(GAME_CONFIG);
    world.obstacles = [{ id: "large-block", x: 0, y: 0, width: 200, height: 200 }];
    const events = [
      {
        type: "enemy.killed" as const,
        enemyId: "enemy-in-large-obstacle",
        enemyType: "chaser" as const,
        weaponType: "pulse" as const,
        scoreAwarded: GAME_CONFIG.enemies.chaser.score,
        xpAwarded: GAME_CONFIG.enemies.chaser.xpValue,
        position: { x: 100, y: 100 },
      },
    ];

    updatePickups(world, GAME_CONFIG, events);

    expect(world.pickups).toHaveLength(1);
    expect(
      world.obstacles.some((obstacle) => {
        const pickup = world.pickups[0]!;
        const closestX = Math.max(obstacle.x, Math.min(obstacle.x + obstacle.width, pickup.position.x));
        const closestY = Math.max(obstacle.y, Math.min(obstacle.y + obstacle.height, pickup.position.y));
        const dx = pickup.position.x - closestX;
        const dy = pickup.position.y - closestY;
        return dx * dx + dy * dy <= pickup.radius * pickup.radius;
      }),
    ).toBe(false);
  });

  it("requires multiple hits to kill a brute enemy and awards brute score", () => {
    const world = createWorld(GAME_CONFIG);
    world.enemies.push(createTestEnemy("brute"));

    for (let hit = 0; hit < GAME_CONFIG.enemies.brute.hp - 1; hit += 1) {
      world.bullets.push(createTestBullet("pulse", { id: `bullet-test-${hit}` }));
      stepWorld(world, neutralInput, 1 / 60, createRandom(GAME_CONFIG.seed), GAME_CONFIG);
    }

    expect(world.enemies).toHaveLength(1);
    expect(world.state.score).toBe(0);

    world.bullets.push(createTestBullet("pulse", { id: "bullet-test-final" }));
    const result = stepWorld(
      world,
      neutralInput,
      1 / 60,
      createRandom(GAME_CONFIG.seed),
      GAME_CONFIG,
    );

    expect(world.enemies).toHaveLength(0);
    expect(world.state.score).toBe(GAME_CONFIG.enemies.brute.score);
    expect(result.events).toContainEqual(
      expect.objectContaining({
        type: "enemy.killed",
        enemyType: "brute",
        xpAwarded: GAME_CONFIG.enemies.brute.xpValue,
      }),
    );
  });

  it("lets piercing projectiles hit multiple enemies without repeating the same enemy", () => {
    const world = createWorld(GAME_CONFIG);
    world.enemies.push(
      createTestEnemy("chaser", { id: "enemy-a", position: { x: 540, y: 270 } }),
      createTestEnemy("chaser", { id: "enemy-b", position: { x: 540, y: 270 } }),
    );
    world.bullets.push(createTestBullet("pierce"));

    const result = stepWorld(world, neutralInput, 1 / 60, createRandom(GAME_CONFIG.seed), GAME_CONFIG);

    expect(world.enemies).toHaveLength(0);
    expect(world.bullets).toHaveLength(1);
    expect(world.bullets[0]?.pierceRemaining).toBe(1);
    expect(world.bullets[0]?.hitEnemyIds).toEqual(["enemy-a", "enemy-b"]);
    expect(result.events.filter((event) => event.type === "enemy.hit")).toHaveLength(2);
    expect(result.events.filter((event) => event.type === "enemy.killed")).toHaveLength(2);
    expect(world.stats.weaponMetrics.pierce.hits).toBe(2);
    expect(world.stats.weaponMetrics.pierce.kills).toBe(2);

    world.enemies.push(createTestEnemy("chaser", { id: "enemy-a", position: { x: 540, y: 270 } }));
    stepWorld(world, neutralInput, 1 / 60, createRandom(GAME_CONFIG.seed), GAME_CONFIG);
    expect(world.enemies).toHaveLength(1);
  });

  it("uses fast enemy movement values from enemy type config", () => {
    const world = createWorld(GAME_CONFIG);
    world.enemies.push(createTestEnemy("fast", { position: { x: 360, y: 270 } }));

    stepWorld(world, neutralInput, 1 / 60, createRandom(GAME_CONFIG.seed), GAME_CONFIG);

    expect(world.enemies[0]?.position.x).toBeGreaterThan(360);
    expect(world.enemies[0]?.speed).toBe(GAME_CONFIG.enemies.fast.speed);
  });

  it("lets ranged enemies hold distance and fire enemy projectiles", () => {
    const world = createWorld(GAME_CONFIG);
    world.enemies.push(
      createTestEnemy("ranged", {
        position: { x: world.player.position.x + GAME_CONFIG.enemies.ranged.ranged!.preferredRange, y: world.player.position.y },
        attackTimer: 0,
      }),
    );

    const result = stepWorld(world, neutralInput, 1 / 60, createRandom(GAME_CONFIG.seed), GAME_CONFIG);

    expect(world.enemyProjectiles).toHaveLength(1);
    expect(world.enemyProjectiles[0]?.velocity.x).toBeLessThan(0);
    expect(world.enemies[0]?.position.x).toBe(world.player.position.x + GAME_CONFIG.enemies.ranged.ranged!.preferredRange);
    expect(result.events).toContainEqual(
      expect.objectContaining({ type: "enemy.projectile.fired", enemyType: "ranged" }),
    );
  });

  it("uses a fallback direction when a ranged enemy overlaps the player", () => {
    const world = createWorld(GAME_CONFIG);
    world.enemies.push(
      createTestEnemy("ranged", {
        position: { ...world.player.position },
        attackTimer: 0,
      }),
    );

    const result = stepWorld(world, neutralInput, 1 / 60, createRandom(GAME_CONFIG.seed), GAME_CONFIG);

    expect(world.enemyProjectiles).toHaveLength(1);
    expect(world.enemyProjectiles[0]?.velocity.x).toBeGreaterThan(0);
    expect(world.enemyProjectiles[0]?.velocity.y).toBe(0);
    expect(result.events).toContainEqual(
      expect.objectContaining({
        type: "enemy.projectile.fired",
        direction: { x: 1, y: 0 },
      }),
    );
  });

  it("applies enemy projectile damage to the player", () => {
    const world = createWorld(GAME_CONFIG);
    world.enemyProjectiles.push({
      id: "enemy-projectile-test",
      position: { ...world.player.position },
      radius: GAME_CONFIG.enemies.ranged.ranged!.projectileRadius,
      velocity: { x: 0, y: 0 },
      lifetime: GAME_CONFIG.enemies.ranged.ranged!.projectileLifetime,
      damage: GAME_CONFIG.enemies.ranged.ranged!.projectileDamage,
    });

    const result = stepWorld(world, neutralInput, 1 / 60, createRandom(GAME_CONFIG.seed), GAME_CONFIG);

    expect(world.enemyProjectiles).toHaveLength(0);
    expect(world.state.hp).toBe(
      GAME_CONFIG.player.maxHp - GAME_CONFIG.enemies.ranged.ranged!.projectileDamage,
    );
    expect(result.events).toContainEqual(expect.objectContaining({ type: "player.damaged" }));
  });

  it("levels up from collected XP and enters upgrade selection", () => {
    const world = createWorld(GAME_CONFIG);
    world.progression.xp = world.progression.xpToNext - 1;
    world.pickups.push({
      id: "pickup-test",
      kind: "xp",
      position: { ...world.player.position },
      radius: GAME_CONFIG.pickup.xpRadius,
      xpValue: 1,
    });

    const result = stepWorld(world, neutralInput, 1 / 60, () => 0, GAME_CONFIG);

    expect(world.state.status).toBe("upgradeSelect");
    expect(world.progression.level).toBe(2);
    expect(world.progression.pendingUpgradeChoices).toHaveLength(GAME_CONFIG.leveling.upgradeChoiceCount);
    expect(world.stats.pickupsCollected).toBe(1);
    expect(result.events).toContainEqual(expect.objectContaining({ type: "player.level_up", level: 2 }));
    expect(result.events).toContainEqual(expect.objectContaining({ type: "upgrade.offered", level: 2 }));
  });

  it("freezes world updates while selecting an upgrade and applies the selected upgrade", () => {
    const world = createWorld(GAME_CONFIG);
    world.state.status = "upgradeSelect";
    world.progression.pendingUpgradeChoices = ["rapidFire", "swiftStep", "vitalCore"];
    const frozen = {
      elapsed: world.state.elapsed,
      player: { ...world.player.position },
      bulletCount: world.bullets.length,
    };

    stepWorld(
      world,
      { ...neutralInput, move: { x: 1, y: 0 }, shootHeld: true },
      1,
      createRandom(GAME_CONFIG.seed),
      GAME_CONFIG,
    );

    expect(world.state.status).toBe("upgradeSelect");
    expect(world.state.elapsed).toBe(frozen.elapsed);
    expect(world.player.position).toEqual(frozen.player);
    expect(world.bullets).toHaveLength(frozen.bulletCount);

    const result = stepWorld(
      world,
      { ...neutralInput, upgradeChoicePressed: 0 },
      1,
      createRandom(GAME_CONFIG.seed),
      GAME_CONFIG,
    );

    expect(world.state.status).toBe("playing");
    expect(world.runtime.fireIntervalMultiplier).toBeLessThan(1);
    expect(world.progression.upgradeRanks.rapidFire).toBe(1);
    expect(world.progression.pendingUpgradeChoices).toEqual([]);
    expect(world.stats.upgradesChosen).toBe(1);
    expect(result.events).toContainEqual(
      expect.objectContaining({ type: "upgrade.selected", upgradeId: "rapidFire", rank: 1 }),
    );
  });

  it("excludes max rank upgrades from future choices", () => {
    const ranks = { ...createWorld(GAME_CONFIG).progression.upgradeRanks };
    ranks.rapidFire = GAME_CONFIG.upgrades.rapidFire.maxRank;

    expect(selectUpgradeChoices(GAME_CONFIG, () => 0, ranks)).not.toContain("rapidFire");

    const maxedRanks = { ...ranks };
    for (const upgradeId of Object.keys(maxedRanks) as Array<keyof typeof maxedRanks>) {
      maxedRanks[upgradeId] = GAME_CONFIG.upgrades[upgradeId].maxRank;
    }
    expect(selectUpgradeChoices(GAME_CONFIG, () => 0, maxedRanks)).toEqual([]);
  });

  it("applies each upgrade effect through selected upgrades", () => {
    const cases = [
      {
        upgradeId: "swiftStep" as const,
        assert: (world: ReturnType<typeof createWorld>) =>
          expect(world.runtime.playerSpeedMultiplier).toBeGreaterThan(1),
      },
      {
        upgradeId: "vitalCore" as const,
        assert: (world: ReturnType<typeof createWorld>) => {
          expect(world.runtime.maxHpBonus).toBe(20);
          expect(world.state.hp).toBe(GAME_CONFIG.player.maxHp + 20);
        },
      },
      {
        upgradeId: "overdriveRounds" as const,
        assert: (world: ReturnType<typeof createWorld>) =>
          expect(world.runtime.projectileSpeedMultiplier).toBeGreaterThan(1),
      },
      {
        upgradeId: "splitShot" as const,
        assert: (world: ReturnType<typeof createWorld>) =>
          expect(world.runtime.projectileCountBonus).toBe(1),
      },
      {
        upgradeId: "piercingRounds" as const,
        assert: (world: ReturnType<typeof createWorld>) => expect(world.runtime.pierceBonus).toBe(1),
      },
    ];

    for (const item of cases) {
      const world = createWorld(GAME_CONFIG);
      world.state.status = "upgradeSelect";
      world.progression.pendingUpgradeChoices = [item.upgradeId];

      const result = stepWorld(
        world,
        { ...neutralInput, upgradeChoicePressed: 0 },
        1 / 60,
        createRandom(GAME_CONFIG.seed),
        GAME_CONFIG,
      );

      item.assert(world);
      expect(world.progression.upgradeRanks[item.upgradeId]).toBe(1);
      expect(world.stats.upgradesChosen).toBe(1);
      expect(result.events).toContainEqual(
        expect.objectContaining({ type: "upgrade.selected", upgradeId: item.upgradeId, rank: 1 }),
      );
    }
  });

  it("removes enemy projectiles by lifetime and obstacle collision", () => {
    const world = createWorld(GAME_CONFIG);
    world.enemyProjectiles.push(
      {
        id: "expired-projectile",
        position: { x: 100, y: 100 },
        radius: GAME_CONFIG.enemies.ranged.ranged!.projectileRadius,
        velocity: { x: 0, y: 0 },
        lifetime: 0.01,
        damage: GAME_CONFIG.enemies.ranged.ranged!.projectileDamage,
      },
      {
        id: "obstacle-projectile",
        position: {
          x: GAME_CONFIG.obstacles[0]!.x + GAME_CONFIG.obstacles[0]!.width / 2,
          y: GAME_CONFIG.obstacles[0]!.y + GAME_CONFIG.obstacles[0]!.height / 2,
        },
        radius: GAME_CONFIG.enemies.ranged.ranged!.projectileRadius,
        velocity: { x: 0, y: 0 },
        lifetime: GAME_CONFIG.enemies.ranged.ranged!.projectileLifetime,
        damage: GAME_CONFIG.enemies.ranged.ranged!.projectileDamage,
      },
    );

    stepWorld(world, neutralInput, 1 / 60, createRandom(GAME_CONFIG.seed), GAME_CONFIG);

    expect(world.enemyProjectiles).toHaveLength(0);
  });

  it("applies contact damage with cooldown", () => {
    const world = createWorld(GAME_CONFIG);
    world.enemies.push(createTestEnemy("chaser", { position: { ...world.player.position } }));

    stepWorld(world, neutralInput, 1 / 60, createRandom(GAME_CONFIG.seed), GAME_CONFIG);
    const hpAfterFirstHit = world.state.hp;
    stepWorld(world, neutralInput, 1 / 60, createRandom(GAME_CONFIG.seed), GAME_CONFIG);

    expect(hpAfterFirstHit).toBe(GAME_CONFIG.player.maxHp - GAME_CONFIG.enemies.chaser.damage);
    expect(world.state.hp).toBe(hpAfterFirstHit);
    expect(world.stats.hitsTaken).toBe(1);
    expect(world.stats.damageTaken).toBe(GAME_CONFIG.enemies.chaser.damage);
  });

  it("emits game over when hp reaches zero", () => {
    const world = createWorld(GAME_CONFIG);
    world.state.hp = 1;
    world.enemies.push(createTestEnemy("chaser", { position: { ...world.player.position } }));

    const result = stepWorld(world, neutralInput, 1 / 60, createRandom(GAME_CONFIG.seed), GAME_CONFIG);

    expect(world.state.status).toBe("gameOver");
    expect(world.state.hp).toBe(0);
    expect(result.events).toContainEqual(expect.objectContaining({ type: "game.over" }));
  });

  it("emits restart request while game over", () => {
    const world = createWorld(GAME_CONFIG);
    world.state.status = "gameOver";

    const result = stepWorld(
      world,
      { ...neutralInput, restartPressed: true },
      1 / 60,
      createRandom(GAME_CONFIG.seed),
      GAME_CONFIG,
    );

    expect(result.events).toContainEqual({ type: "game.restart.requested" });
  });

  it("starts from title without advancing simulation time", () => {
    const world = createWorld(GAME_CONFIG);
    world.state.status = "title";

    const idleResult = stepWorld(
      world,
      neutralInput,
      1,
      createRandom(GAME_CONFIG.seed),
      GAME_CONFIG,
    );
    expect(world.state.status).toBe("title");
    expect(world.state.elapsed).toBe(0);
    expect(idleResult.metrics).toContainEqual({
      type: "timing",
      name: "frame.dt_ms",
      valueMs: 0,
    });

    const startResult = stepWorld(
      world,
      { ...neutralInput, startPressed: true, shootHeld: true },
      1,
      createRandom(GAME_CONFIG.seed),
      GAME_CONFIG,
    );
    expect(world.state.status).toBe("playing");
    expect(world.state.elapsed).toBe(0);
    expect(world.bullets).toHaveLength(0);
    expect(startResult.events).toContainEqual({ type: "game.started" });
  });

  it("toggles pause and keeps simulation state frozen while paused", () => {
    const world = createWorld(GAME_CONFIG);
    const random = createRandom(GAME_CONFIG.seed);

    const pauseResult = stepWorld(
      world,
      { ...neutralInput, pausePressed: true },
      1 / 60,
      random,
      GAME_CONFIG,
    );
    expect(world.state.status).toBe("paused");
    expect(pauseResult.events).toContainEqual({ type: "game.paused", elapsed: 0 });

    const frozen = {
      elapsed: world.state.elapsed,
      player: { ...world.player.position },
      bulletCount: world.bullets.length,
      enemyCount: world.enemies.length,
      enemyProjectileCount: world.enemyProjectiles.length,
      spawnTimer: world.state.spawnTimer,
      shotTimer: world.state.shotTimer,
    };

    const pausedResult = stepWorld(
      world,
      { ...neutralInput, move: { x: 1, y: 0 }, shootHeld: true },
      1,
      random,
      GAME_CONFIG,
    );

    expect(world.state.elapsed).toBe(frozen.elapsed);
    expect(world.player.position).toEqual(frozen.player);
    expect(world.bullets).toHaveLength(frozen.bulletCount);
    expect(world.enemies).toHaveLength(frozen.enemyCount);
    expect(world.enemyProjectiles).toHaveLength(frozen.enemyProjectileCount);
    expect(world.state.spawnTimer).toBe(frozen.spawnTimer);
    expect(world.state.shotTimer).toBe(frozen.shotTimer);
    expect(pausedResult.metrics).toContainEqual({
      type: "timing",
      name: "frame.dt_ms",
      valueMs: 0,
    });

    const resumeResult = stepWorld(
      world,
      { ...neutralInput, pausePressed: true },
      1 / 60,
      random,
      GAME_CONFIG,
    );
    expect(world.state.status).toBe("playing");
    expect(resumeResult.events).toContainEqual({ type: "game.resumed", elapsed: 0 });
  });

  it("emits restart and title requests from the pause menu", () => {
    const world = createWorld(GAME_CONFIG);
    world.state.status = "paused";

    const restartResult = stepWorld(
      world,
      { ...neutralInput, restartPressed: true },
      1 / 60,
      createRandom(GAME_CONFIG.seed),
      GAME_CONFIG,
    );
    expect(restartResult.events).toContainEqual({ type: "game.restart.requested" });

    const titleResult = stepWorld(
      world,
      { ...neutralInput, quitToTitlePressed: true },
      1 / 60,
      createRandom(GAME_CONFIG.seed),
      GAME_CONFIG,
    );
    expect(titleResult.events).toContainEqual({ type: "game.title.requested" });
  });

  it("clamps large dt samples to 50ms", () => {
    const world = createWorld(GAME_CONFIG);

    const result = stepWorld(world, neutralInput, 10, createRandom(GAME_CONFIG.seed), GAME_CONFIG);

    expect(result.metrics).toContainEqual({
      type: "timing",
      name: "frame.dt_ms",
      valueMs: 50,
    });
  });
});
