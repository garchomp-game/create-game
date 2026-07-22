import { describe, expect, it } from "vitest";
import { SIMULATION_CONFIG } from "../../config/gameConfig";
import type { WorldState } from "../../domain/types";
import { createWorld } from "../../simulation/createWorld";
import { createRandomStreams } from "../../math/random";
import { getWaveBand } from "../../simulation/waveDirector";
import { createArenaRunExport } from "./ArenaRunExport";
import { createEmptyChoiceInteractionReport } from "../../application/ChoiceInteractionMonitor";
import { createEmptyBossShadowReport } from "../../application/BossEncounterShadowMonitor";

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
      choiceInteraction: {
        schemaVersion: 1,
        samples: [],
        summary: { selectedCount: 0 },
      },
      bossShadow: {
        schemaVersion: 1,
        state: "not-reached",
        reason: "bossNotSpawned",
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
    choiceInteraction: createEmptyChoiceInteractionReport(),
    bossShadow: createEmptyBossShadowReport(),
    encounterRelief: {
      schemaVersion: 1 as const,
      windowSeconds: 5 as const,
      state: "not-reached" as const,
      reason: "recoveryNotObserved" as const,
    },
    lastEvents: [{ type: "game.started" as const }],
  };
}
