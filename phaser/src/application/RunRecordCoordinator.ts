import type {
  RunResultSummary,
  ExtraUpgradeId,
  ExtraUpgradeSelectionRunStat,
  UpgradeId,
  UpgradeSelectionRunStat,
  EncounterRunStats,
} from "../domain/types";
import type { ExProtocolRunStats } from "../domain/exProtocolTelemetry";
import type { RunContext, RunOrigin, RunRecord } from "../domain/runRecords";
import type { RunRecordStorePort, RunRecordWriteResult } from "../ports/RunRecordStorePort";
import { createRankEligibility, createRunRecord } from "./runRecords";

export type FinalizeRunInput = {
  capturedAt: string;
  summary: RunResultSummary;
  upgradeRanks: Record<UpgradeId, number>;
  upgradeSelections: UpgradeSelectionRunStat[];
  extraUpgradeRanks?: Record<ExtraUpgradeId, number>;
  extraUpgradeSelections?: ExtraUpgradeSelectionRunStat[];
  buildCompletedAt: number | null;
  encounterMetrics?: EncounterRunStats;
  exProtocolMetrics?: ExProtocolRunStats;
};

export type FinalizeRunResult =
  | { status: "notStarted" }
  | { status: "alreadyFinalized"; record: RunRecord }
  | { status: "saved" | "saveFailed"; record: RunRecord; write: RunRecordWriteResult };

export class RunRecordCoordinator {
  private context: RunContext | null = null;
  private started = false;
  private finalizedRecord: RunRecord | null = null;
  private finalizedWrite: RunRecordWriteResult | null = null;

  constructor(private readonly store: RunRecordStorePort) {}

  reset(context: RunContext, started = false): void {
    this.context = cloneContext(context);
    this.started = started;
    this.finalizedRecord = null;
    this.finalizedWrite = null;
  }

  discard(): void {
    this.context = null;
    this.started = false;
    this.finalizedRecord = null;
    this.finalizedWrite = null;
  }

  markStarted(): void {
    this.started = true;
  }

  markDebugMutation(): void {
    if (!this.context || this.context.runOrigin === "test") return;
    this.setOrigin("debug");
  }

  addModifier(modifierId: string, standardRuleset = true): void {
    if (!this.context) return;
    if (!this.context.modifierIds.includes(modifierId)) this.context.modifierIds.push(modifierId);
    const wasStandard = !this.context.rankEligibility.reasons.includes("nonStandardRuleset");
    this.context.rankEligibility = createRankEligibility(
      this.context.runOrigin,
      wasStandard && standardRuleset,
    );
  }

  setOrigin(origin: RunOrigin): void {
    if (!this.context) return;
    const standardRuleset = !this.context.rankEligibility.reasons.includes("nonStandardRuleset");
    this.context.runOrigin = origin;
    this.context.rankEligibility = createRankEligibility(origin, standardRuleset);
  }

  getContext(): RunContext | null {
    return this.context ? cloneContext(this.context) : null;
  }

  getFinalizedRecord(): RunRecord | null {
    return this.finalizedRecord ? cloneRecord(this.finalizedRecord) : null;
  }

  finalize(input: FinalizeRunInput): FinalizeRunResult {
    if (!this.started || !this.context) return { status: "notStarted" };
    if (this.finalizedRecord && this.finalizedWrite?.ok) {
      return { status: "alreadyFinalized", record: cloneRecord(this.finalizedRecord) };
    }

    const record = this.finalizedRecord ?? createRunRecord({
      context: this.context,
      capturedAt: input.capturedAt,
      summary: input.summary,
      upgradeRanks: input.upgradeRanks,
      upgradeSelections: input.upgradeSelections,
      extraUpgradeRanks: input.extraUpgradeRanks,
      extraUpgradeSelections: input.extraUpgradeSelections,
      buildCompletedAt: input.buildCompletedAt,
      encounterMetrics: input.encounterMetrics,
      exProtocolMetrics: input.exProtocolMetrics,
    });
    this.finalizedRecord ??= cloneRecord(record);
    const write = this.store.save(record);
    this.finalizedWrite = write;

    return {
      status: write.ok ? "saved" : "saveFailed",
      record: cloneRecord(record),
      write,
    };
  }
}

function cloneContext(context: RunContext): RunContext {
  return {
    ...context,
    modifierIds: [...context.modifierIds],
    rankEligibility: {
      eligible: context.rankEligibility.eligible,
      reasons: [...context.rankEligibility.reasons],
    },
  };
}

function cloneRecord(record: RunRecord): RunRecord {
  return structuredClone(record);
}
