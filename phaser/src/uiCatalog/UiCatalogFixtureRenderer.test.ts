import { describe, expect, it } from "vitest";
import { renderUiCatalogFixture } from "./UiCatalogFixtureRenderer";
import { createUiCatalogFixture } from "./UiCatalogFixtures";

const nodeFsSpecifier: string = "node:fs";
const { readFileSync } = await import(nodeFsSpecifier);
const catalogCss: string = readFileSync(
  new URL("../uiCatalog.css", import.meta.url),
  "utf8",
);

describe("renderUiCatalogFixture title comparison", () => {
  it("renders baseline and candidate from the same focused fixed model", () => {
    const fixture = createUiCatalogFixture("title");
    if (fixture?.kind !== "title") throw new Error("Expected title fixture.");

    const html = renderUiCatalogFixture(fixture);

    expect(fixture.model.focusedMenuAction).toBe("story");
    expect(html).toContain('data-title-variant="baseline"');
    expect(html).toContain('data-title-variant="candidate"');
    expect(html).toContain(">ストーリー</button>");
    expect(html).toContain(">ストーリーを始める</button>");
    expect(html.match(/data-fixture-action="story"/g)).toHaveLength(2);
    expect(html.match(/data-focused="true"/g)).toHaveLength(2);
    expect(html).toContain("主CTA 1 / 副導線 2 / 管理導線 4");
  });

  it("keeps non-color tier and focus affordances in the catalog stylesheet", () => {
    expect(catalogCss).toContain(".fixture-title__candidate-primary");
    expect(catalogCss).toContain("width: 66%");
    expect(catalogCss).toContain(".fixture-title__action--primary");
    expect(catalogCss).toContain("border-top-width: 6px");
    expect(catalogCss).toContain('.fixture-title__action[data-focused="true"]');
    expect(catalogCss).toContain("outline: 2px solid #facc15");
  });
});
