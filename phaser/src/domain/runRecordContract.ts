import type { RunOrigin } from "./runRecords";

export const RUN_RECORD_STORAGE_POLICIES = ["record", "none"] as const;
export type RunRecordStoragePolicy =
  (typeof RUN_RECORD_STORAGE_POLICIES)[number];

export const RUN_COMPARISON_POLICIES = [
  "standard",
  "condition-scoped",
  "none",
] as const;
export type RunComparisonPolicy =
  (typeof RUN_COMPARISON_POLICIES)[number];

export const RUN_MODIFIER_IMPACTS = ["neutral", "simulation"] as const;
export type RunModifierImpact = (typeof RUN_MODIFIER_IMPACTS)[number];

export type RunModifierDefinition = Readonly<{
  id: string;
  version: number;
  impact: RunModifierImpact;
}>;

export type NormalizedRunModifier = RunModifierDefinition &
  Readonly<{
    canonicalId: string;
  }>;

export const RUN_COMPARISON_EXCLUSION_REASONS = [
  "recordingDisabled",
  "debugRun",
  "automatedTest",
  "comparisonDisabled",
  "simulationModifierRequiresScopedComparison",
  "conditionScopeRequiresSimulationModifier",
] as const;
export type RunComparisonExclusionReason =
  (typeof RUN_COMPARISON_EXCLUSION_REASONS)[number];

export type ResolveRunRecordContractInput = Readonly<{
  storagePolicy: RunRecordStoragePolicy;
  requestedComparisonPolicy: RunComparisonPolicy;
  runOrigin: RunOrigin;
  modifiers: readonly RunModifierDefinition[];
}>;

export type ResolvedRunRecordContract = Readonly<{
  storagePolicy: RunRecordStoragePolicy;
  comparisonPolicy: RunComparisonPolicy;
  standardPbEligible: boolean;
  normalizedModifierIds: readonly string[];
  comparisonModifierIds: readonly string[];
  exclusionReasons: readonly RunComparisonExclusionReason[];
}>;

const RUN_MODIFIER_ID_PATTERN =
  /^[a-z][a-z0-9]*(?:[.-][a-z0-9]+)*$/;

export function toRunModifierCanonicalId(
  modifier: Pick<RunModifierDefinition, "id" | "version">,
): string {
  validateModifierId(modifier.id);
  validateModifierVersion(modifier.version);
  return `${modifier.id}@v${modifier.version}`;
}

export function normalizeRunModifiers(
  modifiers: readonly RunModifierDefinition[],
): NormalizedRunModifier[] {
  const byId = new Map<string, NormalizedRunModifier>();

  for (const modifier of modifiers) {
    validateModifierImpact(modifier.impact);
    const canonicalId = toRunModifierCanonicalId(modifier);
    const current = byId.get(modifier.id);
    if (current) {
      if (
        current.version !== modifier.version ||
        current.impact !== modifier.impact
      ) {
        throw new Error(
          `Run modifier "${modifier.id}" has conflicting definitions.`,
        );
      }
      continue;
    }
    byId.set(modifier.id, {
      id: modifier.id,
      version: modifier.version,
      impact: modifier.impact,
      canonicalId,
    });
  }

  return [...byId.values()].sort((left, right) =>
    left.canonicalId < right.canonicalId
      ? -1
      : left.canonicalId > right.canonicalId
        ? 1
        : 0
  );
}

export function resolveRunRecordContract(
  input: ResolveRunRecordContractInput,
): ResolvedRunRecordContract {
  const modifiers = normalizeRunModifiers(input.modifiers);
  const simulationModifierIds = modifiers
    .filter((modifier) => modifier.impact === "simulation")
    .map((modifier) => modifier.canonicalId);
  const exclusionReasons: RunComparisonExclusionReason[] = [];

  if (input.storagePolicy === "none") {
    exclusionReasons.push("recordingDisabled");
  }
  if (input.runOrigin === "debug") {
    exclusionReasons.push("debugRun");
  }
  if (input.runOrigin === "test") {
    exclusionReasons.push("automatedTest");
  }
  if (input.requestedComparisonPolicy === "none") {
    exclusionReasons.push("comparisonDisabled");
  }
  if (
    input.requestedComparisonPolicy === "standard" &&
    simulationModifierIds.length > 0
  ) {
    exclusionReasons.push(
      "simulationModifierRequiresScopedComparison",
    );
  }
  if (
    input.requestedComparisonPolicy === "condition-scoped" &&
    simulationModifierIds.length === 0
  ) {
    exclusionReasons.push("conditionScopeRequiresSimulationModifier");
  }

  const comparisonPolicy =
    exclusionReasons.length === 0
      ? input.requestedComparisonPolicy
      : "none";

  return {
    storagePolicy: input.storagePolicy,
    comparisonPolicy,
    standardPbEligible: comparisonPolicy === "standard",
    normalizedModifierIds: modifiers.map(
      (modifier) => modifier.canonicalId,
    ),
    comparisonModifierIds:
      comparisonPolicy === "condition-scoped"
        ? simulationModifierIds
        : [],
    exclusionReasons,
  };
}

function validateModifierId(id: string): void {
  if (!RUN_MODIFIER_ID_PATTERN.test(id)) {
    throw new Error(
      `Run modifier ID "${id}" must use lowercase dot/hyphen segments.`,
    );
  }
}

function validateModifierVersion(version: number): void {
  if (!Number.isInteger(version) || version < 1) {
    throw new Error("Run modifier version must be a positive integer.");
  }
}

function validateModifierImpact(impact: RunModifierImpact): void {
  if (!RUN_MODIFIER_IMPACTS.includes(impact)) {
    throw new Error(`Unknown run modifier impact "${impact}".`);
  }
}
