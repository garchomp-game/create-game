import type { MenuAction } from "../phaser/PhaserMenuLayout";
import type {
  ExtraUpgradeEffect,
  ProgressionChoiceId,
  SimulationConfig,
  UpgradeId,
  WeaponTypeId,
  WorldState,
} from "../../domain/types";
import { TEXT } from "../../lang";
import { getUpgradeRequirementProgress } from "../../simulation/buildComposer";
import { isExtraUpgradeId } from "../../simulation/extraProgression";
import { createUpgradePreview, formatUpgradePreview } from "../../simulation/upgradePreview";

export type ArenaChoiceInput = {
  menuAction: MenuAction | null;
  upgradeChoice: number | null;
  contractChoice: number | null;
};

export class ArenaChoiceOverlay {
  private readonly root: HTMLDivElement;
  private signature = "";
  private visibleChoiceCount = 0;
  private pendingInput: ArenaChoiceInput = emptyInput();

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly config: SimulationConfig,
  ) {
    const parent = canvas.parentElement;
    if (!parent) throw new Error("Arena canvas parent is not available.");

    this.root = document.createElement("div");
    this.root.className = "arena-choice-overlay";
    this.root.setAttribute("aria-hidden", "true");
    this.root.addEventListener("keydown", (event) => this.handleKeyDown(event));
    parent.append(this.root);
  }

  render(world: WorldState, enabled = true): void {
    this.syncBounds();
    const visible =
      enabled &&
      (world.state.status === "weaponSelect" ||
        world.state.status === "upgradeSelect" ||
        world.state.status === "contractSelect");
    this.root.classList.toggle("arena-choice-overlay--visible", visible);
    this.root.setAttribute("aria-hidden", visible ? "false" : "true");
    if (!visible) {
      this.signature = "";
      this.visibleChoiceCount = 0;
      return;
    }

    const signature = createSignature(world);
    if (signature === this.signature) return;
    this.signature = signature;
    this.root.replaceChildren();

    if (world.state.status === "weaponSelect") this.renderWeaponChoices();
    else if (world.state.status === "upgradeSelect") this.renderUpgradeChoices(world);
    else this.renderContractChoices();
  }

  consumeInput(): ArenaChoiceInput {
    const input = this.pendingInput;
    this.pendingInput = emptyInput();
    return input;
  }

  clearInput(): void {
    this.pendingInput = emptyInput();
  }

  destroy(): void {
    this.root.remove();
  }

  private renderWeaponChoices(): void {
    this.visibleChoiceCount = 2;
    const shell = this.createShell(TEXT.ui.weaponSelectTitle, "開始ビルドの戦い方を決めます");
    const choices = element("div", "arena-choice-grid arena-choice-grid--two");
    choices.append(
      this.createWeaponButton(
        0,
        "pulse",
        "単体集中",
        "高速な単線射撃。狙い続けた敵への連続命中で火力を伸ばす。",
        "固有: 集束共鳴 / 最終: 反響回路",
        "selectPulse",
      ),
      this.createWeaponButton(
        1,
        "spread",
        "範囲制圧",
        "広角の複数弾。敵集団を同時に捉えて射撃テンポを上げる。",
        "固有: 分裂射撃 / 最終: 掃射循環",
        "selectSpread",
      ),
    );
    shell.append(choices);

    const back = element("button", "arena-choice-back", "戻る");
    back.type = "button";
    back.dataset.choiceAction = "back";
    back.addEventListener("click", () => {
      this.pendingInput.menuAction = "back";
    });
    shell.append(back);
    this.root.append(shell);
  }

  private renderUpgradeChoices(world: WorldState): void {
    const choices = world.progression.pendingUpgradeChoices;
    this.visibleChoiceCount = choices.length;
    const extra = world.progression.buildCompletedAt !== null;
    const title = extra
      ? `EXTRA LEVEL ${world.progression.extraLevel}`
      : `レベル ${world.progression.level} 強化選択`;
    const shell = this.createShell(title, this.createProgressText(world));
    const grid = element(
      "div",
      `arena-choice-grid arena-choice-grid--${choices.length === 2 ? "two" : "three"}`,
    );
    choices.forEach((choiceId, index) => grid.append(this.createUpgradeButton(world, choiceId, index)));
    shell.append(grid);
    this.root.append(shell);
  }

  private renderContractChoices(): void {
    this.visibleChoiceCount = 2;
    const shell = this.createShell(TEXT.ui.contractTitle, "ラン後半のリスクと記録区分を選択");
    const choices = element("div", "arena-choice-grid arena-choice-grid--two");
    choices.append(
      this.createContractButton(
        0,
        "標準維持",
        "現在の難易度倍率を維持",
        "ランキング対象を継続",
        "standard",
      ),
      this.createContractButton(
        1,
        "過負荷",
        "敵速度 +12% / スコア x1.3",
        "ランキング対象外",
        "overdrive",
      ),
    );
    shell.append(choices);
    this.root.append(shell);
  }

  private createShell(title: string, subtitle: string): HTMLElement {
    const shell = element("section", "arena-choice-shell");
    shell.setAttribute("aria-label", title);
    const header = element("header", "arena-choice-header");
    header.append(
      element("h1", "arena-choice-title", title),
      element("p", "arena-choice-subtitle", subtitle),
    );
    shell.append(header);
    return shell;
  }

  private createWeaponButton(
    index: number,
    weaponId: WeaponTypeId,
    role: string,
    description: string,
    growth: string,
    action: MenuAction,
  ): HTMLButtonElement {
    const button = element("button", `arena-choice-card arena-choice-card--${weaponId}`);
    button.type = "button";
    button.dataset.choiceKind = "weapon";
    button.dataset.choiceIndex = String(index);
    button.dataset.choiceId = weaponId;
    button.dataset.choiceAction = action;
    button.append(
      element("span", "arena-choice-role", role),
      element("strong", "arena-choice-card-title", TEXT.hud.weaponNames[weaponId]),
      element("span", "arena-choice-card-description", description),
      element("span", "arena-choice-card-metric", growth),
    );
    button.addEventListener("click", () => {
      this.pendingInput.menuAction = action;
    });
    return button;
  }

  private createUpgradeButton(
    world: WorldState,
    choiceId: ProgressionChoiceId,
    index: number,
  ): HTMLButtonElement {
    const button = element("button", "arena-choice-card arena-choice-card--upgrade");
    button.type = "button";
    button.dataset.choiceKind = "upgrade";
    button.dataset.choiceIndex = String(index);
    button.dataset.choiceId = choiceId;

    if (isExtraUpgradeId(choiceId)) {
      const definition = this.config.extraUpgrades[choiceId];
      const display = TEXT.upgrades.extraDefinitions[choiceId];
      const currentRank = world.progression.extraUpgradeRanks[choiceId];
      const nextRank = currentRank + 1;
      const rank = definition.maxRank === null ? `${nextRank}` : `${nextRank}/${definition.maxRank}`;
      button.append(
        element("span", "arena-choice-role", TEXT.upgrades.extraCategoryLabel),
        element("strong", "arena-choice-card-title", display.title),
        element("span", "arena-choice-rank", `${TEXT.ui.rank} ${rank}`),
        element("span", "arena-choice-card-description", display.description),
        element("span", "arena-choice-card-metric", formatExtraPreview(definition.effect, currentRank)),
      );
    } else {
      const definition = this.config.upgrades[choiceId];
      const display = TEXT.upgrades.definitions[choiceId];
      const currentRank = world.progression.upgradeRanks[choiceId];
      const preview = formatUpgradePreview(
        createUpgradePreview(world, this.config, choiceId),
        TEXT.upgrades.preview.labels,
        TEXT.upgrades.preview,
      );
      button.append(
        element(
          "span",
          "arena-choice-role",
          TEXT.upgrades.categoryLabels[definition.category],
        ),
        element("strong", "arena-choice-card-title", display.title),
        element(
          "span",
          "arena-choice-rank",
          `${TEXT.ui.rank} ${currentRank + 1}/${definition.maxRank}`,
        ),
        element("span", "arena-choice-card-description", display.description),
        element("span", "arena-choice-card-metric", preview),
      );
    }

    button.addEventListener("click", () => {
      this.pendingInput.upgradeChoice = index;
    });
    return button;
  }

  private createContractButton(
    index: number,
    title: string,
    description: string,
    consequence: string,
    id: string,
  ): HTMLButtonElement {
    const button = element("button", `arena-choice-card arena-choice-card--contract-${id}`);
    button.type = "button";
    button.dataset.choiceKind = "contract";
    button.dataset.choiceIndex = String(index);
    button.dataset.choiceId = id;
    button.append(
      element("span", "arena-choice-role", index === 0 ? "安定" : "高リスク"),
      element("strong", "arena-choice-card-title", title),
      element("span", "arena-choice-card-description", description),
      element("span", "arena-choice-card-metric", consequence),
    );
    button.addEventListener("click", () => {
      this.pendingInput.contractChoice = index;
    });
    return button;
  }

  private createProgressText(world: WorldState): string {
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
      this.config,
      capstoneId,
      world.progression.upgradeRanks,
    )[0];
    return progress
      ? `${display.title} 解放まで 武器強化 ${progress.current}/${progress.required}`
      : `${display.title}: 解放条件なし`;
  }

  private handleKeyDown(event: KeyboardEvent): void {
    if (!this.root.classList.contains("arena-choice-overlay--visible")) return;
    const numericIndex = Number(event.key) - 1;
    if (Number.isInteger(numericIndex) && numericIndex >= 0 && numericIndex < this.visibleChoiceCount) {
      const button = this.root.querySelector<HTMLButtonElement>(
        `[data-choice-index="${numericIndex}"]`,
      );
      if (button) {
        event.preventDefault();
        event.stopPropagation();
        button.click();
      }
      return;
    }
    if (event.key === "Escape") {
      const back = this.root.querySelector<HTMLButtonElement>("[data-choice-action='back']");
      if (back) {
        event.preventDefault();
        event.stopPropagation();
        back.click();
      }
      return;
    }
    if (event.key === "Enter" || event.key === " ") event.stopPropagation();
  }

  private syncBounds(): void {
    const canvasRect = this.canvas.getBoundingClientRect();
    const parentRect = this.canvas.parentElement!.getBoundingClientRect();
    const portrait = parentRect.height > parentRect.width * 1.2;
    const width = portrait ? parentRect.width : canvasRect.width;
    const height = portrait ? parentRect.height : canvasRect.height;
    this.root.classList.toggle("arena-choice-overlay--portrait", portrait);
    this.root.classList.toggle("arena-choice-overlay--compact", !portrait && width < 760);
    this.root.style.left = `${portrait ? 0 : canvasRect.left - parentRect.left}px`;
    this.root.style.top = `${portrait ? 0 : canvasRect.top - parentRect.top}px`;
    this.root.style.width = `${width}px`;
    this.root.style.height = `${height}px`;
    this.root.style.setProperty(
      "--arena-scale",
      String(
        portrait
          ? Math.min(width / 480, height / 720)
          : width / this.config.arena.width,
      ),
    );
  }
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

function emptyInput(): ArenaChoiceInput {
  return { menuAction: null, upgradeChoice: null, contractChoice: null };
}

function element<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className: string,
  text?: string,
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}
