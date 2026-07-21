import { expect, type Page, test } from "@playwright/test";
import type { TutorialStepId } from "../../src/domain/tutorial";

test.describe("basic Training", () => {
  test("completes through public inputs without changing local run data", async ({
    page,
  }) => {
    test.setTimeout(150_000);
    await gotoArena(page);
    await seedExistingRunRecord(page);
    const before = await readLocalState(page);

    await clickCanvasLogical(page, 480, 393);
    await expectTrainingStep(page, "move");
    await expect
      .poll(() => page.evaluate(() => window.__ARENA_DEBUG__?.getSnapshot().runContext))
      .toBeNull();
    expect(
      await page.evaluate(() => window.__ARENA_DEBUG__?.getSnapshot().seed),
    ).toBe(20260720);
    expect(
      await page.evaluate(() => window.__ARENA_DEBUG__?.getSnapshot().hp),
    ).toBe(60);

    await completeMoveStep(page);
    await expectTrainingStep(page, "navigate");
    await movePlayerAxisTo(page, "y", 110);
    await movePlayerAxisTo(page, "x", 280);
    await expectTrainingStep(page, "aimAndKill");

    await shootCurrentTutorialTarget(page);
    await expectTrainingStep(page, "collectXp");
    await moveToCurrentTutorialTarget(page);
    await expectTrainingStep(page, "dodgeProjectile");

    await holdKey(page, "KeyW", 700);
    await expectTrainingStep(page, "collectRepair", 20_000);
    await moveToCurrentTutorialTarget(page);
    await expectTrainingStep(page, "chooseUpgrade");

    await holdKey(page, "Digit1", 120);
    await expectTrainingStep(page, "transferDrill");
    expect(
      await page.evaluate(
        () => window.__ARENA_DEBUG__?.getSnapshot().pendingUpgradeChoices,
      ),
    ).toEqual([]);

    await shootToward(page, { x: 0, y: 270 }, 2_200);
    await shootToward(page, { x: 960, y: 270 }, 3_200);
    await movePlayerAxisTo(page, "y", 460);
    await expect
      .poll(
        () =>
          page.evaluate(
            () => window.__ARENA_DEBUG__?.getSnapshot().tutorial?.transfer.pickups,
          ),
        { timeout: 5_000 },
      )
      .toBeGreaterThanOrEqual(1);
    await movePlayerAxisTo(page, "y", 270);

    const aimPoints = [
      { x: 480, y: 0 },
      { x: 0, y: 270 },
      { x: 960, y: 270 },
      { x: 480, y: 540 },
    ];
    for (const point of aimPoints) {
      if ((await getTransferKills(page)) >= 2) break;
      await shootToward(page, point, 1_500);
    }
    await expect.poll(() => getTransferKills(page), { timeout: 5_000 }).toBeGreaterThanOrEqual(2);

    await finishTransferDrill(page);
    await expectTrainingStep(page, "complete");

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

    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("Enter");
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
    await holdKey(page, "KeyD", 250);
  }
  throw new Error("Movement task did not reach its distance guard.");
}

async function movePlayerAxisTo(
  page: Page,
  axis: "x" | "y",
  destination: number,
  tolerance = 16,
  whileStep?: TutorialStepId,
): Promise<void> {
  const deadline = Date.now() + 15_000;
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
    await holdKey(page, key, 70);
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

async function getTransferKills(page: Page): Promise<number> {
  return (
    (await page.evaluate(
      () => window.__ARENA_DEBUG__?.getSnapshot().tutorial?.transfer.kills,
    )) ?? 0
  );
}

async function finishTransferDrill(page: Page): Promise<void> {
  const movement = ["KeyA", "KeyW", "KeyD", "KeyS"];
  const aimPoints = [
    { x: 480, y: 0 },
    { x: 960, y: 270 },
    { x: 480, y: 540 },
    { x: 0, y: 270 },
  ];
  const deadline = Date.now() + 90_000;
  await page.keyboard.down("Space");
  try {
    for (let index = 0; Date.now() < deadline; index += 1) {
      const status = await page.evaluate(
        () => window.__ARENA_DEBUG__?.getSnapshot().status,
      );
      if (status === "trainingComplete") return;
      const aimPoint = aimPoints[index % aimPoints.length]!;
      await moveMouseLogical(page, aimPoint.x, aimPoint.y);
      await holdKey(page, movement[index % movement.length]!, 280);
    }
  } finally {
    await page.keyboard.up("Space");
  }
  throw new Error("Transfer drill did not complete through normal play.");
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
