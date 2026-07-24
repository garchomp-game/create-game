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
      instruction: "Dで右の光へ、次にAで左の光へ",
      hint: null,
      progress: "右 …   左 …",
      target: null,
      cueKind: "move",
      cueLabel: "Dで右へ",
      cueLevel: 0,
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
      instruction: "Dで右の光へ、次にAで左の光へ",
      actionLabel: "移動を始める",
      success: null,
      target: null,
      progress: null,
      cueKind: "move",
      cueLabel: "Dで右へ",
      cueLevel: 0,
    });
    expect(view?.briefing).toContain("Dで右へ");
  });

  it("emphasizes the immediate input cue at H1 without adding copy", () => {
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
      cueLabel: "Dで右へ",
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
      cueKind: "route",
      cueLabel: "光へ回り込む",
      cueLevel: 2,
      showGuideLine: true,
      targetLabel: "移動先",
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

  it("assigns a visual action cue to every guided task", () => {
    const expectations = [
      ["move", "move", "Dで右へ"],
      ["navigate", "route", "光へ回り込む"],
      ["contactDamage", "observe", "この課題は見るだけ"],
      ["aimAndKill", "aim", "止まった敵を狙う"],
      ["collectXp", "route", "近づいて取る"],
      ["chooseUpgrade", "upgrade", "1 / 2 / 3で選ぶ"],
      ["dodgeProjectile", "dodge", "上下へ避ける"],
      ["collectRepair", "route", "近づいて取る"],
      ["transferDrill", null, null],
    ] as const;

    for (const [stepId, cueKind, cueLabel] of expectations) {
      const stepNumber = expectations.findIndex(([id]) => id === stepId) + 1;
      expect(
        createArenaTutorialViewModel(
          makeSnapshot({ stepId, stepNumber }),
          "playing",
        ),
      ).toMatchObject({ cueKind, cueLabel });
    }
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
      cueKind: null,
      cueLabel: null,
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

  it("uses mission framing and fixed-skill copy for the Story flow", () => {
    expect(
      createArenaTutorialViewModel(
        makeSnapshot({
          flowKind: "story",
          missionNumber: 1,
          missionCount: 3,
          missionTitle: "機体起動",
          phase: "briefing",
        }),
        "trainingBriefing",
      ),
    ).toMatchObject({
      eyebrow: "STORY MISSION 1/3  機体起動",
      title: "機体起動",
      actionLabel: "機体を起動",
    });

    expect(
      createArenaTutorialViewModel(
        makeSnapshot({
          flowKind: "story",
          missionNumber: 2,
          missionCount: 3,
          missionTitle: "初回迎撃",
          stepId: "transferDrill",
          stepNumber: 7,
          stepCount: 10,
          phase: "briefing",
        }),
        "trainingBriefing",
      ),
    ).toMatchObject({
      title: "初回迎撃",
      briefing: "連射強化Iを固定装備します。\nこの作戦中は他の強化は発生しません。",
      actionLabel: "初回迎撃を開始",
    });
  });
});

function makeSnapshot(
  overrides: Partial<TutorialSnapshot> = {},
): TutorialSnapshot {
  return {
    flowKind: "basic-training",
    missionNumber: 1,
    missionCount: 1,
    missionTitle: "基本訓練",
    stepId: "move",
    phase: "active",
    stepNumber: 1,
    stepCount: 9,
    stepActiveSeconds: 0,
    totalActiveSeconds: 0,
    noProgressSeconds: 0,
    hintLevel: 0,
    progress: { current: 0, required: 2 },
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
