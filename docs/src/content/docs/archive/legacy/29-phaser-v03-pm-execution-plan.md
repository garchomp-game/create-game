---
title: "Legacy: Phaser v0.3 PM Execution Plan"
description: "Migrated from docs/29-phaser-v03-pm-execution-plan.md."
---

> Source: `docs/29-phaser-v03-pm-execution-plan.md`

# Phaser v0.3 PM Execution Plan

作成日: 2026-06-28

## 1. 目的

このドキュメントは、`PH-V03-002` 以降をPM視点で順番に進めるための実行計画である。

現時点では、回復pickupの実装は完了しているが、手動プレイ評価はまだ完了していない。したがって、最初の判断材料は `PH-V03-002 v0.3 Playtest and Balance Review` で集める。

## 2. 現在地

確認日: 2026-06-28

- `PH-V03-001 Healing Pickup Foundation` は実装済み。
- `main` は `origin/main` より6 commits ahead。
- `docs/27-phaser-v03-next-actions-backlog.md` には4 commits aheadとあるが、現時点の実測では6 commits ahead。
- `README.md`, `docs/README.md`, `.CLAUDE.md`, `AGENTS.md`, `docs/28-session-restart-guide.md` に未コミットまたは未追跡のセッション再開系変更がある。
- `npm run typecheck` と `npm test -- --run` は2026-06-28に通過確認済み。

追加確認:

- Manual Build Commit: `6e56261`
- `npm run typecheck`: passed
- `npm test -- --run`: 11 files, 78 tests passed
- `npm run test:e2e`: 22 tests passed, includes offscreen enemy indicator visual fixture
- `npm run build`: passed, existing Phaser/Vite chunk size warningのみ
- dev server: `http://localhost:5174/`

BalanceProbe baseline:

- Fixed seeds: `20260619` - `20260623`
- Duration: 180 seconds at 30 fps
- Violations: `[]`
- `kiteCollect` p50: survival 119.3s, first damage 84.23s, first upgrade 7.13s, wave reached 90s
- `kiteCollect` heal p50: HP recovered 88, heal pickups collected 22, effective heal pickups collected 8
- PM interpretation: automatic regression check is clean, but this does not replace PH-V03-002 manual play comfort review.

Manual playtest ops notes:

- Record both `HEAD` and dirty-worktree status. Dev build may include local uncommitted Phaser changes.
- Use debug export for numeric state and recent events, but use human notes for low-HP routing, heal visibility, input overload, offscreen arrow usefulness, and Space/right-click desire.
- The export is sufficient for PH-V03-002, but it does not provide full-run heal spawn/expire history. Missed or expired heals should be noted manually if noticed.

## 3. PM方針

回復pickupは、生存時間、低HP時の判断、Wave 3/Wave 4の緊張感へ直接影響する。

そのため、次の順で進める。

1. 手動プレイ証拠を集める。
2. サブエージェントでitem system、visual QA、metrics監査を並列に進める。
3. playtest結果と監査結果を統合する。
4. heal tuningが必要か判断する。
5. 必要な場合だけ最小変更で調整する。
6. v0.3 candidate化の可否を決める。

やらないこと:

- 手動プレイ前にheal pickupを調整しない。
- itemを複数同時に追加しない。
- balanceProbeを人間プレイ快適性の代替にしない。
- build warning対応をgameplay判断より優先しない。

追加のproduct signals:

- 経験値/leveling改修は、技術的には可能だが影響範囲が広い。pickup、magnet、upgrade頻度、wave pressure、run tempoを同時に動かすため、v0.3のheal tuningとは分離して観察する。
- heal pickupの吸い寄せ範囲は、XPと同じだと安全に拾えすぎる可能性がある。PH-V03-002では「低HP時に危険を取って拾いに行く判断が残るか」を特に見る。
- 右クリックskillは、将来のactive ability候補として有力。ただし入力、cooldown、UI、バランス、敵圧への対抗手段をまとめて設計する必要があるため、v0.3 candidate後の別phase候補にする。
- 現行の `WASD + mouse aim + left click/Space shoot` はskill ceilingが高い一方、早死にの原因が入力負荷になっている可能性がある。`Space` の役割変更、right-click active skill、auto-fire、number key skillsは `docs/32-phaser-controls-and-active-skill-discovery.md` で別途観察する。
- 画面外から来る敵の方向が読めない問題は、`PH-V03-011 Offscreen Enemy Direction Indicator` として小さく実装済み。これは数値調整ではなく、死因理解と接近方向の可読性改善として扱う。

Controls PM decision:

- Keep controls unchanged for `PH-V03-002`.
- Do not add dash, auto-fire, right-click skill, number-key skills, or key rebinding before manual heal playtest.
- After PH-V03-002, classify early deaths as input overload, enemy pressure, routing mistake, or heal tuning issue before deciding the next controls ticket.

## 4. 実行レーン

### Lane A: PM直轄

対象:

- `PH-V03-002 v0.3 Playtest and Balance Review`
- `PH-V03-003 Heal Pickup Tuning Pass`
- `PH-V03-008 Manual Playtest Report v0.3`
- `PH-V03-010 v0.3 Stabilization Candidate`

理由:

- 手動プレイの感触判断は文脈依存が強い。
- heal tuningは複数の所感とKPIを合わせて判断する必要がある。
- candidate判定は複数チケットのリスク整理を含む。

### Lane B: Item Design Reviewer

対象:

- `PH-V03-004 Item System Requirements and Data Model`

依頼内容:

- `haste` を初回itemにする妥当性を確認する。
- `Pickup.kind`, `ItemDefinition`, temporary effect, runtime modifier, stats, debug exportの境界を整理する。
- 過剰設計と設計不足の両方を指摘する。

成果物:

- item data model案
- 初回itemの推奨
- effect lifecycle案
- test strategy
- 実装前の作業票に入れるべき受け入れ条件

### Lane C: Visual / QA Reviewer

対象:

- `PH-V03-006 Pickup Presentation and Feedback Pass`

依頼内容:

- heal pickupがXP、敵弾、敵、player bulletと混同されないか確認する。
- pickup取得時のfeedbackが不足していないか確認する。
- 変更が必要な場合は最小改善に絞る。

成果物:

- 視認性リスク
- 取得feedbackリスク
- visual snapshot / E2E観点
- 変更しない方がよい項目

### Lane D: Metrics / Debug Export Auditor

対象:

- `PH-V03-002` 補助
- 将来の `PH-V03-007 BalanceProbe Item KPI Extension`

依頼内容:

- v0.3 playtest reportへ入れるべきKPIを確認する。
- debug exportでheal評価に必要な情報が足りているか監査する。
- item KPI拡張時に必要な最小項目を整理する。

成果物:

- playtest比較表のKPI案
- debug exportの不足有無
- `PH-V03-007` のKPI候補
- balanceProbeの使い方に関するガードレール

## 5. Gate Plan

### Gate 0: 作業前整備

完了条件:

- PM実行計画がdocsにある。
- v0.3 playtest reportの記録フォーマットがdocsにある。
- サブエージェントへの依頼が並列で走っている。

### Gate 1: Playtest Readiness

実行すること:

- `git status -sb`
- `git rev-parse --short HEAD`
- `cd phaser && npm run typecheck`
- `cd phaser && npm test -- --run`
- `cd phaser && npm run dev`

完了条件:

- dev serverでプレイできる。
- 手動記録に使うcommit、config version、seedが明確。
- `window.__ARENA_DEBUG__?.getRunExportJson()` が使える。

### Gate 2: PH-V03-002 Manual Runs

実行すること:

- 3 runs以上を記録する。
- Game Over、Pause、または検証停止時点でdebug run exportを保存する。
- `docs/30-phaser-v03-playtest-report.md` に所感とKPIを残す。

必ず見る項目:

- 低HP時にhealへ向かう判断が発生したか。
- heal pickupが見やすいか。
- heal pickupの寿命が短すぎる、長すぎる、または気にならないか。
- heal pickupのmagnet範囲が広すぎて、危険な回収判断を消していないか。
- HP満タン時の回収が自然か。
- Wave 3/Wave 4で緊張感が残っているか。
- 死因が理解できるか。
- 早死にが入力負荷、敵圧、routingミスのどれに近いか。
- `Space` がshoot以外の防御/回避actionに欲しい場面があるか。
- offscreen enemy indicatorで接近方向が読めるようになったか。

### Gate 3: Review Integration

実行すること:

- Item Design Reviewerの結果を `PH-V03-004` に反映する。
- Visual / QA Reviewerの結果を `PH-V03-006` の判断材料にする。
- Metrics / Debug Export Auditorの結果をplaytest reportに反映する。

完了条件:

- `PH-V03-003` へ渡す調整仮説が0-3個に絞られている。
- item実装前に必要な設計課題が見えている。
- v0.3 candidate前に残すQAリスクが整理されている。

### Gate 4: Heal Tuning Decision

判断:

- No tuning: 数値は据え置き、reportだけ残す。
- Light tuning: 1-2個のparameterだけ最小変更する。heal magnetを触る場合は、XP magnetと分離する設計要否も判断する。
- Presentation first: 数値ではなく視認性/feedbackだけ直す。
- Block candidate: 3 runsで同じ重大問題が出た場合、追加検証する。

調整対象:

- `healDropChance`
- `healDropPityThreshold`
- `healDropPityBonus`
- `healDropMaxChance`
- `healRatio`
- `healLifetime`
- `healMagnetRadius` またはpickup kind別magnet設計。ただし現行configには未分離のため、必要性が確認できた場合のみ別チケット化する。

### Gate 5: v0.3 Candidate

candidate条件:

- manual playtest reportがある。
- 必要なheal tuningが完了している、または不要と判断されている。
- `npm run typecheck` が通る。
- `npm test -- --run` が通る。
- `npm run test:e2e` が通る。
- `npm run build` が通る。
- 残リスクがP1/P2へ分類されている。

## 6. Sub-Agent Review Results

### 6.1 Item Design Reviewer

結論:

- 初回itemは `haste` 1種類に絞る。
- `Pickup.kind` は `"xp" | "heal" | "item"` の大分類に留める。
- itemの正体は `itemId` で持つ。
- 効果本体は `ItemDefinition` と `activeTemporaryEffects` に置く。
- `runtime.playerSpeedMultiplier` を直接書き換えて開始/終了時に割り戻す設計は避ける。

PM判断:

- `PH-V03-004` は実装ではなく、`docs/31-phaser-v03-item-system-requirements.md` に設計を固定する。
- `PH-V03-005` は `PH-V03-002` と `PH-V03-004` の後まで開始しない。

### 6.2 Visual / QA Reviewer

結論:

- heal pickupの現状visualは、XP、敵弾、敵、player bulletから概ね分離できている。
- `pickup.collected` は現状visual feedbackへ接続されていない。
- heal取得音はXPと同じ `pickup` cueで、種類ごとの取得実感は弱い可能性がある。
- ただし、PH-V03-002前の変更は不要。

PM判断:

- `PH-V03-006` は現時点では観察タスクとして扱う。
- 手動プレイで「拾えたか分からない」が出た場合だけ、短い白/薄緑リングなどの最小feedbackを検討する。
- 赤/pink系の追加発光、camera shake、派手なburst、HUD redesignは候補から外す。

### 6.3 Metrics / Debug Export Auditor

結論:

- PH-V03-002を開始するためのdebug exportは概ね十分。
- 事前のコード変更は不要。
- 不足し得る履歴情報は、初回playtestでは手動メモで補う。

不足し得るが初回では実装しない項目:

- `healPickupsSpawned`
- `healPickupsExpired`
- `firstHealSpawnAt`
- `firstHealCollectedAt`
- pickup残数のkind別内訳
- ラン全体のheal event timeline

PM判断:

- `docs/30-phaser-v03-playtest-report.md` に `HP at Stop`, `Heal Effective Rate`, `Low-HP Heal Route`, `Heal Visibility`, `Recent Heal Events` を追加する。
- 上記の不足項目は `PH-V03-007` またはitem KPI拡張時にまとめて検討する。

### 6.4 Controls / Active Skill Reviewer

結論:

- `PH-V03-002` 前に操作は変更しない。
- 現行input modelでは `Space`、left click、right clickをsimulation側で区別できない。
- `1`, `2`, `3` はupgrade choiceと衝突するため、skill slot化はactive skillが1つ成立してから検討する。
- offscreen enemy arrowはrenderer-onlyで、入力やsimulation rulesへ影響しない。

PM判断:

- 早死にの原因を、input overload、enemy pressure、routing mistake、heal tuning issueへ分類する。
- v0.4候補は `PH-V04-001 Auto-Fire With Mouse Aim Prototype`, `PH-V04-002 Defensive Dash Binding Spike`, `PH-V04-003 Right-Click Active Skill Input Split`, `PH-V04-004 Space Defensive Action Design` として整理する。
- `PH-V03-002` では、Space/right-click/dashは実装せず観察項目に留める。

### 6.5 Manual Playtest Ops Reviewer

結論:

- `PH-V03-002` は開始可能。
- ただしdev buildはdirty worktreeを含む可能性があるため、`HEAD` だけでなくdirty statusもrun metadataに残す。
- debug exportはPH-V03-002に十分だが、heal spawn/expireの全履歴はない。

PM判断:

- `docs/30-phaser-v03-playtest-report.md` に `Dirty Worktree?` を追加する。
- debug fixtureは使わず通常プレイで記録する。
- 数値はdebug exportから、低HP routing、入力負荷、矢印の有効性、Space/right-click欲求は人間メモから判断する。

## 7. 次の作業順

1. `docs/30-phaser-v03-playtest-report.md` を使って手動プレイ記録を開始する。
2. 3 runs分の所感とKPIを比較する。
3. heal tuningの要否を決める。
4. 必要なら `PH-V03-003` を小さく実装する。
5. 操作性の論点はv0.4候補へ送るか、v0.3 candidate blockerにするか分類する。
6. `PH-V03-010` のcandidate検証を実行する。
