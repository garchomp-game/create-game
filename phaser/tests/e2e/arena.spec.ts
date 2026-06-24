import { expect, type Page, test } from "@playwright/test";

async function clickCanvasAt(page: Page, x: number, y: number): Promise<void> {
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

test("renders canvas and accepts movement and shooting input", async ({ page }) => {
  const consoleErrors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") {
      consoleErrors.push(message.text());
    }
  });

  await page.goto("/");
  const canvas = page.locator("canvas");
  await expect(canvas).toHaveCount(1);

  await expect
    .poll(async () => canvas.evaluate((node) => (node as HTMLCanvasElement).width))
    .toBe(960);

  const nonBackgroundSamples = await canvas.evaluate((node) => {
    const canvasElement = node as HTMLCanvasElement;
    const context = canvasElement.getContext("2d");
    if (!context) return 0;
    const image = context.getImageData(0, 0, canvasElement.width, canvasElement.height);
    let samples = 0;
    for (let i = 0; i < image.data.length; i += 4 * 257) {
      const r = image.data[i];
      const g = image.data[i + 1];
      const b = image.data[i + 2];
      if (r !== 17 || g !== 19 || b !== 24) {
        samples += 1;
      }
    }
    return samples;
  });
  expect(nonBackgroundSamples).toBeGreaterThan(0);

  await expect.poll(() => page.evaluate(() => window.__ARENA_DEBUG__?.getSnapshot().status)).toBe(
    "title",
  );

  await clickCanvasAt(page, 480, 368);
  await expect.poll(() => page.evaluate(() => window.__ARENA_DEBUG__?.getSnapshot().status)).toBe(
    "playing",
  );

  await page.evaluate(() => {
    window.__ARENA_DEBUG__?.restart();
    window.__ARENA_DEBUG__?.setPaused(true);
  });

  const beforeMove = await page.evaluate(() => window.__ARENA_DEBUG__?.getSnapshot());
  expect(beforeMove).toBeTruthy();
  expect(beforeMove?.lastAim).toEqual({ x: 1, y: 0 });

  await page.evaluate(() => window.__ARENA_DEBUG__?.setPaused(false));
  await canvas.click();

  await page.keyboard.down("KeyD");
  await page.waitForTimeout(180);
  await page.keyboard.up("KeyD");

  const afterMove = await page.evaluate(() => window.__ARENA_DEBUG__?.getSnapshot());
  expect(afterMove?.player.x).toBeGreaterThan(beforeMove!.player.x);

  await page.keyboard.down("Space");
  await page.waitForTimeout(120);
  await page.keyboard.up("Space");
  await expect.poll(() => page.evaluate(() => window.__ARENA_DEBUG__?.getSnapshot().bulletCount))
    .toBeGreaterThan(0);
  await expect
    .poll(() =>
      page.evaluate(() => window.__ARENA_DEBUG__?.getSnapshot().audioCues.includes("shot")),
    )
    .toBe(true);

  expect(consoleErrors).toEqual([]);
});

test("can force game over and restart with R", async ({ page }) => {
  await page.goto("/");
  const canvas = page.locator("canvas");
  await expect(canvas).toHaveCount(1);
  await page.evaluate(() => window.__ARENA_DEBUG__?.restart());

  await page.evaluate(() => window.__ARENA_DEBUG__?.forceGameOver());
  await expect.poll(() => page.evaluate(() => window.__ARENA_DEBUG__?.getSnapshot().status)).toBe(
    "gameOver",
  );
  await expect
    .poll(() => page.evaluate(() => window.__ARENA_DEBUG__?.getSnapshot().resultSummary.score))
    .toBe(0);
  await expect
    .poll(() =>
      page.evaluate(() =>
        window.__ARENA_DEBUG__?.getSnapshot().lastEvents.some((event) => event.type === "game.over"),
      ),
    )
    .toBe(true);

  await clickCanvasAt(page, 480, 406);
  await expect.poll(() => page.evaluate(() => window.__ARENA_DEBUG__?.getSnapshot().status)).toBe(
    "playing",
  );
  await expect.poll(() => page.evaluate(() => window.__ARENA_DEBUG__?.getSnapshot().hp)).toBe(100);
  await expect
    .poll(() => page.evaluate(() => window.__ARENA_DEBUG__?.getSnapshot().stats.shotsFired))
    .toBe(0);

  await page.evaluate(() => window.__ARENA_DEBUG__?.forceGameOver());
  await expect.poll(() => page.evaluate(() => window.__ARENA_DEBUG__?.getSnapshot().status)).toBe(
    "gameOver",
  );
  await clickCanvasAt(page, 480, 458);
  await expect.poll(() => page.evaluate(() => window.__ARENA_DEBUG__?.getSnapshot().status)).toBe(
    "title",
  );
});

test("can pause and resume with P without advancing simulation", async ({ page }) => {
  await page.goto("/");
  const canvas = page.locator("canvas");
  await expect(canvas).toHaveCount(1);
  await canvas.click();

  await page.evaluate(() => window.__ARENA_DEBUG__?.restart());

  await page.keyboard.down("KeyP");
  await page.waitForTimeout(120);
  await page.keyboard.up("KeyP");
  await expect.poll(() => page.evaluate(() => window.__ARENA_DEBUG__?.getSnapshot().status)).toBe(
    "paused",
  );
  const pausedBaseline = await page.evaluate(() => window.__ARENA_DEBUG__?.getSnapshot());

  await page.keyboard.down("KeyD");
  await page.keyboard.down("Space");
  await page.waitForTimeout(180);
  await page.keyboard.up("Space");
  await page.keyboard.up("KeyD");

  const duringPause = await page.evaluate(() => window.__ARENA_DEBUG__?.getSnapshot());
  expect(duringPause?.elapsed).toBe(pausedBaseline?.elapsed);
  expect(duringPause?.player).toEqual(pausedBaseline?.player);
  expect(duringPause?.bulletCount).toBe(pausedBaseline?.bulletCount);

  await clickCanvasAt(page, 480, 306);
  await expect.poll(() => page.evaluate(() => window.__ARENA_DEBUG__?.getSnapshot().status)).toBe(
    "playing",
  );

  await page.keyboard.down("KeyP");
  await page.waitForTimeout(120);
  await page.keyboard.up("KeyP");
  await expect.poll(() => page.evaluate(() => window.__ARENA_DEBUG__?.getSnapshot().status)).toBe(
    "paused",
  );
  await clickCanvasAt(page, 480, 358);
  await expect.poll(() => page.evaluate(() => window.__ARENA_DEBUG__?.getSnapshot().status)).toBe(
    "playing",
  );

  await page.keyboard.down("KeyP");
  await page.waitForTimeout(120);
  await page.keyboard.up("KeyP");
  await expect.poll(() => page.evaluate(() => window.__ARENA_DEBUG__?.getSnapshot().status)).toBe(
    "paused",
  );
  await clickCanvasAt(page, 480, 410);
  await expect.poll(() => page.evaluate(() => window.__ARENA_DEBUG__?.getSnapshot().status)).toBe(
    "title",
  );
});

test("debug freeze still accepts restart and records forced damage events", async ({ page }) => {
  await page.goto("/");
  const canvas = page.locator("canvas");
  await expect(canvas).toHaveCount(1);

  await page.evaluate(() => {
    window.__ARENA_DEBUG__?.restart();
    window.__ARENA_DEBUG__?.setPaused(true);
    window.__ARENA_DEBUG__?.forceDamage(150);
  });

  await expect.poll(() => page.evaluate(() => window.__ARENA_DEBUG__?.getSnapshot().status)).toBe(
    "gameOver",
  );
  await expect
    .poll(() => page.evaluate(() => window.__ARENA_DEBUG__?.getSnapshot().stats.hitsTaken))
    .toBe(1);
  await expect
    .poll(() => page.evaluate(() => window.__ARENA_DEBUG__?.getSnapshot().resultSummary.damageTaken))
    .toBe(100);
  await expect
    .poll(() => page.evaluate(() => window.__ARENA_DEBUG__?.getSnapshot().feedback.screenFlashAlpha))
    .toBeGreaterThan(0);
  await expect
    .poll(() =>
      page.evaluate(() => {
        const cues = window.__ARENA_DEBUG__?.getSnapshot().audioCues ?? [];
        return cues.includes("damage") && cues.includes("gameOver");
      }),
    )
    .toBe(true);
  await expect
    .poll(() =>
      page.evaluate(() => {
        const events = window.__ARENA_DEBUG__?.getSnapshot().lastEvents ?? [];
        return (
          events.some((event) => event.type === "player.damaged") &&
          events.some((event) => event.type === "game.over")
        );
      }),
    )
    .toBe(true);

  await page.keyboard.down("KeyR");
  await page.waitForTimeout(120);
  await page.keyboard.up("KeyR");

  await expect.poll(() => page.evaluate(() => window.__ARENA_DEBUG__?.getSnapshot().status)).toBe(
    "playing",
  );
  await expect
    .poll(() => page.evaluate(() => window.__ARENA_DEBUG__?.getSnapshot().stats.damageTaken))
    .toBe(0);
});

test("can enter upgrade selection and choose an upgrade", async ({ page }) => {
  await page.goto("/");
  const canvas = page.locator("canvas");
  await expect(canvas).toHaveCount(1);
  await canvas.click();

  await page.evaluate(() => {
    window.__ARENA_DEBUG__?.restart();
    window.__ARENA_DEBUG__?.forceUpgradeSelect();
  });

  await expect.poll(() => page.evaluate(() => window.__ARENA_DEBUG__?.getSnapshot().status)).toBe(
    "upgradeSelect",
  );
  const before = await page.evaluate(() => window.__ARENA_DEBUG__?.getSnapshot());
  expect(before?.pendingUpgradeChoices).toHaveLength(3);

  await clickCanvasAt(page, 480, 234);

  await expect.poll(() => page.evaluate(() => window.__ARENA_DEBUG__?.getSnapshot().status)).toBe(
    "playing",
  );
  const after = await page.evaluate(() => window.__ARENA_DEBUG__?.getSnapshot());
  expect(after?.pendingUpgradeChoices).toEqual([]);
  expect(after?.stats.upgradesChosen).toBe(1);
  expect(after?.lastEvents.some((event) => event.type === "upgrade.selected")).toBe(true);
  expect(after?.audioCues).toContain("upgrade");
});
