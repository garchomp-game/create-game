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
      features: { exProtocols: false, endlessContract: true },
    });
    expect(
      resolveRulesetProfile("expedition", "final-expedition"),
    ).toMatchObject({
      id: "legacy-final-expedition-rc6",
      features: { exProtocols: false, endlessContract: false },
    });
    expect(resolveRulesetProfile("training", "basic-training")).toMatchObject({
      id: "legacy-training-v07",
      rankPolicy: "none",
      features: { exProtocols: false, endlessContract: false },
    });
    expect(resolveRulesetProfile("practice", "practice-arena")).toMatchObject({
      id: "practice-sandbox-v08",
      rulesetVersion: "phaser-v0.8-practice-sandbox-v1",
      rankPolicy: "none",
      features: { exProtocols: false, endlessContract: false },
    });
  });

  it("resolves only closed candidate combinations", () => {
    expect(
      resolveRulesetProfile(
        "endless",
        "arena-default",
        "candidate-ex-endless-c2",
      ),
    ).toMatchObject({
      rulesetVersion: "phaser-v0.8-ex-protocols-c2",
      randomStreamVersion: "arena-rng-v2",
      runRecordSchemaVersion: 3,
      rankPolicy: "non-standard",
      features: { exProtocols: true, endlessContract: false },
    });
    expect(() =>
      resolveRulesetProfile(
        "training",
        "basic-training",
        "candidate-ex-endless-c2",
      ),
    ).toThrow(/not valid/);
    expect(getRulesetProfiles()).toHaveLength(9);
  });

  it("retains the candidate-one profile tuple for stored record decoding", () => {
    expect(
      resolveRulesetProfile(
        "endless",
        "arena-default",
        "candidate-ex-endless-c1",
      ),
    ).toMatchObject({
      appVersion: "0.8.0-candidate.1",
      rulesetVersion: "phaser-v0.8-ex-protocols-c1",
      features: { exProtocols: true, endlessContract: true },
    });
  });

  it("rejects forged profile IDs", () => {
    expect(() => parseRulesetProfileId("candidate-with-free-flags")).toThrow(
      /Unknown ruleset profile/,
    );
  });
});
