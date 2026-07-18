import {
  ArrowRight,
  Check,
  Crosshair,
  Gamepad2,
  HeartPulse,
  House,
  Infinity,
  LayoutGrid,
  LockKeyhole,
  Map,
  Maximize2,
  Monitor,
  Move,
  Radio,
  Radar,
  RotateCcw,
  Route,
  Smartphone,
  Sparkles,
  Swords,
  Target,
  TriangleAlert,
  Trophy,
  createIcons,
} from "lucide";
import { CONCEPTS } from "./data";
import { renderPrototypeWorkspace } from "./renderPrototype";
import {
  CONCEPT_IDS,
  SCREEN_IDS,
  type ConceptSelection,
  type PrototypeState,
  type PrototypeViewport,
  type ScreenId,
} from "./types";
import "./styles.css";

const app = getAppRoot();

const state = readState();
document.body.dataset.capture = state.capture ? "true" : "false";
render();

app.addEventListener("click", (event) => {
  const target = event.target as HTMLElement;
  const conceptButton = target.closest<HTMLElement>("[data-select-concept]");
  if (conceptButton?.dataset.selectConcept) {
    setState({ concept: conceptButton.dataset.selectConcept as ConceptSelection });
    return;
  }
  const screenButton = target.closest<HTMLElement>("[data-select-screen]");
  if (screenButton?.dataset.selectScreen) {
    setState({ screen: screenButton.dataset.selectScreen as ScreenId });
    return;
  }
  const viewportButton = target.closest<HTMLElement>("[data-select-viewport]");
  if (viewportButton?.dataset.selectViewport) {
    setState({ viewport: viewportButton.dataset.selectViewport as PrototypeViewport });
    return;
  }
  const stageButton = target.closest<HTMLElement>("[data-select-stage]");
  if (stageButton?.dataset.selectStage) {
    setState({ selectedStageId: stageButton.dataset.selectStage });
    return;
  }
  const upgradeButton = target.closest<HTMLElement>("[data-select-upgrade]");
  if (upgradeButton?.dataset.selectUpgrade) {
    setState({ selectedUpgradeId: upgradeButton.dataset.selectUpgrade });
    return;
  }
  const actionButton = target.closest<HTMLElement>("[data-action]");
  if (actionButton?.dataset.action) handleAction(actionButton.dataset.action);
});

app.addEventListener("keydown", (event) => {
  const target = event.target as HTMLElement;
  if (!target.matches("[data-select-screen]")) return;
  if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
  event.preventDefault();
  const direction = event.key === "ArrowRight" ? 1 : -1;
  const index = SCREEN_IDS.indexOf(state.screen);
  const next = SCREEN_IDS[(index + direction + SCREEN_IDS.length) % SCREEN_IDS.length]!;
  setState({ screen: next });
  requestAnimationFrame(() =>
    app.querySelector<HTMLElement>(`[data-select-screen="${next}"]`)?.focus(),
  );
});

window.addEventListener("popstate", () => {
  Object.assign(state, readState());
  render();
});

function render(): void {
  app.innerHTML = state.capture
    ? `<main class="capture-stage">${renderPrototypeWorkspace(state)}</main>`
    : `
      <div class="prototype-app min-h-screen bg-neutral-950 text-neutral-100">
        ${renderToolbar()}
        <main class="prototype-workspace">
          ${renderPrototypeWorkspace(state)}
        </main>
      </div>
    `;

  createIcons({
    icons: {
      ArrowRight,
      Check,
      Crosshair,
      Gamepad2,
      HeartPulse,
      House,
      Infinity,
      LayoutGrid,
      LockKeyhole,
      Map,
      Maximize2,
      Monitor,
      Move,
      Radio,
      Radar,
      RotateCcw,
      Route,
      Smartphone,
      Sparkles,
      Swords,
      Target,
      TriangleAlert,
      Trophy,
    },
    attrs: { "aria-hidden": "true", "stroke-width": 1.8 },
    root: app,
  });
}

function renderToolbar(): string {
  const screens: Array<{ id: ScreenId; label: string; icon: string }> = [
    { id: "title", label: "タイトル", icon: "house" },
    { id: "stage", label: "ステージ", icon: "map" },
    { id: "upgrade", label: "強化", icon: "sparkles" },
    { id: "combat", label: "戦闘HUD", icon: "swords" },
    { id: "result", label: "リザルト", icon: "trophy" },
  ];
  const concepts: Array<{ id: ConceptSelection; label: string; icon: string }> = [
    { id: "compare", label: "比較", icon: "layout-grid" },
    ...CONCEPTS.map((concept) => ({
      id: concept.id,
      label: `${concept.index} ${concept.label}`,
      icon: concept.id === "tactical" ? "radar" : concept.id === "recovery" ? "route" : "gamepad-2",
    })),
  ];
  return `
    <header class="prototype-toolbar">
      <div class="toolbar-brand">
        <span>ARENA CORE</span>
        <strong>UI STUDIES</strong>
      </div>
      <nav class="toolbar-group toolbar-group--concept" aria-label="デザイン案">
        ${concepts
          .map(
            (concept) => `
              <button class="toolbar-button" type="button" data-select-concept="${concept.id}" aria-pressed="${state.concept === concept.id}">
                <i data-lucide="${concept.icon}" aria-hidden="true"></i>
                <span>${concept.label}</span>
              </button>
            `,
          )
          .join("")}
      </nav>
      <nav class="toolbar-group toolbar-group--screen" aria-label="画面">
        ${screens
          .map(
            (screen) => `
              <button class="toolbar-button" type="button" data-select-screen="${screen.id}" aria-pressed="${state.screen === screen.id}">
                <i data-lucide="${screen.icon}" aria-hidden="true"></i>
                <span>${screen.label}</span>
              </button>
            `,
          )
          .join("")}
      </nav>
      <div class="toolbar-group toolbar-group--viewport" aria-label="プレビュー比率">
        <button class="toolbar-icon-button" type="button" data-select-viewport="landscape" aria-pressed="${state.viewport === "landscape"}" aria-label="横画面" title="960 x 540">
          <i data-lucide="monitor" aria-hidden="true"></i>
        </button>
        <button class="toolbar-icon-button" type="button" data-select-viewport="portrait" aria-pressed="${state.viewport === "portrait"}" aria-label="縦画面" title="390 x 844">
          <i data-lucide="smartphone" aria-hidden="true"></i>
        </button>
      </div>
    </header>
  `;
}

function handleAction(action: string): void {
  const screenByAction: Record<string, ScreenId> = {
    "open-title": "title",
    "open-stage": "stage",
    "open-upgrade": "upgrade",
    "open-combat": "combat",
    "open-result": "result",
  };
  const screen = screenByAction[action];
  if (screen) setState({ screen });
}

function setState(update: Partial<PrototypeState>): void {
  Object.assign(state, update);
  writeState(state);
  render();
}

function readState(): PrototypeState {
  const params = new URLSearchParams(window.location.search);
  const conceptParam = params.get("concept");
  const screenParam = params.get("screen");
  const viewportParam = params.get("viewport");
  const concept: ConceptSelection =
    conceptParam === "compare" || CONCEPT_IDS.includes(conceptParam as never)
      ? (conceptParam as ConceptSelection)
      : params.get("capture") === "1"
        ? "tactical"
        : "compare";
  return {
    concept,
    screen: SCREEN_IDS.includes(screenParam as never) ? (screenParam as ScreenId) : "title",
    viewport: viewportParam === "portrait" ? "portrait" : "landscape",
    selectedStageId: params.get("stage") ?? "final-expedition",
    selectedUpgradeId: params.get("upgrade") ?? "pulse-focus",
    capture: params.get("capture") === "1",
  };
}

function writeState(next: PrototypeState): void {
  const params = new URLSearchParams();
  params.set("concept", next.concept);
  params.set("screen", next.screen);
  params.set("viewport", next.viewport);
  params.set("stage", next.selectedStageId);
  params.set("upgrade", next.selectedUpgradeId);
  if (next.capture) params.set("capture", "1");
  window.history.replaceState(null, "", `${window.location.pathname}?${params}`);
}

function getAppRoot(): HTMLDivElement {
  const element = document.querySelector<HTMLDivElement>("#app");
  if (!element) throw new Error("Prototype application root is missing.");
  return element;
}
