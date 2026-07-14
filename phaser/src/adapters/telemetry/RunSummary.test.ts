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
      performance: {
        frameSamples: 5_400,
        actualFps: 60.1234,
        estimatedFps: 59.9876,
        averageRawDtMs: 16.6701,
        p95RawDtMs: 18,
        maxRawDtMs: 54.3219,
        framesOver50Ms: 2,
      },
      buildCompletedAt: 120.1256,
      extraCycle: 2,
      rankEligibility: { eligible: false, reasons: ["debug", "modifier"] },
      buildComposition: { weaponType: "pulse" },
      encounter: { contract: { choice: "overdrive" } },
      upgradeRanks: {
        rapidFire: 5,
        swiftStep: 4,
        vitalCore: 3,
        overdriveRounds: 2,
        splitShot: 1,
        pulseFocus: 2,
        piercingRounds: 2,
        pulseRicochet: 1,
        spreadSweep: 0,
      },
      extraUpgradeRanks: {
        limitPower: 4,
        limitCycle: 3,
        limitDrive: 2,
        limitCore: 1,
      },
      stats: {
        navigationMetrics: {
          directFrames: 800,
          pathFrames: 180,
          fallbackFrames: 20,
          fieldBuilds: 12,
        },
        progressionMetrics: {
          extraSelections: [{ automatic: false }, { automatic: true }],
        },
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
        extraCycle: 2,
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
        capstoneMetrics: {
          acquiredAt: 64.1235,
          activations: 50,
          followUpHits: 12,
          obstacleRicochets: 20,
          boundaryRicochets: 30,
          boundaryRicochetsBySide: { left: 7, right: 8, top: 6, bottom: 9 },
          obstacleFollowUpHits: 4,
          obstacleFollowUpKills: 2,
          boundaryFollowUpHits: 8,
          boundaryFollowUpKills: 3,
          boundaryFollowUpHitsBySide: { left: 1, right: 3, top: 2, bottom: 2 },
        },
        weaponIdentityMetrics: {
          pulseFocus: { enhancedHits: 80, bonusDamage: 34.5678, maxStacks: 4 },
          spreadSweep: { triggers: 0, consumes: 0, maxDistinctTargets: 0 },
        },
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
      projectile_hits_per_kill: 1.667,
      rank_eligible: false,
      rank_ineligible_reasons: "debug|modifier",
      build_completed_seconds: 120.126,
      extra_level: 4,
      extra_cycle: 2,
      threat_tier: 7,
      collapse_stage: 2,
      performance_frame_samples: 5_400,
      performance_actual_fps: 60.123,
      performance_estimated_fps: 59.988,
      performance_average_raw_dt_ms: 16.67,
      performance_p95_raw_dt_ms: 18,
      performance_max_raw_dt_ms: 54.322,
      performance_frames_over_50_ms: 2,
      collapse_damage: 18,
      extra_upgrades_chosen: 4,
      extra_automatic_upgrades: 1,
      limit_power_rank: 4,
      encounters_completed: 6,
      swarm_rushes: 3,
      navigation_direct_frames: 800,
      navigation_path_frames: 180,
      navigation_fallback_frames: 20,
      navigation_field_builds: 12,
      navigation_path_ratio: 0.18,
      capstone_acquired_seconds: 64.124,
      capstone_obstacle_ricochets: 20,
      capstone_boundary_ricochets: 30,
      capstone_boundary_left: 7,
      capstone_boundary_right: 8,
      capstone_boundary_top: 6,
      capstone_boundary_bottom: 9,
      capstone_obstacle_follow_up_hits: 4,
      capstone_obstacle_follow_up_kills: 2,
      capstone_boundary_follow_up_hits: 8,
      capstone_boundary_follow_up_kills: 3,
      capstone_boundary_follow_up_left: 1,
      capstone_boundary_follow_up_right: 3,
      capstone_boundary_follow_up_top: 2,
      capstone_boundary_follow_up_bottom: 2,
      pulse_focus_rank: 2,
      pulse_focus_enhanced_hits: 80,
      pulse_focus_bonus_damage: 34.568,
      pulse_focus_max_stacks: 4,
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
