import { describe, expect, it } from "vitest";
import { findMenuActionAt, getMenuButtons } from "./PhaserMenuLayout";

describe("PhaserMenuLayout", () => {
  it("exposes public beta information from the title menu", () => {
    expect(getMenuButtons("title", 960, 540).map((button) => button.action)).toEqual([
      "start",
      "startExpedition",
      "ranking",
      "history",
      "settings",
      "betaInfo",
    ]);
    expect(findMenuActionAt("title", 960, 540, 480, 499)).toBe("betaInfo");
  });

  it("offers only Pulse and Spread on the starting weapon screen", () => {
    const buttons = getMenuButtons("weaponSelect", 960, 540);

    expect(buttons.map((button) => button.action)).toEqual([
      "selectPulse",
      "selectSpread",
      "back",
    ]);
    expect(findMenuActionAt("weaponSelect", 960, 540, 480, 325)).toBe("selectPulse");
    expect(findMenuActionAt("weaponSelect", 960, 540, 480, 377)).toBe("selectSpread");
  });

  it("provides stable weapon filters and pagination on run history", () => {
    const buttons = getMenuButtons("title", 960, 540, undefined, "history");
    expect(buttons.map((button) => button.action)).toEqual([
      "historyFilterAll",
      "historyFilterPulse",
      "historyFilterSpread",
      "historyPrevious",
      "historyNext",
      "clearHistory",
      "back",
    ]);
    expect(findMenuActionAt("title", 960, 540, 480, 363, "history")).toBe(
      "historyFilterPulse",
    );
  });

  it("offers a standard and an overdrive contract without an accidental back action", () => {
    expect(getMenuButtons("contractSelect", 960, 540).map((button) => button.action)).toEqual([
      "contractStandard",
      "contractOverdrive",
    ]);
  });
});
