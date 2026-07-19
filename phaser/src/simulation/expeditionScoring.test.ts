import { describe, expect, it } from "vitest";
import type { StageCompletionScoringDefinition } from "../domain/gameContent";
import {
  calculateExpeditionCompletionRewards,
  resolveExpeditionTimeMedal,
} from "./expeditionScoring";

const scoring: StageCompletionScoringDefinition = {
  clearBonus: 15_000,
  timeMedalSeconds: { gold: 540, silver: 600, bronze: 720 },
};

describe("expedition scoring", () => {
  it("derives stage medals from total run time at inclusive boundaries", () => {
    expect(resolveExpeditionTimeMedal(540, scoring.timeMedalSeconds)).toBe("gold");
    expect(resolveExpeditionTimeMedal(541, scoring.timeMedalSeconds)).toBe("silver");
    expect(resolveExpeditionTimeMedal(540.004, scoring.timeMedalSeconds)).toBe("gold");
    expect(resolveExpeditionTimeMedal(540.006, scoring.timeMedalSeconds)).toBe("silver");
    expect(resolveExpeditionTimeMedal(600, scoring.timeMedalSeconds)).toBe("silver");
    expect(resolveExpeditionTimeMedal(720, scoring.timeMedalSeconds)).toBe("bronze");
    expect(resolveExpeditionTimeMedal(721, scoring.timeMedalSeconds)).toBeNull();
  });

  it("never converts faster completion into tactical score points", () => {
    expect(calculateExpeditionCompletionRewards("victory", 400, scoring)).toEqual({
      clearScoreBonus: 15_000,
      timeScoreBonus: 0,
      timeMedal: "gold",
    });
    expect(calculateExpeditionCompletionRewards("victory", 700, scoring)).toEqual({
      clearScoreBonus: 15_000,
      timeScoreBonus: 0,
      timeMedal: "bronze",
    });
  });

  it("does not award a medal or completion points for a defeat", () => {
    expect(calculateExpeditionCompletionRewards("defeat", 100, scoring)).toEqual({
      clearScoreBonus: 0,
      timeScoreBonus: 0,
      timeMedal: null,
    });
  });
});
