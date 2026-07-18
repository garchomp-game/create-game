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
      phase: null,
      eyebrow: "",
      statusLabel: "",
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
      phase: "weapon",
      eyebrow: "ENDLESS / LOADOUT",
      statusLabel: "開始装備",
      title: TEXT.ui.weaponSelectTitle,
      backAction: "back",
    });
    expect(model.cards).toEqual([
      expect.objectContaining({
        id: "pulse",
        indexLabel: "1",
        tone: "pulse",
        role: "単体集中",
        metricLabel: "武器特性",
        actionLabel: "この武器で開始",
        selection: { kind: "menu", action: "selectPulse" },
      }),
      expect.objectContaining({
        id: "spread",
        indexLabel: "2",
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
    expect(model).toMatchObject({
      phase: "upgrade",
      eyebrow: "LEVEL UP / BUILD",
      statusLabel: "通常強化",
    });
    expect(model.cards).toHaveLength(3);
    expect(model.cards[0]).toMatchObject({
      id: "rapidFire",
      indexLabel: "1",
      tone: "upgrade-weapon",
      title: "連射強化",
      rank: "ランク 2/5",
      metricLabel: "取得後",
      actionLabel: "この強化を取得",
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
    expect(model.phase).toBe("extra");
    expect(model.statusLabel).toBe("EX強化 C2");
    expect(model.subtitle).toBe("通常ビルド完成 / EXサイクル C2 / 未取得 2");
    expect(model.cards[0]).toMatchObject({
      id: "limitPower",
      tone: "upgrade-extra",
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
      phase: "contract",
      eyebrow: "ENDLESS / RISK CONTRACT",
      statusLabel: "危険契約",
      title: TEXT.ui.contractTitle,
      backAction: null,
    });
    expect(model.cards).toEqual([
      expect.objectContaining({
        id: "standard",
        indexLabel: "1",
        tone: "contract-standard",
        metricLabel: "契約結果",
        actionLabel: "この契約を選択",
        selection: { kind: "contract", index: 0 },
      }),
      expect.objectContaining({
        id: "overdrive",
        indexLabel: "2",
        tone: "contract-overdrive",
        selection: { kind: "contract", index: 1 },
      }),
    ]);
  });
});
