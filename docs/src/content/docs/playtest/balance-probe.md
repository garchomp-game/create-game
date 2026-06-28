---
title: Balance Probe
description: balanceProbeの位置づけとv0.3 baseline。
---

## 位置づけ

balanceProbeはAI入力モデルによる回帰検知です。

人間プレイの快適性を表すものではありません。

## v0.3 Baseline

`kiteCollect` の目安:

| Metric | Value |
| --- | ---: |
| Survival p50 | 119.3 |
| First Damage p50 | 84.23 |
| First Upgrade p50 | 7.13 |
| Wave Reached p50 | 90 |
| HP Recovered p50 | 88 |
| Heal Pickups p50 | 22 |
| Effective Heal Pickups p50 | 8 |

## 使い方

- gameplay変更の明確な回帰を見る。
- seed固定で再現性を確保する。
- manual playtestの補助にする。
- item、equipment、stage、modifierを入れたらKPIを拡張する。
