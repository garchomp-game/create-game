import { describe, expect, it, vi } from "vitest";
import { ArenaSession } from "../../application/ArenaSession";
import { AutoPilotController } from "../../application/AutoPilotController";
import { PerformanceMonitor } from "../../application/PerformanceMonitor";
import { RunLifecycleController } from "../../application/RunLifecycleController";
import { SIMULATION_CONFIG } from "../../config/gameConfig";
import {
  createDefaultProfileSettings,
  type LocalProfile,
} from "../../domain/profile";
import type { RunContext, RunRecord } from "../../domain/runRecords";
import type {
  RunRecordLoadResult,
  RunRecordStorePort,
  RunRecordWriteResult,
} from "../../ports/RunRecordStorePort";
import { createRankEligibility } from "../../application/runRecords";
import { InMemoryMetrics } from "../telemetry/InMemoryMetrics";
import {
  ArenaDebugController,
  type ArenaDebugControllerDependencies,
} from "./ArenaDebugController";

describe("ArenaDebugController", () => {
  it("owns debug mutation, soak protection, snapshot, and API state", () => {
    const { controller, dependencies, session, recorded } = createFixture();
    const api = controller.createApi();

    api.forceDamage(12);
    expect(session.world.state.hp).toBe(
      SIMULATION_CONFIG.player.maxHp - 12,
    );
    expect(recorded.at(-1)?.events).toContainEqual({
      type: "player.damaged",
      damage: 12,
      hpAfter: SIMULATION_CONFIG.player.maxHp - 12,
    });

    api.restoreHealthForSoak();
    session.world.state.hp = 1;
    controller.prepareSoakProtection();
    expect(session.world.state.hp).toBe(SIMULATION_CONFIG.player.maxHp);
    expect(session.world.state.damageCooldown).toBe(60);

    api.setPaused(true);
    expect(controller.paused).toBe(true);
    expect(api.getSnapshot()).toMatchObject({
      seed: 42,
      status: "playing",
      hp: SIMULATION_CONFIG.player.maxHp,
      autoPilotEnabled: false,
    });
    expect(dependencies.render).toHaveBeenCalled();
  });

  it("keeps run export metadata and navigation callbacks behind the API", () => {
    const { controller, dependencies } = createFixture();
    const api = controller.createApi();

    expect(api.getRunExport()).toMatchObject({
      game: "arena-core-phaser",
      profileId: PROFILE.id,
      seed: 42,
      status: "playing",
    });

    api.restart();
    api.startAutoPilot("spread");
    expect(dependencies.resetGame).toHaveBeenCalledWith("playing", "test");
    expect(dependencies.startAutoPilot).toHaveBeenCalledWith("spread");
  });
});

function createFixture() {
  const session = new ArenaSession(SIMULATION_CONFIG);
  session.start({ seed: 42, weaponType: "pulse" });
  const store = new MemoryRunRecordStore();
  const runLifecycle = new RunLifecycleController(store);
  runLifecycle.begin(makeContext(), true);
  const performance = new PerformanceMonitor(new InMemoryMetrics(), {
    report: () => undefined,
  });
  const autoPilot = new AutoPilotController("periodic-v3");
  const recorded: Parameters<ArenaDebugControllerDependencies["recordResult"]>[0][] = [];
  let settings = createDefaultProfileSettings();
  const dependencies: ArenaDebugControllerDependencies = {
    session,
    runLifecycle,
    runRecordStore: store,
    autoPilot,
    performance,
    getActualFps: () => 60,
    getRenderPerformance: () => ({
      staticBackground: { drawCount: 1, drawDurationMs: 0.2 },
      renderedFrames: 1,
      dynamicWorld: { averageMs: 0.2, maxMs: 0.2 },
      screenHud: { averageMs: 0.1, maxMs: 0.1 },
      feedback: { averageMs: 0.05, maxMs: 0.05 },
    }),
    getBuildCommit: () => "test-commit",
    getProfile: () => PROFILE,
    getSettings: () => settings,
    updateSettings: (update) => {
      settings = { ...settings, ...update };
      return settings;
    },
    getSecondaryMenu: () => null,
    openMenu: vi.fn(),
    getBaseRunOrigin: () => "test",
    getFixedSeed: () => 42,
    getFeedbackSnapshot: () => ({
      impactCount: 0,
      particleCount: 0,
      screenFlashAlpha: 0,
    }),
    getAudioCues: () => [],
    getMusicSnapshot: () => ({
      loaded: false,
      playing: false,
      track: null,
      volume: 0,
      muted: false,
    }),
    clearTransientInput: vi.fn(),
    recordResult: (result) => {
      recorded.push(result);
      runLifecycle.observeEvents(result.events);
    },
    resetGame: vi.fn(),
    render: vi.fn(),
    startAutoPilot: vi.fn(),
    setAutoPilotEnabled: vi.fn(),
    saveRunExport: vi.fn(async () => ({ ok: true })),
  };
  return {
    controller: new ArenaDebugController(dependencies),
    dependencies,
    session,
    recorded,
  };
}

const PROFILE: LocalProfile = {
  schemaVersion: 1,
  id: "00000000-0000-4000-8000-000000000001",
  createdAt: "2026-07-17T00:00:00.000Z",
  updatedAt: "2026-07-17T00:00:00.000Z",
};

function makeContext(): RunContext {
  return {
    id: "run-debug",
    profileId: PROFILE.id,
    startedAt: "2026-07-17T00:00:00.000Z",
    modeId: "endless",
    stageId: "arena-default",
    difficultyId: "standard",
    rulesetVersion: "test-rules",
    seedCategory: "fixed",
    weaponId: "pulse",
    modifierIds: [],
    appVersion: "test",
    buildCommit: "test-commit",
    seed: 42,
    runOrigin: "test",
    rankEligibility: createRankEligibility("test"),
  };
}

class MemoryRunRecordStore implements RunRecordStorePort {
  private records: RunRecord[] = [];

  load(): RunRecordLoadResult {
    return {
      records: [...this.records],
      history: [...this.records],
      rankings: [...this.records],
      recovered: false,
    };
  }

  save(record: RunRecord): RunRecordWriteResult {
    this.records = [record];
    return this.writeResult();
  }

  clearHistory(): RunRecordWriteResult {
    return this.clear();
  }

  clearRankings(): RunRecordWriteResult {
    return this.clear();
  }

  clear(): RunRecordWriteResult {
    this.records = [];
    return this.writeResult();
  }

  private writeResult(): RunRecordWriteResult {
    return {
      ok: true,
      records: [...this.records],
      history: [...this.records],
      rankings: [...this.records],
    };
  }
}
