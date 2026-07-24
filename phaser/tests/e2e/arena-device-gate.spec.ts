import { expect, test } from "@playwright/test";

test("blocks smartphone browsers before Phaser starts", async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(window.navigator, "userAgent", {
      configurable: true,
      get: () =>
        "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148",
    });
    Object.defineProperty(window.navigator, "platform", {
      configurable: true,
      get: () => "iPhone",
    });
    Object.defineProperty(window.navigator, "maxTouchPoints", {
      configurable: true,
      get: () => 5,
    });
  });

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");

  const gate = page.locator("[data-device-gate='unsupported']");
  await expect(gate).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "パソコンで開き直してください" }),
  ).toBeVisible();
  await expect(page.getByText("このゲームはパソコン専用です。")).toBeVisible();
  await expect(page.getByText(/キーボードとマウスを使ってプレイします/)).toBeVisible();
  await expect(page.locator("canvas")).toHaveCount(0);
  expect(await page.evaluate(() => window.__ARENA_DEBUG__)).toBeUndefined();
});

test("does not mistake a narrow desktop window for a smartphone", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");

  await expect(page.locator("[data-device-gate='unsupported']")).toHaveCount(0);
  await expect(page.locator("canvas")).toBeVisible();
});
