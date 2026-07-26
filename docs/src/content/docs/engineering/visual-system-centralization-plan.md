---
title: ビジュアルシステム集約化方針
description: デザイン確定後に見た目の変更を一か所へ集約するための境界と移行順序
---

更新日: 2026-07-26

## 状態

機体・敵・XPのasset境界は第一段階の集約を完了しました。背景・UI panel・警告演出の全面統合は、
Workで方向を決めるまで保留します。

2026-07-26時点の正本と所有者は次のとおりです。

- semantic colorと文字組み: `ArenaTheme.ts`
- simulationに対応するview color: `gameConfig.ts`の`VIEW_CONFIG`
- 自機・通常敵・ボス・XPのasset key、path、機体寸法、元画像の向き:
  `PhaserArenaEntityVisuals.ts`の`ARENA_ENTITY_VISUAL_CATALOG`
- 実戦外の機体表示: `PhaserArenaEntityPreview.ts`
- 背景、回復、敵表示、警告のrecipe: 各Phaser view
- runtime instanceとpool: `PhaserArenaRenderer`配下

実戦、チュートリアル、ヘルプ、練習設定、武器プレビューは同じcatalogを参照します。
旧来の円・多角形による敵アイコンは廃止しました。今後機体画像を差し替える場合はcatalogの
`path`を変更し、個別画面へ画像パスや模倣図形を追加しません。

### 第一段階で共通化した画面

- Endless／Story／Practice／Tutorialの実戦描画
- ヘルプの自機・敵4種・XP
- 練習設定の敵4種
- 練習モードの武器プレビュー

回復キットは既存の`drawRecoveryKitIcon()`を実戦とヘルプで共有しています。
敵弾、障害物、警告はゲーム内recipeを保ち、背景方向の決定後に次段階で扱います。

## 目標境界

### 共有Singleton

共有するのは、実行中に変更されないpure dataだけです。

`ARENA_VISUAL_CATALOG`を単一の正本とし、次を保持します。

- semantic token: surface、text、control、warning、danger、recovery
- typography、radius、spacing、line width
- asset idとloader path
- entity、pickup、projectileのvisual recipe
- background theme idとstage別override

catalogは`Object.freeze()`可能なimmutable dataとし、DOM、Phaser、localStorage、Sceneを参照しません。

### Scene単位

状態を持つものはSingletonにしません。

- `Phaser.GameObjects.Image`
- `Graphics`、`Text`
- object poolとactive entity map
- animation timer
- Scene lifecycleへ従うevent listener

これらは`PhaserArenaRenderer`が1 Sceneにつき1組だけ所有し、Scene終了時に破棄します。これによりテスト間の状態漏れと、将来複数Sceneを使う場合の競合を避けます。

### Component Recipe

ボタン、HUD panel、警告、選択肢、回復、XPなどは、tokenとview modelから描画命令を返すrecipeへ揃えます。

同じrecipeをタイトル、設定、プレイ中UIで再利用し、個別viewが色・余白・線幅を直接決めない構造を目標にします。

## 移行順

1. Workレビューで背景方向とsemantic colorを決定する。
2. 現在の`ArenaTheme`と`VIEW_CONFIG`をsemantic tokenへ統合する。
3. asset keyとrole recipeをVisual Catalogへ移す。**機体・敵・XPは完了**
4. panel、button、choice、warningの順でComponent Recipeへ置換する。
5. Scene単位のlayerとpoolをComposition Rootから生成する。
6. UI一覧とvisual fixtureを新しい正本へ更新する。

一度に全viewを移行せず、1 componentごとに旧hard-coded valueが0になったことを確認して進めます。

## 性能上の制約

- textureはpreload時に一度だけ登録する。
- entity imageは生成破棄せずScene内poolで再利用する。
- static backgroundはテーマ変更時だけ再描画する。
- productionでは描画内訳profilingを実行しない。
- 画面外indicatorは全件sortせず、表示上限だけを選ぶ。
- catalog参照のためにframeごとのobject cloneを作らない。

## 採用しないもの

- mutableなglobal Singleton
- viewからDOMやSceneを横断して直接更新するevent bus
- CSS tokenとPhaser tokenを別々に手動管理する構造
- デザイン確定前の汎用Skin engine
- 実測なしの描画／navigationライブラリ追加
