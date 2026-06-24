# Phaser v0.2 Backlog and PM Plan

## 1. 目的

`Arena Core Phaser v0.1` はゲームとして成立している。

v0.2では新要素を急いで増やすより、快適性、視認性、難易度上昇、調整判断を扱える状態にする。

v0.2の中心テーマは `Playtest & Balance Foundation` とする。

## 2. PM判断

### 2.1 採用する方針

- 面白さの議論を、結果KPI、死因、wave別圧力、手動プレイメモに接続する。
- UIと視認性は、難易度調整の前提として扱う。
- 新武器、新敵、大型ボス、メタ進行より先に、既存ループの読みやすさと計測を固める。
- E2E/Visual regressionは描画崩れとUI遷移の検出に使い、面白さ判定には使わない。
- `simulation` と `adapter` の境界を維持し、Phaser依存をゲームルールへ入れない。

### 2.2 後回しにする方針

- 複数ステージ
- 大型ボス
- 恒久メタ進行
- オンラインランキング
- BGMや外部アセット量産
- Reroll/Banish/Lock
- Arcade PhysicsやMatterへの主物理移行

## 3. 工数単位

この計画では、時間ではなく `EP` を使う。

| EP | 意味 |
| ---: | --- |
| 1 | 小さな局所修正、テスト追加のみ |
| 2 | 1-2ファイル中心の小機能 |
| 3 | 既存system/adapterをまたぐ中規模変更 |
| 5 | domain、simulation、adapter、testの複数層に触る変更 |
| 8 | 仕様判断を含む大きめの機能群。v0.2では原則分割する |

## 4. v0.2 完了条件

- ラン終了時に、生存時間、score/min、kills/min、level、XP回収、被弾、死因を確認できる。
- debug snapshotで、wave、敵種別数、敵弾数、pickup数、最後の被弾原因を確認できる。
- balance simulation benchで、少なくとも複数seed、複数入力モデルの比較ができる。
- HUDでHP、XP、Waveを瞬時に読める。
- 敵種と敵弾を色だけに頼らず識別できる。
- wave切替の難しさが、密度、敵種、弾、地形のどれに起因するか分解できる。
- `npm run test`, `npm run typecheck`, `npm run build`, `npm run test:e2e` が通る。

## 5. Backlog

### PH-V02-001 Run KPI and Death Cause

Priority: P0  
Effort: 5 EP  
Status: Done  
Owner type: main/worker  
Dependencies: none

目的:

調整前後のランを比較できるようにし、死亡理由を説明できるようにする。

Scope:

- `phaser/src/domain/types.ts`
- `phaser/src/simulation/resultSummary.ts`
- `phaser/src/simulation/systems/combatSystem.ts`
- `phaser/src/simulation/systems/statsSystem.ts`
- `phaser/src/adapters/phaser/ArenaScene.ts`
- `phaser/src/adapters/phaser/PhaserArenaRenderer.ts`
- `phaser/src/simulation/*.test.ts`

Requirements:

- `player.damaged` に `source` を追加する。
- 接触、敵弾、その他将来拡張を区別できる。
- `RunStats` または `RunResultSummary` で contact damage と projectile damage を分けられる。
- result/debug snapshotで最後の被弾原因を見られる。
- 既存result画面の情報量を増やしすぎない。

Acceptance Criteria:

- Simulation testで接触被弾と敵弾被弾のsourceが分かれる。
- Game Over result summaryに死因または最後の被弾sourceが入る。
- Debug snapshotで最後の被弾source、damage量、hpAfterが確認できる。
- 通常ログは増やさない。

失敗条件:

- 死因がResultとDebugで不整合になる。
- Phaser描画都合の情報がsimulation eventへ混ざる。
- `player.damaged` が肥大化し、将来のdamage source追加が難しくなる。

### PH-V02-002 Balance Simulation Bench

Priority: P0  
Effort: 5 EP  
Status: Done  
Owner type: worker  
Dependencies: PH-V02-001のevent shape確定後が望ましい

目的:

感覚論だけで難易度調整しないため、固定seedと入力モデルでバランス回帰を検出する。

Scope:

- `phaser/src/simulation/balance.test.ts`
- `phaser/src/simulation/stepWorld.ts`
- `phaser/src/simulation/createWorld.ts`
- 必要なら `phaser/src/simulation/balanceProbe.ts`

Requirements:

- 複数seedでsimulationを走らせる。
- 入力モデルは最低3つ用意する。
- `noInput`: 無操作
- `fixedAimShoot`: 固定方向射撃
- `kiteCollect`: 簡易逃げ撃ちとXP回収寄り
- 180秒相当の上限ランを扱える。
- p25/p50/p75、生存時間、初被弾、初アップグレード、wave到達、kill/minを集計する。

Acceptance Criteria:

- Benchが高速に完了する。
- NaN、不正座標、maxEnemies超過を検出できる。
- v0.1 baselineとして主要KPIをコメントまたはsnapshot的に記録する。
- 調整後に15-20%以上の主要KPI変動を検出できる設計になっている。

失敗条件:

- テストがflakyになる。
- テスト実行時間が長すぎて通常の `npm run test` を阻害する。
- AI入力モデルの結果を人間プレイの正解として扱う。

### PH-V02-003 Playtest Report Template and Debug Export

Priority: P0  
Effort: 3 EP  
Status: Done  
Owner type: main/worker  
Dependencies: PH-V02-001

目的:

手動プレイの感触を、再現可能な結果データに紐づける。

Scope:

- `docs/22-phaser-v02-playtest-template.md`
- `phaser/src/adapters/phaser/ArenaScene.ts`
- `phaser/src/simulation/resultSummary.ts`

Requirements:

- 手動プレイメモ用テンプレートを作る。
- seed、config version、build commit、プレイ目的、死因メモ、詰まった時刻を記録する。
- dev-only debug hookで現在runのsummaryを取得できる。
- 可能ならclipboardやconsole出力ではなく、debug snapshotのJSON取得に寄せる。

Acceptance Criteria:

- 1ランの感想とKPIを同じテンプレートで記録できる。
- 調整前後で最低3ラン比較できる形式になっている。
- 手動メモだけで判断しない注意書きがある。

失敗条件:

- 自由記述だけで比較不能になる。
- 記録負担が重く、実際に使われない。

### PH-V02-004 HUD Gauge Redesign

Priority: P0  
Effort: 5 EP  
Status: Done  
Owner type: worker  
Dependencies: none

目的:

プレイ中にHP、XP、Wave、敵圧を瞬時に読めるようにする。

Scope:

- `phaser/src/adapters/phaser/PhaserArenaRenderer.ts`
- 必要なら `phaser/src/adapters/phaser/PhaserHud.ts`
- `phaser/tests/e2e/arena-visual.spec.ts`

Requirements:

- HPとXPはバー/ゲージ中心にする。
- Waveと敵数は短いラベルにする。
- `Weapon pulse` のような低情報テキストを減らし、連射、弾数、貫通など実ステータスへ寄せる。
- Title/Pause/Result/Upgradeと重ならない。

Acceptance Criteria:

- 初期、Wave2、Wave3、Upgrade、Pause、Resultのvisual regressionが通る。
- 960x540 canvas内でテキストが重ならない。
- HUDがプレイ領域を過剰に占有しない。

失敗条件:

- テキストが増えただけで読みやすくならない。
- HUDが敵弾やpickupを隠す。

### PH-V02-005 Enemy and Projectile Visual Language

Priority: P0  
Effort: 5 EP  
Status: Done  
Owner type: worker  
Dependencies: none

目的:

敵種と敵弾を、色だけでなく形状、輪郭、内側マークで識別できるようにする。

Scope:

- `phaser/src/config/gameConfig.ts`
- `phaser/src/domain/types.ts`
- `phaser/src/config/configSchema.ts`
- `phaser/src/adapters/phaser/PhaserArenaRenderer.ts`
- `phaser/tests/e2e/arena-visual.spec.ts`

Requirements:

- chaser、brute、fast、rangedを形状または内部記号で見分けられる。
- enemy projectileはplayer bullet、XP pickup、hit feedbackと混同しない。
- grayscaleでも危険度をある程度読める。
- visual configに必要な描画情報を寄せ、simulation configへ描画都合を混ぜない。

Acceptance Criteria:

- Wave2/Wave3固定snapshotで敵種が識別できる。
- 色覚差を想定して、色以外の差分がある。
- 描画変更でsimulation testsが不要に壊れない。

失敗条件:

- 凡例や説明文を読まないと敵種が分からない。
- 演出粒子と敵弾が同化する。

### PH-V02-006 Wave Curve Review

Priority: P1  
Effort: 3 EP  
Status: Done  
Owner type: main  
Dependencies: PH-V02-002

目的:

30秒/60秒境界で複数の難化要素が同時に入る状態を見直し、waveごとの役割を明確にする。

Scope:

- `phaser/src/config/gameConfig.ts`
- `phaser/src/config/configSchema.ts`
- `phaser/src/simulation/waveDirector.test.ts`
- `phaser/src/simulation/balance.test.ts`
- `docs/13-phaser-production-implementation-plan.md`

Requirements:

- 0-30秒: 学習
- 30-60秒: fast/bruteによる優先順位
- 60-90秒: ranged対応
- 90秒以降: ビルド差と持久力
- wave境界直後10秒の被弾増分を見る。
- 初回プレイヤー45-75秒、基本操作90-130秒、慣れたプレイヤー150-210秒を仮目標にする。

Acceptance Criteria:

- wave定義の意図がdocsに残る。
- Balance benchで調整前後を比較できる。
- 60秒境界での急激な理不尽化が緩和または説明可能になる。

失敗条件:

- 数値だけを触って、何が難しくなったか説明できない。
- 全体が平坦になり、waveの手触りが消える。

### PH-V02-007 Obstacle Friction Audit

Priority: P1  
Effort: 5 EP  
Status: Done  
Owner type: worker  
Dependencies: PH-V02-001, PH-V02-002

目的:

障害物まわりの引っかかり、敵詰まり、逃げ道の理不尽さを調査し、必要なら手動collisionのまま改善する。

Scope:

- `phaser/src/simulation/systems/movement.ts`
- `phaser/src/simulation/systems/enemySystem.ts`
- `phaser/src/math/geometry.ts`
- `phaser/src/simulation/stepWorld.test.ts`
- `phaser/tests/e2e/arena.spec.ts`

Requirements:

- プレイヤーが障害物角で止まりすぎるケースをテスト化する。
- 敵が障害物に詰まる/密集するケースを観測する。
- 改善する場合は、Arcade Physics移行ではなく既存manual collisionを磨く。

Acceptance Criteria:

- 障害物沿い移動の回帰テストがある。
- 角詰まりが死因になりやすいか判断できる。
- 改善する場合もsimulation層に閉じる。

失敗条件:

- 物理エンジン移行でスコープが膨らむ。
- 地形の個性を消しすぎて、障害物が意味を失う。

### PH-V02-008 Upgrade Comparison UI

Priority: P1  
Effort: 3 EP  
Status: Done  
Owner type: worker  
Dependencies: PH-V02-004

目的:

アップグレード選択を、現在値から適用後の変化を比較できるUIにする。

Scope:

- `phaser/src/adapters/phaser/PhaserArenaRenderer.ts`
- 必要なら `phaser/src/simulation/upgradePreview.ts`
- `phaser/tests/e2e/arena-visual.spec.ts`

Requirements:

- 候補ごとに現在値と適用後を短く表示する。
- rankだけでなく、何がどれだけ変わるかを示す。
- 説明文を長くしない。

Acceptance Criteria:

- Upgrade visual snapshotが通る。
- 選択後のruntime値とpreviewが整合する。
- UIが3候補で収まる。

失敗条件:

- 読む量が増えすぎ、テンポが悪化する。
- 効果比較が不正確になる。

### PH-V02-009 Weapon Choice Baseline

Priority: P2  
Effort: 5 EP  
Status: Later  
Owner type: main/worker  
Dependencies: PH-V02-001, PH-V02-002, PH-V02-008

目的:

`pulse/spread/pierce` をランのビルド起点として選べるようにする。

Scope:

- `phaser/src/domain/types.ts`
- `phaser/src/simulation/stepWorld.ts`
- `phaser/src/simulation/systems/shootingSystem.ts`
- `phaser/src/adapters/phaser/PhaserArenaRenderer.ts`
- `phaser/tests/e2e/arena.spec.ts`

Requirements:

- 開始時または初回レベルアップ時に武器を選べる。
- 武器別metricsで選択率、kill/min、生存時間を比較できる。
- 1武器だけが明らかな正解にならないよう、v0.2基盤後に評価する。

Acceptance Criteria:

- 武器選択がResult/Debugに残る。
- Weapon別の簡易benchが取れる。
- 既存pulse baselineが壊れない。

失敗条件:

- 選択が見た目だけになる。
- DPS最適解が固定化し、意思決定にならない。

## 6. Gantt by Effort Points

時間ではなく、工数帯で実行順と並列性を示す。

凡例:

- `█`: 主作業
- `░`: レビュー/調整/統合
- `.`: 着手前または依存待ち

```text
Effort Band              01 02 03 04 05 06 07 08 09 10 11 12 13 14 15 16 17 18 19 20 21 22 23 24
PH-V02-001 KPI/Death     █  █  █  █  ░  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .
PH-V02-004 HUD Gauge     █  █  █  █  ░  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .
PH-V02-005 Visual Lang   .  █  █  █  █  ░  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .
PH-V02-002 Balance Bench .  .  .  █  █  █  █  ░  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .
PH-V02-003 Playtest Doc  .  .  .  .  .  █  █  ░  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .
PH-V02-006 Wave Review   .  .  .  .  .  .  .  █  █  ░  .  .  .  .  .  .  .  .  .  .  .  .  .  .
PH-V02-007 Obstacle      .  .  .  .  .  .  .  █  █  █  █  ░  .  .  .  .  .  .  .  .  .  .  .  .
PH-V02-008 Upgrade UI    .  .  .  .  .  .  .  .  .  .  .  █  █  ░  .  .  .  .  .  .  .  .  .  .
Stabilization            .  .  .  .  .  .  .  .  .  .  .  .  .  █  █  █  ░  .  .  .  .  .  .  .
v0.2 Candidate Freeze    .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  █  ░  .  .  .  .  .  .
PH-V02-009 Weapon Choice .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  █  █  █  █  ░  .
```

v0.2 coreは `PH-V02-001` から `v0.2 Candidate Freeze` まで。

- 合計工数: 約40 EP
- 並列実行時のクリティカルパス目安: 18 effort bands

`PH-V02-009` はv0.2 coreの結果を見て、v0.2後半に入れるかv0.3へ送る。

## 7. 実行順

### Batch A: 計測と読みやすさの土台

- PH-V02-001 Run KPI and Death Cause
- PH-V02-004 HUD Gauge Redesign
- PH-V02-005 Enemy and Projectile Visual Language

並列可能。

注意:

- PH-V02-001はdomain/simulation中心。
- PH-V02-004とPH-V02-005はadapter/view中心。
- ただしvisual snapshot更新は競合しやすいので、統合時にmain agentがまとめる。

### Batch B: バランス評価

- PH-V02-002 Balance Simulation Bench
- PH-V02-003 Playtest Report Template

PH-V02-001のevent shape確定後に進める。

### Batch C: 調整と納得感

- PH-V02-006 Wave Curve Review
- PH-V02-007 Obstacle Friction Audit
- PH-V02-008 Upgrade Comparison UI

PH-V02-002のbench結果を見てから、wave数値に入る。

### Batch D: Optional Content Direction

- PH-V02-009 Weapon Choice Baseline

v0.2 core完了後に入れるか判断する。

## 8. サブエージェント分担案

### Worker A: Domain Metrics

担当:

- PH-V02-001

Write scope:

- `phaser/src/domain/types.ts`
- `phaser/src/simulation/resultSummary.ts`
- `phaser/src/simulation/systems/combatSystem.ts`
- `phaser/src/simulation/systems/statsSystem.ts`
- 関連simulation tests

### Worker B: Renderer/HUD

担当:

- PH-V02-004

Write scope:

- `phaser/src/adapters/phaser/PhaserArenaRenderer.ts`
- 必要なら `phaser/src/adapters/phaser/PhaserHud.ts`
- `phaser/tests/e2e/arena-visual.spec.ts`

### Worker C: Visual Language

担当:

- PH-V02-005

Write scope:

- `phaser/src/config/gameConfig.ts`
- `phaser/src/config/configSchema.ts`
- `phaser/src/domain/types.ts`
- `phaser/src/adapters/phaser/PhaserArenaRenderer.ts`
- `phaser/tests/e2e/arena-visual.spec.ts`

注意:

Worker BとCはRendererとvisual snapshotsで競合しやすい。

同時に走らせる場合、片方をexplorerにして設計案だけ出させるか、片方のwrite scopeを `PhaserHud.ts` 新設に限定する。

### Worker D: Balance Bench

担当:

- PH-V02-002

Write scope:

- `phaser/src/simulation/balance.test.ts`
- 必要なら `phaser/src/simulation/balanceProbe.ts`

### Main Agent

担当:

- 統合判断
- visual snapshot更新
- docs更新
- final verification
- PH-V02-006 Wave Curve Review

## 9. PM運用ルール

- 各チケット開始前に、影響範囲、write scope、受け入れ条件を再確認する。
- 1チケットごとに `npm run test` と `npm run typecheck` を通す。
- UI/描画/入力が変わるチケットでは `npm run test:e2e` を通す。
- visual regression更新は意図的な描画変更だけで行う。
- バランス数値変更はbench結果と手動プレイメモをセットで残す。
- 新要素追加は、既存KPIと死因分析で評価できるようになってから行う。

## 10. Backlog Status Board

| Status | Tickets |
| --- | --- |
| Done | PH-V02-001, PH-V02-002, PH-V02-003, PH-V02-004, PH-V02-005, PH-V02-006, PH-V02-007, PH-V02-008 |
| Ready | none |
| Later | PH-V02-009 |
| Blocked | none |
| Rejected for v0.2 |大型ボス、複数ステージ、恒久メタ進行、オンラインランキング、BGM/外部アセット量産、Reroll/Banish/Lock |

## 11. 次アクション

次に着手するなら、以下のどちらか。

1. v0.2 stabilizationで全体検証、手動プレイ、未整理差分を固める。
2. PH-V02-009 Weapon Choice Baselineをv0.2後半に入れるか、v0.3へ送るか判断する。

推奨は1。

理由:

- PH-V02-008でアップグレード選択時に現在値と適用後の比較が出るようになった。
- v0.2 coreのReadyチケットは完了した。
- 次はstabilizationとして、全体検証、手動プレイ候補、v0.2 candidate化を整理する。

## 12. Implementation Log

### 2026-06-24 Batch A Partial

Completed:

- PH-V02-001 Run KPI and Death Cause
- PH-V02-002 Balance Simulation Bench
- PH-V02-003 Playtest Report Template and Debug Export
- PH-V02-004 HUD Gauge Redesign
- PH-V02-005 Enemy and Projectile Visual Language
- PH-V02-006 Wave Curve Review
- PH-V02-007 Obstacle Friction Audit
- PH-V02-008 Upgrade Comparison UI

Notes:

- `player.damaged` now carries contact/projectile source data for simulation-origin damage.
- `RunStats` and `RunResultSummary` track damage by source and the last damage source.
- The debug snapshot includes the new damage source stats.
- The HUD was split into `PhaserHud` and now uses HP/XP bars plus compact wave and weapon stat labels.
- Visual regression now includes fixed Wave 2 and Wave 3 HUD frames.
- `balanceProbe` runs fixed-seed `noInput`, `fixedAimShoot`, and `kiteCollect` models for up to 180 seconds.
- Balance tests record v0.1/v0.2 Batch A baseline values and fail on roughly 20% movement in key probe KPIs.
- Enemy visuals are now shape-coded and marked: chaser circle/ring, brute square/cross, fast diamond/slash, ranged hex/dot.
- Enemy projectiles are now diamond-shaped with stroke and bright core, separate from player bullets and XP pickups.
- Wave visual snapshots use debug fixtures for Wave2 and Wave3 enemy readability checks.
- Added `docs/22-phaser-v02-playtest-template.md` for single-run notes, 3-run comparison, and debug export field mapping.
- Added dev-only `getRunExport()` and `getRunExportJson()` with config version, build commit, seed, result summary, stats, counts, and recent events.
- Split the old 60s late wave into a 60s ranged-introduction wave and a 90s endurance wave.
- `balanceProbe` now records damage taken during the first 10 seconds of each wave band.
- Added `docs/23-phaser-v02-wave-curve-review.md` with bench deltas and wave-boundary damage review.
- Added a Wave 4 visual regression frame for the 90s endurance band.
- Changed circle-rect obstacle collision so tangent contact is not treated as overlap.
- Added simulation and E2E tests for sliding along obstacle edges.
- Added `obstacleContacts` to debug snapshot/run export and documented the audit in `docs/24-phaser-v02-obstacle-friction-audit.md`.
- Added `upgradePreview` for current vs after upgrade values.
- Upgrade buttons now show compact comparison values such as `Projectiles: 1 -> 2`.
- Upgrade visual regression was updated for the taller 3-line choice buttons.
- Added `docs/25-phaser-v02-stabilization-report.md` after full typecheck, unit, build, and E2E verification.
