import { expect, type Page, test } from "@playwright/test";

test.describe("outcome feedback candidate", () => {
  test.skip(
    process.env.VITE_ARENA_OUTCOME_FEEDBACK_CANDIDATE !== "1",
    "Runs only for the preregistered outcome-feedback candidate.",
  );

  test("shows factual defeat feedback and retries the same random seed as fixed", async ({
    page,
  }) => {
    await gotoArena(page);
    await page.evaluate(() => window.__ARENA_DEBUG__?.restart());

    const original = await page.evaluate(
      () => window.__ARENA_DEBUG__?.getSnapshot().runContext,
    );
    expect(original).toMatchObject({
      modeId: "endless",
      stageId: "arena-default",
      difficultyId: "standard",
      weaponId: "pulse",
      seedCategory: "random",
    });

    await page.evaluate(() => window.__ARENA_DEBUG__?.forceDamage(100));
    await expect
      .poll(() =>
        page.evaluate(() => window.__ARENA_DEBUG__?.getSnapshot().status),
      )
      .toBe("gameOver");

    const defeated = await page.evaluate(
      () => window.__ARENA_DEBUG__?.getSnapshot(),
    );
    expect(defeated?.runOutcomeInsight).toMatchObject({
      state: "available",
      primaryCause: {
        title: "複合した終盤圧力",
        evidence: "終了前5秒に100ダメージ（1回）",
      },
      nextAction: {
        title: "終了前5秒の位置と優先標的を見直す",
      },
      nearMiss: {
        state: "not-reached",
        reason: "bossNotReached",
      },
    });
    await expect(page.locator("canvas")).toHaveScreenshot(
      "arena-outcome-feedback-defeat.png",
      { maxDiffPixelRatio: 0.01 },
    );

    await clickCanvasAt(page, 480, 367);
    await expect
      .poll(() =>
        page.evaluate(() => window.__ARENA_DEBUG__?.getSnapshot().status),
      )
      .toBe("playing");

    const retried = await page.evaluate(
      () => window.__ARENA_DEBUG__?.getSnapshot().runContext,
    );
    expect(retried).toMatchObject({
      modeId: original?.modeId,
      stageId: original?.stageId,
      difficultyId: original?.difficultyId,
      weaponId: original?.weaponId,
      rulesetVersion: original?.rulesetVersion,
      rulesetProfileId: original?.rulesetProfileId,
      seed: original?.seed,
      seedCategory: "fixed",
    });
    expect(retried?.id).not.toBe(original?.id);
    expect(retried?.modifierIds).toEqual(original?.modifierIds);
  });
});

async function gotoArena(page: Page): Promise<void> {
  await page.goto("/");
  await expect
    .poll(() => page.evaluate(() => Boolean(window.__ARENA_DEBUG__)))
    .toBe(true);
}

async function clickCanvasAt(
  page: Page,
  x: number,
  y: number,
): Promise<void> {
  const box = await page.locator("canvas").evaluate((node) => {
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
  await page.mouse.click(
    box.left + (x / box.canvasWidth) * box.width,
    box.top + (y / box.canvasHeight) * box.height,
  );
}
