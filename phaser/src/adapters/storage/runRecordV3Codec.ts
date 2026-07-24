import { z } from "zod";
import {
  EX_PROTOCOL_CATALOG,
  getExProtocolDefinition,
  toExProtocolEvolutionId,
  toExProtocolId,
  type ExProtocolId,
} from "../../content/exProtocolCatalog";
import {
  RUN_RECORD_SCHEMA_VERSION,
  RUN_RECORD_SCHEMA_VERSION_V3,
  runRecordV2Schema,
  type ExProtocolRecordStats,
  type RunRecordRngVersion,
  type RunRecordRulesetProfileId,
  type RunRecordV2,
  type RunRecordV3,
} from "../../domain/runRecords";
import {
  EX_SPECIAL_REJECT_REASONS,
  sanitizeExProtocolCounters,
} from "../../domain/exProtocolTelemetry";
import {
  RULESET_PROFILE_IDS,
} from "../../domain/ruleset";
import {
  RANDOM_STREAM_VERSION,
  RANDOM_STREAM_VERSION_V2,
} from "../../math/random";
import { getRulesetProfiles } from "../../application/RulesetProfileRegistry";

export type RunRecordV3DecodeResult =
  | { ok: true; record: RunRecordV3 }
  | { ok: false; error: string };

const nullableElapsed = z.number().finite().nonnegative().nullable();
const nonNegativeFinite = z.number().finite().nonnegative();
const nonNegativeInteger = z.number().int().nonnegative();
const rulesetProfileIdSchema = z.union([
  z.enum(RULESET_PROFILE_IDS),
  z.literal("legacy-unknown"),
]);
const rngVersionSchema = z.enum([
  RANDOM_STREAM_VERSION,
  RANDOM_STREAM_VERSION_V2,
  "legacy-unknown",
]);
const rejectReasonCountsSchema = z
  .record(z.string().min(1), nonNegativeInteger)
  .superRefine((value, context) => {
    for (const key of Object.keys(value)) {
      if (
        !EX_SPECIAL_REJECT_REASONS.includes(
          key as (typeof EX_SPECIAL_REJECT_REASONS)[number],
        )
      ) {
        context.addIssue({
          code: "custom",
          message: `Unknown EX special rejection reason "${key}".`,
        });
      }
    }
  })
  .default({});

const exProtocolRecordSchema = z
  .object({
    offeredIds: z.array(z.string().min(1)),
    selectedId: z.string().min(1).nullable(),
    selectedAtElapsed: nullableElapsed,
    evolutionOneId: z.string().min(1).nullable(),
    evolutionOneAtElapsed: nullableElapsed,
    evolutionTwoId: z.string().min(1).nullable(),
    evolutionTwoAtElapsed: nullableElapsed,
    masteryId: z.string().min(1).nullable(),
    masteryAtElapsed: nullableElapsed,
    firstLimitBreakAtElapsed: nullableElapsed,
    exposureSeconds: nonNegativeFinite,
    protocolSourceDamage: nonNegativeFinite,
    protocolBonusDamageAttributed: nonNegativeFinite,
    protocolSourceKills: nonNegativeInteger,
    protocolBonusFinisherKills: nonNegativeInteger,
    specialPresses: nonNegativeInteger,
    specialAccepted: nonNegativeInteger,
    specialRejectedByReason: rejectReasonCountsSchema,
    activeUseIntervalCount: nonNegativeInteger,
    activeUseIntervalSumSeconds: nonNegativeFinite,
    activeUseIntervalMaxSeconds: nonNegativeFinite,
    counters: z.record(z.string().min(1), nonNegativeFinite),
  })
  .strict();

const v3ExtensionSchema = z
  .object({
    schemaVersion: z.literal(RUN_RECORD_SCHEMA_VERSION_V3),
    rulesetProfileId: rulesetProfileIdSchema,
    rngVersion: rngVersionSchema,
    exProtocol: exProtocolRecordSchema.nullable(),
  })
  .passthrough();

export function decodeRunRecordV3(
  input: unknown,
): RunRecordV3DecodeResult {
  const extension = v3ExtensionSchema.safeParse(input);
  if (!extension.success) {
    return {
      ok: false,
      error: extension.error.issues[0]?.message ??
        "RunRecord v3 extension validation failed.",
    };
  }
  const base = runRecordV2Schema.safeParse({
    ...extension.data,
    schemaVersion: RUN_RECORD_SCHEMA_VERSION,
  });
  if (!base.success) {
    return {
      ok: false,
      error: base.error.issues[0]?.message ??
        "RunRecord v3 base validation failed.",
    };
  }

  const provenanceError = validateProvenance(
    base.data,
    extension.data.rulesetProfileId,
    extension.data.rngVersion,
  );
  if (provenanceError) return { ok: false, error: provenanceError };

  const exProtocol = extension.data.exProtocol
    ? validateExProtocolRecord(
        extension.data.exProtocol,
        base.data.weaponId,
      )
    : null;
  if (
    extension.data.exProtocol !== null &&
    typeof exProtocol === "string"
  ) {
    return { ok: false, error: exProtocol };
  }

  return {
    ok: true,
    record: {
      ...base.data,
      schemaVersion: RUN_RECORD_SCHEMA_VERSION_V3,
      rulesetProfileId: extension.data.rulesetProfileId,
      rngVersion: extension.data.rngVersion,
      exProtocol: exProtocol as ExProtocolRecordStats | null,
    },
  };
}

export function migrateRunRecordV2ToV3(
  record: RunRecordV2,
): RunRecordV3 {
  const profile = getRulesetProfiles().find(
    (candidate) =>
      candidate.modeId === record.modeId &&
      candidate.stageId === record.stageId &&
      candidate.rulesetVersion === record.rulesetVersion &&
      !candidate.features.exProtocols,
  );
  return {
    ...structuredClone(record),
    schemaVersion: RUN_RECORD_SCHEMA_VERSION_V3,
    rulesetProfileId: profile?.id ?? "legacy-unknown",
    rngVersion: profile?.randomStreamVersion ?? "legacy-unknown",
    exProtocol: null,
  };
}

function validateProvenance(
  record: RunRecordV2,
  rulesetProfileId: RunRecordRulesetProfileId,
  rngVersion: RunRecordRngVersion,
): string | null {
  if (rulesetProfileId === "legacy-unknown") {
    return rngVersion === "legacy-unknown"
      ? null
      : "legacy-unknown ruleset profile requires legacy-unknown RNG.";
  }
  const profile = getRulesetProfiles().find(
    (candidate) => candidate.id === rulesetProfileId,
  );
  if (!profile) return `Unknown ruleset profile "${rulesetProfileId}".`;
  if (
    profile.modeId !== record.modeId ||
    profile.stageId !== record.stageId ||
    profile.rulesetVersion !== record.rulesetVersion ||
    profile.randomStreamVersion !== rngVersion
  ) {
    return `Illegal RunRecord v3 ruleset tuple for "${rulesetProfileId}".`;
  }
  if (profile.rankPolicy === "none") {
    return `Ruleset profile "${rulesetProfileId}" must not create run records.`;
  }
  if (
    profile.rankPolicy === "non-standard" &&
    !record.rankEligibility.reasons.includes("nonStandardRuleset")
  ) {
    return `Ruleset profile "${rulesetProfileId}" requires non-standard rank eligibility.`;
  }
  return null;
}

function validateExProtocolRecord(
  value: z.infer<typeof exProtocolRecordSchema>,
  weaponId: RunRecordV2["weaponId"],
): ExProtocolRecordStats | string {
  const offeredIds = [];
  try {
    for (const id of value.offeredIds) {
      offeredIds.push(toExProtocolId(id));
    }
  } catch (error) {
    return getErrorMessage(error);
  }
  if (new Set(offeredIds).size !== offeredIds.length) {
    return "EX Protocol offered IDs must be unique.";
  }

  const selected = value.selectedId
    ? safeProtocolId(value.selectedId)
    : { ok: true as const, value: null };
  if (!selected.ok) return selected.error;
  const selectedId = selected.value;
  if (
    selectedId &&
    !offeredIds.includes(selectedId)
  ) {
    return "Selected EX Protocol must be present in offered IDs.";
  }
  const definition = selectedId
    ? getExProtocolDefinition(selectedId)
    : null;
  if (definition && definition.weaponId !== weaponId) {
    return `EX Protocol "${selectedId}" is incompatible with weapon "${weaponId}".`;
  }

  const evolutionOne = parseEvolution(
    selectedId,
    "evolutionOne",
    value.evolutionOneId,
  );
  if (!evolutionOne.ok) return evolutionOne.error;
  const evolutionOneId = evolutionOne.value;
  const evolutionTwo = parseEvolution(
    selectedId,
    "evolutionTwo",
    value.evolutionTwoId,
  );
  if (!evolutionTwo.ok) return evolutionTwo.error;
  const evolutionTwoId = evolutionTwo.value;

  if (evolutionTwoId && !evolutionOneId) {
    return "Evolution II requires Evolution I.";
  }
  if (value.masteryId && !evolutionTwoId) {
    return "Mastery requires Evolution II.";
  }
  if (
    value.masteryId &&
    definition?.mastery.id !== value.masteryId
  ) {
    return `Mastery "${value.masteryId}" does not belong to "${selectedId}".`;
  }
  if (
    Boolean(selectedId) !==
    (value.selectedAtElapsed !== null)
  ) {
    return "Selected EX Protocol and selection time must both be present.";
  }
  if (
    Boolean(evolutionOneId) !==
    (value.evolutionOneAtElapsed !== null)
  ) {
    return "Evolution I and selection time must both be present.";
  }
  if (
    Boolean(evolutionTwoId) !==
    (value.evolutionTwoAtElapsed !== null)
  ) {
    return "Evolution II and selection time must both be present.";
  }
  if (
    Boolean(value.masteryId) !==
    (value.masteryAtElapsed !== null)
  ) {
    return "Mastery and unlock time must both be present.";
  }
  if (
    value.evolutionTwoAtElapsed !== value.masteryAtElapsed &&
    value.masteryAtElapsed !== null
  ) {
    return "Mastery must unlock with Evolution II.";
  }
  const timeline = [
    value.selectedAtElapsed,
    value.evolutionOneAtElapsed,
    value.evolutionTwoAtElapsed,
    value.masteryAtElapsed,
    value.firstLimitBreakAtElapsed,
  ].filter((elapsed): elapsed is number => elapsed !== null);
  if (timeline.some((elapsed, index) =>
    index > 0 && elapsed < timeline[index - 1]!
  )) {
    return "EX Protocol progression elapsed values must be monotonic.";
  }
  if (value.specialAccepted > value.specialPresses) {
    return "Accepted EX special count cannot exceed presses.";
  }
  if (value.activeUseIntervalCount > Math.max(0, value.specialAccepted - 1)) {
    return "EX special interval count exceeds accepted uses.";
  }

  const counters = sanitizeExProtocolCounters(
    selectedId,
    value.counters,
  );
  if (
    Object.keys(counters).length !==
    Object.keys(value.counters).length
  ) {
    return "EX Protocol counters contain an unknown key.";
  }
  return {
    ...value,
    offeredIds,
    selectedId,
    evolutionOneId,
    evolutionTwoId,
    counters,
  };
}

function safeProtocolId(
  value: string,
):
  | { ok: true; value: ExProtocolId }
  | { ok: false; error: string } {
  try {
    return { ok: true, value: toExProtocolId(value) };
  } catch (error) {
    return { ok: false, error: getErrorMessage(error) };
  }
}

function parseEvolution(
  protocolId: ExProtocolId | null,
  tier: "evolutionOne" | "evolutionTwo",
  value: string | null,
) {
  if (!value) return { ok: true as const, value: null };
  if (!protocolId) {
    return {
      ok: false as const,
      error: `${tier} requires a selected EX Protocol.`,
    };
  }
  try {
    return {
      ok: true as const,
      value: toExProtocolEvolutionId(protocolId, tier, value),
    };
  } catch (error) {
    return {
      ok: false as const,
      error: getErrorMessage(error),
    };
  }
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export const EX_PROTOCOL_RECORD_CATALOG_VERSION =
  EX_PROTOCOL_CATALOG.catalogVersion;
