import { describe, expect, it } from "vitest";
import { SIMULATION_CONFIG } from "../config/gameConfig";
import type { RunContext, RunRecord } from "../domain/runRecords";
import type {
  RunRecordLoadResult,
  RunRecordStorePort,
  RunRecordWriteResult,
} from "../ports/RunRecordStorePort";
import { createWorld } from "../simulation/createWorld";
import { createRankEligibility } from "./runRecords";
import { RunLifecycleController } from "./RunLifecycleController";

describe("RunLifecycleController", () => {
  it("owns context, events, records, and exactly-once finalization", () => {
    const store = new MemoryRunRecordStore();
    const controller = new RunLifecycleController(store);
    const world = createWorld(SIMULATION_CONFIG);
    world.state.status = "gameOver";
    world.state.elapsed = 42;
    world.state.score = 900;
    controller.begin(makeContext());
    controller.observeEvents([
      { type: "game.started" },
      {
        type: "contract.selected",
        choice: "standard",
        elapsed: 1,
        enemySpeedMultiplier: 1,
        scoreMultiplier: 1,
      },
      { type: "game.over", score: 900, elapsed: 42 },
    ]);

    const first = controller.finalize(world, SIMULATION_CONFIG, "2026-07-17T04:00:00Z");
    const second = controller.finalize(world, SIMULATION_CONFIG, "2026-07-17T04:00:01Z");

    expect(first.result.status).toBe("saved");
    expect(first.newPersonalBest).toBe(true);
    expect(second.result.status).toBe("alreadyFinalized");
    expect(store.saveAttempts).toBe(1);
    expect(controller.getHistory()).toHaveLength(1);
    expect(controller.getLatestRecord()).toMatchObject({ score: 900, elapsed: 42 });
    expect(controller.getContext()?.modifierIds).toEqual(["contract:standard"]);
    expect(controller.getLastEvents().map((event) => event.type)).toEqual([
      "game.started",
      "contract.selected",
      "game.over",
    ]);
  });

  it("keeps the previous personal best and does not celebrate a lower score", () => {
    const store = new MemoryRunRecordStore();
    const first = new RunLifecycleController(store);
    const winningWorld = createWorld(SIMULATION_CONFIG);
    winningWorld.state.score = 1000;
    first.begin(makeContext("run-best"), true);
    first.finalize(winningWorld, SIMULATION_CONFIG, "2026-07-17T04:00:00Z");

    const controller = new RunLifecycleController(store);
    const world = createWorld(SIMULATION_CONFIG);
    world.state.score = 500;
    controller.begin(makeContext("run-lower"), true);
    const outcome = controller.finalize(world, SIMULATION_CONFIG, "2026-07-17T04:01:00Z");

    expect(outcome.newPersonalBest).toBe(false);
    expect(controller.getPreviousBest()).toMatchObject({ id: "run-best", score: 1000 });
  });

  it("synchronizes menu writes and clears all lifecycle state", () => {
    const store = new MemoryRunRecordStore();
    const controller = new RunLifecycleController(store);
    controller.begin(makeContext(), true);
    const world = createWorld(SIMULATION_CONFIG);
    controller.finalize(world, SIMULATION_CONFIG, "2026-07-17T04:00:00Z");

    controller.applyWriteResult({ ok: true, records: [], history: [], rankings: [] });
    expect(controller.getHistory()).toEqual([]);
    expect(controller.clearAll().ok).toBe(true);
    expect(controller.getLatestRecord()).toBeNull();
    expect(controller.getPreviousBest()).toBeNull();
  });
});

class MemoryRunRecordStore implements RunRecordStorePort {
  records: RunRecord[] = [];
  saveAttempts = 0;

  load(): RunRecordLoadResult {
    return {
      records: [...this.records],
      history: [...this.records],
      rankings: [...this.records],
      recovered: false,
    };
  }

  save(record: RunRecord): RunRecordWriteResult {
    this.saveAttempts += 1;
    this.records = [record, ...this.records.filter((item) => item.id !== record.id)];
    return {
      ok: true,
      records: [...this.records],
      history: [...this.records],
      rankings: [...this.records],
    };
  }

  clearHistory(): RunRecordWriteResult {
    return this.clear();
  }

  clearRankings(): RunRecordWriteResult {
    return this.clear();
  }

  clear(): RunRecordWriteResult {
    this.records = [];
    return { ok: true, records: [], history: [], rankings: [] };
  }
}

function makeContext(id = "run-1"): RunContext {
  return {
    id,
    profileId: "guest-1",
    startedAt: "2026-07-17T03:59:00Z",
    modeId: "endless",
    stageId: "arena-default",
    difficultyId: "standard",
    rulesetVersion: "rules-v1",
    seedCategory: "fixed",
    weaponId: "pulse",
    modifierIds: [],
    appVersion: "0.6.8",
    buildCommit: "test",
    seed: 42,
    runOrigin: "manual",
    rankEligibility: createRankEligibility("manual"),
  };
}
