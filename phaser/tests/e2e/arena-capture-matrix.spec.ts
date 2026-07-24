import { expect, test } from "@playwright/test";
import {
  ARENA_CAPTURE_VIEWPORTS,
  assertArenaCaptureStructure,
  openArenaCaptureScenario,
  setArenaCaptureGrayscale,
} from "./arenaCaptureHarness";

test.describe("RC6 control capture matrix", () => {
  for (const viewport of ARENA_CAPTURE_VIEWPORTS) {
    test(`captures shared layers at ${viewport.id}`, async ({ page }) => {
      const pageErrors: string[] = [];
      page.on("pageerror", (error) => pageErrors.push(error.message));

      await openArenaCaptureScenario(page, viewport, "rc6-control");
      const evidence = await assertArenaCaptureStructure(
        page,
        "rc6-control",
      );
      await test.info().attach(`capture-${viewport.id}.json`, {
        body: JSON.stringify(evidence, null, 2),
        contentType: "application/json",
      });

      await expect(page).toHaveScreenshot(
        `arena-capture-rc6-control-${viewport.id}.png`,
        { maxDiffPixelRatio: 0.01 },
      );
      expect(pageErrors).toEqual([]);
    });
  }
});

test.describe("object semantics Phase A capture matrix", () => {
  for (const viewport of ARENA_CAPTURE_VIEWPORTS) {
    test(`captures color and grayscale roles at ${viewport.id}`, async ({
      page,
    }) => {
      const pageErrors: string[] = [];
      page.on("pageerror", (error) => pageErrors.push(error.message));

      await openArenaCaptureScenario(
        page,
        viewport,
        "object-semantics-control",
      );
      const evidence = await assertArenaCaptureStructure(
        page,
        "object-semantics-control",
      );
      await test.info().attach(`object-semantics-${viewport.id}.json`, {
        body: JSON.stringify(evidence, null, 2),
        contentType: "application/json",
      });

      await expect(page).toHaveScreenshot(
        `arena-capture-object-semantics-color-${viewport.id}.png`,
        { maxDiffPixelRatio: 0.01 },
      );
      await setArenaCaptureGrayscale(page, true);
      await expect(page).toHaveScreenshot(
        `arena-capture-object-semantics-grayscale-${viewport.id}.png`,
        { maxDiffPixelRatio: 0.01 },
      );
      expect(pageErrors).toEqual([]);
    });
  }
});
