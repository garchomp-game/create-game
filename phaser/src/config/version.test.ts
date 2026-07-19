import { describe, expect, it } from "vitest";
import {
  ENDLESS_RULESET_VERSION,
  RULESET_VERSION,
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
