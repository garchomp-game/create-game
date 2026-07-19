---
title: UI・グラフィック再設計計画
description: UI責務分離、比較草案、ライブラリ採否、視覚テーマ統合をゲームルールから分離して進める計画。
---

最終整理日: 2026-07-18

## 結論

全面的なUIフレームワーク置換は行いません。2026-07-18にWave 1を実装し、現在は次の境界が成立しています。

- `domain` / `simulation`はPhaserを参照しない。
- `ArenaScreenPresenter`は画面種別を調停し、Result、Secondary Menu、Choiceの各PresenterがPhaserなしで表示モデルを作る。
- `PhaserArenaScreenView`と`ArenaChoiceOverlay`は表示モデルを写すPassive Viewである。`PhaserHud`は戦闘中の派生ラベルをまだ所有する。
- `ArenaChoiceOverlay`は`ArenaChoiceViewModel`をsemantic DOMの`button`へ写し、入力だけを返すPassive Viewである。
- メニュー座標、入力、保存、ラン確定は個別のモジュールへ分かれている。
- `ArenaTheme`を正本とし、Phaser数値色とCSS custom propertiesへ各adapterで変換する。

同じ情報で比較可能な視覚草案とUIライブラリ採否はWave 2で完了しました。A「戦術管制」を本番の基礎にし、B「回収航路」はステージ進行、C「精密アーケード」は武器成果とリザルトへ限定して使います。世界観・素材・fontの最終判断はWave 3に残します。行数だけを目的にした分割、React / Vueの導入、全HUDのDOM化は行いません。

## 管理方針

要件と判断はStarlight、進捗と作業単位はGitHub Issues / Projectsを正本とします。現在のProjectはStatus、Area、Size、Phase、Priority、Waveを持ち、依存順もIssue本文で表現できます。

Linearや自作管理ツールは導入しません。二重更新、ID対応、完了状態の不一致を増やす一方、現時点で解消する管理上の不足がないためです。

## 目標

1. ゲームルールを変えずにタイトル、選択、HUD、リザルトを独立して編集できる。
2. 同じ情報を使った3案を同じviewportで比較できる。
3. 第1、第5、第10ステージで背景、敵、警告、音が段階的に変化する基準を作る。
4. 高解像度文字、キーボード操作、ポインター操作、色覚以外の識別を維持する。
5. prototype、debug fixture、未採用ライブラリをproduction bundleへ含めない。

## 表示責務

| 領域 | 所有者 | 今後の変更 |
| --- | --- | --- |
| HP、XP、敵、スコア、ボス状態 | `WorldState` / `RunRecord` | UI都合の状態を追加しない |
| 画面種別、文言、表示用要約 | `presentation` | Result、Secondary Menu、Choiceの変更理由単位へ分ける |
| 戦闘中HUD、予告、弾、障害物 | Phaser View | WebGL内の座標と描画を持つ。HUD再設計時に派生ラベルをPresenterへ移す |
| タイトル、選択、結果の操作部品 | DOM View候補 | semantic element、focus、pointerを持つ |
| 色、間隔、文字階層、状態色 | UI theme tokens | Phaser用数値とCSS custom propertiesへ変換する |
| メニュー操作、保存、開始・終了 | application Controller | 見た目を参照しない |

CanvasとDOMを一方へ統一しません。戦闘予告はワールドとの重なり順が必要なためWebGLに残します。選択肢や将来のログインフォームは高解像度文字とアクセシビリティが重要なためDOMを使います。

## ライブラリ採否

### Tailwind CSS

[TailwindのVite統合](https://tailwindcss.com/docs/installation/using-vite)は、テンプレートを走査して静的CSSを生成し、ブラウザ実行時のruntimeを持ちません。比較草案を短時間で作る用途には合います。

初回はprototype workspaceだけへ入れます。既存`arena.css`を直ちにTailwindへ書き換えず、採用案が決まった後にproductionで得るものがあるかを再判定します。

### Lucide

[Lucide](https://lucide.dev/)はSVGで、使用したアイコンだけをimportできるため、DOMの設定、戻る、音量、履歴などの既知操作に適しています。

草案でアイコン操作が必要な場合だけ評価します。Canvas内へSVGを大量に変換せず、文字だけで意味が伝わるコマンドや戦闘エンティティには使いません。

### Phaser DOM Element

[Phaser DOM Element](https://docs.phaser.io/api-documentation/4.0.0/class/gameobjects-domelement)は高解像度UIをCanvas上へ重ねられますが、Canvasのdisplay listへ混在できず、常にCanvasの上か下に置かれます。

既存`ArenaChoiceOverlay`は同じ役割をより明示的に所有しているため、Phaser DOM Elementへの置換は行いません。Canvasとのサイズ同期だけを共通化します。

### 見送るもの

- React / Vue / Svelte: 現在の画面数と状態量に対して構成・bundle・二重lifecycleが増える。
- 重量級component library: ゲーム固有の固定960 x 540とportrait表現を上書きするコストが大きい。
- Phaser UI plugin: Phaser 4互換、アクセシビリティ、既存DOM入力との統合を新たに検証する必要がある。
- CSS-in-JS: Phaser Viewと静的prototypeで共有しにくく、runtimeを増やす。

## 比較する3案

### A. 戦術管制

- 実ゲームの四方侵入と障害物を戦術表示として見せる。
- ニュートラルな黒鉛色を背景に、シアンを操作、黄を予告、コーラルを危険、緑を回復へ使う。
- ステージ進行はグリッド密度、警戒線、背景レイヤーの変化で示す。
- 情報の読みやすさは高いが、訓練シミュレーションに寄りすぎる可能性がある。

### B. 回収航路

- 包囲下で資源を回収し、戦線を維持する設定を強調する。
- 金属、警告塗装、損耗表示を使い、XPと回復の経路判断を画面テーマへ接続する。
- Arena Core固有の回収と継戦を説明しやすい。
- 茶・橙だけの工業色へ偏らないよう、冷色の航路表示と回復緑を併用する。

### C. 精密アーケード

- Pulseの照準、貫通、反射とSpreadの扇形制圧を成果表示へつなぐ。
- スコア帯、連続命中、危険突破を短い演出と形で示す。
- 操作上達と競技性を強く伝えられる。
- ストーリーとステージ差が薄くならないよう、世界観案との統合が必要である。

## 実装順

### Wave 0: RC5基準固定

状態: 完了。

- 制圧衝撃波、ボス中回復制御、完遂・速攻ボーナスを自動検証した。
- 通常リザルトと遠征リザルトの重なりを画像基準へ固定した。
- commit `155d4986ffe1`、Cloudflare Version `ef6324fd-1cf6-450f-8026-fbcf0f579842`を[RC5 preview](https://v07-final-expedition-arena-core.garchomp-game.workers.dev)へ公開した。production trafficは変更していない。

### Wave 1: 表示境界

対象: [PH-V08-011 #68](https://github.com/garchomp-game/create-game/issues/68)

状態: 実装・自動回帰完了。

- `ArenaResultPresenter`、`ArenaSecondaryMenuPresenter`、共通Record Formatterを抽出した。
- `ArenaChoicePresenter`へ武器、通常強化、EX強化、契約の表示判断を移し、DOM Viewを188行の接続層へ縮小した。
- `ArenaTheme`と`applyArenaDomTheme`を追加し、DOM、Phaser画面、HUDの既存値を共有した。
- 新しいruntime依存、ゲーム数値、保存schema、乱数消費は追加・変更していない。
- 依存方向を含む単体試験 `378 passed / 2 skipped`、型検査、production build、Playwright `72 passed / 1 skipped`を通し、既存画像差分がないことを確認した。

### Wave 2: 比較prototype

対象: [PH-V08-012 #67](https://github.com/garchomp-game/create-game/issues/67)

状態: 実装・比較・自動回帰完了。

- productionから分離した`ui-prototypes/`にTailwind / Vanilla TypeScript環境を作った。
- A / B / Cを同じ実データ、960 x 540、390 x 844で作り、タイトル、ステージ、強化、戦闘HUD、リザルトを比較可能にした。
- semantic button、focus、矢印キー、pointerを持ち、30組み合わせのoverflow検査と画像回帰を通した。
- Aを基礎採用し、BとCは役割を限定して使う。[UIライブラリと視覚方向](../../engineering/ui-library-and-visual-direction-adr/)へ採否を記録した。
- Tailwindはprototype専用、Lucideは将来のDOMコマンド限定候補とし、production依存は増やしていない。

### Wave 3: 世界観と採否

対象: [PH-V08-010 #66](https://github.com/garchomp-game/create-game/issues/66)

状態: 視覚方向とUIライブラリは完了。世界観・素材判断は継続。

- 四方侵入、障害物、回収、追跡ボスを説明できる固有名詞とテーマを選ぶ。
- Aの情報階層、Bの航路表現、Cの成果表現を共通の世界設定へ接続する。
- font、bitmap assetのライセンス、量産方法、production採否を追記する。

### Wave 4: production縦切り

対象: [PH-V08-013 #70](https://github.com/garchomp-game/create-game/issues/70)

状態: 最初の縦切りを実装・自動回帰完了。

- 武器・通常強化・EX強化・契約の選択画面をAの情報階層へ置き換えた。
- 番号、役割、ランク、説明、取得後数値、選択コマンドをPresenterの表示モデルとして分離した。
- Passive DOM View、選択callback、数字キー、Escape、pointer、focus契約を維持した。
- 960 x 540と390 x 844で5画像と全選択種別のoverflowを固定した。
- ゲームルールhash、保存、乱数を維持し、固定6ランのevent / world hashがRC5基準へ一致した。
- Tailwind、Lucide、外部font、比較assetはproductionへ追加していない。

## 完了条件

- 3案を同じ情報とviewportで比較できる。
- 採用理由と不採用理由を、好みだけでなく視認性、情報密度、操作、bundle、性能で説明できる。
- UI変更でsimulation、乱数消費、スコア、RunRecord schemaを変えない。
- 960 x 540、390 x 844、横長で文字と操作領域が重ならない。
- WebGL非空、主要E2E、画像、production artifact検査が通る。
- 外部素材は出典、ライセンス、加工、再配布、クレジット条件を記録する。

## 次の開始点

RC5の自動ゲートとpreview更新、`PH-V08-011`の表示境界、`PH-V08-012`の比較草案と採否、`PH-V08-013`の選択画面縦切りは完了しました。RC5は基準証跡として保持し、RC6の時計・記録・有限回復採否を先に行います。並行して`PH-V08-010`で世界観・素材を絞り、RC6後は危険反転、技能成果、最大密度fixtureへA/B/Cの役割を展開します。Stage選択とStage 1 / 5のproduction実装はv0.9の3作戦検証へ送ります。
