import { mkdir } from "node:fs/promises";
import path from "node:path";
import { chromium } from "@playwright/test";

const baseUrl = process.env.ARENA_PUBLIC_URL ?? "https://arena-core.garchomp-game.workers.dev";
const expected = {
  appVersion: process.env.ARENA_EXPECTED_APP_VERSION ?? "0.6.8",
  rulesetVersion:
    process.env.ARENA_EXPECTED_RULESET_VERSION ??
    "phaser-v0.6.8-pulse-boundary-ricochet",
  buildCommit: process.env.ARENA_EXPECTED_BUILD_COMMIT ?? "ff686f992a65",
};
const expectedRunRulesetVersion =
  process.env.ARENA_EXPECTED_RUN_RULESET_VERSION ?? expected.rulesetVersion;
const gameOverTimeoutMs = Number(process.env.ARENA_GAME_OVER_TIMEOUT_MS ?? 180_000);
const outputDirectory = path.resolve("test-results", "production-smoke");
const consoleErrors = [];
const pageErrors = [];
const failedRequests = [];
const badResponses = [];

await mkdir(outputDirectory, { recursive: true });
const browser = await chromium.launch({
  headless: true,
  executablePath:
    process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ?? "/usr/bin/google-chrome",
  args: ["--disable-features=Translate,TranslateUI", "--disable-translate"],
});

try {
  const context = await browser.newContext({
    locale: "ja-JP",
    viewport: { width: 960, height: 540 },
  });
  const page = await context.newPage();
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  page.on("pageerror", (error) => pageErrors.push(error.message));
  page.on("requestfailed", (request) =>
    failedRequests.push(`${request.method()} ${request.url()} ${request.failure()?.errorText ?? ""}`),
  );
  page.on("response", (response) => {
    if (response.status() >= 400) badResponses.push(`${response.status()} ${response.url()}`);
  });

  const response = await page.goto(`${baseUrl}/`, { waitUntil: "networkidle" });
  assert(response?.status() === 200, `root returned ${response?.status() ?? "no response"}`);
  await page.locator("canvas").waitFor({ state: "visible" });
  await page.waitForTimeout(500);
  assert(
    (await readMeta(page, "arena-app-version")) === expected.appVersion,
    "appVersion meta mismatch",
  );
  assert(
    (await readMeta(page, "arena-ruleset-version")) === expected.rulesetVersion,
    "rulesetVersion meta mismatch",
  );
  assert(
    (await readMeta(page, "arena-build-commit")) === expected.buildCommit,
    "buildCommit meta mismatch",
  );
  assert(
    (await page.evaluate(() => "__ARENA_DEBUG__" in window)) === false,
    "production exposed window.__ARENA_DEBUG__",
  );
  await capture(page, "01-title.png");

  await clickCanvasLogical(page, 340, 495);
  await page.waitForTimeout(250);
  await capture(page, "02-settings.png");
  await clickCanvasLogical(page, 480, 347);
  await page.waitForTimeout(200);
  const autoFireEnabled = await page.evaluate(() => {
    const raw = localStorage.getItem("arena-core.settings.v1");
    return raw ? JSON.parse(raw).autoFireEnabled : null;
  });
  assert(autoFireEnabled === false, "settings did not persist auto-fire off");
  await pressGameKey(page, "Escape");

  await clickCanvasLogical(page, 340, 447);
  await page.waitForTimeout(200);
  await capture(page, "03-ranking.png");
  await pressGameKey(page, "Escape");

  await clickCanvasLogical(page, 620, 447);
  await page.waitForTimeout(200);
  await capture(page, "04-history-empty.png");
  await pressGameKey(page, "Escape");

  await clickCanvasLogical(page, 480, 307);
  const pulseChoice = page.locator("[data-choice-kind='weapon'][data-choice-id='pulse']");
  await pulseChoice.waitFor({ state: "visible" });
  await capture(page, "05-weapon-select.png");
  await pulseChoice.click();
  await page.waitForTimeout(300);
  await page.locator("canvas").click();
  await pressGameKey(page, "Space");
  await capture(page, "06-playing.png");

  const startedAt = Date.now();
  let record = null;
  while (Date.now() - startedAt < gameOverTimeoutMs) {
    record = await readLatestRunRecord(page);
    if (record) break;
    const elapsedSeconds = Math.round((Date.now() - startedAt) / 1_000);
    if (elapsedSeconds > 0 && elapsedSeconds % 15 === 0) {
      process.stdout.write(`waiting for natural game over: ${elapsedSeconds}s\n`);
    }
    await page.waitForTimeout(1_000);
  }
  assert(record, `natural game over did not finish within ${gameOverTimeoutMs}ms`);
  assert(record.appVersion === expected.appVersion, "saved appVersion mismatch");
  assert(record.rulesetVersion === expectedRunRulesetVersion, "saved rulesetVersion mismatch");
  assert(record.buildCommit === expected.buildCommit, "saved buildCommit mismatch");
  await page.waitForTimeout(300);
  await capture(page, "07-result.png");

  await clickCanvasLogical(page, 480, 463);
  await page.waitForTimeout(250);
  await capture(page, "08-history-saved.png");
  await pressGameKey(page, "Escape");

  await clickCanvasLogical(page, 480, 367);
  await page.waitForTimeout(800);
  await capture(page, "09-retry.png");
  await pressGameKey(page, "Escape");
  await capture(page, "10-paused.png");
  await clickCanvasLogical(page, 480, 409);
  await page.waitForTimeout(300);
  await capture(page, "11-returned-title.png");

  await clickCanvasLogical(page, 480, 339);
  const spreadChoice = page.locator(
    "[data-choice-kind='weapon'][data-choice-id='spread']",
  );
  await spreadChoice.waitFor({ state: "visible" });
  await capture(page, "12-expedition-weapon-select.png");
  await spreadChoice.click();
  await spreadChoice.waitFor({ state: "hidden" });
  await page.waitForTimeout(300);
  await capture(page, "13-expedition-spread.png");
  await pressGameKey(page, "Escape");
  await clickCanvasLogical(page, 480, 409);
  await page.waitForTimeout(300);

  await clickCanvasLogical(page, 620, 495);
  await page.waitForURL(/\/beta-info(?:\.html)?\/?$/);
  assert((await page.locator("#app-version").textContent()) === expected.appVersion, "beta app mismatch");
  assert(
    (await page.locator("#ruleset-version").textContent()) === expected.rulesetVersion,
    "beta ruleset mismatch",
  );
  assert(
    (await page.locator("#build-commit").textContent()) === expected.buildCommit,
    "beta build mismatch",
  );
  const notices = await page.request.get(`${baseUrl}/third-party-notices.txt`);
  assert(notices.status() === 200, `third-party notices returned ${notices.status()}`);
  await capture(page, "14-beta-info.png", true);

  assert(consoleErrors.length === 0, `console errors: ${consoleErrors.join(" | ")}`);
  assert(pageErrors.length === 0, `page errors: ${pageErrors.join(" | ")}`);
  assert(failedRequests.length === 0, `failed requests: ${failedRequests.join(" | ")}`);
  assert(badResponses.length === 0, `bad responses: ${badResponses.join(" | ")}`);

  process.stdout.write(
    `${JSON.stringify(
      {
        ok: true,
        baseUrl,
        ...expected,
        runRulesetVersion: expectedRunRulesetVersion,
        run: {
          score: record.score,
          elapsed: Number(record.elapsed.toFixed(2)),
          weaponId: record.weaponId,
          rankEligible: record.rankEligibility.eligible,
        },
        screenshots: outputDirectory,
      },
      null,
      2,
    )}\n`,
  );
} finally {
  await browser.close();
}

async function clickCanvasLogical(page, x, y) {
  const box = await page.locator("canvas").evaluate((node) => {
    const canvas = node;
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

async function pressGameKey(page, key) {
  await page.keyboard.down(key);
  await page.waitForTimeout(120);
  await page.keyboard.up(key);
  await page.waitForTimeout(150);
}

async function readMeta(page, name) {
  return page.locator(`meta[name="${name}"]`).getAttribute("content");
}

async function readLatestRunRecord(page) {
  return page.evaluate(() => {
    const raw = localStorage.getItem("arena-core.run-records.v2");
    if (!raw) return null;
    try {
      return JSON.parse(raw).history?.[0] ?? null;
    } catch {
      return null;
    }
  });
}

async function capture(page, filename, fullPage = false) {
  await page.screenshot({
    path: path.join(outputDirectory, filename),
    fullPage,
  });
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}
