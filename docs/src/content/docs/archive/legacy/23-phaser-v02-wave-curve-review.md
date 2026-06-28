---
title: "Legacy: Phaser v0.2 Wave Curve Review"
description: "Migrated from docs/23-phaser-v02-wave-curve-review.md."
---

> Source: `docs/23-phaser-v02-wave-curve-review.md`

# Phaser v0.2 Wave Curve Review

## 1. 目的

`PH-V02-006` では、30秒/60秒境界で難化要素が同時に入りすぎる問題を見直す。

狙いは、難易度を下げ切ることではなく、プレイヤーが「何が難しくなったか」を理解できる段階構造にすること。

## 2. 変更前の問題

v0.1のwaveは3段階だった。

| Wave | Start | 役割 | 主な圧力 |
| ---: | ---: | --- | --- |
| 1 | 0s | 学習 | chaserのみ |
| 2 | 30s | 優先順位 | brute/fast追加、密度増 |
| 3 | 60s | late wave | spawn短縮、速度上昇、最大敵数増、ranged追加 |

60秒境界で、以下が同時に起きていた。

- spawn intervalが `0.75 -> 0.55`
- speed multiplierが `1.18 -> 1.35`
- max enemiesが `45 -> 60`
- ranged enemyとenemy projectileが追加

この形だと、60秒以降に崩れた時の原因が、密度、速度、敵弾、障害物、ビルド差のどれなのか分解しづらい。

## 3. 変更後のwave定義

v0.2では4段階に分ける。

| Wave | Start | 役割 | spawn | speed | max | 敵 |
| ---: | ---: | --- | ---: | ---: | ---: | --- |
| 1 | 0s | 学習 | 1.00 | 1.00 | 30 | chaser |
| 2 | 30s | fast/brute優先順位 | 0.78 | 1.14 | 42 | chaser, brute, fast |
| 3 | 60s | ranged導入 | 0.68 | 1.22 | 50 | chaser, brute, fast, ranged少量 |
| 4 | 90s | 持久戦 | 0.55 | 1.35 | 60 | 全種、高密度 |

判断:

- 30秒では、fast/bruteの読み分けを主目的にする。
- 60秒では、rangedと敵弾の導入を主目的にする。
- 90秒以降で、密度と速度による本格的な持久戦に入る。

## 4. Balance Probe 結果

固定seed:

- `20260619`
- `20260620`
- `20260621`
- `20260622`
- `20260623`

`kiteCollect` の主要KPI:

| KPI | v0.1/v0.2 Batch A | v0.2 Wave Review |
| --- | ---: | ---: |
| survival p50 | 101.87s | 119.40s |
| kills/min p50 | 164.33 | 161.84 |
| score/min p50 | 2212.89 | 2245.73 |
| first damage p50 | 75.43s | 73.53s |
| first upgrade p50 | 7.13s | 7.13s |
| wave reached p50 | 60s | 90s |
| max enemies max | 28 | 29 |
| max bullets max | 34 | 34 |

解釈:

- 生存p50は約17%伸びた。
- kill/minはほぼ維持され、敵処理テンポは大きく鈍っていない。
- wave reached p50が90秒に届くようになり、90秒以降の持久戦を評価できるようになった。
- first damage p50はほぼ維持されており、序盤が過度に安全になったわけではない。

## 5. Wave境界10秒の被弾

`balanceProbe` は各wave開始後10秒の被弾を記録する。

`kiteCollect` 5seedでの境界被弾:

| Seed | 0-10s | 30-40s | 60-70s | 90-100s |
| ---: | ---: | ---: | ---: | ---: |
| 20260619 | 0 | 0 | 0 | 24 |
| 20260620 | 0 | 0 | 0 | 0 |
| 20260621 | 0 | 0 | 8 | 0 |
| 20260622 | 0 | 0 | 0 | 24 |
| 20260623 | 0 | 0 | 0 | 0 |

判断:

- 60秒境界直後の被弾は5seed中1回、8damageのみ。
- 90秒境界直後の被弾は5seed中2回、ここが持久戦圧の主な立ち上がりになる。
- 60秒境界はranged導入として残り、急激な理不尽化は緩和された。

## 6. 受け入れ判断

採用する。

理由:

- waveごとの役割が明確になった。
- 60秒境界の圧力が説明可能になった。
- 90秒以降を評価できる生存レンジが出た。
- 既存の `balance.test.ts` は新baselineを持ち、約20%の主要KPI変動を検出できる。

## 7. 残リスク

- `kiteCollect` は人間プレイではないため、120秒前後の手触りは手動プレイで確認が必要。
- 90秒以降の障害物詰まりが死因に混ざる可能性がある。
- ranged導入が見た目では分かっても、弾の避け方が初見で伝わるかは別途確認が必要。

次は `PH-V02-007 Obstacle Friction Audit` または手動プレイ3ラン記録で確認する。
