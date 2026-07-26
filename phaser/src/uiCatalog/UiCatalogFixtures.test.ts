import { describe, expect, it } from "vitest";
import { createUiCatalogFixture } from "./UiCatalogFixtures";

describe("createUiCatalogFixture", () => {
  it("uses production screen and choice view models for the first vertical slices", () => {
    const title = createUiCatalogFixture("title");
    const choice = createUiCatalogFixture("upgrade-select");
    const result = createUiCatalogFixture("result-endless");

    expect(title).toMatchObject({
      kind: "title",
      source: "ArenaScreenViewModel",
      model: { kind: "title", status: "title" },
    });
    expect(choice).toMatchObject({
      kind: "choice",
      source: "ArenaChoiceViewModel",
      model: {
        visible: true,
        phase: "upgrade",
        title: "強化選択 — Lv 4",
      },
    });
    expect(result).toMatchObject({
      kind: "result",
      source: "ArenaScreenViewModel",
      model: { kind: "gameOver", status: "gameOver" },
    });
  });

  it("creates a deterministic HUD fixture from production formatters", () => {
    const first = createUiCatalogFixture("gameplay-standard");
    const second = createUiCatalogFixture("gameplay-standard");

    expect(first).toEqual(second);
    expect(first).toMatchObject({
      kind: "hud",
      model: {
        hp: { value: "63 / 100", ratio: 0.63 },
        xp: { value: "経験値 52 / 72" },
        weaponName: "パルス",
      },
    });
    if (first?.kind !== "hud") throw new Error("Expected HUD fixture.");
    expect(first.model.arena.enemies).toHaveLength(17);
  });

  it("keeps fixture availability explicit", () => {
    expect(createUiCatalogFixture("settings")).toBeNull();
  });
});
