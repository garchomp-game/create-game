---
title: "Legacy: Phaser Phase 6 Agent Task Briefs"
description: "Migrated from docs/19-phaser-phase6-agent-task-briefs.md."
---

> Source: `docs/19-phaser-phase6-agent-task-briefs.md`

# Phaser Phase 6 Agent Task Briefs

## 1. 対象

Phase 6: Presentation and UX

- `PH-GAME-501 Hit Feedback`
- `PH-GAME-502 Audio Event Hooks`
- `PH-GAME-503 HUD Refinement`

## 2. 目的

Simulationの純粋性を保ったまま、Phaser adapter層でゲームの手触りを上げる。

演出、音声hook、HUD表示はpresentation concernであり、domain/simulationへ表示専用stateを追加しない。

## 3. 実装済み状態

2026-06-20時点でPhase 6は最小実装済みである。

- `PhaserFeedbackLayer` を追加した。
- `PhaserAudioEventRouter` を追加した。
- `ArenaScene.recordResult()` が `GameEvent` をfeedback/audioへ渡す。
- `ArenaScene.update()` がfeedbackをtickする。
- `resetGame()` はfeedback/audio stateをリセットする。
- Debug Snapshotに `feedback` と `audioCues` を追加した。
- HUDはHP/LV/XP、Score/Time/Wave、Weapon/Enemiesの3行に整理した。
- Visual regression snapshotsは更新済みである。

## 4. PH-GAME-501 Hit Feedback

### Scope

- `phaser/src/adapters/phaser/ArenaScene.ts`
- `phaser/src/adapters/phaser/PhaserFeedbackLayer.ts`
- `phaser/src/vite-env.d.ts`
- `phaser/tests/e2e/arena.spec.ts`
- `phaser/tests/e2e/arena-visual.spec.ts`

### Requirements

- `enemy.hit` で短いimpact ringを出す。
- `enemy.killed` で撃破位置にburst particleを出す。
- `player.damaged` でdamage flashと短いcamera shakeを出す。
- Feedback stateはadapter層に閉じる。
- Simulation/domain型へ演出専用stateを追加しない。

### Acceptance Criteria

- 被弾時にdebug snapshotの `feedback.screenFlashAlpha` が正になる。
- kill burstやhit impactは時間経過で消える。
- reset時にfeedback stateとcamera FXが残らない。
- visual regressionが安定して通る。

## 5. PH-GAME-502 Audio Event Hooks

### Scope

- `phaser/src/adapters/phaser/ArenaScene.ts`
- `phaser/src/adapters/phaser/PhaserAudioEventRouter.ts`
- `phaser/src/vite-env.d.ts`
- `phaser/tests/e2e/arena.spec.ts`

### Requirements

- `shot.fired`, `enemy.hit`, `enemy.killed`, `pickup.collected`, `player.level_up`, `upgrade.selected`, `player.damaged`, `game.over` をaudio cueへmapする。
- audio assetが未登録ならno-opにする。
- cue設定はadapter-localに留める。
- 音源追加前でもheadless CIで警告や例外を出さない。

### Acceptance Criteria

- 射撃で `audioCues` に `shot` が入る。
- 被弾/game overで `damage` と `gameOver` が入る。
- upgrade選択で `upgrade` が入る。
- audio asset未登録でもE2Eが通る。

## 6. PH-GAME-503 HUD Refinement

### Scope

- `phaser/src/adapters/phaser/PhaserArenaRenderer.ts`
- `phaser/tests/e2e/arena-visual.spec.ts`

### Requirements

- HUDへHP、Score、Time、Level、XP、Weapon、Wave、Enemiesを表示する。
- 表示はCanvas内で完結する。
- HUDは主要overlayと不自然に重ならない。
- 文字量が増えても左上に収まる。

### Acceptance Criteria

- HUDにWaveが表示される。
- Visual regressionが更新されている。
- 初期、射撃、pause、game over、upgrade selectのsnapshotが通る。

## 7. Residual Refactor Candidate

HUDがさらに増える場合は `PhaserHud` を作り、`PhaserArenaRenderer` からHUD text生成を分離する。

現時点では変更量を抑えるため、Renderer内の `formatHud()` に留めている。

## 8. Verification

2026-06-20時点の検証結果:

- `npm run test`: 10 files, 54 tests passed
- `npm run typecheck`: passed
- `npm run build`: passed, with existing Phaser bundle-size warning
- `npm run test:e2e`: 10 Playwright tests passed
