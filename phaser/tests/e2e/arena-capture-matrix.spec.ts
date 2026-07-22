import { expect, test } from "@playwright/test";
import {
  ARENA_CAPTURE_VIEWPORTS,
  assertArenaCaptureStructure,
  openArenaCaptureScenario,
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
