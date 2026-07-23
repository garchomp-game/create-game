import { describe, expect, it } from "vitest";
import {
  getRulesetProfiles,
  parseRulesetProfileId,
  resolveRulesetProfile,
} from "./RulesetProfileRegistry";

describe("RulesetProfileRegistry", () => {
  it("defaults every current mode to a flag-off legacy profile", () => {
    expect(resolveRulesetProfile("endless", "arena-default")).toMatchObject({
      id: "legacy-endless-v068",
      randomStreamVersion: "arena-rng-v1",
      runRecordSchemaVersion: 2,
      rankPolicy: "standard",
      features: { exProtocols: false },
    });
    expect(
      resolveRulesetProfile("expedition", "final-expedition"),
    ).toMatchObject({
      id: "legacy-final-expedition-rc6",
      features: { exProtocols: false },
    });
    expect(resolveRulesetProfile("training", "basic-training")).toMatchObject({
      id: "legacy-training-v07",
      rankPolicy: "none",
      features: { exProtocols: false },
    });
  });

  it("resolves only closed candidate combinations", () => {
    expect(
      resolveRulesetProfile(
        "endless",
        "arena-default",
        "candidate-ex-endless-c1",
      ),
    ).toMatchObject({
      rulesetVersion: "phaser-v0.8-ex-protocols-c1",
      randomStreamVersion: "arena-rng-v2",
      runRecordSchemaVersion: 3,
      rankPolicy: "non-standard",
      features: { exProtocols: true },
    });
    expect(() =>
      resolveRulesetProfile(
        "training",
        "basic-training",
        "candidate-ex-endless-c1",
      ),
    ).toThrow(/not valid/);
    expect(getRulesetProfiles()).toHaveLength(5);
  });

  it("rejects forged profile IDs", () => {
    expect(() => parseRulesetProfileId("candidate-with-free-flags")).toThrow(
      /Unknown ruleset profile/,
    );
  });
});
