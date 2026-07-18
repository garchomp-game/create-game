import { describe, expect, it } from "vitest";
import { SIMULATION_CONFIG } from "../config/gameConfig";
import { TEXT } from "../lang";
import { createWorld } from "../simulation/createWorld";
import { createArenaChoiceViewModel } from "./ArenaChoicePresenter";

describe("createArenaChoiceViewModel", () => {
  it("returns a stable hidden model outside choice states", () => {
    const world = createWorld(SIMULATION_CONFIG);

    expect(createArenaChoiceViewModel(world, SIMULATION_CONFIG)).toEqual({
      visible: false,
      kind: null,
      title: "",
      subtitle: "",
      cards: [],
      backAction: null,
      signature: "hidden",
    });
    expect(createArenaChoiceViewModel(world, SIMULATION_CONFIG, false).visible).toBe(false);
  });

  it("presents weapon identity and menu actions without DOM state", () => {
    const world = createWorld(SIMULATION_CONFIG);
    world.state.status = "weaponSelect";

    const model = createArenaChoiceViewModel(world, SIMULATION_CONFIG);

    expect(model).toMatchObject({
      visible: true,
      kind: "weapon",
      title: TEXT.ui.weaponSelectTitle,
      backAction: "back",
    });
    expect(model.cards).toEqual([
      expect.objectContaining({
        id: "pulse",
        tone: "pulse",
        role: "単体集中",
        selection: { kind: "menu", action: "selectPulse" },
      }),
      expect.objectContaining({
        id: "spread",
        tone: "spread",
        role: "範囲制圧",
        selection: { kind: "menu", action: "selectSpread" },
      }),
    ]);
  });

  it("formats normal upgrade ranks and effect previews", () => {
    const world = createWorld(SIMULATION_CONFIG);
    world.state.status = "upgradeSelect";
    world.state.weaponType = "pulse";
    world.progression.level = 4;
    world.progression.pendingUpgradeChoices = ["rapidFire", "swiftStep", "vitalCore"];
    world.progression.upgradeRanks.rapidFire = 1;

    const model = createArenaChoiceViewModel(world, SIMULATION_CONFIG);

    expect(model.title).toBe("レベル 4 強化選択");
    expect(model.cards).toHaveLength(3);
    expect(model.cards[0]).toMatchObject({
      id: "rapidFire",
      title: "連射強化",
      rank: "ランク 2/5",
      selection: { kind: "upgrade", index: 0 },
    });
    expect(model.cards[0]?.metric).toContain("連射");
    expect(model.subtitle).toContain("反響回路 解放まで");
  });

  it("presents EX cycle progress and uncapped upgrade ranks", () => {
    const world = createWorld(SIMULATION_CONFIG);
    world.state.status = "upgradeSelect";
    world.progression.buildCompletedAt = 120;
    world.progression.extraLevel = 6;
    world.progression.extraCycle = 2;
    world.progression.extraCycleRemaining = ["limitPower", "limitCore"];
    world.progression.pendingUpgradeChoices = ["limitPower", "limitCycle"];
    world.progression.extraUpgradeRanks.limitPower = 3;
    world.progression.extraUpgradeRanks.limitCycle = 1;

    const model = createArenaChoiceViewModel(world, SIMULATION_CONFIG);

    expect(model.title).toBe("EXTRA LEVEL 6");
    expect(model.subtitle).toBe("通常ビルド完成 / EXサイクル C2 / 未取得 2");
    expect(model.cards[0]).toMatchObject({
      id: "limitPower",
      title: "限界出力",
      rank: "ランク 4",
    });
    expect(model.cards[0]?.metric).toBe("弾ダメージ x1.24 -> x1.32");
    expect(model.cards[1]?.rank).toBe("ランク 2/5");
  });

  it("presents contract consequences as indexed selections", () => {
    const world = createWorld(SIMULATION_CONFIG);
    world.state.status = "contractSelect";

    const model = createArenaChoiceViewModel(world, SIMULATION_CONFIG);

    expect(model).toMatchObject({
      kind: "contract",
      title: TEXT.ui.contractTitle,
      backAction: null,
    });
    expect(model.cards).toEqual([
      expect.objectContaining({
        id: "standard",
        tone: "contract-standard",
        selection: { kind: "contract", index: 0 },
      }),
      expect.objectContaining({
        id: "overdrive",
        tone: "contract-overdrive",
        selection: { kind: "contract", index: 1 },
      }),
    ]);
  });
});
