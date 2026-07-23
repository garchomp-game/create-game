import { expect, type Locator, type Page, test } from "@playwright/test";
import {
  EX_PROTOCOL_CANDIDATE_APP_VERSION,
  EX_PROTOCOL_ENDLESS_RULESET_VERSION,
} from "../../src/config/version";

test.skip(
  process.env.VITE_ARENA_EX_PROTOCOL_CANDIDATE !== "1",
  "EX Protocol UI runs only with the candidate profile enabled.",
);

test.use({ deviceScaleFactor: 2 });

test("publishes the EX Protocol candidate identity", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator('meta[name="arena-app-version"]')).toHaveAttribute(
    "content",
    EX_PROTOCOL_CANDIDATE_APP_VERSION,
  );
  await expect(
    page.locator('meta[name="arena-ruleset-version"]'),
  ).toHaveAttribute("content", EX_PROTOCOL_ENDLESS_RULESET_VERSION);

  await page.goto("/beta-info.html");
  await expect(page.locator("#app-version")).toHaveText(
    EX_PROTOCOL_CANDIDATE_APP_VERSION,
  );
  await expect(page.locator("#ruleset-version")).toHaveText(
    EX_PROTOCOL_ENDLESS_RULESET_VERSION,
  );
});

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
  await expect(evolutionOne.nth(0)).toContainText("1.5秒 → 2.25秒");

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

test("persists candidate runs as v3 with provenance and Protocol aggregate", async ({
  page,
}) => {
  await gotoCandidate(page);
  await page.evaluate(() => {
    const debug = window.__ARENA_DEBUG__;
    if (!debug) throw new Error("Debug API is not available.");
    debug.restart();
    debug.forceExProtocolSelect();
  });
  await page
    .locator(
      "[data-choice-kind='protocol'][data-choice-id='pulse.resonance-relay']",
    )
    .click();
  await expectStatus(page, "playing");
  await page.evaluate(() => window.__ARENA_DEBUG__?.forceGameOver());
  await expectStatus(page, "gameOver");

  const persisted = await page.evaluate(() => {
    const raw = localStorage.getItem("arena-core.run-records.v3");
    if (!raw) throw new Error("Candidate v3 store is missing.");
    const envelope = JSON.parse(raw) as {
      schemaVersion: number;
      history: Array<Record<string, unknown>>;
      rankings: Array<Record<string, unknown>>;
    };
    return {
      envelope,
      latest: window.__ARENA_DEBUG__?.getSnapshot().latestRunRecord,
      v2Raw: localStorage.getItem("arena-core.run-records.v2"),
    };
  });

  expect(persisted.envelope.schemaVersion).toBe(3);
  expect(persisted.envelope.history[0]).toMatchObject({
    schemaVersion: 3,
    rulesetProfileId: "candidate-ex-endless-c2",
    rngVersion: "arena-rng-v2",
    exProtocol: {
      selectedId: "pulse.resonance-relay",
    },
  });
  expect(persisted.latest).toMatchObject(
    persisted.envelope.history[0] ?? {},
  );
  expect(persisted.v2Raw).toBeNull();
});

test("copies a legacy v2 record into v3 without mutating legacy bytes", async ({
  page,
}) => {
  await gotoCandidate(page);
  await page.evaluate(() => {
    const debug = window.__ARENA_DEBUG__;
    if (!debug) throw new Error("Debug API is not available.");
    debug.restart();
    debug.forceGameOver();
  });
  await expectStatus(page, "gameOver");
  const legacyRaw = await page.evaluate(() => {
    const latest = window.__ARENA_DEBUG__?.getSnapshot().latestRunRecord;
    if (!latest || latest.schemaVersion !== 3) {
      throw new Error("Candidate run record is unavailable.");
    }
    const legacy = structuredClone(latest) as Record<string, unknown>;
    legacy.schemaVersion = 2;
    legacy.id = "legacy-v2-browser-fixture";
    legacy.rulesetVersion = "phaser-v0.6.8-pulse-boundary-ricochet";
    legacy.runOrigin = "manual";
    legacy.rankEligibility = {
      eligible: true,
      reasons: [],
    };
    delete legacy.rulesetProfileId;
    delete legacy.rngVersion;
    delete legacy.exProtocol;
    const raw = JSON.stringify({
      schemaVersion: 2,
      history: [legacy],
      rankings: [legacy],
    });
    localStorage.setItem("arena-core.run-records.v2", raw);
    localStorage.removeItem("arena-core.run-records.v3");
    return raw;
  });

  await page.reload();
  await expect
    .poll(() => page.evaluate(() => Boolean(window.__ARENA_DEBUG__)))
    .toBe(true);

  const migrated = await page.evaluate(() => {
    const v3Raw = localStorage.getItem("arena-core.run-records.v3");
    if (!v3Raw) throw new Error("Migrated v3 store is missing.");
    return {
      legacyRaw: localStorage.getItem("arena-core.run-records.v2"),
      envelope: JSON.parse(v3Raw) as {
        history: Array<Record<string, unknown>>;
        rankings: Array<Record<string, unknown>>;
        legacySync: {
          importedHistory: Record<string, string>;
          importedRankings: Record<string, string>;
        };
      },
    };
  });

  expect(migrated.legacyRaw).toBe(legacyRaw);
  expect(migrated.envelope.history).toEqual([
    expect.objectContaining({
      id: "legacy-v2-browser-fixture",
      schemaVersion: 3,
      rulesetProfileId: "legacy-endless-v068",
      rngVersion: "arena-rng-v1",
      exProtocol: null,
    }),
  ]);
  expect(migrated.envelope.rankings).toHaveLength(1);
  expect(migrated.envelope.legacySync).toEqual({
    importedHistory: { "legacy-v2-browser-fixture": "v2" },
    importedRankings: { "legacy-v2-browser-fixture": "v2" },
  });
});

const PROTOCOL_COMBAT_CASES = [
  {
    weaponId: "pulse",
    protocolId: "pulse.resonance-relay",
    runtimeKind: "resonance-relay",
    snapshot: "arena-ex-resonance-relay-combat.png",
  },
  {
    weaponId: "pulse",
    protocolId: "pulse.rebound-overdrive",
    runtimeKind: "rebound-overdrive",
    snapshot: "arena-ex-rebound-overdrive-combat.png",
  },
  {
    weaponId: "pulse",
    protocolId: "pulse.redline-core",
    runtimeKind: "redline-core",
    snapshot: "arena-ex-redline-core-combat.png",
  },
  {
    weaponId: "spread",
    protocolId: "spread.full-span-tidal-sweep",
    runtimeKind: "full-span-tidal-sweep",
    snapshot: "arena-ex-tidal-sweep-combat.png",
  },
  {
    weaponId: "spread",
    protocolId: "spread.breakwater-fan",
    runtimeKind: "breakwater-fan",
    snapshot: "arena-ex-breakwater-fan-combat.png",
  },
  {
    weaponId: "spread",
    protocolId: "spread.aegis-fan",
    runtimeKind: "aegis-fan",
    snapshot: "arena-ex-aegis-fan-combat.png",
  },
] as const;

for (const fixture of PROTOCOL_COMBAT_CASES) {
  test(`renders ${fixture.protocolId} in a representative combat scene`, async ({
    page,
  }) => {
    await gotoCandidate(page);
    await page.evaluate((weaponId) => {
      const debug = window.__ARENA_DEBUG__;
      if (!debug) throw new Error("Debug API is not available.");
      debug.startAutoPilot(weaponId);
      debug.setAutoPilotEnabled(false);
      debug.forceExProtocolSelect();
    }, fixture.weaponId);
    await page
      .locator(
        `[data-choice-kind='protocol'][data-choice-id='${fixture.protocolId}']`,
      )
      .click();
    await expectStatus(page, "playing");
    await page.evaluate(() => {
      window.__ARENA_DEBUG__?.setEnemyVisualFixture("wave3");
    });
    if (fixture.runtimeKind === "rebound-overdrive") {
      await page.keyboard.press("e");
    }

    await expect
      .poll(() =>
        page.evaluate(
          () =>
            window.__ARENA_DEBUG__?.getSnapshot().exProtocol?.runtime
              .kind,
        ),
      )
      .toBe(fixture.runtimeKind);
    await expect
      .poll(() =>
        page.evaluate(
          () => window.__ARENA_DEBUG__?.getSnapshot().enemyCount ?? 0,
        ),
      )
      .toBeGreaterThan(0);
    await expect(page.locator("#game")).toHaveScreenshot(
      fixture.snapshot,
      { maxDiffPixelRatio: 0.01 },
    );
  });
}

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
