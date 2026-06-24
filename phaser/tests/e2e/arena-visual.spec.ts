import { expect, type Page, test } from "@playwright/test";

async function moveMouseToCanvasLogical(page: Page, logicalX: number, logicalY: number): Promise<void> {
  const canvas = page.locator("canvas");
  const box = await canvas.boundingBox();
  if (!box) {
    throw new Error("Canvas is not visible.");
  }
  const size = await canvas.evaluate((node: HTMLCanvasElement) => ({
    width: node.width,
    height: node.height,
  }));
  await page.mouse.move(
    box.x + (logicalX / size.width) * box.width,
    box.y + (logicalY / size.height) * box.height,
  );
}

test("matches the fixed title frame", async ({ page }) => {
  await page.goto("/");
  const canvas = page.locator("canvas");
  await expect(canvas).toHaveCount(1);

  await page.evaluate(() => {
    window.__ARENA_DEBUG__?.setPaused(true);
  });

  await expect(canvas).toHaveScreenshot("arena-title.png", {
    maxDiffPixelRatio: 0.01,
  });
});

test("matches the fixed initial arena frame", async ({ page }) => {
  await page.goto("/");
  const canvas = page.locator("canvas");
  await expect(canvas).toHaveCount(1);

  await page.evaluate(() => {
    window.__ARENA_DEBUG__?.restart();
    window.__ARENA_DEBUG__?.setPaused(true);
  });

  await expect(canvas).toHaveScreenshot("arena-initial.png", {
    maxDiffPixelRatio: 0.01,
  });
});

test("matches the fixed wave two HUD frame", async ({ page }) => {
  await page.goto("/");
  const canvas = page.locator("canvas");
  await expect(canvas).toHaveCount(1);

  await page.evaluate(() => {
    window.__ARENA_DEBUG__?.restart();
    window.__ARENA_DEBUG__?.setElapsed(31);
    window.__ARENA_DEBUG__?.setEnemyVisualFixture("wave2");
    window.__ARENA_DEBUG__?.setPaused(true);
  });

  await expect(canvas).toHaveScreenshot("arena-wave-two-hud.png", {
    maxDiffPixelRatio: 0.01,
  });
});

test("matches the fixed wave three HUD frame", async ({ page }) => {
  await page.goto("/");
  const canvas = page.locator("canvas");
  await expect(canvas).toHaveCount(1);

  await page.evaluate(() => {
    window.__ARENA_DEBUG__?.restart();
    window.__ARENA_DEBUG__?.setElapsed(61);
    window.__ARENA_DEBUG__?.setEnemyVisualFixture("wave3");
    window.__ARENA_DEBUG__?.setPaused(true);
  });

  await expect(canvas).toHaveScreenshot("arena-wave-three-hud.png", {
    maxDiffPixelRatio: 0.01,
  });
});

test("matches the fixed heal pickup fixture frame", async ({ page }) => {
  await page.goto("/");
  const canvas = page.locator("canvas");
  await expect(canvas).toHaveCount(1);

  await page.evaluate(() => {
    window.__ARENA_DEBUG__?.restart();
    window.__ARENA_DEBUG__?.setHealPickupFixture("visual");
    window.__ARENA_DEBUG__?.setPaused(true);
  });

  await expect(canvas).toHaveScreenshot("arena-heal-pickup.png", {
    maxDiffPixelRatio: 0.01,
  });
});

test("matches the fixed wave four HUD frame", async ({ page }) => {
  await page.goto("/");
  const canvas = page.locator("canvas");
  await expect(canvas).toHaveCount(1);

  await page.evaluate(() => {
    window.__ARENA_DEBUG__?.restart();
    window.__ARENA_DEBUG__?.setElapsed(91);
    window.__ARENA_DEBUG__?.setEnemyVisualFixture("wave3");
    window.__ARENA_DEBUG__?.setPaused(true);
  });

  await expect(canvas).toHaveScreenshot("arena-wave-four-hud.png", {
    maxDiffPixelRatio: 0.01,
  });
});

test("matches the fixed shooting frame", async ({ page }) => {
  await page.goto("/");
  const canvas = page.locator("canvas");
  await expect(canvas).toHaveCount(1);

  await page.evaluate(() => {
    window.__ARENA_DEBUG__?.restart();
    window.__ARENA_DEBUG__?.setPaused(true);
    window.__ARENA_DEBUG__?.step(
      {
        aimWorld: { x: 640, y: 270 },
        shootHeld: true,
      },
      1 / 60,
    );
  });

  await expect(canvas).toHaveScreenshot("arena-shooting.png", {
    maxDiffPixelRatio: 0.01,
  });
});

test("matches the fixed mouse aiming cursor frame", async ({ page }) => {
  await page.goto("/");
  const canvas = page.locator("canvas");
  await expect(canvas).toHaveCount(1);

  await page.evaluate(() => {
    window.__ARENA_DEBUG__?.restart();
    window.__ARENA_DEBUG__?.setPaused(true);
  });
  await moveMouseToCanvasLogical(page, 700, 300);

  await expect(canvas).toHaveScreenshot("arena-cursor-aim.png", {
    maxDiffPixelRatio: 0.01,
  });
});

test("matches the fixed game over frame", async ({ page }) => {
  await page.goto("/");
  const canvas = page.locator("canvas");
  await expect(canvas).toHaveCount(1);

  await page.evaluate(() => {
    window.__ARENA_DEBUG__?.restart();
    window.__ARENA_DEBUG__?.setPaused(true);
    window.__ARENA_DEBUG__?.forceGameOver();
  });

  await expect(canvas).toHaveScreenshot("arena-game-over.png", {
    maxDiffPixelRatio: 0.01,
  });
});

test("matches the fixed paused frame", async ({ page }) => {
  await page.goto("/");
  const canvas = page.locator("canvas");
  await expect(canvas).toHaveCount(1);

  await page.evaluate(() => {
    window.__ARENA_DEBUG__?.restart();
    window.__ARENA_DEBUG__?.step({ pausePressed: true }, 1 / 60);
  });

  await expect(canvas).toHaveScreenshot("arena-paused.png", {
    maxDiffPixelRatio: 0.01,
  });
});

test("matches the fixed upgrade selection frame", async ({ page }) => {
  await page.goto("/");
  const canvas = page.locator("canvas");
  await expect(canvas).toHaveCount(1);

  await page.evaluate(() => {
    window.__ARENA_DEBUG__?.restart();
    window.__ARENA_DEBUG__?.forceUpgradeSelect();
  });

  await expect(canvas).toHaveScreenshot("arena-upgrade-select.png", {
    maxDiffPixelRatio: 0.01,
  });
});
