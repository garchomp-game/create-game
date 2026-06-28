---
title: Architecture
description: Phaser版の責務分離と実装境界。
---

## 方針

Phaserは外周に置き、ゲームルールはPhaserに依存しないTypeScriptモジュールへ寄せます。

## 主な構成

- `src/adapters/phaser`: Phaser Scene、入力、描画、debug overlay
- `src/simulation`: World更新とsystems
- `src/domain`: 型定義
- `src/config`: ゲーム設定
- `src/math`: collision、vector、randomなど
- `src/format`: 表示用の純粋format関数
- `src/ports`: logger / metrics境界
- `src/adapters/telemetry`: telemetry実装

## 守ること

- simulation/domain/config/math/formatへPhaser依存を入れない。
- 新しいgame ruleはまずsimulation側でテスト可能にする。
- UI/visual変更はPlaywrightまたはsnapshotで確認する。
- debug exportとresult metricsをgameplay変更と合わせて更新する。

## 将来の拡張

stage、equipment、item、run modifierはdataとして扱い、Phaser Sceneへ直接分岐を増やしすぎないようにします。
