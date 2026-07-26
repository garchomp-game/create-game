import { expect, test } from "@playwright/test";
import {
  ARENA_CAPTURE_VIEWPORTS,
  assertArenaCaptureStructure,
  openArenaCaptureScenario,
} from "./arenaCaptureHarness";

test("keeps the maximum-density render fixture inside the browser frame budget", async ({
  page,
}) => {
  await openArenaCaptureScenario(
    page,
    ARENA_CAPTURE_VIEWPORTS[0],
    "maximum-density-performance",
  );
  await expect
    .poll(
      () =>
        page.evaluate(
          () =>
            window.__ARENA_DEBUG__?.getSnapshot().renderPerformance.fullFrame
              .samples ?? 0,
        ),
      { timeout: 10_000 },
    )
    .toBeGreaterThanOrEqual(60);

  const evidence = await assertArenaCaptureStructure(
    page,
    "maximum-density-performance",
  );
  await test.info().attach("maximum-density-performance.json", {
    body: JSON.stringify(evidence, null, 2),
    contentType: "application/json",
  });

  // The CI browser uses a software renderer, video capture, and preserved
  // drawing buffers. The stricter release-hardware raw-frame gate remains 34 ms.
  expect(evidence.performance.p95RawDtMs).toBeLessThanOrEqual(60);
  expect(evidence.renderPerformance.fullFrame.p95Ms).toBeLessThanOrEqual(15);
  expect(evidence.renderPerformance.fullFrame.maxMs).toBeLessThan(35);
});
