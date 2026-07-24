import { expect, type Page, test } from "@playwright/test";
import {
  APP_VERSION,
  ENDLESS_RULESET_VERSION,
  RULESET_VERSION,
} from "../../src/config/version";
import type { RunRecord } from "../../src/domain/runRecords";
import { probeVisibleCanvasSamples, probeWebglCanvas } from "./webglCanvasProbe";

async function gotoArena(page: Page, path = "/"): Promise<void> {
  await page.goto(path);
  await expect.poll(() => page.evaluate(() => Boolean(window.__ARENA_DEBUG__))).toBe(true);
}

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

async function moveMouseToCanvasAt(page: Page, x: number, y: number): Promise<void> {
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
  await page.mouse.move(
    box.left + (x / box.canvasWidth) * box.width,
    box.top + (y / box.canvasHeight) * box.height,
  );
}

async function getCanvasCursor(page: Page): Promise<string> {
  return page.locator("canvas").evaluate((node) => getComputedStyle(node).cursor);
}

test("renders canvas and accepts movement and shooting input", async ({ page }) => {
  const consoleErrors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") {
      consoleErrors.push(message.text());
    }
  });

  await gotoArena(page);
  const canvas = page.locator("canvas");
  await expect(canvas).toHaveCount(1);

  await expect
    .poll(async () => canvas.evaluate((node) => (node as HTMLCanvasElement).width))
    .toBe(960);

  const rendererProbe = await probeWebglCanvas(canvas);
  expect(rendererProbe.kind).toBe("webgl");
  expect(rendererProbe.preserveDrawingBuffer).toBe(false);
  expect(await probeVisibleCanvasSamples(page, canvas)).toBeGreaterThan(0);

  await expect.poll(() => page.evaluate(() => window.__ARENA_DEBUG__?.getSnapshot().status)).toBe(
    "title",
  );

  await clickCanvasAt(page, 480, 307);
  await expect.poll(() => page.evaluate(() => window.__ARENA_DEBUG__?.getSnapshot().status)).toBe(
    "weaponSelect",
  );
  await page.locator("[data-choice-kind='weapon'][data-choice-id='pulse']").click();
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

test("runs the final expedition from mode selection through result and retry", async ({ page }) => {
  await gotoArena(page, "/?seed=20260717");

  await clickCanvasAt(page, 480, 339);
  await expect.poll(() => page.evaluate(() => window.__ARENA_DEBUG__?.getSnapshot().status)).toBe(
    "weaponSelect",
  );
  await expect(page.locator(".arena-choice-title")).toContainText("最終遠征");
  expect(
    await page.evaluate(() => window.__ARENA_DEBUG__?.getSnapshot().runContext),
  ).toMatchObject({ modeId: "expedition", stageId: "final-expedition" });

  await page.locator("[data-choice-kind='weapon'][data-choice-id='pulse']").click();
  await expect.poll(() => page.evaluate(() => window.__ARENA_DEBUG__?.getSnapshot().status)).toBe(
    "playing",
  );
  await expect
    .poll(() => page.evaluate(() => window.__ARENA_DEBUG__?.getSnapshot().expedition?.actId))
    .toBe("perimeter-watch");

  await page.evaluate(() => {
    const debug = window.__ARENA_DEBUG__;
    if (!debug) throw new Error("Debug API is unavailable.");
    debug.setPaused(true);
    debug.setExpeditionBossFixture("targeted-salvo", 2);
    debug.armExpeditionBossDefeat();
    debug.step({}, 1 / 60);
  });
  await expect.poll(() => page.evaluate(() => window.__ARENA_DEBUG__?.getSnapshot().status)).toBe(
    "gameOver",
  );
  const completed = await page.evaluate(() => window.__ARENA_DEBUG__?.getSnapshot());
  expect(completed?.latestRunRecord).toMatchObject({
    modeId: "expedition",
    stageId: "final-expedition",
    encounterMetrics: {
      expedition: {
        outcome: "victory",
        reachedActId: "command-ship",
        tacticalScore: expect.any(Number),
        clearScoreBonus: 15_000,
        timeScoreBonus: 0,
        timeMedal: "gold",
        bossFightDuration: expect.any(Number),
      },
      boss: {
        bossId: "final-command-ship",
        phaseReached: 2,
        remainingHp: 0,
        defeatedByWeapon: "pulse",
      },
    },
  });
  expect(completed?.music).toMatchObject({
    loaded: true,
    playing: true,
    track: "victory",
  });
  expect(completed?.audioCues).not.toContain("gameOver");

  await clickCanvasAt(page, 480, 415);
  await expect
    .poll(() => page.evaluate(() => window.__ARENA_DEBUG__?.getSnapshot().secondaryMenu))
    .toBe("ranking");
  await page.keyboard.press("Escape");
  await expect
    .poll(() => page.evaluate(() => window.__ARENA_DEBUG__?.getSnapshot().secondaryMenu))
    .toBeNull();

  await clickCanvasAt(page, 480, 387);
  await expect.poll(() => page.evaluate(() => window.__ARENA_DEBUG__?.getSnapshot().status)).toBe(
    "playing",
  );
  expect(
    await page.evaluate(() => window.__ARENA_DEBUG__?.getSnapshot().runContext),
  ).toMatchObject({ modeId: "expedition", stageId: "final-expedition" });
  expect(
    await page.evaluate(() => window.__ARENA_DEBUG__?.getSnapshot().music.track),
  ).toBe("arena");
});

test("navigates Expedition ranking boards across weapons, fixed seeds, and rulesets", async ({
  page,
}) => {
  await gotoArena(page, "/?seed=20260717");
  await clickCanvasAt(page, 480, 339);
  await page.locator("[data-choice-kind='weapon'][data-choice-id='pulse']").click();
  await page.evaluate(() => {
    const debug = window.__ARENA_DEBUG__;
    if (!debug) throw new Error("Debug API is unavailable.");
    debug.setPaused(true);
    debug.setExpeditionBossFixture("targeted-salvo", 2);
    debug.armExpeditionBossDefeat();
    debug.step({}, 1 / 60);
  });
  await expect
    .poll(() => page.evaluate(() => window.__ARENA_DEBUG__?.getSnapshot().status))
    .toBe("gameOver");

  await page.evaluate(() => {
    const key = "arena-core.run-records.v2";
    const raw = localStorage.getItem(key);
    if (!raw) throw new Error("Run record storage is missing.");
    const envelope = JSON.parse(raw) as {
      schemaVersion: 2;
      history: RunRecord[];
      rankings: RunRecord[];
    };
    const base = envelope.history[0];
    if (!base?.encounterMetrics.expedition || !base.encounterMetrics.boss) {
      throw new Error("Expedition victory fixture is missing.");
    }

    const rulesets = ["ranking-fixture-a", "ranking-fixture-b"];
    const seeds = [101, 202];
    const weapons = ["pulse", "spread"] as const;
    let index = 0;
    const records = rulesets.flatMap((rulesetVersion) =>
      seeds.flatMap((seed) =>
        weapons.map((weaponId) => {
          index += 1;
          const tacticalScore = 20_000 + index * 100;
          return {
            ...structuredClone(base),
            id: `ranking-fixture-${index}`,
            capturedAt: `2026-07-19T10:00:${String(index).padStart(2, "0")}.000Z`,
            weaponId,
            rulesetVersion,
            seed,
            seedCategory: "fixed" as const,
            runOrigin: "manual" as const,
            rankEligibility: { eligible: true, reasons: [] },
            elapsed: 500 + index,
            score: tacticalScore + 15_000,
            encounterMetrics: {
              ...structuredClone(base.encounterMetrics),
              expedition: {
                ...structuredClone(base.encounterMetrics.expedition),
                outcome: "victory" as const,
                tacticalScore,
                scoreBeforeBonus: tacticalScore,
              },
              boss: {
                ...structuredClone(base.encounterMetrics.boss),
                defeatedByWeapon: weaponId,
              },
            },
          } satisfies RunRecord;
        }),
      ),
    );
    localStorage.setItem(
      key,
      JSON.stringify({ schemaVersion: 2, history: records, rankings: records }),
    );
  });

  await page.reload();
  await expect.poll(() => page.evaluate(() => Boolean(window.__ARENA_DEBUG__))).toBe(true);
  await page.evaluate(() => window.__ARENA_DEBUG__?.openMenu("ranking"));
  const boardCount = await page.evaluate(
    () => window.__ARENA_DEBUG__?.getSnapshot().rankingBoardCount ?? 0,
  );
  expect(boardCount).toBeGreaterThanOrEqual(12);

  const queries = [];
  for (let index = 0; index < boardCount; index += 1) {
    const snapshot = await page.evaluate(() => window.__ARENA_DEBUG__?.getSnapshot());
    if (snapshot?.rankingQuery) queries.push(snapshot.rankingQuery);
    if (index === boardCount - 1) break;
    await clickCanvasAt(page, 625, 415);
    await expect
      .poll(() =>
        page.evaluate(() => window.__ARENA_DEBUG__?.getSnapshot().rankingBoardIndex)
      )
      .toBe(index + 1);
  }

  const expeditionBoards = queries
    .filter((query) => query.modeId === "expedition")
    .map((query) =>
      [
        query.rulesetVersion,
        query.seed,
        query.comparisonScope,
        query.weaponId ?? "all",
      ].join(":"),
    )
    .sort();
  const expectedBoards = ["ranking-fixture-a", "ranking-fixture-b"]
    .flatMap((rulesetVersion) =>
      [101, 202].flatMap((seed) => [
        `${rulesetVersion}:${seed}:overall:all`,
        `${rulesetVersion}:${seed}:weapon:pulse`,
        `${rulesetVersion}:${seed}:weapon:spread`,
      ]),
    )
    .sort();
  expect(expeditionBoards).toEqual(expectedBoards);
});

test("runs the observer auto pilot outside ranking and allows manual takeover", async ({ page }) => {
  await gotoArena(page, "/?autopilot=pulse&seed=20260714");

  await expect
    .poll(() => page.evaluate(() => window.__ARENA_DEBUG__?.getSnapshot().autoPilotEnabled))
    .toBe(true);
  await expect.poll(() => page.evaluate(() => window.__ARENA_DEBUG__?.getSnapshot().status)).toBe(
    "playing",
  );
  await expect
    .poll(() => page.evaluate(() => window.__ARENA_DEBUG__?.getSnapshot().bulletCount))
    .toBeGreaterThan(0);

  const snapshot = await page.evaluate(() => window.__ARENA_DEBUG__?.getSnapshot());
  expect(snapshot?.weaponType).toBe("pulse");
  expect(snapshot?.runContext?.modifierIds).toContain("auto-pilot:tactical-observer-v3");
  expect(snapshot?.runContext?.rankEligibility.eligible).toBe(false);
  expect(snapshot?.autoPilotMode).not.toBeNull();
  expect(snapshot?.autoPilotIntentMode).not.toBeNull();
  expect(snapshot?.autoPilotRiskScore).toBeGreaterThanOrEqual(0);

  await page.locator("canvas").click();
  await page.keyboard.down("KeyO");
  await page.waitForTimeout(120);
  await page.keyboard.up("KeyO");
  await expect
    .poll(() => page.evaluate(() => window.__ARENA_DEBUG__?.getSnapshot().autoPilotEnabled))
    .toBe(false);
  expect(
    await page.evaluate(() => window.__ARENA_DEBUG__?.getSnapshot().runContext?.rankEligibility.eligible),
  ).toBe(false);
});

test("uses native cursor affordances outside active play", async ({ page }) => {
  await gotoArena(page);
  const canvas = page.locator("canvas");
  await expect(canvas).toHaveCount(1);

  await expect.poll(() => page.evaluate(() => window.__ARENA_DEBUG__?.getSnapshot().status)).toBe(
    "title",
  );
  await moveMouseToCanvasAt(page, 480, 307);
  await expect.poll(() => getCanvasCursor(page)).toBe("pointer");

  await clickCanvasAt(page, 480, 307);
  await expect.poll(() => page.evaluate(() => window.__ARENA_DEBUG__?.getSnapshot().status)).toBe(
    "weaponSelect",
  );
  const pulseChoice = page.locator("[data-choice-kind='weapon'][data-choice-id='pulse']");
  await expect(pulseChoice).toBeVisible();
  await pulseChoice.hover();
  await expect.poll(() => pulseChoice.evaluate((node) => getComputedStyle(node).cursor)).toBe(
    "pointer",
  );
  await pulseChoice.click();
  await expect.poll(() => page.evaluate(() => window.__ARENA_DEBUG__?.getSnapshot().status)).toBe(
    "playing",
  );
  await expect.poll(() => getCanvasCursor(page)).toBe("none");

  await page.evaluate(() => {
    window.__ARENA_DEBUG__?.step({ pausePressed: true }, 1 / 60);
  });
  await expect.poll(() => page.evaluate(() => window.__ARENA_DEBUG__?.getSnapshot().status)).toBe(
    "paused",
  );
  await moveMouseToCanvasAt(page, 480, 316);
  await expect.poll(() => getCanvasCursor(page)).toBe("pointer");

  await page.evaluate(() => {
    window.__ARENA_DEBUG__?.forceGameOver();
  });
  await expect.poll(() => page.evaluate(() => window.__ARENA_DEBUG__?.getSnapshot().status)).toBe(
    "gameOver",
  );
  await moveMouseToCanvasAt(page, 480, 387);
  await expect.poll(() => getCanvasCursor(page)).toBe("pointer");

  await page.evaluate(() => {
    window.__ARENA_DEBUG__?.restart();
  });
  await expect.poll(() => page.evaluate(() => window.__ARENA_DEBUG__?.getSnapshot().status)).toBe(
    "playing",
  );
  await page.evaluate(() => {
    window.__ARENA_DEBUG__?.forceUpgradeSelect();
  });
  await expect.poll(() => page.evaluate(() => window.__ARENA_DEBUG__?.getSnapshot().status)).toBe(
    "upgradeSelect",
  );
  const upgradeChoice = page.locator("[data-choice-kind='upgrade']").first();
  await upgradeChoice.hover();
  await expect.poll(() => upgradeChoice.evaluate((node) => getComputedStyle(node).cursor)).toBe(
    "pointer",
  );

  await moveMouseToCanvasAt(page, 24, 24);
  await expect
    .poll(() =>
      page.evaluate(() => {
        const node = document.elementFromPoint(24, 24);
        return node ? getComputedStyle(node).cursor : "";
      }),
    )
    .toBe("default");
});

test("auto-fires after mouse aim is established during play", async ({ page }) => {
  await gotoArena(page);
  const canvas = page.locator("canvas");
  await expect(canvas).toHaveCount(1);

  await page.evaluate(() => window.__ARENA_DEBUG__?.restart());
  await expect.poll(() => page.evaluate(() => window.__ARENA_DEBUG__?.getSnapshot().status)).toBe(
    "playing",
  );
  await expect.poll(() => page.evaluate(() => window.__ARENA_DEBUG__?.getSnapshot().bulletCount)).toBe(0);

  const box = await canvas.evaluate((node) => {
    const canvasElement = node as HTMLCanvasElement;
    const rect = canvasElement.getBoundingClientRect();
    return {
      left: rect.left,
      top: rect.top,
      width: rect.width,
      height: rect.height,
      canvasWidth: canvasElement.width,
      canvasHeight: canvasElement.height,
    };
  });
  await page.mouse.move(
    box.left + (640 / box.canvasWidth) * box.width,
    box.top + (270 / box.canvasHeight) * box.height,
  );

  await expect.poll(() => page.evaluate(() => window.__ARENA_DEBUG__?.getSnapshot().bulletCount))
    .toBeGreaterThan(0);
  await expect
    .poll(() => page.evaluate(() => window.__ARENA_DEBUG__?.getSnapshot().stats.shotsFired))
    .toBeGreaterThan(0);
});

test("can force game over and restart with R", async ({ page }) => {
  await gotoArena(page);
  const canvas = page.locator("canvas");
  await expect(canvas).toHaveCount(1);
  await page.evaluate(() => window.__ARENA_DEBUG__?.restart());

  let automaticRunExports = 0;
  page.on("request", (request) => {
    if (request.url().endsWith("/__arena/run-export") && request.method() === "POST") {
      automaticRunExports += 1;
    }
  });
  await page.evaluate(() => window.__ARENA_DEBUG__?.forceGameOver());
  await page.waitForTimeout(150);
  expect(automaticRunExports).toBe(0);
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

  await clickCanvasAt(page, 480, 387);
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
  await clickCanvasAt(page, 480, 491);
  await expect.poll(() => page.evaluate(() => window.__ARENA_DEBUG__?.getSnapshot().status)).toBe(
    "title",
  );
});

test("can pause and resume with P without advancing simulation", async ({ page }) => {
  await gotoArena(page);
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
  await gotoArena(page);
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
    .toBe(0);
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

test("debug run export includes playtest report metadata and KPI data", async ({ page }) => {
  await gotoArena(page);
  const canvas = page.locator("canvas");
  await expect(canvas).toHaveCount(1);

  await page.evaluate(() => {
    window.__ARENA_DEBUG__?.restart();
    window.__ARENA_DEBUG__?.setElapsed(61);
    window.__ARENA_DEBUG__?.grantXp(3);
    window.__ARENA_DEBUG__?.step({ upgradeChoicePressed: 0 }, 1 / 60);
    window.__ARENA_DEBUG__?.forceDamage(12);
  });

  const runExport = await page.evaluate(() => window.__ARENA_DEBUG__?.getRunExport());
  expect(runExport).toBeTruthy();
  expect(runExport?.game).toBe("arena-core-phaser");
  expect(runExport?.appVersion).toBe(APP_VERSION);
  expect(runExport?.rulesetVersion).toBe(ENDLESS_RULESET_VERSION);
  expect(runExport?.configVersion).toBe(RULESET_VERSION);
  expect(runExport?.buildCommit).toMatch(/^[0-9a-f]{12}$/);
  expect(runExport?.runOrigin).toBe("test");
  expect(runExport?.rankEligibility).toEqual({
    eligible: false,
    reasons: ["automatedTest"],
  });
  expect(runExport?.seed).toBe(20260619);
  expect(runExport?.performance.frameSamples).toBeGreaterThan(0);
  expect(runExport?.performance.averageRawDtMs).toBeGreaterThan(0);
  expect(runExport?.performance.p95RawDtMs).toBeGreaterThan(0);
  expect(runExport?.performance.actualFps).toBeGreaterThan(0);
  expect(runExport?.resultSummary.elapsed).toBeCloseTo(61, 1);
  expect(runExport?.resultSummary.damageTaken).toBe(12);
  expect(runExport?.resultSummary.hpRecovered).toBe(0);
  expect(runExport?.stats.healPickupsCollected).toBe(0);
  expect(runExport?.resultSummary.capstoneMetrics).toMatchObject({
    obstacleRicochets: 0,
    boundaryRicochets: 0,
    boundaryRicochetsBySide: { left: 0, right: 0, top: 0, bottom: 0 },
    obstacleFollowUpHits: 0,
    boundaryFollowUpHits: 0,
  });
  expect(runExport?.stats.progressionMetrics.offers).toHaveLength(1);
  expect(runExport?.stats.progressionMetrics.selections).toHaveLength(1);
  expect(runExport?.stats.navigationMetrics).toEqual({
    directFrames: 0,
    pathFrames: 0,
    fallbackFrames: 0,
    fieldBuilds: 0,
  });
  expect(runExport?.resultSummary.level).toBeGreaterThanOrEqual(2);
  expect(runExport?.wave.start).toBe(60);
  expect(runExport?.counts.enemyTypes).toEqual({ chaser: 0, brute: 0, fast: 0, ranged: 0 });
  expect(runExport?.counts.obstacleContacts.player).toBe(0);
  expect(runExport?.choiceInteraction).toMatchObject({
    schemaVersion: 1,
    summary: { selectedCount: 0 },
  });
  expect(runExport?.bossShadow).toEqual({
    schemaVersion: 1,
    state: "not-reached",
    reason: "bossNotSpawned",
  });
  expect(runExport?.encounterRelief).toEqual({
    schemaVersion: 1,
    windowSeconds: 5,
    state: "not-reached",
    reason: "recoveryNotObserved",
  });
  expect(runExport?.runOutcomeInsight).toEqual({
    schemaVersion: 1,
    state: "not-reached",
    reason: "runNotTerminated",
  });
  expect(new Date(runExport!.capturedAt).toString()).not.toBe("Invalid Date");

  const runExportJson = await page.evaluate(() => window.__ARENA_DEBUG__?.getRunExportJson());
  const parsedRunExport = JSON.parse(runExportJson!);
  expect(parsedRunExport.game).toBe(runExport?.game);
  expect(parsedRunExport.configVersion).toBe(runExport?.configVersion);
  expect(parsedRunExport.resultSummary.damageTaken).toBe(runExport?.resultSummary.damageTaken);
  expect(parsedRunExport.choiceInteraction).toEqual(runExport?.choiceInteraction);
  expect(parsedRunExport.bossShadow).toEqual(runExport?.bossShadow);
  expect(parsedRunExport.encounterRelief).toEqual(runExport?.encounterRelief);
  expect(parsedRunExport.runOutcomeInsight).toEqual(runExport?.runOutcomeInsight);
});

test("downloads a run JSON from a Preview-compatible debug build", async ({ page }) => {
  await gotoArena(page);
  await expect.poll(() => page.evaluate(() => Boolean(window.__ARENA_DEBUG__))).toBe(true);

  const downloadPromise = page.waitForEvent("download");
  const result = await page.evaluate(() => window.__ARENA_DEBUG__?.downloadRunExport());
  const download = await downloadPromise;

  expect(result).toMatchObject({ ok: true });
  expect(download.suggestedFilename()).toBe(result?.filename);
  expect(download.suggestedFilename()).toMatch(
    /^arena-core-endless-arena-default-20260619-.+\.json$/,
  );
});

test("validates and separates explicit development run exports", async ({ page }) => {
  await gotoArena(page);
  await expect.poll(() => page.evaluate(() => Boolean(window.__ARENA_DEBUG__))).toBe(true);

  const invalidStatus = await page.evaluate(async () => {
    const response = await fetch("/__arena/run-export", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    return response.status;
  });
  expect(invalidStatus).toBe(400);

  const oversizedStatus = await page.evaluate(async () => {
    const response = await fetch("/__arena/run-export", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "x".repeat(2 * 1024 * 1024 + 1),
    });
    return response.status;
  });
  expect(oversizedStatus).toBe(413);

  const saved = await page.evaluate(() => window.__ARENA_DEBUG__?.saveRunExport());
  expect(saved).toMatchObject({
    ok: true,
    path: expect.stringMatching(/^logs\/tests\/.+_test_score-0_elapsed-0s\.json$/),
  });
});

test("URL seed overrides the automated fixed seed for reproducible runs", async ({ page }) => {
  await gotoArena(page, "/?seed=123456");
  const canvas = page.locator("canvas");
  await expect(canvas).toHaveCount(1);

  await page.evaluate(() => window.__ARENA_DEBUG__?.restart());

  const snapshot = await page.evaluate(() => window.__ARENA_DEBUG__?.getSnapshot());
  expect(snapshot?.seed).toBe(123456);

  const runExport = await page.evaluate(() => window.__ARENA_DEBUG__?.getRunExport());
  expect(runExport?.seed).toBe(123456);
});

test("debug heal fixture recovers HP through pickup collection", async ({ page }) => {
  await gotoArena(page);
  const canvas = page.locator("canvas");
  await expect(canvas).toHaveCount(1);

  await page.evaluate(() => {
    window.__ARENA_DEBUG__?.restart();
    window.__ARENA_DEBUG__?.setPaused(true);
    window.__ARENA_DEBUG__?.setHealPickupFixture("damaged");
  });
  const before = await page.evaluate(() => window.__ARENA_DEBUG__?.getSnapshot());

  await page.evaluate(() => window.__ARENA_DEBUG__?.step({}, 1 / 60));

  const after = await page.evaluate(() => window.__ARENA_DEBUG__?.getSnapshot());
  expect(after?.hp).toBeGreaterThan(before!.hp);
  expect(after?.pickupCount).toBe(0);
  expect(after?.stats.hpRecovered).toBeGreaterThan(0);
  expect(after?.stats.healPickupsCollected).toBe(1);
  expect(after?.stats.effectiveHealPickupsCollected).toBe(1);
  expect(after?.lastEvents.some((event) => event.type === "pickup.collected")).toBe(true);

  const runExport = await page.evaluate(() => window.__ARENA_DEBUG__?.getRunExport());
  expect(runExport?.stats.hpRecovered).toBe(after?.stats.hpRecovered);
  expect(runExport?.resultSummary.healPickupsCollected).toBe(1);
});

test("debug heal fixture separates full-HP collection from effective recovery", async ({ page }) => {
  await gotoArena(page);
  const canvas = page.locator("canvas");
  await expect(canvas).toHaveCount(1);

  await page.evaluate(() => {
    window.__ARENA_DEBUG__?.restart();
    window.__ARENA_DEBUG__?.setPaused(true);
    window.__ARENA_DEBUG__?.setHealPickupFixture("full");
    window.__ARENA_DEBUG__?.step({}, 1 / 60);
  });

  const snapshot = await page.evaluate(() => window.__ARENA_DEBUG__?.getSnapshot());
  expect(snapshot?.hp).toBe(100);
  expect(snapshot?.pickupCount).toBe(0);
  expect(snapshot?.stats.hpRecovered).toBe(0);
  expect(snapshot?.stats.healPickupsCollected).toBe(1);
  expect(snapshot?.stats.effectiveHealPickupsCollected).toBe(0);
});

test("soak protection does not pollute healing metrics", async ({ page }) => {
  await gotoArena(page);

  await page.evaluate(() => {
    const debug = window.__ARENA_DEBUG__;
    debug?.restart();
    debug?.restoreHealthForSoak();
    debug?.setPaused(true);
    debug?.setHealPickupFixture("full");
    debug?.step({}, 1 / 60);
  });

  const snapshot = await page.evaluate(() => window.__ARENA_DEBUG__?.getSnapshot());
  expect(snapshot?.status).toBe("playing");
  expect(snapshot?.hp).toBe(100);
  expect(snapshot?.stats.hpRecovered).toBe(0);
  expect(snapshot?.stats.damageTaken).toBe(0);
});

test("debug fatal heal fixture cannot revive on the damage frame", async ({ page }) => {
  await gotoArena(page);
  const canvas = page.locator("canvas");
  await expect(canvas).toHaveCount(1);

  await page.evaluate(() => {
    window.__ARENA_DEBUG__?.restart();
    window.__ARENA_DEBUG__?.setPaused(true);
    window.__ARENA_DEBUG__?.setHealPickupFixture("fatal");
    window.__ARENA_DEBUG__?.step({}, 1 / 60);
  });

  const snapshot = await page.evaluate(() => window.__ARENA_DEBUG__?.getSnapshot());
  expect(snapshot?.status).toBe("gameOver");
  expect(snapshot?.hp).toBe(0);
  expect(snapshot?.pickupCount).toBe(1);
  expect(snapshot?.stats.healPickupsCollected).toBe(0);
  expect(snapshot?.stats.hpRecovered).toBe(0);
  expect(snapshot?.lastEvents.some((event) => event.type === "pickup.collected")).toBe(false);
});

test("debug obstacle fixture slides along obstacle edges", async ({ page }) => {
  await gotoArena(page);
  const canvas = page.locator("canvas");
  await expect(canvas).toHaveCount(1);

  await page.evaluate(() => {
    window.__ARENA_DEBUG__?.restart();
    window.__ARENA_DEBUG__?.setObstacleFrictionFixture();
    window.__ARENA_DEBUG__?.setPaused(true);
  });

  const before = await page.evaluate(() => window.__ARENA_DEBUG__?.getSnapshot());
  expect(before?.obstacleContacts.player).toBe(0);

  await page.evaluate(() => {
    window.__ARENA_DEBUG__?.step({ move: { x: 1, y: 1 } }, 1 / 60);
  });

  const after = await page.evaluate(() => window.__ARENA_DEBUG__?.getSnapshot());
  expect(after?.player.x).toBeCloseTo(before!.player.x, 4);
  expect(after?.player.y).toBeGreaterThan(before!.player.y);
  expect(after?.obstacleContacts.player).toBe(0);
});

test("can enter upgrade selection and choose an upgrade", async ({ page }) => {
  await gotoArena(page);
  const canvas = page.locator("canvas");
  await expect(canvas).toHaveCount(1);

  await page.evaluate(() => {
    window.__ARENA_DEBUG__?.restart();
    window.__ARENA_DEBUG__?.forceUpgradeSelect();
  });

  await expect.poll(() => page.evaluate(() => window.__ARENA_DEBUG__?.getSnapshot().status)).toBe(
    "upgradeSelect",
  );
  const before = await page.evaluate(() => window.__ARENA_DEBUG__?.getSnapshot());
  expect(before?.pendingUpgradeChoices).toHaveLength(3);

  await page.locator("[data-choice-kind='upgrade']").first().click();

  await expect.poll(() => page.evaluate(() => window.__ARENA_DEBUG__?.getSnapshot().status)).toBe(
    "playing",
  );
  const after = await page.evaluate(() => window.__ARENA_DEBUG__?.getSnapshot());
  expect(after?.pendingUpgradeChoices).toEqual([]);
  expect(after?.stats.upgradesChosen).toBe(1);
  expect(after?.lastEvents.some((event) => event.type === "upgrade.selected")).toBe(true);
  expect(after?.audioCues).toContain("upgrade");
});

test("persists a run exactly once and restores it after reload", async ({ page }) => {
  await gotoArena(page);
  await page.evaluate(() => {
    window.__ARENA_DEBUG__?.restart();
    window.__ARENA_DEBUG__?.setElapsed(61);
    window.__ARENA_DEBUG__?.forceGameOver();
    window.__ARENA_DEBUG__?.forceGameOver();
  });

  await expect
    .poll(() => page.evaluate(() => window.__ARENA_DEBUG__?.getRunHistory().length))
    .toBe(1);
  const beforeReload = await page.evaluate(() => window.__ARENA_DEBUG__?.getRunHistory()[0]);
  expect(beforeReload?.runOrigin).toBe("test");
  expect(beforeReload?.rankEligibility.eligible).toBe(false);
  expect(await page.evaluate(() => window.__ARENA_DEBUG__?.getRunRankingRecords().length)).toBe(0);

  await page.reload();
  await expect.poll(() => page.evaluate(() => Boolean(window.__ARENA_DEBUG__))).toBe(true);
  const afterReload = await page.evaluate(() => window.__ARENA_DEBUG__?.getRunHistory());
  expect(afterReload).toHaveLength(1);
  expect(afterReload?.[0]?.id).toBe(beforeReload?.id);
});

test("recovers from corrupted run storage without blocking game boot", async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("arena-core.run-records.v2", "{broken");
  });
  await gotoArena(page);

  await expect.poll(() => page.evaluate(() => window.__ARENA_DEBUG__?.getSnapshot().status)).toBe(
    "title",
  );
  expect(await page.evaluate(() => window.__ARENA_DEBUG__?.getRunRecords())).toEqual([]);
  expect(
    await page.evaluate(() =>
      Object.keys(localStorage).some((key) => key.startsWith("arena-core.run-records.v2.corrupt.")),
    ),
  ).toBe(true);
});

test("keeps the result usable when run storage exceeds quota", async ({ page }) => {
  await page.addInitScript(() => {
    const originalSetItem = Storage.prototype.setItem;
    Storage.prototype.setItem = function setItem(key: string, value: string): void {
      if (key === "arena-core.run-records.v2") {
        throw new DOMException("quota exceeded", "QuotaExceededError");
      }
      originalSetItem.call(this, key, value);
    };
  });
  await gotoArena(page);
  await expect.poll(() => page.evaluate(() => Boolean(window.__ARENA_DEBUG__))).toBe(true);
  await page.evaluate(() => {
    window.__ARENA_DEBUG__?.restart();
    window.__ARENA_DEBUG__?.setElapsed(30);
    window.__ARENA_DEBUG__?.forceGameOver();
  });

  await expect.poll(() => page.evaluate(() => window.__ARENA_DEBUG__?.getSnapshot().status)).toBe(
    "gameOver",
  );
  const snapshot = await page.evaluate(() => window.__ARENA_DEBUG__?.getSnapshot());
  expect(snapshot?.latestRunRecord?.elapsed).toBe(30);
  expect(await page.evaluate(() => window.__ARENA_DEBUG__?.getRunHistory())).toEqual([]);
});

test("persists accessibility settings and disables automatic fire", async ({ page }) => {
  await gotoArena(page);
  await expect.poll(() => page.evaluate(() => Boolean(window.__ARENA_DEBUG__))).toBe(true);
  await page.evaluate(() => {
    window.__ARENA_DEBUG__?.updateSettings({
      bgmVolume: 0,
      sfxVolume: 0,
      bgmMuted: true,
      sfxMuted: true,
      shakeIntensity: 0,
      flashIntensity: 0,
      autoFireEnabled: false,
    });
    window.__ARENA_DEBUG__?.restart();
  });

  const canvas = page.locator("canvas");
  await moveMouseToCanvasAt(page, 640, 270);
  await page.waitForTimeout(260);
  expect(await page.evaluate(() => window.__ARENA_DEBUG__?.getSnapshot().stats.shotsFired)).toBe(0);

  await canvas.click({ button: "right" });
  await page.waitForTimeout(120);
  expect(await page.evaluate(() => window.__ARENA_DEBUG__?.getSnapshot().stats.shotsFired)).toBe(0);

  await canvas.click();
  await expect
    .poll(() => page.evaluate(() => window.__ARENA_DEBUG__?.getSnapshot().stats.shotsFired))
    .toBeGreaterThan(0);
  await page.evaluate(() => window.__ARENA_DEBUG__?.forceDamage(12));
  expect(
    await page.evaluate(() => window.__ARENA_DEBUG__?.getSnapshot().feedback.screenFlashAlpha),
  ).toBe(0);

  await page.reload();
  await expect.poll(() => page.evaluate(() => Boolean(window.__ARENA_DEBUG__))).toBe(true);
  expect(await page.evaluate(() => window.__ARENA_DEBUG__?.getSettings())).toMatchObject({
    bgmMuted: true,
    sfxMuted: true,
    shakeIntensity: 0,
    flashIntensity: 0,
    autoFireEnabled: false,
  });
});

test("supports keyboard navigation and Escape on secondary menus", async ({ page }) => {
  await gotoArena(page);
  await expect.poll(() => page.evaluate(() => Boolean(window.__ARENA_DEBUG__))).toBe(true);
  for (const key of [
    "ArrowDown",
    "ArrowDown",
    "ArrowDown",
    "ArrowDown",
    "Enter",
  ]) {
    await page.keyboard.down(key);
    await page.waitForTimeout(80);
    await page.keyboard.up(key);
    await page.waitForTimeout(40);
  }

  await expect
    .poll(() => page.evaluate(() => window.__ARENA_DEBUG__?.getSnapshot().secondaryMenu))
    .toBe("history");
  await page.keyboard.down("Escape");
  await page.waitForTimeout(80);
  await page.keyboard.up("Escape");
  await expect
    .poll(() => page.evaluate(() => window.__ARENA_DEBUG__?.getSnapshot().secondaryMenu))
    .toBeNull();
});

test("changes and resets settings through the pointer UI", async ({ page }) => {
  await gotoArena(page);
  await expect.poll(() => page.evaluate(() => Boolean(window.__ARENA_DEBUG__))).toBe(true);
  await page.evaluate(() => window.__ARENA_DEBUG__?.openMenu("settings"));

  await clickCanvasAt(page, 480, 159);
  await expect.poll(() => page.evaluate(() => window.__ARENA_DEBUG__?.getSettings().bgmVolume)).toBe(
    0.5,
  );

  await page.reload();
  await expect.poll(() => page.evaluate(() => Boolean(window.__ARENA_DEBUG__))).toBe(true);
  expect(await page.evaluate(() => window.__ARENA_DEBUG__?.getSettings().bgmVolume)).toBe(0.5);

  await page.evaluate(() => window.__ARENA_DEBUG__?.openMenu("settings"));
  await clickCanvasAt(page, 480, 395);
  await expect.poll(() => page.evaluate(() => window.__ARENA_DEBUG__?.getSettings())).toMatchObject({
    bgmVolume: 1,
    sfxVolume: 1,
    shakeIntensity: 1,
    flashIntensity: 1,
    autoFireEnabled: true,
  });
});

test("resets the guest profile without clearing settings or run records", async ({ page }) => {
  await gotoArena(page);
  await expect.poll(() => page.evaluate(() => Boolean(window.__ARENA_DEBUG__))).toBe(true);
  await page.evaluate(() => {
    window.__ARENA_DEBUG__?.restart();
    window.__ARENA_DEBUG__?.setElapsed(61);
    window.__ARENA_DEBUG__?.forceGameOver();
    window.__ARENA_DEBUG__?.updateSettings({ bgmVolume: 0.5 });
    window.__ARENA_DEBUG__?.openMenu("settings");
  });
  await expect.poll(() => page.evaluate(() => window.__ARENA_DEBUG__?.getRunHistory().length)).toBe(
    1,
  );
  const previousProfileId = await page.evaluate(() => window.__ARENA_DEBUG__?.getProfile().id);

  await clickCanvasAt(page, 480, 443);
  await expect
    .poll(() => page.evaluate(() => window.__ARENA_DEBUG__?.getProfile().id))
    .not.toBe(previousProfileId);
  expect(await page.evaluate(() => window.__ARENA_DEBUG__?.getSettings().bgmVolume)).toBe(0.5);
  expect(await page.evaluate(() => window.__ARENA_DEBUG__?.getRunHistory().length)).toBe(1);

  const newProfileId = await page.evaluate(() => window.__ARENA_DEBUG__?.getProfile().id);
  await page.reload();
  await expect.poll(() => page.evaluate(() => Boolean(window.__ARENA_DEBUG__))).toBe(true);
  expect(await page.evaluate(() => window.__ARENA_DEBUG__?.getProfile().id)).toBe(newProfileId);
  expect(await page.evaluate(() => window.__ARENA_DEBUG__?.getSettings().bgmVolume)).toBe(0.5);
  expect(await page.evaluate(() => window.__ARENA_DEBUG__?.getRunHistory().length)).toBe(1);
});

test("clears rankings and history independently after confirmation", async ({ page }) => {
  await gotoArena(page);
  await expect.poll(() => page.evaluate(() => Boolean(window.__ARENA_DEBUG__))).toBe(true);
  await page.evaluate(() => {
    window.__ARENA_DEBUG__?.restart();
    window.__ARENA_DEBUG__?.setElapsed(61);
    window.__ARENA_DEBUG__?.forceGameOver();
  });
  await expect.poll(() => page.evaluate(() => window.__ARENA_DEBUG__?.getRunHistory().length)).toBe(
    1,
  );

  await page.evaluate(() => {
    const key = "arena-core.run-records.v2";
    const raw = localStorage.getItem(key);
    if (!raw) throw new Error("Run record storage is missing.");
    const envelope = JSON.parse(raw) as {
      schemaVersion: 2;
      history: RunRecord[];
      rankings: RunRecord[];
    };
    const record = envelope.history[0];
    if (!record) throw new Error("Run history fixture is missing.");
    const eligibleRecord: RunRecord = {
      ...record,
      runOrigin: "manual",
      rankEligibility: { eligible: true, reasons: [] },
    };
    localStorage.setItem(key, JSON.stringify({ ...envelope, rankings: [eligibleRecord] }));
  });
  await page.reload();
  await expect
    .poll(() => page.evaluate(() => window.__ARENA_DEBUG__?.getRunRankingRecords().length))
    .toBe(1);

  await page.evaluate(() => window.__ARENA_DEBUG__?.openMenu("ranking"));
  await clickCanvasAt(page, 480, 463);
  await page.waitForTimeout(80);
  expect(await page.evaluate(() => window.__ARENA_DEBUG__?.getRunRankingRecords().length)).toBe(1);
  await clickCanvasAt(page, 480, 463);
  await expect
    .poll(() => page.evaluate(() => window.__ARENA_DEBUG__?.getRunRankingRecords().length))
    .toBe(0);
  expect(await page.evaluate(() => window.__ARENA_DEBUG__?.getRunHistory().length)).toBe(1);

  await page.evaluate(() => window.__ARENA_DEBUG__?.openMenu("history"));
  await clickCanvasAt(page, 480, 463);
  await page.waitForTimeout(80);
  expect(await page.evaluate(() => window.__ARENA_DEBUG__?.getRunHistory().length)).toBe(1);
  await clickCanvasAt(page, 480, 463);
  await expect.poll(() => page.evaluate(() => window.__ARENA_DEBUG__?.getRunHistory().length)).toBe(
    0,
  );
});

test("navigates from results to history and back to title", async ({ page }) => {
  await gotoArena(page);
  await expect.poll(() => page.evaluate(() => Boolean(window.__ARENA_DEBUG__))).toBe(true);
  await page.evaluate(() => {
    window.__ARENA_DEBUG__?.restart();
    window.__ARENA_DEBUG__?.forceGameOver();
  });

  await clickCanvasAt(page, 480, 463);
  await expect
    .poll(() => page.evaluate(() => window.__ARENA_DEBUG__?.getSnapshot().secondaryMenu))
    .toBe("history");
  await page.keyboard.down("Escape");
  await page.waitForTimeout(80);
  await page.keyboard.up("Escape");
  await expect
    .poll(() => page.evaluate(() => window.__ARENA_DEBUG__?.getSnapshot().secondaryMenu))
    .toBeNull();

  await clickCanvasAt(page, 480, 491);
  await expect.poll(() => page.evaluate(() => window.__ARENA_DEBUG__?.getSnapshot().status)).toBe(
    "title",
  );
});

test("loads local audio assets without page errors", async ({ page }) => {
  const failedAudio: string[] = [];
  const loadedAudio = new Set<string>();
  page.on("response", (response) => {
    if (!response.url().includes("/audio/")) return;
    if (response.status() >= 400) failedAudio.push(`${response.status()} ${response.url()}`);
    else loadedAudio.add(new URL(response.url()).pathname);
  });
  await gotoArena(page);
  await expect.poll(() => page.evaluate(() => Boolean(window.__ARENA_DEBUG__))).toBe(true);
  expect(await page.evaluate(() => window.__ARENA_DEBUG__?.getSnapshot().music)).toMatchObject({
    loaded: true,
    playing: false,
  });

  await clickCanvasAt(page, 480, 307);
  await expect.poll(() => page.evaluate(() => window.__ARENA_DEBUG__?.getSnapshot().status)).toBe(
    "weaponSelect",
  );
  await page.locator("[data-choice-kind='weapon'][data-choice-id='pulse']").click();
  await expect.poll(() => page.evaluate(() => window.__ARENA_DEBUG__?.getSnapshot().status)).toBe(
    "playing",
  );
  await expect.poll(() => page.evaluate(() => window.__ARENA_DEBUG__?.getSnapshot().music.playing)).toBe(
    true,
  );
  await expect
    .poll(() => page.evaluate(() => window.__ARENA_DEBUG__?.getSnapshot().music.volume))
    .toBeCloseTo(0.78);

  await page.evaluate(() => window.__ARENA_DEBUG__?.step({ pausePressed: true }, 1 / 60));
  await expect.poll(() => page.evaluate(() => window.__ARENA_DEBUG__?.getSnapshot().music.volume)).toBeCloseTo(
    0.32,
  );
  await page.evaluate(() => window.__ARENA_DEBUG__?.forceGameOver());
  await expect.poll(() => page.evaluate(() => window.__ARENA_DEBUG__?.getSnapshot().music.playing)).toBe(
    false,
  );
  expect(failedAudio).toEqual([]);
  expect([...loadedAudio].sort()).toEqual(
    [
      "arena-loop.ogg",
      "damage-alt-1.ogg",
      "damage.ogg",
      "expedition-clear-loop.ogg",
      "game-over.ogg",
      "hit-alt-1.ogg",
      "hit-alt-2.ogg",
      "hit.ogg",
      "kill-alt-1.ogg",
      "kill.ogg",
      "level-up.ogg",
      "pickup-alt-1.ogg",
      "pickup.ogg",
      "shot-alt-1.ogg",
      "shot-alt-2.ogg",
      "shot.ogg",
      "upgrade.ogg",
    ].map((name) => `/audio/${name}`),
  );
});

test("selects spread as the run weapon and preserves it on restart", async ({ page }) => {
  await gotoArena(page, "/?seed=20260619");

  await clickCanvasAt(page, 480, 307);
  await expect.poll(() => page.evaluate(() => window.__ARENA_DEBUG__?.getSnapshot().status)).toBe(
    "weaponSelect",
  );
  await page.locator("[data-choice-kind='weapon'][data-choice-id='spread']").click();
  await expect.poll(() => page.evaluate(() => window.__ARENA_DEBUG__?.getSnapshot().status)).toBe(
    "playing",
  );

  const selected = await page.evaluate(() => window.__ARENA_DEBUG__?.getSnapshot());
  expect(selected?.status).toBe("playing");
  expect(selected?.weaponType).toBe("spread");
  expect(selected?.runContext?.weaponId).toBe("spread");
  expect(selected?.seed).toBe(20260619);

  await page.evaluate(() => window.__ARENA_DEBUG__?.restart());
  const restarted = await page.evaluate(() => window.__ARENA_DEBUG__?.getSnapshot());
  expect(restarted?.weaponType).toBe("spread");
  expect(restarted?.runContext?.weaponId).toBe("spread");
  expect(restarted?.seed).toBe(20260619);
});

test("replays the encounter deck timeline and excludes overdrive contracts from ranking", async ({ page }) => {
  await gotoArena(page, "/?seed=20260619");
  await page.evaluate(() => {
    const debug = window.__ARENA_DEBUG__;
    debug?.restart();
    debug?.step({}, 1 / 60);
  });
  const scheduledAt = await page.evaluate(
    () => window.__ARENA_DEBUG__?.getSnapshot().encounter.director.scheduledAt,
  );
  expect(scheduledAt).toBeGreaterThanOrEqual(135);
  expect(scheduledAt).toBeLessThanOrEqual(165);

  await page.evaluate((scheduled) => {
    const debug = window.__ARENA_DEBUG__;
    if (scheduled === null) throw new Error("Encounter was not scheduled.");
    debug?.setElapsed(scheduled - 5);
    debug?.step({}, 1 / 60);
  }, scheduledAt!);
  await expect
    .poll(() => page.evaluate(() => window.__ARENA_DEBUG__?.getSnapshot().encounter.director.phase))
    .toBe("warning");

  await page.evaluate((scheduled) => {
    const debug = window.__ARENA_DEBUG__;
    if (scheduled === null) throw new Error("Encounter was not scheduled.");
    debug?.setElapsed(scheduled + 40);
    debug?.step({}, 1 / 60);
  }, scheduledAt!);
  const partialRelief = await page.evaluate(
    () => window.__ARENA_DEBUG__?.getSnapshot().encounterRelief,
  );
  expect(partialRelief).toMatchObject({
    state: "available",
    summary: { completeWindowCount: 0, partialWindowCount: 1 },
    episodes: [{ windowState: "partial" }],
  });

  await page.evaluate((targetEndsAt) => {
    const debug = window.__ARENA_DEBUG__;
    debug?.setElapsed(targetEndsAt);
    debug?.step({}, 1 / 60);
  }, partialRelief!.state === "available" ? partialRelief!.episodes[0]!.targetEndsAt : 0);
  const completedRelief = await page.evaluate(
    () => window.__ARENA_DEBUG__?.getRunExport().encounterRelief,
  );
  expect(completedRelief).toMatchObject({
    state: "available",
    summary: { completeWindowCount: 1, partialWindowCount: 0 },
    episodes: [{ windowState: "complete", encounterId: expect.any(String) }],
  });

  await page.evaluate(() => {
    const debug = window.__ARENA_DEBUG__;
    debug?.setElapsed(240);
    debug?.step({}, 1 / 60);
  });
  await expect.poll(() => page.evaluate(() => window.__ARENA_DEBUG__?.getSnapshot().status)).toBe(
    "contractSelect",
  );

  await page.locator("[data-choice-kind='contract'][data-choice-id='overdrive']").click();
  await expect.poll(() => page.evaluate(() => window.__ARENA_DEBUG__?.getSnapshot().status)).toBe(
    "playing",
  );
  const selected = await page.evaluate(() => window.__ARENA_DEBUG__?.getSnapshot());
  expect(selected?.encounter.contract).toMatchObject({
    choice: "overdrive",
    enemySpeedMultiplier: 1.12,
    scoreMultiplier: 1.3,
  });
  expect(selected?.runContext?.modifierIds).toContain("contract:overdrive");
  expect(selected?.runContext?.rankEligibility.reasons).toContain("nonStandardRuleset");

  await page.evaluate(() => window.__ARENA_DEBUG__?.forceGameOver());
  const record = await page.evaluate(() => window.__ARENA_DEBUG__?.getSnapshot().latestRunRecord);
  expect(record?.encounterMetrics.contractChoice).toBe("overdrive");
  expect(record?.rankEligibility.eligible).toBe(false);
});

test("offers and applies an extra upgrade after the normal build is complete", async ({ page }) => {
  await gotoArena(page, "/?seed=20260619");
  await page.evaluate(() => {
    window.__ARENA_DEBUG__?.restart();
    window.__ARENA_DEBUG__?.forceExtraUpgradeSelect();
  });

  const offered = await page.evaluate(() => window.__ARENA_DEBUG__?.getSnapshot());
  expect(offered?.status).toBe("upgradeSelect");
  expect(offered?.extraLevel).toBe(1);
  expect(offered?.extraCycle).toBe(1);
  expect(offered?.extraCycleRemaining).toEqual([
    "limitPower",
    "limitCycle",
    "limitDrive",
    "limitCore",
  ]);
  expect(offered?.pendingUpgradeChoices).toContain("limitPower");

  const choiceIndex = offered!.pendingUpgradeChoices.indexOf("limitPower");
  await page.evaluate((index) => {
    window.__ARENA_DEBUG__?.step({ upgradeChoicePressed: index }, 1 / 60);
  }, choiceIndex);

  const selected = await page.evaluate(() => window.__ARENA_DEBUG__?.getSnapshot());
  expect(selected?.status).toBe("playing");
  expect(selected?.extraUpgradeRanks.limitPower).toBe(1);
  expect(selected?.extraCycleRemaining).not.toContain("limitPower");
  expect(selected?.runtime.projectileDamageMultiplier).toBeCloseTo(1.08);
});

test("fits the canvas inside portrait and landscape mobile viewports", async ({ page }) => {
  for (const viewport of [
    { width: 390, height: 844 },
    { width: 844, height: 390 },
  ]) {
    await page.setViewportSize(viewport);
    await gotoArena(page);
    const box = await page.locator("canvas").boundingBox();
    expect(box).toBeTruthy();
    expect(box!.width).toBeLessThanOrEqual(viewport.width);
    expect(box!.height).toBeLessThanOrEqual(viewport.height);
    expect(
      await page.evaluate(() => ({
        width: document.documentElement.scrollWidth,
        height: document.documentElement.scrollHeight,
      })),
    ).toEqual({ width: viewport.width, height: viewport.height });
  }
});
