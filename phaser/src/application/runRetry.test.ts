import { describe, expect, it } from "vitest";
import type { RunContext } from "../domain/runRecords";
import type { RunOutcomeInsightViewModel } from "../domain/runOutcomeInsights";
import { createSameSeedRetryPlan } from "./runRetry";

describe("createSameSeedRetryPlan", () => {
  it("replays the same run contract and moves a random seed to the fixed board", () => {
    const context = createContext();
    const insight = createInsight(context);
    insight.retryContext.modifierIds.reverse();

    expect(createSameSeedRetryPlan(insight, context)).toEqual({
      modeId: "endless",
      stageId: "arena-default",
      difficultyId: "standard",
      weaponId: "spread",
      rulesetVersion: "rules-v1",
      rulesetProfileId: "legacy-endless-v068",
      seed: 123456,
      seedCategory: "fixed",
    });
  });

  it("rejects stale or incomplete retry evidence", () => {
    const context = createContext();
    const mismatch = createInsight(context);
    mismatch.retryContext.weaponId = "pulse";
    const seedCategoryMismatch = createInsight(context);
    seedCategoryMismatch.retryContext.seedCategory = "fixed";

    expect(createSameSeedRetryPlan(mismatch, context)).toBeNull();
    expect(createSameSeedRetryPlan(seedCategoryMismatch, context)).toBeNull();
    expect(
      createSameSeedRetryPlan(
        {
          schemaVersion: 1,
          state: "not-reached",
          reason: "runNotTerminated",
        },
        context,
      ),
    ).toBeNull();
    expect(createSameSeedRetryPlan(createInsight(context), null)).toBeNull();
  });
});

function createContext(): RunContext {
  return {
    id: "run-retry",
    profileId: "profile-a",
    startedAt: "2026-07-25T00:00:00.000Z",
    modeId: "endless",
    stageId: "arena-default",
    difficultyId: "standard",
    rulesetVersion: "rules-v1",
    rulesetProfileId: "legacy-endless-v068",
    rngVersion: "arena-rng-v1",
    runRecordSchemaVersion: 2,
    exProtocolsEnabled: false,
    seedCategory: "random",
    weaponId: "spread",
    modifierIds: ["auto-fire:on", "contract:standard"],
    appVersion: "0.8.0",
    buildCommit: "test",
    seed: 123456,
    runOrigin: "manual",
    rankEligibility: { eligible: true, reasons: [] },
  };
}

function createInsight(
  context: RunContext,
): Extract<RunOutcomeInsightViewModel, { state: "available" }> {
  return {
    schemaVersion: 1,
    state: "available",
    retryContext: {
      profileId: context.profileId,
      modeId: context.modeId,
      stageId: context.stageId,
      difficultyId: context.difficultyId,
      weaponId: context.weaponId,
      rulesetVersion: context.rulesetVersion,
      seed: context.seed,
      seedCategory: context.seedCategory,
      modifierIds: [...context.modifierIds],
    },
    primaryCause: null,
    nextAction: {
      id: "review-final-pressure",
      title: "終了前5秒の位置と優先標的を見直す",
    },
    progress: {
      completionKind: "gameOver",
      elapsed: 100,
      score: 5000,
      tacticalScore: null,
      actId: null,
      boss: null,
      pressure: {
        activeCommanderCount: 0,
        activeEscortCount: 0,
        bossActive: false,
        collapseStage: 0,
        lastBossAttackId: null,
      },
    },
    nearMiss: { state: "not-reached", reason: "bossNotReached" },
    previousDifference: { state: "not-reached", reason: "noPreviousRun" },
    snapshot: {
      comparisonKey: "retry-fixture",
      completionKind: "gameOver",
      elapsed: 100,
      score: 5000,
      primaryCauseId: null,
      totalDamage: 0,
      boss: null,
    },
  };
}
