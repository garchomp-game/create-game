import { describe, expect, it } from "vitest";
import { SIMULATION_CONFIG } from "../../config/gameConfig";
import type { GameEvent, WorldState } from "../../domain/types";
import { createRandom } from "../../math/random";
import { createWorld } from "../createWorld";
import { resolveCombat } from "./combatSystem";
import {
  spawnCommanderElite,
  updateCommanderElites,
} from "./commanderEliteSystem";
import { updateRunStats } from "./statsSystem";

describe("commanderEliteSystem", () => {
  it("telegraphs and deploys deterministic supported reinforcements", () => {
    const first = runDeployment(84);
    const second = runDeployment(84);

    expect(second.events).toEqual(first.events);
    expect(second.world.enemies).toEqual(first.world.enemies);
    expect(first.commander).toMatchObject({
      hp: 500,
      elite: { maximumHp: 500 },
    });
    expect(first.commander.elite?.activations).toBe(1);
    const reinforcements = first.world.enemies.filter(
      (enemy) => enemy.support?.sourceEnemyId === first.commander.id,
    );
    expect(reinforcements).toHaveLength(3);
    expect(first.events).toContainEqual(
      expect.objectContaining({
        type: "elite.commander.reinforcement.telegraphed",
        enemyId: first.commander.id,
      }),
    );
    expect(first.events).toContainEqual(
      expect.objectContaining({
        type: "elite.commander.reinforcement.deployed",
        reinforcementIds: reinforcements.map((enemy) => enemy.id),
      }),
    );
  });

  it("lowers active reinforcement pressure immediately when the commander dies", () => {
    const { world, commander, events } = runDeployment(21);
    const supported = world.enemies.filter(
      (enemy) => enemy.support?.sourceEnemyId === commander.id,
    );
    const supportedSpeeds = supported.map((enemy) => enemy.speed);
    commander.hp = 1;
    world.bullets = [createBulletAt(commander.position)];

    const killEvents: GameEvent[] = [];
    resolveCombat(world, SIMULATION_CONFIG, killEvents);
    updateRunStats(world, [...events, ...killEvents]);

    expect(world.enemies.some((enemy) => enemy.id === commander.id)).toBe(false);
    supported.forEach((enemy, index) => {
      expect(enemy.support).toBeUndefined();
      expect(enemy.speed).toBeLessThan(supportedSpeeds[index]!);
    });
    expect(killEvents).toContainEqual(
      expect.objectContaining({
        type: "elite.commander.killed",
        enemyId: commander.id,
        weaponType: "pulse",
      }),
    );
    expect(killEvents).toContainEqual(
      expect.objectContaining({
        type: "elite.commander.pressure.lowered",
        releasedEnemyIds: supported.map((enemy) => enemy.id),
      }),
    );
    expect(world.stats.encounterMetrics.commander).toMatchObject({
      spawned: 1,
      killed: 1,
      telegraphs: 1,
      traitActivations: 1,
      reinforcementsSpawned: 3,
      pressureReleases: 1,
      supportUnitsReleased: 3,
      killsByWeapon: { pulse: 1, spread: 0, pierce: 0 },
    });
    expect(
      JSON.parse(JSON.stringify(world.stats)).encounterMetrics.commander,
    ).toEqual(world.stats.encounterMetrics.commander);
  });

  it("creates measurable pressure compared with the same fixture without a commander", () => {
    const baseline = createWorld(SIMULATION_CONFIG);
    const { world } = runDeployment(13);
    expect(world.enemies.length - baseline.enemies.length).toBe(4);
  });

  it("does not consume spawn randomness when no commander exists", () => {
    const world = createWorld(SIMULATION_CONFIG);
    let calls = 0;
    updateCommanderElites(
      world,
      () => {
        calls += 1;
        return 0.5;
      },
      SIMULATION_CONFIG,
      [],
    );
    expect(calls).toBe(0);
  });
});

function runDeployment(seed: number) {
  const world = createWorld(SIMULATION_CONFIG);
  const events: GameEvent[] = [];
  const commander = spawnCommanderElite(
    world,
    { x: SIMULATION_CONFIG.arena.width + 32, y: SIMULATION_CONFIG.arena.height / 2 },
    SIMULATION_CONFIG,
    events,
  )!;
  const random = createRandom(seed);

  world.state.elapsed = commander.elite!.nextTraitAt;
  updateCommanderElites(world, random, SIMULATION_CONFIG, events);
  world.state.elapsed = commander.elite!.reinforcementSpawnAt!;
  updateCommanderElites(world, random, SIMULATION_CONFIG, events);
  return { world, commander, events };
}

function createBulletAt(position: { x: number; y: number }): WorldState["bullets"][number] {
  return {
    id: "bullet-test",
    volleyId: 1,
    weaponType: "pulse",
    position: { ...position },
    radius: 4,
    velocity: { x: 0, y: 0 },
    lifetime: 1,
    damage: 2,
    hitsRemaining: 1,
    ricochetRemaining: 0,
    ricochetsUsed: 0,
    ricochetSurfaceKind: null,
    ricochetBoundarySide: null,
    hitEnemyIds: [],
  };
}
