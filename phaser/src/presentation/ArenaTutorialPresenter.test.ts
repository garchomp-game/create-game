import { describe, expect, it } from "vitest";
import type { TutorialSnapshot } from "../domain/tutorial";
import { createArenaTutorialViewModel } from "./ArenaTutorialPresenter";

describe("ArenaTutorialPresenter", () => {
  it("maps simulation progress to Japanese display text without Phaser", () => {
    const view = createArenaTutorialViewModel(makeSnapshot(), "playing");

    expect(view).toMatchObject({
      visible: true,
      eyebrow: "BASIC TRAINING  1/8",
      title: "移動",
      instruction: "WASD / 矢印キーで移動",
      hint: null,
      progress: "24 / 64px",
      target: null,
    });
  });

  it("reveals staged hints and a guide only after their thresholds", () => {
    const snapshot = makeSnapshot({
      stepId: "navigate",
      stepNumber: 2,
      hintLevel: 2,
      target: {
        kind: "zone",
        id: null,
        position: { x: 280, y: 110 },
        radius: 32,
      },
    });

    expect(createArenaTutorialViewModel(snapshot, "playing")).toMatchObject({
      visible: true,
      title: "進路変更",
      showGuideLine: true,
      target: { kind: "zone", position: { x: 280, y: 110 } },
    });
  });

  it("removes prompts from the transfer drill and menus", () => {
    expect(
      createArenaTutorialViewModel(
        makeSnapshot({ stepId: "transferDrill", stepNumber: 8 }),
        "playing",
      ),
    ).toMatchObject({ visible: false, target: null });
    expect(createArenaTutorialViewModel(makeSnapshot(), "paused")).toMatchObject({
      visible: false,
    });
    expect(
      createArenaTutorialViewModel(
        makeSnapshot({ stepId: "chooseUpgrade", stepNumber: 7 }),
        "upgradeSelect",
      ),
    ).toMatchObject({ visible: false });
  });
});

function makeSnapshot(
  overrides: Partial<TutorialSnapshot> = {},
): TutorialSnapshot {
  return {
    stepId: "move",
    stepNumber: 1,
    stepCount: 8,
    stepActiveSeconds: 0,
    totalActiveSeconds: 0,
    hintLevel: 0,
    progress: { current: 24, required: 64 },
    target: null,
    retryCount: 0,
    transfer: { survivalSeconds: 0, kills: 0, pickups: 0 },
    ...overrides,
  };
}
