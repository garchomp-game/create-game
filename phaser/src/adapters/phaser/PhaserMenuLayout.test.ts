import { describe, expect, it } from "vitest";
import {
  findMenuActionAt,
  getMenuButtons,
  getTitleMenuTier,
  type MenuButton,
} from "./PhaserMenuLayout";

describe("PhaserMenuLayout", () => {
  it("exposes public beta information from the title menu", () => {
    expect(getMenuButtons("title", 960, 540).map((button) => button.action)).toEqual([
      "story",
      "start",
      "practice",
      "ranking",
      "history",
      "settings",
      "betaInfo",
    ]);
    expect(findMenuActionAt("title", 960, 540, 687, 473)).toBe("betaInfo");
    expect(findMenuActionAt("title", 960, 540, 480, 314)).toBe("story");
    expect(findMenuActionAt("title", 960, 540, 360, 399)).toBe("start");
    expect(findMenuActionAt("title", 960, 540, 600, 399)).toBe("practice");
    expect(findMenuActionAt("title", 960, 540, 549, 473)).toBe("settings");
  });

  it("keeps one primary, two secondary, and four utility title targets distinct", () => {
    const buttons = getMenuButtons("title", 960, 540);
    const [story, endless, practice, ...utility] = buttons;

    expect(story).toMatchObject({
      action: "story",
      label: "ストーリーを始める",
      x: 290,
      y: 278,
      width: 380,
      height: 72,
    });
    expect(endless).toMatchObject({
      action: "start",
      x: 250,
      y: 374,
      width: 220,
      height: 50,
    });
    expect(practice).toMatchObject({
      action: "practice",
      x: 490,
      y: 374,
      width: 220,
      height: 50,
    });
    expect(utility).toHaveLength(4);
    expect(utility.every((button) => button.y === 454 && button.height === 38)).toBe(true);
    expect(story!.width).toBeGreaterThan(endless!.width);
    expect(story!.height).toBeGreaterThan(endless!.height);
    expect(buttons.every(isInsideLogicalCanvas)).toBe(true);
    expect(hasAnyOverlap(buttons)).toBe(false);
    expect(buttons.map((button) => getTitleMenuTier(button.action))).toEqual([
      "primary",
      "secondary",
      "secondary",
      "utility",
      "utility",
      "utility",
      "utility",
    ]);
  });

  it("offers the opening operation and final expedition inside Story", () => {
    expect(
      getMenuButtons("title", 960, 540, undefined, "story").map(
        (button) => button.action,
      ),
    ).toEqual([
      "startTraining",
      "startExpedition",
      "startDebugExProtocol",
      "back",
    ]);
    expect(
      findMenuActionAt("title", 960, 540, 480, 217, "story"),
    ).toBe("startTraining");
    expect(
      findMenuActionAt("title", 960, 540, 480, 319, "story"),
    ).toBe("startExpedition");
    expect(
      findMenuActionAt("title", 960, 540, 480, 398, "story"),
    ).toBe("startDebugExProtocol");
  });

  it("keeps Practice runtime settings independent from shared weapon selection", () => {
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

  it("keeps settings rows focused while exposing explicit stepper targets", () => {
    expect(
      getMenuButtons("title", 960, 540, undefined, "settings").map(
        (button) => button.action,
      ),
    ).toEqual([
      "settingsBgmIncrease",
      "settingsSfxIncrease",
      "settingsAutoFire",
      "settingsShakeIncrease",
      "settingsFlashIncrease",
      "back",
      "resetSettings",
      "resetProfile",
    ]);
    const settingsButtons = getMenuButtons(
      "title",
      960,
      540,
      undefined,
      "settings",
    );
    expect(settingsButtons.find((button) => button.action === "back")).toMatchObject({
      x: 24,
      y: 24,
    });
    expect(
      settingsButtons.find((button) => button.action === "resetSettings"),
    ).toMatchObject({ y: 444 });
    expect(findMenuActionAt("title", 960, 540, 64, 42, "settings")).toBe(
      "back",
    );
    expect(findMenuActionAt("title", 960, 540, 640, 136, "settings")).toBe(
      "settingsBgmDecrease",
    );
    expect(findMenuActionAt("title", 960, 540, 770, 136, "settings")).toBe(
      "settingsBgmIncrease",
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

function isInsideLogicalCanvas(button: MenuButton): boolean {
  return (
    button.x >= 0 &&
    button.y >= 0 &&
    button.x + button.width <= 960 &&
    button.y + button.height <= 540
  );
}

function hasAnyOverlap(buttons: readonly MenuButton[]): boolean {
  return buttons.some((button, index) =>
    buttons.slice(index + 1).some(
      (other) =>
        button.x < other.x + other.width &&
        button.x + button.width > other.x &&
        button.y < other.y + other.height &&
        button.y + button.height > other.y,
    ),
  );
}
