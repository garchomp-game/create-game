import type { RunContext, RunRecord } from "../domain/runRecords";
import type {
  GameEvent,
  SimulationConfig,
  WorldState,
} from "../domain/types";
import type {
  RunRecordStorePort,
  RunRecordWriteResult,
} from "../ports/RunRecordStorePort";
import { createRunResultSummary } from "../simulation/resultSummary";
import {
  type FinalizeRunResult,
  RunRecordCoordinator,
} from "./RunRecordCoordinator";
import {
  compareRunPerformance,
  createRunComparisonQuery,
  isRankableRun,
  selectPersonalBest,
} from "./runRecords";

export type RunLifecycleFinalizeOutcome = {
  result: FinalizeRunResult;
  newPersonalBest: boolean;
  newWeaponPersonalBest: boolean;
};

export class RunLifecycleController {
  private readonly coordinator: RunRecordCoordinator;
  private history: RunRecord[];
  private rankings: RunRecord[];
  private latestRecord: RunRecord | null = null;
  private previousBest: RunRecord | null = null;
  private previousWeaponBest: RunRecord | null = null;
  private lastEvents: GameEvent[] = [];

  constructor(private readonly store: RunRecordStorePort) {
    this.coordinator = new RunRecordCoordinator(store);
    const loaded = store.load();
    this.history = loaded.history;
    this.rankings = loaded.rankings;
  }

  begin(context: RunContext, started = false): void {
    this.coordinator.reset(context, started);
    this.latestRecord = null;
    this.previousBest = null;
    this.previousWeaponBest = null;
    this.lastEvents = [];
  }

  discard(): void {
    this.coordinator.discard();
    this.latestRecord = null;
    this.previousBest = null;
    this.previousWeaponBest = null;
    this.lastEvents = [];
  }

  observeEvents(events: readonly GameEvent[]): void {
    for (const event of events) {
      this.lastEvents.push(structuredClone(event));
      if (event.type === "game.started") this.coordinator.markStarted();
      if (event.type === "contract.selected") {
        this.coordinator.addModifier(`contract:${event.choice}`, event.choice === "standard");
      }
    }
    this.lastEvents = this.lastEvents.slice(-20);
  }

  finalize(world: WorldState, config: SimulationConfig, capturedAt: string): RunLifecycleFinalizeOutcome {
    const context = this.coordinator.getContext();
    const profileRankings = context
      ? this.rankings.filter((record) => record.profileId === context.profileId)
      : [];
    this.previousBest = context
      ? selectPersonalBest(
          profileRankings,
          createRunComparisonQuery(context, "overall"),
        )
      : null;
    this.previousWeaponBest = context
      ? selectPersonalBest(
          profileRankings,
          createRunComparisonQuery(context, "weapon"),
        )
      : null;
    const result = this.coordinator.finalize({
      capturedAt,
      summary: createRunResultSummary(world, config),
      upgradeRanks: world.progression.upgradeRanks,
      upgradeSelections: world.stats.progressionMetrics.selections,
      extraUpgradeRanks: world.progression.extraUpgradeRanks,
      extraUpgradeSelections: world.stats.progressionMetrics.extraSelections,
      buildCompletedAt: world.progression.buildCompletedAt,
      encounterMetrics: world.stats.encounterMetrics,
      exProtocolMetrics: world.stats.exProtocolMetrics,
    });
    if (result.status === "notStarted" || result.status === "alreadyFinalized") {
      return {
        result,
        newPersonalBest: false,
        newWeaponPersonalBest: false,
      };
    }

    this.latestRecord = result.record;
    const newPersonalBest =
      isRankableRun(result.record) &&
      (this.previousBest === null ||
        compareRunPerformance(result.record, this.previousBest) < 0);
    const newWeaponPersonalBest =
      isRankableRun(result.record) &&
      (this.previousWeaponBest === null ||
        compareRunPerformance(result.record, this.previousWeaponBest) < 0);
    this.applyWriteResult(result.write);
    return { result, newPersonalBest, newWeaponPersonalBest };
  }

  markDebugMutation(): void {
    this.coordinator.markDebugMutation();
  }

  addModifier(modifierId: string, standardRuleset = true): void {
    this.coordinator.addModifier(modifierId, standardRuleset);
  }

  applyWriteResult(result: RunRecordWriteResult): void {
    if (!result.ok) return;
    this.applyRecordViews(result);
  }

  applyRecordViews(records: { history: RunRecord[]; rankings: RunRecord[] }): void {
    this.history = records.history;
    this.rankings = records.rankings;
  }

  clearAll(): RunRecordWriteResult {
    const result = this.store.clear();
    if (result.ok) {
      this.history = [];
      this.rankings = [];
      this.latestRecord = null;
      this.previousBest = null;
      this.previousWeaponBest = null;
    }
    return result;
  }

  getContext(): RunContext | null {
    return this.coordinator.getContext();
  }

  getHistory(): RunRecord[] {
    return [...this.history];
  }

  getRankings(): RunRecord[] {
    return [...this.rankings];
  }

  getLatestRecord(): RunRecord | null {
    return this.latestRecord ? structuredClone(this.latestRecord) : null;
  }

  getPreviousBest(): RunRecord | null {
    return this.previousBest ? structuredClone(this.previousBest) : null;
  }

  getPreviousWeaponBest(): RunRecord | null {
    return this.previousWeaponBest ? structuredClone(this.previousWeaponBest) : null;
  }

  deleteRecord(recordId: string): RunRecordWriteResult {
    const result = this.store.delete(recordId);
    if (result.ok) this.applyRecordViews(result);
    return result;
  }

  getLastEvents(): GameEvent[] {
    return this.lastEvents.map((event) => structuredClone(event));
  }
}
