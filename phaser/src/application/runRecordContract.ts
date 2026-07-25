import type { RulesetProfile, RulesetProfileId } from "../domain/ruleset";
import type {
  RunComparisonQuery,
  RunComparisonScope,
  RunContext,
  RunRecord,
} from "../domain/runRecords";
import type {
  ResolvedRunRecordContract,
  RunComparisonPolicy,
} from "../domain/runRecordContract";
import { createRunComparisonQuery } from "./runRecords";

export const LEGACY_STANDARD_MODIFIER_IDS = [
  "auto-fire:off",
  "auto-fire:on",
  "contract:standard",
] as const;

export const PERSISTED_RUN_EXCLUSION_REASONS = [
  "unknownRuleset",
  "invalidRulesetTuple",
  "rulesetNotStandard",
  "nonManualRun",
  "rankIneligible",
  "unsupportedLegacyModifier",
] as const;
export type PersistedRunExclusionReason =
  (typeof PERSISTED_RUN_EXCLUSION_REASONS)[number];

type RunComparisonSource = Pick<
  RunContext,
  | "profileId"
  | "modeId"
  | "stageId"
  | "difficultyId"
  | "rulesetVersion"
  | "seedCategory"
  | "weaponId"
  | "seed"
>;

export type RunComparisonPartition = Readonly<{
  comparisonPolicy: Exclude<RunComparisonPolicy, "none">;
  query: RunComparisonQuery;
  comparisonModifierIds: readonly string[];
  partitionKey: string;
}>;

export type PersistedRunContractClassification = Readonly<{
  comparisonPolicy: Extract<RunComparisonPolicy, "standard" | "none">;
  rulesetProfileId: RulesetProfileId | "legacy-unknown";
  normalizedLegacyModifierIds: readonly string[];
  exclusionReason: PersistedRunExclusionReason | null;
}>;

const LEGACY_STANDARD_MODIFIER_ID_SET = new Set<string>(
  LEGACY_STANDARD_MODIFIER_IDS,
);

export function createRunComparisonPartition(
  source: RunComparisonSource,
  comparisonScope: RunComparisonScope,
  contract: ResolvedRunRecordContract,
): RunComparisonPartition | null {
  if (contract.comparisonPolicy === "none") return null;

  const query = createRunComparisonQuery(source, comparisonScope);
  const comparisonModifierIds =
    contract.comparisonPolicy === "condition-scoped"
      ? [...contract.comparisonModifierIds]
      : [];
  return {
    comparisonPolicy: contract.comparisonPolicy,
    query,
    comparisonModifierIds,
    partitionKey: serializeRunComparisonPartition(
      contract.comparisonPolicy,
      query,
      comparisonModifierIds,
    ),
  };
}

export function serializeRunComparisonPartition(
  comparisonPolicy: Exclude<RunComparisonPolicy, "none">,
  query: RunComparisonQuery,
  comparisonModifierIds: readonly string[],
): string {
  return JSON.stringify([
    query.profileId,
    query.modeId,
    query.stageId,
    query.difficultyId,
    query.rulesetVersion,
    query.seedCategory,
    query.seedCategory === "fixed" ? query.seed : null,
    query.comparisonScope,
    query.comparisonScope === "weapon" ? query.weaponId : null,
    comparisonPolicy,
    comparisonPolicy === "condition-scoped"
      ? [...comparisonModifierIds].sort()
      : [],
  ]);
}

export function classifyPersistedRunRecord(
  record: RunRecord,
  profiles: readonly RulesetProfile[],
): PersistedRunContractClassification {
  const modifierIds = [...new Set(record.modifierIds)].sort();
  const profileResolution = resolvePersistedRulesetProfile(
    record,
    profiles,
  );
  if (profileResolution.exclusionReason) {
    return excludedClassification(
      profileResolution.rulesetProfileId,
      modifierIds,
      profileResolution.exclusionReason,
    );
  }
  const profile = profileResolution.profile;
  if (!profile) {
    return excludedClassification(
      "legacy-unknown",
      modifierIds,
      "unknownRuleset",
    );
  }
  if (profile.rankPolicy !== "standard") {
    return excludedClassification(
      profile.id,
      modifierIds,
      "rulesetNotStandard",
    );
  }
  if (record.runOrigin !== "manual") {
    return excludedClassification(
      profile.id,
      modifierIds,
      "nonManualRun",
    );
  }
  if (
    !record.rankEligibility.eligible ||
    record.rankEligibility.reasons.length > 0
  ) {
    return excludedClassification(
      profile.id,
      modifierIds,
      "rankIneligible",
    );
  }
  if (
    modifierIds.some(
      (modifierId) =>
        !LEGACY_STANDARD_MODIFIER_ID_SET.has(modifierId),
    )
  ) {
    return excludedClassification(
      profile.id,
      modifierIds,
      "unsupportedLegacyModifier",
    );
  }
  return {
    comparisonPolicy: "standard",
    rulesetProfileId: profile.id,
    normalizedLegacyModifierIds: modifierIds,
    exclusionReason: null,
  };
}

type ProfileResolution =
  | {
      profile: RulesetProfile;
      rulesetProfileId: RulesetProfileId;
      exclusionReason: null;
    }
  | {
      profile: null;
      rulesetProfileId: RulesetProfileId | "legacy-unknown";
      exclusionReason: Extract<
        PersistedRunExclusionReason,
        "unknownRuleset" | "invalidRulesetTuple"
      >;
    };

function resolvePersistedRulesetProfile(
  record: RunRecord,
  profiles: readonly RulesetProfile[],
): ProfileResolution {
  if (record.schemaVersion === 3) {
    if (record.rulesetProfileId === "legacy-unknown") {
      return {
        profile: null,
        rulesetProfileId: "legacy-unknown",
        exclusionReason: "unknownRuleset",
      };
    }
    const profile = profiles.find(
      (candidate) => candidate.id === record.rulesetProfileId,
    );
    if (!profile) {
      return {
        profile: null,
        rulesetProfileId: record.rulesetProfileId,
        exclusionReason: "unknownRuleset",
      };
    }
    if (
      profile.modeId !== record.modeId ||
      profile.stageId !== record.stageId ||
      profile.rulesetVersion !== record.rulesetVersion ||
      profile.randomStreamVersion !== record.rngVersion
    ) {
      return {
        profile: null,
        rulesetProfileId: profile.id,
        exclusionReason: "invalidRulesetTuple",
      };
    }
    return {
      profile,
      rulesetProfileId: profile.id,
      exclusionReason: null,
    };
  }

  const matches = profiles.filter(
    (profile) =>
      !profile.features.exProtocols &&
      profile.modeId === record.modeId &&
      profile.stageId === record.stageId &&
      profile.rulesetVersion === record.rulesetVersion,
  );
  if (matches.length !== 1) {
    return {
      profile: null,
      rulesetProfileId: "legacy-unknown",
      exclusionReason: "unknownRuleset",
    };
  }
  return {
    profile: matches[0]!,
    rulesetProfileId: matches[0]!.id,
    exclusionReason: null,
  };
}

function excludedClassification(
  rulesetProfileId: RulesetProfileId | "legacy-unknown",
  modifierIds: readonly string[],
  exclusionReason: PersistedRunExclusionReason,
): PersistedRunContractClassification {
  return {
    comparisonPolicy: "none",
    rulesetProfileId,
    normalizedLegacyModifierIds: modifierIds,
    exclusionReason,
  };
}
