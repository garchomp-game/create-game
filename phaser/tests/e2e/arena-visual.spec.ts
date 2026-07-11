import { expect, type Page, test } from "@playwright/test";

async function gotoArena(page: Page): Promise<void> {
  await page.goto(`/`);
  await expect.poll(() => page.evaluate(() => Boolean(window.__ARENA_DEBUG__))).toBe(true);
}

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

async function seedVisualRunRecords(page: Page): Promise<void> {
  await gotoArena(page);
  await expect.poll(() => page.evaluate(() => Boolean(window.__ARENA_DEBUG__))).toBe(true);
  await page.evaluate(() => {
    const debug = window.__ARENA_DEBUG__;
    const context = debug?.getSnapshot().runContext;
    const profile = debug?.getProfile();
    if (!context || !profile) throw new Error("Run context is not available.");

    const scores = [16_248, 8_204, 3_560];
    const records = scores.map((score, index) => ({
      schemaVersion: 1,
      id: `visual-run-${index + 1}`,
      profileId: profile.id,
      capturedAt: `2026-07-${String(10 - index).padStart(2, "0")}T10:00:00.000Z`,
      modeId: context.modeId,
      stageId: context.stageId,
      difficultyId: context.difficultyId,
      weaponId: "pulse" as const,
      modifierIds: ["auto-fire:on"],
      appVersion: context.appVersion,
      rulesetVersion: context.rulesetVersion,
      buildCommit: context.buildCommit,
      seed: 20260619 + index,
      seedCategory: context.seedCategory,
      runOrigin: "manual" as const,
      rankEligibility: { eligible: true, reasons: [] },
      elapsed: [310, 184, 72][index]!,
      score,
      level: [16, 10, 6][index]!,
      kills: [1114, 502, 188][index]!,
      damageTaken: [864, 420, 160][index]!,
      lastDamageSource: {
        kind: "contact" as const,
        enemyId: `enemy-${index + 1}`,
        enemyType: "chaser" as const,
      },
      shotsFired: [3612, 1900, 720][index]!,
      hpRecovered: [764, 312, 84][index]!,
      upgradesChosen: [15, 9, 5][index]!,
      upgradeRanks: {
        rapidFire: 5,
        swiftStep: Math.max(1, 3 - index),
        vitalCore: 0,
        overdriveRounds: Math.max(1, 4 - index),
        splitShot: Math.max(0, 2 - index),
        piercingRounds: 1,
      },
    }));

    localStorage.setItem(
      "arena-core.run-records.v2",
      JSON.stringify({ schemaVersion: 2, history: records, rankings: records }),
    );
  });
  await page.reload();
  await expect.poll(() => page.evaluate(() => Boolean(window.__ARENA_DEBUG__))).toBe(true);
}

test("matches the fixed title frame", async ({ page }) => {
  await gotoArena(page);
  const canvas = page.locator("canvas");
  await expect(canvas).toHaveCount(1);

  await page.evaluate(() => {
    window.__ARENA_DEBUG__?.setPaused(true);
  });

  await expect(canvas).toHaveScreenshot("arena-title.png", {
    maxDiffPixelRatio: 0.01,
  });
});

test("matches the settings frame", async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem(
      "arena-core.profile.v1",
      JSON.stringify({
        schemaVersion: 1,
        id: "00000000-0000-4000-8000-000000000005",
        createdAt: "2026-07-10T10:00:00.000Z",
        updatedAt: "2026-07-10T10:00:00.000Z",
      }),
    );
  });
  await gotoArena(page);
  const canvas = page.locator("canvas");
  await expect(canvas).toHaveCount(1);
  await page.evaluate(() => window.__ARENA_DEBUG__?.openMenu("settings"));

  await expect(canvas).toHaveScreenshot("arena-settings.png", {
    maxDiffPixelRatio: 0.01,
  });
});

test("matches the run history frame", async ({ page }) => {
  await seedVisualRunRecords(page);
  const canvas = page.locator("canvas");
  await page.evaluate(() => window.__ARENA_DEBUG__?.openMenu("history"));

  await expect(canvas).toHaveScreenshot("arena-run-history.png", {
    maxDiffPixelRatio: 0.01,
  });
});

test("matches the local ranking frame", async ({ page }) => {
  await seedVisualRunRecords(page);
  const canvas = page.locator("canvas");
  await page.evaluate(() => window.__ARENA_DEBUG__?.openMenu("ranking"));

  await expect(canvas).toHaveScreenshot("arena-local-ranking.png", {
    maxDiffPixelRatio: 0.01,
  });
});

test("matches the fixed initial arena frame", async ({ page }) => {
  await gotoArena(page);
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
  await gotoArena(page);
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
  await gotoArena(page);
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
  await gotoArena(page);
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
  await gotoArena(page);
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

test("matches the fixed offscreen enemy indicator frame", async ({ page }) => {
  await gotoArena(page);
  const canvas = page.locator("canvas");
  await expect(canvas).toHaveCount(1);

  await page.evaluate(() => {
    window.__ARENA_DEBUG__?.restart();
    window.__ARENA_DEBUG__?.setOffscreenEnemyIndicatorFixture();
    window.__ARENA_DEBUG__?.setPaused(true);
  });

  await expect(canvas).toHaveScreenshot("arena-offscreen-enemy-indicators.png", {
    maxDiffPixelRatio: 0.01,
  });
});

test("matches the fixed shooting frame", async ({ page }) => {
  await gotoArena(page);
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

test("matches the fixed upgraded pulse split shot frame", async ({ page }) => {
  await gotoArena(page);
  const canvas = page.locator("canvas");
  await expect(canvas).toHaveCount(1);

  await page.evaluate(() => {
    const debug = window.__ARENA_DEBUG__;
    if (!debug) throw new Error("Debug API is not available.");

    debug.restart();
    debug.forceUpgradeSelect();
    const splitShotIndex = debug.getSnapshot().pendingUpgradeChoices.indexOf("splitShot");
    if (splitShotIndex < 0) throw new Error("splitShot upgrade is not available in fixture.");

    debug.step({ upgradeChoicePressed: splitShotIndex }, 1 / 60);
    debug.setPaused(true);
    debug.step(
      {
        aimWorld: { x: 640, y: 270 },
        shootHeld: true,
      },
      1 / 60,
    );
    debug.step({ aimWorld: { x: 640, y: 270 } }, 8 / 60);
  });

  await expect(canvas).toHaveScreenshot("arena-upgraded-pulse-split-shot.png", {
    maxDiffPixelRatio: 0.01,
  });
});

test("matches the fixed mouse aiming cursor frame", async ({ page }) => {
  await gotoArena(page);
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
  await gotoArena(page);
  const canvas = page.locator("canvas");
  await expect(canvas).toHaveCount(1);

  await page.evaluate(() => {
    window.__ARENA_DEBUG__?.restart();
    window.__ARENA_DEBUG__?.setPaused(true);
    window.__ARENA_DEBUG__?.setHealPickupFixture("fatal");
    window.__ARENA_DEBUG__?.step({}, 1 / 60);
  });

  await expect(canvas).toHaveScreenshot("arena-game-over.png", {
    maxDiffPixelRatio: 0.01,
  });
});

test("matches the fixed paused frame", async ({ page }) => {
  await gotoArena(page);
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
  await gotoArena(page);
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

test("matches the portrait title frame without overflow", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await gotoArena(page);
  const canvas = page.locator("canvas");

  await expect(canvas).toHaveScreenshot("arena-title-portrait.png", {
    maxDiffPixelRatio: 0.01,
  });
});

test("matches the landscape fifteen minute HUD frame", async ({ page }) => {
  await page.setViewportSize({ width: 844, height: 390 });
  await gotoArena(page);
  const canvas = page.locator("canvas");
  await expect.poll(() => page.evaluate(() => Boolean(window.__ARENA_DEBUG__))).toBe(true);
  await page.evaluate(() => {
    window.__ARENA_DEBUG__?.restart();
    window.__ARENA_DEBUG__?.setElapsed(900);
    window.__ARENA_DEBUG__?.setEnemyVisualFixture("wave3");
    window.__ARENA_DEBUG__?.setPaused(true);
  });

  await expect(canvas).toHaveScreenshot("arena-fifteen-minute-hud-landscape.png", {
    maxDiffPixelRatio: 0.01,
  });
});
