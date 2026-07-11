import { describe, expect, it } from "vitest";
import { SIMULATION_CONFIG as GAME_CONFIG } from "../config/gameConfig";
import { createWorld } from "./createWorld";
import { createRunResultSummary } from "./resultSummary";

describe("createRunResultSummary", () => {
  it("derives result fields from world state and run stats", () => {
    const world = createWorld(GAME_CONFIG);
    world.state.elapsed = 92.5;
    world.state.score = 120;
    world.state.hp = 34;
    world.progression.level = 4;
    world.progression.xp = 2;
    world.stats.shotsFired = 18;
    world.stats.enemiesKilled = 12;
    world.stats.hitsTaken = 3;
    world.stats.damageTaken = 36;
    world.stats.damageTakenBySource = { contact: 24, projectile: 12 };
    world.stats.lastDamageSource = {
      kind: "projectile",
      projectileId: "enemy-projectile-test",
    };
    world.stats.weaponMetrics.pulse.shotsFired = 6;
    world.stats.weaponMetrics.pulse.projectilesFired = 6;
    world.stats.weaponMetrics.pulse.hits = 4;
    world.stats.weaponMetrics.pulse.kills = 2;

    expect(createRunResultSummary(world)).toEqual({
      elapsed: 92.5,
      score: 120,
      hp: 34,
      level: 4,
      xp: 2,
      shotsFired: 18,
      enemiesKilled: 12,
      hitsTaken: 3,
      damageTaken: 36,
      damageTakenBySource: { contact: 24, projectile: 12 },
      lastDamageSource: {
        kind: "projectile",
        projectileId: "enemy-projectile-test",
      },
      xpCollected: 0,
      pickupsCollected: 0,
      hpRecovered: 0,
      healPickupsCollected: 0,
      effectiveHealPickupsCollected: 0,
      upgradesChosen: 0,
      capstoneMetrics: {
        upgradeId: "pulseRicochet",
        acquiredAt: null,
        activations: 0,
        followUpHits: 0,
        followUpUniqueEnemiesHit: 0,
        maxFollowUpUniqueEnemiesPerVolley: 0,
      },
      weaponMetrics: {
        pulse: { shotsFired: 6, projectilesFired: 6, hits: 4, kills: 2 },
        spread: { shotsFired: 0, projectilesFired: 0, hits: 0, kills: 0 },
        pierce: { shotsFired: 0, projectilesFired: 0, hits: 0, kills: 0 },
      },
    });
  });
});
