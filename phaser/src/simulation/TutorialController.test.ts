import { describe, expect, it } from "vitest";
import { SIMULATION_CONFIG } from "../config/gameConfig";
import type { GameEvent, WorldState } from "../domain/types";
import { createWorld } from "./createWorld";
import {
  BASIC_TUTORIAL_COMBAT_ENEMY_POSITION,
  BASIC_TUTORIAL_COMBAT_PLAYER_POSITION,
  BASIC_TUTORIAL_MOVE_DISTANCE,
  BASIC_TUTORIAL_NAVIGATION_START,
  BASIC_TUTORIAL_NAVIGATION_WAYPOINTS,
  BASIC_TUTORIAL_NAVIGATION_ZONE,
  BASIC_TUTORIAL_UPGRADE_CHOICES,
  TutorialController,
} from "./TutorialController";

describe("TutorialController", () => {
  it("advances only from the matching world state and normal gameplay events", () => {
    const world = createWorld(SIMULATION_CONFIG);
    const controller = new TutorialController();
    controller.initialize(world, SIMULATION_CONFIG);

    expect(controller.getSnapshot()).toMatchObject({
      stepId: "move",
      phase: "briefing",
      progress: { current: 0, required: BASIC_TUTORIAL_MOVE_DISTANCE },
    });
    expect(world.state.status).toBe("trainingBriefing");
    activateCurrentStep(controller, world);

    advanceFrame(controller, world, [], () => {
      world.player.position.x += BASIC_TUTORIAL_MOVE_DISTANCE;
      world.state.elapsed += 0.25;
    });
    expect(controller.getSnapshot()).toMatchObject({
      stepId: "navigate",
      phase: "briefing",
      target: null,
    });
    expect(world.player.position).toEqual(BASIC_TUTORIAL_NAVIGATION_START);
    activateCurrentStep(controller, world);
    expect(controller.getSnapshot().target?.guidePath).toEqual(
      BASIC_TUTORIAL_NAVIGATION_WAYPOINTS,
    );

    advanceFrame(controller, world, [], () => {
      world.player.position = {
        x: BASIC_TUTORIAL_NAVIGATION_ZONE.x,
        y: BASIC_TUTORIAL_NAVIGATION_ZONE.y,
      };
      world.state.elapsed += 0.25;
    });
    expect(controller.getSnapshot()).toMatchObject({
      stepId: "contactDamage",
      phase: "briefing",
      target: null,
    });
    activateCurrentStep(controller, world);
    const contact = controller.getSnapshot();
    expect(world.player.position).toEqual(BASIC_TUTORIAL_COMBAT_PLAYER_POSITION);
    expect(contact.target).toMatchObject({
      kind: "enemy",
      position: BASIC_TUTORIAL_COMBAT_ENEMY_POSITION,
    });
    expect(
      controller.prepareInput({
        move: { x: 1, y: -1 },
        aimWorld: { x: 900, y: 270 },
        startPressed: false,
        shootHeld: true,
        restartPressed: false,
        pausePressed: true,
        quitToTitlePressed: false,
        upgradeChoicePressed: null,
      }),
    ).toMatchObject({
      move: { x: 0, y: 0 },
      aimWorld: null,
      shootHeld: false,
      pausePressed: true,
    });

    const contactDamage = SIMULATION_CONFIG.enemies.chaser.damage;
    advanceFrame(
      controller,
      world,
      [
        {
          type: "player.damaged",
          damage: contactDamage,
          hpAfter: SIMULATION_CONFIG.player.maxHp - contactDamage,
          source: {
            kind: "contact",
            enemyId: contact.target!.id!,
            enemyType: "chaser",
          },
        },
      ],
      () => {
        world.state.hp = SIMULATION_CONFIG.player.maxHp - contactDamage;
      },
    );
    expect(controller.getSnapshot()).toMatchObject({
      stepId: "aimAndKill",
      phase: "briefing",
      lastCompletedStepId: "contactDamage",
    });
    expect(world.state.hp).toBe(SIMULATION_CONFIG.player.maxHp - contactDamage);
    expect(world.enemies).toEqual([]);

    activateCurrentStep(controller, world);
    const aim = controller.getSnapshot();
    expect(world.player.position).toEqual(BASIC_TUTORIAL_COMBAT_PLAYER_POSITION);
    expect(world.state.hp).toBe(SIMULATION_CONFIG.player.maxHp);
    expect(aim.target).toMatchObject({
      kind: "enemy",
      position: BASIC_TUTORIAL_COMBAT_ENEMY_POSITION,
    });

    const targetEnemyId = aim.target!.id!;
    const targetPosition = { ...aim.target!.position };
    const xpId = `pickup-${world.nextPickupId++}`;
    world.enemies = [];
    world.pickups.push({
      id: xpId,
      kind: "xp",
      position: targetPosition,
      radius: SIMULATION_CONFIG.pickup.xpRadius,
      xpValue: 1,
      healValue: 0,
      lifetime: null,
    });
    advanceFrame(controller, world, [
      enemyKilled(targetEnemyId, targetPosition),
      {
        type: "pickup.spawned",
        pickupId: xpId,
        pickupKind: "xp",
        position: targetPosition,
        xpValue: 1,
        healValue: 0,
        lifetime: null,
      },
    ]);
    expect(controller.getSnapshot()).toMatchObject({
      stepId: "collectXp",
      phase: "briefing",
      target: null,
    });
    activateCurrentStep(controller, world);
    expect(controller.getSnapshot()).toMatchObject({
      stepId: "collectXp",
      phase: "active",
      target: {
        id: xpId,
        kind: "pickup",
        position: { x: 480, y: 100 },
      },
    });

    world.pickups = [];
    advanceFrame(controller, world, [
      {
        type: "pickup.collected",
        pickupId: xpId,
        pickupKind: "xp",
        xpValue: 1,
        healValue: 0,
        hpRecovered: 0,
      },
    ]);
    expect(controller.getSnapshot()).toMatchObject({
      stepId: "chooseUpgrade",
      phase: "briefing",
      target: null,
    });
    expect(world.progression.pendingUpgradeChoices).toEqual([]);
    activateCurrentStep(controller, world);
    expect(world.progression.pendingUpgradeChoices).toEqual(
      BASIC_TUTORIAL_UPGRADE_CHOICES,
    );

    world.state.status = "playing";
    world.progression.pendingUpgradeChoices = [];
    advanceFrame(controller, world, [
      {
        type: "upgrade.selected",
        upgradeId: "rapidFire",
        rank: 1,
        level: 2,
        effect: SIMULATION_CONFIG.upgrades.rapidFire.effect,
      },
    ]);
    expect(controller.getSnapshot()).toMatchObject({
      stepId: "dodgeProjectile",
      phase: "briefing",
      selectedUpgradeId: "rapidFire",
    });
    activateCurrentStep(controller, world);
    expect(controller.getSnapshot()).toMatchObject({
      stepId: "dodgeProjectile",
      phase: "active",
      progress: { current: 0, required: 2 },
      readySecondsRemaining: 1,
    });
    expect(world.enemyProjectiles).toHaveLength(0);

    advanceFrame(controller, world, [], () => {
      world.state.elapsed += 1;
    });
    expect(world.enemyProjectiles).toHaveLength(1);

    world.enemyProjectiles = [];
    advanceFrame(controller, world);
    expect(controller.getSnapshot().progress.current).toBe(1);
    world.enemyProjectiles = [];
    advanceFrame(controller, world);
    expect(controller.getSnapshot()).toMatchObject({
      stepId: "collectRepair",
      phase: "briefing",
      retryCount: 0,
    });
    activateCurrentStep(controller, world);

    const healId = controller.getSnapshot().target!.id!;
    world.pickups = [];
    advanceFrame(controller, world, [
      {
        type: "pickup.collected",
        pickupId: healId,
        pickupKind: "heal",
        xpValue: 0,
        healValue: 12,
        hpRecovered: 12,
      },
    ]);
    expect(controller.getSnapshot()).toMatchObject({
      stepId: "transferDrill",
      phase: "briefing",
    });
    expect(world.enemies).toEqual([]);
    activateCurrentStep(controller, world);
    expect(world.enemies.map((enemy) => enemy.typeId)).toEqual([
      "chaser",
      "brute",
      "ranged",
    ]);
    expect(world.player.position).toEqual({ x: 480, y: 270 });
    const transferRepair = world.pickups.find((pickup) => pickup.kind === "heal");
    expect(transferRepair).toMatchObject({
      position: { x: 480, y: 420 },
      lifetime: null,
    });
    expect(
      Math.hypot(
        transferRepair!.position.x - world.player.position.x,
        transferRepair!.position.y - world.player.position.y,
      ),
    ).toBeGreaterThan(SIMULATION_CONFIG.pickup.magnetRadius);

    const enemyIds = world.enemies.map((enemy) => enemy.id);
    const xpPickups = enemyIds.map((_, index) => ({
      id: `transfer-xp-${index}`,
      kind: "xp" as const,
      position: { x: 200 + index * 280, y: 270 },
      radius: SIMULATION_CONFIG.pickup.xpRadius,
      xpValue: 1,
      healValue: 0,
      lifetime: null,
    }));
    world.enemies = [];
    world.pickups.push(...xpPickups);
    advanceFrame(controller, world, [
      ...enemyIds.map((enemyId, index) =>
        enemyKilled(enemyId, xpPickups[index]!.position),
      ),
      ...xpPickups.map(
        (pickup): GameEvent => ({
          type: "pickup.spawned",
          pickupId: pickup.id,
          pickupKind: "xp",
          position: { ...pickup.position },
          xpValue: 1,
          healValue: 0,
          lifetime: null,
        }),
      ),
    ]);
    expect(controller.getSnapshot()).toMatchObject({
      stepId: "transferDrill",
      transfer: {
        kills: 3,
        enemiesRemaining: 0,
        pickupsRemaining: 4,
      },
    });

    world.pickups = [];
    advanceFrame(controller, world, [
      {
        type: "pickup.collected",
        pickupId: transferRepair!.id,
        pickupKind: "heal",
        xpValue: 0,
        healValue: transferRepair!.healValue,
        hpRecovered: transferRepair!.healValue,
      },
      ...xpPickups.map(
        (pickup): Extract<GameEvent, { type: "pickup.collected" }> => ({
          type: "pickup.collected",
          pickupId: pickup.id,
          pickupKind: "xp",
          xpValue: pickup.xpValue,
          healValue: 0,
          hpRecovered: 0,
        }),
      ),
    ]);
    expect(controller.getSnapshot()).toMatchObject({
      stepId: "complete",
      stepNumber: 9,
      stepCount: 9,
    });
    expect(world.state.status).toBe("trainingComplete");
  });

  it("restores the current step checkpoint after projectile damage", () => {
    const world = createWorld(SIMULATION_CONFIG);
    const controller = new TutorialController();
    controller.initialize(world, SIMULATION_CONFIG);
    reachDodgeStep(controller, world);
    advanceFrame(controller, world, [], () => {
      world.state.elapsed += 1;
    });

    const projectileId = world.enemyProjectiles[0]!.id;
    world.enemyProjectiles = [];
    world.state.hp = 0;
    world.state.status = "gameOver";
    const events: GameEvent[] = [
      {
        type: "player.damaged",
        damage: 8,
        hpAfter: 0,
        source: { kind: "projectile", projectileId },
      },
      { type: "game.over", score: 0, elapsed: world.state.elapsed },
    ];
    const added = advanceFrame(controller, world, events);

    expect(controller.getSnapshot()).toMatchObject({
      stepId: "dodgeProjectile",
      retryCount: 1,
      retryReason: "enemyProjectile",
      readySecondsRemaining: 1,
      progress: { current: 0, required: 2 },
    });
    expect(world.state.status).toBe("playing");
    expect(world.enemyProjectiles).toHaveLength(0);
    expect(events.some((event) => event.type === "game.over")).toBe(false);
    expect(added).toContainEqual({
      type: "tutorial.step.retried",
      stepId: "dodgeProjectile",
      retryCount: 1,
      reason: "enemyProjectile",
    });
  });

  it("keeps no-progress hint time within a retried task and clears retry state on advance", () => {
    const world = createWorld(SIMULATION_CONFIG);
    const controller = new TutorialController();
    controller.initialize(world, SIMULATION_CONFIG);
    reachDodgeStep(controller, world);
    advanceFrame(controller, world, [], () => {
      world.state.elapsed += 5.1;
    });
    const projectileId = world.enemyProjectiles[0]!.id;
    const events: GameEvent[] = [
      {
        type: "player.damaged",
        damage: 8,
        hpAfter: world.state.hp - 8,
        source: { kind: "projectile", projectileId },
      },
    ];

    advanceFrame(controller, world, events);
    expect(controller.getSnapshot()).toMatchObject({
      stepId: "dodgeProjectile",
      retryCount: 1,
      retryReason: "enemyProjectile",
      hintLevel: 1,
      stepActiveSeconds: 5.1,
      noProgressSeconds: 5.1,
    });

    advanceFrame(controller, world, [], () => {
      world.state.elapsed += 1;
    });
    world.enemyProjectiles = [];
    advanceFrame(controller, world);
    world.enemyProjectiles = [];
    advanceFrame(controller, world);
    expect(controller.getSnapshot()).toMatchObject({
      stepId: "collectRepair",
      retryCount: 0,
      retryReason: null,
    });
  });

  it("uses an obstacle-safe navigation guide for a route that cannot be walked straight", () => {
    const obstacle = SIMULATION_CONFIG.obstacles[0]!;
    const margin = SIMULATION_CONFIG.player.radius;
    const expanded = {
      x: obstacle.x - margin,
      y: obstacle.y - margin,
      width: obstacle.width + margin * 2,
      height: obstacle.height + margin * 2,
    };
    const route = [
      BASIC_TUTORIAL_NAVIGATION_START,
      ...BASIC_TUTORIAL_NAVIGATION_WAYPOINTS,
      BASIC_TUTORIAL_NAVIGATION_ZONE,
    ];

    expect(
      segmentIntersectsRect(
        BASIC_TUTORIAL_NAVIGATION_START,
        BASIC_TUTORIAL_NAVIGATION_ZONE,
        expanded,
      ),
    ).toBe(true);
    expect(
      route.slice(1).some((point, index) =>
        segmentIntersectsRect(route[index]!, point, expanded),
      ),
    ).toBe(false);
  });

  it("reveals hints only after consecutive no-progress windows", () => {
    const world = createWorld(SIMULATION_CONFIG);
    const controller = new TutorialController();
    controller.initialize(world, SIMULATION_CONFIG);
    activateCurrentStep(controller, world);

    advanceFrame(controller, world, [], () => {
      world.state.elapsed += 4.9;
    });
    expect(controller.getSnapshot()).toMatchObject({
      hintLevel: 0,
      noProgressSeconds: 4.9,
    });

    const h1Events = advanceFrame(controller, world, [], () => {
      world.state.elapsed += 0.1;
    });
    expect(controller.getSnapshot().hintLevel).toBe(1);
    expect(h1Events).toContainEqual(
      expect.objectContaining({
        type: "tutorial.hint.shown",
        stepId: "move",
        hintLevel: 1,
      }),
    );

    const h2Events = advanceFrame(controller, world, [], () => {
      world.state.elapsed += 5;
    });
    expect(controller.getSnapshot()).toMatchObject({
      hintLevel: 2,
      noProgressSeconds: 10,
    });
    expect(h2Events).toContainEqual(
      expect.objectContaining({
        type: "tutorial.hint.shown",
        stepId: "move",
        hintLevel: 2,
      }),
    );
  });

  it("resets no-progress hints only for meaningful task progress", () => {
    const world = createWorld(SIMULATION_CONFIG);
    const controller = new TutorialController();
    controller.initialize(world, SIMULATION_CONFIG);
    activateCurrentStep(controller, world);

    advanceFrameWithInput(
      controller,
      world,
      { shootHeld: true },
      4.9,
    );
    expect(controller.getSnapshot()).toMatchObject({
      hintLevel: 0,
      noProgressSeconds: 4.9,
    });

    advanceFrameWithInput(
      controller,
      world,
      { shootHeld: true },
      0.2,
    );
    expect(controller.getSnapshot().hintLevel).toBe(1);
    expect(controller.getSnapshot().noProgressSeconds).toBeCloseTo(5.1);

    advanceFrameWithInput(
      controller,
      world,
      { move: { x: 1, y: 0 } },
      0.1,
      () => {
        world.player.position.x += 1;
      },
    );
    expect(controller.getSnapshot()).toMatchObject({
      hintLevel: 0,
      noProgressSeconds: 0,
    });
  });

  it("does not advance no-progress time when simulation elapsed is frozen", () => {
    const world = createWorld(SIMULATION_CONFIG);
    const controller = new TutorialController();
    controller.initialize(world, SIMULATION_CONFIG);
    activateCurrentStep(controller, world);

    advanceFrame(controller, world);
    expect(controller.getSnapshot()).toMatchObject({
      stepActiveSeconds: 0,
      noProgressSeconds: 0,
      hintLevel: 0,
    });
  });

  it("ignores unrelated and duplicate success events", () => {
    const world = createWorld(SIMULATION_CONFIG);
    const controller = new TutorialController();
    controller.initialize(world, SIMULATION_CONFIG);
    reachAimStep(controller, world);

    const target = controller.getSnapshot().target!;
    advanceFrame(controller, world, [
      enemyKilled("unrelated-enemy", target.position),
    ]);
    expect(controller.getSnapshot().stepId).toBe("aimAndKill");

    const pickupId = `pickup-${world.nextPickupId++}`;
    world.enemies = [];
    world.pickups.push({
      id: pickupId,
      kind: "xp",
      position: { ...target.position },
      radius: SIMULATION_CONFIG.pickup.xpRadius,
      xpValue: 1,
      healValue: 0,
      lifetime: null,
    });
    const events: GameEvent[] = [
      enemyKilled(target.id!, target.position),
      enemyKilled(target.id!, target.position),
      {
        type: "pickup.spawned",
        pickupId,
        pickupKind: "xp",
        position: { ...target.position },
        xpValue: 1,
        healValue: 0,
        lifetime: null,
      },
    ];
    const added = advanceFrame(controller, world, events);

    expect(controller.getSnapshot().stepId).toBe("collectXp");
    expect(
      added.filter(
        (event) =>
          event.type === "tutorial.step.completed" &&
          event.stepId === "aimAndKill",
      ),
    ).toHaveLength(1);

    advanceFrame(controller, world, [
      {
        type: "pickup.collected",
        pickupId: "unrelated-pickup",
        pickupKind: "xp",
        xpValue: 1,
        healValue: 0,
        hpRecovered: 0,
      },
    ]);
    expect(controller.getSnapshot().stepId).toBe("collectXp");
  });

  it("freezes its active clock while paused or selecting an upgrade", () => {
    const world = createWorld(SIMULATION_CONFIG);
    const controller = new TutorialController();
    controller.initialize(world, SIMULATION_CONFIG);
    activateCurrentStep(controller, world);

    world.state.status = "paused";
    advanceFrame(controller, world, [], () => {
      world.state.elapsed += 30;
    });
    expect(controller.getSnapshot()).toMatchObject({
      stepActiveSeconds: 0,
      hintLevel: 0,
    });

    world.state.status = "upgradeSelect";
    advanceFrame(controller, world, [], () => {
      world.state.elapsed += 30;
    });
    expect(controller.getSnapshot()).toMatchObject({
      stepActiveSeconds: 0,
      hintLevel: 0,
    });
  });

  it("returns a paused Training upgrade task to upgrade selection", () => {
    const world = createWorld(SIMULATION_CONFIG);
    const controller = new TutorialController();
    controller.initialize(world, SIMULATION_CONFIG);
    reachUpgradeStep(controller, world);
    activateCurrentStep(controller, world);
    expect(world.state.status).toBe("upgradeSelect");

    world.state.status = "playing";
    advanceFrame(controller, world, [
      { type: "game.resumed", elapsed: world.state.elapsed },
    ]);

    expect(world.state.status).toBe("upgradeSelect");
    expect(controller.getSnapshot()).toMatchObject({
      stepId: "chooseUpgrade",
      phase: "active",
    });
  });

  it("restarts only the transfer drill after defeat", () => {
    const world = createWorld(SIMULATION_CONFIG);
    const controller = new TutorialController();
    controller.initialize(world, SIMULATION_CONFIG);
    reachTransferStep(controller, world);

    const checkpointEnemyIds = world.enemies.map((enemy) => enemy.id);
    const events: GameEvent[] = [
      {
        type: "player.damaged",
        damage: 100,
        hpAfter: 0,
        source: { kind: "contact", enemyId: "enemy-x", enemyType: "chaser" },
      },
      { type: "game.over", score: 0, elapsed: world.state.elapsed },
    ];
    world.state.status = "gameOver";
    world.state.hp = 0;
    world.enemies = [];
    advanceFrame(controller, world, events);

    expect(controller.getSnapshot()).toMatchObject({
      stepId: "transferDrill",
      retryCount: 1,
      transfer: { survivalSeconds: 0, kills: 0, pickups: 0 },
    });
    expect(world.state.status).toBe("playing");
    expect(world.enemies.map((enemy) => enemy.id)).toEqual(checkpointEnemyIds);
    expect(events.some((event) => event.type === "game.over")).toBe(false);
  });
});

function reachAimStep(
  controller: TutorialController,
  world: WorldState,
): void {
  activateCurrentStep(controller, world);
  advanceFrame(controller, world, [], () => {
    world.player.position.x += BASIC_TUTORIAL_MOVE_DISTANCE;
    world.state.elapsed += 0.1;
  });
  activateCurrentStep(controller, world);
  advanceFrame(controller, world, [], () => {
    world.player.position = {
      x: BASIC_TUTORIAL_NAVIGATION_ZONE.x,
      y: BASIC_TUTORIAL_NAVIGATION_ZONE.y,
    };
    world.state.elapsed += 0.1;
  });
  activateCurrentStep(controller, world);
  const contactEnemyId = controller.getSnapshot().target!.id!;
  advanceFrame(controller, world, [
    {
      type: "player.damaged",
      damage: SIMULATION_CONFIG.enemies.chaser.damage,
      hpAfter:
        SIMULATION_CONFIG.player.maxHp -
        SIMULATION_CONFIG.enemies.chaser.damage,
      source: {
        kind: "contact",
        enemyId: contactEnemyId,
        enemyType: "chaser",
      },
    },
  ]);
  activateCurrentStep(controller, world);
}

function reachDodgeStep(
  controller: TutorialController,
  world: WorldState,
): void {
  reachUpgradeStep(controller, world);
  activateCurrentStep(controller, world);
  world.state.status = "playing";
  world.progression.pendingUpgradeChoices = [];
  advanceFrame(controller, world, [
    {
      type: "upgrade.selected",
      upgradeId: "rapidFire",
      rank: 1,
      level: 2,
      effect: SIMULATION_CONFIG.upgrades.rapidFire.effect,
    },
  ]);
  activateCurrentStep(controller, world);
}

function reachUpgradeStep(
  controller: TutorialController,
  world: WorldState,
): void {
  reachAimStep(controller, world);
  const enemyId = controller.getSnapshot().target!.id!;
  const position = { ...controller.getSnapshot().target!.position };
  const pickupId = `pickup-${world.nextPickupId++}`;
  world.enemies = [];
  world.pickups.push({
    id: pickupId,
    kind: "xp",
    position,
    radius: SIMULATION_CONFIG.pickup.xpRadius,
    xpValue: 1,
    healValue: 0,
    lifetime: null,
  });
  advanceFrame(controller, world, [
    enemyKilled(enemyId, position),
    {
      type: "pickup.spawned",
      pickupId,
      pickupKind: "xp",
      position,
      xpValue: 1,
      healValue: 0,
      lifetime: null,
    },
  ]);
  activateCurrentStep(controller, world);
  world.pickups = [];
  advanceFrame(controller, world, [
    {
      type: "pickup.collected",
      pickupId,
      pickupKind: "xp",
      xpValue: 1,
      healValue: 0,
      hpRecovered: 0,
    },
  ]);
}

function reachTransferStep(
  controller: TutorialController,
  world: WorldState,
): void {
  reachDodgeStep(controller, world);
  advanceFrame(controller, world, [], () => {
    world.state.elapsed += 1;
  });
  world.enemyProjectiles = [];
  advanceFrame(controller, world);
  world.enemyProjectiles = [];
  advanceFrame(controller, world);
  activateCurrentStep(controller, world);
  const healId = controller.getSnapshot().target!.id!;
  world.pickups = [];
  advanceFrame(controller, world, [
    {
      type: "pickup.collected",
      pickupId: healId,
      pickupKind: "heal",
      xpValue: 0,
      healValue: 12,
      hpRecovered: 12,
    },
  ]);
  activateCurrentStep(controller, world);
}

function segmentIntersectsRect(
  start: { x: number; y: number },
  end: { x: number; y: number },
  rect: { x: number; y: number; width: number; height: number },
): boolean {
  const steps = 200;
  for (let index = 0; index <= steps; index += 1) {
    const ratio = index / steps;
    const x = start.x + (end.x - start.x) * ratio;
    const y = start.y + (end.y - start.y) * ratio;
    if (
      x >= rect.x &&
      x <= rect.x + rect.width &&
      y >= rect.y &&
      y <= rect.y + rect.height
    ) {
      return true;
    }
  }
  return false;
}

function advanceFrame(
  controller: TutorialController,
  world: WorldState,
  events: GameEvent[] = [],
  mutate: () => void = () => undefined,
  tutorialContinuePressed = false,
): GameEvent[] {
  const frameBefore = {
    elapsed: world.state.elapsed,
    playerPosition: { ...world.player.position },
  };
  mutate();
  return controller.update(world, SIMULATION_CONFIG, events, frameBefore, {
    tutorialContinuePressed,
  });
}

function advanceFrameWithInput(
  controller: TutorialController,
  world: WorldState,
  input: {
    move?: { x: number; y: number };
    aimWorld?: { x: number; y: number } | null;
    shootHeld?: boolean;
  },
  elapsed: number,
  mutate: () => void = () => undefined,
): GameEvent[] {
  const frameBefore = {
    elapsed: world.state.elapsed,
    playerPosition: { ...world.player.position },
  };
  mutate();
  world.state.elapsed += elapsed;
  return controller.update(world, SIMULATION_CONFIG, [], frameBefore, input);
}

function activateCurrentStep(
  controller: TutorialController,
  world: WorldState,
): void {
  const stepId = controller.getSnapshot().stepId;
  const added = advanceFrame(controller, world, [], () => undefined, true);
  expect(controller.getSnapshot()).toMatchObject({ stepId, phase: "active" });
  expect(added).toContainEqual({
    type: "tutorial.step.activated",
    stepId,
    stepNumber: controller.getSnapshot().stepNumber,
  });
}

function enemyKilled(
  enemyId: string,
  position: { x: number; y: number },
): Extract<GameEvent, { type: "enemy.killed" }> {
  return {
    type: "enemy.killed",
    bulletId: "bullet-1",
    volleyId: 1,
    enemyId,
    enemyType: "chaser",
    weaponType: "pulse",
    scoreAwarded: 10,
    xpAwarded: 1,
    position,
  };
}
