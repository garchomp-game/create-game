import { describe, expect, it } from "vitest";
import { renderUiCatalogHud } from "./UiCatalogFixtureRenderer";
import { createUiCatalogFixture } from "./UiCatalogFixtures";
import {
  getUiCatalogBackgroundCandidate,
  UI_CATALOG_BACKGROUND_CANDIDATES,
} from "./UiCatalogBackgroundCandidates";

describe("UI catalog background candidates", () => {
  it("keeps one control and three ordered comparison candidates", () => {
    expect(
      UI_CATALOG_BACKGROUND_CANDIDATES.map(({ id, marker }) => ({
        id,
        marker,
      })),
    ).toEqual([
      { id: "baseline", marker: "CONTROL" },
      { id: "orbital", marker: "A" },
      { id: "altitude", marker: "B" },
      { id: "surface", marker: "C" },
    ]);
  });

  it("keeps spatial meaning and readability risk explicit", () => {
    for (const candidate of UI_CATALOG_BACKGROUND_CANDIDATES) {
      expect(candidate.premise.length).toBeGreaterThan(10);
      expect(candidate.spatialCue.length).toBeGreaterThan(4);
      expect(candidate.risk.length).toBeGreaterThan(10);
      expect(getUiCatalogBackgroundCandidate(candidate.id)).toBe(candidate);
    }
  });

  it("renders every candidate from the same deterministic HUD model", () => {
    const fixture = createUiCatalogFixture("gameplay-standard");
    if (fixture?.kind !== "hud") throw new Error("Expected HUD fixture.");
    const baselineModel = structuredClone(fixture.model);

    for (const candidate of UI_CATALOG_BACKGROUND_CANDIDATES) {
      const html = renderUiCatalogHud(fixture.model, candidate.id);
      expect(html).toContain(
        `data-background-candidate="${candidate.id}"`,
      );
    }

    expect(fixture.model).toEqual(baselineModel);
  });
});
