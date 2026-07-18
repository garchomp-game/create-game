import type { MenuAction } from "../application/ArenaMenuTypes";
import type {
  ExtraUpgradeEffect,
  ProgressionChoiceId,
  SimulationConfig,
  UpgradeId,
  WeaponTypeId,
  WorldState,
} from "../domain/types";
import { TEXT } from "../lang";
import { getUpgradeRequirementProgress } from "../simulation/buildComposer";
import { isExtraUpgradeId } from "../simulation/extraProgression";
import { createUpgradePreview, formatUpgradePreview } from "../simulation/upgradePreview";

export type ArenaChoiceKind = "weapon" | "upgrade" | "contract";

export type ArenaChoiceSelection =
  | { kind: "menu"; action: MenuAction }
  | { kind: "upgrade"; index: number }
  | { kind: "contract"; index: number };

export type ArenaChoiceCardViewModel = {
  kind: ArenaChoiceKind;
  index: number;
  id: string;
  tone: "pulse" | "spread" | "upgrade" | "contract-standard" | "contract-overdrive";
  role: string;
  title: string;
  rank: string | null;
  description: string;
  metric: string;
  selection: ArenaChoiceSelection;
};

export type ArenaChoiceViewModel = {
  visible: boolean;
  kind: ArenaChoiceKind | null;
  title: string;
  subtitle: string;
  cards: ArenaChoiceCardViewModel[];
  backAction: MenuAction | null;
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
      title: "",
      subtitle: "",
      cards: [],
      backAction: null,
      signature: "hidden",
    };
  }

  if (world.state.status === "weaponSelect") {
    return createWeaponChoices(world);
  }
  if (world.state.status === "upgradeSelect") {
    return createUpgradeChoices(world, config);
  }
  return createContractChoices(world);
}

function createWeaponChoices(world: WorldState): ArenaChoiceViewModel {
  const expedition = Boolean(world.expedition);
  return {
    visible: true,
    kind: "weapon",
    title: expedition ? `最終遠征 / ${TEXT.ui.weaponSelectTitle}` : TEXT.ui.weaponSelectTitle,
    subtitle: expedition
      ? "5つのActを突破する開始ビルドを選択"
      : "開始ビルドの戦い方を決めます",
    cards: [
      createWeaponCard(
        0,
        "pulse",
        "単体集中",
        "高速な単線射撃。狙い続けた敵への連続命中で火力を伸ばす。",
        "固有: 集束共鳴 / 最終: 反響回路",
        "selectPulse",
      ),
      createWeaponCard(
        1,
        "spread",
        "範囲制圧",
        "広角の複数弾。敵集団を同時に捉えて射撃テンポを上げる。",
        "固有: 分裂射撃 / 最終: 掃射循環",
        "selectSpread",
      ),
    ],
    backAction: "back",
    signature: createSignature(world),
  };
}

function createWeaponCard(
  index: number,
  weaponId: Extract<WeaponTypeId, "pulse" | "spread">,
  role: string,
  description: string,
  metric: string,
  action: MenuAction,
): ArenaChoiceCardViewModel {
  return {
    kind: "weapon",
    index,
    id: weaponId,
    tone: weaponId,
    role,
    title: TEXT.hud.weaponNames[weaponId],
    rank: null,
    description,
    metric,
    selection: { kind: "menu", action },
  };
}

function createUpgradeChoices(
  world: WorldState,
  config: SimulationConfig,
): ArenaChoiceViewModel {
  const choices = world.progression.pendingUpgradeChoices;
  const extra = world.progression.buildCompletedAt !== null;
  return {
    visible: true,
    kind: "upgrade",
    title: extra
      ? `EXTRA LEVEL ${world.progression.extraLevel}`
      : `レベル ${world.progression.level} 強化選択`,
    subtitle: createProgressText(world, config),
    cards: choices.map((choiceId, index) => createUpgradeCard(world, config, choiceId, index)),
    backAction: null,
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
    const rank = definition.maxRank === null ? `${nextRank}` : `${nextRank}/${definition.maxRank}`;
    return {
      kind: "upgrade",
      index,
      id: choiceId,
      tone: "upgrade",
      role: TEXT.upgrades.extraCategoryLabel,
      title: display.title,
      rank: `${TEXT.ui.rank} ${rank}`,
      description: display.description,
      metric: formatExtraPreview(definition.effect, currentRank),
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
    id: choiceId,
    tone: "upgrade",
    role: TEXT.upgrades.categoryLabels[definition.category],
    title: display.title,
    rank: `${TEXT.ui.rank} ${currentRank + 1}/${definition.maxRank}`,
    description: display.description,
    metric: preview,
    selection: { kind: "upgrade", index },
  };
}

function createContractChoices(world: WorldState): ArenaChoiceViewModel {
  return {
    visible: true,
    kind: "contract",
    title: TEXT.ui.contractTitle,
    subtitle: "ラン後半のリスクと記録区分を選択",
    cards: [
      {
        kind: "contract",
        index: 0,
        id: "standard",
        tone: "contract-standard",
        role: "安定",
        title: "標準維持",
        rank: null,
        description: "現在の難易度倍率を維持",
        metric: "ランキング対象を継続",
        selection: { kind: "contract", index: 0 },
      },
      {
        kind: "contract",
        index: 1,
        id: "overdrive",
        tone: "contract-overdrive",
        role: "高リスク",
        title: "過負荷",
        rank: null,
        description: "敵速度 +12% / スコア x1.3",
        metric: "ランキング対象外",
        selection: { kind: "contract", index: 1 },
      },
    ],
    backAction: null,
    signature: createSignature(world),
  };
}

function createProgressText(world: WorldState, config: SimulationConfig): string {
  if (world.progression.buildCompletedAt !== null) {
    return `通常ビルド完成 / EXサイクル C${world.progression.extraCycle} / 未取得 ${world.progression.extraCycleRemaining.length}`;
  }

  const capstoneId = getCapstoneId(world.state.weaponType);
  if (!capstoneId) return "通常強化を選択";
  const display = TEXT.upgrades.definitions[capstoneId];
  if (world.progression.upgradeRanks[capstoneId] > 0) {
    return TEXT.upgrades.capstoneAcquired(display.title);
  }
  const progress = getUpgradeRequirementProgress(
    config,
    capstoneId,
    world.progression.upgradeRanks,
  )[0];
  return progress
    ? `${display.title} 解放まで 武器強化 ${progress.current}/${progress.required}`
    : `${display.title}: 解放条件なし`;
}

function getCapstoneId(weaponId: WeaponTypeId): UpgradeId | null {
  if (weaponId === "pulse") return "pulseRicochet";
  if (weaponId === "spread") return "spreadSweep";
  return null;
}

function createSignature(world: WorldState): string {
  return [
    world.state.status,
    world.state.weaponType,
    world.expedition?.actId ?? "endless",
    world.progression.level,
    world.progression.extraLevel,
    world.progression.extraCycle,
    world.progression.buildCompletedAt,
    world.progression.pendingUpgradeChoices.join(","),
    Object.values(world.progression.upgradeRanks).join(","),
    Object.values(world.progression.extraUpgradeRanks).join(","),
  ].join(":");
}

function formatExtraPreview(effect: ExtraUpgradeEffect, currentRank: number): string {
  const nextRank = currentRank + 1;
  if (effect.type === "projectileDamage") {
    return `弾ダメージ x${(1 + effect.amountPerRank * currentRank).toFixed(2)} -> x${(
      1 + effect.amountPerRank * nextRank
    ).toFixed(2)}`;
  }
  if (effect.type === "fireRate" || effect.type === "moveSpeed") {
    const current = Math.min(effect.maximumBonus, effect.amountPerRank * currentRank);
    const next = Math.min(effect.maximumBonus, effect.amountPerRank * nextRank);
    const label = effect.type === "fireRate" ? "追加連射" : "追加移動速度";
    return `${label} +${Math.round(current * 100)}% -> +${Math.round(next * 100)}%`;
  }
  return `追加HP +${effect.amountPerRank * currentRank} -> +${effect.amountPerRank * nextRank}`;
}

function isChoiceStatus(
  status: WorldState["state"]["status"],
): status is "weaponSelect" | "upgradeSelect" | "contractSelect" {
  return status === "weaponSelect" || status === "upgradeSelect" || status === "contractSelect";
}
