import { describe, expect, it } from "vitest";
import { FINAL_EXPEDITION_STAGE_DEFINITION } from "../../content/gameContentCatalog";
import { SIMULATION_CONFIG } from "../../config/gameConfig";
import type { GameEvent, WeaponTypeId, WorldState } from "../../domain/types";
import { createRandomStreams } from "../../math/random";
import { ExpeditionController } from "../ExpeditionController";
import { createWorld } from "../createWorld";
import { resolveCombat } from "./combatSystem";
import { updateEnemyProjectiles } from "./enemyProjectileSystem";
import { updateEnemies } from "./enemySystem";
import { getSpawnWave, spawnEnemyAtPosition, updateSpawner } from "./spawnSystem";
import {
  getActiveBossEnemy,
  spawnFinalExpeditionBoss,
  updateFinalExpeditionBoss,
} from "./bossSystem";

describe("final Expedition boss", () => {
  it("clears the transition frame before final-wave pressure resumes", () => {
    const world = createWorld(SIMULATION_CONFIG);
    const random = createRandomStreams(7);
    new ExpeditionController(FINAL_EXPEDITION_STAGE_DEFINITION).initialize(
      world,
      random,
    );
    spawnEnemyAtPosition(
      world,
      "chaser",
      getSpawnWave(world, SIMULATION_CONFIG),
      { x: 100, y: 100 },
      SIMULATION_CONFIG,
    );
    world.enemyProjectiles.push({
      id: "enemy-projectile-road",
      position: { x: 200, y: 200 },
      velocity: { x: 100, y: 0 },
      radius: 5,
      lifetime: 2,
      damage: 8,
    });

    const boss = spawnFinalExpeditionBoss(world, []);

    expect(world.enemies).toEqual([boss]);
    expect(world.enemyProjectiles).toEqual([]);
  });

  it.each<WeaponTypeId>(["pulse", "spread"])(
    "lets %s avoid the locked targeted salvo without damage",
    (weaponType) => {
      const fixture = createBossFixture(20260717, weaponType);
      const boss = fixture.world.expedition!.boss!;
      expect(boss.action).toMatchObject({
        attackId: "targeted-salvo",
        phase: "telegraph",
        aimDirection: { x: 0, y: 1 },
      });

      fixture.world.player.position.x = 80;
      fixture.world.state.elapsed = boss.action.endsAt;
      const attackEvents = updateFinalExpeditionBoss(
        fixture.world,
        fixture.random,
        SIMULATION_CONFIG,
        [],
      );
      expect(attackEvents).toContainEqual(
        expect.objectContaining({
          type: "boss.attack.executed",
          attackId: "targeted-salvo",
        }),
      );
      expect(fixture.world.enemyProjectiles).toHaveLength(13);
      expect(fixture.world.enemyProjectiles.length).toBeLessThanOrEqual(
        SIMULATION_CONFIG.threat.maximumEnemyProjectiles,
      );

      const hpBefore = fixture.world.state.hp;
      for (let frame = 0; frame < 80; frame += 1) {
        updateEnemyProjectiles(fixture.world, 0.05, SIMULATION_CONFIG);
        resolveCombat(fixture.world, SIMULATION_CONFIG, []);
      }
      expect(fixture.world.state.hp).toBe(hpBefore);
    },
  );

  it.each<WeaponTypeId>(["pulse", "spread"])(
    "deploys a safe escort pincer for %s",
    (weaponType) => {
      const fixture = createBossFixture(78, weaponType);
      const boss = fixture.world.expedition!.boss!;
      boss.action = {
        attackId: "escort-pincer",
        phase: "telegraph",
        startedAt: 400,
        endsAt: 401.55,
        aimDirection: { x: 0, y: 1 },
        ingressDirection: "north",
      };
      fixture.world.state.elapsed = boss.action.endsAt;

      const events = updateFinalExpeditionBoss(
        fixture.world,
        fixture.random,
        SIMULATION_CONFIG,
        [],
      );
      const deployed = events.find(
        (event): event is Extract<GameEvent, { type: "boss.escort.deployed" }> =>
          event.type === "boss.escort.deployed",
      );
      expect(deployed?.enemyIds).toHaveLength(5);
      const escorts = fixture.world.enemies.filter((enemy) =>
        deployed?.enemyIds.includes(enemy.id),
      );
      expect(escorts).toHaveLength(5);
      expect(fixture.world.enemyProjectiles).toHaveLength(9);
      expect(
        fixture.world.enemyProjectiles.every(
          (projectile) =>
            projectile.source?.bossAttackId === "escort-pincer",
        ),
      ).toBe(true);
      expect(
        escorts.every(
          (enemy) => enemy.bossAttackSource?.bossAttackId === "escort-pincer",
        ),
      ).toBe(true);
      expect(fixture.world.enemies.length).toBeLessThanOrEqual(
        getSpawnWave(fixture.world, SIMULATION_CONFIG).maxEnemies,
      );
      expect(
        escorts.every(
          (enemy) =>
            Math.hypot(
              enemy.position.x - fixture.world.player.position.x,
              enemy.position.y - fixture.world.player.position.y,
            ) >= 180,
        ),
      ).toBe(true);
      const hpBefore = fixture.world.state.hp;
      resolveCombat(fixture.world, SIMULATION_CONFIG, []);
      expect(fixture.world.state.hp).toBe(hpBefore);

      escorts[0]!.position = { ...fixture.world.player.position };
      const contactEvents: GameEvent[] = [];
      resolveCombat(fixture.world, SIMULATION_CONFIG, contactEvents);
      expect(contactEvents).toContainEqual(
        expect.objectContaining({
          type: "player.damaged",
          source: expect.objectContaining({
            bossId: "final-command-ship",
            bossAttackId: "escort-pincer",
          }),
        }),
      );
    },
  );

  it("changes phase at half HP and accelerates the next pattern", () => {
    const fixture = createBossFixture(91, "pulse");
    const enemy = getActiveBossEnemy(fixture.world)!;
    enemy.hp = fixture.world.expedition!.boss!.maxHp * 0.5;
    fixture.world.state.elapsed = 430;

    const events = updateFinalExpeditionBoss(
      fixture.world,
      fixture.random,
      SIMULATION_CONFIG,
      [],
    );
    expect(events).toContainEqual(
      expect.objectContaining({ type: "boss.phase.changed", phase: 2 }),
    );
    expect(fixture.world.expedition!.boss).toMatchObject({
      phase: 2,
      action: { phase: "recovery", endsAt: 431.1 },
    });
    expect(enemy.speed).toBe(96);
  });

  it("pursues the player through the shared obstacle navigation", () => {
    const fixture = createBossFixture(92, "pulse");
    const enemy = getActiveBossEnemy(fixture.world)!;
    const before = { ...enemy.position };

    updateEnemies(fixture.world, 0.05, SIMULATION_CONFIG, []);

    expect(enemy.speed).toBe(72);
    expect(Math.hypot(enemy.position.x - before.x, enemy.position.y - before.y))
      .toBeGreaterThan(0);
  });

  it("keeps the final wave spawning while the boss is active", () => {
    const fixture = createBossFixture(93, "spread");
    const finalConfig = {
      ...SIMULATION_CONFIG,
      waves: FINAL_EXPEDITION_STAGE_DEFINITION.difficulty!.waves,
      threat: {
        ...SIMULATION_CONFIG.threat,
        ...FINAL_EXPEDITION_STAGE_DEFINITION.difficulty!.threat,
      },
    };
    fixture.world.state.elapsed = 400;
    fixture.world.state.spawnTimer = 0;
    const events: GameEvent[] = [];

    updateSpawner(
      fixture.world,
      0.05,
      fixture.random.spawn,
      finalConfig,
      events,
    );

    expect(fixture.world.enemies.some((enemy) => !enemy.boss)).toBe(true);
    expect(getSpawnWave(fixture.world, finalConfig)).toMatchObject({
      spawnInterval: 0.32,
      maxEnemies: 64,
      spawnBudget: 6,
    });
  });

  it("lets obstacles cut safe lanes through the wide boss salvo", () => {
    const fixture = createBossFixture(94, "pulse");
    const boss = fixture.world.expedition!.boss!;
    const enemy = getActiveBossEnemy(fixture.world)!;
    enemy.position = { x: 280, y: 40 };
    fixture.world.player.position = { x: 280, y: 440 };
    boss.action = {
      attackId: "targeted-salvo",
      phase: "telegraph",
      startedAt: 400,
      endsAt: 401.2,
      aimDirection: { x: 0, y: 1 },
      ingressDirection: null,
    };
    fixture.world.state.elapsed = boss.action.endsAt;

    updateFinalExpeditionBoss(
      fixture.world,
      fixture.random,
      SIMULATION_CONFIG,
      [],
    );
    expect(fixture.world.enemyProjectiles).toHaveLength(13);
    updateEnemyProjectiles(fixture.world, 0.3, SIMULATION_CONFIG);

    expect(fixture.world.enemyProjectiles.length).toBeGreaterThan(0);
    expect(fixture.world.enemyProjectiles.length).toBeLessThan(13);
  });

  it("raises both escort and suppressive-fire counts in phase two", () => {
    const fixture = createBossFixture(1234, "spread");
    const boss = fixture.world.expedition!.boss!;
    boss.phase = 2;
    boss.action = {
      attackId: "escort-pincer",
      phase: "telegraph",
      startedAt: 450,
      endsAt: 451.15,
      aimDirection: { x: 0, y: 1 },
      ingressDirection: "east",
    };
    fixture.world.state.elapsed = boss.action.endsAt;

    const events = updateFinalExpeditionBoss(
      fixture.world,
      fixture.random,
      SIMULATION_CONFIG,
      [],
    );

    expect(fixture.world.enemyProjectiles).toHaveLength(15);
    const escortEvent = events.find(
      (event): event is Extract<GameEvent, { type: "boss.escort.deployed" }> =>
        event.type === "boss.escort.deployed",
    );
    const attackEvent = events.find(
      (event): event is Extract<GameEvent, { type: "boss.attack.executed" }> =>
        event.type === "boss.attack.executed",
    );
    expect(escortEvent?.enemyIds).toHaveLength(7);
    expect(attackEvent?.projectileIds).toHaveLength(15);
  });

  it("completes the Expedition once when the registered boss is defeated", () => {
    const random = createRandomStreams(123);
    const world = createWorld(SIMULATION_CONFIG);
    const controller = new ExpeditionController(FINAL_EXPEDITION_STAGE_DEFINITION);
    controller.initialize(world, random);
    const spawnEvents: GameEvent[] = [];
    const enemy = spawnFinalExpeditionBoss(world, spawnEvents)!;
    world.state.elapsed = 482;
    const killed: Extract<GameEvent, { type: "enemy.killed" }> = {
      type: "enemy.killed",
      bulletId: "bullet-test",
      volleyId: 1,
      enemyId: enemy.id,
      enemyType: enemy.typeId,
      weaponType: "pulse",
      scoreAwarded: enemy.score,
      xpAwarded: enemy.xpValue,
      position: { ...enemy.position },
    };

    const events = controller.update(
      world,
      random,
      SIMULATION_CONFIG,
      [killed],
    );
    expect(events.filter((event) => event.type === "boss.defeated")).toHaveLength(1);
    expect(events.filter((event) => event.type === "expedition.completed")).toHaveLength(1);
    expect(events.filter((event) => event.type === "game.over")).toHaveLength(1);
    expect(world).toMatchObject({
      state: { status: "gameOver" },
      expedition: { status: "victory", outcome: "victory" },
    });

    expect(controller.update(world, random, SIMULATION_CONFIG, [killed])).toEqual([]);
  });
});

function createBossFixture(
  seed: number,
  weaponType: WeaponTypeId,
): {
  world: WorldState;
  random: ReturnType<typeof createRandomStreams>;
} {
  const world = createWorld(SIMULATION_CONFIG);
  const random = createRandomStreams(seed);
  world.state.weaponType = weaponType;
  new ExpeditionController(FINAL_EXPEDITION_STAGE_DEFINITION).initialize(world, random);
  const events: GameEvent[] = [];
  spawnFinalExpeditionBoss(world, events);
  expect(events).toContainEqual(
    expect.objectContaining({ type: "boss.spawned", maximumHp: 3_400 }),
  );
  return { world, random };
}
