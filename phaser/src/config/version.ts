export const APP_VERSION = "0.7.0";
export const EX_PROTOCOL_CANDIDATE_APP_VERSION = "0.8.0-candidate.1";
export const RULESET_VERSION = "phaser-v0.7.0-final-expedition-rc6";
export const ENDLESS_RULESET_VERSION = "phaser-v0.6.8-pulse-boundary-ricochet";
export const EX_PROTOCOL_ENDLESS_RULESET_VERSION =
  "phaser-v0.8-ex-protocols-c1";
export const EX_PROTOCOL_FINAL_RULESET_VERSION =
  "phaser-v0.8-final-expedition-ex-protocols-c1";
export const RELEASE_CHANNEL_LABEL = "技術プレビュー";
export const DEFAULT_MODE_ID = "endless";
export const DEFAULT_STAGE_ID = "arena-default";
export const EXPEDITION_MODE_ID = "expedition";
export const FINAL_EXPEDITION_STAGE_ID = "final-expedition";
export const TRAINING_MODE_ID = "training";
export const BASIC_TRAINING_STAGE_ID = "basic-training";
export const DEFAULT_DIFFICULTY_ID = "standard";

export function resolveRunRulesetVersion(modeId: string, stageId: string): string {
  if (modeId === DEFAULT_MODE_ID && stageId === DEFAULT_STAGE_ID) {
    return ENDLESS_RULESET_VERSION;
  }
  return RULESET_VERSION;
}
