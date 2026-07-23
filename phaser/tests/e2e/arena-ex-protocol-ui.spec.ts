import { expect, type Locator, type Page, test } from "@playwright/test";

test.skip(
  process.env.VITE_ARENA_EX_PROTOCOL_CANDIDATE !== "1",
  "EX Protocol UI runs only with the candidate profile enabled.",
);

test.use({ deviceScaleFactor: 2 });

test("selects Protocol, Evolution I/II, and enters Limit Break", async ({
  page,
}) => {
  await gotoCandidate(page);
  await page.evaluate(() => {
    window.__ARENA_DEBUG__?.restart();
    window.__ARENA_DEBUG__?.forceExProtocolSelect();
  });

  const overlay = page.locator(".arena-choice-overlay--visible");
  const protocolCards = overlay.locator("[data-choice-kind='protocol']");
  await expect(protocolCards).toHaveCount(3);
  await expect(protocolCards.first()).toHaveAttribute(
    "data-choice-id",
    /pulse\./,
  );
  await expect(protocolCards.nth(1)).toContainText("RMB / E");
  await expect(page.locator("#game")).toHaveScreenshot(
    "arena-ex-protocol-select.png",
    { maxDiffPixelRatio: 0.01 },
  );

  await protocolCards.nth(0).click();
  await expectStatus(page, "playing");
  await page.evaluate(() =>
    window.__ARENA_DEBUG__?.forceExEvolutionSelect(1),
  );
  const evolutionOne = overlay.locator("[data-choice-kind='evolution']");
  await expect(evolutionOne).toHaveCount(2);
  await expect(overlay).toContainText("EVOLUTION I");
  await expect(evolutionOne.nth(0)).toContainText("0.9秒 → 1.5秒");

  await evolutionOne.nth(0).focus();
  await page.keyboard.press("1");
  await expectStatus(page, "playing");
  await page.evaluate(() =>
    window.__ARENA_DEBUG__?.forceExEvolutionSelect(2),
  );
  await expect(overlay).toContainText("EVOLUTION II");
  await expect(overlay).toContainText(
    "MASTERY 自動解禁: 交差結合 / Crosslink",
  );
  await expect(page.locator("#game")).toHaveScreenshot(
    "arena-ex-evolution-two.png",
    { maxDiffPixelRatio: 0.01 },
  );

  await overlay
    .locator("[data-choice-kind='evolution'][data-choice-id='endpoint-priming']")
    .click();
  await expectStatus(page, "playing");
  await page.evaluate(() => {
    const debug = window.__ARENA_DEBUG__;
    if (!debug) throw new Error("Debug API is not available.");
    debug.grantXp(debug.getSnapshot().xpToNext);
  });
  await expectStatus(page, "upgradeSelect");
  await expect(overlay).toContainText("LIMIT BREAK CYCLE");
  await expect(overlay).not.toContainText("EXTRA LEVEL");
});

test("coalesces right click into special input without normal shooting", async ({
  page,
}) => {
  await gotoCandidate(page);
  await page.evaluate(() => {
    const debug = window.__ARENA_DEBUG__;
    if (!debug) throw new Error("Debug API is not available.");
    debug.restart();
    debug.updateSettings({ autoFireEnabled: false });
    debug.forceExProtocolSelect();
  });
  await page
    .locator(
      "[data-choice-kind='protocol'][data-choice-id='pulse.rebound-overdrive']",
    )
    .click();
  await expectStatus(page, "playing");

  const before = await page.evaluate(
    () => window.__ARENA_DEBUG__?.getSnapshot().stats.shotsFired ?? -1,
  );
  const canvas = page.locator("canvas");
  const box = await canvas.boundingBox();
  if (!box) throw new Error("Canvas is not visible.");
  await page.mouse.move(box.x + box.width * 0.8, box.y + box.height * 0.5);
  await page.mouse.click(
    box.x + box.width * 0.8,
    box.y + box.height * 0.5,
    { button: "right" },
  );

  await expect
    .poll(() =>
      page.evaluate(() => {
        const exProtocol = window.__ARENA_DEBUG__?.getSnapshot().exProtocol;
        return exProtocol?.status === "selected" &&
          exProtocol.runtime.kind === "rebound-overdrive"
          ? exProtocol.runtime.armedUntil
          : null;
      }),
    )
    .not.toBeNull();
  expect(
    await page.evaluate(
      () => window.__ARENA_DEBUG__?.getSnapshot().stats.shotsFired,
    ),
  ).toBe(before);
  expect(
    await dispatchContextMenu(canvas),
  ).toBe(false);
  await expect(page.locator("#game")).toHaveScreenshot(
    "arena-ex-rebound-hud.png",
    { maxDiffPixelRatio: 0.01 },
  );
  await page.evaluate(() => {
    window.__ARENA_DEBUG__?.restart();
    window.__ARENA_DEBUG__?.forceExProtocolSelect();
  });
  await page
    .locator(
      "[data-choice-kind='protocol'][data-choice-id='pulse.rebound-overdrive']",
    )
    .click();
  await expectStatus(page, "playing");
  const beforeKeyboard = await page.evaluate(
    () => window.__ARENA_DEBUG__?.getSnapshot().stats.shotsFired ?? -1,
  );
  await page.keyboard.down("e");
  await page.waitForTimeout(80);
  await page.keyboard.up("e");
  await expect
    .poll(() =>
      page.evaluate(() => {
        const exProtocol = window.__ARENA_DEBUG__?.getSnapshot().exProtocol;
        return exProtocol?.status === "selected" &&
          exProtocol.runtime.kind === "rebound-overdrive"
          ? exProtocol.runtime.armedUntil
          : null;
      }),
    )
    .toBeGreaterThan(0);
  expect(
    await page.evaluate(
      () => window.__ARENA_DEBUG__?.getSnapshot().stats.shotsFired,
    ),
  ).toBe(beforeKeyboard);
});

test("removes candidate-only input hooks when Training starts", async ({
  page,
}) => {
  await gotoCandidate(page);
  const canvas = page.locator("canvas");
  expect(await dispatchContextMenu(canvas)).toBe(false);
  const box = await canvas.boundingBox();
  if (!box) throw new Error("Canvas is not visible.");
  await page.mouse.click(
    box.x + box.width * 0.5,
    box.y + box.height * (393 / 540),
  );
  await expect
    .poll(() =>
      page.evaluate(() => window.__ARENA_DEBUG__?.getSnapshot().tutorial?.stepId),
    )
    .toBe("move");
  expect(
    await page.evaluate(
      () => window.__ARENA_DEBUG__?.getSnapshot().exProtocol,
    ),
  ).toBeNull();
  expect(await dispatchContextMenu(canvas)).toBe(true);
});

test("stacks Protocol cards without clipping in portrait", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await gotoCandidate(page);
  await page.evaluate(() => {
    window.__ARENA_DEBUG__?.restart();
    window.__ARENA_DEBUG__?.forceExProtocolSelect();
  });

  const overlay = page.locator(".arena-choice-overlay--visible");
  const cards = overlay.locator("[data-choice-kind='protocol']");
  await expect(overlay).toHaveClass(/arena-choice-overlay--portrait/);
  await expect(cards).toHaveCount(3);
  const boxes = await cards.evaluateAll((nodes) =>
    nodes.map((node) => {
      const box = node.getBoundingClientRect();
      return {
        left: box.left,
        right: box.right,
        top: box.top,
        bottom: box.bottom,
      };
    }),
  );
  expect(boxes[1]!.top).toBeGreaterThan(boxes[0]!.bottom);
  expect(boxes[2]!.top).toBeGreaterThan(boxes[1]!.bottom);
  expect(
    boxes.every((box) => box.left >= 16 && box.right <= 390 - 16),
  ).toBe(true);
  await expect(page.locator("#game")).toHaveScreenshot(
    "arena-ex-protocol-select-portrait.png",
    { maxDiffPixelRatio: 0.01 },
  );
});

async function gotoCandidate(page: Page): Promise<void> {
  await page.goto("/?webglReadback=1");
  await expect
    .poll(() => page.evaluate(() => Boolean(window.__ARENA_DEBUG__)))
    .toBe(true);
}

async function expectStatus(
  page: Page,
  status: string,
): Promise<void> {
  await expect
    .poll(() =>
      page.evaluate(() => window.__ARENA_DEBUG__?.getSnapshot().status),
    )
    .toBe(status);
}

async function dispatchContextMenu(
  canvas: Locator,
): Promise<boolean> {
  return canvas.evaluate((node) => {
    const event = new MouseEvent("contextmenu", {
      bubbles: true,
      cancelable: true,
    });
    return node.dispatchEvent(event);
  });
}
