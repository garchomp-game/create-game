import { describe, expect, it } from "vitest";
import { SIMULATION_CONFIG } from "../config/gameConfig";
import type { Enemy, Pickup } from "../domain/types";
import { createRandomStreams } from "../math/random";
import { createAutoPilotDecision, createAutoPilotInput } from "./autoPilot";
import { createWorld } from "./createWorld";
import { stepWorld } from "./stepWorld";

describe("createAutoPilotInput", () => {
  it("aims at the nearest enemy, fires, and retreats from close contact", () => {
    const world = createWorld(SIMULATION_CONFIG);
    const player = world.player.position;
    world.enemies.push(
      createEnemy("near", { x: player.x + 80, y: player.y }),
      createEnemy("far", { x: player.x, y: player.y + 240 }),
    );

    const input = createAutoPilotInput(world, SIMULATION_CONFIG);

    expect(input.shootHeld).toBe(true);
    expect(input.aimWorld).toEqual(world.enemies[0]!.position);
    expect(input.move.x).toBeLessThan(-0.99);
    expect(Math.abs(input.move.y)).toBeLessThan(0.01);
  });

  it("keeps aim on an in-field enemy while another enemy is still offscreen", () => {
    const world = createWorld(SIMULATION_CONFIG);
    world.player.position = { x: 800, y: 270 };
    const inField = createEnemy("in-field", { x: 580, y: 270 });
    const offscreen = createEnemy(
      "offscreen",
      { x: 992, y: 270 },
      "chaser",
      { enteredArena: false },
    );
    world.enemies.push(offscreen, inField);

    const decision = createAutoPilotDecision(world, SIMULATION_CONFIG);

    expect(decision.targetId).toBe(inField.id);
    expect(decision.input.aimWorld).toEqual(inField.position);
  });

  it("weights ranged threats above equal-distance basic chasers", () => {
    const world = createWorld(SIMULATION_CONFIG);
    const chaser = createEnemy("chaser", { x: 700, y: 270 });
    const ranged = createEnemy("ranged", { x: 260, y: 270 }, "ranged");
    world.enemies.push(chaser, ranged);

    const decision = createAutoPilotDecision(world, SIMULATION_CONFIG);

    expect(decision.targetId).toBe(ranged.id);
  });

  it("keeps Pulse focus on a stacked target when it remains hittable", () => {
    const world = createWorld(SIMULATION_CONFIG);
    const closer = createEnemy("closer", { x: 650, y: 270 });
    const focused = createEnemy(
      "focused",
      { x: 760, y: 270 },
      "chaser",
      { pulseFocusStacks: 2, pulseFocusExpiresAt: 10 },
    );
    world.enemies.push(closer, focused);

    const decision = createAutoPilotDecision(world, SIMULATION_CONFIG);

    expect(decision.targetId).toBe(focused.id);
  });

  it("gives nearby enemy projectiles priority over enemies", () => {
    const world = createWorld(SIMULATION_CONFIG);
    const player = world.player.position;
    world.enemies.push(createEnemy("enemy", { x: player.x - 70, y: player.y }));
    world.enemyProjectiles.push({
      id: "projectile",
      position: { x: player.x + 40, y: player.y },
      radius: 5,
      velocity: { x: -100, y: 0 },
      lifetime: 2,
      damage: 1,
    });

    const decision = createAutoPilotDecision(world, SIMULATION_CONFIG);
    const input = decision.input;

    expect(decision.mode).toBe("projectileDodge");
    expect(Math.abs(input.move.y)).toBeGreaterThan(0.8);
    expect(input.aimWorld).toEqual(world.enemies[0]!.position);
  });

  it("ignores a projectile moving away and keeps evading close enemies", () => {
    const world = createWorld(SIMULATION_CONFIG);
    const player = world.player.position;
    world.enemies.push(createEnemy("enemy", { x: player.x - 80, y: player.y }));
    world.enemyProjectiles.push({
      id: "departing-projectile",
      position: { x: player.x + 45, y: player.y },
      radius: 5,
      velocity: { x: 180, y: 0 },
      lifetime: 2,
      damage: 1,
    });

    const decision = createAutoPilotDecision(world, SIMULATION_CONFIG);

    expect(decision.mode).toBe("enemyEvade");
    expect(decision.input.move.x).toBeGreaterThan(0.99);
  });

  it("collects a nearby pickup when no immediate threat is present", () => {
    const world = createWorld(SIMULATION_CONFIG);
    world.pickups.push(createPickup({
      x: world.player.position.x,
      y: world.player.position.y + 50,
    }));

    const input = createAutoPilotInput(world, SIMULATION_CONFIG);

    expect(Math.abs(input.move.x)).toBeLessThan(0.01);
    expect(input.move.y).toBeGreaterThan(0.99);
  });

  it("uses a path around cover to collect experience", () => {
    const world = createWorld(SIMULATION_CONFIG);
    world.player.position = { x: 180, y: 270 };
    world.obstacles = [{ id: "wall", x: 220, y: 150, width: 120, height: 240 }];
    world.pickups.push(createPickup({ x: 380, y: 270 }));

    const decision = createAutoPilotDecision(world, SIMULATION_CONFIG);

    expect(decision.mode).toBe("xpCollect");
    expect(Math.abs(decision.input.move.y)).toBeGreaterThan(0.1);
  });

  it("seeks a firing position when every target is behind cover", () => {
    const world = createWorld(SIMULATION_CONFIG);
    world.player.position = { x: 180, y: 270 };
    world.obstacles = [{ id: "wall", x: 220, y: 150, width: 120, height: 240 }];
    const enemy = createEnemy("covered-enemy", { x: 420, y: 270 });
    world.enemies.push(enemy);

    const decision = createAutoPilotDecision(world, SIMULATION_CONFIG);

    expect(decision.mode).toBe("reposition");
    expect(decision.input.aimWorld).toEqual(enemy.position);
    expect(Math.abs(decision.input.move.y)).toBeGreaterThan(0.1);
  });

  it("selects the standard contract and prioritizes weapon upgrades", () => {
    const world = createWorld(SIMULATION_CONFIG);
    world.state.status = "contractSelect";
    expect(createAutoPilotInput(world, SIMULATION_CONFIG).contractChoicePressed).toBe(0);

    world.state.status = "upgradeSelect";
    world.progression.pendingUpgradeChoices = ["vitalCore", "rapidFire", "pulseFocus"];
    expect(createAutoPilotInput(world, SIMULATION_CONFIG).upgradeChoicePressed).toBe(2);
  });

  it("drives an integrated Pulse run through combat, recovery, and upgrades", () => {
    const world = createWorld(SIMULATION_CONFIG);
    const random = createRandomStreams(SIMULATION_CONFIG.seed);
    const modeCounts = new Map<string, number>();

    for (let frame = 0; frame < 120 * 30 && world.state.status !== "gameOver"; frame += 1) {
      const decision = createAutoPilotDecision(world, SIMULATION_CONFIG);
      modeCounts.set(decision.mode, (modeCounts.get(decision.mode) ?? 0) + 1);
      stepWorld(world, decision.input, 1 / 30, random, SIMULATION_CONFIG);
    }

    expect(world.state.elapsed).toBeGreaterThan(115);
    expect(world.stats.shotsFired).toBeGreaterThan(0);
    expect(world.stats.enemiesKilled).toBeGreaterThan(0);
    expect(world.stats.xpCollected).toBeGreaterThan(0);
    expect(world.stats.upgradesChosen).toBeGreaterThan(0);
    expect(modeCounts.get("xpCollect") ?? 0).toBeGreaterThan(0);
    expect(modeCounts.get("projectileDodge") ?? 0).toBeGreaterThan(0);
  });
});

function createEnemy(
  id: string,
  position: Enemy["position"],
  typeId: Enemy["typeId"] = "chaser",
  overrides: Partial<Enemy> = {},
): Enemy {
  const definition = SIMULATION_CONFIG.enemies[typeId];
  return {
    id,
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
    ...overrides,
  };
}

function createPickup(position: Pickup["position"]): Pickup {
  return {
    id: "pickup",
    kind: "xp",
    position,
    radius: SIMULATION_CONFIG.pickup.xpRadius,
    xpValue: 1,
    healValue: 0,
    lifetime: null,
  };
}
