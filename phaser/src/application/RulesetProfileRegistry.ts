import {
  APP_VERSION,
  BASIC_TRAINING_STAGE_ID,
  DEFAULT_MODE_ID,
  DEFAULT_STAGE_ID,
  ENDLESS_RULESET_VERSION,
  EX_PROTOCOL_CANDIDATE_APP_VERSION,
  EX_PROTOCOL_ENDLESS_RULESET_VERSION,
  EX_PROTOCOL_FINAL_RULESET_VERSION,
  EXPEDITION_MODE_ID,
  FINAL_EXPEDITION_STAGE_ID,
  RULESET_VERSION,
  TRAINING_MODE_ID,
} from "../config/version";
import {
  RULESET_PROFILE_IDS,
  type RulesetProfile,
  type RulesetProfileId,
} from "../domain/ruleset";
import {
  RANDOM_STREAM_VERSION,
  RANDOM_STREAM_VERSION_V2,
} from "../math/random";

const RULESET_PROFILES = [
  {
    id: "legacy-endless-v068",
    modeId: DEFAULT_MODE_ID,
    stageId: DEFAULT_STAGE_ID,
    appVersion: APP_VERSION,
    rulesetVersion: ENDLESS_RULESET_VERSION,
    randomStreamVersion: RANDOM_STREAM_VERSION,
    runRecordSchemaVersion: 2,
    rankPolicy: "standard",
    features: { exProtocols: false },
  },
  {
    id: "legacy-final-expedition-rc6",
    modeId: EXPEDITION_MODE_ID,
    stageId: FINAL_EXPEDITION_STAGE_ID,
    appVersion: APP_VERSION,
    rulesetVersion: RULESET_VERSION,
    randomStreamVersion: RANDOM_STREAM_VERSION,
    runRecordSchemaVersion: 2,
    rankPolicy: "standard",
    features: { exProtocols: false },
  },
  {
    id: "legacy-training-v07",
    modeId: TRAINING_MODE_ID,
    stageId: BASIC_TRAINING_STAGE_ID,
    appVersion: APP_VERSION,
    rulesetVersion: RULESET_VERSION,
    randomStreamVersion: RANDOM_STREAM_VERSION,
    runRecordSchemaVersion: 2,
    rankPolicy: "none",
    features: { exProtocols: false },
  },
  {
    id: "candidate-ex-endless-c1",
    modeId: DEFAULT_MODE_ID,
    stageId: DEFAULT_STAGE_ID,
    appVersion: EX_PROTOCOL_CANDIDATE_APP_VERSION,
    rulesetVersion: EX_PROTOCOL_ENDLESS_RULESET_VERSION,
    randomStreamVersion: RANDOM_STREAM_VERSION_V2,
    runRecordSchemaVersion: 3,
    rankPolicy: "non-standard",
    features: { exProtocols: true },
  },
  {
    id: "candidate-ex-final-expedition-c1",
    modeId: EXPEDITION_MODE_ID,
    stageId: FINAL_EXPEDITION_STAGE_ID,
    appVersion: EX_PROTOCOL_CANDIDATE_APP_VERSION,
    rulesetVersion: EX_PROTOCOL_FINAL_RULESET_VERSION,
    randomStreamVersion: RANDOM_STREAM_VERSION_V2,
    runRecordSchemaVersion: 3,
    rankPolicy: "non-standard",
    features: { exProtocols: true },
  },
] as const satisfies readonly RulesetProfile[];

const PROFILE_BY_ID = new Map<RulesetProfileId, RulesetProfile>(
  RULESET_PROFILES.map((profile) => [
    profile.id,
    Object.freeze({
      ...profile,
      features: Object.freeze({ ...profile.features }),
    }),
  ]),
);

export function resolveRulesetProfile(
  modeId: string,
  stageId: string,
  requestedProfileId?: RulesetProfileId,
): RulesetProfile {
  const profile = requestedProfileId
    ? PROFILE_BY_ID.get(requestedProfileId)
    : RULESET_PROFILES.find(
        (candidate) =>
          candidate.modeId === modeId &&
          candidate.stageId === stageId &&
          !candidate.features.exProtocols,
      );
  if (!profile) {
    throw new Error(
      requestedProfileId
        ? `Unknown ruleset profile "${requestedProfileId}".`
        : `No default ruleset profile for "${modeId}/${stageId}".`,
    );
  }
  if (profile.modeId !== modeId || profile.stageId !== stageId) {
    throw new Error(
      `Ruleset profile "${profile.id}" is not valid for "${modeId}/${stageId}".`,
    );
  }
  return profile;
}

export function parseRulesetProfileId(
  input: string,
): RulesetProfileId {
  if (!RULESET_PROFILE_IDS.includes(input as RulesetProfileId)) {
    throw new Error(`Unknown ruleset profile "${input}".`);
  }
  return input as RulesetProfileId;
}

export function getRulesetProfiles(): readonly RulesetProfile[] {
  return RULESET_PROFILES;
}

export function resolveExProtocolCandidateProfileId(
  modeId: string,
  stageId: string,
): RulesetProfileId | undefined {
  if (modeId === DEFAULT_MODE_ID && stageId === DEFAULT_STAGE_ID) {
    return "candidate-ex-endless-c1";
  }
  if (
    modeId === EXPEDITION_MODE_ID &&
    stageId === FINAL_EXPEDITION_STAGE_ID
  ) {
    return "candidate-ex-final-expedition-c1";
  }
  return undefined;
}
