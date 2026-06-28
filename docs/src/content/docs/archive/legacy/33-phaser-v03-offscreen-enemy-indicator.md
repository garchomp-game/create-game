---
title: "Legacy: PH-V03-011 Offscreen Enemy Direction Indicator"
description: "Migrated from docs/33-phaser-v03-offscreen-enemy-indicator.md."
---

> Source: `docs/33-phaser-v03-offscreen-enemy-indicator.md`

# PH-V03-011 Offscreen Enemy Direction Indicator

作成日: 2026-06-28

## 1. Ticket

Ticket ID: `PH-V03-011`  
Title: Offscreen Enemy Direction Indicator  
Priority: P1  
Effort: 2 EP  
Status: Implemented  
Owner type: main  
Dependencies:

- existing enemy spawn from outside arena
- existing Phaser renderer
- visual regression test fixture

## 2. 背景

敵は画面外からスポーンしてアリーナへ入ってくる。

現状では、プレイヤーが移動、照準、射撃、pickup回収に集中していると、画面外のどこから敵が来ているか分かりにくい。これは特に早死にの原因分析を難しくし、操作負荷と敵圧のどちらが問題なのかを見分けにくくする。

## 3. 目的

画面外にいる敵の方向を、アリーナ端の小さな矢印で示す。

これは敵の数値や挙動を変える調整ではなく、接近方向の可読性を上げるpresentation改善である。

## 4. Non Goals

このチケットでは以下を行わない。

- enemy spawn rateやwave curveを調整する。
- enemy AIを変える。
- ミニマップを追加する。
- 大きな警告UIや画面フラッシュを追加する。
- 敵種ごとの詳細な接近予告システムを作る。
- 操作体系を変更する。

## 5. Design

仕様:

- 画面外にいる敵だけを対象にする。
- アリーナ境界の内側に小さな矢印を描く。
- 矢印は敵からプレイヤーへ向かう方向を向く。
- 敵種の色を使い、どの種類の敵が来ているかを軽く読めるようにする。
- 表示数は近い敵から最大8体に制限する。
- HUD領域と重なる場合は、HUD外へ逃がす。

判断:

- simulation/domainには触れず、Phaser rendererだけで完結させる。
- debug exportやstatsは増やさない。
- balanceProbeには入れない。

## 6. Implementation Result

実装概要:

- `PhaserArenaRenderer` に offscreen enemy indicator描画を追加した。
- `ArenaScene` に `setOffscreenEnemyIndicatorFixture()` を追加した。
- `vite-env.d.ts` にdebug API型を追加した。
- `arena-offscreen-enemy-indicators.png` のvisual snapshotを追加した。

描画:

- 黒い薄い円を背景にする。
- 敵種の色で三角矢印を描く。
- 白strokeで視認性を確保する。

## 7. Test / Verification

追加:

- `phaser/tests/e2e/arena-visual.spec.ts`
  - `matches the fixed offscreen enemy indicator frame`

確認済み:

- `npm run typecheck`: passed
- `npm test -- --run`: 11 files, 78 tests passed
- targeted visual snapshot update: passed
- `npm run test:e2e`: 22 tests passed
- `npm run build`: passed, existing Phaser/Vite chunk size warningのみ

最終候補前に実行する:

- `npm run test:e2e`
- `npm run build`

## 8. Playtest Notes

PH-V03-002で見ること:

- 画面外からの接近方向が分かるようになったか。
- 矢印が敵弾、pickup、HUDと混同しないか。
- 早死にが「見えない方向から来た敵」ではなくなったか。
- 表示が多すぎてプレイ領域のノイズにならないか。

## 9. Risks

- 敵の接近が分かりやすくなり、難易度が少し下がる可能性がある。
- 敵種色を使うため、画面端で色情報が増える。
- HUD近くの上方向indicatorは配置に注意が必要。

現時点では、これは数値調整ではなく可読性改善として扱う。
