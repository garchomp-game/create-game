import type { MenuAction } from "../../application/ArenaMenuTypes";
import type { SimulationConfig, WorldState } from "../../domain/types";
import {
  createArenaChoiceViewModel,
  type ArenaChoiceCardViewModel,
  type ArenaChoiceSelection,
} from "../../presentation/ArenaChoicePresenter";

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
    const model = createArenaChoiceViewModel(world, this.config, enabled);
    this.root.classList.toggle("arena-choice-overlay--visible", model.visible);
    this.root.setAttribute("aria-hidden", model.visible ? "false" : "true");
    if (!model.visible) {
      this.signature = "";
      this.visibleChoiceCount = 0;
      return;
    }

    if (model.signature === this.signature) return;
    this.signature = model.signature;
    this.visibleChoiceCount = model.cards.length;
    this.root.replaceChildren();

    const shell = this.createShell(model.title, model.subtitle);
    const grid = element(
      "div",
      `arena-choice-grid arena-choice-grid--${model.cards.length === 2 ? "two" : "three"}`,
    );
    model.cards.forEach((card) => grid.append(this.createChoiceButton(card)));
    shell.append(grid);

    const backAction = model.backAction;
    if (backAction) {
      const back = element("button", "arena-choice-back", "戻る");
      back.type = "button";
      back.dataset.choiceAction = backAction;
      back.addEventListener("click", () =>
        this.applySelection({ kind: "menu", action: backAction }),
      );
      shell.append(back);
    }
    this.root.append(shell);
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

  private createChoiceButton(card: ArenaChoiceCardViewModel): HTMLButtonElement {
    const button = element("button", `arena-choice-card arena-choice-card--${card.tone}`);
    button.type = "button";
    button.dataset.choiceKind = card.kind;
    button.dataset.choiceIndex = String(card.index);
    button.dataset.choiceId = card.id;
    if (card.selection.kind === "menu") {
      button.dataset.choiceAction = card.selection.action;
    }
    button.append(
      element("span", "arena-choice-role", card.role),
      element("strong", "arena-choice-card-title", card.title),
    );
    if (card.rank) button.append(element("span", "arena-choice-rank", card.rank));
    button.append(
      element("span", "arena-choice-card-description", card.description),
      element("span", "arena-choice-card-metric", card.metric),
    );
    button.addEventListener("click", () => this.applySelection(card.selection));
    return button;
  }

  private applySelection(selection: ArenaChoiceSelection): void {
    if (selection.kind === "menu") this.pendingInput.menuAction = selection.action;
    else if (selection.kind === "upgrade") this.pendingInput.upgradeChoice = selection.index;
    else this.pendingInput.contractChoice = selection.index;
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
