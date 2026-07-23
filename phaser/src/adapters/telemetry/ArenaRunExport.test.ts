import { describe, expect, it } from "vitest";
import { SIMULATION_CONFIG } from "../../config/gameConfig";
import type { WorldState } from "../../domain/types";
import { createWorld } from "../../simulation/createWorld";
import {
  createRandomStreams,
  RANDOM_STREAM_VERSION_V2,
} from "../../math/random";
import { getWaveBand } from "../../simulation/waveDirector";
import { createArenaRunExport } from "./ArenaRunExport";

describe("createArenaRunExport", () => {
  it("builds a detached development export from the current world", () => {
    const world = createWorld(SIMULATION_CONFIG);
    world.state.elapsed = 12;
    world.stats.damageTakenBySource.contact = 4;
    world.progression.upgradeRanks.rapidFire = 2;
    const runExport = createArenaRunExport(createTestInput(world));

    expect(runExport).toMatchObject({
      game: "arena-core-phaser",
      buildCommit: "abc123",
      profileId: "profile-test",
      runOrigin: "manual",
      seed: 42,
      randomStreams: { version: "arena-rng-v1", rootSeed: 42 },
      status: "playing",
      performance: {
        frameSamples: 720,
        p95RawDtMs: 17,
        actualFps: 60.1,
      },
      renderPerformance: {
        staticBackground: { drawCount: 1 },
        renderedFrames: 720,
      },
      elapsed: 12,
      difficultyElapsed: 12,
      lastEvents: [{ type: "game.started" }],
    });
    expect(runExport.stats.damageTakenBySource.contact).toBe(4);
    expect(runExport.upgradeRanks.rapidFire).toBe(2);
    expect(runExport.buildComposition).toMatchObject({
      weaponType: "pulse",
      modifiers: { fireIntervalMultiplier: 0.85 ** 2 },
      contributions: [{ source: "upgrade", upgradeId: "rapidFire", rank: 2 }],
    });

    world.stats.damageTakenBySource.contact = 9;
    world.progression.upgradeRanks.rapidFire = 5;
    expect(runExport.stats.damageTakenBySource.contact).toBe(4);
    expect(runExport.upgradeRanks.rapidFire).toBe(2);
    expect(runExport.buildComposition.contributions[0]?.rank).toBe(2);
  });

  it("exports Expedition run time and difficulty time independently", () => {
    const world = createWorld(SIMULATION_CONFIG);
    world.state.elapsed = 540;
    world.expedition = {
      director: {
        runElapsed: 540,
        actElapsed: 394,
        actClockBlocked: true,
      },
    } as WorldState["expedition"];

    const runExport = createArenaRunExport(createTestInput(world));

    expect(runExport).toMatchObject({
      elapsed: 540,
      difficultyElapsed: 394,
      wave: getWaveBand(SIMULATION_CONFIG, 394),
    });
    expect(runExport.wave).not.toEqual(getWaveBand(SIMULATION_CONFIG, 540));
  });

  it("exports candidate provenance, flags, catalog, and aggregate telemetry", () => {
    const runConfig = {
      ...SIMULATION_CONFIG,
      features: {
        ...SIMULATION_CONFIG.features,
        exProtocols: true,
      },
    };
    const world = createWorld(runConfig);
    world.stats.exProtocolMetrics.protocolSourceDamage = 12;
    const base = createTestInput(world);
    const runExport = createArenaRunExport({
      ...base,
      context: {
        id: "candidate-run",
        profileId: "profile-test",
        startedAt: "2026-07-23T00:00:00.000Z",
        modeId: "endless",
        stageId: "arena-default",
        difficultyId: "standard",
        rulesetVersion: "phaser-v0.8-ex-protocols-c1",
        seedCategory: "fixed",
        weaponId: "pulse",
        modifierIds: [],
        appVersion: "0.8.0-candidate.1",
        buildCommit: "abc123",
        seed: 42,
        runOrigin: "test",
        rankEligibility: {
          eligible: false,
          reasons: ["automatedTest", "nonStandardRuleset"],
        },
        rulesetProfileId: "candidate-ex-endless-c1",
        rngVersion: RANDOM_STREAM_VERSION_V2,
        runRecordSchemaVersion: 3,
        exProtocolsEnabled: true,
      },
      randomStreams: createRandomStreams(
        42,
        RANDOM_STREAM_VERSION_V2,
      ),
      runConfig,
    });

    expect(runExport).toMatchObject({
      exportSchemaVersion: 2,
      rulesetProfileId: "candidate-ex-endless-c1",
      rngVersion: "arena-rng-v2",
      runRecordSchemaVersion: 3,
      featureFlags: { exProtocols: true },
      exProtocolCatalogVersion: "ex-protocols-v1",
      exProtocol: { protocolSourceDamage: 12 },
    });
  });
});

function createTestInput(world: WorldState) {
  return {
    capturedAt: "2026-07-11T00:00:00.000Z",
    buildCommit: "abc123",
    context: null,
    profileId: "profile-test",
    baseRunOrigin: "manual" as const,
    fixedSeed: null,
    runSeed: 42,
    randomStreams: createRandomStreams(42),
    runConfig: SIMULATION_CONFIG,
    world,
    performance: {
      frameSamples: 720,
      averageRawDtMs: 16.67,
      p95RawDtMs: 17,
      maxRawDtMs: 22,
      framesOver50Ms: 0,
      estimatedFps: 59.99,
      actualFps: 60.1,
    },
    renderPerformance: {
      staticBackground: { drawCount: 1, drawDurationMs: 0.4 },
      renderedFrames: 720,
      dynamicWorld: { averageMs: 0.35, maxMs: 1.2 },
      screenHud: { averageMs: 0.12, maxMs: 0.6 },
      feedback: { averageMs: 0.04, maxMs: 0.2 },
    },
    lastEvents: [{ type: "game.started" as const }],
  };
}
