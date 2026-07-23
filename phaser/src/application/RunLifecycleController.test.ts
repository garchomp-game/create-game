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

  it("keeps a victory PB when a faster higher-scoring Expedition defeat is saved", () => {
    const store = new MemoryRunRecordStore();
    const first = new RunLifecycleController(store);
    const victory = createWorld(SIMULATION_CONFIG);
    setExpeditionResult(victory, "victory", 600, 20_000);
    first.begin(makeExpeditionContext("victory"), true);
    first.finalize(victory, SIMULATION_CONFIG, "2026-07-17T04:00:00Z");

    const controller = new RunLifecycleController(store);
    const defeat = createWorld(SIMULATION_CONFIG);
    setExpeditionResult(defeat, "defeat", 100, 200_000);
    controller.begin(makeExpeditionContext("defeat"), true);
    const outcome = controller.finalize(
      defeat,
      SIMULATION_CONFIG,
      "2026-07-17T04:01:00Z",
    );

    expect(outcome.newPersonalBest).toBe(false);
    expect(outcome.newWeaponPersonalBest).toBe(false);
    expect(controller.getPreviousBest()?.id).toBe("victory");
    expect(controller.getHistory().map((record) => record.id)).toEqual([
      "defeat",
      "victory",
    ]);
  });

  it("reports a weapon PB without incorrectly reporting an overall PB", () => {
    const store = new MemoryRunRecordStore();
    const first = new RunLifecycleController(store);
    const pulse = createWorld(SIMULATION_CONFIG);
    setExpeditionResult(pulse, "victory", 480, 20_000);
    first.begin(makeExpeditionContext("pulse-best", "pulse"), true);
    first.finalize(pulse, SIMULATION_CONFIG, "2026-07-17T04:00:00Z");

    const controller = new RunLifecycleController(store);
    const spread = createWorld(SIMULATION_CONFIG);
    setExpeditionResult(spread, "victory", 500, 30_000);
    controller.begin(makeExpeditionContext("spread-best", "spread"), true);
    const outcome = controller.finalize(
      spread,
      SIMULATION_CONFIG,
      "2026-07-17T04:01:00Z",
    );

    expect(outcome.newPersonalBest).toBe(false);
    expect(outcome.newWeaponPersonalBest).toBe(true);
    expect(controller.getPreviousBest()?.id).toBe("pulse-best");
    expect(controller.getPreviousWeaponBest()).toBeNull();
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

  it("discards a non-recording session without writing or clearing saved boards", () => {
    const store = new MemoryRunRecordStore();
    const controller = new RunLifecycleController(store);
    const world = createWorld(SIMULATION_CONFIG);
    controller.begin(makeContext(), true);
    controller.observeEvents([{ type: "game.started" }]);

    controller.discard();
    const outcome = controller.finalize(
      world,
      SIMULATION_CONFIG,
      "2026-07-20T00:00:00Z",
    );

    expect(outcome.result.status).toBe("notStarted");
    expect(store.saveAttempts).toBe(0);
    expect(controller.getContext()).toBeNull();
    expect(controller.getLastEvents()).toEqual([]);
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

  delete(recordId: string): RunRecordWriteResult {
    this.records = this.records.filter((record) => record.id !== recordId);
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
    rulesetProfileId: "legacy-endless-v068",
    rngVersion: "arena-rng-v1",
    runRecordSchemaVersion: 2,
    exProtocolsEnabled: false,
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

function makeExpeditionContext(
  id: string,
  weaponId: RunContext["weaponId"] = "pulse",
): RunContext {
  return {
    ...makeContext(id),
    modeId: "expedition",
    stageId: "final-expedition",
    rulesetVersion: "rules-rc6",
    rulesetProfileId: "legacy-final-expedition-rc6",
    weaponId,
  };
}

function setExpeditionResult(
  world: ReturnType<typeof createWorld>,
  outcome: "victory" | "defeat",
  elapsed: number,
  tacticalScore: number,
): void {
  world.state.status = "gameOver";
  world.state.elapsed = elapsed;
  world.state.score = tacticalScore + (outcome === "victory" ? 15_000 : 0);
  world.stats.encounterMetrics.expedition = {
    outcome,
    reachedActId: "command-ship",
    reachedActIds: ["command-ship"],
    actChanges: 4,
    cardsSelected: 5,
    cardsCompleted: outcome === "victory" ? 5 : 4,
    cardsFailed: 0,
    cardsInterrupted: 0,
    cardsDeferred: 0,
    structuredEnemiesSpawned: 20,
    structuredSpawnsDeferred: 0,
    longestMeaningfulGap: 0,
    completedAt: elapsed,
    tacticalScore,
    scoreBeforeBonus: tacticalScore,
    clearScoreBonus: outcome === "victory" ? 15_000 : 0,
    timeScoreBonus: 0,
    timeMedal: outcome === "victory" ? "silver" : null,
    bossFightDuration: 120,
    cardHistory: [],
  };
}
