---
title: "Legacy: 実装結果サマリ"
description: "Migrated from docs/07-implementation-summary.md."
---

> Source: `docs/07-implementation-summary.md`

# 実装結果サマリ

## 1. 完了範囲

`Arena Core` の共通仕様に沿って、以下の9プロジェクトを実装した。

| 順番 | フォルダ | ライブラリ/エンジン | 状態 |
| ---: | --- | --- | --- |
| 1 | `phaser` | Phaser | 実装完了 |
| 2 | `excalibur` | Excalibur.js | 実装完了 |
| 3 | `kaplay` | KAPLAY | 実装完了 |
| 4 | `kontra` | Kontra.js | 実装完了 |
| 5 | `melonjs` | melonJS | 実装完了 |
| 6 | `pixijs-matter` | PixiJS + Matter.js | 実装完了 |
| 7 | `threejs-rapier` | Three.js + Rapier | 実装完了 |
| 8 | `babylonjs` | Babylon.js | 実装完了 |
| 9 | `playcanvas` | PlayCanvas | 実装完了 |

各プロジェクトには、以下を配置している。

- `package.json`
- `index.html`
- `src/main.js`
- `README.md`
- `IMPLEMENTATION_NOTES.md`

## 2. 共通実装内容

全プロジェクトで、以下の共通機能を実装した。

- 固定論理サイズ `960 x 540` のアリーナ
- プレイヤー移動
- ポインタ照準
- 左クリックまたは `Space` による射撃
- 敵の定期スポーン
- 敵のプレイヤー追跡
- 弾と敵の当たり判定
- 敵接触によるプレイヤーダメージ
- 障害物による移動ブロック
- スコア、HP、生存時間、敵数、操作ガイドのHUD
- HP 0 によるゲームオーバー
- `R` キーによるリスタート

## 3. 仕様調整

詳細設計にあった障害物 `block-e` は、初期値ではプレイヤー初期位置と重なっていた。

そのため、`docs/03-detailed-design.md` と全実装で `block-e` の `y` 座標を `254` から `220` に変更した。

## 4. 検証結果

以下を全プロジェクトで実施した。

- `npm install`
- `npm run build`
- Google Chrome headless + Playwright Core によるブラウザスモークテスト

スモークテストでは、以下を確認した。

- Canvas が作成される
- スクリーンショットが非空である
- キーボード移動入力を受け付ける
- 射撃入力を受け付ける
- 致命的な page error または console error がない

## 5. 残リスク

今回の検証は短時間のスモークテストであり、長時間プレイのバランスや細かい物理挙動までは深く検証していない。

WebGL系の実装では、スクリーンショット取得時にChromeのGPU readback warningが出る場合がある。これはブラウザ検証時の読み取りに伴う警告であり、ゲーム実行を止めるエラーではない。

Phaser、Three.js + Rapier、Babylon.js、PlayCanvasでは、Viteのbundle size warningが出る。特にBabylon.jsは依存が大きく、最終比較では配布サイズも評価対象に含めるべきである。

`npm audit` では、各プロジェクトで依存由来のlow severity warningが1件出る。現時点ではゲーム実装そのものの動作ブロッカーではない。

## 6. 次の比較作業

次に行うべき作業は、各実装を手動プレイして `docs/05-comparison-rubric.md` の観点で評価を入れることである。

特に以下を分けて記録する。

- ライブラリ自体の作りやすさ
- 連続実装による学習効果
- 2D仕様を3Dへ移した時の負担
- 物理エンジンを使ったことで楽になった部分と重くなった部分
- AIがAPIを間違えやすかった箇所
