---
title: UIライブラリと視覚方向
description: 比較prototypeから選んだArena Coreの視覚基準、UIライブラリの採否、本番縦切りの境界を記録するADR。
---

最終更新日: 2026-07-18

## 状態

採用・最初のproduction縦切り実装済み。`PH-V08-012`の比較結果を`PH-V08-013`の選択画面へ反映しました。世界観の固有名詞、最終bitmap素材、fontは`PH-V08-010`で引き続き検討します。

## 文脈

Arena Coreには、四方から侵入する敵、障害物を使った回避、XPと回復の経路判断、武器ごとの技能差、有限遠征とEndlessがあります。見た目はこれらの判断を読みやすくし、単なる装飾や一般的な宇宙ゲームの画面へ寄せない必要があります。

一方、productionはPhaser WebGLの戦闘表示、semantic DOMの選択表示、Phaser非依存Presenterへ既に分離されています。デザイン比較のためにsimulation、保存、入力、rendererを巻き込む理由はありません。

そこでproductionと依存を共有しない`ui-prototypes/`を作り、同じデータから3案、5画面を生成しました。

- A 戦術管制
- B 回収航路
- C 精密アーケード
- 画面: タイトル、ステージ、強化、戦闘HUD、リザルト
- viewport: 960 x 540、390 x 844

## 決定

**A 戦術管制を本番のレイアウトと視認性の基礎に採用します。** ただし全面的な折衷案にはせず、役割が明確な二つの表現だけを補助的に使います。

- Bの航路、損耗、継戦表現は、遠征のステージ進行と回収判断へ使う。
- Cの精密、連続成果、記録更新表現は、武器熟練とリザルトへ使う。
- 戦闘中の通常情報階層、警告、操作状態はAを正本とする。

色は黒鉛色の中立背景、操作シアン、警告黄、危険コーラル、回復緑を役割で使います。色だけで状態を伝えず、ラベル、形、位置、数値を併用します。紫や青だけ、茶や橙だけに寄せません。

## 比較結果

| 案 | 視認性・情報密度 | Arena Coreとの接続 | 拡張性 | 実装負荷 | 判断 |
| --- | --- | --- | --- | --- | --- |
| A 戦術管制 | 警告、HP、進行の優先順が最も安定 | 四方侵入、障害物、照準判断を説明しやすい | HUD、選択、遠征へ同じ規則を使える | 現行themeとPresenterへ移しやすい | 基礎採用 |
| B 回収航路 | 経路と資源の連続性は強いが、瞬間的な技能成果は弱い | XP、回復、遠征の継戦に最も合う | ステージ1、5、10の環境差へ伸ばしやすい | 素材感を過剰にするとasset負荷が増える | 進行表現だけ採用 |
| C 精密アーケード | スコアと武器成果は強いが、戦闘中は情報が競合しやすい | Pulse精度、Spread制圧、ランキングに合う | 結果・記録には強く、物語進行には弱い | 演出量を増やすと低情報画面にも負荷が出る | 成果表現だけ採用 |

Aは装飾の好みではなく、危険を最初に読み、次に資源と成果を読む順序がdesktopとportraitの両方で崩れなかったため採用します。

## ライブラリ

### Tailwind CSS

比較prototypeに限って採用します。Vite統合で静的CSSを生成でき、3案を短時間で比較する目的には合いました。

productionには現時点で導入しません。既存の`arena.css`、`ArenaTheme`、表示モデルで必要な境界が成立しており、Phaser側へbuild pluginと別のtoken表現を加える便益がありません。utility classへ全面移行する作業も、プレイヤー体験を直接改善しません。

### Lucide

DOMの既知コマンド用として採用可能とします。戻る、設定、音量、履歴のように記号が定着した操作で、名前付きimportだけを使います。

現在のproductionには追加しません。現行の選択画面は文字主体で、アイコン依存を増やす必要がないためです。タイトルやステージ選択に3個以上のアイコン操作を実装する時点で再評価します。敵、弾、武器、戦闘効果のassetとしては使いません。

### 採用しないもの

- React、Vue、Svelte: 現在の状態量に対して別lifecycleとbundleを増やす。
- 重量級component library: 固定比率のゲーム画面と固有情報階層を上書きする。
- Phaser DOM Element: 既存のsemantic DOM overlayより責務が曖昧になる。
- Phaser UI plugin: Phaser 4互換、focus、アクセシビリティを改めて検証する必要がある。

## 本番の最初の縦切り

対象: [PH-V08-013 #70](https://github.com/garchomp-game/create-game/issues/70)

状態: 実装・自動回帰完了。

**武器・通常強化・EX強化・契約の選択画面**だけを採用方向へ置き換えました。

1. `ArenaChoicePresenter`へ画面文脈、番号、分類、取得後ラベル、選択コマンドを加え、選択callbackを維持する。
2. Aの情報階層と警告表現を基礎にする。
3. 遠征中だけBのAct／継戦進行を補助表示する。
4. 武器固有の成果予告だけCの短い精密表現を使う。
5. simulation、乱数、スコア、保存schema、ルール版を変えない。
6. desktop、portrait、キーボード、pointer、画像差分を先に合格させる。

`ArenaChoiceOverlay`は表示モデルからsemantic DOMを組み立て、focus、pointer、数字キー、Escape、viewport同期だけを所有します。カードは色に加えて役割ラベル、四角／菱形marker、番号、取得後数値で区別します。Tailwind、Lucide、新しいruntime依存はproductionへ追加していません。

選択中はsimulationを停止したまま、通常強化、EX強化、契約の背景遮蔽を弱め、desktopのカードを下段へ寄せます。overlay自身へfocusを移すため、Tabなしで`1`から`3`を即時入力できます。選択後は直前のpointer照準を保持して自動射撃を再開し、ゲームルール上の無敵時間や猶予フレームは追加しません。

タイトルとStage 1 / 5 / 10の選択は`PH-V09-001`、リザルトのDOM化はRC6の記録意味論を固定した後に別単位で行います。

## 対象外

- 3案すべてのproduction実装。
- UI変更と同時のゲームバランス調整。
- Stage 1 / 5 / 10とdeferred stageのasset一括制作。
- ライセンスを確認していない外部素材の取り込み。
- 画面全体のDOM化、Canvas／WebGLの置換。

## 再検討条件

次のいずれかが起きた場合だけライブラリ採否を再検討します。

- DOM画面が5画面を超え、同じresponsive componentが3回以上重複する。
- アカウント、フォーム、サーバー状態により画面状態の同期が複雑になる。
- ステージ編集や運用画面をゲーム本体とは別アプリとして作る。
- 現行CSSとtheme tokenではアクセシビリティか保守性の受け入れ条件を満たせない。

## 検証証跡

- prototype production build成功、監査上の既知脆弱性0件。
- 同一データ、semantic操作、30の画面・viewport組み合わせでoverflowなし。
- desktop／portraitの画像回帰12件成功。
- prototype markerがPhaser production artifactへ混入しない独立検査を持つ。
- production選択UIは単体`378 passed / 2 skipped`、Playwright `74 passed / 1 skipped`を通過した。
- 武器、通常強化、EX強化、契約のdesktop画像5件と、全種類のportrait overflow契約を固定した。
- Tabなしの数字キー選択と、選択後のpointer照準・自動射撃継続をブラウザ回帰へ固定した。
- v0.7固定6ランは6勝し、event hashとworld hashがRC5基準へ完全一致した。

比較方法と実装順は[UI・グラフィック再設計計画](../../project-management/ui-visual-redesign-plan/)、プレイヤー向け情報要件は[UI/UXとフィードバック](../../design/ui-ux/)を参照してください。
