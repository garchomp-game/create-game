import type { SimulationConfig } from "../../domain/types";
import type { ArenaTutorialViewModel } from "../../presentation/ArenaTutorialPresenter";

export class ArenaTutorialDialog {
  private readonly root: HTMLDivElement;
  private signature = "";
  private continueRequested = false;
  private previousFocus: HTMLElement | null = null;
  private focusFrame: number | null = null;
  private readonly heldActivationKeys = new Set<string>();
  private readonly handleKeyDown = (event: KeyboardEvent): void => {
    if (event.code === "Enter" || event.code === "Space") {
      this.heldActivationKeys.add(event.code);
    }
  };
  private readonly handleKeyUp = (event: KeyboardEvent): void => {
    this.heldActivationKeys.delete(event.code);
  };

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly config: SimulationConfig,
  ) {
    const parent = canvas.parentElement;
    if (!parent) throw new Error("Arena canvas parent is not available.");

    this.root = document.createElement("div");
    this.root.className = "arena-tutorial-dialog";
    this.root.setAttribute("aria-hidden", "true");
    parent.append(this.root);
    window.addEventListener("keydown", this.handleKeyDown);
    window.addEventListener("keyup", this.handleKeyUp);
  }

  render(view: ArenaTutorialViewModel | null): void {
    this.syncBounds();
    const wasVisible = this.root.classList.contains(
      "arena-tutorial-dialog--visible",
    );
    const visible = Boolean(
      view?.visible && view.presentation === "briefing" && view.actionLabel,
    );
    this.root.classList.toggle("arena-tutorial-dialog--visible", visible);
    this.root.setAttribute("aria-hidden", visible ? "false" : "true");

    if (!view || !visible) {
      this.cancelScheduledFocus();
      this.signature = "";
      this.root.removeAttribute("data-tutorial-step");
      const active = document.activeElement;
      if (active instanceof HTMLElement && this.root.contains(active)) active.blur();
      if (wasVisible) this.restoreFocus();
      return;
    }

    if (!wasVisible) {
      this.previousFocus =
        document.activeElement instanceof HTMLElement
          ? document.activeElement
          : null;
    }

    this.root.dataset.tutorialStep = view.stepId;
    const signature = JSON.stringify([
      view.stepId,
      view.eyebrow,
      view.title,
      view.instruction,
      view.briefing,
      view.actionLabel,
      view.success,
      view.cueKind,
      view.cueLabel,
    ]);
    if (signature === this.signature) return;
    this.signature = signature;
    this.root.replaceChildren();

    const panel = element("section", "arena-tutorial-dialog__panel");
    panel.setAttribute("role", "dialog");
    panel.setAttribute("aria-modal", "true");
    panel.setAttribute("aria-labelledby", "arena-tutorial-dialog-title");
    panel.setAttribute(
      "aria-describedby",
      [
        "arena-tutorial-dialog-objective",
        "arena-tutorial-dialog-body",
        view.cueKind ? "arena-tutorial-dialog-cue" : "",
      ]
        .filter(Boolean)
        .join(" "),
    );
    if (view.success) {
      panel.append(
        element("p", "arena-tutorial-dialog__success", view.success),
      );
    }
    panel.append(
      element("p", "arena-tutorial-dialog__eyebrow", view.eyebrow),
      element("h1", "arena-tutorial-dialog__title", view.title, {
        id: "arena-tutorial-dialog-title",
      }),
      element("p", "arena-tutorial-dialog__objective", view.instruction, {
        id: "arena-tutorial-dialog-objective",
      }),
      element("p", "arena-tutorial-dialog__body", view.briefing ?? "", {
        id: "arena-tutorial-dialog-body",
      }),
    );
    const controlGuide = createControlGuide(view);
    if (controlGuide) panel.append(controlGuide);

    const button = element(
      "button",
      "arena-tutorial-dialog__continue",
      view.actionLabel ?? "練習を開始",
    );
    button.type = "button";
    button.dataset.tutorialAction = "continue";
    button.addEventListener("click", () => {
      this.continueRequested = true;
    });
    panel.append(
      button,
      element(
        "p",
        "arena-tutorial-dialog__key-hint",
        "Enter / Space でも開始できます",
      ),
    );
    this.root.append(panel);
    this.scheduleFocus(button, signature);
  }

  consumeContinue(): boolean {
    const requested = this.continueRequested;
    this.continueRequested = false;
    return requested;
  }

  clearInput(): void {
    this.continueRequested = false;
  }

  destroy(): void {
    this.cancelScheduledFocus();
    window.removeEventListener("keydown", this.handleKeyDown);
    window.removeEventListener("keyup", this.handleKeyUp);
    this.root.remove();
  }

  private scheduleFocus(button: HTMLButtonElement, signature: string): void {
    this.cancelScheduledFocus();
    const focusWhenReleased = (): void => {
      this.focusFrame = null;
      if (
        signature !== this.signature ||
        !this.root.classList.contains("arena-tutorial-dialog--visible")
      ) {
        return;
      }
      if (this.heldActivationKeys.size > 0) {
        this.focusFrame = window.requestAnimationFrame(focusWhenReleased);
        return;
      }
      button.focus({ preventScroll: true });
    };
    this.focusFrame = window.requestAnimationFrame(focusWhenReleased);
  }

  private cancelScheduledFocus(): void {
    if (this.focusFrame === null) return;
    window.cancelAnimationFrame(this.focusFrame);
    this.focusFrame = null;
  }

  private restoreFocus(): void {
    const target = this.previousFocus;
    this.previousFocus = null;
    if (target?.isConnected && !this.root.contains(target)) {
      target.focus({ preventScroll: true });
    }
  }

  private syncBounds(): void {
    const canvasRect = this.canvas.getBoundingClientRect();
    const parentRect = this.canvas.parentElement!.getBoundingClientRect();
    const portrait = parentRect.height > parentRect.width * 1.2;
    const width = portrait ? parentRect.width : canvasRect.width;
    const height = portrait ? parentRect.height : canvasRect.height;
    this.root.classList.toggle("arena-tutorial-dialog--portrait", portrait);
    this.root.classList.toggle(
      "arena-tutorial-dialog--compact",
      !portrait && width < 760,
    );
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

function element<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className: string,
  text = "",
  attributes: Record<string, string> = {},
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  node.className = className;
  node.textContent = text;
  for (const [name, value] of Object.entries(attributes)) {
    node.setAttribute(name, value);
  }
  return node;
}

function createControlGuide(
  view: ArenaTutorialViewModel,
): HTMLDivElement | null {
  if (!view.cueKind || !view.cueLabel) return null;

  const guide = element("div", "arena-tutorial-dialog__control-guide", "", {
    id: "arena-tutorial-dialog-cue",
    role: "img",
    "aria-label": view.cueLabel,
    "data-tutorial-cue": view.cueKind,
  });
  const visual = element(
    "div",
    `arena-tutorial-dialog__control-visual arena-tutorial-dialog__control-visual--${view.cueKind}`,
  );
  visual.setAttribute("aria-hidden", "true");

  if (view.cueKind === "move" || view.cueKind === "route") {
    visual.append(
      controlKey("W", "↑", "up"),
      controlKey("A", "←", "left"),
      controlKey("S", "↓", "down"),
      controlKey("D", "→", "right"),
    );
  } else if (view.cueKind === "dodge") {
    visual.append(
      controlKey("W", "↑", "up"),
      controlKey("S", "↓", "down"),
    );
  } else if (view.cueKind === "aim") {
    visual.append(
      element("span", "arena-tutorial-dialog__mouse"),
      element("span", "arena-tutorial-dialog__crosshair"),
    );
  } else if (view.cueKind === "upgrade") {
    visual.append(
      controlKey("1", "", "choice"),
      controlKey("2", "", "choice"),
      controlKey("3", "", "choice"),
    );
  } else {
    visual.append(
      element(
        "span",
        "arena-tutorial-dialog__observe-badge",
        "操作停止",
      ),
    );
  }

  guide.append(
    visual,
    element(
      "strong",
      "arena-tutorial-dialog__control-label",
      view.cueLabel,
    ),
  );
  return guide;
}

function controlKey(
  key: string,
  arrow: string,
  position: string,
): HTMLElement {
  const node = element(
    "kbd",
    `arena-tutorial-dialog__control-key arena-tutorial-dialog__control-key--${position}`,
  );
  node.append(
    element("span", "arena-tutorial-dialog__control-key-name", key),
  );
  if (arrow) {
    node.append(
      element("span", "arena-tutorial-dialog__control-key-arrow", arrow),
    );
  }
  return node;
}
