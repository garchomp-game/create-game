import { describe, expect, it } from "vitest";
import { SIMULATION_CONFIG } from "../config/gameConfig";
import type { Enemy, Pickup } from "../domain/types";
import { createRandomStreams } from "../math/random";
import {
  createAutoPilotAgent,
  createAutoPilotDecision,
  createAutoPilotInput,
} from "./autoPilot";
import { createWorld } from "./createWorld";
import { ROT_AUTO_PILOT_NAVIGATION } from "./autoPilotNavigation";
import { assessAutoPilotPressure } from "./autoPilotPressure";
import {
  AUTO_PILOT_FIELD_XP_COLLECTION_THRESHOLD,
  AUTO_PILOT_FIELD_XP_LIMIT,
  getFieldXpPickupCount,
  selectAutoPilotIntent,
} from "./autoPilotPolicy";
import { DEFAULT_AUTO_PILOT_TARGETING } from "./autoPilotTargeting";
import { stepWorld } from "./stepWorld";

describe("createAutoPilotInput", () => {
  it("aims at the nearest enemy, fires, and retreats from close contact", () => {
    const world = createWorld(SIMULATION_CONFIG);
    const player = world.player.position;
    world.enemies.push(
      createEnemy("near", { x: player.x + 80, y: player.y }),
      createEnemy("far", { x: player.x, y: player.y + 240 }),
    );

    const decision = createAutoPilotDecision(world, SIMULATION_CONFIG);
    const input = decision.input;

    expect(decision.aimTargetId).toBe("near");
    expect(input.shootHeld).toBe(true);
    expect(input.aimWorld?.x).toBeLessThan(world.enemies[0]!.position.x);
    expect(input.aimWorld?.y).toBeCloseTo(world.enemies[0]!.position.y);
    expect(input.move.x).toBeLessThan(-0.99);
    expect(Math.abs(input.move.y)).toBeLessThan(0.08);
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
    expect(decision.aimTargetId).toBe(inField.id);
    expect(decision.input.aimWorld?.x).toBeGreaterThan(inField.position.x);
  });

  it("prioritizes an imminent contact threat above a ranged enemy", () => {
    const world = createWorld(SIMULATION_CONFIG);
    const chaser = createEnemy("chaser", { x: 700, y: 270 });
    const ranged = createEnemy("ranged", { x: 260, y: 270 }, "ranged");
    world.enemies.push(chaser, ranged);

    const decision = createAutoPilotDecision(world, SIMULATION_CONFIG);

    expect(decision.aimTargetId).toBe(chaser.id);
  });

  it("weights ranged threats above non-imminent chasers", () => {
    const world = createWorld(SIMULATION_CONFIG);
    const chaser = createEnemy("chaser", { x: 830, y: 270 });
    const ranged = createEnemy("ranged", { x: 130, y: 270 }, "ranged");
    world.enemies.push(chaser, ranged);

    const decision = createAutoPilotDecision(world, SIMULATION_CONFIG);

    expect(decision.aimTargetId).toBe(ranged.id);
  });

  it("keeps Pulse focus on a stacked target when it remains hittable", () => {
    const world = createWorld(SIMULATION_CONFIG);
    const closer = createEnemy("closer", { x: 300, y: 270 });
    const focused = createEnemy(
      "focused",
      { x: 760, y: 270 },
      "chaser",
      { pulseFocusStacks: 2, pulseFocusExpiresAt: 10 },
    );
    world.enemies.push(closer, focused);

    const decision = createAutoPilotDecision(world, SIMULATION_CONFIG);

    expect(decision.aimTargetId).toBe(focused.id);
  });

  it("aims a Spread volley between targets when the fan can hit both", () => {
    const world = createWorld(SIMULATION_CONFIG);
    world.state.weaponType = "spread";
    const player = world.player.position;
    world.enemies.push(
      createEnemy("upper", { x: player.x + 220, y: player.y - 50 }),
      createEnemy("lower", { x: player.x + 220, y: player.y + 50 }),
    );

    const decision = createAutoPilotDecision(world, SIMULATION_CONFIG);

    expect(decision.aimExpectedDistinctHits).toBeGreaterThanOrEqual(2);
    expect(decision.input.aimWorld?.x).toBeGreaterThan(player.x);
    expect(decision.input.aimWorld?.y).toBeCloseTo(player.y, -1);
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
    expect(decision.intentMode).not.toBe("projectileDodge");
    expect(decision.executedMode).toBe("projectileDodge");
    expect(decision.overrideReason).toBe("projectileCollision");
    expect(decision.minimumTtc).not.toBeNull();
    expect(decision.riskScore).toBeGreaterThan(0);
    expect(Math.abs(input.move.y)).toBeGreaterThan(0.8);
    expect(decision.aimTargetId).toBe(world.enemies[0]!.id);
    expect(input.shootHeld).toBe(true);
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
    expect(decision.input.move.x).toBeGreaterThan(0.1);
  });

  it("does not let a departing projectile deflect a safe pickup route", () => {
    const baselineWorld = createWorld(SIMULATION_CONFIG);
    const pickupPosition = {
      x: baselineWorld.player.position.x,
      y: baselineWorld.player.position.y + 140,
    };
    baselineWorld.pickups.push(createPickup(pickupPosition));
    const baseline = createAutoPilotDecision(baselineWorld, SIMULATION_CONFIG);

    const projectileWorld = createWorld(SIMULATION_CONFIG);
    projectileWorld.pickups.push(createPickup(pickupPosition));
    projectileWorld.enemyProjectiles.push({
      id: "departing-projectile",
      position: {
        x: projectileWorld.player.position.x + 45,
        y: projectileWorld.player.position.y,
      },
      radius: 5,
      velocity: { x: 180, y: 0 },
      lifetime: 2,
      damage: 1,
    });

    const decision = createAutoPilotDecision(projectileWorld, SIMULATION_CONFIG);

    expect(decision.mode).toBe("xpCollect");
    expect(decision.input.move.x).toBeCloseTo(baseline.input.move.x, 4);
    expect(decision.input.move.y).toBeCloseTo(baseline.input.move.y, 4);
  });

  it("collects a nearby pickup when no immediate threat is present", () => {
    const world = createWorld(SIMULATION_CONFIG);
    world.pickups.push(createPickup({
      x: world.player.position.x,
      y: world.player.position.y + 50,
    }));

    const decision = createAutoPilotDecision(world, SIMULATION_CONFIG);

    expect(decision.mode).toBe("xpCollect");
    expect(decision.targetId).toBe("pickup");
    expect(decision.input.move.y).toBeGreaterThanOrEqual(0);
  });

  it("routes around a zero-value heal instead of crossing its magnet radius", () => {
    const world = createWorld(SIMULATION_CONFIG);
    const player = world.player.position;
    world.pickups.push(
      createPickup({ x: player.x, y: player.y + 100 }, "heal", "heal"),
      createPickup({ x: player.x, y: player.y + 220 }, "xp", "xp"),
    );

    const decision = createAutoPilotDecision(world, SIMULATION_CONFIG);

    expect(decision.intentMode).toBe("xpCollect");
    expect(decision.intentTargetId).toBe("xp");
    const endpoint = {
      x: player.x + decision.input.move.x * SIMULATION_CONFIG.player.speed * 0.58,
      y: player.y + decision.input.move.y * SIMULATION_CONFIG.player.speed * 0.58,
    };
    expect(
      distanceFromSegment(world.pickups[0]!.position, player, endpoint),
    ).toBeGreaterThan(SIMULATION_CONFIG.pickup.magnetRadius);
  });

  it("keeps making safe progress when full-HP healing surrounds an XP route", () => {
    const world = createWorld(SIMULATION_CONFIG);
    const player = world.player.position;
    world.pickups.push(createPickup(
      { x: player.x + 260, y: player.y },
      "xp",
      "xp-goal",
    ));
    for (let index = 0; index < 12; index += 1) {
      const angle = Math.PI * 2 * index / 12;
      world.pickups.push(createPickup(
        {
          x: player.x + Math.cos(angle) * 118,
          y: player.y + Math.sin(angle) * 118,
        },
        "heal",
        `heal-${index}`,
      ));
    }

    const decision = createAutoPilotDecision(world, SIMULATION_CONFIG);

    expect(decision.intentMode).toBe("xpCollect");
    expect(Math.hypot(decision.input.move.x, decision.input.move.y)).toBeGreaterThan(0.9);
  });

  it("prioritizes healing over experience when health is low", () => {
    const world = createWorld(SIMULATION_CONFIG);
    world.state.hp = 35;
    world.pickups.push(
      createPickup({ x: 480, y: 190 }, "xp", "xp"),
      createPickup({ x: 560, y: 270 }, "heal", "heal"),
    );

    const decision = createAutoPilotDecision(world, SIMULATION_CONFIG);

    expect(decision.mode).toBe("healCollect");
    expect(decision.targetId).toBe("heal");
  });

  it("collects useful healing outside emergency health when the route is safe", () => {
    const world = createWorld(SIMULATION_CONFIG);
    world.state.weaponType = "spread";
    world.state.hp = 76;
    world.pickups.push(
      createPickup({ x: 590, y: 270 }, "xp", "xp"),
      createPickup({ x: 525, y: 270 }, "heal", "heal"),
    );

    const decision = createAutoPilotDecision(world, SIMULATION_CONFIG);

    expect(decision.intentMode).toBe("healCollect");
    expect(decision.intentTargetId).toBe("heal");
  });

  it("keeps a committed pickup goal while movement interrupts for danger", () => {
    const world = createWorld(SIMULATION_CONFIG);
    const player = world.player.position;
    world.pickups.push(createPickup({ x: player.x, y: player.y + 140 }));
    const agent = createAutoPilotAgent();
    const initial = agent.decide(world, SIMULATION_CONFIG);
    expect(initial.intentMode).toBe("xpCollect");

    world.state.elapsed += 0.1;
    world.enemyProjectiles.push({
      id: "incoming",
      position: { x: player.x + 42, y: player.y },
      radius: 5,
      velocity: { x: -180, y: 0 },
      lifetime: 2,
      damage: 8,
    });
    const interrupted = agent.decide(world, SIMULATION_CONFIG);

    expect(interrupted.intentTargetId).toBe(initial.intentTargetId);
    expect(interrupted.executedMode).toBe("projectileDodge");
    expect(["projectileCollision", "projectileThreat"]).toContain(
      interrupted.overrideReason,
    );
  });

  it("releases and cools down a pickup target that makes no progress", () => {
    const world = createWorld(SIMULATION_CONFIG);
    const pickup = createPickup(
      { x: world.player.position.x + 220, y: world.player.position.y },
      "xp",
      "stalled-xp",
    );
    world.pickups.push(pickup);
    const agent = createAutoPilotAgent();

    const initial = agent.decide(world, SIMULATION_CONFIG);
    expect(initial.intentTargetId).toBe(pickup.id);

    world.state.elapsed = 0.4;
    const released = agent.decide(world, SIMULATION_CONFIG);

    expect(released.intentTargetId).not.toBe(pickup.id);
    expect(released.intentSwitchReason).toBe("targetStalled");
    expect(released.pickupSelection.xp?.rejectedByReason.cooldown).toBe(1);
    expect(released.stallAgeSeconds).toBeGreaterThan(0.35);

    world.state.elapsed = 1.31;
    const retried = agent.decide(world, SIMULATION_CONFIG);
    expect(retried.intentTargetId).toBe(pickup.id);
  });

  it("holds a pickup goal for the minimum commit then allows a better target", () => {
    const world = createWorld(SIMULATION_CONFIG);
    world.progression.xp = 0;
    world.progression.xpToNext = 100;
    const player = world.player.position;
    const firstPickup = createPickup(
      { x: player.x, y: player.y + 100 },
      "xp",
      "first",
    );
    const secondPickup = createPickup(
      { x: player.x + 120, y: player.y },
      "xp",
      "second",
    );
    world.pickups.push(firstPickup, secondPickup);
    const agent = createAutoPilotAgent();

    const initial = agent.decide(world, SIMULATION_CONFIG);
    expect(initial.intentTargetId).toBe("first");

    secondPickup.xpValue = 40;
    world.state.elapsed = 0.1;
    const committed = agent.decide(world, SIMULATION_CONFIG);
    expect(committed.intentTargetId).toBe("first");
    expect(committed.intentSwitchReason).toBe("minimumCommit");

    world.player.position.y += 20;
    world.state.elapsed = 0.6;
    const switched = agent.decide(world, SIMULATION_CONFIG);
    expect(switched.intentTargetId).toBe("second");
    expect(switched.intentSwitchReason).toBe("betterUtility");
  });

  it("widens experience collection range while the arena is calm", () => {
    const world = createWorld(SIMULATION_CONFIG);
    const pickup = createPickup({ x: 900, y: 30 });
    world.pickups.push(pickup);

    const decision = createAutoPilotDecision(world, SIMULATION_CONFIG);

    expect(decision.mode).toBe("xpCollect");
    expect(decision.targetId).toBe(pickup.id);
  });

  it("finishes a quick target instead of crossing the arena for experience", () => {
    const world = createWorld(SIMULATION_CONFIG);
    const enemy = createEnemy("quick-kill", { x: 700, y: 270 });
    world.enemies.push(enemy);
    world.pickups.push(createPickup({ x: 60, y: 30 }));

    const decision = createAutoPilotDecision(world, SIMULATION_CONFIG);

    expect(decision.mode).toBe("engage");
    expect(decision.targetId).toBe(enemy.id);
    expect(decision.input.shootHeld).toBe(true);
  });

  it("starts draining a safe field backlog before it reaches the limit", () => {
    const world = createWorld(SIMULATION_CONFIG);
    const enemy = createEnemy("quick-kill", { x: 700, y: 270 });
    world.enemies.push(enemy);
    for (
      let index = 0;
      index <= AUTO_PILOT_FIELD_XP_COLLECTION_THRESHOLD;
      index += 1
    ) {
      world.pickups.push(createPickup(
        { x: 60 + index % 5, y: 30 + index % 7 },
        "xp",
        `backlog-${index}`,
      ));
    }

    const decision = createAutoPilotDecision(world, SIMULATION_CONFIG);

    expect(getFieldXpPickupCount(world)).toBe(
      AUTO_PILOT_FIELD_XP_COLLECTION_THRESHOLD + 1,
    );
    expect(decision.intentMode).toBe("xpCollect");
    expect(decision.intentTargetId).toMatch(/^backlog-/);
  });

  it("collects during warning then immediately fights when danger starts", () => {
    const world = createWorld(SIMULATION_CONFIG);
    const enemy = createEnemy("quick-kill", { x: 700, y: 270 });
    world.enemies.push(enemy);
    world.pickups.push(createPickup({ x: 60, y: 30 }));
    const agent = createAutoPilotAgent();

    const normal = agent.decide(world, SIMULATION_CONFIG);
    expect(normal.intentMode).toBe("engage");

    world.state.elapsed = 0.1;
    world.encounter.director.phase = "warning";
    const warning = agent.decide(world, SIMULATION_CONFIG);
    expect(warning.intentMode).toBe("xpCollect");
    expect(warning.intentSwitchReason).toBe("phaseTransition");

    world.state.elapsed = 0.2;
    world.encounter.director.phase = "active";
    const active = agent.decide(world, SIMULATION_CONFIG);
    expect(["engage", "reposition"]).toContain(active.intentMode);
    expect(active.intentMode).not.toBe("xpCollect");
    expect(active.intentSwitchReason).toBe("phaseTransition");

    world.state.elapsed = 0.6;
    world.encounter.director.phase = "recovery";
    const recovered = agent.decide(world, SIMULATION_CONFIG);
    expect(recovered.intentMode).toBe("engage");
  });

  it("rejects warning XP that cannot finish before danger starts", () => {
    const world = createWorld(SIMULATION_CONFIG);
    world.player.position = { x: 120, y: 100 };
    world.pickups.push(createPickup({ x: 850, y: 440 }));
    world.encounter.director.phase = "warning";
    world.encounter.director.scheduledAt = 0.8;
    world.state.elapsed = 0;

    const decision = createAutoPilotDecision(world, SIMULATION_CONFIG);

    expect(decision.intentMode).not.toBe("xpCollect");
    expect(decision.intentMode).toBe("survive");
  });

  it("drops experience collection and retreats when combat is crowded", () => {
    const world = createWorld(SIMULATION_CONFIG);
    const player = world.player.position;
    world.enemies.push(
      createEnemy("crowd-a", { x: player.x + 70, y: player.y }),
      createEnemy("crowd-b", { x: player.x - 70, y: player.y }),
      createEnemy("crowd-c", { x: player.x, y: player.y + 70 }),
      createEnemy("crowd-d", { x: player.x, y: player.y - 70 }),
    );
    world.pickups.push(createPickup({ x: player.x, y: player.y - 80 }));
    const frame = {
      world,
      config: SIMULATION_CONFIG,
      previousMove: { x: 0, y: 0 },
      previousAimTargetId: null,
    };
    const pressure = assessAutoPilotPressure(frame);
    const aim = DEFAULT_AUTO_PILOT_TARGETING.planAim(
      frame,
      ROT_AUTO_PILOT_NAVIGATION,
    );
    const intent = selectAutoPilotIntent(
      frame,
      aim,
      ROT_AUTO_PILOT_NAVIGATION,
    );

    expect(pressure.posture).toBe("defensive");
    expect(intent.posture).toBe("defensive");
    expect(createAutoPilotDecision(world, SIMULATION_CONFIG).mode).toBe("enemyEvade");
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
    expect(decision.aimTargetId).toBe(enemy.id);
    expect(decision.input.aimWorld?.x).toBeLessThan(enemy.position.x);
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

  it("keeps periodic-v3 inputs unchanged when coverage telemetry is enabled", () => {
    const baselineWorld = createWorld(SIMULATION_CONFIG);
    const measuredWorld = createWorld(SIMULATION_CONFIG);
    const baselineRandom = createRandomStreams(SIMULATION_CONFIG.seed);
    const measuredRandom = createRandomStreams(SIMULATION_CONFIG.seed);
    const baselineAgent = createAutoPilotAgent();
    const measuredAgent = createAutoPilotAgent(undefined, {
      patrolStrategy: "periodic-v3",
      coverageTelemetry: true,
    });

    for (let frame = 0; frame < 5 * 30; frame += 1) {
      const baseline = baselineAgent.decide(baselineWorld, SIMULATION_CONFIG);
      const measured = measuredAgent.decide(measuredWorld, SIMULATION_CONFIG);

      if (measuredWorld.state.status === "playing") {
        expect(measured.coverage).not.toBeNull();
      }
      expect(measured.input).toEqual(baseline.input);
      expect(measured.intentMode).toBe(baseline.intentMode);
      expect(measured.intentTargetId).toBe(baseline.intentTargetId);
      expect(measured.executedMode).toBe(baseline.executedMode);
      stepWorld(
        baselineWorld,
        baseline.input,
        1 / 30,
        baselineRandom,
        SIMULATION_CONFIG,
      );
      stepWorld(
        measuredWorld,
        measured.input,
        1 / 30,
        measuredRandom,
        SIMULATION_CONFIG,
      );
    }

    expect(measuredWorld).toEqual(baselineWorld);
  });

  it("visits at least eight safe regions within thirty calm seconds", () => {
    const world = createWorld(SIMULATION_CONFIG);
    world.state.status = "playing";
    world.obstacles = [];
    world.enemies = [];
    world.enemyProjectiles = [];
    world.pickups = [];
    world.encounter.director.phase = "pending";
    const agent = createAutoPilotAgent(undefined, {
      patrolStrategy: "visit-history-v1",
    });
    let decision = agent.decide(world, SIMULATION_CONFIG);

    for (let frame = 0; frame < 30 * 30; frame += 1) {
      const speed = SIMULATION_CONFIG.player.speed *
        world.runtime.playerSpeedMultiplier;
      world.player.position.x += decision.input.move.x * speed / 30;
      world.player.position.y += decision.input.move.y * speed / 30;
      world.state.elapsed += 1 / 30;
      decision = agent.decide(world, SIMULATION_CONFIG);
    }

    expect(decision.coverage?.reachableZoneIds).toHaveLength(9);
    expect(decision.coverage?.visitedZoneIds30Seconds.length).toBeGreaterThanOrEqual(8);
  });

  it("traverses an overdue calm region while continuing to shoot", () => {
    const world = createWorld(SIMULATION_CONFIG);
    world.state.status = "playing";
    world.obstacles = [];
    world.enemies = [];
    world.pickups = [];
    world.encounter.director.phase = "pending";
    world.enemies.push(createEnemy(
      "far-target",
      { x: 820, y: 270 },
      "chaser",
      { speed: 0, damage: 0 },
    ));
    const agent = createAutoPilotAgent(undefined, {
      patrolStrategy: "visit-history-v1",
    });
    agent.decide(world, SIMULATION_CONFIG);
    world.state.elapsed = 31;

    const decision = agent.decide(world, SIMULATION_CONFIG);

    expect(decision.intentMode).toBe("patrol");
    expect(decision.intentTargetId).toMatch(/^coverage:/);
    expect(decision.input.shootHeld).toBe(true);
    expect(decision.aimTargetId).toBe("far-target");
  });

  it("keeps field backlog collection ahead of overdue coverage", () => {
    const world = createWorld(SIMULATION_CONFIG);
    world.state.status = "playing";
    world.obstacles = [];
    world.enemies = [];
    world.pickups = [];
    world.encounter.director.phase = "pending";
    world.enemies.push(createEnemy("initial-target", { x: 820, y: 270 }));
    const agent = createAutoPilotAgent(undefined, {
      patrolStrategy: "visit-history-v1",
    });
    agent.decide(world, SIMULATION_CONFIG);
    world.state.elapsed = 31;
    world.enemies = [];
    const backlogPickups = [createPickup(
      { x: world.player.position.x + 40, y: world.player.position.y },
      "xp",
      "coverage-backlog-near",
    )];
    for (
      let index = 1;
      index <= AUTO_PILOT_FIELD_XP_COLLECTION_THRESHOLD;
      index += 1
    ) {
      backlogPickups.push(createPickup(
        {
          x: 160 + index % 6 * 120,
          y: 80 + Math.floor(index / 6) * 60,
        },
        "xp",
        `coverage-backlog-${index}`,
      ));
    }
    world.pickups = backlogPickups;

    const decision = agent.decide(world, SIMULATION_CONFIG);

    expect(decision.intentMode).toBe("xpCollect");
    expect(decision.intentTargetId).toMatch(/^coverage-backlog-/);
  });

  it("sweeps a dense region when backlog pickups have no safe direct path", () => {
    const world = createWorld(SIMULATION_CONFIG);
    world.state.status = "playing";
    world.enemies = [createEnemy("backlog-guard", { x: 710, y: 400 })];
    world.encounter.director.phase = "pending";
    world.obstacles = [];
    world.pickups = Array.from(
      { length: AUTO_PILOT_FIELD_XP_LIMIT + 1 },
      (_, index) => createPickup(
        { x: 710 + index % 3, y: 400 + index % 4 },
        "xp",
        `sealed-xp-${index}`,
      ),
    );
    const agent = createAutoPilotAgent(undefined, {
      patrolStrategy: "visit-history-v1",
    });

    const decision = agent.decide(world, SIMULATION_CONFIG);

    expect(decision.intentMode).toBe("patrol");
    expect(decision.intentTargetId).toBe("coverage:south-east");
    expect(decision.coverage?.targetXpPickupCount).toBe(
      AUTO_PILOT_FIELD_XP_LIMIT + 1,
    );
    expect(decision.intentUtility).toBeGreaterThan(1);
  });

  it("does not execute visit-history patrol during warning or active danger", () => {
    const world = createWorld(SIMULATION_CONFIG);
    world.state.status = "playing";
    world.enemies = [];
    world.pickups = [];
    const agent = createAutoPilotAgent(undefined, {
      patrolStrategy: "visit-history-v1",
    });
    agent.decide(world, SIMULATION_CONFIG);

    world.state.elapsed = 1;
    world.encounter.director.phase = "warning";
    const warning = agent.decide(world, SIMULATION_CONFIG);
    world.state.elapsed = 2;
    world.encounter.director.phase = "active";
    const active = agent.decide(world, SIMULATION_CONFIG);

    expect(warning.intentMode).toBe("survive");
    expect(active.intentMode).toBe("survive");
    expect(warning.coverage?.clock).toBe(active.coverage?.clock);
  });

  it("drives an integrated Pulse run through combat, recovery, and upgrades", () => {
    const world = createWorld(SIMULATION_CONFIG);
    const random = createRandomStreams(SIMULATION_CONFIG.seed);
    const modeCounts = new Map<string, number>();
    const agent = createAutoPilotAgent();
    let stationaryXpFrames = 0;
    let longestStationaryXpFrames = 0;

    for (let frame = 0; frame < 120 * 30 && world.state.status !== "gameOver"; frame += 1) {
      const decision = agent.decide(world, SIMULATION_CONFIG);
      modeCounts.set(decision.mode, (modeCounts.get(decision.mode) ?? 0) + 1);
      if (
        decision.intentMode === "xpCollect" &&
        Math.hypot(decision.input.move.x, decision.input.move.y) < 0.001
      ) {
        stationaryXpFrames += 1;
        longestStationaryXpFrames = Math.max(
          longestStationaryXpFrames,
          stationaryXpFrames,
        );
      } else {
        stationaryXpFrames = 0;
      }
      stepWorld(world, decision.input, 1 / 30, random, SIMULATION_CONFIG);
    }

    expect(world.state.elapsed).toBeGreaterThan(115);
    expect(world.stats.shotsFired).toBeGreaterThan(0);
    expect(world.stats.enemiesKilled).toBeGreaterThan(0);
    expect(world.stats.xpCollected).toBeGreaterThan(0);
    expect(world.stats.upgradesChosen).toBeGreaterThan(0);
    expect(modeCounts.get("xpCollect") ?? 0).toBeGreaterThan(0);
    expect(modeCounts.get("projectileDodge") ?? 0).toBeGreaterThan(0);
    expect(longestStationaryXpFrames / 30).toBeLessThan(1);
  }, 10_000);
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

function createPickup(
  position: Pickup["position"],
  kind: Pickup["kind"] = "xp",
  id = "pickup",
): Pickup {
  return {
    id,
    kind,
    position,
    radius:
      kind === "heal"
        ? SIMULATION_CONFIG.pickup.healRadius
        : SIMULATION_CONFIG.pickup.xpRadius,
    xpValue: kind === "xp" ? 1 : 0,
    healValue: kind === "heal" ? 12 : 0,
    lifetime: kind === "heal" ? SIMULATION_CONFIG.pickup.healLifetime : null,
  };
}

function distanceFromSegment(
  point: { x: number; y: number },
  start: { x: number; y: number },
  end: { x: number; y: number },
): number {
  const delta = { x: end.x - start.x, y: end.y - start.y };
  const lengthSquared = delta.x ** 2 + delta.y ** 2;
  if (lengthSquared <= 0.000001) return Math.hypot(point.x - start.x, point.y - start.y);
  const ratio = Math.max(
    0,
    Math.min(
      1,
      ((point.x - start.x) * delta.x + (point.y - start.y) * delta.y) /
        lengthSquared,
    ),
  );
  return Math.hypot(
    point.x - (start.x + delta.x * ratio),
    point.y - (start.y + delta.y * ratio),
  );
}
