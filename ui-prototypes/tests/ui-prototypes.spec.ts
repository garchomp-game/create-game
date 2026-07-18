import { expect, test, type Page } from "@playwright/test";

const concepts = ["tactical", "recovery", "arcade"] as const;
const screens = ["title", "stage", "upgrade", "combat", "result"] as const;
const viewports = [
  { id: "landscape", width: 960, height: 540 },
  { id: "portrait", width: 390, height: 844 },
] as const;

test("compares the same information and supports semantic navigation", async ({ page }) => {
  await page.goto("/");

  await expect(page.locator("[data-prototype-canvas]")).toHaveCount(3);
  await expect(page.locator("[data-prototype-canvas] .brand-block h1")).toHaveText([
    "ARENA CORE",
    "ARENA CORE",
    "ARENA CORE",
  ]);

  await page.getByLabel("デザイン案").getByRole("button", { name: "A 戦術管制" }).click();
  await expect(page.locator("[data-prototype-canvas]")).toHaveAttribute("data-concept", "tactical");
  await expect(page).toHaveURL(/concept=tactical/);

  const titleTab = page.getByRole("button", { name: "タイトル" });
  await titleTab.focus();
  await page.keyboard.press("ArrowRight");
  await expect(page.locator("[data-prototype-canvas]")).toHaveAttribute("data-screen", "stage");
  await expect(page.getByRole("button", { name: /敵指揮艦決戦/ })).toHaveAttribute(
    "aria-pressed",
    "true",
  );

  await page.getByRole("button", { name: /回収線崩壊/ }).click();
  await expect(page.locator("#selected-stage-title")).toHaveText("回収線崩壊");
  await page.getByRole("button", { name: "横画面" }).click();
  await page.getByRole("button", { name: "縦画面" }).click();
  await expect(page.locator("[data-prototype-canvas]")).toHaveClass(/prototype-frame--portrait/);
});

test("keeps upgrade data equivalent across all concepts", async ({ page }) => {
  await page.goto("/?concept=compare&screen=upgrade&viewport=landscape");
  const frames = page.locator("[data-prototype-canvas]");
  await expect(frames).toHaveCount(3);

  for (const frame of await frames.all()) {
    await expect(frame.locator("[data-select-upgrade]")).toHaveCount(3);
    await expect(frame.locator("[data-select-upgrade] > strong")).toHaveText([
      "集束共鳴",
      "軽快な足取り",
      "生命コア",
    ]);
  }
});

test("keeps interactive controls named and focusable", async ({ page }) => {
  await page.goto("/?concept=arcade&screen=result&viewport=landscape");
  const unnamedButtons = await page.locator("button").evaluateAll((buttons) =>
    buttons.filter((button) => {
      const name = button.getAttribute("aria-label") ?? button.textContent ?? "";
      return name.trim().length === 0;
    }).length,
  );
  expect(unnamedButtons).toBe(0);

  await page.keyboard.press("Tab");
  await expect(page.locator(":focus")).toBeVisible();
});

test("fits all focused screens inside their target frame", async ({ page }) => {
  for (const viewport of viewports) {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    for (const concept of concepts) {
      for (const screen of screens) {
        await openCapture(page, concept, screen, viewport.id);
        const overflow = await findFrameOverflow(page);
        expect(overflow, `${concept}/${screen}/${viewport.id}`).toEqual([]);
      }
    }
  }
});

for (const concept of concepts) {
  test(`${concept} landscape combat visual`, async ({ page }) => {
    await page.setViewportSize({ width: 960, height: 540 });
    await openCapture(page, concept, "combat", "landscape");
    await expect(page).toHaveScreenshot(`${concept}-combat-landscape.png`, {
      animations: "disabled",
    });
  });

  test(`${concept} portrait result visual`, async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await openCapture(page, concept, "result", "portrait");
    await expect(page).toHaveScreenshot(`${concept}-result-portrait.png`, {
      animations: "disabled",
    });
  });
}

test("three-way stage comparison visual", async ({ page }) => {
  await page.setViewportSize({ width: 1600, height: 900 });
  await page.goto("/?concept=compare&screen=stage&viewport=landscape");
  await expect(page.locator("[data-prototype-canvas]")).toHaveCount(3);
  await expect(page.locator("[data-comparison-grid]")).toHaveScreenshot(
    "compare-stage-landscape.png",
    {
      animations: "disabled",
    },
  );
});

test("three-way upgrade comparison visual", async ({ page }) => {
  await page.setViewportSize({ width: 1600, height: 900 });
  await page.goto("/?concept=compare&screen=upgrade&viewport=landscape");
  await expect(page.locator("[data-prototype-canvas]")).toHaveCount(3);
  await expect(page.locator("[data-comparison-grid]")).toHaveScreenshot(
    "compare-upgrade-landscape.png",
    {
      animations: "disabled",
    },
  );
});

async function openCapture(
  page: Page,
  concept: (typeof concepts)[number],
  screen: (typeof screens)[number],
  viewport: (typeof viewports)[number]["id"],
): Promise<void> {
  await page.goto(
    `/?capture=1&concept=${concept}&screen=${screen}&viewport=${viewport}`,
  );
  await expect(page.locator("[data-prototype-canvas]")).toHaveAttribute(
    "data-screen",
    screen,
  );
}

async function findFrameOverflow(page: Page): Promise<string[]> {
  return page.locator("[data-prototype-canvas]").evaluate((frame) => {
    const frameRect = frame.getBoundingClientRect();
    return [...frame.querySelectorAll<HTMLElement>("*")]
      .filter((element) => {
        const style = getComputedStyle(element);
        if (style.display === "none" || style.visibility === "hidden") return false;
        const rect = element.getBoundingClientRect();
        return (
          rect.left < frameRect.left - 1 ||
          rect.right > frameRect.right + 1 ||
          rect.top < frameRect.top - 1 ||
          rect.bottom > frameRect.bottom + 1
        );
      })
      .map((element) => {
        const name = element.className || element.tagName.toLowerCase();
        return typeof name === "string" ? name : element.tagName.toLowerCase();
      });
  });
}
