import { describe, expect, it } from "vitest";
import { findMenuActionAt, getMenuButtons } from "./PhaserMenuLayout";

describe("PhaserMenuLayout", () => {
  it("exposes public beta information from the title menu", () => {
    expect(getMenuButtons("title", 960, 540).map((button) => button.action)).toEqual([
      "story",
      "start",
      "practice",
      "ranking",
      "history",
      "help",
      "settings",
      "betaInfo",
    ]);
    expect(findMenuActionAt("title", 960, 540, 810, 390)).toBe("betaInfo");
    expect(findMenuActionAt("title", 960, 540, 480, 189)).toBe("story");
    expect(findMenuActionAt("title", 960, 540, 276, 283)).toBe("start");
    expect(findMenuActionAt("title", 960, 540, 620, 280)).toBe("practice");
    expect(findMenuActionAt("title", 960, 540, 480, 390)).toBe("help");
  });

  it("offers the opening operation and final expedition inside Story", () => {
    expect(
      getMenuButtons("title", 960, 540, undefined, "story").map(
        (button) => button.action,
      ),
    ).toEqual(["startTraining", "startExpedition", "back"]);
    expect(
      findMenuActionAt("title", 960, 540, 480, 217, "story"),
    ).toBe("startTraining");
    expect(
      findMenuActionAt("title", 960, 540, 480, 319, "story"),
    ).toBe("startExpedition");
  });

  it("separates large Practice weapon starts from optional settings", () => {
    const actions = getMenuButtons(
      "title",
      960,
      540,
      undefined,
      "practice",
    ).map((button) => button.action);

    expect(actions).toEqual([
      "practiceStartPulse",
      "practiceStartSpread",
      "back",
    ]);
    expect(findMenuActionAt("title", 960, 540, 300, 250, "practice")).toBe(
      "practiceStartPulse",
    );
    expect(findMenuActionAt("title", 960, 540, 660, 250, "practice")).toBe(
      "practiceStartSpread",
    );

    expect(
      getMenuButtons("title", 960, 540, undefined, "practiceSettings").map(
        (button) => button.action,
      ),
    ).toEqual([
      "practiceInvinciblePrevious",
      "practiceInvincibleNext",
      "practiceIntensityPrevious",
      "practiceIntensityNext",
      "practiceEnemyChaser",
      "practiceEnemyBrute",
      "practiceEnemyFast",
      "practiceEnemyRanged",
      "back",
    ]);
    expect(
      findMenuActionAt("playing", 960, 540, 590, 132, "practiceSettings"),
    ).toBe("practiceInvinciblePrevious");
    expect(
      findMenuActionAt("playing", 960, 540, 770, 194, "practiceSettings"),
    ).toBe("practiceIntensityNext");
    expect(
      findMenuActionAt("playing", 960, 540, 350, 306, "practiceSettings"),
    ).toBe("practiceEnemyChaser");
  });

  it("opens help from settings and exposes one stable close target", () => {
    expect(
      getMenuButtons("title", 960, 540, undefined, "settings").map(
        (button) => button.action,
      ),
    ).toEqual([
      "settingsBgm",
      "settingsSfx",
      "settingsShake",
      "settingsFlash",
      "settingsAutoFire",
      "help",
      "resetSettings",
      "resetProfile",
      "back",
    ]);
    expect(findMenuActionAt("title", 960, 540, 625, 223, "settings")).toBe(
      "help",
    );
    expect(
      getMenuButtons("playing", 960, 540, undefined, "help").map(
        (button) => button.action,
      ),
    ).toEqual(["helpControls", "helpEnemies", "helpField", "back"]);
    expect(findMenuActionAt("playing", 960, 540, 480, 111, "help")).toBe(
      "helpEnemies",
    );
    expect(findMenuActionAt("playing", 960, 540, 480, 499, "help")).toBe(
      "back",
    );
  });

  it("offers Endless deployment and title return after Training", () => {
    expect(
      getMenuButtons("trainingComplete", 960, 540).map((button) => button.action),
    ).toEqual(["start", "title"]);
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

  it("provides board navigation on rankings", () => {
    expect(
      getMenuButtons("title", 960, 540, undefined, "ranking").map(
        (button) => button.action,
      ),
    ).toEqual([
      "rankingPrevious",
      "rankingNext",
      "clearRankings",
      "back",
    ]);
  });
});
