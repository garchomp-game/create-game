import "./uiCatalog.css";
import {
  getIncomingUiTransitions,
  getOutgoingUiTransitions,
  getUiScreenDefinition,
  UI_SCREEN_DEFINITIONS,
  UI_SCREEN_GROUPS,
  UI_SCREEN_TRANSITIONS,
  type UiScreenGroup,
  type UiScreenId,
  type UiScreenTransition,
} from "./presentation/UiScreenCatalog";
import { renderUiCatalogFixture } from "./uiCatalog/UiCatalogFixtureRenderer";
import { createUiCatalogFixture } from "./uiCatalog/UiCatalogFixtures";

const root = getRequiredElement("#ui-catalog");
const INPUT_PROMPT_ASSET_ROOT =
  "/ui-catalog-assets/kenney-input-prompts-1.5";
const INPUT_PROMPT_COMPARISON_SCREENS = new Set<UiScreenId>([
  "training-briefing",
  "training-active",
  "help",
]);

const requestedScreen = new URLSearchParams(window.location.search).get("screen");
let selectedScreenId = isUiScreenId(requestedScreen) ? requestedScreen : "title";
let selectedGroup: UiScreenGroup | "all" = "all";

render();

function render(): void {
  const selected = getUiScreenDefinition(selectedScreenId);
  const visibleScreens = UI_SCREEN_DEFINITIONS.filter(
    (screen) => selectedGroup === "all" || screen.group === selectedGroup,
  );
  const outgoing = getOutgoingUiTransitions(selectedScreenId);
  const incoming = getIncomingUiTransitions(selectedScreenId);
  const fixture = createUiCatalogFixture(selectedScreenId);

  root.innerHTML = `
    <header class="catalog-header">
      <div>
        <p class="catalog-eyebrow">DEVELOPMENT ONLY</p>
        <h1>Arena Core UI Catalog</h1>
      </div>
      <div class="catalog-header__meta">
        <span>${UI_SCREEN_DEFINITIONS.length} states</span>
        <span>${UI_SCREEN_TRANSITIONS.length} transitions</span>
        <a href="/">ゲームへ戻る</a>
      </div>
    </header>
    <div class="catalog-layout">
      <aside class="catalog-sidebar" aria-label="画面一覧">
        <div class="catalog-filter" role="group" aria-label="画面グループ">
          ${renderGroupButton("all", "すべて")}
          ${UI_SCREEN_GROUPS.map((group) =>
            renderGroupButton(group.id, group.label),
          ).join("")}
        </div>
        <div class="catalog-screen-list">
          ${visibleScreens.map(renderScreenButton).join("")}
        </div>
      </aside>
      <main class="catalog-main">
        <section class="catalog-contract" aria-labelledby="selected-screen-heading">
          <div class="catalog-contract__heading">
            <div>
              <p>${getGroupLabel(selected.group)} / ${selected.id}</p>
              <h2 id="selected-screen-heading">${selected.label}</h2>
            </div>
            <span class="catalog-source">${formatSource(selected.source)}</span>
          </div>
          <p class="catalog-summary">${selected.summary}</p>
          <dl class="catalog-properties">
            <div><dt>Owner</dt><dd>${selected.owner}</dd></div>
            <div><dt>Screen kind</dt><dd>${selected.screenKind ?? "outside runtime screen"}</dd></div>
            <div><dt>Record</dt><dd>${formatRecordEffect(selected.recordEffect)}</dd></div>
          </dl>
        </section>

        ${
          fixture
            ? `
              <section class="catalog-fixture" aria-labelledby="fixture-heading">
                <div class="section-heading">
                  <h2 id="fixture-heading">固定状態プレビュー</h2>
                  <span>960 × 540 / ${fixture.source}</span>
                </div>
                <div class="catalog-fixture__viewport">
                  ${renderUiCatalogFixture(fixture)}
                </div>
              </section>
            `
            : ""
        }

        ${renderInputPromptComparison(selectedScreenId)}

        <section class="catalog-routes" aria-labelledby="routes-heading">
          <div class="section-heading">
            <h2 id="routes-heading">選択状態の遷移</h2>
            <span>${incoming.length} in / ${outgoing.length} out</span>
          </div>
          <div class="route-columns">
            <div>
              <h3>遷移元</h3>
              ${renderTransitionList(incoming, "incoming")}
            </div>
            <div>
              <h3>遷移先</h3>
              ${renderTransitionList(outgoing, "outgoing")}
            </div>
          </div>
        </section>

        <section class="catalog-flow" aria-labelledby="flow-heading">
          <div class="section-heading">
            <h2 id="flow-heading">全体遷移</h2>
            <span>同じmanifestから生成</span>
          </div>
          <div class="flow-grid">
            ${UI_SCREEN_GROUPS.map((group) => renderFlowGroup(group.id, group.label)).join("")}
          </div>
        </section>
      </main>
    </div>
  `;

  root.querySelectorAll<HTMLButtonElement>("[data-screen-id]").forEach((button) => {
    button.addEventListener("click", () => {
      const screenId = button.dataset.screenId;
      if (!isUiScreenId(screenId)) return;
      selectedScreenId = screenId;
      const url = new URL(window.location.href);
      url.searchParams.set("screen", screenId);
      window.history.replaceState(null, "", url);
      render();
    });
  });

  root.querySelectorAll<HTMLButtonElement>("[data-group-id]").forEach((button) => {
    button.addEventListener("click", () => {
      const groupId = button.dataset.groupId;
      if (!groupId) return;
      if (groupId !== "all" && !isUiScreenGroup(groupId)) return;
      selectedGroup = groupId;
      render();
    });
  });
}

function renderInputPromptComparison(screenId: UiScreenId): string {
  if (!INPUT_PROMPT_COMPARISON_SCREENS.has(screenId)) return "";

  return `
    <section class="catalog-prompts" aria-labelledby="prompt-comparison-heading">
      <div class="section-heading">
        <h2 id="prompt-comparison-heading">入力表示の比較候補</h2>
        <span>開発カタログ限定 / production未採用</span>
      </div>
      <div class="prompt-comparison">
        <figure class="prompt-option">
          <figcaption>
            <strong>現行CSS表現</strong>
            <span>軽量・色変更しやすい</span>
          </figcaption>
          <div class="prompt-sample prompt-sample--current">
            <div class="wasd-grid" aria-label="W、A、S、Dキー">
              <kbd>W</kbd>
              <kbd>A</kbd>
              <kbd>S</kbd>
              <kbd>D</kbd>
            </div>
            <div class="mouse-label" aria-label="マウスで照準、左クリックで射撃">
              <span aria-hidden="true">MOUSE</span>
              <small>照準 / 左クリックで射撃</small>
            </div>
          </div>
        </figure>
        <figure class="prompt-option">
          <figcaption>
            <strong>Kenney SVG候補</strong>
            <span>輪郭と形で即時認識</span>
          </figcaption>
          <div class="prompt-sample prompt-sample--asset">
            <div class="wasd-grid wasd-grid--asset" aria-label="W、A、S、Dキー">
              ${renderPromptImage("keyboard_w_outline.svg", "Wキー")}
              ${renderPromptImage("keyboard_a_outline.svg", "Aキー")}
              ${renderPromptImage("keyboard_s_outline.svg", "Sキー")}
              ${renderPromptImage("keyboard_d_outline.svg", "Dキー")}
            </div>
            <div class="mouse-assets">
              <span>
                ${renderPromptImage("mouse_move.svg", "マウス移動")}
                <small>照準</small>
              </span>
              <span>
                ${renderPromptImage("mouse_left.svg", "左クリック")}
                <small>射撃</small>
              </span>
            </div>
          </div>
        </figure>
      </div>
      <p class="prompt-license">
        Kenney Input Prompts 1.5A / CC0。出典と採否条件はStarlightのUI素材台帳で管理。
      </p>
    </section>
  `;
}

function renderPromptImage(filename: string, alt: string): string {
  return `<img src="${INPUT_PROMPT_ASSET_ROOT}/${filename}" alt="${alt}" width="64" height="64">`;
}

function renderGroupButton(group: UiScreenGroup | "all", label: string): string {
  return `
    <button
      type="button"
      data-group-id="${group}"
      aria-pressed="${selectedGroup === group}"
    >${label}</button>
  `;
}

function renderScreenButton(
  screen: (typeof UI_SCREEN_DEFINITIONS)[number],
): string {
  return `
    <button
      type="button"
      class="screen-button"
      data-screen-id="${screen.id}"
      aria-current="${screen.id === selectedScreenId ? "true" : "false"}"
    >
      <span>${screen.label}</span>
      <small>${screen.id}</small>
    </button>
  `;
}

function renderTransitionList(
  transitions: ReadonlyArray<UiScreenTransition>,
  direction: "incoming" | "outgoing",
): string {
  if (transitions.length === 0) {
    return '<p class="empty-route">遷移なし</p>';
  }

  return `
    <ul class="route-list">
      ${transitions
        .map((transition) => {
          const otherId =
            direction === "incoming" ? transition.from : transition.to;
          const other = getUiScreenDefinition(otherId);
          return `
            <li>
              <button type="button" data-screen-id="${other.id}">
                <strong>${other.label}</strong>
                <span>${transition.trigger}</span>
                ${transition.condition ? `<small>${transition.condition}</small>` : ""}
              </button>
            </li>
          `;
        })
        .join("")}
    </ul>
  `;
}

function renderFlowGroup(group: UiScreenGroup, label: string): string {
  const screens = UI_SCREEN_DEFINITIONS.filter((screen) => screen.group === group);
  return `
    <section class="flow-lane" aria-labelledby="flow-${group}">
      <h3 id="flow-${group}">${label}</h3>
      <div>
        ${screens
          .map(
            (screen) => `
              <button
                type="button"
                data-screen-id="${screen.id}"
                data-selected="${screen.id === selectedScreenId}"
              >
                <span>${screen.label}</span>
                <small>${getOutgoingUiTransitions(screen.id).length} routes</small>
              </button>
            `,
          )
          .join("")}
      </div>
    </section>
  `;
}

function getGroupLabel(group: UiScreenGroup): string {
  return UI_SCREEN_GROUPS.find((candidate) => candidate.id === group)?.label ?? group;
}

function formatSource(
  source: (typeof UI_SCREEN_DEFINITIONS)[number]["source"],
): string {
  switch (source) {
    case "screen-view-model":
      return "Screen ViewModel";
    case "choice-view-model":
      return "Choice ViewModel";
    case "world-view":
      return "World / HUD";
    case "startup":
      return "Startup DOM";
  }
}

function formatRecordEffect(
  effect: (typeof UI_SCREEN_DEFINITIONS)[number]["recordEffect"],
): string {
  switch (effect) {
    case "none":
      return "記録へ介入しない";
    case "read-only":
      return "既存記録を参照";
    case "terminal-write":
      return "run終端で1回保存";
  }
}

function isUiScreenId(value: string | null | undefined): value is UiScreenId {
  return UI_SCREEN_DEFINITIONS.some((screen) => screen.id === value);
}

function isUiScreenGroup(value: string): value is UiScreenGroup {
  return UI_SCREEN_GROUPS.some((group) => group.id === value);
}

function getRequiredElement(selector: string): HTMLDivElement {
  const element = document.querySelector<HTMLDivElement>(selector);
  if (!element) throw new Error(`Required element was not found: ${selector}`);
  return element;
}
