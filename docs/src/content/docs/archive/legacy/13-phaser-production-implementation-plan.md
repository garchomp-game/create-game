---
title: "Legacy: Phaser版 本実装計画"
description: "Migrated from docs/13-phaser-production-implementation-plan.md."
---

> Source: `docs/13-phaser-production-implementation-plan.md`

# Phaser版 本実装計画

## 1. 目的

`Arena Core` のPhaser版を、リファクタリング済みプロトタイプから、反復開発できる小規模な完成ゲームへ引き上げる。

今回の本実装では、単に機能を増やすのではなく、以下を維持する。

- Phaser依存はadapter層へ閉じ込める
- ゲームルールはsimulation層でテストできる
- 設定値はZod schemaで検証する
- 画面に影響する変更はPlaywrightまたはvisual regressionで確認する
- 本実装の各段階で `npm run test`, `npm run typecheck`, `npm run build`, `npm run test:e2e` を通す

## 2. 完成目標

本実装の当面の完成目標は `Arena Core v1` とする。

`Arena Core v1` は、以下を満たす1画面アリーナ・サバイバルゲームである。

- タイトルまたは即時開始からプレイできる
- ポーズできる
- 複数種類の敵が出現する
- 複数種類の武器または弾挙動がある
- 敵撃破で経験値またはアイテムが出る
- 一定条件でアップグレードを選べる
- 時間経過でウェーブ/難易度が変化する
- Game Over後に結果を確認して再開できる
- Debug OverlayとE2E用Debug Hookを維持する

## 3. スコープ

### 3.1 v1必須

- Pause state
- Enemy type system
- Weapon type system
- Pickup/XP system
- Level-up upgrade selection
- Wave director
- Result summary
- Minimal effects
- Audio hookのためのイベント設計
- 追加機能ごとのUnit/Simulation/E2E/Visual test

### 3.2 v1では任意

- 外部画像アセット
- BGM
- セーブデータ
- 設定画面
- キーコンフィグ
- モバイル操作
- オンラインランキング
- Sentry等の本番監視

### 3.3 v1では避ける

- ECS全面導入
- Arcade Physics/Matterへの主物理移行
- React/Vue等のUIフレームワーク導入
- 大規模なアセット制作
- 複数ステージの同時実装

## 4. 実装方針

### 4.1 データ駆動に寄せる

敵、武器、アップグレード、ウェーブは設定として持つ。

最初はTypeScript定数でよい。外部JSON化は、バランス調整やステージ追加が増えてから行う。

### 4.2 システム単位で増やす

新機能は原則として `src/simulation/systems` にsystemを追加する。

例:

- `pauseSystem`
- `enemyTypeSystem`
- `weaponSystem`
- `pickupSystem`
- `upgradeSystem`
- `waveSystem`

Scene側は入力、描画、Debug Hook、ログ/メトリクス接続に留める。

### 4.3 まず状態遷移を固める

敵や武器を増やす前に、`playing`, `paused`, `upgradeSelect`, `gameOver` の状態遷移を固める。

理由:

- 追加機能は状態遷移に影響する
- E2Eで安定して停止状態を作れる
- Level-upやResult画面の前提になる

## 5. フェーズ計画

## Phase 1: Game Flow Foundation

目的:

ゲーム状態遷移を拡張し、今後の機能追加時に止める、再開する、選択する、結果を見る基盤を作る。

### PH-GAME-001 Pause State

内容:

- `GameStatus` に `paused` を追加
- `InputSnapshot` に `pausePressed` を追加
- `P` または `Esc` でpause切り替え
- pause中は時間、敵、弾、スポーンを進めない
- pause中もDebug Overlayは表示可能にする

受け入れ条件:

- Unit/Simulation testでpause中にWorldが進まない
- E2Eで `P` によるpause/resumeを確認できる
- Visual regressionにpaused画面を追加する

### PH-GAME-002 Result Summary

内容:

- Game Over時の結果情報を整理する
- 生存時間、スコア、撃破数、被弾回数、発射数を表示候補にする
- `GameEvent` に統計収集しやすいイベントを追加する

受け入れ条件:

- Game Over debug snapshotでresult情報を取得できる
- E2EでGame Over result表示を確認できる
- visual regressionにresult表示を含める

### PH-GAME-003 Game Stats

内容:

- `WorldState` にrun統計を追加する
- shots fired
- enemies killed
- damage taken
- pickups collected
- upgrades chosen

受け入れ条件:

- Simulation testで各イベント時にstatsが更新される
- Result Summaryがstatsを参照する

## Phase 2: Enemy Variety

目的:

敵タイプをデータ駆動で増やし、ゲームプレイの変化を作る。

実装メモ:

- 2026-06-20に `PH-GAME-101` から `PH-GAME-104` まで実装した。
- `config.enemy` は `config.enemies` へ移行し、`chaser`, `brute`, `fast`, `ranged` を型定義として持つ。
- `brute` と `fast` は敵タイプ定義とspawn重み/解禁時間で扱う。
- `ranged` は距離維持を `enemySystem`、敵弾の移動/寿命を `enemyProjectileSystem`、被弾判定を `combatSystem` へ分離した。
- 敵弾は既存player bulletへ混ぜず、`WorldState.enemyProjectiles` として分けている。Phase 3のprojectile modelで統合余地を再検討する。
- Debug Snapshotは `enemyTypeCounts` と `enemyProjectileCount` を返す。

### PH-GAME-101 Enemy Type Model

内容:

- `EnemyTypeId` を追加
- enemy configを単一値から敵タイプ定義へ拡張
- 既存敵は `chaser` として移行

受け入れ条件:

- 既存挙動が `chaser` で維持される
- Zod schemaがenemy type configを検証する
- 既存テストが通る

### PH-GAME-102 Brute Enemy

内容:

- HPが高く、移動が遅い敵
- 撃破スコアと経験値を高くする

受け入れ条件:

- 2発以上で倒れることをSimulation testで確認
- スコア/XPがタイプ別に加算される

### PH-GAME-103 Fast Enemy

内容:

- HPは低いが移動が速い敵
- 中盤以降に出現する

受け入れ条件:

- wave/difficulty条件で出現する
- E2EまたはSimulationで出現分布を確認する

### PH-GAME-104 Ranged Enemy

内容:

- 一定距離で停止または減速
- プレイヤー方向へ敵弾を撃つ

受け入れ条件:

- 敵弾とプレイヤーの衝突をSimulation testで確認
- 敵弾が障害物または寿命で消える

## Phase 3: Weapons and Combat Growth

目的:

武器と弾挙動をデータ駆動化し、アップグレードの土台を作る。

実装メモ:

- 2026-06-20に `PH-GAME-201` から `PH-GAME-204` まで実装した。
- `config.bullet` は `config.weapons` へ移行し、`pulse`, `spread`, `pierce` を定義した。
- `pulse` は既存射撃の回帰維持、`spread` は複数弾、`pierce` は `pierceRemaining` と `hitEnemyIds` による複数敵命中として扱う。
- `shot.fired`, `enemy.hit`, `enemy.killed` eventは `weaponType` を持つ。
- `RunStats.weaponMetrics` で武器別の発射数、命中数、撃破数を収集する。
- 敵弾との配列統合は見送り、Phase 3ではplayer bulletのみを武器モデル化した。

### PH-GAME-201 Weapon Type Model

内容:

- `WeaponTypeId` を追加
- 武器定義をconfigへ追加
- 既存射撃を `pulse` として移行

受け入れ条件:

- 既存射撃挙動が維持される
- Zod schemaがweapon configを検証する
- cooldown/damage/projectile speedをテストできる

### PH-GAME-202 Spread Weapon

内容:

- 複数方向へ弾を撃つ
- 近距離向き

受け入れ条件:

- 1回の射撃で複数弾が生成される
- 弾角度が期待範囲に入る

### PH-GAME-203 Piercing Projectile

内容:

- 一定回数まで敵を貫通する弾
- `pierceRemaining` を弾に持たせる

受け入れ条件:

- 複数敵に命中できる
- 貫通回数が0になったら消える

### PH-GAME-204 Weapon Metrics

内容:

- 武器ごとの発射数、命中数、撃破数をメトリクス候補にする

受け入れ条件:

- Debug SnapshotまたはMetricsから確認できる
- per-frameログは増やさない

## Phase 4: Pickups and Upgrades

目的:

敵撃破から成長までのゲームループを作る。

実装メモ:

- 2026-06-20に `PH-GAME-301` から `PH-GAME-304` まで実装した。
- XPは敵撃破時に直接加算せず、`enemy.killed` の `xpAwarded` からXP pickupを生成し、`pickup.collected` で加算する。
- `upgradeSelect` は `paused` とは別の停止状態として扱い、選択入力だけを処理する。
- Upgrade定義はconfig/Zodへ追加し、効果は `WorldState.runtime` へ反映する。`SIMULATION_CONFIG` は変更しない。
- Upgrade定義は `maxRank` と `weight` を持ち、`WorldState.progression.upgradeRanks` でrankを管理する。
- max rank到達済みupgradeは候補から除外し、選択時は `upgrade.selected` eventをemitする。
- Upgrade UIはCanvas内Phaser Textで表示し、DOM overlayは使わない。
- Upgrade UIには現在rank/最大rankを表示する。
- pickup配置は近傍探索後にarena全域をグリッド走査し、空きがある限り障害物外へ出す。
- Debug Hookは `grantXp()` と `forceUpgradeSelect()` を持ち、E2Eでlevel upとupgrade選択を固定確認できる。

### PH-GAME-301 Pickup Model

内容:

- `Pickup` entityを追加
- XP gemを追加
- プレイヤー接触で回収

受け入れ条件:

- 敵撃破時にpickupが出る
- 回収でXPが増える
- pickupは障害物に埋まらない

### PH-GAME-302 Level System

内容:

- XPとlevelをWorldStateへ追加
- 一定XPでlevel up
- `upgradeSelect` 状態へ遷移

受け入れ条件:

- XP閾値でlevelが上がる
- `upgradeSelect` 中はWorld更新が止まる
- E2Eで強制level upを確認できる

### PH-GAME-303 Upgrade Definitions

内容:

- 攻撃速度上昇
- 弾速上昇
- 最大HP上昇
- 移動速度上昇
- 追加弾または貫通追加

受け入れ条件:

- Zod schemaでupgrade configを検証
- `maxRank` と `weight` が不正なupgrade configは拒否される
- max rankに達したupgradeは候補に出ない
- 選択したupgradeが次の戦闘へ反映される
- `upgrade.selected` eventからstatsが更新される

### PH-GAME-304 Upgrade UI

内容:

- CanvasまたはDOMで3択UIを表示
- キーボードまたはクリックで選択

受け入れ条件:

- E2Eでupgrade選択できる
- 候補にrankが表示される
- visual regressionにupgrade select画面を追加する

## Phase 5: Wave Director and Balance

目的:

時間経過に応じた敵構成、出現数、難易度の変化を定義する。

実装メモ:

- 2026-06-20に `PH-GAME-401` から `PH-GAME-403` まで実装した。
- `config.waves` を追加し、spawn interval、speed multiplier、max enemies、spawn budget、enemy weightsをwave bandへ集約した。
- 敵定義から出現weight/unlock timingを外し、静的性能値と `spawnCost` だけを残した。
- 旧 `difficulty.ts` は値を持たず、`getWaveDifficulty(config, elapsed)` の互換ラッパーにした。
- Zod schemaでwave start昇順、first wave start 0、空weight禁止、weighted enemyがspawn budget内に収まることを検証する。
- 60秒固定simulation testはlate wave到達を明示し、敵数、弾数、spawn数の上限を確認する。
- Debug snapshotとmetricsに現在wave情報を出し、バランス調整時に追えるようにした。
- Phase 5後の検証結果: `npm run test` 54件、`npm run typecheck`、`npm run build`、`npm run test:e2e` 10件が通過した。
- v0.2ではwave curveを4段階へ分け、60秒帯をranged導入、90秒以降を持久戦圧にした。
- v0.2では `balanceProbe` でwave開始後10秒の被弾を記録し、境界直後の急激な理不尽化を確認できるようにした。
- v0.2 wave reviewの詳細は `docs/23-phaser-v02-wave-curve-review.md` に残した。

### PH-GAME-401 Wave Config

内容:

- wave band定義をconfigへ追加
- 時間帯ごとの敵タイプ重みを設定
- 既存difficultyをwave directorへ統合

受け入れ条件:

- 固定seedで出現順をテストできる
- 既存難易度上昇と矛盾しない
- 難易度値の情報源が `config.waves` に一本化されている

### PH-GAME-402 Spawn Budget

内容:

- 敵タイプごとにspawn costを設定
- 1回のspawnでbudget内の敵を出す

受け入れ条件:

- max enemiesを超えない
- brute等の重い敵が過剰に出ない
- weightがある敵は、そのwaveのbudget内でspawn可能である

### PH-GAME-403 Balance Simulation Tests

内容:

- 固定入力なしで60秒進める
- 敵数、弾数、spawn数が上限内か検証

受け入れ条件:

- 60秒シミュレーションが高速に完了する
- late waveに到達している
- 敵数/弾数/イベント数の上限を超えない

## Phase 6: Presentation and UX

目的:

ゲームとしての手触りを上げる。ただし演出はsimulationへ入れない。

実装メモ:

- 2026-06-20に `PH-GAME-501` から `PH-GAME-503` まで最小実装した。
- `PhaserFeedbackLayer` を追加し、`enemy.hit`, `enemy.killed`, `player.damaged` eventからimpact ring、kill burst、damage flash/camera shakeを出す。
- `PhaserAudioEventRouter` を追加し、shot/hit/kill/pickup/level up/upgrade/damage/game over eventをaudio cueへmapする。
- audio assetが未登録の場合はno-opにし、音源なしでもE2E/headlessで警告や例外が出ないようにした。
- HUDはHP/LV/XP、Score/Time/Wave、Weapon/Enemiesの3行へ整理した。
- Debug Snapshotにfeedback状態とaudio cue履歴を追加し、E2Eでhook動作を確認できるようにした。
- visual regressionはHUD変更後のsnapshotへ更新済みである。
- 今後HUDがさらに増える場合は、`PhaserHud` へ分離する余地を残している。

### PH-GAME-501 Hit Feedback

内容:

- ヒット時の短いフラッシュ
- 撃破時の簡易パーティクル
- 被弾時の画面揺れ

受け入れ条件:

- `GameEvent` をPhaser adapter側で購読または処理する
- simulationは演出を知らない
- E2E/debug snapshotでfeedback stateを確認できる

### PH-GAME-502 Audio Event Hooks

内容:

- shot/hit/kill/damage/game over用のaudio hookを作る
- 実音源は後回しでもよい

受け入れ条件:

- 音声再生が未設定でもゲームが動く
- adapter層だけに閉じる
- audio cue履歴をdebug snapshotで確認できる

### PH-GAME-503 HUD Refinement

内容:

- HP、Score、Time、Level、XP、Weapon、Waveを整理して表示

受け入れ条件:

- HUDがCanvas内で重ならない
- WaveがHUDへ表示される
- visual regressionを更新する

## Phase 7: Screens and Release Shape

目的:

プレイ開始、ポーズ、結果、再開の流れをゲームとして自然にする。

実装メモ:

- 2026-06-20に `PH-GAME-601` から `PH-GAME-603` まで実装した。
- `GameStatus` に `title` を追加し、アプリ起動時はTitle Screenから始まる。
- `InputSnapshot` に `startPressed` と `quitToTitlePressed` を追加した。
- TitleはEnter、Space、クリックの1操作でPlayingへ遷移する。
- Pause中はResume、Restart、Titleのメニュー状態として扱う。
- Game Over overlayはResult ScreenとしてScore、Time、Level、Kills、Shotsを表示する。
- `game.started` と `game.title.requested` eventを追加し、Scene側でRestart/TitleのWorld再生成を行う。
- Title背景は不透明にし、arena stageと誤認しないようにした。
- Title、Pause、Result、Upgradeはボタン矩形を描画し、クリック選択できるようにした。
- E2EはTitle start、Pause resume/restart/quit-to-title、Result restartを確認する。
- visual regressionはTitleを追加し、Pause/Resultのsnapshotを更新した。
- Phase 7後の検証結果: `npm run test` 56件、`npm run typecheck`、`npm run build`、`npm run test:e2e` 11件が通過した。

### PH-GAME-601 Title Screen

内容:

- Start
- Controls
- Library label

受け入れ条件:

- E2EでStartできる
- 1操作でゲーム開始できる
- visual regressionにtitle screenを追加する

### PH-GAME-602 Pause Menu

内容:

- Resume
- Restart
- Quit to Title

受け入れ条件:

- E2EでResume/Restartを確認
- Quit to Titleを確認できる

### PH-GAME-603 Result Screen

内容:

- Score
- Time
- Level
- Kills
- Restart

受け入れ条件:

- E2EでGame OverからRestartできる
- visual regressionにresult screenを追加

## Phase 8: Balance and Aim Polish

目的:

プレイ済みフィードバックを受け、ゲームとしての取り回しを改善する。simulationで扱うバランス値と、adapterで扱う視認性改善を分離する。

実装メモ:

- 2026-06-20にXP pickupの吸引とマウス照準表示を追加した。
- `SimulationConfig.pickup` に `magnetRadius` と `magnetSpeed` を追加し、Zod schemaで検証する。
- `pickupSystem` はspawn、吸引、collectionを同じsystem内に収め、collection前に近距離pickupをplayer方向へ移動させる。
- pickup吸引はsimulation層の純粋な座標更新として扱い、Phaser adapterへ物理処理を漏らさない。
- Phaser側はbrowser cursorを隠し、canvas上にreticle cursorを描画する。
- 照準線はplayerから現在のpointer位置へ伸ばし、pointerがない場合は最後のaim方向を使う。
- UI/描画影響として、mouse cursor aimのvisual regressionを追加した。
- Phase 8後の検証結果: `npm run test` 57件、`npm run typecheck`、`npm run build`、`npm run test:e2e` 12件が通過した。

### PH-GAME-701 Pickup Magnet

内容:

- playerから一定距離内のXP pickupを自動吸引する
- 吸引半径と速度はconfigで調整できるようにする

受け入れ条件:

- Simulation testで近距離pickupがplayerへ近づく
- 吸引範囲外のpickupは動かない
- pickup collection statsは従来どおりpickup.collected eventから更新される

### PH-GAME-702 Cursor and Aim Guide

内容:

- browser cursorを非表示にし、canvas内に見やすいreticleを描画する
- playerからpointer方向へ照準線を出す

受け入れ条件:

- pointer移動後のcursor/aim guideがvisual regressionで確認できる
- title/gameOverでは不要な照準線を出さない
- simulation層へPhaser入力/描画依存を入れない

## 6. 実装順序

最初の本実装バッチは以下にする。

1. PH-GAME-001 Pause State
2. PH-GAME-003 Game Stats
3. PH-GAME-002 Result Summary

この3つを先に入れる理由:

- 状態遷移を先に固めると、敵/武器/アップグレード追加時の影響範囲が読みやすい
- ResultとStatsは今後のバランス確認に必要
- E2Eとvisual regressionの基準を増やせる

実装メモ:

- 2026-06-20にPhase 1の初期バッチを `PH-GAME-001 -> PH-GAME-003 -> PH-GAME-002` の順で実装した。
- Result SummaryはStatsを参照するため、当初の番号順よりもStatsを先に入れる方が手戻りが少なかった。
- 実装後レビューの観点は、Debug固定pauseとゲーム内pauseの分離、stats二重加算の有無、debug forceGameOver経路のresult取得である。
- 実装後レビューで見つかったDebug固定停止中の制御入力消費とdebug force系のevent記録不足は修正済みである。

## 7. Definition of Done

各チケットの完了条件は以下。

- 実装が設計レイヤーに沿っている
- Phaser importがsimulation/domain/math/formatへ漏れていない
- Zod schemaが必要な設定を検証している
- Unit/Simulation testが追加または更新されている
- UI影響がある場合はE2Eまたはvisual regressionが追加/更新されている
- `npm run test` が通る
- `npm run typecheck` が通る
- `npm run build` が通る
- `npm run test:e2e` が通る
- `phaser/IMPLEMENTATION_NOTES.md` または該当docsが更新されている

## 8. 品質ゲート

通常の変更:

```bash
cd phaser
npm run test
npm run typecheck
npm run build
```

UI/描画/入力/状態遷移を変更した場合:

```bash
cd phaser
npm run test:e2e
```

visual regressionを意図的に更新する場合:

```bash
cd phaser
npm run test:e2e -- tests/e2e/arena-visual.spec.ts --update-snapshots=changed
```

## 9. サブエージェント活用

本実装では、以下のタイミングでサブエージェントレビューを使う。

- Phase 1完了後: 状態遷移とDebug Hookのレビュー
- Phase 2完了後: enemy type modelとspawn balanceのレビュー
- Phase 3完了後: weapon/projectile modelのレビュー
- Phase 4完了後: upgrade loopとUI/E2Eのレビュー
- Phase 5完了後: wave config、spawn budget、balance simulationのレビュー

レビュー依頼では、以下を確認してもらう。

- レイヤー境界違反がないか
- テストがhappy pathに偏っていないか
- Zod schemaと型が乖離していないか
- E2Eがflakyになりやすくないか
- 本実装によって既存の比較実験としての価値が壊れていないか

## 10. リスク

| リスク | 内容 | 対策 |
| --- | --- | --- |
| 状態遷移肥大化 | pause, upgrade, title, resultが増える | Phase 1で先に状態を整理する |
| 設定肥大化 | 敵、武器、アップグレードが増える | Zod schemaとconfig分割を徹底する |
| 描画とsimulationの混線 | 演出のためにドメインへ表示状態が入る | GameEvent経由でadapter側に閉じる |
| E2E flaky化 | Canvasと時間依存で揺れる | Debug pause/fixed stepを使う |
| バランス崩壊 | 敵や武器追加で難易度が破綻する | 60秒固定simulation testを追加する |
| Scene肥大化 | UIと演出がSceneへ集中する | 必要になったら `ArenaGameController`, `PhaserHud`, event busを導入する |

## 11. 着手判定

本計画に基づき、次の実装着手は可能である。

Phase 1からPhase 7までは実装済みである。

次に着手するチケット候補は `PH-RF-012 Sentry等の本番監視`、またはPhase 6で残した `PhaserHud` 分離である。
