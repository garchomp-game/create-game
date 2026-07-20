import { describe, expect, it } from "vitest";
import { SIMULATION_CONFIG } from "../config/gameConfig";
import type { GameEvent, WorldState } from "../domain/types";
import { createWorld } from "./createWorld";
import {
  BASIC_TUTORIAL_MOVE_DISTANCE,
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
      progress: { current: 0, required: BASIC_TUTORIAL_MOVE_DISTANCE },
    });

    advanceFrame(controller, world, [], () => {
      world.player.position.x += BASIC_TUTORIAL_MOVE_DISTANCE;
      world.state.elapsed += 0.25;
    });
    expect(controller.getSnapshot().stepId).toBe("navigate");

    advanceFrame(controller, world, [], () => {
      world.player.position = {
        x: BASIC_TUTORIAL_NAVIGATION_ZONE.x,
        y: BASIC_TUTORIAL_NAVIGATION_ZONE.y,
      };
      world.state.elapsed += 0.25;
    });
    const aim = controller.getSnapshot();
    expect(aim.stepId).toBe("aimAndKill");
    expect(aim.target).toMatchObject({ kind: "enemy" });

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
      stepId: "dodgeProjectile",
      progress: { current: 0, required: 2 },
    });

    world.enemyProjectiles = [];
    advanceFrame(controller, world);
    expect(controller.getSnapshot().progress.current).toBe(1);
    world.enemyProjectiles = [];
    advanceFrame(controller, world);
    expect(controller.getSnapshot().stepId).toBe("collectRepair");

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
    expect(controller.getSnapshot().stepId).toBe("chooseUpgrade");
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
      stepId: "transferDrill",
      target: null,
    });
    expect(world.enemies.map((enemy) => enemy.typeId)).toEqual([
      "chaser",
      "brute",
      "ranged",
    ]);

    advanceFrame(
      controller,
      world,
      [
        enemyKilled("transfer-a", { x: 100, y: 270 }),
        enemyKilled("transfer-b", { x: 860, y: 270 }),
        {
          type: "pickup.collected",
          pickupId: "transfer-xp",
          pickupKind: "xp",
          xpValue: 1,
          healValue: 0,
          hpRecovered: 0,
        },
      ],
      () => {
        world.state.elapsed += 20;
      },
    );
    expect(controller.getSnapshot().stepId).toBe("complete");
    expect(world.state.status).toBe("trainingComplete");
  });

  it("restores the current step checkpoint after projectile damage", () => {
    const world = createWorld(SIMULATION_CONFIG);
    const controller = new TutorialController();
    controller.initialize(world, SIMULATION_CONFIG);
    reachDodgeStep(controller, world);

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
      progress: { current: 0, required: 2 },
    });
    expect(world.state.status).toBe("playing");
    expect(world.enemyProjectiles).toHaveLength(1);
    expect(events.some((event) => event.type === "game.over")).toBe(false);
    expect(added).toContainEqual({
      type: "tutorial.step.retried",
      stepId: "dodgeProjectile",
      retryCount: 1,
    });
  });

  it("does not advance hint time when simulation elapsed is frozen", () => {
    const world = createWorld(SIMULATION_CONFIG);
    const controller = new TutorialController();
    controller.initialize(world, SIMULATION_CONFIG);

    advanceFrame(controller, world);
    expect(controller.getSnapshot().hintLevel).toBe(0);

    advanceFrame(controller, world, [], () => {
      world.state.elapsed = 8.1;
    });
    expect(controller.getSnapshot().hintLevel).toBe(1);

    advanceFrame(controller, world);
    expect(controller.getSnapshot().stepActiveSeconds).toBeCloseTo(8.1);
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
  advanceFrame(controller, world, [], () => {
    world.player.position.x += BASIC_TUTORIAL_MOVE_DISTANCE;
    world.state.elapsed += 0.1;
  });
  advanceFrame(controller, world, [], () => {
    world.player.position = {
      x: BASIC_TUTORIAL_NAVIGATION_ZONE.x,
      y: BASIC_TUTORIAL_NAVIGATION_ZONE.y,
    };
    world.state.elapsed += 0.1;
  });
}

function reachDodgeStep(
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
  world.enemyProjectiles = [];
  advanceFrame(controller, world);
  world.enemyProjectiles = [];
  advanceFrame(controller, world);
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
}

function advanceFrame(
  controller: TutorialController,
  world: WorldState,
  events: GameEvent[] = [],
  mutate: () => void = () => undefined,
): GameEvent[] {
  const frameBefore = {
    elapsed: world.state.elapsed,
    playerPosition: { ...world.player.position },
  };
  mutate();
  return controller.update(world, SIMULATION_CONFIG, events, frameBefore);
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
