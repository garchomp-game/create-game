import type { ArenaScreenKind } from "./ArenaScreenPresenter";

export type UiScreenGroup =
  | "entry"
  | "mode"
  | "combat"
  | "choice"
  | "result"
  | "secondary";

export type UiScreenOwner =
  | "startup"
  | "ArenaMenuController"
  | "ArenaScreenPresenter"
  | "ArenaChoicePresenter"
  | "PhaserHud"
  | "ArenaTutorialDialog";

export type UiRecordEffect = "none" | "read-only" | "terminal-write";

export type UiScreenDefinition = {
  id: string;
  label: string;
  group: UiScreenGroup;
  summary: string;
  screenKind: ArenaScreenKind | null;
  owner: UiScreenOwner;
  recordEffect: UiRecordEffect;
  source: "startup" | "screen-view-model" | "choice-view-model" | "world-view";
};

export const UI_SCREEN_GROUPS: ReadonlyArray<{
  id: UiScreenGroup;
  label: string;
}> = [
  { id: "entry", label: "起動" },
  { id: "mode", label: "モード導線" },
  { id: "combat", label: "戦闘" },
  { id: "choice", label: "選択" },
  { id: "result", label: "結果" },
  { id: "secondary", label: "補助画面" },
];

export const UI_SCREEN_DEFINITIONS = [
  {
    id: "device-gate",
    label: "PC以外の端末案内",
    group: "entry",
    summary: "キーボードとマウスが必要なことを伝え、ゲーム起動を止める。",
    screenKind: null,
    owner: "startup",
    recordEffect: "none",
    source: "startup",
  },
  {
    id: "title",
    label: "タイトル",
    group: "entry",
    summary: "Story、Endless、Practiceの3主導線と二次メニューを表示する。",
    screenKind: "title",
    owner: "ArenaScreenPresenter",
    recordEffect: "read-only",
    source: "screen-view-model",
  },
  {
    id: "story",
    label: "Story選択",
    group: "mode",
    summary: "初期作戦と最終遠征を選ぶ。",
    screenKind: "story",
    owner: "ArenaScreenPresenter",
    recordEffect: "read-only",
    source: "screen-view-model",
  },
  {
    id: "practice",
    label: "Practice入口",
    group: "mode",
    summary: "難度固定・記録対象外の練習場へ入る。",
    screenKind: "practice",
    owner: "ArenaScreenPresenter",
    recordEffect: "none",
    source: "screen-view-model",
  },
  {
    id: "practice-settings",
    label: "Practice設定",
    group: "mode",
    summary: "無敵、出現量、敵種をプレイ中に変更する。",
    screenKind: "practice",
    owner: "ArenaScreenPresenter",
    recordEffect: "none",
    source: "screen-view-model",
  },
  {
    id: "weapon-select",
    label: "武器選択",
    group: "mode",
    summary: "PulseまたはSpreadを選び、対象モードを開始する。",
    screenKind: "weaponSelect",
    owner: "ArenaScreenPresenter",
    recordEffect: "none",
    source: "screen-view-model",
  },
  {
    id: "training-briefing",
    label: "初期作戦 briefing",
    group: "mode",
    summary: "一動作だけを短く示し、開始前の操作glyphへfocusを置く。",
    screenKind: null,
    owner: "ArenaTutorialDialog",
    recordEffect: "none",
    source: "screen-view-model",
  },
  {
    id: "training-active",
    label: "初期作戦 active",
    group: "combat",
    summary: "即時key cue、無進展hint、課題進捗を戦場へ重ねる。",
    screenKind: "none",
    owner: "ArenaTutorialDialog",
    recordEffect: "none",
    source: "world-view",
  },
  {
    id: "gameplay-standard",
    label: "通常戦闘",
    group: "combat",
    summary: "HP、XP、時間、スコア、戦況を表示する基準状態。",
    screenKind: "none",
    owner: "PhaserHud",
    recordEffect: "none",
    source: "world-view",
  },
  {
    id: "gameplay-danger",
    label: "危険予告",
    group: "combat",
    summary: "次の圧力上昇と安全行動を戦場より優先して示す。",
    screenKind: "none",
    owner: "PhaserHud",
    recordEffect: "none",
    source: "world-view",
  },
  {
    id: "gameplay-commander",
    label: "Commander戦",
    group: "combat",
    summary: "対象、Act、攻撃予告、通常敵圧力を同時に示す。",
    screenKind: "none",
    owner: "PhaserHud",
    recordEffect: "none",
    source: "world-view",
  },
  {
    id: "gameplay-boss",
    label: "Boss phase 2",
    group: "combat",
    summary: "Boss HP、攻撃予告、回復経路、目的を最大密度で表示する。",
    screenKind: "none",
    owner: "PhaserHud",
    recordEffect: "none",
    source: "world-view",
  },
  {
    id: "paused",
    label: "一時停止",
    group: "combat",
    summary: "再開、再挑戦、タイトル復帰を選ぶ。",
    screenKind: "paused",
    owner: "ArenaScreenPresenter",
    recordEffect: "none",
    source: "screen-view-model",
  },
  {
    id: "upgrade-select",
    label: "通常強化",
    group: "choice",
    summary: "3候補の役割、ランク、取得後の数値を比較する。",
    screenKind: "upgradeSelect",
    owner: "ArenaChoicePresenter",
    recordEffect: "none",
    source: "choice-view-model",
  },
  {
    id: "protocol-select",
    label: "固有スキル",
    group: "choice",
    summary: "武器固有の条件と効果を3候補から選ぶ。",
    screenKind: "protocolSelect",
    owner: "ArenaChoicePresenter",
    recordEffect: "none",
    source: "choice-view-model",
  },
  {
    id: "evolution-select",
    label: "固有スキル強化",
    group: "choice",
    summary: "完成までの2択と現在の経路を表示する。",
    screenKind: "evolutionSelect",
    owner: "ArenaChoicePresenter",
    recordEffect: "none",
    source: "choice-view-model",
  },
  {
    id: "contract-select",
    label: "限界強化",
    group: "choice",
    summary: "完成能力後の限界強化候補を表示する。",
    screenKind: "contractSelect",
    owner: "ArenaChoicePresenter",
    recordEffect: "none",
    source: "choice-view-model",
  },
  {
    id: "training-complete",
    label: "初期作戦完了",
    group: "result",
    summary: "習得項目と次の行動を示す。",
    screenKind: "trainingComplete",
    owner: "ArenaScreenPresenter",
    recordEffect: "none",
    source: "screen-view-model",
  },
  {
    id: "result-endless",
    label: "Endless敗北",
    group: "result",
    summary: "死因、成長、自己ベスト、同条件再挑戦を示す。",
    screenKind: "gameOver",
    owner: "ArenaScreenPresenter",
    recordEffect: "terminal-write",
    source: "screen-view-model",
  },
  {
    id: "result-expedition-win",
    label: "遠征勝利",
    group: "result",
    summary: "完遂時間、メダル、戦術点、記録scopeを示す。",
    screenKind: "gameOver",
    owner: "ArenaScreenPresenter",
    recordEffect: "terminal-write",
    source: "screen-view-model",
  },
  {
    id: "result-expedition-loss",
    label: "遠征敗北",
    group: "result",
    summary: "到達Act、Boss進行、敗因、PB対象外理由を示す。",
    screenKind: "gameOver",
    owner: "ArenaScreenPresenter",
    recordEffect: "terminal-write",
    source: "screen-view-model",
  },
  {
    id: "history",
    label: "履歴",
    group: "secondary",
    summary: "保存済みrunを武器別に確認・削除する。",
    screenKind: "history",
    owner: "ArenaScreenPresenter",
    recordEffect: "read-only",
    source: "screen-view-model",
  },
  {
    id: "ranking",
    label: "ランキング",
    group: "secondary",
    summary: "mode、scope、seed、rulesetが同じ記録だけを比較する。",
    screenKind: "ranking",
    owner: "ArenaScreenPresenter",
    recordEffect: "read-only",
    source: "screen-view-model",
  },
  {
    id: "settings",
    label: "設定",
    group: "secondary",
    summary: "音量、画面効果、自動射撃、端末内データを管理する。",
    screenKind: "settings",
    owner: "ArenaScreenPresenter",
    recordEffect: "read-only",
    source: "screen-view-model",
  },
  {
    id: "help",
    label: "Help",
    group: "secondary",
    summary: "操作、敵、フィールド情報を複数ページで表示する。",
    screenKind: "help",
    owner: "ArenaScreenPresenter",
    recordEffect: "none",
    source: "screen-view-model",
  },
  {
    id: "beta-info",
    label: "候補版情報",
    group: "secondary",
    summary: "版、保存、既知制約、ライセンス、報告先を表示する。",
    screenKind: null,
    owner: "startup",
    recordEffect: "read-only",
    source: "startup",
  },
] as const satisfies ReadonlyArray<UiScreenDefinition>;

export type UiScreenId = (typeof UI_SCREEN_DEFINITIONS)[number]["id"];

export type UiScreenTransition = {
  from: UiScreenId;
  to: UiScreenId;
  trigger: string;
  condition?: string;
};

export const UI_SCREEN_TRANSITIONS = [
  {
    from: "device-gate",
    to: "title",
    trigger: "desktop条件を満たして再読込",
  },
  { from: "title", to: "story", trigger: "Story" },
  { from: "title", to: "weapon-select", trigger: "Endless" },
  { from: "title", to: "practice", trigger: "Practice" },
  { from: "title", to: "history", trigger: "履歴" },
  { from: "title", to: "ranking", trigger: "ランキング" },
  { from: "title", to: "settings", trigger: "設定" },
  { from: "title", to: "help", trigger: "情報 / H" },
  { from: "title", to: "beta-info", trigger: "候補版情報" },
  {
    from: "story",
    to: "training-briefing",
    trigger: "初期作戦",
  },
  {
    from: "story",
    to: "weapon-select",
    trigger: "最終遠征",
  },
  { from: "story", to: "title", trigger: "Escape / 戻る" },
  { from: "practice", to: "weapon-select", trigger: "武器選択" },
  {
    from: "practice",
    to: "practice-settings",
    trigger: "プレイ中の設定",
  },
  { from: "practice", to: "title", trigger: "戻る" },
  {
    from: "weapon-select",
    to: "gameplay-standard",
    trigger: "Pulse / Spread",
    condition: "Endless、Final Expedition、Practice",
  },
  {
    from: "training-briefing",
    to: "training-active",
    trigger: "開始 / Enter",
  },
  {
    from: "training-active",
    to: "training-briefing",
    trigger: "次課題",
  },
  {
    from: "training-active",
    to: "training-complete",
    trigger: "全課題完了",
  },
  {
    from: "training-complete",
    to: "weapon-select",
    trigger: "Endlessへ進む",
  },
  { from: "training-complete", to: "title", trigger: "タイトルへ" },
  { from: "gameplay-standard", to: "paused", trigger: "Escape" },
  {
    from: "gameplay-standard",
    to: "upgrade-select",
    trigger: "通常強化条件",
  },
  {
    from: "gameplay-standard",
    to: "protocol-select",
    trigger: "通常ビルド完成",
  },
  {
    from: "gameplay-standard",
    to: "gameplay-danger",
    trigger: "危険予告",
  },
  {
    from: "gameplay-standard",
    to: "gameplay-commander",
    trigger: "Commander出現",
  },
  {
    from: "gameplay-standard",
    to: "gameplay-boss",
    trigger: "Boss phase 2",
  },
  {
    from: "gameplay-standard",
    to: "result-endless",
    trigger: "Endless終了",
  },
  {
    from: "gameplay-standard",
    to: "result-expedition-win",
    trigger: "遠征勝利",
  },
  {
    from: "gameplay-standard",
    to: "result-expedition-loss",
    trigger: "遠征敗北",
  },
  { from: "gameplay-danger", to: "gameplay-standard", trigger: "危険終了" },
  {
    from: "gameplay-commander",
    to: "gameplay-standard",
    trigger: "撃破 / 撤退",
  },
  { from: "gameplay-boss", to: "result-expedition-win", trigger: "Boss撃破" },
  { from: "gameplay-boss", to: "result-expedition-loss", trigger: "HP 0" },
  { from: "paused", to: "gameplay-standard", trigger: "再開 / Escape" },
  { from: "paused", to: "weapon-select", trigger: "再挑戦" },
  { from: "paused", to: "title", trigger: "タイトルへ" },
  { from: "upgrade-select", to: "gameplay-standard", trigger: "1..3 / click" },
  {
    from: "protocol-select",
    to: "gameplay-standard",
    trigger: "1..3 / click",
  },
  {
    from: "gameplay-standard",
    to: "evolution-select",
    trigger: "固有スキル強化条件",
  },
  {
    from: "evolution-select",
    to: "gameplay-standard",
    trigger: "1..2 / click",
  },
  {
    from: "gameplay-standard",
    to: "contract-select",
    trigger: "限界強化条件",
  },
  {
    from: "contract-select",
    to: "gameplay-standard",
    trigger: "1..N / click",
  },
  { from: "result-endless", to: "weapon-select", trigger: "再挑戦" },
  { from: "result-endless", to: "title", trigger: "タイトルへ" },
  { from: "result-expedition-win", to: "weapon-select", trigger: "再挑戦" },
  { from: "result-expedition-win", to: "title", trigger: "タイトルへ" },
  { from: "result-expedition-loss", to: "weapon-select", trigger: "再挑戦" },
  { from: "result-expedition-loss", to: "title", trigger: "タイトルへ" },
  { from: "history", to: "title", trigger: "Escape / 戻る" },
  { from: "ranking", to: "title", trigger: "Escape / 戻る" },
  { from: "settings", to: "title", trigger: "Escape / 戻る" },
  { from: "help", to: "title", trigger: "Escape / 閉じる" },
  { from: "beta-info", to: "title", trigger: "ゲームに戻る" },
] as const satisfies ReadonlyArray<UiScreenTransition>;

export function getUiScreenDefinition(id: UiScreenId): UiScreenDefinition {
  const screen = UI_SCREEN_DEFINITIONS.find((candidate) => candidate.id === id);
  if (!screen) throw new Error(`Unknown UI screen: ${id}`);
  return screen;
}

export function getOutgoingUiTransitions(
  id: UiScreenId,
): ReadonlyArray<UiScreenTransition> {
  return UI_SCREEN_TRANSITIONS.filter((transition) => transition.from === id);
}

export function getIncomingUiTransitions(
  id: UiScreenId,
): ReadonlyArray<UiScreenTransition> {
  return UI_SCREEN_TRANSITIONS.filter((transition) => transition.to === id);
}
