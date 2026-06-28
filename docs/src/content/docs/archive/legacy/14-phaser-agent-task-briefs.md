---
title: "Legacy: Phaser版 Phase 1 サブエージェント作業票"
description: "Migrated from docs/14-phaser-agent-task-briefs.md."
---

> Source: `docs/14-phaser-agent-task-briefs.md`

# Phaser版 Phase 1 サブエージェント作業票

## 1. 目的

`docs/13-phaser-production-implementation-plan.md` の Phase 1: Game Flow Foundation を、サブエージェントへそのまま渡せる粒度に分解する。

対象チケット:

- `PH-GAME-001 Pause State`
- `PH-GAME-002 Result Summary`
- `PH-GAME-003 Game Stats`

この文書は作業票であり、ここでは実装しない。

## 1.1 実装後ステータス

この文書はPhase 1実装前に、サブエージェントへ渡せる粒度へ分解する目的で作成した。

2026-06-20時点で、メインエージェントが以下の順でPhase 1初期バッチを実装済みである。

1. `PH-GAME-001 Pause State`
2. `PH-GAME-003 Game Stats`
3. `PH-GAME-002 Result Summary`

そのため、以降の「現状整理」は作業票作成時点のスナップショットとして読む。

実装後の差分として、以下を採用している。

- Game仕様上のpauseは `WorldState.state.status: "paused"`、E2E固定用pauseは `ArenaScene.debugPaused` のまま分離した。
- Stats更新は `statsSystem` が `GameEvent[]` を読む後処理方式にした。shooting/combat側で直接statsを増やす設計ではないため、今後の変更で二重加算しないこと。
- Result Summaryは `WorldState` に固定保存せず、`createRunResultSummary(world)` で導出する純粋関数にした。debug `forceGameOver()` のように `game.over` eventを通らない経路でもsummaryを取得できる。
- Debug Snapshotは `stats` と `resultSummary` を返す。現状の `resultSummary` はgameOver中だけでなく、playing/paused中も現在値から導出できる。
- Debug固定停止中もR/P/Escの制御入力は0秒stepとして処理する。`debugPaused` をゲームpauseへ流用してはいけない。
- debug `forceDamage()` と `forceGameOver()` は `GameEvent` 記録へ寄せた。force経路を変更する場合も `lastEvents` とstatsの意味を壊さないこと。
- Game Over visual snapshotとpaused visual snapshotは更新済みである。

## 2. 現状整理

2026-06-20時点の `phaser/src` は以下の状態である。

- `GameStatus` は `playing | gameOver` のみ。
- `WorldState` は `state`, `player`, `bullets`, `enemies`, `obstacles`, `nextBulletId`, `nextEnemyId` を持つ。
- `InputSnapshot` は `move`, `aimWorld`, `shootHeld`, `restartPressed` を持つ。
- `stepWorld` は `gameOver` 中の `restartPressed` だけを特別扱いし、それ以外は `elapsed`, `shotTimer`, `damageCooldown` を進めて各systemを呼ぶ。
- `PhaserInputAdapter` は `WASD`, 矢印キー, `Space`, `R`, `F3` を扱う。
- `ArenaScene` にはE2E用の `debugPaused` があるが、これはゲーム仕様上のpauseではない。
- `PhaserArenaRenderer` はHUDとGame Over表示をCanvas内テキストで描画している。
- Debug Hookは `window.__ARENA_DEBUG__` に `getSnapshot`, `forceDamage`, `forceGameOver`, `restart`, `setPaused`, `step` を公開している。
- E2Eは `phaser/tests/e2e/arena.spec.ts`、visual regressionは `phaser/tests/e2e/arena-visual.spec.ts` にある。

## 3. 共通ルール

- Phaser依存は `phaser/src/adapters/phaser` に閉じる。
- `phaser/src/domain`, `phaser/src/simulation`, `phaser/src/math`, `phaser/src/format` にPhaser importを入れない。
- ゲームルールは `WorldState`, `InputSnapshot`, `GameEvent`, `SimulationConfig`, `src/simulation/systems` のどこに属するかを先に決める。
- UIや演出はadapter側で扱う。
- per-frame console logは増やさない。
- Debug Hookはdev専用を維持する。
- 画面に影響する変更はE2Eまたはvisual regressionを追加、更新する。
- `debugPaused` はテスト用の固定停止であり、`GameStatus: "paused"` と混同しない。
- 複数サブエージェントで同時に進める場合、`phaser/src/domain/types.ts`, `phaser/src/simulation/stepWorld.ts`, `phaser/src/simulation/createWorld.ts`, `phaser/src/simulation/stepWorld.test.ts`, `phaser/src/vite-env.d.ts` は競合しやすいので、統合順を明示してから着手する。

推奨統合順:

1. `PH-GAME-001 Pause State`
2. `PH-GAME-003 Game Stats`
3. `PH-GAME-002 Result Summary`

`docs/13` の初期バッチは `PH-GAME-001`, `PH-GAME-002`, `PH-GAME-003` だが、実装依存としてResult SummaryはStatsを参照するため、統合作業ではStatsを先に入れるのが安全である。
以降の詳細票も、チケット番号順ではなくこの推奨統合順で並べる。

## 4. PH-GAME-001 Pause State

### 目的

ゲーム仕様としてのpause状態を追加し、`P` または `Esc` で `playing` と `paused` を切り替えられるようにする。

pause中はシミュレーション時間、プレイヤー移動、射撃、弾、敵、スポーン、接触ダメージを進めない。一方で、描画、HUD、Debug Overlay、Debug Hookによる状態取得は継続する。

### 想定編集ファイル

- `phaser/src/domain/types.ts`
  - `GameStatus` に `paused` を追加する。
  - `InputSnapshot` に `pausePressed: boolean` を追加する。
  - 必要なら `GameEvent` に `game.paused`, `game.resumed` を追加する。
- `phaser/src/simulation/stepWorld.ts`
  - pause切り替えをシミュレーション更新より前に処理する。
  - `paused` 中はWorldを進めず、メトリクスだけ返す。
- `phaser/src/simulation/createWorld.ts`
  - 初期状態が `playing` のままであることを明示的に維持する。
- `phaser/src/adapters/phaser/PhaserInputAdapter.ts`
  - `P` と `Esc` のJustDownを `pausePressed` に反映する。
  - `Space` や矢印キーと同様、ブラウザ標準挙動が邪魔になる場合はcapture対象に追加する。
- `phaser/src/adapters/phaser/ArenaScene.ts`
  - `stepDebugWorld` の `InputSnapshot` 初期値に `pausePressed: false` を追加する。
  - `debugPaused` の意味を維持し、ゲームpauseと置き換えない。
  - Debug Snapshotに `status: "paused"` が自然に出ることを確認する。
- `phaser/src/adapters/phaser/PhaserArenaRenderer.ts`
  - paused用のオーバーレイまたはテキストを追加する。
  - Game Over表示とは別の表示状態にする。
- `phaser/src/vite-env.d.ts`
  - `InputSnapshot` 型変更に伴う型エラーが出る場合に追従する。
- `phaser/src/simulation/stepWorld.test.ts`
  - pause切り替え、pause中停止、resume後再開のテストを追加する。
- `phaser/tests/e2e/arena.spec.ts`
  - `P` または `Esc` によるpause/resume確認を追加する。
- `phaser/tests/e2e/arena-visual.spec.ts`
  - paused画面のvisual regressionを追加する。
- `phaser/tests/e2e/arena-visual.spec.ts-snapshots/*`
  - visual regressionを更新する場合のみ追加する。
- `phaser/IMPLEMENTATION_NOTES.md`
  - 実装時は `docs/11`, `docs/13` の運用に従い、要点と検証結果を追記する。

### 編集禁止/注意ファイル

- `docs/11-phaser-refactor-tickets.md`, `docs/13-phaser-production-implementation-plan.md`
  - PMから明示依頼がない限り変更しない。
- `phaser/src/adapters/phaser/ArenaScene.ts`
  - `debugPaused` はE2E固定停止用として残す。ゲームpauseの実装に流用しない。
- `phaser/src/simulation/systems/*`
  - pause中に各systemを呼ばない方針を基本にする。各system内へ個別にpause判定を散らさない。
- `phaser/src/config/*`
  - pauseキーやpause表示だけなら設定追加は不要。設定肥大化を避ける。
- `phaser/src/math/*`, `phaser/src/format/*`
  - pause実装では通常変更不要。

### 実装手順

1. `GameStatus` を `playing | paused | gameOver` に拡張する。
2. `InputSnapshot` に `pausePressed` を追加し、既存の `neutralInput` やDebug Hookのデフォルト入力をすべて追従させる。
3. `PhaserInputAdapter` に `pause` keyを追加し、`P` と `Esc` のJustDownをまとめて `pausePressed` にする。
4. `stepWorld` の冒頭で状態遷移を処理する。
   - `playing` かつ `pausePressed` なら `paused` にする。
   - `paused` かつ `pausePressed` なら `playing` に戻す。
   - `gameOver` 中は現行どおり `restartPressed` を扱い、pause切り替えは無視する。
5. `paused` 中は `elapsed`, `shotTimer`, `damageCooldown`, player, bullets, enemies, spawner, combatを更新しない。
6. `paused` 中も `collectResult` 相当のメトリクス収集を返す。`frame.raw_dt_ms` は実フレーム時間、`frame.dt_ms` は既存方針に合わせる。simulation停止を明確にしたい場合はテストでWorldの不変性を見る。
7. Rendererにpaused表示を追加する。
   - 既存のGame Over中央表示と競合しないよう、`pausedText` など別オブジェクトにする。
   - HUDは表示したままでよい。
8. E2Eで `P` を押してstatusが `paused` になり、一定時間待っても `elapsed` とplayer位置が変わらないことを確認する。
9. `P` を再度押して `playing` に戻り、移動または射撃が再開できることを確認する。
10. visual regressionにpaused画面を追加する。

### 受け入れ条件

- `GameStatus` に `paused` が追加され、型エラーがない。
- `P` または `Esc` で `playing` から `paused`、`paused` から `playing` に戻れる。
- pause中に `elapsed`, `shotTimer`, `damageCooldown`, player位置、bullet位置、enemy位置、enemy数が進まない。
- pause中に射撃キーを押しても新しいbulletが生成されない。
- pause中も画面描画、HUD、Debug Overlayの表示切り替え、Debug Snapshot取得ができる。
- Game Over中の `R` restartは既存どおり動く。
- `debugPaused` を使う既存visual regressionが壊れていない。

### 推奨テスト

- `phaser/src/simulation/stepWorld.test.ts`
  - `pausePressed` で `world.state.status` が `paused` になる。
  - `paused` 中に1秒stepしても `elapsed`, player位置, bullets, enemiesが変わらない。
  - `paused` 中に `pausePressed` で `playing` に戻る。
  - `gameOver` 中の `pausePressed` はrestart挙動に影響しない。
- `phaser/tests/e2e/arena.spec.ts`
  - `KeyP` でpause、snapshot statusが `paused`。
  - pause中に待機しても `elapsed` が増えない。
  - 再度 `KeyP` でresume、移動または射撃が再開する。
- `phaser/tests/e2e/arena-visual.spec.ts`
  - `window.__ARENA_DEBUG__?.restart()` 後、Debug Hookの `step({ pausePressed: true })` または実キー入力でpaused状態を作り、`arena-paused.png` を比較する。

検証コマンド:

```bash
cd phaser
npm run test
npm run typecheck
npm run build
npm run test:e2e
```

visual snapshot更新が必要な場合:

```bash
cd phaser
npm run test:e2e -- --update-snapshots
```

### サブエージェントへの依頼文テンプレート

```text
作業場所: /home/garchomp-game/workspace/create-game

PH-GAME-001 Pause Stateを実装してください。

参照:
- docs/13-phaser-production-implementation-plan.md
- docs/14-phaser-agent-task-briefs.md の PH-GAME-001
- phaser/src/domain/types.ts
- phaser/src/simulation/stepWorld.ts
- phaser/src/adapters/phaser/ArenaScene.ts
- phaser/src/adapters/phaser/PhaserInputAdapter.ts
- phaser/src/adapters/phaser/PhaserArenaRenderer.ts

要件:
- GameStatusに paused を追加する。
- InputSnapshotに pausePressed を追加する。
- P または Esc で playing/paused を切り替える。
- paused中はWorldのシミュレーションを進めない。
- debugPausedはE2E用の固定停止として残し、ゲームpauseに流用しない。
- paused画面のE2Eまたはvisual regressionを追加する。

禁止/注意:
- docs/11, docs/13を変更しない。
- Phaser importをdomain/simulation/math/formatへ入れない。
- pause判定を各systemへ散らさない。
- 実装範囲外の敵、武器、アップグレード機能は触らない。

完了前に以下を実行し、結果を報告してください。
- cd phaser && npm run test
- cd phaser && npm run typecheck
- cd phaser && npm run build
- cd phaser && npm run test:e2e
```

## 5. PH-GAME-003 Game Stats

### 目的

1回のrunに関する統計を `WorldState` に追加し、シミュレーション層でテストできる形にする。

必須統計:

- `shotsFired`
- `enemiesKilled`
- `damageTaken`
- `pickupsCollected`
- `upgradesChosen`

Result Summaryで被弾回数も表示する場合は、追加で `hitsTaken` を持たせる。`damageTaken` は受けたダメージ量、`hitsTaken` は被弾イベント回数として分ける。

### 想定編集ファイル

- `phaser/src/domain/types.ts`
  - `RunStats` 型を追加する。
  - `WorldState` に `stats: RunStats` を追加する。
  - 必要に応じて `GameEvent` を統計に使いやすい形へ拡張する。ただしper-frame eventは増やさない。
- `phaser/src/simulation/createWorld.ts`
  - run開始時のstats初期値を0で設定する。
- `phaser/src/simulation/systems/shootingSystem.ts`
  - 実際にbulletを生成したタイミングで `shotsFired` を増やす。
- `phaser/src/simulation/systems/combatSystem.ts`
  - enemy kill時に `enemiesKilled` を増やす。
  - player damage時に `damageTaken` と、採用する場合は `hitsTaken` を増やす。
- `phaser/src/simulation/stepWorld.ts`
  - stats更新は基本的に各systemで行う。イベント後処理で一括集計する設計にする場合は二重加算を防ぐ。
- `phaser/src/adapters/phaser/ArenaScene.ts`
  - Debug Snapshotに `stats` を含める。
- `phaser/src/vite-env.d.ts`
  - `ArenaDebugSnapshot` に `stats: RunStats` を追加する。
- `phaser/src/simulation/stepWorld.test.ts`
  - 統計更新のsimulation testを追加する。
- `phaser/IMPLEMENTATION_NOTES.md`
  - 実装時は要点と検証結果を追記する。

### 編集禁止/注意ファイル

- `phaser/src/adapters/phaser/PhaserArenaRenderer.ts`
  - PH-GAME-003単独では表示変更をしない。表示はPH-GAME-002に任せる。
- `phaser/tests/e2e/arena-visual.spec.ts`
  - PH-GAME-003単独では画面差分を増やさない。Debug Snapshot確認で十分。
- `phaser/src/config/*`
  - statsはrun状態であり設定値ではないため、通常変更不要。
- `phaser/src/simulation/systems/spawnSystem.ts`, `enemySystem.ts`, `bulletSystem.ts`
  - stats対象外の移動や寿命処理には触れない。
- `pickupsCollected`, `upgradesChosen`
  - 現時点でpickup/upgrade systemは存在しない。フィールドは0初期化だけ行い、未実装systemを先取りしない。

### 実装手順

1. `RunStats` 型を定義する。
   - 最低限 `shotsFired`, `enemiesKilled`, `damageTaken`, `pickupsCollected`, `upgradesChosen` をnumberで持つ。
   - Resultで被弾回数を表示するなら `hitsTaken` も追加する。
2. `WorldState` に `stats: RunStats` を追加する。
3. `createWorld` でstatsを0初期化する。
4. `updateShooting` でbulletを生成した直後に `world.stats.shotsFired += 1` する。
5. `resolveCombat` でenemyを撃破したタイミングに `world.stats.enemiesKilled += 1` する。
6. `resolveCombat` でplayerが接触ダメージを受けたタイミングにstatsを更新する。
   - `damageTaken` は実際に減ったHP量を加算するのが望ましい。
   - 現行コードは `world.state.hp -= config.enemy.damage` 後にGame Over側で0へ丸めるため、実装時は `hpBefore` と `hpAfter` を使って過剰ダメージを数えない。
7. `pickupsCollected` と `upgradesChosen` は現時点では0のまま維持し、将来のPH-GAME-301/303で加算する。
8. `ArenaScene.getSnapshot` にstatsのコピーを含める。
9. `vite-env.d.ts` のDebug Snapshot型を更新する。
10. `stepWorld.test.ts` に統計更新とrestart初期化のテストを追加する。

### 受け入れ条件

- `WorldState.stats` が存在し、新規run開始時にすべて0で初期化される。
- 実際に弾が生成されたときだけ `shotsFired` が増える。cooldown中やpause中には増えない。
- 敵撃破時に `enemiesKilled` が増える。
- プレイヤーがダメージを受けたときに `damageTaken` が増える。
- 接触ダメージcooldown中はstatsが二重加算されない。
- `pickupsCollected` と `upgradesChosen` は初期値0で保持され、未実装機能を仮実装しない。
- Debug Snapshotからstatsを取得できる。
- PH-GAME-001が入っている場合、paused中にstatsが増えない。

### 推奨テスト

- `phaser/src/simulation/stepWorld.test.ts`
  - `shootHeld: true` でbullet生成時に `stats.shotsFired` が1増える。
  - shot cooldown中に追加stepしても `stats.shotsFired` が増えない。
  - bulletでenemyを倒すと `stats.enemiesKilled` が1増える。
  - player contact damageで `stats.damageTaken` が実HP減少量だけ増える。
  - damage cooldown中の連続stepで `damageTaken` が二重加算されない。
  - `createWorld` し直すとstatsが0へ戻る。
  - PH-GAME-001後なら、paused中のshoot/damageでstatsが増えない。
- `phaser/tests/e2e/arena.spec.ts`
  - 必須ではないが、Debug Snapshotに `stats` が含まれることを軽く確認してもよい。

検証コマンド:

```bash
cd phaser
npm run test
npm run typecheck
npm run build
```

Debug SnapshotをE2Eで触った場合:

```bash
cd phaser
npm run test:e2e
```

### サブエージェントへの依頼文テンプレート

```text
作業場所: /home/garchomp-game/workspace/create-game

PH-GAME-003 Game Statsを実装してください。

参照:
- docs/13-phaser-production-implementation-plan.md
- docs/14-phaser-agent-task-briefs.md の PH-GAME-003
- phaser/src/domain/types.ts
- phaser/src/simulation/createWorld.ts
- phaser/src/simulation/systems/shootingSystem.ts
- phaser/src/simulation/systems/combatSystem.ts
- phaser/src/simulation/stepWorld.test.ts
- phaser/src/adapters/phaser/ArenaScene.ts
- phaser/src/vite-env.d.ts

要件:
- WorldStateにrun統計を追加する。
- shotsFired, enemiesKilled, damageTaken, pickupsCollected, upgradesChosenを持たせる。
- Result Summary用に被弾回数が必要なら hitsTaken も追加する。
- 実際のshot/kill/damage時だけ統計を増やす。
- pickupsCollected/upgradesChosenは今は0初期化のみ。pickup/upgrade機能は実装しない。
- Debug Snapshotからstatsを取得できるようにする。

禁止/注意:
- Rendererやvisual regressionは原則触らない。表示はPH-GAME-002の範囲。
- Phaser importをdomain/simulation/math/formatへ入れない。
- statsをGameEvent後処理とsystem内更新の両方で二重加算しない。
- 敵種、武器種、pickup、upgrade本体は実装しない。

完了前に以下を実行し、結果を報告してください。
- cd phaser && npm run test
- cd phaser && npm run typecheck
- cd phaser && npm run build
- Debug SnapshotのE2Eを変更した場合は cd phaser && npm run test:e2e
```

## 6. PH-GAME-002 Result Summary

### 目的

Game Over時にrun結果を整理し、Debug SnapshotとCanvas表示から確認できるようにする。

表示候補:

- 生存時間
- スコア
- 撃破数
- 被弾回数または被ダメージ量
- 発射数

PH-GAME-003が提供する `WorldState.stats` を参照する。PH-GAME-003が未統合の場合は、先にStatsを統合するか、同一ブランチ内でStatsを実装してからResult Summaryを仕上げる。

### 想定編集ファイル

- `phaser/src/domain/types.ts`
  - `ResultSummary` 型を追加する。
  - `WorldState` または `GameState` に `resultSummary: ResultSummary | null` を追加する。
  - `GameEvent` の `game.over` に `result` を含める、または結果取得に必要な統計フィールドを含める。
- `phaser/src/simulation/createWorld.ts`
  - `resultSummary` を `null` で初期化する。
- `phaser/src/simulation/systems/gameOverSystem.ts`
  - `gameOver` へ遷移した瞬間に `ResultSummary` を作成して固定する。
  - すでに `gameOver` の場合は再作成しない。
- `phaser/src/simulation/stepWorld.ts`
  - Game Over中に結果が変化しないことを維持する。
  - restart requestの既存挙動を壊さない。
- `phaser/src/adapters/phaser/PhaserArenaRenderer.ts`
  - Game Over表示をResult Summary表示へ拡張する。
  - `formatTime` を使い、既存のCanvas内表示に合わせる。
- `phaser/src/adapters/phaser/ArenaScene.ts`
  - Debug Snapshotに `resultSummary` を含める。
  - `logEvent` で `game.over` を記録する場合はresultを過不足なくログに含める。ただし詳細ログを毎フレーム出さない。
- `phaser/src/vite-env.d.ts`
  - `ArenaDebugSnapshot` に `resultSummary` を追加する。
- `phaser/src/simulation/stepWorld.test.ts`
  - Game Over時のresult固定とrestart初期化のテストを追加する。
- `phaser/tests/e2e/arena.spec.ts`
  - Game Over後にresultがDebug Snapshotで取得でき、画面にも表示されることを確認する。
- `phaser/tests/e2e/arena-visual.spec.ts`
  - Game Over result表示を含むvisual regressionを追加または既存 `arena-game-over.png` を更新する。
- `phaser/tests/e2e/arena-visual.spec.ts-snapshots/*`
  - visual regressionを更新する場合のみ変更する。
- `phaser/IMPLEMENTATION_NOTES.md`
  - 実装時は要点と検証結果を追記する。

### 編集禁止/注意ファイル

- `phaser/src/config/*`
  - Result Summaryの表示項目だけなら設定追加は不要。
- `phaser/src/adapters/phaser/PhaserInputAdapter.ts`
  - Result Summary単独では入力追加は不要。Restartは既存の `R` を使う。
- `phaser/src/simulation/systems/shootingSystem.ts`, `combatSystem.ts`
  - stats未実装ならPH-GAME-003として扱う。Result Summaryだけの変更で統計加算ロジックを中途半端に入れない。
- `phaser/src/adapters/phaser/ArenaScene.ts`
  - Result画面のためにSceneへ集計ロジックを置かない。結果生成はsimulation層で行う。
- `phaser/src/math/*`, `phaser/src/format/time.ts`
  - 既存の `formatTime` を使う。時間フォーマットの仕様変更は別チケットにする。

### 実装手順

1. `ResultSummary` 型を定義する。
   - 例: `score`, `elapsed`, `enemiesKilled`, `shotsFired`, `damageTaken`, `pickupsCollected`, `upgradesChosen`。
   - `hitsTaken` をPH-GAME-003で追加した場合は含める。
2. `WorldState` または `GameState` に `resultSummary: ResultSummary | null` を追加する。
   - 推奨は `WorldState.resultSummary`。run全体の集計として `state.status` から少し離せる。
3. `createWorld` で `resultSummary: null` を初期化する。
4. `updateGameOver` でHPが0になり、初めて `gameOver` へ遷移する瞬間にResult Summaryを作成する。
   - `elapsed` と `score` はその瞬間の値で固定する。
   - statsは浅いコピーにして、Game Over後に参照値が変わらないようにする。
5. `game.over` eventに `result` を含める。
   - 既存の `score`, `elapsed` を残すか、`result` に集約するかは型の読みやすさで決める。
   - 既存テストへの影響を小さくするなら `score`, `elapsed`, `result` を併存させる。
6. RendererのGame Over表示をResult Summaryへ拡張する。
   - 既存の `GAME OVER`, `Score`, `Time`, `Press R to Restart` は維持する。
   - `Kills`, `Shots`, `Damage` などを追加する。
   - テキストがCanvas中央で重なりすぎる場合はfont sizeやlineSpacingを調整する。
7. Debug Snapshotに `resultSummary` を追加する。
   - playing/paused中は `null`。
   - gameOver後はResult Summaryを返す。
8. E2Eで `forceGameOver` 後に `resultSummary` が非nullであることを確認する。
9. visual regressionのGame Over画像をResult Summary込みにする。

### 受け入れ条件

- Game Overへ遷移した時点で `resultSummary` が作成される。
- `resultSummary` はDebug Snapshotから取得できる。
- CanvasのGame Over表示に生存時間、スコア、撃破数、発射数、被ダメージ量または被弾回数が表示される。
- Game Over後に時間が進まず、Result Summaryが変化しない。
- `R` restart後は `resultSummary` が `null` に戻り、statsも0へ戻る。
- `game.over` eventからresult情報を取得できる。
- 既存のGame Over/restart E2Eが通る。

### 推奨テスト

- `phaser/src/simulation/stepWorld.test.ts`
  - HPが0になったstepで `world.state.status` が `gameOver` になり、`resultSummary` が作成される。
  - `resultSummary.score` と `resultSummary.elapsed` がGame Over瞬間の値になる。
  - `resultSummary` にStats由来の `enemiesKilled`, `shotsFired`, `damageTaken` が入る。
  - Game Over後に追加stepしても `resultSummary` が変わらない。
  - restart相当で `createWorld` し直すと `resultSummary` が `null` に戻る。
- `phaser/tests/e2e/arena.spec.ts`
  - `forceGameOver()` 後、snapshotの `resultSummary` が非null。
  - 画面に `GAME OVER`, `Score`, `Time`, `Kills`, `Shots` などが表示されることを確認する。Canvas内テキストのDOM検出はできないため、Debug Snapshot確認とvisual regressionを組み合わせる。
  - `R` restart後、snapshotの `resultSummary` が `null`。
- `phaser/tests/e2e/arena-visual.spec.ts`
  - 既存 `arena-game-over.png` をResult Summary表示込みに更新するか、別名 `arena-result-summary.png` を追加する。

検証コマンド:

```bash
cd phaser
npm run test
npm run typecheck
npm run build
npm run test:e2e
```

visual snapshot更新が必要な場合:

```bash
cd phaser
npm run test:e2e -- --update-snapshots
```

### サブエージェントへの依頼文テンプレート

```text
作業場所: /home/garchomp-game/workspace/create-game

PH-GAME-002 Result Summaryを実装してください。

参照:
- docs/13-phaser-production-implementation-plan.md
- docs/14-phaser-agent-task-briefs.md の PH-GAME-002
- phaser/src/domain/types.ts
- phaser/src/simulation/systems/gameOverSystem.ts
- phaser/src/simulation/createWorld.ts
- phaser/src/adapters/phaser/PhaserArenaRenderer.ts
- phaser/src/adapters/phaser/ArenaScene.ts
- phaser/src/vite-env.d.ts
- phaser/tests/e2e/arena.spec.ts
- phaser/tests/e2e/arena-visual.spec.ts

前提:
- PH-GAME-001 Pause Stateが統合済みであること。
- PH-GAME-003 Game Statsが統合済み、または同一作業内で先にStatsを実装済みであること。

要件:
- Game Over時にResultSummaryを作成し、WorldStateに保持する。
- ResultSummaryには生存時間、スコア、撃破数、発射数、被ダメージ量または被弾回数を含める。
- game.over eventまたはDebug Snapshotからresult情報を取得できるようにする。
- CanvasのGame Over表示をResult Summary表示へ拡張する。
- Restart後はresultSummaryとstatsが初期化される。

禁止/注意:
- Result集計ロジックをArenaSceneへ置かない。simulation層で作る。
- Phaser importをdomain/simulation/math/formatへ入れない。
- 入力追加、タイトル画面、Pause Menu、Result Screenの本格メニュー化はこのチケットでは行わない。
- DOM UIフレームワークを導入しない。

完了前に以下を実行し、結果を報告してください。
- cd phaser && npm run test
- cd phaser && npm run typecheck
- cd phaser && npm run build
- cd phaser && npm run test:e2e
```

## 7. 競合回避メモ

同時に複数エージェントへ依頼する場合の分担目安:

- `PH-GAME-001` は入力、状態遷移、Renderer、E2E/visualを触るため、先に単独で統合する。
- `PH-GAME-003` はdomain/simulation中心。Rendererやvisualへ広げない。
- `PH-GAME-002` はRendererとDebug Snapshotを触るため、Stats統合後に実施する。

避けたい並行作業:

- `PH-GAME-001` と `PH-GAME-003` が同時に `InputSnapshot` や `neutralInput` を更新する。
- `PH-GAME-002` と `PH-GAME-003` が同時に `WorldState` のstats/result型を別々に設計する。
- `PH-GAME-002` がStats未統合のまま独自にイベント履歴から結果を集計する。

PM側で並行依頼する場合は、先に `PH-GAME-001` を完了させ、その後 `PH-GAME-003` と `PH-GAME-002` の順で統合する。
