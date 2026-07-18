---
title: UI・グラフィック再設計計画
description: UI責務分離、比較草案、ライブラリ採否、視覚テーマ統合をゲームルールから分離して進める計画。
---

最終整理日: 2026-07-18

## 結論

全面的なUIフレームワーク置換は行いません。現在は次の境界が成立しています。

- `domain` / `simulation`はPhaserを参照しない。
- `ArenaScreenPresenter`はPhaserなしで表示文と画面状態を作る。
- `PhaserArenaScreenView`と`PhaserHud`はCanvas / WebGLのPassive Viewである。
- `ArenaChoiceOverlay`は武器、強化、契約をsemantic DOMの`button`として表示する。
- メニュー座標、入力、保存、ラン確定は個別のモジュールへ分かれている。

残る課題は、450行の画面Presenter、398行のDOM Overlay、PhaserとCSSへ重複した色・寸法・状態表現です。実際に見た目を変える画面から、変更理由に沿って分けます。行数だけを目的にした分割、React / Vueの導入、全HUDのDOM化は行いません。

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
| 戦闘中HUD、予告、弾、障害物 | Phaser View | WebGL内の座標と描画だけを持つ |
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

- 画面別責務マップを作る。
- Result PresenterとSecondary Menu Presenterを実変更に合わせて抽出する。
- Choice Overlayのデータ整形とDOM接続を分ける。
- UI theme tokenを導入し、既存画像を変えずに回帰する。

### Wave 2: 比較prototype

対象: [PH-V08-012 #67](https://github.com/garchomp-game/create-game/issues/67)

- productionから分離したTailwind / HTML環境を作る。
- A / B / Cを同じ実データ、960 x 540、390 x 844で作る。
- タイトル、ステージ選択、強化選択、リザルトを操作可能にする。
- Playwright画像と文字overflow検査を持つ。

### Wave 3: 世界観と採否

対象: [PH-V08-010 #66](https://github.com/garchomp-game/create-game/issues/66)

- 四方侵入、障害物、回収、追跡ボスを説明できるテーマを選ぶ。
- 視認性、実装負荷、拡張性、素材条件で1案を採用する。
- Tailwind、Lucide、font、bitmap assetのproduction採否をADRへ残す。

### Wave 4: production縦切り

- タイトルとリザルト、またはステージ選択の1経路だけを採用案へ置き換える。
- ゲームルールhash、保存、入力、performanceを維持する。
- 第1、第5、第10のアート量産前に手動比較する。

## 完了条件

- 3案を同じ情報とviewportで比較できる。
- 採用理由と不採用理由を、好みだけでなく視認性、情報密度、操作、bundle、性能で説明できる。
- UI変更でsimulation、乱数消費、スコア、RunRecord schemaを変えない。
- 960 x 540、390 x 844、横長で文字と操作領域が重ならない。
- WebGL非空、主要E2E、画像、production artifact検査が通る。
- 外部素材は出典、ライセンス、加工、再配布、クレジット条件を記録する。

## 次の開始点

RC5の自動ゲートとpreview更新は完了しました。次は`PH-V08-011`の責務マップとtheme token設計から開始します。`PH-V08-012`の草案は並行できますが、productionへ反映する案は`PH-V08-010`の世界観判断まで確定しません。
