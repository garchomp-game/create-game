import { expect, test } from "@playwright/test";

const SOAK_DURATION_MS = 15 * 60 * 1000;
const SAMPLE_INTERVAL_MS = 500;

test("runs the rendered arena for fifteen real-time minutes", async ({ page }, testInfo) => {
  test.skip(process.env.ARENA_LONG_SOAK !== "1", "Set ARENA_LONG_SOAK=1 to run the long soak.");
  test.setTimeout(SOAK_DURATION_MS + 60_000);

  const consoleErrors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  page.on("pageerror", (error) => consoleErrors.push(error.message));

  await page.goto("/");
  await expect.poll(() => page.evaluate(() => Boolean(window.__ARENA_DEBUG__))).toBe(true);
  await page.evaluate(() => window.__ARENA_DEBUG__?.restart());
  const canvas = page.locator("canvas");
  const box = await canvas.boundingBox();
  if (!box) throw new Error("Canvas is not visible.");

  const heapAtStart = await readHeap(page);
  const fpsAtStart = await measureFps(page);
  const directions = ["KeyD", "KeyS", "KeyA", "KeyW"] as const;
  let activeDirection: (typeof directions)[number] | null = null;
  let directionIndex = -1;
  let maxEnemies = 0;
  let maxProjectiles = 0;
  let maxPickups = 0;
  let maxHeap = heapAtStart;
  let sampleIndex = 0;
  const deadline = Date.now() + SOAK_DURATION_MS;

  while (Date.now() < deadline) {
    const nextDirectionIndex = Math.floor(sampleIndex / 6) % directions.length;
    if (nextDirectionIndex !== directionIndex) {
      if (activeDirection) await page.keyboard.up(activeDirection);
      directionIndex = nextDirectionIndex;
      activeDirection = directions[directionIndex]!;
      await page.keyboard.down(activeDirection);
    }

    const angle = sampleIndex / 18;
    await page.mouse.move(
      box.x + box.width * (0.5 + Math.cos(angle) * 0.38),
      box.y + box.height * (0.5 + Math.sin(angle) * 0.38),
    );

    const snapshot = await page.evaluate(() => window.__ARENA_DEBUG__?.getSnapshot());
    if (!snapshot) throw new Error("Debug snapshot is not available.");
    if (snapshot.status === "gameOver") throw new Error("Soak run ended unexpectedly.");
    if (snapshot.status === "upgradeSelect") {
      await page.evaluate(() => window.__ARENA_DEBUG__?.step({ upgradeChoicePressed: 0 }, 1 / 60));
    } else if (snapshot.hp < 50) {
      await page.evaluate(() => window.__ARENA_DEBUG__?.restoreHealthForSoak());
    }

    maxEnemies = Math.max(maxEnemies, snapshot.enemyCount);
    maxProjectiles = Math.max(
      maxProjectiles,
      snapshot.bulletCount + snapshot.enemyProjectileCount,
    );
    maxPickups = Math.max(maxPickups, snapshot.pickupCount);
    maxHeap = Math.max(maxHeap, await readHeap(page));
    sampleIndex += 1;
    await page.waitForTimeout(SAMPLE_INTERVAL_MS);
  }

  if (activeDirection) await page.keyboard.up(activeDirection);
  let finalSnapshot = await page.evaluate(() => window.__ARENA_DEBUG__?.getSnapshot());
  if (!finalSnapshot) throw new Error("Final debug snapshot is not available.");
  if (finalSnapshot.status === "upgradeSelect") {
    await page.evaluate(() => window.__ARENA_DEBUG__?.step({ upgradeChoicePressed: 0 }, 1 / 60));
    finalSnapshot = await page.evaluate(() => window.__ARENA_DEBUG__?.getSnapshot());
    if (!finalSnapshot) throw new Error("Final debug snapshot is not available.");
  }
  const fpsAtEnd = await measureFps(page);
  const heapAtEnd = await readHeap(page);
  const storageBytes = await page.evaluate(() =>
    Object.entries(localStorage).reduce(
      (total, [key, value]) => total + (key.length + value.length) * 2,
      0,
    ),
  );
  const nonBlankSamples = await canvas.evaluate((node) => {
    const element = node as HTMLCanvasElement;
    const context = element.getContext("2d");
    if (!context) return 0;
    const data = context.getImageData(0, 0, element.width, element.height).data;
    let count = 0;
    for (let index = 0; index < data.length; index += 4 * 257) {
      if (data[index] !== 17 || data[index + 1] !== 19 || data[index + 2] !== 24) count += 1;
    }
    return count;
  });
  const summary = {
    wallSeconds: SOAK_DURATION_MS / 1000,
    simulationSeconds: finalSnapshot.elapsed,
    maxEnemies,
    maxProjectiles,
    maxPickups,
    heapAtStart,
    maxHeap,
    heapAtEnd,
    fpsAtStart,
    fpsAtEnd,
    storageBytes,
    nonBlankSamples,
  };
  await testInfo.attach("soak-summary", {
    body: JSON.stringify(summary, null, 2),
    contentType: "application/json",
  });
  process.stdout.write(`[arena-soak] ${JSON.stringify(summary)}\n`);

  expect(finalSnapshot.elapsed).toBeGreaterThanOrEqual(890);
  expect(finalSnapshot.status).toBe("playing");
  expect(maxEnemies).toBeLessThanOrEqual(76);
  expect(maxProjectiles).toBeLessThanOrEqual(220);
  expect(maxPickups).toBeLessThanOrEqual(2_000);
  expect(maxHeap).toBeLessThan(512 * 1024 * 1024);
  expect(fpsAtEnd).toBeGreaterThan(15);
  expect(nonBlankSamples).toBeGreaterThan(0);
  expect(consoleErrors).toEqual([]);
});

async function readHeap(page: import("@playwright/test").Page): Promise<number> {
  return page.evaluate(() => {
    const memory = performance as Performance & { memory?: { usedJSHeapSize: number } };
    return memory.memory?.usedJSHeapSize ?? 0;
  });
}

async function measureFps(page: import("@playwright/test").Page): Promise<number> {
  return page.evaluate(
    () =>
      new Promise<number>((resolve) => {
        let frames = 0;
        const startedAt = performance.now();
        const count = () => {
          frames += 1;
          const elapsed = performance.now() - startedAt;
          if (elapsed >= 1_000) resolve((frames * 1_000) / elapsed);
          else requestAnimationFrame(count);
        };
        requestAnimationFrame(count);
      }),
  );
}
