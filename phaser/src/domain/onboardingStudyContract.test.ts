import { describe, expect, it } from "vitest";
import fullTrainingDefinition from "../../study/templates/STUDY_DEFINITION_FULL_TRAINING.example.json";
import { TUTORIAL_STEP_IDS } from "./tutorial";

describe("onboarding StudyLog contract", () => {
  it("keeps the full-training definition aligned with the current nine tasks", () => {
    const productTaskIds = TUTORIAL_STEP_IDS.filter(
      (stepId) => stepId !== "complete",
    );

    expect(fullTrainingDefinition.sessionKind).toBe("full-training");
    expect(fullTrainingDefinition.expectedStepIds).toEqual(productTaskIds);
    expect(fullTrainingDefinition.steps.map((step) => step.stepId)).toEqual(
      productTaskIds,
    );
    expect(new Set(fullTrainingDefinition.scenes.map((scene) => scene.sceneId))).toEqual(
      new Set(productTaskIds),
    );
  });
});
