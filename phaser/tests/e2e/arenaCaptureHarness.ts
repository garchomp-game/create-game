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

  if (ARENA_CAPTURE_SCENARIOS[scenarioId].expectedBoss) {
    await clickCanvasLogical(page, 480, 189);
    await clickCanvasLogical(page, 480, 319);
  } else {
    await clickCanvasLogical(page, 276, 283);
  }
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

async function clickCanvasLogical(
  page: Page,
  logicalX: number,
  logicalY: number,
): Promise<void> {
  await moveMouseToCanvasLogical(page, logicalX, logicalY);
  await page.mouse.down();
  await page.mouse.up();
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
  const definition = ARENA_CAPTURE_SCENARIOS[scenarioId];

  expect(snapshot.captureScenario).toEqual({
    id: scenarioId,
    layers: expected,
  });
  if (definition.expectedBoss) {
    expect(snapshot.expedition?.boss).toMatchObject({
      bossId: "final-command-ship",
      phase: 2,
      action: { attackId: "targeted-salvo", phase: "telegraph" },
    });
  } else {
    expect(snapshot.expedition?.boss ?? null).toBeNull();
  }
  expect(snapshot.performance.frameSamples).toBeGreaterThan(0);
  expect(Number.isFinite(snapshot.performance.p95RawDtMs)).toBe(true);
  expect(snapshot.renderPerformance.staticBackground.drawCount).toBe(1);
  expect(snapshot.renderPerformance.renderedFrames).toBeGreaterThan(0);
  expect(Number.isFinite(snapshot.renderPerformance.dynamicWorld.maxMs)).toBe(
    true,
  );
  expect(Number.isFinite(snapshot.renderPerformance.screenHud.maxMs)).toBe(true);
  const audioRouting = snapshot.audioRouting;
  expect(
    audioRouting.played.length + audioRouting.suppressed.length,
  ).toBe(audioRouting.requested.length);
  if (definition.expectsExpeditionAudioCue) {
    expect(audioRouting.requested.length).toBeGreaterThan(0);
    expect(audioRouting.requested).toContainEqual(
      expect.objectContaining({
        eventType: "expedition.act.changed",
        cue: "upgrade",
      }),
    );
  }
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

export async function setArenaCaptureGrayscale(
  page: Page,
  enabled: boolean,
): Promise<void> {
  await page.locator("#game").evaluate((node, grayscale) => {
    (node as HTMLElement).style.filter = grayscale ? "grayscale(1)" : "";
  }, enabled);
  await page.waitForTimeout(50);
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
