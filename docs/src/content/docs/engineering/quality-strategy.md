---
title: Quality Strategy
description: テスト、E2E、debug export、balanceProbeの使い分け。
---

## 品質チェック

```bash
cd phaser
npm run typecheck
npm test -- --run
npm run test:e2e
npm run build
```

## Unit / Simulation

simulation、math、format、config schemaはPhaserなしでテストします。

優先する観点:

- randomがflakyにならないこと。
- upgrade、pickup、combat、movementが決定論的に検証できること。
- gameplay変更に合わせてstatsが壊れないこと。

## E2E / Visual

PlaywrightでCanvas表示、入力、Game Over、restart、固定状態のスクリーンショット比較を確認します。

UIや視認性に触る変更では、visual snapshotを更新または追加します。

## BalanceProbe

balanceProbeは、AI入力モデルでの回帰検知です。

人間プレイの快適性判定の代替ではありません。

使い方:

- 主要KPIの急な崩れを見る。
- seed固定で再現性を確保する。
- 手動playtestの補助として使う。
