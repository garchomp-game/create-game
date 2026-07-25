import { describe, expect, it } from "vitest";
import {
  APP_VERSION,
  ENDLESS_RULESET_VERSION,
  EX_PROTOCOL_CANDIDATE_APP_VERSION,
  EX_PROTOCOL_ENDLESS_RULESET_VERSION,
  RULESET_VERSION,
  UPGRADE_CATEGORY_FLOOR_CANDIDATE_APP_VERSION,
  UPGRADE_CATEGORY_FLOOR_ENDLESS_RULESET_VERSION,
  resolveBuildReleaseIdentity,
  resolveRunRulesetVersion,
} from "./version";

describe("resolveRunRulesetVersion", () => {
  it("preserves compatible Endless PBs while isolating Expedition RC6", () => {
    expect(resolveRunRulesetVersion("endless", "arena-default")).toBe(
      ENDLESS_RULESET_VERSION,
    );
    expect(resolveRunRulesetVersion("expedition", "final-expedition")).toBe(
      RULESET_VERSION,
    );
  });
});

describe("resolveBuildReleaseIdentity", () => {
  it("keeps the production identity when the candidate is disabled", () => {
    expect(resolveBuildReleaseIdentity(false)).toEqual({
      appVersion: APP_VERSION,
      rulesetVersion: RULESET_VERSION,
    });
  });

  it("publishes the candidate identity when EX Protocol is enabled", () => {
    expect(resolveBuildReleaseIdentity(true)).toEqual({
      appVersion: EX_PROTOCOL_CANDIDATE_APP_VERSION,
      rulesetVersion: EX_PROTOCOL_ENDLESS_RULESET_VERSION,
    });
  });

  it("gives the category-floor candidate its own release identity", () => {
    expect(resolveBuildReleaseIdentity(true, true)).toEqual({
      appVersion: UPGRADE_CATEGORY_FLOOR_CANDIDATE_APP_VERSION,
      rulesetVersion: UPGRADE_CATEGORY_FLOOR_ENDLESS_RULESET_VERSION,
    });
  });
});
