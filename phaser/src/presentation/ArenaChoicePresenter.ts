import type { MenuAction } from "../application/ArenaMenuTypes";
import type {
  ExtraUpgradeEffect,
  ProgressionChoiceId,
  SimulationConfig,
  UpgradeCategory,
  UpgradeId,
  WeaponTypeId,
  WorldState,
} from "../domain/types";
import type { ExProtocolId } from "../domain/exProtocols";
import { TEXT } from "../lang";
import { getUpgradeRequirementProgress } from "../simulation/buildComposer";
import { isExtraUpgradeId } from "../simulation/extraProgression";
import {
  createUpgradePreview,
  formatUpgradePreview,
} from "../simulation/upgradePreview";
import {
  createExProtocolChoiceViewModel,
  formatSelectedExProtocolRoute,
} from "./ExProtocolPresenter";

export type ArenaChoiceKind =
  "weapon" | "upgrade" | "protocol" | "evolution" | "contract";
export type ArenaChoicePhase = ArenaChoiceKind | "extra";
export type ArenaChoiceTone =
  | "pulse"
  | "spread"
  | "upgrade-weapon"
  | "upgrade-mobility"
  | "upgrade-survival"
  | "upgrade-support"
  | "upgrade-capstone"
  | "upgrade-extra"
  | "contract-standard"
  | "contract-overdrive";

export type ArenaChoiceCategoryIcon = UpgradeCategory | "extra" | "signature";

export type ArenaChoiceRankProgress = {
  current: number;
  max: number;
};

export type ArenaChoiceSubtitleProgress = {
  current: number;
  required: number;
};

export type ArenaChoiceSelection =
  | { kind: "menu"; action: MenuAction }
  | { kind: "upgrade"; index: number }
  | { kind: "contract"; index: number };

export type ArenaChoiceCardViewModel = {
  kind: ArenaChoiceKind;
  index: number;
  indexLabel: string;
  id: string;
  tone: ArenaChoiceTone;
  role: string;
  title: string;
  rank: string | null;
  rankProgress: ArenaChoiceRankProgress | null;
  categoryIcon: ArenaChoiceCategoryIcon | null;
  skillIconId?: ExProtocolId | null;
  description: string;
  metricLabel: string;
  metric: string;
  metricChange?: {
    before: string;
    after: string;
  } | null;
  actionLabel: string;
  facts?: Array<{ label: string; text: string }>;
  inputHint?: string | null;
  ariaLabel?: string;
  selection: ArenaChoiceSelection;
};

export type ArenaChoiceViewModel = {
  visible: boolean;
  kind: ArenaChoiceKind | null;
  phase: ArenaChoicePhase | null;
  eyebrow: string;
  statusLabel: string;
  title: string;
  subtitle: string;
  subtitleProgress: ArenaChoiceSubtitleProgress | null;
  keyboardHint: string | null;
  cards: ArenaChoiceCardViewModel[];
  backAction: MenuAction | null;
  footer: string | null;
  signature: string;
};

export function createArenaChoiceViewModel(
  world: WorldState,
  config: SimulationConfig,
  enabled = true,
): ArenaChoiceViewModel {
  const visible = enabled && isChoiceStatus(world.state.status);
  if (!visible) {
    return {
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
    };
  }

  if (world.state.status === "weaponSelect") {
    return createWeaponChoices(world);
  }
  if (world.state.status === "upgradeSelect") {
    return createUpgradeChoices(world, config);
  }
  if (
    world.state.status === "protocolSelect" ||
    world.state.status === "evolutionSelect"
  ) {
    return createExProtocolChoices(world);
  }
  return createContractChoices(world);
}

function createWeaponChoices(world: WorldState): ArenaChoiceViewModel {
  const expedition = Boolean(world.expedition);
  const practice = Boolean(world.practice);
  return {
    visible: true,
    kind: "weapon",
    phase: "weapon",
    eyebrow: expedition
      ? "FINAL EXPEDITION / LOADOUT"
      : practice
        ? "PRACTICE / LOADOUT"
        : "ENDLESS / LOADOUT",
    statusLabel: "開始装備",
    title: expedition
      ? `最終遠征 / ${TEXT.ui.weaponSelectTitle}`
      : TEXT.ui.weaponSelectTitle,
    subtitle: expedition
      ? "5つのActを突破する開始ビルドを選択"
      : practice
        ? "難易度固定・記録対象外。同じ武器性能で自由に練習できます"
        : "開始ビルドの戦い方を決めます",
    subtitleProgress: null,
    keyboardHint: "数字キー 1 / 2 でも選択できます",
    cards: [
      createWeaponCard(
        0,
        "pulse",
        "単体集中",
        "高速な単線射撃。狙い続けた敵への連続命中で火力を伸ばす。",
        [
          { label: "弾道", text: "高速・直線" },
          { label: "得意", text: "単体への連続命中" },
          { label: "成長", text: "集束共鳴 → 反響回路" },
        ],
        "selectPulse",
      ),
      createWeaponCard(
        1,
        "spread",
        "範囲制圧",
        "広角の複数弾。敵集団を同時に捉えて射撃テンポを上げる。",
        [
          { label: "弾道", text: "低速・扇状" },
          { label: "得意", text: "複数の敵を同時攻撃" },
          { label: "成長", text: "分裂射撃 → 掃射循環" },
        ],
        "selectSpread",
      ),
    ],
    backAction: "back",
    footer: null,
    signature: createSignature(world),
  };
}

function createWeaponCard(
  index: number,
  weaponId: Extract<WeaponTypeId, "pulse" | "spread">,
  role: string,
  description: string,
  facts: Array<{ label: string; text: string }>,
  action: MenuAction,
): ArenaChoiceCardViewModel {
  return {
    kind: "weapon",
    index,
    indexLabel: formatChoiceIndex(index),
    id: weaponId,
    tone: weaponId,
    role,
    title: TEXT.hud.weaponNames[weaponId],
    rank: null,
    rankProgress: null,
    categoryIcon: null,
    description,
    metricLabel: "武器特性",
    metric: "",
    actionLabel: "この武器で開始",
    facts,
    ariaLabel: `${index + 1}. ${TEXT.hud.weaponNames[weaponId]}。${role}。${description}`,
    selection: { kind: "menu", action },
  };
}

function createUpgradeChoices(
  world: WorldState,
  config: SimulationConfig,
): ArenaChoiceViewModel {
  const choices = world.progression.pendingUpgradeChoices;
  const extra = world.progression.buildCompletedAt !== null;
  const limitBreak = world.progression.pendingChoice?.kind === "limit-break";
  const progressPresentation = createProgressPresentation(world, config);
  return {
    visible: true,
    kind: "upgrade",
    phase: extra ? "extra" : "upgrade",
    eyebrow: limitBreak
      ? "EX / 限界強化"
      : extra
        ? "EX / 周回強化"
        : "LEVEL UP / BUILD",
    statusLabel: limitBreak
      ? `EX Lv ${world.progression.extraLevel}`
      : extra
        ? `EX強化 ${world.progression.extraCycle}周目`
        : "通常強化",
    title: limitBreak
      ? `限界強化 — EX Lv ${world.progression.extraLevel} / 周回 ${world.progression.extraCycle}`
      : extra
        ? `EX強化選択 — Lv ${world.progression.extraLevel} / 周回 ${world.progression.extraCycle}`
        : `強化選択 — Lv ${world.progression.level}`,
    subtitle: limitBreak
      ? `${formatSelectedExProtocolRoute(world)} / 未取得 ${world.progression.extraCycleRemaining.length}`
      : progressPresentation.text,
    subtitleProgress: limitBreak ? null : progressPresentation.progress,
    keyboardHint: "数字キー 1 / 2 / 3 でも選択できます",
    cards: choices.map((choiceId, index) =>
      createUpgradeCard(world, config, choiceId, index),
    ),
    backAction: null,
    footer: null,
    signature: createSignature(world),
  };
}

function createExProtocolChoices(world: WorldState): ArenaChoiceViewModel {
  const model = createExProtocolChoiceViewModel(world);
  if (!model) {
    throw new Error(
      `Missing EX Protocol choice view model for "${world.state.status}".`,
    );
  }
  const evolutionTier =
    world.progression.pendingChoice?.kind === "evolution-two" ? 2 : 1;
  const isEvolution = model.kind === "evolution";

  return {
    visible: true,
    kind: model.kind,
    phase: model.kind,
    eyebrow:
      model.kind === "protocol"
        ? "BUILD COMPLETE / 固有スキル"
        : "固有スキル / 強化",
    statusLabel:
      model.kind === "protocol"
        ? "固有スキル"
        : `EX Lv ${world.progression.extraLevel}`,
    title: isEvolution
      ? `固有スキル強化 — EX Lv ${world.progression.extraLevel}`
      : "固有スキル選択",
    subtitle: isEvolution
      ? `${model.title} / ${model.subtitle}`
      : `通常ビルド完成 / ${model.subtitle}`,
    subtitleProgress: null,
    keyboardHint:
      model.kind === "protocol"
        ? "数字キー 1 / 2 / 3 でも選択できます"
        : "数字キー 1 / 2 でも選択できます",
    cards: model.cards.map((card, index) => ({
      kind: model.kind,
      index,
      indexLabel: formatChoiceIndex(index),
      id: card.id,
      tone: world.state.weaponType === "spread" ? "spread" : "pulse",
      role: isEvolution ? "固有スキル" : card.role,
      title: card.title,
      rank: null,
      rankProgress: isEvolution
        ? { current: evolutionTier, max: 2 }
        : null,
      categoryIcon: isEvolution ? "extra" : "signature",
      skillIconId: card.protocolId,
      description: card.summary,
      metricLabel: card.facts[0]?.label ?? "効果",
      metric: card.facts[0]?.text ?? card.summary,
      actionLabel:
        model.kind === "protocol" ? "この固有能力を選択" : "この進化を選択",
      facts: card.facts,
      inputHint: card.inputHint,
      ariaLabel: card.ariaLabel,
      selection: { kind: "upgrade", index },
    })),
    backAction: null,
    footer:
      model.kind === "protocol" || evolutionTier === 1
        ? null
        : model.footer,
    signature: createSignature(world),
  };
}

function createUpgradeCard(
  world: WorldState,
  config: SimulationConfig,
  choiceId: ProgressionChoiceId,
  index: number,
): ArenaChoiceCardViewModel {
  if (isExtraUpgradeId(choiceId)) {
    const definition = config.extraUpgrades[choiceId];
    const display = TEXT.upgrades.extraDefinitions[choiceId];
    const currentRank = world.progression.extraUpgradeRanks[choiceId];
    const nextRank = currentRank + 1;
    const rank = definition.maxRank === null ? `Lv ${nextRank}` : null;
    const preview = formatExtraPreview(definition.effect, currentRank);
    return {
      kind: "upgrade",
      index,
      indexLabel: formatChoiceIndex(index),
      id: choiceId,
      tone: "upgrade-extra",
      role: TEXT.upgrades.extraCategoryLabel,
      title: display.title,
      rank,
      rankProgress:
        definition.maxRank === null
          ? null
          : { current: nextRank, max: definition.maxRank },
      categoryIcon: "extra",
      description: display.description,
      metricLabel: "取得後",
      metric: preview,
      metricChange: createMetricChange(preview),
      actionLabel: "取得する",
      selection: { kind: "upgrade", index },
    };
  }

  const definition = config.upgrades[choiceId];
  const display = TEXT.upgrades.definitions[choiceId];
  const currentRank = world.progression.upgradeRanks[choiceId];
  const preview = formatUpgradePreview(
    createUpgradePreview(world, config, choiceId),
    TEXT.upgrades.preview.labels,
    TEXT.upgrades.preview,
  );
  return {
    kind: "upgrade",
    index,
    indexLabel: formatChoiceIndex(index),
    id: choiceId,
    tone: getUpgradeTone(definition.category),
    role: TEXT.upgrades.categoryLabels[definition.category],
    title: display.title,
    rank: null,
    rankProgress: {
      current: currentRank + 1,
      max: definition.maxRank,
    },
    categoryIcon: definition.category,
    description: display.description,
    metricLabel: "取得後",
    metric: preview,
    metricChange: createMetricChange(preview),
    actionLabel: "取得する",
    selection: { kind: "upgrade", index },
  };
}

function createContractChoices(world: WorldState): ArenaChoiceViewModel {
  return {
    visible: true,
    kind: "contract",
    phase: "contract",
    eyebrow: "ENDLESS / RISK CONTRACT",
    statusLabel: "危険契約",
    title: TEXT.ui.contractTitle,
    subtitle: "ラン後半のリスクと記録区分を選択",
    subtitleProgress: null,
    keyboardHint: null,
    cards: [
      {
        kind: "contract",
        index: 0,
        indexLabel: formatChoiceIndex(0),
        id: "standard",
        tone: "contract-standard",
        role: "安定",
        title: "標準維持",
        rank: null,
        rankProgress: null,
        categoryIcon: null,
        description: "現在の難易度倍率を維持",
        metricLabel: "契約結果",
        metric: "ランキング対象を継続",
        actionLabel: "この契約を選択",
        selection: { kind: "contract", index: 0 },
      },
      {
        kind: "contract",
        index: 1,
        indexLabel: formatChoiceIndex(1),
        id: "overdrive",
        tone: "contract-overdrive",
        role: "高リスク",
        title: "過負荷",
        rank: null,
        rankProgress: null,
        categoryIcon: null,
        description: "敵速度 +12% / スコア x1.3",
        metricLabel: "契約結果",
        metric: "ランキング対象外",
        actionLabel: "この契約を選択",
        selection: { kind: "contract", index: 1 },
      },
    ],
    backAction: null,
    footer: null,
    signature: createSignature(world),
  };
}

function createProgressPresentation(
  world: WorldState,
  config: SimulationConfig,
): {
  text: string;
  progress: ArenaChoiceSubtitleProgress | null;
} {
  if (world.progression.buildCompletedAt !== null) {
    return {
      text: `通常ビルド完成 / EX ${world.progression.extraCycle}周目 / 未取得 ${world.progression.extraCycleRemaining.length}`,
      progress: null,
    };
  }

  const capstoneId = getCapstoneId(world.state.weaponType);
  if (!capstoneId) {
    return { text: "通常強化を選択", progress: null };
  }
  const display = TEXT.upgrades.definitions[capstoneId];
  if (world.progression.upgradeRanks[capstoneId] > 0) {
    return {
      text: TEXT.upgrades.capstoneAcquired(display.title),
      progress: null,
    };
  }
  const progress = getUpgradeRequirementProgress(
    config,
    capstoneId,
    world.progression.upgradeRanks,
  )[0];
  return progress
    ? {
        text: `${display.title} 解放まで 武器強化 ${progress.current}/${progress.required}`,
        progress: {
          current: progress.current,
          required: progress.required,
        },
      }
    : { text: `${display.title}: 解放条件なし`, progress: null };
}

function createMetricChange(
  metric: string,
): ArenaChoiceCardViewModel["metricChange"] {
  const separator = " -> ";
  const separatorIndex = metric.indexOf(separator);
  if (separatorIndex < 0) return null;
  return {
    before: metric.slice(0, separatorIndex),
    after: metric.slice(separatorIndex + separator.length),
  };
}

function getCapstoneId(weaponId: WeaponTypeId): UpgradeId | null {
  if (weaponId === "pulse") return "pulseRicochet";
  if (weaponId === "spread") return "spreadSweep";
  return null;
}

function getUpgradeTone(category: UpgradeCategory): ArenaChoiceTone {
  return `upgrade-${category}`;
}

function formatChoiceIndex(index: number): string {
  return String(index + 1);
}

function createSignature(world: WorldState): string {
  const pendingChoice = world.progression.pendingChoice;
  return [
    world.state.status,
    world.state.weaponType,
    world.expedition?.actId ?? "endless",
    world.progression.level,
    world.progression.extraLevel,
    world.progression.extraCycle,
    world.progression.buildCompletedAt,
    world.progression.pendingUpgradeChoices.join(","),
    pendingChoice?.kind ?? "",
    pendingChoice && "choices" in pendingChoice
      ? pendingChoice.choices.join(",")
      : "",
    pendingChoice &&
    (pendingChoice.kind === "evolution-one" ||
      pendingChoice.kind === "evolution-two")
      ? pendingChoice.protocolId
      : "",
    world.progression.exProtocol?.status ?? "",
    world.progression.exProtocol?.status === "selected"
      ? [
          world.progression.exProtocol.route.protocolId,
          world.progression.exProtocol.route.evolutionOneId,
          world.progression.exProtocol.route.evolutionTwoId,
          world.progression.exProtocol.route.masteryUnlocked,
        ].join(",")
      : "",
    Object.values(world.progression.upgradeRanks).join(","),
    Object.values(world.progression.extraUpgradeRanks).join(","),
  ].join(":");
}

function formatExtraPreview(
  effect: ExtraUpgradeEffect,
  currentRank: number,
): string {
  const nextRank = currentRank + 1;
  if (effect.type === "projectileDamage") {
    return `弾ダメージ x${(1 + effect.amountPerRank * currentRank).toFixed(2)} -> x${(
      1 +
      effect.amountPerRank * nextRank
    ).toFixed(2)}`;
  }
  if (effect.type === "fireRate" || effect.type === "moveSpeed") {
    const current = Math.min(
      effect.maximumBonus,
      effect.amountPerRank * currentRank,
    );
    const next = Math.min(effect.maximumBonus, effect.amountPerRank * nextRank);
    const label = effect.type === "fireRate" ? "追加連射" : "追加移動速度";
    return `${label} +${Math.round(current * 100)}% -> +${Math.round(next * 100)}%`;
  }
  return `追加HP +${effect.amountPerRank * currentRank} -> +${effect.amountPerRank * nextRank}`;
}

function isChoiceStatus(
  status: WorldState["state"]["status"],
): status is
  | "weaponSelect"
  | "upgradeSelect"
  | "protocolSelect"
  | "evolutionSelect"
  | "contractSelect" {
  return (
    status === "weaponSelect" ||
    status === "upgradeSelect" ||
    status === "protocolSelect" ||
    status === "evolutionSelect" ||
    status === "contractSelect"
  );
}
