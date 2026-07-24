import { expect, type Page, test } from "@playwright/test";

test.use({ deviceScaleFactor: 2 });

async function clickCanvasLogical(page: Page, x: number, y: number): Promise<void> {
  const canvas = page.locator("canvas");
  const box = await canvas.boundingBox();
  if (!box) throw new Error("Canvas is not visible.");
  const size = await canvas.evaluate((node: HTMLCanvasElement) => ({
    width: node.width,
    height: node.height,
  }));
  await page.mouse.move(
    box.x + (x / size.width) * box.width,
    box.y + (y / size.height) * box.height,
  );
  await page.mouse.down();
  await page.waitForTimeout(80);
  await page.mouse.up();
}

async function expectChoiceCardsFit(page: Page, expectedCount: number): Promise<void> {
  const overlay = page.locator(".arena-choice-overlay--visible");
  const cards = overlay.locator(".arena-choice-card");
  await expect(cards).toHaveCount(expectedCount);

  const overlayBox = await overlay.boundingBox();
  if (!overlayBox) throw new Error("Choice overlay is not visible.");
  const cardBoxes = await cards.evaluateAll((nodes) =>
    nodes.map((node) => {
      const rect = node.getBoundingClientRect();
      return {
        left: rect.left,
        top: rect.top,
        right: rect.right,
        bottom: rect.bottom,
        horizontalOverflow: node.scrollWidth - node.clientWidth,
        verticalOverflow: node.scrollHeight - node.clientHeight,
      };
    }),
  );
  for (const box of cardBoxes) {
    expect(box.left).toBeGreaterThanOrEqual(overlayBox.x);
    expect(box.top).toBeGreaterThanOrEqual(overlayBox.y);
    expect(box.right).toBeLessThanOrEqual(overlayBox.x + overlayBox.width);
    expect(box.bottom).toBeLessThanOrEqual(overlayBox.y + overlayBox.height);
    expect(box.horizontalOverflow).toBe(0);
    expect(box.verticalOverflow).toBe(0);
  }
}

test("uses aligned semantic DOM controls at high pixel density", async ({ page }) => {
  await page.goto("/");
  await expect.poll(() => page.evaluate(() => Boolean(window.__ARENA_DEBUG__))).toBe(true);
  await clickCanvasLogical(page, 480, 307);
  await expect.poll(() => page.evaluate(() => window.__ARENA_DEBUG__?.getSnapshot().status)).toBe(
    "weaponSelect",
  );

  const overlay = page.locator(".arena-choice-overlay--visible");
  const canvas = page.locator("canvas");
  const weaponChoices = overlay.locator("[data-choice-kind='weapon']");
  await expect(overlay).toBeVisible();
  await expect(weaponChoices).toHaveCount(2);
  await expect(weaponChoices.first()).toHaveJSProperty("tagName", "BUTTON");
  await expect(overlay).toBeFocused();
  await expect(weaponChoices.first()).toHaveAttribute("aria-keyshortcuts", "1");
  await expect(weaponChoices.first().locator("kbd.arena-choice-index")).toHaveText("1");
  await expect(weaponChoices.first().locator(".arena-choice-card-action")).toHaveText(
    "この武器で開始",
  );
  expect(await page.evaluate(() => window.devicePixelRatio)).toBe(2);

  const [overlayBox, canvasBox] = await Promise.all([overlay.boundingBox(), canvas.boundingBox()]);
  expect(overlayBox).toEqual(canvasBox);
  const typography = await weaponChoices.first().evaluate((node) => {
    const style = getComputedStyle(node);
    return { fontFamily: style.fontFamily, cursor: style.cursor };
  });
  expect(typography.fontFamily).toContain("Noto Sans CJK JP");
  expect(typography.cursor).toBe("pointer");

  await page.keyboard.press("2");
  await expect.poll(() => page.evaluate(() => window.__ARENA_DEBUG__?.getSnapshot().status)).toBe(
    "playing",
  );
  expect(await page.evaluate(() => window.__ARENA_DEBUG__?.getSnapshot().weaponType)).toBe(
    "spread",
  );
  await page.evaluate(() => window.__ARENA_DEBUG__?.forceUpgradeSelect());
  const upgrades = page.locator("[data-choice-kind='upgrade']");
  await expect(upgrades).toHaveCount(3);
  await upgrades.first().focus();
  await page.keyboard.press("Enter");
  await expect.poll(() => page.evaluate(() => window.__ARENA_DEBUG__?.getSnapshot().status)).toBe(
    "playing",
  );
});

test("stacks upgrade cards across the full portrait viewport", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await expect.poll(() => page.evaluate(() => Boolean(window.__ARENA_DEBUG__))).toBe(true);
  await page.evaluate(() => {
    window.__ARENA_DEBUG__?.restart();
    window.__ARENA_DEBUG__?.forceUpgradeSelect();
  });

  const overlay = page.locator(".arena-choice-overlay--visible");
  const cards = overlay.locator("[data-choice-kind='upgrade']");
  await expect(overlay).toHaveClass(/arena-choice-overlay--portrait/);
  await expect(overlay).toHaveCSS("background-color", "rgba(2, 6, 23, 0.16)");
  const overlayBox = await overlay.boundingBox();
  expect(overlayBox).toMatchObject({ x: 0, y: 0, width: 390, height: 844 });
  const first = await cards.nth(0).boundingBox();
  const second = await cards.nth(1).boundingBox();
  expect(first).not.toBeNull();
  expect(second).not.toBeNull();
  expect(second!.y).toBeGreaterThan(first!.y + first!.height);
  expect(await cards.first().locator(".arena-choice-card-title").evaluate((node) =>
    Number.parseFloat(getComputedStyle(node).fontSize),
  )).toBeGreaterThanOrEqual(20);
  expect(
    await overlay.evaluate((node) => ({
      horizontal: node.scrollWidth - node.clientWidth,
      vertical: node.scrollHeight - node.clientHeight,
    })),
  ).toEqual({ horizontal: 0, vertical: 0 });
  expect(
    await cards.evaluateAll((nodes) =>
      nodes.map((node) => ({
        horizontal: node.scrollWidth - node.clientWidth,
        vertical: node.scrollHeight - node.clientHeight,
      })),
    ),
  ).toEqual([
    { horizontal: 0, vertical: 0 },
    { horizontal: 0, vertical: 0 },
    { horizontal: 0, vertical: 0 },
  ]);
});

test("fits weapon, EX, and contract choices in portrait", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await expect.poll(() => page.evaluate(() => Boolean(window.__ARENA_DEBUG__))).toBe(true);

  await clickCanvasLogical(page, 480, 307);
  await expect.poll(() => page.evaluate(() => window.__ARENA_DEBUG__?.getSnapshot().status)).toBe(
    "weaponSelect",
  );
  await expectChoiceCardsFit(page, 2);

  await page.evaluate(() => window.__ARENA_DEBUG__?.forceExtraUpgradeSelect());
  await expect.poll(() => page.evaluate(() => window.__ARENA_DEBUG__?.getSnapshot().status)).toBe(
    "upgradeSelect",
  );
  await expect(page.locator(".arena-choice-shell")).toHaveAttribute("data-choice-phase", "extra");
  await expectChoiceCardsFit(page, 3);

  await page.goto("/");
  await expect.poll(() => page.evaluate(() => Boolean(window.__ARENA_DEBUG__))).toBe(true);
  await page.evaluate(() => {
    const debug = window.__ARENA_DEBUG__;
    debug?.restart();
    debug?.step({}, 1 / 60);
    const scheduledAt = debug?.getSnapshot().encounter.director.scheduledAt;
    if (scheduledAt === null || scheduledAt === undefined) {
      throw new Error("Encounter was not scheduled.");
    }
    debug?.setElapsed(scheduledAt + 40);
    debug?.step({}, 1 / 60);
    debug?.setElapsed(240);
    debug?.step({}, 1 / 60);
  });
  await expect.poll(() => page.evaluate(() => window.__ARENA_DEBUG__?.getSnapshot().status)).toBe(
    "contractSelect",
  );
  await expectChoiceCardsFit(page, 2);
});

test("keeps the previous aim active after a number-key upgrade", async ({ page }) => {
  await page.goto("/");
  await expect.poll(() => page.evaluate(() => Boolean(window.__ARENA_DEBUG__))).toBe(true);
  await page.evaluate(() => window.__ARENA_DEBUG__?.restart());
  await expect.poll(() => page.evaluate(() => window.__ARENA_DEBUG__?.getSnapshot().status)).toBe(
    "playing",
  );

  const canvas = page.locator("canvas");
  const box = await canvas.boundingBox();
  if (!box) throw new Error("Canvas is not visible.");
  const size = await canvas.evaluate((node: HTMLCanvasElement) => ({
    width: node.width,
    height: node.height,
  }));
  await page.mouse.move(
    box.x + (720 / size.width) * box.width,
    box.y + (270 / size.height) * box.height,
  );
  await expect
    .poll(() => page.evaluate(() => window.__ARENA_DEBUG__?.getSnapshot().stats.shotsFired))
    .toBeGreaterThan(0);

  const before = await page.evaluate(() => {
    const snapshot = window.__ARENA_DEBUG__?.getSnapshot();
    return snapshot
      ? { shotsFired: snapshot.stats.shotsFired, lastAim: snapshot.lastAim }
      : null;
  });
  if (!before) throw new Error("Arena snapshot is unavailable.");

  await page.evaluate(() => window.__ARENA_DEBUG__?.forceUpgradeSelect(true));
  await expect.poll(() => page.evaluate(() => window.__ARENA_DEBUG__?.getSnapshot().status)).toBe(
    "upgradeSelect",
  );
  await expect(page.locator(".arena-choice-overlay--visible")).toBeFocused();
  await page.keyboard.press("1");
  await expect.poll(() => page.evaluate(() => window.__ARENA_DEBUG__?.getSnapshot().status)).toBe(
    "playing",
  );
  await expect
    .poll(() => page.evaluate(() => window.__ARENA_DEBUG__?.getSnapshot().stats.shotsFired))
    .toBeGreaterThan(before.shotsFired);
  expect(await page.evaluate(() => window.__ARENA_DEBUG__?.getSnapshot().lastAim)).toEqual(
    before.lastAim,
  );
});

test("records pointer and keyboard choices with a one-second resume window", async ({ page }) => {
  await page.goto("/");
  await expect.poll(() => page.evaluate(() => Boolean(window.__ARENA_DEBUG__))).toBe(true);
  await page.evaluate(() => {
    window.__ARENA_DEBUG__?.restart();
    window.__ARENA_DEBUG__?.forceUpgradeSelect();
  });

  const firstUpgrade = page.locator("[data-choice-kind='upgrade']").first();
  await firstUpgrade.click();
  await expect.poll(() => page.evaluate(() => window.__ARENA_DEBUG__?.getSnapshot().status)).toBe(
    "playing",
  );
  const selectedAt = await page.evaluate(
    () => window.__ARENA_DEBUG__?.getSnapshot().choiceInteraction.samples[0]?.selectedAtSimulationSeconds,
  );
  expect(selectedAt).toBeDefined();

  const canvas = page.locator("canvas");
  const canvasBox = await canvas.boundingBox();
  if (!canvasBox) throw new Error("Canvas is not visible.");
  await page.mouse.move(canvasBox.x + canvasBox.width * 0.75, canvasBox.y + canvasBox.height * 0.5);
  await page.keyboard.down("w");
  await expect
    .poll(() => page.evaluate(() => window.__ARENA_DEBUG__?.getSnapshot().elapsed))
    .toBeGreaterThanOrEqual(selectedAt! + 1);
  await page.keyboard.up("w");

  const pointerReport = await page.evaluate(
    () => window.__ARENA_DEBUG__?.getSnapshot().choiceInteraction,
  );
  expect(pointerReport?.samples[0]).toMatchObject({
    phase: "upgrade",
    inputMethod: "pointer",
    resumeWindow: { completed: true },
  });
  expect(pointerReport!.samples[0]!.resumeWindow.movementInputFrames).toBeGreaterThan(0);
  expect(pointerReport!.samples[0]!.resumeWindow.aimInputFrames).toBeGreaterThan(0);

  await page.evaluate(() => window.__ARENA_DEBUG__?.forceExtraUpgradeSelect());
  const extraUpgrade = page.locator("[data-choice-kind='upgrade']").first();
  await extraUpgrade.focus();
  await page.keyboard.press("1");
  await expect.poll(() => page.evaluate(() => window.__ARENA_DEBUG__?.getSnapshot().status)).toBe(
    "playing",
  );
  const finalReport = await page.evaluate(
    () => window.__ARENA_DEBUG__?.getSnapshot().choiceInteraction,
  );
  expect(finalReport?.samples).toHaveLength(2);
  expect(finalReport?.samples[1]).toMatchObject({
    phase: "extra",
    inputMethod: "keyboard",
  });
  expect(finalReport?.summary.inputMethodCounts).toEqual({ keyboard: 1, pointer: 1 });
});
