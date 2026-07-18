import { CONCEPTS, PROTOTYPE_DATA } from "./data";
import type {
  ConceptDefinition,
  ConceptId,
  PrototypeState,
  ScreenId,
  StageDefinition,
  UpgradeDefinition,
} from "./types";

export function renderPrototypeWorkspace(state: PrototypeState): string {
  if (state.concept === "compare") {
    return `
      <div class="comparison-grid" data-comparison-grid>
        ${CONCEPTS.map(
          (concept) => `
            <section class="prototype-study" aria-labelledby="study-${concept.id}">
              <button
                class="study-label"
                id="study-${concept.id}"
                type="button"
                data-select-concept="${concept.id}"
                title="${concept.label}を拡大"
              >
                <span>${concept.index}</span>
                <strong>${concept.label}</strong>
                <i data-lucide="maximize-2" aria-hidden="true"></i>
              </button>
              ${renderPrototype(concept.id, state, true)}
            </section>
          `,
        ).join("")}
      </div>
    `;
  }
  return `
    <div class="focused-study">
      ${renderPrototype(state.concept, state, false)}
    </div>
  `;
}

function renderPrototype(
  conceptId: ConceptId,
  state: PrototypeState,
  comparison: boolean,
): string {
  const concept = CONCEPTS.find((candidate) => candidate.id === conceptId)!;
  const image = getScreenImage(state.screen);
  return `
    <article
      class="prototype-frame prototype-frame--${state.viewport}${comparison ? " prototype-frame--comparison" : ""}"
      data-prototype-canvas
      data-concept="${concept.id}"
      data-screen="${state.screen}"
      aria-label="${concept.label} ${getScreenLabel(state.screen)}"
    >
      <img class="arena-visual" src="${image}" alt="" />
      <div class="arena-scrim" aria-hidden="true"></div>
      <div class="frame-shell">
        ${renderFrameStatus(concept, state.screen)}
        ${renderScreen(concept, state)}
        ${renderFrameFooter(concept, state.screen)}
      </div>
    </article>
  `;
}

function renderFrameStatus(concept: ConceptDefinition, screen: ScreenId): string {
  return `
    <header class="frame-status">
      <div class="frame-system">
        <span class="shape-marker" aria-hidden="true"></span>
        <strong>${concept.systemLabel}</strong>
        <span>${concept.index}.${String(getScreenIndex(screen)).padStart(2, "0")}</span>
      </div>
      <div class="frame-signal">
        <span class="signal-shape signal-shape--ready" aria-hidden="true"></span>
        <span>LINK READY</span>
        <span class="signal-shape signal-shape--warning" aria-hidden="true"></span>
        <span>THREAT 5</span>
      </div>
    </header>
  `;
}

function renderFrameFooter(concept: ConceptDefinition, screen: ScreenId): string {
  return `
    <footer class="frame-footer">
      <span>${PROTOTYPE_DATA.runLabel}</span>
      <span>${getScreenLabel(screen)} / ${concept.shortLabel}</span>
    </footer>
  `;
}

function renderScreen(concept: ConceptDefinition, state: PrototypeState): string {
  if (state.screen === "title") return renderTitleScreen(concept);
  if (state.screen === "stage") return renderStageScreen(concept, state.selectedStageId);
  if (state.screen === "upgrade") return renderUpgradeScreen(concept, state.selectedUpgradeId);
  if (state.screen === "combat") return renderCombatScreen(concept);
  return renderResultScreen(concept);
}

function renderTitleScreen(concept: ConceptDefinition): string {
  return `
    <main class="prototype-screen screen--title">
      <section class="brand-block">
        <p class="screen-kicker">${concept.index} / ${concept.systemLabel}</p>
        <h1>${PROTOTYPE_DATA.productName}</h1>
        <p class="brand-tagline">${PROTOTYPE_DATA.tagline}</p>
      </section>

      <nav class="mode-list" aria-label="ゲームモード">
        <button class="mode-option mode-option--primary" type="button" data-action="open-stage">
          <span class="mode-icon"><i data-lucide="route" aria-hidden="true"></i></span>
          <span class="mode-copy">
            <small>STAGE 10 / 5 ACT</small>
            <strong>最終遠征</strong>
            <span>${concept.primaryAction}</span>
          </span>
          <i data-lucide="arrow-right" aria-hidden="true"></i>
        </button>
        <button class="mode-option" type="button" data-action="open-combat">
          <span class="mode-icon"><i data-lucide="infinity" aria-hidden="true"></i></span>
          <span class="mode-copy">
            <small>ENDLESS / RANKED</small>
            <strong>エンドレス</strong>
            <span>生存限界を更新</span>
          </span>
          <i data-lucide="arrow-right" aria-hidden="true"></i>
        </button>
      </nav>

      <dl class="title-metrics">
        <div><dt>BEST</dt><dd>141,292</dd></div>
        <div><dt>WEAPON</dt><dd>パルス</dd></div>
        <div><dt>STATUS</dt><dd>作戦完遂</dd></div>
      </dl>
    </main>
  `;
}

function renderStageScreen(concept: ConceptDefinition, selectedStageId: string): string {
  const selected =
    PROTOTYPE_DATA.stages.find((stage) => stage.id === selectedStageId) ??
    PROTOTYPE_DATA.stages[2]!;
  return `
    <main class="prototype-screen screen--stage">
      ${renderScreenHeading("遠征経路", concept.stageVerb, "map")}
      <div class="stage-layout">
        <nav class="stage-list" aria-label="ステージ一覧">
          ${PROTOTYPE_DATA.stages.map((stage) => renderStageOption(stage, selected.id)).join("")}
        </nav>
        <section class="stage-brief" aria-labelledby="selected-stage-title">
          <div class="stage-brief-number">${selected.number}</div>
          <div class="stage-brief-copy">
            <p>${selected.difficulty} / ${selected.duration}</p>
            <h2 id="selected-stage-title">${selected.title}</h2>
            <p>${selected.objective}</p>
            <ul class="enemy-tags" aria-label="登場戦力">
              ${selected.enemyTypes.map((enemy) => `<li>${enemy}</li>`).join("")}
            </ul>
          </div>
          <button class="frame-command" type="button" data-action="open-upgrade">
            <i data-lucide="crosshair" aria-hidden="true"></i>
            ${concept.stageVerb}
          </button>
        </section>
      </div>
    </main>
  `;
}

function renderStageOption(stage: StageDefinition, selectedStageId: string): string {
  const selected = stage.id === selectedStageId;
  const statusIcon =
    stage.status === "cleared" ? "check" : stage.status === "locked" ? "lock-keyhole" : "radio";
  return `
    <button
      class="stage-option${selected ? " stage-option--selected" : ""}"
      type="button"
      data-select-stage="${stage.id}"
      aria-pressed="${selected}"
      ${stage.status === "locked" ? "disabled" : ""}
    >
      <span class="stage-number">${stage.number}</span>
      <span class="stage-copy">
        <strong>${stage.title}</strong>
        <small>${stage.subtitle}</small>
      </span>
      <span class="stage-status stage-status--${stage.status}">
        <i data-lucide="${statusIcon}" aria-hidden="true"></i>
        ${stage.difficulty}
      </span>
    </button>
  `;
}

function renderUpgradeScreen(concept: ConceptDefinition, selectedUpgradeId: string): string {
  const selected =
    PROTOTYPE_DATA.upgrades.find((upgrade) => upgrade.id === selectedUpgradeId) ??
    PROTOTYPE_DATA.upgrades[0]!;
  return `
    <main class="prototype-screen screen--upgrade">
      ${renderScreenHeading("レベル 18 強化選択", "最終強化まで 武器強化 6 / 7", "sparkles")}
      <div class="build-progress" role="progressbar" aria-label="最終強化の解放進行" aria-valuemin="0" aria-valuemax="7" aria-valuenow="6">
        <span style="width: 85.714%"></span>
      </div>
      <div class="upgrade-grid">
        ${PROTOTYPE_DATA.upgrades
          .map((upgrade, index) => renderUpgradeOption(upgrade, selected.id, index))
          .join("")}
      </div>
      <div class="upgrade-confirmation">
        <span><strong>${selected.title}</strong> / ${selected.metric}</span>
        <button class="frame-command" type="button" data-action="open-combat">
          <i data-lucide="check" aria-hidden="true"></i>
          この強化を取得
        </button>
      </div>
      <span class="concept-note">${concept.systemLabel} / BUILD 18</span>
    </main>
  `;
}

function renderUpgradeOption(
  upgrade: UpgradeDefinition,
  selectedUpgradeId: string,
  index: number,
): string {
  const selected = upgrade.id === selectedUpgradeId;
  const icon =
    upgrade.accent === "pulse" ? "target" : upgrade.accent === "mobility" ? "move" : "heart-pulse";
  return `
    <button
      class="upgrade-option upgrade-option--${upgrade.accent}${selected ? " upgrade-option--selected" : ""}"
      type="button"
      data-select-upgrade="${upgrade.id}"
      aria-pressed="${selected}"
    >
      <span class="upgrade-index">0${index + 1}</span>
      <span class="upgrade-icon"><i data-lucide="${icon}" aria-hidden="true"></i></span>
      <span class="upgrade-category">${upgrade.category}</span>
      <strong>${upgrade.title}</strong>
      <span class="upgrade-rank">RANK ${upgrade.rank}</span>
      <span class="upgrade-description">${upgrade.description}</span>
      <span class="upgrade-metric">${upgrade.metric}</span>
    </button>
  `;
}

function renderCombatScreen(concept: ConceptDefinition): string {
  const combat = PROTOTYPE_DATA.combat;
  const hpRatio = (combat.hp / combat.maxHp) * 100;
  const xpRatio = (combat.xp / combat.xpToNext) * 100;
  const bossRatio = (combat.bossHp / combat.bossMaxHp) * 100;
  return `
    <main class="prototype-screen screen--combat">
      <section class="hud-vitals" aria-label="プレイヤー状態">
        <div class="hud-heading"><span>HP</span><strong>${combat.hp} / ${combat.maxHp}</strong></div>
        ${renderMeter("HP", hpRatio, "health")}
        <div class="hud-heading"><span>LV ${combat.level}</span><strong>EXP ${combat.xp} / ${combat.xpToNext}</strong></div>
        ${renderMeter("経験値", xpRatio, "xp")}
      </section>
      <section class="hud-score" aria-label="ラン状態">
        <strong>${combat.score.toLocaleString()}</strong><span>点</span>
        <p>${combat.elapsed} / 脅威 ${combat.threat}</p>
        <p>敵 ${combat.enemies} / ${combat.weapon}</p>
      </section>
      <div class="event-callout">
        <i data-lucide="triangle-alert" aria-hidden="true"></i>
        <span><small>COMMAND SHIP ATTACK</small><strong>${combat.event}</strong></span>
        <b>0.9s</b>
      </div>
      <section class="boss-meter" aria-label="敵指揮艦">
        <div>
          <span>敵指揮艦</span>
          <strong>PHASE ${combat.bossPhase}</strong>
          <span>${combat.bossHp} / ${combat.bossMaxHp}</span>
        </div>
        ${renderMeter("敵指揮艦HP", bossRatio, "boss")}
      </section>
      <div class="weapon-identity">
        <i data-lucide="crosshair" aria-hidden="true"></i>
        <span><small>FOCUS CHAIN</small><strong>4 / 4</strong></span>
      </div>
      <span class="concept-note">${concept.systemLabel} / LIVE</span>
    </main>
  `;
}

function renderResultScreen(concept: ConceptDefinition): string {
  const result = PROTOTYPE_DATA.result;
  return `
    <main class="prototype-screen screen--result">
      <section class="result-primary">
        <p class="screen-kicker">MISSION COMPLETE / RANK ${result.rank}</p>
        <h1>${result.score.toLocaleString()}</h1>
        <p class="result-label">最終遠征 作戦完遂</p>
        <dl class="result-bonuses">
          <div><dt>完遂</dt><dd>+${result.clearBonus.toLocaleString()}</dd></div>
          <div><dt>速攻</dt><dd>+${result.timeBonus.toLocaleString()}</dd></div>
          <div><dt>指揮艦</dt><dd>${result.bossTime}</dd></div>
        </dl>
      </section>
      <section class="result-details" aria-label="ラン詳細">
        <dl class="result-stats">
          <div><dt>生存</dt><dd>${result.elapsed}</dd></div>
          <div><dt>レベル</dt><dd>${result.level}</dd></div>
          <div><dt>撃破</dt><dd>${result.kills.toLocaleString()}</dd></div>
          <div><dt>被ダメージ</dt><dd>${result.damageTaken}</dd></div>
        </dl>
        <div class="result-build">
          <span>FINAL BUILD / PULSE</span>
          <ul>${result.build.map((item) => `<li>${item}</li>`).join("")}</ul>
        </div>
      </section>
      <nav class="result-actions" aria-label="リザルト操作">
        <button class="frame-command" type="button" data-action="open-combat">
          <i data-lucide="rotate-ccw" aria-hidden="true"></i>
          再挑戦
        </button>
        <button class="frame-command frame-command--secondary" type="button" data-action="open-title">
          <i data-lucide="house" aria-hidden="true"></i>
          タイトルへ
        </button>
      </nav>
      <span class="result-rank" aria-label="ランクS">${result.rank}</span>
      <span class="concept-note">${concept.systemLabel} / RESULT</span>
    </main>
  `;
}

function renderScreenHeading(title: string, subtitle: string, icon: string): string {
  return `
    <header class="screen-heading">
      <span class="screen-heading-icon"><i data-lucide="${icon}" aria-hidden="true"></i></span>
      <div><h1>${title}</h1><p>${subtitle}</p></div>
    </header>
  `;
}

function renderMeter(label: string, ratio: number, tone: string): string {
  return `
    <div class="meter meter--${tone}" role="progressbar" aria-label="${label}" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.round(ratio)}">
      <span style="width: ${Math.max(0, Math.min(100, ratio))}%"></span>
    </div>
  `;
}

function getScreenImage(screen: ScreenId): string {
  if (screen === "stage") return "/assets/arena-commander.png";
  if (screen === "upgrade") return "/assets/arena-shooting.png";
  return "/assets/arena-boss-salvo.png";
}

function getScreenLabel(screen: ScreenId): string {
  const labels: Record<ScreenId, string> = {
    title: "タイトル",
    stage: "ステージ選択",
    upgrade: "強化選択",
    combat: "戦闘HUD",
    result: "リザルト",
  };
  return labels[screen];
}

function getScreenIndex(screen: ScreenId): number {
  return ["title", "stage", "upgrade", "combat", "result"].indexOf(screen) + 1;
}
