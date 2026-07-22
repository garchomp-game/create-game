import { expect, type Page } from "@playwright/test";
import {
  ARENA_CAPTURE_SCENARIOS,
  type ArenaCaptureScenarioId,
} from "../../src/adapters/phaser/ArenaCaptureScenarios";
import { probeWebglCanvas } from "./webglCanvasProbe";

export const ARENA_CAPTURE_VIEWPORTS = [
  { id: "desktop", width: 960, height: 540 },
  { id: "portrait", width: 390, height: 844 },
  { id: "landscape-wide", width: 1365, height: 600 },
] as const;

export type ArenaCaptureViewport =
  (typeof ARENA_CAPTURE_VIEWPORTS)[number];

export async function openArenaCaptureScenario(
  page: Page,
  viewport: ArenaCaptureViewport,
  scenarioId: ArenaCaptureScenarioId,
): Promise<void> {
  await page.setViewportSize({ width: viewport.width, height: viewport.height });
  await page.goto("/?webglReadback=1");
  await expect
    .poll(() => page.evaluate(() => Boolean(window.__ARENA_DEBUG__)))
    .toBe(true);

  await moveMouseToCanvasLogical(page, 480, 339);
  await page.mouse.down();
  await page.mouse.up();
  await page
    .locator("[data-choice-kind='weapon'][data-choice-id='pulse']")
    .click();
  await expect
    .poll(() =>
      page.evaluate(() => window.__ARENA_DEBUG__?.getSnapshot().status),
    )
    .toBe("playing");

  const loaded = await page.evaluate((id) => {
    const debug = window.__ARENA_DEBUG__;
    if (!debug) throw new Error("Debug API is not available.");
    const result = debug.loadCaptureScenario(id);
    debug.setPaused(true);
    return result;
  }, scenarioId);
  expect(loaded).toBe(true);
  await expect
    .poll(() =>
      page.evaluate(() =>
        window.__ARENA_DEBUG__?.getSnapshot().captureScenario?.id,
      ),
    )
    .toBe(scenarioId);
}

export async function assertArenaCaptureStructure(
  page: Page,
  scenarioId: ArenaCaptureScenarioId,
) {
  const canvas = page.locator("canvas");
  const snapshot = await page.evaluate(() =>
    window.__ARENA_DEBUG__?.getSnapshot(),
  );
  if (!snapshot) throw new Error("Debug snapshot is not available.");
  const expected = ARENA_CAPTURE_SCENARIOS[scenarioId].expectedLayers;

  expect(snapshot.captureScenario).toEqual({
    id: scenarioId,
    layers: expected,
  });
  expect(snapshot.expedition?.boss).toMatchObject({
    bossId: "final-command-ship",
    phase: 2,
    action: { attackId: "targeted-salvo", phase: "telegraph" },
  });
  expect(snapshot.performance.frameSamples).toBeGreaterThan(0);
  expect(Number.isFinite(snapshot.performance.p95RawDtMs)).toBe(true);
  expect(snapshot.renderPerformance.staticBackground.drawCount).toBe(1);
  expect(snapshot.renderPerformance.renderedFrames).toBeGreaterThan(0);
  expect(Number.isFinite(snapshot.renderPerformance.dynamicWorld.maxMs)).toBe(
    true,
  );
  expect(Number.isFinite(snapshot.renderPerformance.screenHud.maxMs)).toBe(true);
  const audioRouting = snapshot.audioRouting;
  expect(audioRouting.requested.length).toBeGreaterThan(0);
  expect(
    audioRouting.played.length + audioRouting.suppressed.length,
  ).toBe(audioRouting.requested.length);
  expect(audioRouting.requested).toContainEqual(
    expect.objectContaining({
      eventType: "expedition.act.changed",
      cue: "upgrade",
    }),
  );
  const resolvedSequences = [
    ...audioRouting.played,
    ...audioRouting.suppressed,
  ]
    .map((result) => result.sequence)
    .sort((left, right) => left - right);
  expect(resolvedSequences).toEqual(
    audioRouting.requested.map((request) => request.sequence),
  );

  const rendererProbe = await probeWebglCanvas(canvas);
  expect(rendererProbe.kind).toBe("webgl");
  expect(rendererProbe.preserveDrawingBuffer).toBe(true);
  expect(rendererProbe.nonBackgroundSamples).toBeGreaterThan(0);

  return {
    scenarioId,
    layers: snapshot.captureScenario?.layers ?? null,
    performance: snapshot.performance,
    renderPerformance: snapshot.renderPerformance,
    audioRouting: snapshot.audioRouting,
    webgl: rendererProbe,
  };
}

async function moveMouseToCanvasLogical(
  page: Page,
  logicalX: number,
  logicalY: number,
): Promise<void> {
  const canvas = page.locator("canvas");
  const box = await canvas.boundingBox();
  if (!box) throw new Error("Canvas is not visible.");
  const size = await canvas.evaluate((node: HTMLCanvasElement) => ({
    width: node.width,
    height: node.height,
  }));
  await page.mouse.move(
    box.x + (logicalX / size.width) * box.width,
    box.y + (logicalY / size.height) * box.height,
  );
}
