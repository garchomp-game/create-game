import { expect, type Page, test } from "@playwright/test";
import { HUD_LEFT_PANEL_BOUNDS } from "../../src/adapters/phaser/PhaserHudLayout";
import { TUTORIAL_TRANSFER_CHECKLIST_BOUNDS } from "../../src/adapters/phaser/PhaserTutorialLayer";
import { SIMULATION_CONFIG } from "../../src/config/gameConfig";
import type { TutorialStepId } from "../../src/domain/tutorial";

test.describe("Story onboarding", () => {
  test("completes through public inputs without changing local run data", async ({
    page,
  }) => {
    test.setTimeout(210_000);
    await gotoArena(page);
    await seedExistingRunRecord(page);
    const before = await readLocalState(page);

    await openStoryIntro(page);
    await expectTrainingStep(page, "move");
    await expect(page.locator(".arena-tutorial-dialog--visible")).toContainText(
      "Dで右へ",
    );
    const initialMovementCue = page.locator(
      "[data-tutorial-cue='move']",
    );
    await expect(initialMovementCue).toHaveAttribute(
      "aria-label",
      "Dで右へ",
    );
    await expect(initialMovementCue).toContainText("W");
    await expect(initialMovementCue).toContainText("↑");
    await expect(initialMovementCue).toContainText("A");
    await expect(initialMovementCue).toContainText("←");
    await expect(initialMovementCue).toContainText("S");
    await expect(initialMovementCue).toContainText("↓");
    await expect(initialMovementCue).toContainText("D");
    await expect(initialMovementCue).toContainText("→");
    await expect
      .poll(() => page.evaluate(() => window.__ARENA_DEBUG__?.getSnapshot().runContext))
      .toBeNull();
    expect(
      await page.evaluate(() => window.__ARENA_DEBUG__?.getSnapshot().seed),
    ).toBe(20260720);
    expect(
      await page.evaluate(() => window.__ARENA_DEBUG__?.getSnapshot().hp),
    ).toBe(100);

    await continueTutorial(page, "move");
    await completeMoveStep(page);
    await expectTrainingStep(page, "navigate");
    await continueTutorial(page, "navigate");
    const navigationTarget = await readTutorialTarget(page);
    expect(
      circleIntersectsRect(
        navigationTarget.position,
        navigationTarget.radius + 4,
        HUD_LEFT_PANEL_BOUNDS,
      ),
    ).toBe(false);
    await moveThroughCurrentTutorialGuidePath(page);
    await expectTrainingStep(page, "contactDamage");

    await continueTutorial(page, "contactDamage");
    const contactStart = await page.evaluate(() => {
      const snapshot = window.__ARENA_DEBUG__?.getSnapshot();
      return {
        player: snapshot?.player ?? null,
        shotsFired: snapshot?.stats.shotsFired ?? null,
      };
    });
    await page.keyboard.down("KeyD");
    await page.keyboard.down("Space");
    await page.waitForTimeout(400);
    await page.keyboard.up("Space");
    await page.keyboard.up("KeyD");
    const contactLocked = await page.evaluate(() => {
      const snapshot = window.__ARENA_DEBUG__?.getSnapshot();
      return {
        player: snapshot?.player ?? null,
        shotsFired: snapshot?.stats.shotsFired ?? null,
      };
    });
    expect(contactLocked).toEqual(contactStart);
    await expectTrainingStep(page, "aimAndKill", 10_000);
    await expect(page.locator(".arena-tutorial-dialog--visible")).toContainText(
      "敵本体への接触でもHPが減ります",
    );
    expect(
      await page.evaluate(() => window.__ARENA_DEBUG__?.getSnapshot().hp),
    ).toBeLessThan(100);

    await continueTutorial(page, "aimAndKill");
    expect(
      await page.evaluate(() => window.__ARENA_DEBUG__?.getSnapshot().hp),
    ).toBe(100);
    await shootCurrentTutorialTarget(page);
    await expectTrainingStep(page, "dodgeProjectile");
    expect(
      await page.evaluate(
        () => window.__ARENA_DEBUG__?.getSnapshot().upgradeRanks.rapidFire,
      ),
    ).toBe(0);

    await continueTutorial(page, "dodgeProjectile");
    await holdKey(page, "KeyW", 700);
    await expectTrainingStep(page, "collectRepair", 20_000);
    await continueTutorial(page, "collectRepair");
    const repairStart = await page.evaluate(() => {
      const snapshot = window.__ARENA_DEBUG__?.getSnapshot();
      const target = snapshot?.tutorial?.target;
      return target
        ? {
            distance: Math.hypot(
              target.position.x - snapshot.player.x,
              target.position.y - snapshot.player.y,
            ),
          }
        : null;
    });
    expect(repairStart).not.toBeNull();
    expect(repairStart!.distance).toBeGreaterThan(
      SIMULATION_CONFIG.pickup.magnetRadius,
    );
    await page.waitForTimeout(500);
    await expect
      .poll(() =>
        page.evaluate(() => {
          const tutorial = window.__ARENA_DEBUG__?.getSnapshot().tutorial;
          return tutorial?.stepId === "collectRepair" && tutorial.target !== null;
        }),
      )
      .toBe(true);
    await moveToCurrentTutorialTarget(page);
    await expectTrainingStep(page, "transferDrill");
    await expect(page.locator(".arena-tutorial-dialog--visible")).toContainText(
      "連射強化Iを固定装備",
    );
    await continueTutorial(page, "transferDrill");
    expect(
      await page.evaluate(() => {
        const snapshot = window.__ARENA_DEBUG__?.getSnapshot();
        const tutorial = snapshot?.tutorial;
        return tutorial
          ? {
              stepNumber: tutorial.stepNumber,
              stepCount: tutorial.stepCount,
              rapidFire: snapshot.upgradeRanks.rapidFire,
            }
          : null;
      }),
    ).toEqual({ stepNumber: 7, stepCount: 10, rapidFire: 1 });
    const transferRepairPosition = await page.evaluate(
      () =>
        window.__ARENA_DEBUG__?.getSnapshot().tutorial?.transfer.repairPosition ??
        null,
    );
    if (!transferRepairPosition) {
      throw new Error("Transfer recovery position is unavailable.");
    }
    expect(
      circleIntersectsRect(
        transferRepairPosition,
        SIMULATION_CONFIG.pickup.healRadius,
        TUTORIAL_TRANSFER_CHECKLIST_BOUNDS,
      ),
    ).toBe(false);
    expect(
      await page.evaluate(
        () => window.__ARENA_DEBUG__?.getSnapshot().pendingUpgradeChoices,
      ),
    ).toEqual([]);

    await shootCardinalDirections(page);
    await finishCombatDrill(page, "transferDrill");
    await expectTrainingStep(page, "collectXp");
    await continueTutorial(page, "collectXp");
    await moveToCurrentTutorialTarget(page);
    await expectTrainingStep(page, "chooseUpgrade");
    await expect(page.locator(".arena-tutorial-dialog--visible")).toContainText(
      "XPを回収しました",
    );

    await continueTutorial(page, "chooseUpgrade");
    await holdKey(page, "Escape", 120);
    await expect
      .poll(() => page.evaluate(() => window.__ARENA_DEBUG__?.getSnapshot().status))
      .toBe("paused");
    await clickCanvasLogical(page, 480, 305);
    await expect
      .poll(() => page.evaluate(() => window.__ARENA_DEBUG__?.getSnapshot().status))
      .toBe("upgradeSelect");
    await holdKey(page, "Digit1", 120);
    await expectTrainingStep(page, "deploymentDrill");
    await expect(page.locator(".arena-tutorial-dialog--visible")).toContainText(
      "強化を取得しました：",
    );
    await continueTutorial(page, "deploymentDrill");
    await shootCardinalDirections(page);
    await finishCombatDrill(page, "deploymentDrill");
    await expectTrainingStep(page, "complete");
    await expect(page.locator("canvas")).toBeVisible();
    await expect
      .poll(() => page.evaluate(() => window.__ARENA_DEBUG__?.getSnapshot().status))
      .toBe("trainingComplete");

    const after = await readLocalState(page);
    expect(after).toEqual(before);
    expect(
      await page.evaluate(() => window.__ARENA_DEBUG__?.getSnapshot().latestRunRecord),
    ).toBeNull();

    await holdKey(page, "Escape", 120);
    await expect
      .poll(() => page.evaluate(() => window.__ARENA_DEBUG__?.getSnapshot().status))
      .toBe("title");
    expect(await readLocalState(page)).toEqual(before);
  });

  test("supports keyboard entry, pause restart, title exit, and reload", async ({
    page,
  }) => {
    await gotoArena(page);
    await seedExistingRunRecord(page);
    const before = await readLocalState(page);

    await holdKey(page, "Enter", 120);
    await holdKey(page, "Enter", 120);
    await expectTrainingStep(page, "move");

    await holdKey(page, "KeyD", 180);
    await holdKey(page, "Escape", 120);
    await expect
      .poll(() => page.evaluate(() => window.__ARENA_DEBUG__?.getSnapshot().status))
      .toBe("paused");
    await clickCanvasLogical(page, 480, 357);
    await expectTrainingStep(page, "move");
    expect(
      await page.evaluate(
        () => window.__ARENA_DEBUG__?.getSnapshot().tutorial?.progress.current,
      ),
    ).toBe(0);

    await holdKey(page, "Escape", 120);
    await clickCanvasLogical(page, 480, 409);
    await expect
      .poll(() => page.evaluate(() => window.__ARENA_DEBUG__?.getSnapshot().status))
      .toBe("title");
    expect(await readLocalState(page)).toEqual(before);

    await page.reload();
    await expect
      .poll(() => page.evaluate(() => Boolean(window.__ARENA_DEBUG__)))
      .toBe(true);
    expect(await readLocalState(page)).toEqual(before);
  });
});

async function gotoArena(page: Page): Promise<void> {
  await page.goto("/");
  await expect
    .poll(() => page.evaluate(() => Boolean(window.__ARENA_DEBUG__)))
    .toBe(true);
  await expect
    .poll(() => page.evaluate(() => window.__ARENA_DEBUG__?.getSnapshot().status))
    .toBe("title");
}

async function openStoryIntro(page: Page): Promise<void> {
  await clickCanvasLogical(page, 480, 189);
  await expect
    .poll(() =>
      page.evaluate(() => window.__ARENA_DEBUG__?.getSnapshot().secondaryMenu),
    )
    .toBe("story");
  await clickCanvasLogical(page, 480, 217);
}

async function seedExistingRunRecord(page: Page): Promise<void> {
  await page.evaluate(() => {
    const debug = window.__ARENA_DEBUG__;
    const context = debug?.getSnapshot().runContext;
    const profile = debug?.getProfile();
    if (!context || !profile) throw new Error("Run context is not available.");
    const record = {
      schemaVersion: 1,
      id: "training-isolation-existing-run",
      profileId: profile.id,
      capturedAt: "2026-07-20T10:00:00.000Z",
      modeId: context.modeId,
      stageId: context.stageId,
      difficultyId: context.difficultyId,
      weaponId: "pulse",
      modifierIds: ["auto-fire:on"],
      appVersion: context.appVersion,
      rulesetVersion: context.rulesetVersion,
      buildCommit: context.buildCommit,
      seed: 20260720,
      seedCategory: context.seedCategory,
      runOrigin: "manual",
      rankEligibility: { eligible: true, reasons: [] },
      elapsed: 180,
      score: 8_000,
      level: 12,
      kills: 500,
      damageTaken: 320,
      lastDamageSource: {
        kind: "contact",
        enemyId: "enemy-existing",
        enemyType: "chaser",
      },
      shotsFired: 1_600,
      hpRecovered: 240,
      upgradesChosen: 11,
      upgradeRanks: {
        rapidFire: 4,
        swiftStep: 2,
        vitalCore: 1,
        overdriveRounds: 2,
        splitShot: 0,
        piercingRounds: 1,
      },
    };
    localStorage.setItem(
      "arena-core.run-records.v2",
      JSON.stringify({
        schemaVersion: 2,
        history: [record],
        rankings: [record],
      }),
    );
  });
  await page.reload();
  await expect
    .poll(() => page.evaluate(() => window.__ARENA_DEBUG__?.getRunHistory().length))
    .toBe(1);
  await expect
    .poll(() =>
      page.evaluate(() => window.__ARENA_DEBUG__?.getRunRankingRecords().length),
    )
    .toBe(1);
}

async function expectTrainingStep(
  page: Page,
  stepId: TutorialStepId,
  timeout = 5_000,
): Promise<void> {
  await expect
    .poll(
      () =>
        page.evaluate(
          () => window.__ARENA_DEBUG__?.getSnapshot().tutorial?.stepId,
        ),
      { timeout },
    )
    .toBe(stepId);
}

async function continueTutorial(
  page: Page,
  stepId: TutorialStepId,
): Promise<void> {
  const dialog = page.locator(
    `.arena-tutorial-dialog--visible[data-tutorial-step="${stepId}"]`,
  );
  await expect
    .poll(() =>
      page.evaluate(() => {
        const snapshot = window.__ARENA_DEBUG__?.getSnapshot();
        return {
          phase: snapshot?.tutorial?.phase,
          status: snapshot?.status,
        };
      }),
    )
    .toEqual({ phase: "briefing", status: "trainingBriefing" });
  await expect(dialog).toBeVisible();
  const panel = dialog.getByRole("dialog");
  await expect(panel).toHaveAttribute(
    "aria-describedby",
    /arena-tutorial-dialog-objective arena-tutorial-dialog-body(?: arena-tutorial-dialog-cue)?/,
  );
  const continueButton = dialog.locator("[data-tutorial-action='continue']");
  await expect(continueButton).toBeFocused();
  await continueButton.click();
  await expect
    .poll(() =>
      page.evaluate(() => window.__ARENA_DEBUG__?.getSnapshot().tutorial?.phase),
    )
    .toBe("active");
}

async function holdKey(page: Page, code: string, durationMs: number): Promise<void> {
  await page.keyboard.down(code);
  await page.waitForTimeout(durationMs);
  await page.keyboard.up(code);
}

async function completeMoveStep(page: Page): Promise<void> {
  const deadline = Date.now() + 15_000;
  while (Date.now() < deadline) {
    const stepId = await page.evaluate(
      () => window.__ARENA_DEBUG__?.getSnapshot().tutorial?.stepId,
    );
    if (stepId !== "move") return;
    await moveToCurrentTutorialTarget(page);
  }
  throw new Error("Movement task did not complete both directional targets.");
}

async function movePlayerAxisTo(
  page: Page,
  axis: "x" | "y",
  destination: number,
  tolerance = 16,
  whileStep?: TutorialStepId,
): Promise<void> {
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    const state = await page.evaluate(
      (selectedAxis) => {
        const snapshot = window.__ARENA_DEBUG__?.getSnapshot();
        return {
          coordinate: snapshot?.player[selectedAxis] ?? null,
          stepId: snapshot?.tutorial?.stepId ?? null,
        };
      },
      axis,
    );
    if (whileStep && state.stepId !== whileStep) return;
    if (state.coordinate === null) {
      throw new Error("Player read model is unavailable.");
    }
    const difference = destination - state.coordinate;
    if (Math.abs(difference) <= tolerance) return;
    const key =
      axis === "x"
        ? difference > 0
          ? "KeyD"
          : "KeyA"
        : difference > 0
          ? "KeyS"
          : "KeyW";
    const durationMs = Math.min(
      180,
      Math.max(32, Math.abs(difference) * 2.5),
    );
    await holdKey(page, key, durationMs);
  }
  throw new Error(`Player did not reach ${axis}=${destination}.`);
}

async function moveToCurrentTutorialTarget(page: Page): Promise<void> {
  const tutorial = await page.evaluate(
    () => window.__ARENA_DEBUG__?.getSnapshot().tutorial ?? null,
  );
  if (!tutorial?.target) throw new Error("Tutorial target is unavailable.");
  await movePlayerAxisTo(
    page,
    "y",
    tutorial.target.position.y,
    20,
    tutorial.stepId,
  );
  await movePlayerAxisTo(
    page,
    "x",
    tutorial.target.position.x,
    20,
    tutorial.stepId,
  );
}

async function readTutorialTarget(page: Page) {
  const target = await page.evaluate(
    () => window.__ARENA_DEBUG__?.getSnapshot().tutorial?.target ?? null,
  );
  if (!target) throw new Error("Tutorial target is unavailable.");
  return target;
}

async function moveThroughCurrentTutorialGuidePath(page: Page): Promise<void> {
  const target = await readTutorialTarget(page);
  for (const point of [...(target.guidePath ?? []), target.position]) {
    await movePlayerAxisTo(page, "y", point.y, 12, "navigate");
    await movePlayerAxisTo(page, "x", point.x, 12, "navigate");
  }
}

function circleIntersectsRect(
  center: { x: number; y: number },
  radius: number,
  rect: { x: number; y: number; width: number; height: number },
): boolean {
  const nearestX = Math.max(rect.x, Math.min(center.x, rect.x + rect.width));
  const nearestY = Math.max(rect.y, Math.min(center.y, rect.y + rect.height));
  return (center.x - nearestX) ** 2 + (center.y - nearestY) ** 2 <= radius ** 2;
}

async function shootCurrentTutorialTarget(page: Page): Promise<void> {
  await page.keyboard.down("Space");
  const deadline = Date.now() + 15_000;
  try {
    while (Date.now() < deadline) {
      const snapshot = await page.evaluate(() => window.__ARENA_DEBUG__?.getSnapshot());
      if (snapshot?.tutorial?.stepId !== "aimAndKill") return;
      const target = snapshot?.tutorial?.target?.position;
      if (!target) throw new Error("Enemy tutorial target is unavailable.");
      await moveMouseLogical(page, target.x, target.y);
      await page.waitForTimeout(80);
    }
  } finally {
    await page.keyboard.up("Space");
  }
  throw new Error("Training enemy was not defeated.");
}

async function shootToward(
  page: Page,
  point: { x: number; y: number },
  durationMs: number,
): Promise<void> {
  await moveMouseLogical(page, point.x, point.y);
  await holdKey(page, "Space", durationMs);
}

async function shootCardinalDirections(page: Page): Promise<void> {
  for (const point of [
    { x: 480, y: 0 },
    { x: 0, y: 270 },
    { x: 960, y: 270 },
    { x: 480, y: 540 },
  ]) {
    await shootToward(page, point, 1_500);
  }
}

async function finishCombatDrill(
  page: Page,
  stepId: "transferDrill" | "deploymentDrill",
): Promise<void> {
  const patrolPoints = [
    { x: 480, y: 270 },
    { x: 120, y: 270 },
    { x: 480, y: 270 },
    { x: 120, y: 110 },
    { x: 480, y: 270 },
    { x: 480, y: 110 },
    { x: 480, y: 270 },
    { x: 840, y: 110 },
    { x: 480, y: 270 },
    { x: 840, y: 270 },
    { x: 480, y: 270 },
    { x: 840, y: 440 },
    { x: 480, y: 270 },
    { x: 480, y: 440 },
    { x: 480, y: 270 },
    { x: 120, y: 440 },
  ];
  const deadline = Date.now() + 90_000;
  await page.keyboard.down("Space");
  try {
    for (let index = 0; Date.now() < deadline; index += 1) {
      const currentStep = await page.evaluate(
        () => window.__ARENA_DEBUG__?.getSnapshot().tutorial?.stepId,
      );
      if (currentStep !== stepId) return;
      const point = patrolPoints[index % patrolPoints.length]!;
      await moveMouseLogical(page, 480, 270);
      await movePlayerAxisTo(page, "y", point.y, 24, stepId);
      await movePlayerAxisTo(page, "x", point.x, 28, stepId);
    }
  } finally {
    await page.keyboard.up("Space");
  }
  throw new Error(`${stepId} did not complete through normal play.`);
}

async function moveMouseLogical(page: Page, x: number, y: number): Promise<void> {
  const box = await getCanvasBox(page);
  await page.mouse.move(
    box.left + (x / box.canvasWidth) * box.width,
    box.top + (y / box.canvasHeight) * box.height,
  );
}

async function clickCanvasLogical(page: Page, x: number, y: number): Promise<void> {
  const box = await getCanvasBox(page);
  await page.mouse.click(
    box.left + (x / box.canvasWidth) * box.width,
    box.top + (y / box.canvasHeight) * box.height,
  );
}

async function getCanvasBox(page: Page) {
  return page.locator("canvas").evaluate((node) => {
    const canvas = node as HTMLCanvasElement;
    const rect = canvas.getBoundingClientRect();
    return {
      left: rect.left,
      top: rect.top,
      width: rect.width,
      height: rect.height,
      canvasWidth: canvas.width,
      canvasHeight: canvas.height,
    };
  });
}

async function readLocalState(page: Page) {
  return page.evaluate(() => {
    const debug = window.__ARENA_DEBUG__;
    if (!debug) throw new Error("Arena read model is unavailable.");
    return {
      history: debug.getRunHistory(),
      rankings: debug.getRunRankingRecords(),
      profile: debug.getProfile(),
      settings: debug.getSettings(),
    };
  });
}
