import { describe, expect, it } from "vitest";
import type { TutorialSnapshot } from "../domain/tutorial";
import { createArenaTutorialViewModel } from "./ArenaTutorialPresenter";

describe("ArenaTutorialPresenter", () => {
  it("maps simulation progress to Japanese display text without Phaser", () => {
    const view = createArenaTutorialViewModel(makeSnapshot(), "playing");

    expect(view).toMatchObject({
      visible: true,
      presentation: "hud",
      eyebrow: "BASIC TRAINING  1/9",
      title: "移動",
      instruction: "WASD / 矢印キーで移動",
      hint: null,
      progress: "24 / 64px",
      target: null,
    });
  });

  it("presents a blocking briefing before each practice task", () => {
    const view = createArenaTutorialViewModel(
      makeSnapshot({ phase: "briefing" }),
      "trainingBriefing",
    );

    expect(view).toMatchObject({
      visible: true,
      presentation: "briefing",
      title: "移動",
      instruction: "WASD / 矢印キーで移動",
      actionLabel: "移動を始める",
      success: null,
      target: null,
      progress: null,
    });
    expect(view?.briefing).toContain("キーを押して自機を動かします");
  });

  it("uses an input cue for H1 without adding copy", () => {
    const view = createArenaTutorialViewModel(
      makeSnapshot({
        hintLevel: 1,
        noProgressSeconds: 5,
      }),
      "playing",
    );

    expect(view).toMatchObject({
      hint: null,
      cueKind: "move",
      cueLevel: 1,
      showGuideLine: false,
    });
  });

  it("reveals concrete copy and a guide only at H2", () => {
    const snapshot = makeSnapshot({
      stepId: "navigate",
      stepNumber: 2,
      hintLevel: 2,
      noProgressSeconds: 10,
      target: {
        kind: "zone",
        id: null,
        position: { x: 400, y: 166 },
        radius: 32,
        guidePath: [
          { x: 190, y: 116 },
          { x: 370, y: 116 },
        ],
      },
    });

    expect(createArenaTutorialViewModel(snapshot, "playing")).toMatchObject({
      visible: true,
      title: "進路変更",
      hint: "折れ線を目安に、壁の外側へ回り込んでください",
      cueKind: "move",
      cueLevel: 2,
      showGuideLine: true,
      target: {
        kind: "zone",
        position: { x: 400, y: 166 },
        guidePath: [
          { x: 190, y: 116 },
          { x: 370, y: 116 },
        ],
      },
    });
  });

  it("keeps transfer objectives visible but removes prompts from menus", () => {
    expect(
      createArenaTutorialViewModel(
        makeSnapshot({
          stepId: "transferDrill",
          stepNumber: 9,
          transfer: {
            survivalSeconds: 7.9,
            kills: 1,
            pickups: 0,
            spawnedPickups: 2,
            requiredKills: 3,
            enemiesRemaining: 2,
            pickupsRemaining: 2,
            repairPosition: { x: 480, y: 420 },
          },
        }),
        "playing",
      ),
    ).toMatchObject({
      visible: true,
      eyebrow: "BASIC TRAINING  9/9",
      title: "総合演習",
      progress: "敵 残り2体   取得物 残り2個",
      target: null,
      showGuideLine: false,
      panelKind: "checklist",
    });
    expect(createArenaTutorialViewModel(makeSnapshot(), "paused")).toMatchObject({
      visible: false,
    });
    expect(
      createArenaTutorialViewModel(
        makeSnapshot({ stepId: "chooseUpgrade", stepNumber: 6 }),
        "upgradeSelect",
      ),
    ).toMatchObject({ visible: false });
  });

  it("shows task success and selected upgrade details in the next briefing", () => {
    expect(
      createArenaTutorialViewModel(
        makeSnapshot({
          stepId: "dodgeProjectile",
          stepNumber: 7,
          phase: "briefing",
          lastCompletedStepId: "chooseUpgrade",
          selectedUpgradeId: "swiftStep",
        }),
        "trainingBriefing",
      ),
    ).toMatchObject({
      success: "✓ 強化を取得しました：軽快な足取り\n移動速度を12%上昇",
    });
  });

  it("keeps retry feedback separate from task progress", () => {
    expect(
      createArenaTutorialViewModel(
        makeSnapshot({
          stepId: "dodgeProjectile",
          stepNumber: 7,
          retryCount: 1,
          retryReason: "enemyProjectile",
          retryNoticeSecondsRemaining: 1.4,
          progress: { current: 0, required: 2 },
        }),
        "playing",
      ),
    ).toMatchObject({
      progress: "0 / 2",
      notice: "敵弾に当たりました\n回避 0/2から再開します",
    });
  });
});

function makeSnapshot(
  overrides: Partial<TutorialSnapshot> = {},
): TutorialSnapshot {
  return {
    stepId: "move",
    phase: "active",
    stepNumber: 1,
    stepCount: 9,
    stepActiveSeconds: 0,
    totalActiveSeconds: 0,
    noProgressSeconds: 0,
    hintLevel: 0,
    progress: { current: 24, required: 64 },
    target: null,
    lastCompletedStepId: null,
    selectedUpgradeId: null,
    retryCount: 0,
    retryReason: null,
    retryNoticeSecondsRemaining: 0,
    readySecondsRemaining: 0,
    transfer: {
      survivalSeconds: 0,
      kills: 0,
      pickups: 0,
      spawnedPickups: 1,
      requiredKills: 3,
      enemiesRemaining: 3,
      pickupsRemaining: 1,
      repairPosition: { x: 480, y: 420 },
    },
    ...overrides,
  };
}
