---
title: "Legacy: Phaser Phase 7 Agent Task Briefs"
description: "Migrated from docs/20-phaser-phase7-agent-task-briefs.md."
---

> Source: `docs/20-phaser-phase7-agent-task-briefs.md`

# Phaser Phase 7 Agent Task Briefs

## 1. 対象

Phase 7: Screens and Release Shape

- `PH-GAME-601 Title Screen`
- `PH-GAME-602 Pause Menu`
- `PH-GAME-603 Result Screen`

## 2. 目的

プレイ開始、ポーズ、結果、再開、タイトル復帰の流れをゲームとして自然にする。

状態遷移はsimulationで扱い、画面表現はPhaser adapterに閉じる。

## 3. 実装済み状態

2026-06-20時点でPhase 7は実装済みである。

- `GameStatus` に `title` を追加した。
- `InputSnapshot` に `startPressed` と `quitToTitlePressed` を追加した。
- アプリ起動時はtitle screenを表示する。
- Debug `restart()` は既存E2E用途のため、fresh playing runへ直接入る。
- TitleはEnter、Space、クリックで開始できる。
- Pause中はresume、restart、title requestを扱う。
- Result screenはscore、time、level、kills、shotsを表示する。
- Visual regressionにtitle snapshotを追加した。

## 4. PH-GAME-601 Title Screen

### Scope

- `phaser/src/domain/types.ts`
- `phaser/src/simulation/stepWorld.ts`
- `phaser/src/adapters/phaser/ArenaScene.ts`
- `phaser/src/adapters/phaser/PhaserInputAdapter.ts`
- `phaser/src/adapters/phaser/PhaserArenaRenderer.ts`
- `phaser/tests/e2e/arena.spec.ts`
- `phaser/tests/e2e/arena-visual.spec.ts`

### Requirements

- 初期状態は `title` である。
- Title中はelapsed、spawn、shoot、enemy、pickupが進まない。
- Start入力で `playing` へ移行する。
- Start入力フレームでは同時に射撃しない。

### Acceptance Criteria

- E2Eで初期statusが `title` である。
- 1操作で `playing` へ遷移する。
- `game.started` eventが出る。
- Title visual snapshotが通る。

## 5. PH-GAME-602 Pause Menu

### Scope

- `phaser/src/simulation/stepWorld.ts`
- `phaser/src/adapters/phaser/ArenaScene.ts`
- `phaser/src/adapters/phaser/PhaserInputAdapter.ts`
- `phaser/src/adapters/phaser/PhaserArenaRenderer.ts`
- `phaser/tests/e2e/arena.spec.ts`
- `phaser/tests/e2e/arena-visual.spec.ts`

### Requirements

- Pause中はworld更新が止まる。
- Resumeで `playing` に戻る。
- Restartはfresh playing runを要求する。
- Quit to Titleはfresh title worldを要求する。

### Acceptance Criteria

- Pause中にmovement/shootでelapsedやplayer/bulletが進まない。
- ResumeがE2Eで確認できる。
- RestartがE2Eで確認できる。
- Quit to TitleがE2Eで確認できる。
- Pause visual snapshotが通る。

## 6. PH-GAME-603 Result Screen

### Scope

- `phaser/src/simulation/stepWorld.ts`
- `phaser/src/adapters/phaser/ArenaScene.ts`
- `phaser/src/adapters/phaser/PhaserArenaRenderer.ts`
- `phaser/tests/e2e/arena.spec.ts`
- `phaser/tests/e2e/arena-visual.spec.ts`

### Requirements

- Game Overはresult screenとして扱う。
- Resultにはscore、time、level、kills、shotsを表示する。
- Restartでfresh playing runへ戻る。
- Quit to Titleでfresh title worldへ戻る。

### Acceptance Criteria

- E2EでGame OverからRestartできる。
- Result visual snapshotが通る。
- Debug Snapshotのresult summaryが表示内容と整合する。

## 7. Verification

2026-06-20時点の検証結果:

- `npm run test`: 10 files, 56 tests passed
- `npm run typecheck`: passed
- `npm run build`: passed, with existing Phaser bundle-size warning
- `npm run test:e2e`: 11 Playwright tests passed
