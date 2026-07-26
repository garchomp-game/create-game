import { describe, expect, it } from "vitest";
import { ArenaSession } from "../application/ArenaSession";
import { SIMULATION_CONFIG } from "../config/gameConfig";
import { TEXT } from "../lang";
import { createWorld } from "../simulation/createWorld";
import {
  chooseExProtocol,
  offerExProtocolEvolution,
  offerExProtocolSelection,
} from "../simulation/exProtocolProgression";
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
      subtitleProgress: null,
      keyboardHint: null,
      cards: [],
      backAction: null,
      footer: null,
      signature: "hidden",
    });
    expect(
      createArenaChoiceViewModel(world, SIMULATION_CONFIG, false).visible,
    ).toBe(false);
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
      keyboardHint: "数字キー 1 / 2 でも選択できます",
      backAction: "back",
    });
    expect(model.cards).toEqual([
      expect.objectContaining({
        id: "pulse",
        indexLabel: "1",
        tone: "pulse",
        role: "単体集中",
        facts: [
          { label: "弾道", text: "高速・直線" },
          { label: "得意", text: "単体への連続命中" },
          { label: "成長", text: "集束共鳴 → 反響回路" },
        ],
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

  it("uses the same weapon cards for Practice with a mode-specific heading", () => {
    const session = new ArenaSession(SIMULATION_CONFIG);
    session.start({
      seed: 20260726,
      weaponType: "pulse",
      status: "weaponSelect",
      modeId: "practice",
      stageId: "practice-arena",
    });

    const model = createArenaChoiceViewModel(session.world, session.config);

    expect(model).toMatchObject({
      kind: "weapon",
      phase: "weapon",
      eyebrow: "PRACTICE / LOADOUT",
      statusLabel: "開始装備",
      title: TEXT.ui.weaponSelectTitle,
      subtitle: "難易度固定・記録対象外。同じ武器性能で自由に練習できます",
      keyboardHint: "数字キー 1 / 2 でも選択できます",
      cards: [
        { id: "pulse", selection: { kind: "menu", action: "selectPulse" } },
        { id: "spread", selection: { kind: "menu", action: "selectSpread" } },
      ],
    });
  });

  it("formats normal upgrade ranks and effect previews", () => {
    const world = createWorld(SIMULATION_CONFIG);
    world.state.status = "upgradeSelect";
    world.state.weaponType = "pulse";
    world.progression.level = 4;
    world.progression.pendingUpgradeChoices = [
      "rapidFire",
      "swiftStep",
      "vitalCore",
    ];
    world.progression.upgradeRanks.rapidFire = 1;

    const model = createArenaChoiceViewModel(world, SIMULATION_CONFIG);

    expect(model.title).toBe("強化選択 — Lv 4");
    expect(model.keyboardHint).toBe("数字キー 1 / 2 / 3 でも選択できます");
    expect(model.subtitleProgress).toEqual({ current: 1, required: 7 });
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
      rank: null,
      rankProgress: { current: 2, max: 5 },
      categoryIcon: "weapon",
      metricLabel: "取得後",
      actionLabel: "取得する",
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

    expect(model.title).toBe("EX強化選択 — Lv 6 / 周回 2");
    expect(model.phase).toBe("extra");
    expect(model.statusLabel).toBe("EX強化 2周目");
    expect(model.subtitle).toBe("通常ビルド完成 / EX 2周目 / 未取得 2");
    expect(model.subtitleProgress).toBeNull();
    expect(model.cards[0]).toMatchObject({
      id: "limitPower",
      tone: "upgrade-extra",
      title: "限界出力",
      rank: "Lv 4",
      rankProgress: null,
      categoryIcon: "extra",
    });
    expect(model.cards[0]?.metric).toBe("弾ダメージ x1.24 -> x1.32");
    expect(model.cards[0]?.metricChange).toEqual({
      before: "弾ダメージ x1.24",
      after: "x1.32",
    });
    expect(model.cards[1]).toMatchObject({
      rank: null,
      rankProgress: { current: 2, max: 5 },
      categoryIcon: "extra",
    });
  });

  it("maps EX Protocol cards into the shared choice presentation contract", () => {
    const session = new ArenaSession(SIMULATION_CONFIG);
    session.start({
      seed: 20260723,
      weaponType: "pulse",
      rulesetProfileId: "candidate-ex-endless-c2",
    });
    expect(offerExProtocolSelection(session.world, session.config, [])).toBe(
      true,
    );

    const model = createArenaChoiceViewModel(session.world, session.config);

    expect(model).toMatchObject({
      visible: true,
      kind: "protocol",
      phase: "protocol",
      eyebrow: "BUILD COMPLETE / 固有スキル",
      statusLabel: "固有スキル",
      title: "固有スキル選択",
      subtitle: "通常ビルド完成 / 通常ビルドの仕上げとなる能力を1つ選択",
      keyboardHint: "数字キー 1 / 2 / 3 でも選択できます",
      footer: null,
    });
    expect(model.cards).toHaveLength(3);
    expect(model.cards[1]).toMatchObject({
      id: "pulse.rebound-overdrive",
      tone: "pulse",
      categoryIcon: "signature",
      skillIconId: "pulse.rebound-overdrive",
      facts: [{ label: "発動条件" }, { label: "効果" }, { label: "制約" }],
      inputHint: "右クリック / E で発動",
      selection: { kind: "upgrade", index: 1 },
    });
  });

  it("presents post-Metaphor evolution choices like normal skill cards", () => {
    const session = new ArenaSession(SIMULATION_CONFIG);
    session.start({
      seed: 20260723,
      weaponType: "pulse",
      rulesetProfileId: "candidate-ex-endless-c2",
    });
    expect(offerExProtocolSelection(session.world, session.config, [])).toBe(
      true,
    );
    expect(chooseExProtocol(session.world, 0, session.config, [])).toBe(true);
    session.world.progression.extraLevel = 1;
    expect(offerExProtocolEvolution(session.world, 1, [])).toBe(true);

    const model = createArenaChoiceViewModel(session.world, session.config);

    expect(model).toMatchObject({
      kind: "evolution",
      phase: "evolution",
      statusLabel: "EX Lv 1",
      title: "固有スキル強化 — EX Lv 1",
      keyboardHint: "数字キー 1 / 2 でも選択できます",
      footer: null,
    });
    expect(model.subtitle).toContain("強化 1");
    expect(model.cards[0]).toMatchObject({
      kind: "evolution",
      role: "固有スキル",
      rankProgress: { current: 1, max: 2 },
      categoryIcon: "extra",
      skillIconId: "pulse.resonance-relay",
      selection: { kind: "upgrade", index: 0 },
    });
  });

  it("labels typed EX upgrades as Limit Break choices", () => {
    const session = new ArenaSession(SIMULATION_CONFIG);
    session.start({
      seed: 20260723,
      weaponType: "pulse",
      rulesetProfileId: "candidate-ex-endless-c2",
    });
    expect(offerExProtocolSelection(session.world, session.config, [])).toBe(
      true,
    );
    expect(chooseExProtocol(session.world, 0, session.config, [])).toBe(true);
    session.world.state.status = "upgradeSelect";
    session.world.progression.buildCompletedAt = 120;
    session.world.progression.extraLevel = 3;
    session.world.progression.extraCycle = 1;
    session.world.progression.extraCycleRemaining = [
      "limitPower",
      "limitCycle",
      "limitCore",
      "limitDrive",
    ];
    session.world.progression.pendingUpgradeChoices = [
      "limitPower",
      "limitCycle",
      "limitCore",
    ];
    session.world.progression.pendingChoice = {
      kind: "limit-break",
      choices: ["limitPower", "limitCycle", "limitCore"],
    };

    const model = createArenaChoiceViewModel(session.world, session.config);

    expect(model.eyebrow).toBe("EX / 限界強化");
    expect(model.statusLabel).toBe("EX Lv 3");
    expect(model.title).toBe("限界強化 — EX Lv 3 / 周回 1");
    expect(model.subtitle).toContain("交差導線");
    expect(model.subtitle).toContain("未取得 4");
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
