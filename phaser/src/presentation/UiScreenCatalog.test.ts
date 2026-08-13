import { describe, expect, it } from "vitest";
import {
  UI_SCREEN_DEFINITIONS,
  UI_SCREEN_GROUPS,
  UI_SCREEN_TRANSITIONS,
} from "./UiScreenCatalog";

describe("UI screen catalog", () => {
  it("uses unique screen ids and known groups", () => {
    const ids = UI_SCREEN_DEFINITIONS.map((screen) => screen.id);
    const groups = new Set(UI_SCREEN_GROUPS.map((group) => group.id));

    expect(new Set(ids).size).toBe(ids.length);
    expect(UI_SCREEN_DEFINITIONS.every((screen) => groups.has(screen.group))).toBe(true);
  });

  it("only connects known screens", () => {
    const ids = new Set(UI_SCREEN_DEFINITIONS.map((screen) => screen.id));

    expect(
      UI_SCREEN_TRANSITIONS.every(
        (transition) => ids.has(transition.from) && ids.has(transition.to),
      ),
    ).toBe(true);
  });

  it("gives every screen except the device gate an incoming route", () => {
    const incomingIds = new Set(
      UI_SCREEN_TRANSITIONS.map((transition) => transition.to),
    );
    const missing = UI_SCREEN_DEFINITIONS.filter(
      (screen) => screen.id !== "device-gate" && !incomingIds.has(screen.id),
    ).map((screen) => screen.id);

    expect(missing).toEqual([]);
  });

  it("documents the title hierarchy and only the implemented information route", () => {
    const title = UI_SCREEN_DEFINITIONS.find((screen) => screen.id === "title");
    const outgoing = UI_SCREEN_TRANSITIONS.filter(
      (transition) => transition.from === "title",
    );

    expect(title?.summary).toContain("唯一の主CTA");
    expect(outgoing.filter((transition) => transition.to === "beta-info")).toEqual([
      expect.objectContaining({ trigger: "情報" }),
    ]);
    expect(outgoing.some((transition) => String(transition.to) === "help")).toBe(false);
    expect(
      UI_SCREEN_TRANSITIONS.filter((transition) => transition.to === "help").map(
        (transition) => transition.from,
      ),
    ).toEqual([
      "training-active",
      "gameplay-standard",
      "gameplay-danger",
      "gameplay-commander",
      "gameplay-boss",
      "paused",
      "practice-settings",
    ]);
  });
});
