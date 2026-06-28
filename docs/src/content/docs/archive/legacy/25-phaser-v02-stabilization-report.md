---
title: "Legacy: Phaser v0.2 Stabilization Report"
description: "Migrated from docs/25-phaser-v02-stabilization-report.md."
---

> Source: `docs/25-phaser-v02-stabilization-report.md`

# Phaser v0.2 Stabilization Report

## 1. 状態

`Playtest & Balance Foundation` のv0.2 coreチケットは完了。

| Ticket | Status |
| --- | --- |
| PH-V02-001 Run KPI and Death Cause | Done |
| PH-V02-002 Balance Simulation Bench | Done |
| PH-V02-003 Playtest Report Template and Debug Export | Done |
| PH-V02-004 HUD Gauge Redesign | Done |
| PH-V02-005 Enemy and Projectile Visual Language | Done |
| PH-V02-006 Wave Curve Review | Done |
| PH-V02-007 Obstacle Friction Audit | Done |
| PH-V02-008 Upgrade Comparison UI | Done |

`PH-V02-009 Weapon Choice Baseline` はLaterのまま。v0.2 candidate後に入れるか、v0.3へ送る。

## 2. 最終検証

2026-06-24に以下を通した。

| Command | Result |
| --- | --- |
| `npm run typecheck` | passed |
| `npm run test` | 11 files, 67 tests passed |
| `npm run build` | passed |
| `npm run test:e2e` | 17 Playwright tests passed |

`npm run build` はViteのchunk size warningを出すが、Phaser bundle由来の既知警告として扱う。

## 3. v0.2で入った基盤

計測:

- `player.damaged` のsource分離
- contact/projectile damage集計
- last damage source
- result summary拡張
- debug run export
- balance probe
- wave境界10秒の被弾記録
- obstacle contact count

視認性:

- HP/XP bar HUD
- Wave/time/score/enemy countの整理
- 敵種の形状/内部マーク化
- 敵弾のdiamond/core表示
- Wave2/Wave3/Wave4 visual regression
- custom cursorとaim guideの既存改善維持

快適性:

- pickup magnet維持
- タイトル/メニューの不透明化とクリック選択
- 障害物接線での壁沿い滑走
- upgrade候補の現在値/適用後比較

## 4. Balance Snapshot

`kiteCollect` probeの現行baseline:

| KPI | Value |
| --- | ---: |
| survival p50 | 119.40s |
| kills/min p50 | 161.84 |
| score/min p50 | 2245.73 |
| first damage p50 | 73.53s |
| first upgrade p50 | 7.13s |
| wave reached p50 | 90s |
| max enemies max | 29 |
| max bullets max | 34 |

このbaselineは人間プレイの正解ではない。調整回帰の検出用。

## 5. v0.2 Candidate 判定

candidate化してよい。

理由:

- core backlogが完了している。
- unit/type/build/E2Eが通っている。
- 手動プレイメモ用のdebug exportとテンプレートがある。
- バランス調整の前後差分を見るbenchがある。
- 視認性とUIの主要な詰まりがvisual regressionで固定されている。

## 6. 残リスク

- 実プレイ3-5ランの手動記録はまだ未実施。
- Wave4以降で障害物が死因に感じられるかは手動確認が必要。
- `kiteCollect` では120秒前後まで伸びるが、人間プレイの初回/基本操作/慣れプレイのレンジは未確認。
- weapon choiceは未導入なので、ビルド起点の選択肢はまだない。
- BGM/外部アセットは意図的に未対応。

## 7. 次のPM判断

推奨:

1. v0.2 candidateとして一度コミットする。
2. `docs/22-phaser-v02-playtest-template.md` を使い、同じbuildで3ラン記録する。
3. 手動メモで障害物死、敵弾死、視認性問題が出るか確認する。
4. その結果で `PH-V02-009 Weapon Choice Baseline` をv0.2後半に入れるか、v0.3へ送るか判断する。

コミット前に見る差分:

- docs追加: `21`, `22`, `23`, `24`, `25`
- Phaser code: metrics/death source, HUD, visual language, balance probe, wave curve, obstacle friction, upgrade preview
- snapshots: HUD/wave/upgrade visuals
