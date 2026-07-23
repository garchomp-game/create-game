import type { RandomStreamVersion } from "../math/random";

export const RULESET_PROFILE_IDS = [
  "legacy-endless-v068",
  "legacy-final-expedition-rc6",
  "legacy-training-v07",
  "candidate-ex-endless-c1",
  "candidate-ex-final-expedition-c1",
] as const;

export type RulesetProfileId = (typeof RULESET_PROFILE_IDS)[number];
export type RulesetRankPolicy = "standard" | "non-standard" | "none";

export type GameplayFeatureFlags = Readonly<{
  exProtocols: boolean;
}>;

export type RulesetProfile = Readonly<{
  id: RulesetProfileId;
  modeId: string;
  stageId: string;
  appVersion: string;
  rulesetVersion: string;
  randomStreamVersion: RandomStreamVersion;
  runRecordSchemaVersion: 2 | 3;
  rankPolicy: RulesetRankPolicy;
  features: GameplayFeatureFlags;
}>;
