import { describe, expect, it } from "vitest";
import {
  createRunSummaryRow,
  RUN_SUMMARY_COLUMNS,
  serializeRunSummary,
} from "./RunSummary";

describe("run summary", () => {
  it("flattens a run export into spreadsheet metrics", () => {
    const row = createRunSummaryRow({
      capturedAt: "2026-07-11T12:30:43.021Z",
      appVersion: "0.6",
      rulesetVersion: "ruleset-v1",
      buildCommit: "abc123",
      runId: "run-1",
      runOrigin: "manual",
      modeId: "endless",
      stageId: "arena",
      difficultyId: "standard",
      seed: 42,
      seedCategory: "random",
      status: "gameOver",
      buildCompletedAt: 120.1256,
      rankEligibility: { eligible: false, reasons: ["debug", "modifier"] },
      buildComposition: { weaponType: "pulse" },
      encounter: { contract: { choice: "overdrive" } },
      upgradeRanks: {
        rapidFire: 5,
        swiftStep: 4,
        vitalCore: 3,
        overdriveRounds: 2,
        splitShot: 1,
        piercingRounds: 2,
        pulseRicochet: 1,
      },
      extraUpgradeRanks: {
        limitPower: 4,
        limitCycle: 3,
        limitDrive: 2,
        limitCore: 1,
      },
      stats: {
        encounterMetrics: {
          eventsCompleted: 6,
          eventCounts: { rangedSurge: 2, swarmRush: 3, bruteSiege: 1 },
        },
      },
      resultSummary: {
        elapsed: 90,
        score: 6000,
        level: 12,
        extraLevel: 4,
        threatTier: 7,
        collapseStage: 2,
        enemiesKilled: 300,
        shotsFired: 1000,
        hitsTaken: 20,
        damageTaken: 120,
        damageTakenBySource: { contact: 80, projectile: 40, collapse: 18 },
        hpRecovered: 100,
        healPickupsCollected: 10,
        effectiveHealPickupsCollected: 8,
        upgradesChosen: 11,
        extraUpgradesChosen: 4,
        lastDamageSource: { kind: "contact", enemyType: "brute" },
        capstoneMetrics: { acquiredAt: 64.1235, activations: 50, followUpHits: 12 },
        weaponMetrics: {
          pulse: { shotsFired: 1000, projectilesFired: 2000, hits: 500 },
          spread: { shotsFired: 0, projectilesFired: 0, hits: 0 },
        },
      },
    });

    expect(row).toMatchObject({
      weapon: "pulse",
      contract: "overdrive",
      elapsed_seconds: 90,
      score_per_minute: 4000,
      kills_per_minute: 200,
      projectiles_fired: 2000,
      projectile_hits: 500,
      projectile_hit_rate: 0.25,
      rank_eligible: false,
      rank_ineligible_reasons: "debug|modifier",
      build_completed_seconds: 120.126,
      extra_level: 4,
      threat_tier: 7,
      collapse_stage: 2,
      collapse_damage: 18,
      extra_upgrades_chosen: 4,
      limit_power_rank: 4,
      encounters_completed: 6,
      swarm_rushes: 3,
      capstone_acquired_seconds: 64.124,
      last_damage_enemy_type: "brute",
    });
  });

  it("serializes CSV safely and TSV for direct spreadsheet paste", () => {
    const row = createRunSummaryRow({
      capturedAt: "line\tone\nline two",
      configVersion: "ruleset,legacy",
      elapsed: 60,
      resultSummary: {
        elapsed: 60,
        score: 10,
        enemiesKilled: 1,
        weaponMetrics: { pulse: { shotsFired: 1, projectilesFired: 2, hits: 1 } },
      },
    });
    expect(row).not.toBeNull();

    const csv = serializeRunSummary([row!], "csv");
    const tsv = serializeRunSummary([row!], "tsv");

    expect(csv).toContain('"ruleset,legacy"');
    expect(csv).toContain('"line\tone\nline two"');
    expect(tsv.split("\n")[0]!.split("\t")).toHaveLength(RUN_SUMMARY_COLUMNS.length);
    expect(tsv.split("\n")[1]!.split("\t")).toHaveLength(RUN_SUMMARY_COLUMNS.length);
    expect(tsv).toContain("line one line two");
  });

  it("rejects values without finite result metrics", () => {
    expect(createRunSummaryRow(null)).toBeNull();
    expect(createRunSummaryRow({ resultSummary: { elapsed: 10 } })).toBeNull();
    expect(createRunSummaryRow({ resultSummary: { elapsed: Number.NaN, score: 10 } })).toBeNull();
  });
});
