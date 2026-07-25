import type { RunOutcomeInsightViewModel } from "../domain/runOutcomeInsights";
import type {
  RunContext,
  SeedCategory,
} from "../domain/runRecords";
import type { RulesetProfileId } from "../domain/ruleset";
import type { WeaponTypeId } from "../domain/types";

export type SameSeedRetryPlan = {
  modeId: string;
  stageId: string;
  difficultyId: string;
  weaponId: WeaponTypeId;
  rulesetVersion: string;
  rulesetProfileId: RulesetProfileId;
  seed: number;
  seedCategory: Extract<SeedCategory, "fixed">;
};

export function createSameSeedRetryPlan(
  insight: RunOutcomeInsightViewModel | null,
  context: RunContext | null,
): SameSeedRetryPlan | null {
  if (insight?.state !== "available" || context === null) return null;
  const retry = insight.retryContext;
  if (
    retry.profileId !== context.profileId ||
    retry.modeId !== context.modeId ||
    retry.stageId !== context.stageId ||
    retry.difficultyId !== context.difficultyId ||
    retry.weaponId !== context.weaponId ||
    retry.rulesetVersion !== context.rulesetVersion ||
    retry.seed !== context.seed ||
    retry.seedCategory !== context.seedCategory ||
    !sameStrings(retry.modifierIds, context.modifierIds)
  ) {
    return null;
  }

  return {
    modeId: context.modeId,
    stageId: context.stageId,
    difficultyId: context.difficultyId,
    weaponId: context.weaponId,
    rulesetVersion: context.rulesetVersion,
    rulesetProfileId: context.rulesetProfileId,
    seed: context.seed,
    seedCategory: "fixed",
  };
}

function sameStrings(left: readonly string[], right: readonly string[]): boolean {
  if (left.length !== right.length) return false;
  const sortedLeft = [...left].sort();
  const sortedRight = [...right].sort();
  return sortedLeft.every((value, index) => value === sortedRight[index]);
}
