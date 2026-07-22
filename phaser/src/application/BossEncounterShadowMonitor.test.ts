import { describe, expect, it } from "vitest";
import { SIMULATION_CONFIG } from "../config/gameConfig";
import type { GameEvent, WorldState } from "../domain/types";
import { createWorld } from "../simulation/createWorld";
import { BossEncounterShadowMonitor } from "./BossEncounterShadowMonitor";

describe("BossEncounterShadowMonitor", () => {
  it("separates first and repeat exposure and attributes damage to attack episodes", () => {
    const { world, monitor } = bossFixture();
    observe(world, monitor, 100, [bossSpawned(), telegraph("targeted-salvo", 100)]);
    observe(world, monitor, 101.2, [execute("targeted-salvo", 101.2, ["salvo-1"])]);
    observe(world, monitor, 101.5, [
      recovery("targeted-salvo", 101.45, 102.25),
      bossHit(12),
      playerDamage(8, {
        kind: "projectile",
        projectileId: "salvo-1",
        bossId: "final-command-ship",
        bossAttackId: "targeted-salvo",
      }),
    ]);
    observe(world, monitor, 102.3, [telegraph("escort-pincer", 102.3)]);
    observe(world, monitor, 103.3, [execute("escort-pincer", 103.3, [])]);
    observe(world, monitor, 103.4, [{
      type: "boss.escort.deployed",
      bossId: "final-command-ship",
      attackId: "escort-pincer",
      direction: "north",
      enemyIds: ["escort-1"],
      elapsed: 103.4,
    }]);
    observe(world, monitor, 104.5, [telegraph("command-pulse", 104.5)]);
    observe(world, monitor, 105.55, [
      execute("command-pulse", 105.55, []),
      {
        type: "boss.command-pulse.resolved",
        bossId: "final-command-ship",
        enemyId: "boss-1",
        phase: 1,
        radius: 175,
        damage: 22,
        result: "blocked",
        elapsed: 105.55,
      },
    ]);
    observe(world, monitor, 106.8, [telegraph("targeted-salvo", 106.8)]);
    observe(world, monitor, 108, [execute("targeted-salvo", 108, ["salvo-2"])]);
    observe(world, monitor, 109, [telegraph("escort-pincer", 109)]);

    const report = monitor.getReport(109);
    expect(report.state).toBe("available");
    if (report.state !== "available") return;
    expect(report.attacks["targeted-salvo"]).toMatchObject({
      telegraphed: 2,
      responseEligible: 2,
      responsesHandled: 1,
      warningResponseRate: 0.5,
      firstExposure: { eligible: 1, handled: 0, playerHits: 1, playerDamage: 8 },
      repeatExposure: { eligible: 1, handled: 1, playerHits: 0, playerDamage: 0 },
      punishEligible: 1,
      punishConverted: 1,
      bossDamageDuringRecovery: 12,
    });
    expect(report.attacks["escort-pincer"].warningResponseRate).toBe(1);
    expect(report.attacks["command-pulse"].warningResponseRate).toBe(1);
    expect(report.episodes[0]).toMatchObject({
      episodeId: "final-command-ship:targeted-salvo:1",
      warningResponse: "hit",
      punishWindowCompleted: true,
      punishConverted: true,
    });
  });

  it("records ten-second damage and heal bins plus central orbit share", () => {
    const { world, monitor } = bossFixture();
    observe(world, monitor, 100, [bossSpawned()]);
    observe(world, monitor, 105, []);
    world.player.position = { x: 800, y: 500 };
    observe(world, monitor, 105.5, [
      playerDamage(40, { kind: "contact", enemyId: "enemy-2", enemyType: "chaser" }),
      healCollected("heal-1", 20),
      regularKill("enemy-2"),
    ]);
    observe(world, monitor, 112, [
      playerDamage(10, { kind: "projectile", projectileId: "enemy-shot" }),
      healCollected("heal-2", 0),
      regularKill("enemy-3"),
    ]);

    const report = monitor.getReport(112);
    expect(report).toMatchObject({
      state: "available",
      playerDamage: 50,
      hpRecovered: 20,
      repairOffsetRate: 0.4,
      healPickupsCollected: 2,
      healPickupsCollectedAtFullHp: 1,
      regularEnemiesKilled: 2,
      centralOrbit: {
        radius: 220,
        sampledSeconds: 12,
        secondsWithinRadius: 5,
      },
      tenSecondBins: [
        {
          index: 0,
          playerDamage: 40,
          hpRecovered: 20,
          repairOffsetRate: 0.5,
          healPickupsCollected: 1,
          regularEnemiesKilled: 1,
        },
        {
          index: 1,
          playerDamage: 10,
          hpRecovered: 0,
          repairOffsetRate: 0,
          healPickupsCollectedAtFullHp: 1,
          regularEnemiesKilled: 1,
        },
      ],
    });
    if (report.state === "available") {
      expect(report.centralOrbit.share).toBeCloseTo(5 / 12);
    }
  });

  it("excludes invulnerable command pulses and incomplete telegraphs", () => {
    const { world, monitor } = bossFixture();
    observe(world, monitor, 100, [bossSpawned(), telegraph("command-pulse", 100)]);
    observe(world, monitor, 101, [
      execute("command-pulse", 101, []),
      {
        type: "boss.command-pulse.resolved",
        bossId: "final-command-ship",
        enemyId: "boss-1",
        phase: 1,
        radius: 175,
        damage: 22,
        result: "invulnerable",
        elapsed: 101,
      },
    ]);
    observe(world, monitor, 102, [telegraph("targeted-salvo", 102)]);

    const report = monitor.getReport(102);
    expect(report).toMatchObject({
      state: "available",
      attacks: {
        "command-pulse": { telegraphed: 1, responseEligible: 0 },
        "targeted-salvo": { telegraphed: 1, responseEligible: 0 },
      },
    });
  });

  it("returns detached reports and clears all state between runs", () => {
    const { world, monitor } = bossFixture();
    expect(monitor.getReport(0)).toEqual({
      schemaVersion: 1,
      state: "not-reached",
      reason: "bossNotSpawned",
    });
    observe(world, monitor, 100, [bossSpawned(), telegraph("targeted-salvo", 100)]);
    const first = monitor.getReport(100);
    if (first.state === "available") first.episodes[0]!.playerDamage = 999;
    const second = monitor.getReport(100);
    expect(second).toMatchObject({
      state: "available",
      episodes: [{ playerDamage: 0 }],
    });

    monitor.reset(world);
    expect(monitor.getReport(100).state).toBe("not-reached");
  });
});

function bossFixture() {
  const world = createWorld(SIMULATION_CONFIG);
  const monitor = new BossEncounterShadowMonitor();
  monitor.reset(world);
  world.enemies.push({
    id: "boss-1",
    typeId: "brute",
    position: { x: 480, y: 92 },
    radius: 44,
    hp: 3_400,
    damage: 28,
    speed: 72,
    score: 2_500,
    xpValue: 160,
    behavior: "chase",
    attackTimer: Number.POSITIVE_INFINITY,
    enteredArena: true,
    boss: { bossId: "final-command-ship" },
  });
  world.player.position = { x: 480, y: 270 };
  return { world, monitor };
}

function observe(
  world: WorldState,
  monitor: BossEncounterShadowMonitor,
  elapsed: number,
  events: GameEvent[],
): void {
  world.state.elapsed = elapsed;
  monitor.observe(world, events);
}

function bossSpawned(): GameEvent {
  return {
    type: "boss.spawned",
    bossId: "final-command-ship",
    enemyId: "boss-1",
    position: { x: 480, y: 92 },
    maximumHp: 3_400,
    repairBudgetInitial: null,
    elapsed: 100,
  };
}

function telegraph(attackId: "targeted-salvo" | "escort-pincer" | "command-pulse", elapsed: number): GameEvent {
  return {
    type: "boss.attack.telegraphed",
    bossId: "final-command-ship",
    enemyId: "boss-1",
    attackId,
    phase: 1,
    duration: 1,
    aimDirection: { x: 0, y: 1 },
    ingressDirection: attackId === "escort-pincer" ? "north" : null,
    elapsed,
  };
}

function execute(
  attackId: "targeted-salvo" | "escort-pincer" | "command-pulse",
  elapsed: number,
  projectileIds: string[],
): GameEvent {
  return {
    type: "boss.attack.executed",
    bossId: "final-command-ship",
    enemyId: "boss-1",
    attackId,
    phase: 1,
    projectileIds,
    elapsed,
  };
}

function recovery(
  attackId: "targeted-salvo" | "escort-pincer" | "command-pulse",
  elapsed: number,
  recoveryEndsAt: number,
): GameEvent {
  return {
    type: "boss.attack.recovery.started",
    bossId: "final-command-ship",
    enemyId: "boss-1",
    attackId,
    phase: 1,
    recoveryEndsAt,
    elapsed,
  };
}

function playerDamage(
  damage: number,
  source: Extract<GameEvent, { type: "player.damaged" }>["source"],
): GameEvent {
  return { type: "player.damaged", damage, hpAfter: 50, source };
}

function bossHit(damage: number): GameEvent {
  return {
    type: "enemy.hit",
    bulletId: "bullet-1",
    volleyId: 1,
    enemyId: "boss-1",
    enemyType: "brute",
    weaponType: "pulse",
    ricochetsUsed: 0,
    ricochetSurfaceKind: null,
    ricochetBoundarySide: null,
    damage,
    hpAfter: 3_400 - damage,
  };
}

function healCollected(pickupId: string, hpRecovered: number): GameEvent {
  return {
    type: "pickup.collected",
    pickupId,
    pickupKind: "heal",
    xpValue: 0,
    healValue: 20,
    hpRecovered,
  };
}

function regularKill(enemyId: string): GameEvent {
  return {
    type: "enemy.killed",
    bulletId: "bullet-kill",
    volleyId: 1,
    enemyId,
    enemyType: "chaser",
    weaponType: "pulse",
    scoreAwarded: 10,
    xpAwarded: 1,
    position: { x: 100, y: 100 },
  };
}
