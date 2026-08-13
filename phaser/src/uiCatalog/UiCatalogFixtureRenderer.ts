import type { MenuAction } from "../application/ArenaMenuTypes";
import type {
  ArenaChoiceCardViewModel,
  ArenaChoiceViewModel,
} from "../presentation/ArenaChoicePresenter";
import type { ArenaScreenViewModel } from "../presentation/ArenaScreenPresenter";
import type {
  UiCatalogFixture,
  UiCatalogHudViewModel,
} from "./UiCatalogFixtures";
import type { UiCatalogBackgroundCandidateId } from "./UiCatalogBackgroundCandidates";

export function renderUiCatalogFixture(fixture: UiCatalogFixture): string {
  switch (fixture.kind) {
    case "title":
      return renderTitle(fixture.model);
    case "choice":
      return renderChoice(fixture.model);
    case "hud":
      return renderUiCatalogHud(fixture.model);
    case "result":
      return renderResult(fixture.model);
  }
}

function renderTitle(model: ArenaScreenViewModel): string {
  return `
    <div class="fixture-screen fixture-title-comparison">
      ${renderTitleVariant(model, "baseline")}
      ${renderTitleVariant(model, "candidate")}
    </div>
  `;
}

function renderTitleVariant(
  model: ArenaScreenViewModel,
  variant: "baseline" | "candidate",
): string {
  const baseline = variant === "baseline";
  return `
    <figure class="fixture-title-option" data-title-variant="${variant}">
      <figcaption>
        <strong>${baseline ? "BEFORE / BASELINE" : "AFTER / CANDIDATE"}</strong>
        <span>${baseline ? "3モード同格" : "主CTA 1 / 副導線 2 / 管理導線 4"}</span>
      </figcaption>
      <div class="fixture-title-stage fixture-title-stage--${variant}">
        <div class="fixture-title__brand">
          <strong>${escapeHtml(model.statusText ?? "")}</strong>
          ${renderTextLines(model.detailText)}
        </div>
        ${
          baseline
            ? `
              <div class="fixture-title__baseline-modes">
                ${renderTitleMenuButton(model, "story", "secondary", "ストーリー")}
                ${renderTitleMenuButton(model, "start", "secondary")}
                ${renderTitleMenuButton(model, "practice", "secondary")}
              </div>
            `
            : `
              <div class="fixture-title__candidate-primary">
                ${renderTitleMenuButton(model, "story", "primary")}
              </div>
              <div class="fixture-title__candidate-secondary">
                ${renderTitleMenuButton(model, "start", "secondary")}
                ${renderTitleMenuButton(model, "practice", "secondary")}
              </div>
            `
        }
        <div class="fixture-title__utilities">
          ${renderTitleMenuButton(model, "ranking", "utility")}
          ${renderTitleMenuButton(model, "history", "utility", "履歴")}
          ${renderTitleMenuButton(model, "settings", "utility")}
          ${renderTitleMenuButton(model, "betaInfo", "utility", "情報")}
        </div>
      </div>
    </figure>
  `;
}

function renderTitleMenuButton(
  model: ArenaScreenViewModel,
  action: MenuAction,
  tier: "primary" | "secondary" | "utility",
  labelOverride?: string,
): string {
  const label = labelOverride ?? model.menuLabels[action];
  if (!label) return "";
  const focused = action === model.focusedMenuAction;
  return `
    <button
      type="button"
      class="fixture-title__action fixture-title__action--${tier}"
      data-fixture-action="${action}"
      data-focused="${focused}"
    >${escapeHtml(label)}</button>
  `;
}

function renderChoice(model: ArenaChoiceViewModel): string {
  return `
    <div class="fixture-screen fixture-choice">
      <header class="fixture-choice__header">
        <div>
          <span>${escapeHtml(model.eyebrow)}</span>
          <span>${escapeHtml(model.statusLabel)}</span>
        </div>
        <h3>${escapeHtml(model.title)}</h3>
        <p>${renderSubtitle(model)}</p>
      </header>
      <div class="fixture-choice__grid">
        ${model.cards.map(renderChoiceCard).join("")}
      </div>
      ${
        model.keyboardHint
          ? `<div class="fixture-choice__keyboard">${renderChoiceKeys(model.cards.length)}</div>`
          : ""
      }
    </div>
  `;
}

function renderChoiceCard(card: ArenaChoiceCardViewModel): string {
  return `
    <button
      type="button"
      class="fixture-choice-card fixture-choice-card--${escapeHtml(card.tone)}"
      data-fixture-choice="${card.index}"
      aria-label="${escapeHtml(card.ariaLabel ?? card.title)}"
    >
      <span class="fixture-choice-card__top">
        <span>${escapeHtml(card.role)}</span>
        ${
          card.rankProgress
            ? renderRank(card.rankProgress.current, card.rankProgress.max)
            : card.rank
              ? `<strong>${escapeHtml(card.rank)}</strong>`
              : `<kbd>${escapeHtml(card.indexLabel)}</kbd>`
        }
      </span>
      <strong class="fixture-choice-card__title">${escapeHtml(card.title)}</strong>
      <span class="fixture-choice-card__description">${escapeHtml(card.description)}</span>
      <span class="fixture-choice-card__metric">
        <small>${escapeHtml(card.metricLabel)}</small>
        <strong>${renderMetric(card)}</strong>
      </span>
      <span class="fixture-choice-card__action">
        <kbd>${escapeHtml(card.indexLabel)}</kbd>
        ${escapeHtml(card.actionLabel)}
      </span>
    </button>
  `;
}

export function renderUiCatalogHud(
  model: UiCatalogHudViewModel,
  background: UiCatalogBackgroundCandidateId = "baseline",
): string {
  return `
    <div
      class="fixture-screen fixture-hud fixture-hud--${background}"
      data-background-candidate="${background}"
    >
      <div class="fixture-hud__grid" aria-hidden="true"></div>
      <section class="fixture-hud__panel fixture-hud__panel--left">
        ${renderHudBar(model.hp, "hp")}
        ${renderHudBar(model.xp, "xp")}
      </section>
      <section class="fixture-hud__panel fixture-hud__panel--right">
        <strong>${escapeHtml(model.meta)}</strong>
        <span>${escapeHtml(model.weaponStatus)}</span>
      </section>
      <button type="button" class="fixture-hud__help" aria-label="操作ヘルプ">
        ${escapeHtml(model.helpLabel)}
      </button>
      <div
        class="fixture-hud__player"
        style="left:${toPercent(model.arena.player.x, 960)}%;top:${toPercent(model.arena.player.y, 540)}%"
        aria-label="プレイヤー"
      ></div>
      ${model.arena.enemies
        .map(
          (enemy) => `
            <span
              class="fixture-hud__enemy fixture-hud__enemy--${enemy.typeId}"
              style="left:${toPercent(enemy.x, 960)}%;top:${toPercent(enemy.y, 540)}%"
              aria-label="${enemy.typeId}"
            ></span>
          `,
        )
        .join("")}
      <div class="fixture-hud__aim" aria-hidden="true"></div>
      <span class="fixture-hud__weapon">${escapeHtml(model.weaponName)}</span>
    </div>
  `;
}

function renderResult(model: ArenaScreenViewModel): string {
  return `
    <div class="fixture-screen fixture-result">
      <section class="fixture-result__summary">
        ${renderTextLines(model.statusText, "strong")}
      </section>
      <section class="fixture-result__details">
        ${renderTextLines(model.detailText)}
      </section>
      <div class="fixture-result__actions">
        ${renderMenuButton(model, "restart")}
        ${renderMenuButton(model, "title")}
      </div>
    </div>
  `;
}

function renderMenuButton(
  model: ArenaScreenViewModel,
  action: MenuAction,
  quiet = false,
): string {
  const label = model.menuLabels[action];
  if (!label) return "";
  return `
    <button
      type="button"
      class="fixture-menu-button${quiet ? " fixture-menu-button--quiet" : ""}"
      data-fixture-action="${action}"
    >${escapeHtml(label)}</button>
  `;
}

function renderTextLines(
  text: string | null,
  firstTag: "span" | "strong" = "span",
): string {
  if (!text) return "";
  return text
    .split("\n")
    .map((line, index) => {
      const tag = index === 0 ? firstTag : "span";
      return `<${tag}>${escapeHtml(line)}</${tag}>`;
    })
    .join("");
}

function renderSubtitle(model: ArenaChoiceViewModel): string {
  const progress = model.subtitleProgress;
  if (!progress) return escapeHtml(model.subtitle);
  const progressText = `${progress.current}/${progress.required}`;
  const index = model.subtitle.lastIndexOf(progressText);
  if (index < 0) return escapeHtml(model.subtitle);
  return [
    escapeHtml(model.subtitle.slice(0, index)),
    `<strong>${progress.current}</strong>/${progress.required}`,
    escapeHtml(model.subtitle.slice(index + progressText.length)),
  ].join("");
}

function renderRank(current: number, max: number): string {
  return `
    <span class="fixture-rank" aria-label="強化ランク ${current}/${max}">
      <small>強化ランク</small>
      <span>${Array.from({ length: max }, (_, index) => `<i data-active="${index < current}"></i>`).join("")}</span>
    </span>
  `;
}

function renderMetric(card: ArenaChoiceCardViewModel): string {
  if (!card.metricChange) return escapeHtml(card.metric);
  return `${escapeHtml(card.metricChange.before)} <b>→ ${escapeHtml(card.metricChange.after)}</b>`;
}

function renderChoiceKeys(count: number): string {
  return `
    <span>数字キー</span>
    ${Array.from({ length: count }, (_, index) => `<kbd>${index + 1}</kbd>`).join("")}
    <span>でも選択できます</span>
  `;
}

function renderHudBar(
  value: UiCatalogHudViewModel["hp"],
  tone: "hp" | "xp",
): string {
  return `
    <div class="fixture-hud-bar">
      <div>
        <strong>${escapeHtml(value.label)}</strong>
        <span>${escapeHtml(value.value)}</span>
      </div>
      <i>
        <b class="fixture-hud-bar--${tone}" style="width:${Math.round(value.ratio * 100)}%"></b>
      </i>
    </div>
  `;
}

function toPercent(value: number, total: number): string {
  return ((value / total) * 100).toFixed(2);
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
