import { expect, type Page, test } from "@playwright/test";
import { APP_VERSION, RULESET_VERSION } from "../../src/config/version";
import { probeVisibleCanvasSamples, probeWebglCanvas } from "./webglCanvasProbe";

test("exposes the release identity and completes the primary input path", async ({ page }) => {
  const consoleErrors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });

  await page.goto("/");
  await expect(page.locator('meta[name="arena-app-version"]')).toHaveAttribute(
    "content",
    APP_VERSION,
  );
  await expect(page.locator('meta[name="arena-ruleset-version"]')).toHaveAttribute(
    "content",
    RULESET_VERSION,
  );
  await expect(page.locator('meta[name="arena-build-commit"]')).toHaveAttribute(
    "content",
    /^[0-9a-f]{12}$/,
  );

  const canvas = page.locator("canvas");
  await expect(canvas).toHaveCount(1);
  await expect.poll(() => canvas.evaluate((node) => (node as HTMLCanvasElement).width)).toBe(960);
  expect((await probeWebglCanvas(canvas)).kind).toBe("webgl");
  expect(await probeVisibleCanvasSamples(page, canvas)).toBeGreaterThan(0);
  expect(await hasHorizontalViewportOverflow(page)).toBe(false);

  await clickCanvasLogical(page, 480, 307);
  const pulseChoice = page.locator("[data-choice-kind='weapon'][data-choice-id='pulse']");
  await expect(pulseChoice).toBeVisible();
  await pulseChoice.click();
  await expect
    .poll(() => page.evaluate(() => window.__ARENA_DEBUG__?.getSnapshot().status))
    .toBe("playing");
  await canvas.click();
  await expect
    .poll(() => page.evaluate(() => window.__ARENA_DEBUG__?.getSnapshot().stats.shotsFired))
    .toBeGreaterThan(0);
  expect(consoleErrors).toEqual([]);
});

test("publishes privacy, feedback, licenses, and complete local-data deletion", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => {
    localStorage.setItem("arena-core.profile.v1", "profile");
    localStorage.setItem("arena-core.settings.v1", "settings");
    localStorage.setItem("arena-core.run-records.v2", "records");
    localStorage.setItem("unrelated.key", "keep");
  });
  await expect
    .poll(() => page.evaluate(() => window.__ARENA_DEBUG__?.getSnapshot().status))
    .toBe("title");
  await clickCanvasLogical(page, 620, 495);
  await expect(page).toHaveURL(/\/beta-info\.html$/);
  await expect(page.getByRole("heading", { name: "ARENA CORE" })).toBeVisible();
  await expect(page.locator("#app-version")).toHaveText(APP_VERSION);
  await expect(page.locator("#ruleset-version")).toHaveText(RULESET_VERSION);
  await expect(page.locator("#build-commit")).toHaveText(/^[0-9a-f]{12}$/);
  await expect(page.getByText("外部へ自動送信しません")).toBeVisible();
  await expect(page.getByRole("link", { name: "第三者ライセンス表記" })).toHaveAttribute(
    "href",
    "/third-party-notices.txt",
  );
  await expect(page.getByRole("link", { name: "GitHubで報告する" })).toHaveAttribute(
    "href",
    new RegExp(`appVersion%3A\\+${APP_VERSION.replaceAll(".", "\\.")}`),
  );
  expect(await hasHorizontalViewportOverflow(page)).toBe(false);

  const clearButton = page.getByRole("button", { name: "この端末のデータを削除" });
  await clearButton.click();
  await expect(page.getByRole("button", { name: "もう一度押して削除" })).toBeVisible();
  await page.getByRole("button", { name: "もう一度押して削除" }).click();
  await expect(page.getByRole("button", { name: "削除済み" })).toBeDisabled();

  const remaining = await page.evaluate(() => ({
    arenaKeys: Object.keys(localStorage).filter((key) => key.startsWith("arena-core.")),
    unrelated: localStorage.getItem("unrelated.key"),
  }));
  expect(remaining).toEqual({ arenaKeys: [], unrelated: "keep" });
});

test("starts, advances, and exits Training without creating a run record", async ({
  page,
}) => {
  await page.goto("/");
  await expect
    .poll(() => page.evaluate(() => window.__ARENA_DEBUG__?.getSnapshot().status))
    .toBe("title");

  await clickCanvasLogical(page, 480, 393);
  await expect
    .poll(() =>
      page.evaluate(
        () => window.__ARENA_DEBUG__?.getSnapshot().tutorial?.stepId,
      ),
    )
    .toBe("move");
  await expect(page.locator(".arena-tutorial-dialog--visible")).toBeVisible();
  await page.locator("[data-tutorial-action='continue']").click();
  await expect
    .poll(() =>
      page.evaluate(() => window.__ARENA_DEBUG__?.getSnapshot().tutorial?.phase),
    )
    .toBe("active");

  await page.keyboard.down("KeyD");
  await expect
    .poll(() =>
      page.evaluate(
        () => window.__ARENA_DEBUG__?.getSnapshot().tutorial?.stepId,
      ),
    )
    .toBe("navigate");
  await page.keyboard.up("KeyD");

  await page.waitForTimeout(100);
  await page.keyboard.down("Escape");
  await page.waitForTimeout(160);
  await page.keyboard.up("Escape");
  await expect
    .poll(() => page.evaluate(() => window.__ARENA_DEBUG__?.getSnapshot().status))
    .toBe("paused");
  await clickCanvasLogical(page, 480, 409);
  await expect
    .poll(() => page.evaluate(() => window.__ARENA_DEBUG__?.getSnapshot().status))
    .toBe("title");

  const records = await page.evaluate(() => ({
    history: window.__ARENA_DEBUG__?.getRunHistory() ?? [],
    rankings: window.__ARENA_DEBUG__?.getRunRankingRecords() ?? [],
    latest: window.__ARENA_DEBUG__?.getSnapshot().latestRunRecord ?? null,
  }));
  expect(records).toEqual({ history: [], rankings: [], latest: null });
});

async function clickCanvasLogical(page: Page, x: number, y: number): Promise<void> {
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

async function hasHorizontalViewportOverflow(page: Page): Promise<boolean> {
  return page.evaluate(
    () => document.documentElement.scrollWidth > window.innerWidth + 1,
  );
}
