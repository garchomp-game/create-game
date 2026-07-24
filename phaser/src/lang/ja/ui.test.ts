import { describe, expect, it } from "vitest";
import { uiText } from "./ui";

describe("Japanese Training copy", () => {
  it("keeps every briefing within the T1.2-C short-copy contract", () => {
    for (const [stepId, step] of Object.entries(uiText.trainingSteps)) {
      expect(
        step.briefing.split("\n").length,
        `${stepId} uses more than two briefing lines`,
      ).toBeLessThanOrEqual(2);
      expect(
        step.briefing.length,
        `${stepId} briefing is too long`,
      ).toBeLessThanOrEqual(40);
    }
  });
});
