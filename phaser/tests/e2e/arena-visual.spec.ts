import { expect, type Page, test } from "@playwright/test";
import { SIMULATION_CONFIG } from "../../src/config/gameConfig";
import { probeWebglCanvas } from "./webglCanvasProbe";

async function gotoArena(page: Page): Promise<void> {
  await page.goto(`/?webglReadback=1`);
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

async function showExpeditionCommanderPresentation(page: Page): Promise<void> {
  await moveMouseToCanvasLogical(page, 480, 339);
  await page.mouse.down();
  await page.mouse.up();
  await page.locator("[data-choice-kind='weapon'][data-choice-id='pulse']").click();
  await expect.poll(() => page.evaluate(() => window.__ARENA_DEBUG__?.getSnapshot().status)).toBe(
    "playing",
  );
  await page.evaluate(() => {
    const debug = window.__ARENA_DEBUG__;
    if (!debug) throw new Error("Debug API is not available.");
    debug.setPaused(true);
    debug.setExpeditionCommanderFixture();
  });
  await expect
    .poll(() =>
      page.evaluate(() => window.__ARENA_DEBUG__?.getSnapshot().stats.encounterMetrics.commander?.spawned),
    )
    .toBeGreaterThan(0);
}

async function showExpeditionBossPresentation(
  page: Page,
  attackId: "targeted-salvo" | "escort-pincer",
  phase: 1 | 2,
): Promise<void> {
  await moveMouseToCanvasLogical(page, 480, 339);
  await page.mouse.down();
  await page.mouse.up();
  await page.locator("[data-choice-kind='weapon'][data-choice-id='pulse']").click();
  await expect.poll(() => page.evaluate(() => window.__ARENA_DEBUG__?.getSnapshot().status)).toBe(
    "playing",
  );
  await page.evaluate(
    ({ selectedAttackId, selectedPhase }) => {
      const debug = window.__ARENA_DEBUG__;
      if (!debug) throw new Error("Debug API is not available.");
      debug.setPaused(true);
      debug.setExpeditionBossFixture(selectedAttackId, selectedPhase);
    },
    { selectedAttackId: attackId, selectedPhase: phase },
  );
  await expect
    .poll(() => page.evaluate(() => window.__ARENA_DEBUG__?.getSnapshot().expedition?.boss?.status))
    .toBe("active");
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

  const rendererProbe = await probeWebglCanvas(canvas);
  expect(rendererProbe.kind).toBe("webgl");
  expect(rendererProbe.preserveDrawingBuffer).toBe(true);
  expect(rendererProbe.nonBackgroundSamples).toBeGreaterThan(0);

  await expect(canvas).toHaveScreenshot("arena-title.png", {
    maxDiffPixelRatio: 0.01,
  });
});

test("shows the observer auto pilot status without covering the HUD", async ({ page }) => {
  await gotoArena(page);
  const canvas = page.locator("canvas");
  await page.evaluate(() => {
    window.__ARENA_DEBUG__?.startAutoPilot("pulse");
    window.__ARENA_DEBUG__?.setPaused(true);
  });
  await expect
    .poll(() => page.evaluate(() => window.__ARENA_DEBUG__?.getSnapshot().autoPilotEnabled))
    .toBe(true);
  await page.waitForTimeout(100);

  await expect(canvas).toHaveScreenshot("arena-auto-pilot.png", {
    maxDiffPixelRatio: 0.01,
  });
});

test("matches the starting weapon selection frame", async ({ page }) => {
  await gotoArena(page);
  const game = page.locator("#game");

  await moveMouseToCanvasLogical(page, 480, 307);
  await page.mouse.down();
  await page.mouse.up();
  await expect.poll(() => page.evaluate(() => window.__ARENA_DEBUG__?.getSnapshot().status)).toBe(
    "weaponSelect",
  );

  await expect(game).toHaveScreenshot("arena-weapon-select.png", {
    maxDiffPixelRatio: 0.01,
  });
});

test("shows the Expedition Act, ingress, and Commander visual slice", async ({ page }) => {
  await gotoArena(page);
  const canvas = page.locator("canvas");
  await showExpeditionCommanderPresentation(page);

  const snapshot = await page.evaluate(() => window.__ARENA_DEBUG__?.getSnapshot());
  expect(snapshot?.expedition).toMatchObject({
    actId: "counterattack",
    currentGeometryId: "escort",
    director: { phase: "active" },
  });
  expect(snapshot?.renderPerformance.staticBackground.drawCount).toBe(1);
  expect(snapshot?.renderPerformance.renderedFrames).toBeGreaterThan(0);
  expect(snapshot?.renderPerformance.dynamicWorld.averageMs).toBeLessThan(8);
  expect(snapshot?.renderPerformance.screenHud.averageMs).toBeLessThan(5);
  expect(snapshot?.renderPerformance.feedback.averageMs).toBeLessThan(3);

  await expect(canvas).toHaveScreenshot("arena-expedition-commander.png", {
    maxDiffPixelRatio: 0.01,
  });
});

test("keeps the Expedition visual slice readable in a portrait viewport", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await gotoArena(page);
  const game = page.locator("#game");
  await showExpeditionCommanderPresentation(page);

  await expect(game).toHaveScreenshot("arena-expedition-commander-portrait.png", {
    maxDiffPixelRatio: 0.01,
  });
});

test("shows the phase-two command ship and targeted salvo", async ({ page }) => {
  await gotoArena(page);
  const canvas = page.locator("canvas");
  await showExpeditionBossPresentation(page, "targeted-salvo", 2);

  const snapshot = await page.evaluate(() => window.__ARENA_DEBUG__?.getSnapshot());
  expect(snapshot?.expedition?.boss).toMatchObject({
    bossId: "first-command-ship",
    phase: 2,
    action: { attackId: "targeted-salvo", phase: "telegraph" },
  });
  expect(snapshot?.renderPerformance.staticBackground.drawCount).toBe(1);
  expect(snapshot?.renderPerformance.renderedFrames).toBeGreaterThan(0);
  expect(snapshot?.renderPerformance.dynamicWorld.averageMs).toBeLessThan(8);
  expect(snapshot?.renderPerformance.screenHud.averageMs).toBeLessThan(5);
  expect(snapshot?.renderPerformance.feedback.averageMs).toBeLessThan(3);
  await expect(canvas).toHaveScreenshot("arena-expedition-boss-salvo.png", {
    maxDiffPixelRatio: 0.01,
  });
});

test("keeps the escort pincer and boss HUD readable in portrait", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await gotoArena(page);
  const game = page.locator("#game");
  await showExpeditionBossPresentation(page, "escort-pincer", 1);

  await expect(game).toHaveScreenshot("arena-expedition-boss-portrait.png", {
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

test("matches the fixed upgraded Spread split shot frame", async ({ page }) => {
  await gotoArena(page);
  const canvas = page.locator("canvas");
  await expect(canvas).toHaveCount(1);

  await moveMouseToCanvasLogical(page, 480, 307);
  await page.mouse.down();
  await page.mouse.up();
  await page.locator("[data-choice-kind='weapon'][data-choice-id='spread']").click();
  await expect.poll(() => page.evaluate(() => window.__ARENA_DEBUG__?.getSnapshot().weaponType)).toBe(
    "spread",
  );

  await page.evaluate(() => {
    const debug = window.__ARENA_DEBUG__;
    if (!debug) throw new Error("Debug API is not available.");

    let acquired = false;
    // Drain deterministic offers until the weapon-specific upgrade appears.
    for (let attempt = 0; attempt < 32; attempt += 1) {
      debug.forceUpgradeSelect();
      const choices = debug.getSnapshot().pendingUpgradeChoices;
      const splitShotIndex = choices.indexOf("splitShot");
      debug.step({ upgradeChoicePressed: splitShotIndex >= 0 ? splitShotIndex : 0 }, 1 / 60);
      if (splitShotIndex >= 0) {
        acquired = true;
        break;
      }
    }
    if (!acquired) throw new Error("splitShot upgrade is not available in fixture.");
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

  await expect(canvas).toHaveScreenshot("arena-upgraded-spread-split-shot.png", {
    maxDiffPixelRatio: 0.01,
  });
});

test("matches the Pulse ricochet boundary field frame", async ({ page }) => {
  test.skip(
    !SIMULATION_CONFIG.features.pulseBoundaryRicochet,
    "Pulse boundary ricochet is disabled for this comparison ruleset.",
  );
  await gotoArena(page);
  const canvas = page.locator("canvas");
  await expect(canvas).toHaveCount(1);

  await moveMouseToCanvasLogical(page, 480, 307);
  await page.mouse.down();
  await page.mouse.up();
  await page.locator("[data-choice-kind='weapon'][data-choice-id='pulse']").click();
  await expect
    .poll(() =>
      page.evaluate(() => {
        const snapshot = window.__ARENA_DEBUG__?.getSnapshot();
        return snapshot ? { status: snapshot.status, weaponType: snapshot.weaponType } : null;
      }),
    )
    .toEqual({ status: "playing", weaponType: "pulse" });

  await page.evaluate(() => {
    const debug = window.__ARENA_DEBUG__;
    if (!debug) throw new Error("Debug API is not available.");
    const weaponUpgrades = new Set([
      "rapidFire",
      "overdriveRounds",
      "pulseFocus",
      "piercingRounds",
    ]);

    for (let attempt = 0; attempt < 80; attempt += 1) {
      debug.forceUpgradeSelect();
      const choices = debug.getSnapshot().pendingUpgradeChoices;
      const capstoneIndex = choices.indexOf("pulseRicochet");
      const weaponIndex = choices.findIndex((choice) => weaponUpgrades.has(choice));
      debug.step(
        { upgradeChoicePressed: capstoneIndex >= 0 ? capstoneIndex : Math.max(0, weaponIndex) },
        1 / 60,
      );
      if (capstoneIndex >= 0) break;
    }

    if (debug.getSnapshot().upgradeRanks.pulseRicochet !== 1) {
      throw new Error("pulseRicochet upgrade is not available in fixture.");
    }
    debug.setPaused(true);
    debug.setElapsed(300);
  });

  await expect
    .poll(() =>
      page.evaluate(() => {
        const snapshot = window.__ARENA_DEBUG__?.getSnapshot();
        return snapshot
          ? {
              elapsed: snapshot.elapsed,
              pulseRicochet: snapshot.upgradeRanks.pulseRicochet,
            }
          : null;
      }),
    )
    .toEqual({ elapsed: 300, pulseRicochet: 1 });

  await expect(canvas).toHaveScreenshot("arena-pulse-ricochet-boundary.png", {
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
  const game = page.locator("#game");

  await page.evaluate(() => {
    window.__ARENA_DEBUG__?.restart();
    window.__ARENA_DEBUG__?.forceUpgradeSelect();
  });

  await expect(game).toHaveScreenshot("arena-upgrade-select.png", {
    maxDiffPixelRatio: 0.01,
  });
});

test("matches the portrait upgrade selection frame", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await gotoArena(page);
  const game = page.locator("#game");

  await page.evaluate(() => {
    window.__ARENA_DEBUG__?.restart();
    window.__ARENA_DEBUG__?.forceUpgradeSelect();
  });

  await expect(game).toHaveScreenshot("arena-upgrade-select-portrait.png", {
    maxDiffPixelRatio: 0.01,
  });
});

test("matches the extra upgrade selection frame", async ({ page }) => {
  await gotoArena(page);
  const game = page.locator("#game");

  await page.evaluate(() => {
    window.__ARENA_DEBUG__?.restart();
    window.__ARENA_DEBUG__?.forceExtraUpgradeSelect();
  });

  await expect(game).toHaveScreenshot("arena-extra-upgrade-select.png", {
    maxDiffPixelRatio: 0.01,
  });
});

test("matches the encounter warning frame", async ({ page }) => {
  await gotoArena(page);
  const canvas = page.locator("canvas");
  await page.evaluate(() => {
    const debug = window.__ARENA_DEBUG__;
    debug?.restart();
    debug?.step({}, 1 / 60);
    const scheduledAt = debug?.getSnapshot().encounter.director.scheduledAt;
    if (scheduledAt === null || scheduledAt === undefined) throw new Error("Encounter was not scheduled.");
    debug?.setElapsed(scheduledAt - 5);
    debug?.step({}, 1 / 60);
    debug?.setPaused(true);
  });

  await expect(canvas).toHaveScreenshot("arena-encounter-warning.png", {
    maxDiffPixelRatio: 0.01,
  });
});

test("matches the endless contract selection frame", async ({ page }) => {
  await gotoArena(page);
  const game = page.locator("#game");
  await page.evaluate(() => {
    const debug = window.__ARENA_DEBUG__;
    debug?.restart();
    debug?.step({}, 1 / 60);
    const scheduledAt = debug?.getSnapshot().encounter.director.scheduledAt;
    if (scheduledAt === null || scheduledAt === undefined) throw new Error("Encounter was not scheduled.");
    debug?.setElapsed(scheduledAt + 40);
    debug?.step({}, 1 / 60);
    debug?.setElapsed(240);
    debug?.step({}, 1 / 60);
  });
  await expect.poll(() => page.evaluate(() => window.__ARENA_DEBUG__?.getSnapshot().status)).toBe(
    "contractSelect",
  );

  await expect(game).toHaveScreenshot("arena-endless-contract.png", {
    maxDiffPixelRatio: 0.01,
  });
});

test("matches the arena collapse frame", async ({ page }) => {
  await gotoArena(page);
  const canvas = page.locator("canvas");
  await page.evaluate(() => {
    const debug = window.__ARENA_DEBUG__;
    debug?.restart();
    debug?.step({}, 1 / 60);
    const scheduledAt = debug?.getSnapshot().encounter.director.scheduledAt;
    if (scheduledAt === null || scheduledAt === undefined) throw new Error("Encounter was not scheduled.");
    debug?.setElapsed(scheduledAt + 40);
    debug?.step({}, 1 / 60);
    debug?.setElapsed(600);
    debug?.step({}, 1 / 60);
    debug?.step({ contractChoicePressed: 0 }, 1 / 60);
    debug?.step({}, 1 / 60);
    debug?.setPaused(true);
  });

  await expect(canvas).toHaveScreenshot("arena-collapse.png", {
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

test("matches the landscape long-run HUD frame without label overlap", async ({ page }) => {
  await page.setViewportSize({ width: 844, height: 390 });
  await gotoArena(page);
  const canvas = page.locator("canvas");
  await expect.poll(() => page.evaluate(() => Boolean(window.__ARENA_DEBUG__))).toBe(true);
  await page.evaluate(() => {
    window.__ARENA_DEBUG__?.restart();
    window.__ARENA_DEBUG__?.setHudStressFixture();
    window.__ARENA_DEBUG__?.setElapsed(900);
    window.__ARENA_DEBUG__?.setEnemyVisualFixture("wave3");
    window.__ARENA_DEBUG__?.setPaused(true);
  });

  await expect(canvas).toHaveScreenshot("arena-fifteen-minute-hud-landscape.png", {
    maxDiffPixelRatio: 0.01,
  });
});
