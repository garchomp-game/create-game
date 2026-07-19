import { describe, expect, it } from "vitest";
import { SIMULATION_CONFIG } from "../../config/gameConfig";
import { UPGRADE_IDS, type GameEvent } from "../../domain/types";
import { createWorld } from "../createWorld";
import { updateRunStats } from "./statsSystem";

describe("updateRunStats comparison metrics", () => {
  it("deduplicates enemies across projectiles in the same volley", () => {
    const world = createWorld(SIMULATION_CONFIG);
    const events: GameEvent[] = [
      {
        type: "shot.fired",
        volleyId: 1,
        bulletIds: ["bullet-1", "bullet-2", "bullet-3"],
        weaponType: "spread",
        position: { x: 0, y: 0 },
        direction: { x: 1, y: 0 },
        projectileCount: 3,
      },
      createHit("bullet-1", "enemy-a", "chaser"),
      createHit("bullet-2", "enemy-a", "chaser"),
      createHit("bullet-3", "enemy-b", "ranged"),
      {
        type: "enemy.killed",
        bulletId: "bullet-3",
        volleyId: 1,
        enemyId: "enemy-b",
        enemyType: "ranged",
        weaponType: "spread",
        scoreAwarded: 25,
        xpAwarded: 2,
        position: { x: 0, y: 0 },
      },
    ];

    updateRunStats(world, events);

    expect(world.stats.weaponMetrics.spread).toMatchObject({
      shotsFired: 1,
      projectilesFired: 3,
      hits: 3,
      kills: 1,
    });
    expect(world.stats.weaponComparisonMetrics.spread).toEqual({
      hitVolleys: 1,
      uniqueEnemiesHit: 2,
      maxUniqueEnemiesHitPerVolley: 2,
      hitsByEnemyType: { chaser: 2, brute: 0, fast: 0, ranged: 1 },
      killsByEnemyType: { chaser: 0, brute: 0, fast: 0, ranged: 1 },
    });
    expect(world.analytics.activeVolleys).toEqual({});
  });

  it("records offered, available, maxed, and selected upgrades with timing", () => {
    const world = createWorld(SIMULATION_CONFIG);
    world.state.elapsed = 7;
    const availableUpgradeIds = UPGRADE_IDS.filter((id) => id !== "rapidFire");

    updateRunStats(world, [
      {
        type: "upgrade.offered",
        level: 2,
        choices: ["swiftStep", "splitShot", "vitalCore"],
        availableUpgradeIds,
        lockedUpgradeIds: [],
        maxedUpgradeIds: ["rapidFire"],
      },
      {
        type: "upgrade.selected",
        level: 2,
        upgradeId: "splitShot",
        rank: 1,
        effect: { type: "projectileCount", amount: 1 },
      },
    ]);

    expect(world.stats.progressionMetrics).toMatchObject({
      firstOfferAt: 7,
      firstSelectionAt: 7,
      lastSelectionAt: 7,
      longestMeaningfulChoiceGap: 7,
      offers: [
        {
          elapsed: 7,
          choices: ["swiftStep", "splitShot", "vitalCore"],
          availableUpgradeIds,
          lockedUpgradeIds: [],
          maxedUpgradeIds: ["rapidFire"],
        },
      ],
      selections: [{ elapsed: 7, upgradeId: "splitShot", rank: 1 }],
    });
  });

  it("records EX cycle and automatic-selection metadata", () => {
    const world = createWorld(SIMULATION_CONFIG);
    world.state.elapsed = 360;

    updateRunStats(world, [
      {
        type: "extra.upgrade.offered",
        level: 29,
        extraLevel: 4,
        cycle: 1,
        choices: ["limitCore"],
      },
      {
        type: "extra.upgrade.selected",
        level: 29,
        extraLevel: 4,
        cycle: 1,
        automatic: true,
        extraUpgradeId: "limitCore",
        rank: 1,
        effect: { type: "maxHp", amountPerRank: 8 },
      },
    ]);

    expect(world.stats.progressionMetrics.extraOffers).toBe(1);
    expect(world.stats.progressionMetrics.extraSelections).toEqual([
      {
        elapsed: 360,
        level: 29,
        extraLevel: 4,
        cycle: 1,
        automatic: true,
        extraUpgradeId: "limitCore",
        rank: 1,
      },
    ]);
  });

  it("tracks capstone acquisition, ricochets, and unique follow-up hits", () => {
    const world = createWorld(SIMULATION_CONFIG);
    world.state.elapsed = 72;
    const postRicochetHit = createHit("bullet-1", "enemy-a", "chaser");
    postRicochetHit.weaponType = "pulse";
    postRicochetHit.ricochetsUsed = 1;
    postRicochetHit.ricochetSurfaceKind = "obstacle";
    const boundaryHit = createHit("bullet-2", "enemy-b", "ranged");
    boundaryHit.weaponType = "pulse";
    boundaryHit.ricochetsUsed = 1;
    boundaryHit.ricochetSurfaceKind = "arenaBoundary";
    boundaryHit.ricochetBoundarySide = "right";

    updateRunStats(world, [
      {
        type: "upgrade.selected",
        level: 9,
        upgradeId: "pulseRicochet",
        rank: 1,
        effect: { type: "ricochet", amount: 1 },
      },
      {
        type: "shot.fired",
        volleyId: 1,
        bulletIds: ["bullet-1"],
        weaponType: "pulse",
        position: { x: 0, y: 0 },
        direction: { x: 1, y: 0 },
        projectileCount: 1,
      },
      {
        type: "bullet.ricocheted",
        bulletId: "bullet-1",
        volleyId: 1,
        weaponType: "pulse",
        surfaceKind: "obstacle",
        obstacleId: "block-a",
        boundarySide: null,
        position: { x: 220, y: 160 },
        ricochetsUsed: 1,
        ricochetsRemaining: 0,
      },
      {
        type: "bullet.ricocheted",
        bulletId: "bullet-2",
        volleyId: 2,
        weaponType: "pulse",
        surfaceKind: "arenaBoundary",
        obstacleId: null,
        boundarySide: "right",
        position: { x: 956, y: 270 },
        ricochetsUsed: 1,
        ricochetsRemaining: 0,
      },
      postRicochetHit,
      { ...postRicochetHit, hpAfter: 1 },
      boundaryHit,
    ]);

    expect(world.stats.capstoneMetrics).toEqual({
      upgradeId: "pulseRicochet",
      acquiredAt: 72,
      activations: 2,
      followUpHits: 3,
      followUpUniqueEnemiesHit: 2,
      maxFollowUpUniqueEnemiesPerVolley: 2,
      obstacleRicochets: 1,
      boundaryRicochets: 1,
      boundaryRicochetsBySide: { left: 0, right: 1, top: 0, bottom: 0 },
      obstacleFollowUpHits: 2,
      obstacleFollowUpKills: 1,
      boundaryFollowUpHits: 1,
      boundaryFollowUpKills: 1,
      boundaryFollowUpHitsBySide: { left: 0, right: 1, top: 0, bottom: 0 },
      spreadSweepTriggers: 0,
      spreadSweepConsumes: 0,
    });
  });

  it("records boss phases, attacks, escorts, damage, and defeat", () => {
    const world = createWorld(SIMULATION_CONFIG);
    updateRunStats(world, [
      {
        type: "boss.spawned",
        bossId: "first-command-ship",
        enemyId: "boss-1",
        position: { x: 480, y: 92 },
        maximumHp: 3_600,
        repairBudgetInitial: 2_400,
        elapsed: 421,
      },
      {
        type: "boss.attack.telegraphed",
        bossId: "first-command-ship",
        enemyId: "boss-1",
        attackId: "targeted-salvo",
        phase: 1,
        duration: 1.45,
        aimDirection: { x: 0, y: 1 },
        ingressDirection: null,
        elapsed: 421,
      },
      {
        type: "boss.attack.executed",
        bossId: "first-command-ship",
        enemyId: "boss-1",
        attackId: "targeted-salvo",
        phase: 1,
        projectileIds: ["boss-projectile-1"],
        elapsed: 422.45,
      },
      {
        type: "player.damaged",
        damage: 10,
        hpAfter: 90,
        source: {
          kind: "projectile",
          projectileId: "boss-projectile-1",
          bossId: "first-command-ship",
          bossAttackId: "targeted-salvo",
        },
      },
      {
        type: "boss.phase.changed",
        bossId: "first-command-ship",
        enemyId: "boss-1",
        phase: 2,
        elapsed: 450,
      },
      {
        type: "boss.escort.deployed",
        bossId: "first-command-ship",
        attackId: "escort-pincer",
        direction: "east",
        enemyIds: ["escort-1", "escort-2"],
        elapsed: 452,
      },
      {
        type: "player.damaged",
        damage: 7,
        hpAfter: 83,
        source: {
          kind: "contact",
          enemyId: "escort-1",
          enemyType: "fast",
          bossId: "first-command-ship",
          bossAttackId: "escort-pincer",
        },
      },
      {
        type: "pickup.spawned",
        pickupId: "boss-heal-1",
        pickupKind: "heal",
        position: { x: 430, y: 270 },
        xpValue: 0,
        healValue: 20,
        lifetime: 18,
      },
      {
        type: "pickup.collected",
        pickupId: "boss-heal-1",
        pickupKind: "heal",
        xpValue: 0,
        healValue: 20,
        hpRecovered: 12,
      },
      {
        type: "pickup.spawned",
        pickupId: "boss-heal-2",
        pickupKind: "heal",
        position: { x: 460, y: 270 },
        xpValue: 0,
        healValue: 20,
        lifetime: 18,
      },
      {
        type: "pickup.collected",
        pickupId: "boss-heal-2",
        pickupKind: "heal",
        xpValue: 0,
        healValue: 20,
        hpRecovered: 0,
      },
      {
        type: "pickup.spawned",
        pickupId: "boss-heal-3",
        pickupKind: "heal",
        position: { x: 490, y: 270 },
        xpValue: 0,
        healValue: 20,
        lifetime: 18,
      },
      {
        type: "pickup.expired",
        pickupId: "boss-heal-3",
        pickupKind: "heal",
      },
      {
        type: "boss.heal-drop.suppressed",
        bossId: "first-command-ship",
        count: 2,
        reason: "cooldown",
        elapsed: 453,
      },
      {
        type: "boss.heal-drop.suppressed",
        bossId: "first-command-ship",
        count: 3,
        reason: "repair-budget-exhausted",
        elapsed: 454,
      },
      {
        type: "boss.defeated",
        bossId: "first-command-ship",
        enemyId: "boss-1",
        weaponType: "pulse",
        position: { x: 480, y: 92 },
        elapsed: 480,
      },
    ]);

    expect(world.stats.encounterMetrics.boss).toEqual({
      bossId: "first-command-ship",
      spawnedAt: 421,
      defeatedAt: 480,
      remainingHp: 0,
      maximumHp: 3_600,
      phaseReached: 2,
      phaseChanges: 1,
      lastAttackId: "targeted-salvo",
      attacksTelegraphed: {
        "targeted-salvo": 1,
        "escort-pincer": 0,
        "command-pulse": 0,
      },
      attacksExecuted: {
        "targeted-salvo": 1,
        "escort-pincer": 0,
        "command-pulse": 0,
      },
      playerHitsByAttack: {
        "targeted-salvo": 1,
        "escort-pincer": 1,
        "command-pulse": 0,
      },
      damageTakenByAttack: {
        "targeted-salvo": 10,
        "escort-pincer": 7,
        "command-pulse": 0,
      },
      escortsSpawned: 2,
      killsDuringBoss: 0,
      damageTakenDuringBoss: 17,
      healPickupsSpawned: 3,
      healValueSuppliedDuringBoss: 60,
      healDropsSuppressed: 5,
      healDropsSuppressedByReason: {
        cooldown: 2,
        "repair-budget-exhausted": 3,
      },
      healPickupsCollected: 2,
      healPickupsCollectedAtFullHp: 1,
      healPickupsExpired: 1,
      hpRecoveredDuringBoss: 12,
      repairBudgetInitial: 2_400,
      repairBudgetSpent: 60,
      repairBudgetRemaining: 2_340,
      commandPulseResults: { hit: 0, blocked: 0, outside: 0, invulnerable: 0 },
      defeatedByWeapon: "pulse",
    });
  });
});

function createHit(
  bulletId: string,
  enemyId: string,
  enemyType: "chaser" | "ranged",
): Extract<GameEvent, { type: "enemy.hit" }> {
  return {
    type: "enemy.hit",
    bulletId,
    volleyId: 1,
    enemyId,
    enemyType,
    weaponType: "spread",
    ricochetsUsed: 0,
    ricochetSurfaceKind: null,
    ricochetBoundarySide: null,
    damage: 1,
    hpAfter: 0,
  };
}
