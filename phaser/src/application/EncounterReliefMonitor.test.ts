import { describe, expect, it } from "vitest";
import { SIMULATION_CONFIG } from "../config/gameConfig";
import type { GameEvent, WorldState } from "../domain/types";
import { createWorld } from "../simulation/createWorld";
import { EncounterReliefMonitor } from "./EncounterReliefMonitor";

describe("EncounterReliefMonitor", () => {
  it("records a complete five-second recovery window and the later warning board", () => {
    const { world, monitor } = fixture();
    addBoardObjects(world);
    world.state.hp = 80;
    observe(world, monitor, 100, [recovery("swarmRush", 100)]);

    world.enemies.pop();
    world.enemyProjectiles.pop();
    world.pickups = [xpPickup("xp-2", 2)];
    world.state.hp = 86;
    observe(world, monitor, 102, [
      damage(4),
      xpCollected("xp-1", 3),
      repairCollected("repair-1", 10),
      enemyKilled("enemy-2"),
    ]);
    observe(world, monitor, 105, []);

    world.enemies.push(enemy("enemy-3"));
    world.enemyProjectiles.push(projectile("projectile-2"));
    observe(world, monitor, 130, [warning("rangedSurge", 130)]);

    const report = monitor.getReport(130);
    expect(report).toMatchObject({
      state: "available",
      summary: {
        episodeCount: 1,
        completeWindowCount: 1,
        partialWindowCount: 0,
        nextWarningObservedCount: 1,
        completeWindowTotals: {
          xpCollected: 3,
          damageTaken: 4,
          hpRecovered: 10,
          repairPickupsCollected: 1,
          regularEnemiesKilled: 1,
        },
        completeWindowRepairOffsetRate: 2.5,
      },
      episodes: [
        {
          episodeId: "swarmRush:1",
          windowState: "complete",
          windowStartedAt: 100,
          targetEndsAt: 105,
          observedUntil: 105,
          startBoard: {
            playerHp: 80,
            enemyCount: 2,
            enemyProjectileCount: 1,
            groundXpCount: 2,
            groundXpValue: 5,
            groundRepairCount: 1,
            groundRepairValue: 12,
          },
          endBoard: {
            playerHp: 86,
            enemyCount: 1,
            enemyProjectileCount: 0,
            groundXpCount: 1,
            groundXpValue: 2,
            groundRepairCount: 0,
          },
          boardDelta: {
            playerHp: 6,
            enemyCount: -1,
            enemyProjectileCount: -1,
            groundXpCount: -1,
            groundXpValue: -3,
            groundRepairCount: -1,
            groundRepairValue: -12,
          },
          repairOffsetRate: 2.5,
          nextWarning: {
            encounterId: "rangedSurge",
            elapsed: 130,
            secondsAfterRecoveryStarted: 30,
            board: { enemyCount: 2, enemyProjectileCount: 1 },
          },
        },
      ],
    });
  });

  it("keeps same-type occurrences unique and attaches a warning inside the window", () => {
    const { world, monitor } = fixture();
    observe(world, monitor, 10, [recovery("bruteSiege", 10)]);
    observe(world, monitor, 12, [warning("swarmRush", 12)]);
    observe(world, monitor, 15, []);
    observe(world, monitor, 30, [recovery("bruteSiege", 30)]);

    const report = monitor.getReport(32);
    expect(report).toMatchObject({
      state: "available",
      summary: { completeWindowCount: 1, partialWindowCount: 1 },
      episodes: [
        {
          episodeId: "bruteSiege:1",
          windowState: "complete",
          nextWarning: { encounterId: "swarmRush", elapsed: 12 },
        },
        {
          episodeId: "bruteSiege:2",
          windowState: "partial",
          nextWarning: null,
        },
      ],
    });
  });

  it("returns detached partial reports and clears all state between runs", () => {
    const { world, monitor } = fixture();
    expect(monitor.getReport(0)).toEqual({
      schemaVersion: 1,
      windowSeconds: 5,
      state: "not-reached",
      reason: "recoveryNotObserved",
    });

    observe(world, monitor, 20, [recovery("rangedSurge", 20)]);
    observe(world, monitor, 22, [repairCollected("repair", 0)]);
    const first = monitor.getReport(22);
    if (first.state === "available") first.episodes[0]!.metrics.damageTaken = 999;
    expect(monitor.getReport(22)).toMatchObject({
      state: "available",
      episodes: [
        {
          windowState: "partial",
          observedUntil: 22,
          metrics: {
            damageTaken: 0,
            repairPickupsCollected: 1,
            repairPickupsCollectedAtFullHp: 1,
          },
        },
      ],
    });

    monitor.reset(world);
    expect(monitor.getReport(22).state).toBe("not-reached");
  });

  it("does not mutate the observed world or source events", () => {
    const { world, monitor } = fixture();
    addBoardObjects(world);
    world.state.elapsed = 50;
    const events: GameEvent[] = [
      recovery("swarmRush", 50),
      damage(3),
      xpCollected("xp-1", 2),
    ];
    const worldBefore = structuredClone(world);
    const eventsBefore = structuredClone(events);

    monitor.observe(world, events);

    expect(world).toEqual(worldBefore);
    expect(events).toEqual(eventsBefore);
  });
});

function fixture() {
  const world = createWorld(SIMULATION_CONFIG);
  const monitor = new EncounterReliefMonitor();
  monitor.reset(world);
  return { world, monitor };
}

function observe(
  world: WorldState,
  monitor: EncounterReliefMonitor,
  elapsed: number,
  events: GameEvent[],
): void {
  world.state.elapsed = elapsed;
  monitor.observe(world, events);
}

function addBoardObjects(world: WorldState): void {
  world.enemies.push(enemy("enemy-1"), enemy("enemy-2"));
  world.enemyProjectiles.push(projectile("projectile-1"));
  world.pickups.push(
    xpPickup("xp-1", 3),
    xpPickup("xp-2", 2),
    {
      id: "repair-1",
      kind: "heal",
      position: { x: 150, y: 150 },
      radius: 8,
      xpValue: 0,
      healValue: 12,
      lifetime: 10,
    },
  );
}

function enemy(id: string): WorldState["enemies"][number] {
  return {
    id,
    typeId: "chaser",
    position: { x: 100, y: 100 },
    radius: 10,
    hp: 1,
    damage: 1,
    speed: 1,
    score: 1,
    xpValue: 1,
    behavior: "chase",
    attackTimer: 0,
    enteredArena: true,
  };
}

function projectile(id: string): WorldState["enemyProjectiles"][number] {
  return {
    id,
    position: { x: 120, y: 120 },
    radius: 4,
    velocity: { x: 0, y: 1 },
    lifetime: 2,
    damage: 1,
  };
}

function xpPickup(id: string, xpValue: number): WorldState["pickups"][number] {
  return {
    id,
    kind: "xp",
    position: { x: 140, y: 140 },
    radius: 6,
    xpValue,
    healValue: 0,
    lifetime: null,
  };
}

function recovery(encounterId: "rangedSurge" | "swarmRush" | "bruteSiege", elapsed: number): GameEvent {
  return { type: "encounter.recovery.started", encounterId, elapsed };
}

function warning(encounterId: "rangedSurge" | "swarmRush" | "bruteSiege", elapsed: number): GameEvent {
  return { type: "encounter.warning.started", encounterId, elapsed };
}

function damage(amount: number): GameEvent {
  return { type: "player.damaged", damage: amount, hpAfter: 76 };
}

function xpCollected(pickupId: string, xpValue: number): GameEvent {
  return {
    type: "pickup.collected",
    pickupId,
    pickupKind: "xp",
    xpValue,
    healValue: 0,
    hpRecovered: 0,
  };
}

function repairCollected(pickupId: string, hpRecovered: number): GameEvent {
  return {
    type: "pickup.collected",
    pickupId,
    pickupKind: "heal",
    xpValue: 0,
    healValue: 12,
    hpRecovered,
  };
}

function enemyKilled(enemyId: string): GameEvent {
  return {
    type: "enemy.killed",
    bulletId: "bullet-1",
    volleyId: 1,
    enemyId,
    enemyType: "chaser",
    weaponType: "pulse",
    scoreAwarded: 10,
    xpAwarded: 1,
    position: { x: 100, y: 100 },
  };
}
