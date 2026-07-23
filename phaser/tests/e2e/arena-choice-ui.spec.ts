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
  expect(await page.evaluate(() => window.devicePixelRatio)).toBe(2);

  const [overlayBox, canvasBox] = await Promise.all([overlay.boundingBox(), canvas.boundingBox()]);
  expect(overlayBox).toEqual(canvasBox);
  const typography = await weaponChoices.first().evaluate((node) => {
    const style = getComputedStyle(node);
    return { fontFamily: style.fontFamily, cursor: style.cursor };
  });
  expect(typography.fontFamily).toContain("Noto Sans CJK JP");
  expect(typography.cursor).toBe("pointer");

  await page.keyboard.press("Tab");
  await expect(weaponChoices.first()).toBeFocused();
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
});

test("does not install candidate-only context menu handling", async ({ page }) => {
  await page.goto("/");
  await expect.poll(() => page.evaluate(() => Boolean(window.__ARENA_DEBUG__))).toBe(true);

  expect(
    await page.locator("canvas").evaluate((node) => {
      const event = new MouseEvent("contextmenu", {
        bubbles: true,
        cancelable: true,
      });
      return node.dispatchEvent(event);
    }),
  ).toBe(true);
});
