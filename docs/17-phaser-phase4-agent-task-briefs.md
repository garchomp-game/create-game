# Phaser版 Phase 4 サブエージェント作業票

## 実装後ステータス

この文書はPhase 4実装前に、サブエージェントへ渡せる粒度へ分解する目的で作成した。

2026-06-20時点で、メインエージェントが以下を実装済みである。

1. `PH-GAME-301 Pickup Model`
2. `PH-GAME-302 Level System`
3. `PH-GAME-303 Upgrade Definitions`
4. `PH-GAME-304 Upgrade UI`

実装後の採用方針:

- `GameStatus` は `"upgradeSelect"` を含む。
- XPは `Pickup` entityとして出現し、回収時に `pickup.collected` eventで加算される。
- `ProgressionState` が `level`, `xp`, `xpToNext`, `pendingUpgradeChoices` を持つ。
- `RuntimeModifiers` が移動速度、射撃間隔、弾速、最大HP、弾数、貫通数の実行時補正を持つ。
- Upgrade定義は `SimulationConfig.upgrades` とZod schemaで検証する。
- `upgradeSelect` 中はworld更新を止め、`upgradeChoicePressed` のみ処理する。
- Upgrade UIはCanvas内表示で、`1/2/3` キーで選択する。クリック選択は未実装で、必要なら後続UI改善で扱う。
- Debug Hookは `grantXp(amount)` と `forceUpgradeSelect()` を持つ。
- Visual regressionに `arena-upgrade-select.png` を追加した。

## 1. 目的

`docs/13-phaser-production-implementation-plan.md` の Phase 4: Pickups and Upgrades を、サブエージェントへそのまま渡せる粒度に分解する。

対象チケット:

- `PH-GAME-301 Pickup Model`
- `PH-GAME-302 Level System`
- `PH-GAME-303 Upgrade Definitions`
- `PH-GAME-304 Upgrade UI`

この文書は作業票であり、ここでは実装しない。

## 1.1 前提ステータス

Phase 1からPhase 3までは実装済みとして扱う。

2026-06-20時点の `phaser/src` では、以下が反映済みである。

- `GameStatus` は `playing | paused | gameOver`。
- `GameState` は `elapsed`, `score`, `hp`, `spawnTimer`, `shotTimer`, `damageCooldown`, `lastAim`, `weaponType` を持つ。
- `WorldState.stats` と `RunResultSummary` があり、統計更新は `statsSystem` が `GameEvent[]` を読む後処理方式である。
- `RunStats` は `pickupsCollected` と `upgradesChosen` を既に持つが、イベントから更新する実装はまだない。
- `EnemyTypeId` は `"chaser" | "brute" | "fast" | "ranged"`。
- 敵定義は `xpValue` を持ち、`enemy.killed` eventは `xpAwarded` を持つ。
- `WeaponTypeId` は `"pulse" | "spread" | "pierce"`。
- `SimulationConfig` は `defaultWeapon` と `weapons: Record<WeaponTypeId, WeaponSimulationConfig>` を持つ。
- `WeaponSimulationConfig` は `radius`, `speed`, `lifetime`, `interval`, `damage`, `projectileCount`, `spreadAngle`, `pierceCount` を持つ。
- `Bullet` は `weaponType`, `pierceRemaining`, `hitEnemyIds` を持つ。
- `shot.fired` eventは `bulletIds`, `weaponType`, `position`, `direction`, `projectileCount` を持つ。
- `enemy.hit` と `enemy.killed` eventは `weaponType` を持つ。
- `RunStats.weaponMetrics` は武器別 `shotsFired`, `projectilesFired`, `hits`, `kills` を持つ。
- `WorldState.enemyProjectiles` と `enemyProjectileSystem` があり、敵弾はプレイヤー弾とは別配列で扱われている。
- Debug Snapshotは `status`, `elapsed`, `hp`, `score`, `weaponType`, `stats`, `resultSummary`, `player`, `lastAim`, `bulletCount`, `enemyCount`, `enemyTypeCounts`, `enemyProjectileCount`, `lastEvents` を返す。
- `PhaserArenaRenderer` はHUDに `HP`, `Score`, `Time`, `Enemies` を表示し、`paused` と `gameOver` のオーバーレイを描画する。

一方、Phase 4着手前のpickup/level/upgradeは未実装である。

- `Pickup` entity、`WorldState.pickups`、`nextPickupId` はない。
- XP所持量、level、level threshold、`upgradeSelect` 状態はない。
- upgrade定義、upgrade選択候補、upgrade適用済みrank、runtime modifierはない。
- upgrade選択用の入力、UI、Debug Hookはない。

## 2. 共通ルール

- Phaser依存は `phaser/src/adapters/phaser` に閉じる。
- `phaser/src/domain`, `phaser/src/simulation`, `phaser/src/math`, `phaser/src/format` にPhaser importを入れない。
- pickup、XP、level、upgrade効果のゲームルールはsimulation/domain/configで扱い、Sceneへ置かない。
- `statsSystem` の後処理方式を維持し、pickup回収やupgrade選択時に複数箇所で `world.stats` を直接増やさない。
- `enemy.killed` eventの `xpAwarded` をPhase 4のXP源として扱う。
- `WorldState.enemyProjectiles` は維持する。Pickupやupgrade作業で敵弾とプレイヤー弾を統合しない。
- Phase 3で採用済みの `world.state.weaponType`, `WeaponSimulationConfig.pierceCount`, `shot.fired.bulletIds/projectileCount`, `weaponMetrics.projectilesFired` に合わせる。
- pause中、gameOver中、upgradeSelect中は、明示された入力以外で時間、敵、弾、pickup、spawn、statsが進まない状態を維持する。
- per-frame console logは増やさない。
- UI/描画/入力/状態遷移を変更した場合はE2Eまたはvisual regressionの必要性を判断し、変更理由と検証範囲を報告する。
- Debug Hookを追加する場合は `phaser/src/vite-env.d.ts` の型とE2Eからの使い方を一致させる。

推奨統合順:

1. `PH-GAME-301 Pickup Model`
2. `PH-GAME-302 Level System`
3. `PH-GAME-303 Upgrade Definitions`
4. `PH-GAME-304 Upgrade UI`

競合しやすいファイル:

- `phaser/src/domain/types.ts`
- `phaser/src/config/gameConfig.ts`
- `phaser/src/config/configSchema.ts`
- `phaser/src/simulation/createWorld.ts`
- `phaser/src/simulation/stepWorld.ts`
- `phaser/src/simulation/stepWorld.test.ts`
- `phaser/src/simulation/systems/combatSystem.ts`
- `phaser/src/simulation/systems/statsSystem.ts`
- `phaser/src/adapters/phaser/ArenaScene.ts`
- `phaser/src/adapters/phaser/PhaserArenaRenderer.ts`
- `phaser/src/adapters/phaser/PhaserInputAdapter.ts`
- `phaser/src/vite-env.d.ts`
- `phaser/tests/e2e/arena.spec.ts`
- `phaser/tests/e2e/arena-visual.spec.ts`

複数サブエージェントへ並行依頼する場合も、301と302は順番に統合する。303と304も、303のupgrade定義と選択APIが確定してから304を統合する。

## 3. 推奨モデル

実装時の設計目安であり、サブエージェントは既存コードに合わせて最小変更で実装する。

- `PickupTypeId` は最初は `"xp"` のみでよい。
- `Pickup` は `CircleBody` を拡張し、`id`, `typeId`, `xpValue` を持つ。
- `WorldState` に `pickups: Pickup[]` と `nextPickupId` を追加する。
- pickup configは `SimulationConfig.pickup` または `SimulationConfig.pickups` に置く。
  - 例: `xpRadius`, `collectRadius`, `dropOffsetStep`, `maxPlacementAttempts`
  - `xpValue` は敵定義の `xpValue` と `enemy.killed.xpAwarded` を使い、pickup configへ重複定義しない。
- `enemy.killed` eventに `position: Vec2` を追加すると、`pickupSystem` がcombatの外でdropを作れる。
- `pickupSystem` は `enemy.killed` eventからXP gemを生成し、プレイヤー接触で `pickup.collected` eventをemitする。
- `GameState` には、段階的に `xp`, `level`, `xpToNextLevel` を追加する。
  - 301ではXP回収量を保持する最小フィールドだけ追加してよい。
  - 302でlevel threshold、level up、`upgradeSelect` を正式に扱う。
- `GameStatus` は302で `"upgradeSelect"` を追加する。
- `upgradeSelect` 中はpauseと同じくsimulation更新を止めるが、upgrade選択入力だけは処理できるようにする。
- upgrade定義はTypeScript定数でよい。外部JSON化は不要。
- upgrade効果は `SimulationConfig` を実行時に直接書き換えず、`WorldState` のruntime modifierまたはderived effective statsで表現する。
- upgrade候補は固定seedで再現できるよう、既存の `RandomSource` を使って選ぶ。
- upgrade UIはadapter層に閉じる。Canvas/Phaser objectsでもDOMでもよいが、simulationへ描画状態を入れない。

## 4. PH-GAME-301 Pickup Model

### 目的

敵撃破時にXP gemを落とし、プレイヤー接触で回収できるpickup entityを追加する。

このチケットでは、pickupの生成、配置、回収、XP獲得イベント、pickup回収統計を作る。Level up、upgrade候補生成、upgrade UIは後続チケットで扱う。

### 前提/依存

- Phase 1からPhase 3が統合済みであること。
- 敵定義に `xpValue` があり、`enemy.killed` eventに `xpAwarded` があること。
- `statsSystem` はevent後処理方式であること。
- `RunStats.pickupsCollected` は存在するが、まだ更新されていないこと。
- `PH-GAME-302 Level System` はこのチケットの `Pickup` と `pickup.collected` eventに依存する。
- 301時点では `upgradeSelect` へ遷移しない。

### 想定編集ファイル

- `phaser/src/domain/types.ts`
  - `PickupTypeId` と `PICKUP_TYPE_IDS` を追加する。
  - `PickupSimulationConfig` または同等のconfig型を追加する。
  - `Pickup` entityを追加する。
  - `SimulationConfig` にpickup configを追加する。
  - `WorldState` に `pickups` と `nextPickupId` を追加する。
  - `GameState` にXP所持量を追加する場合は、名前を302で使いやすい形にする。
    - 推奨: `xp: number`
  - `GameEvent` に `pickup.spawned` と `pickup.collected` を追加する。
  - `enemy.killed` eventに `position: Vec2` を追加する。
- `phaser/src/config/gameConfig.ts`
  - pickup configの既定値を追加する。
  - 初期値例: `xpRadius: 6`, `collectRadius: 20`, `dropOffsetStep: 10`, `maxPlacementAttempts: 12`
- `phaser/src/config/configSchema.ts`
  - pickup configをZodで検証する。
  - 半径、回収距離、配置試行回数を正値/正整数として検証する。
- `phaser/src/config/configSchema.test.ts`
  - default config受け入れに加え、不正なpickup configを拒否するテストを追加する。
- `phaser/src/simulation/createWorld.ts`
  - `pickups: []`, `nextPickupId: 1`, XP初期値を追加する。
- `phaser/src/simulation/systems/combatSystem.ts`
  - `enemy.killed` eventへ敵死亡位置を含める。
  - pickup配列を直接更新する場合は最小にする。推奨はeventだけ出し、pickup生成は `pickupSystem` に分離する。
- `phaser/src/simulation/systems/pickupSystem.ts`
  - 新規追加する。
  - `enemy.killed` eventからXP pickupを生成する。
  - pickup配置が障害物に埋まらないよう補正する。
  - プレイヤー接触でpickupを回収し、`pickup.collected` eventをemitする。
  - 回収時にXPを増やす。
- `phaser/src/simulation/stepWorld.ts`
  - `resolveCombat` の後、`updateGameOver` と `updateRunStats` の前に `updatePickups` を呼ぶ。
  - pause/gameOver中はpickup生成や回収が進まない既存制御を維持する。
- `phaser/src/simulation/systems/statsSystem.ts`
  - `pickup.collected` eventで `world.stats.pickupsCollected` を増やす。
- `phaser/src/simulation/stepWorld.test.ts`
  - pickup生成、回収、XP増加、障害物回避、pause中停止を検証する。
- `phaser/src/adapters/phaser/PhaserArenaRenderer.ts`
  - XP gemを描画する。
  - 既存HUDにXPを出す場合はvisual影響を報告する。301単独では必須ではない。
- `phaser/src/adapters/phaser/ArenaScene.ts`
  - Debug Snapshotに `pickupCount` とXPを出す場合のみ更新する。
- `phaser/src/vite-env.d.ts`
  - Debug Snapshotを更新した場合に型を追従する。

### 編集禁止/注意ファイル

- `docs/13-phaser-production-implementation-plan.md`, `docs/16-phaser-phase3-agent-task-briefs.md`, `docs/17-phaser-phase4-agent-task-briefs.md`
  - PMから明示依頼がない限り変更しない。
- `phaser/src/simulation/systems/enemySystem.ts`
  - pickup実装で敵AIやranged発射ロジックを変更しない。
- `phaser/src/simulation/systems/enemyProjectileSystem.ts`
  - 敵弾とpickupを統合しない。
- `phaser/src/simulation/systems/shootingSystem.ts`, `phaser/src/simulation/systems/bulletSystem.ts`
  - pickup実装で武器挙動や弾寿命を変えない。
- `phaser/src/simulation/difficulty.ts`
  - pickup実装で難易度カーブを変更しない。
- `phaser/src/adapters/phaser/PhaserInputAdapter.ts`
  - 301では新しい入力を追加しない。
- `phaser/tests/e2e/*`
  - 301単独で画面挙動を大きく変えないなら必須ではない。RendererやDebug Snapshotを変えた場合だけ最小変更する。

### 実装手順

1. `enemy.killed` eventの生成箇所を確認し、`position` を追加する。
2. `PickupTypeId`, `Pickup`, pickup config, `WorldState.pickups`, `nextPickupId` を追加する。
3. `createWorld` でpickup配列、ID、XP初期値を初期化する。
4. `gameConfig.ts` と `configSchema.ts` にpickup configを追加する。
5. `pickupSystem.ts` を追加する。
6. `enemy.killed` eventを走査し、`xpAwarded > 0` のときXP pickupを生成する。
7. pickup IDは `pickup-${world.nextPickupId++}` のように一意にする。
8. pickupの初期位置は敵死亡位置を基準にする。
9. 障害物に埋まる場合は、近傍候補へずらす。
   - 推奨: 右、左、下、上、斜めの順に `dropOffsetStep` ずつ試す。
   - すべて失敗した場合はarena内にclampした最終候補を使い、そのケースをUnit testで明示する。
10. pickup回収は `circleCircle` または `collectRadius` を使ってプレイヤー接触を判定する。
11. 回収時は `world.state.xp` などのXP値を増やし、pickupを配列から除く。
12. 回収時に `pickup.collected` eventをemitする。
    - payload推奨: `pickupId`, `pickupType`, `xpGained`, `position`
13. `statsSystem` で `pickup.collected` eventから `pickupsCollected` を増やす。
14. `stepWorld` に `updatePickups` を組み込む。
15. RendererでXP gemを描く場合は、既存の弾・敵・プレイヤーと重なっても判別できる最小表現にする。
16. Debug Snapshotへ `pickupCount` とXPを追加するか判断する。
17. Unit/Simulation testで、敵撃破からpickup生成、回収、XP増加までを確認する。

### 受け入れ条件

- `Pickup` entityが追加され、`WorldState.pickups` で管理される。
- 敵撃破時に `enemy.killed.xpAwarded` に応じたXP pickupが生成される。
- `xpAwarded <= 0` の場合はXP pickupを生成しない。
- pickupは障害物に埋まらない。
- プレイヤーがpickupへ接触するとpickupが消える。
- pickup回収でXPが増える。
- pickup回収時に `pickup.collected` eventが出る。
- `world.stats.pickupsCollected` が `pickup.collected` eventから増える。
- pause中、gameOver中はpickup生成、回収、XP、statsが進まない。
- 既存のscore、enemy kill、weapon metrics、enemy projectile、pause、gameOver、restart挙動が維持される。
- Phaser importがdomain/simulation/math/formatへ入っていない。

### 推奨テスト

- `phaser/src/config/configSchema.test.ts`
  - default configを受け入れる。
  - `xpRadius <= 0`, `collectRadius <= 0`, `dropOffsetStep <= 0`, `maxPlacementAttempts < 1` を拒否する。
- `phaser/src/simulation/stepWorld.test.ts`
  - 敵を倒すとXP pickupが1つ生成される。
  - `enemy.killed` eventに死亡位置と `xpAwarded` が含まれる。
  - pickupが障害物内に出ない。
  - プレイヤーがpickupに触れるとpickupが消え、XPが増える。
  - `pickup.collected` eventが出る。
  - `stats.pickupsCollected` が1増える。
  - pause中はpickup回収されない。
  - gameOver中はpickup回収されない。
  - `xpAwarded: 0` の敵ではpickupが生成されない。

検証コマンド:

```bash
cd phaser
npm run test
npm run typecheck
npm run build
```

Renderer、Debug Snapshot、E2Eを変えた場合:

```bash
cd phaser
npm run test:e2e
```

### サブエージェントへの依頼文テンプレート

```text
作業場所: /home/garchomp-game/workspace/create-game

PH-GAME-301 Pickup Modelを実装してください。

参照:
- docs/13-phaser-production-implementation-plan.md
- docs/16-phaser-phase3-agent-task-briefs.md
- docs/17-phaser-phase4-agent-task-briefs.md の PH-GAME-301
- phaser/src/domain/types.ts
- phaser/src/config/gameConfig.ts
- phaser/src/config/configSchema.ts
- phaser/src/simulation/createWorld.ts
- phaser/src/simulation/stepWorld.ts
- phaser/src/simulation/systems/combatSystem.ts
- phaser/src/simulation/systems/statsSystem.ts
- phaser/src/simulation/stepWorld.test.ts

要件:
- Pickup entityとWorldState.pickupsを追加する。
- enemy.killed.xpAwardedからXP pickupを生成する。
- pickupは障害物に埋まらないように配置する。
- プレイヤー接触でpickupを回収し、XPを増やす。
- pickup.collected eventからstats.pickupsCollectedを更新する。
- pause/gameOver中はpickupとXPが進まない。

禁止/注意:
- Level up、upgrade定義、upgrade UIは実装しない。
- 敵AI、敵弾、武器挙動、difficultyを変更しない。
- statsを複数箇所で直接加算しない。statsSystemのevent後処理方式を維持する。
- Phaser importをdomain/simulationへ入れない。
- docsは明示指示がない限り変更しない。

検証:
- cd phaser
- npm run test
- npm run typecheck
- npm run build
- Renderer/Debug Snapshot/E2Eを変えた場合は npm run test:e2e

完了時:
- 変更ファイル
- 採用したPickup/XP model
- 障害物回避配置の方法
- 実行した検証コマンドと結果
- 残リスク
を報告してください。
```

## 5. PH-GAME-302 Level System

### 目的

XP閾値によるlevel upと、level up時にゲーム進行を止める `upgradeSelect` 状態を追加する。

このチケットでは、XP threshold、level状態、level up event、`upgradeSelect` への遷移、Debug Hookによる強制level up確認を作る。実際のupgrade定義と選択効果は303、UI表示とクリック/キー選択は304で扱う。

### 前提/依存

- `PH-GAME-301 Pickup Model` が統合済みであること。
- `WorldState.pickups` と `pickup.collected` eventがあること。
- pickup回収でXPが増えること。
- `GameStatus` はまだ `playing | paused | gameOver` であり、ここで `"upgradeSelect"` を追加する。
- 303のupgrade定義は未実装であるため、302では「level upにより選択待ち状態へ入る」ことを主目的にする。
- 304のUIは未実装であるため、E2EではDebug Hookで `upgradeSelect` 状態を確認できればよい。

### 想定編集ファイル

- `phaser/src/domain/types.ts`
  - `GameStatus` に `"upgradeSelect"` を追加する。
  - `LevelSimulationConfig` または同等のconfig型を追加する。
  - `SimulationConfig` にlevel configを追加する。
  - `GameState` に `level`, `xp`, `xpToNextLevel` を追加する。
  - 必要なら `pendingLevelUps` または `pendingUpgradeLevel` を追加する。
  - `GameEvent` に `player.level_up` を追加する。
- `phaser/src/config/gameConfig.ts`
  - level configの既定値を追加する。
  - 初期値例: `initialLevel: 1`, `baseXp: 5`, `growthFactor: 1.35`
- `phaser/src/config/configSchema.ts`
  - level configをZodで検証する。
- `phaser/src/config/configSchema.test.ts`
  - 不正なlevel configを拒否するテストを追加する。
- `phaser/src/simulation/createWorld.ts`
  - `level`, `xp`, `xpToNextLevel` を初期化する。
- `phaser/src/simulation/systems/levelSystem.ts`
  - 新規追加する。
  - XPが閾値以上になったらlevelを上げる。
  - level up時に `player.level_up` eventをemitし、`world.state.status = "upgradeSelect"` にする。
  - 次levelの必要XPを計算する。
- `phaser/src/simulation/stepWorld.ts`
  - `upgradeSelect` 中は通常simulation更新を止める。
  - `playing` 中のpickup回収後、stats更新前にlevel判定を行う。
  - `pausePressed` の扱いを整理する。推奨: `upgradeSelect` 中はpause toggleを無視し、upgrade選択だけで復帰する。
- `phaser/src/simulation/stepWorld.test.ts`
  - XP閾値、level up、`upgradeSelect` 停止、pause/gameOverとの優先順位を検証する。
- `phaser/src/adapters/phaser/ArenaScene.ts`
  - Debug Snapshotに `level`, `xp`, `xpToNextLevel` を追加する。
  - Debug APIに `forceXp(amount)` または `forceLevelUp()` を追加する。
- `phaser/src/vite-env.d.ts`
  - Debug Snapshot/API型を更新する。
- `phaser/src/adapters/phaser/PhaserArenaRenderer.ts`
  - HUDにLevel/XPを出す場合は更新する。
  - `upgradeSelect` の一時表示は304で本実装してよい。302では最小テキストでもよい。
- `phaser/tests/e2e/arena.spec.ts`
  - Debug Hookで強制level upし、statusが `upgradeSelect` になることを確認する。
- `phaser/tests/e2e/arena-visual.spec.ts`
  - 302で画面に `upgradeSelect` 表示を出した場合のみ追加/更新する。

### 編集禁止/注意ファイル

- `docs/13-phaser-production-implementation-plan.md`, `docs/16-phaser-phase3-agent-task-briefs.md`, `docs/17-phaser-phase4-agent-task-briefs.md`
  - PMから明示依頼がない限り変更しない。
- `phaser/src/simulation/systems/shootingSystem.ts`, `phaser/src/simulation/systems/combatSystem.ts`
  - 302ではupgrade効果や武器補正を実装しない。
- `phaser/src/adapters/phaser/PhaserInputAdapter.ts`
  - 302ではupgrade選択入力を追加しない。304で扱う。
- `phaser/src/simulation/systems/enemySystem.ts`, `phaser/src/simulation/systems/enemyProjectileSystem.ts`
  - level systemで敵挙動を変更しない。
- `phaser/src/simulation/difficulty.ts`
  - level upで難易度カーブを変更しない。
- `phaser/src/simulation/resultSummary.ts`
  - Result Summaryへlevelを追加するかは任意。追加する場合はtestとRenderer影響を明示する。

### 実装手順

1. 301のXP保持場所と `pickup.collected` event payloadを確認する。
2. `GameStatus` に `"upgradeSelect"` を追加する。
3. `LevelSimulationConfig` を追加し、configとschemaを更新する。
4. `createWorld` で `level`, `xp`, `xpToNextLevel` を初期化する。
5. XP閾値計算関数を実装する。
   - 推奨: `getXpRequiredForLevel(level, config.level)` のようにpure function化する。
   - 小数が出る場合は `Math.floor` または `Math.ceil` のどちらかに統一し、testで固定する。
6. `levelSystem.ts` を追加する。
7. `pickup.collected` 後にXPが閾値以上ならlevelを上げる。
8. level up時は必要XPを消費するか累積XPで判定するかを明確にする。
   - 推奨: `xp` は現在level内のXPとして扱い、閾値到達時に `xp -= xpToNextLevel` する。
   - 累積XP方式を採用する場合は `totalXp` と `xp` の意味を分ける。
9. `player.level_up` eventをemitする。
   - payload推奨: `level`, `xp`, `xpToNextLevel`
10. level up時に `world.state.status = "upgradeSelect"` にする。
11. 複数level分のXPを一度に得た場合の扱いを決める。
   - 推奨: 1回のupdateで1levelだけ上げ、残XPは保持し、upgrade選択後に次判定する。
12. `stepWorld` で `upgradeSelect` 中の通常更新を止める。
13. `upgradeSelect` 中はdt metricsを0として返す。
14. Debug Snapshotへ `level`, `xp`, `xpToNextLevel` を追加する。
15. Debug APIへ `forceXp(amount)` または `forceLevelUp()` を追加する。
16. E2EでDebug Hookから強制level upし、`upgradeSelect` になることを確認する。

### 受け入れ条件

- `GameStatus` に `"upgradeSelect"` が追加されている。
- `WorldState` または `GameState` から現在level、現在XP、次level必要XPを取得できる。
- pickup回収でXPが閾値に達するとlevelが上がる。
- level up時に `player.level_up` eventが出る。
- level up時に `world.state.status` が `"upgradeSelect"` になる。
- `upgradeSelect` 中はelapsed、player、enemy、bullet、enemyProjectile、pickup、spawnTimer、shotTimer、damageCooldown、statsが進まない。
- `upgradeSelect` 中にpause入力で `paused` へ切り替わらない。
- gameOver中にlevel up処理が走らない。
- Debug Snapshotからlevel/XP状態を確認できる。
- E2EでDebug Hookから強制level upを確認できる。
- 既存のpause/gameOver/restart/weapon metrics/pickup collection挙動が維持される。
- Phaser importがdomain/simulation/math/formatへ入っていない。

### 推奨テスト

- `phaser/src/config/configSchema.test.ts`
  - default configを受け入れる。
  - `initialLevel < 1`, `baseXp <= 0`, `growthFactor <= 1` などを拒否する。
- `phaser/src/simulation/stepWorld.test.ts`
  - 初期levelが1、XPが0、次XPがconfig由来である。
  - XPが閾値未満ならlevelは上がらず `playing` のまま。
  - XPが閾値に達するとlevelが1上がり、`player.level_up` eventが出る。
  - level up後にstatusが `upgradeSelect` になる。
  - 大量XP取得時は1回のupdateで1levelだけ上げる、または採用仕様どおりに複数levelを処理する。
  - `upgradeSelect` 中はelapsed、player、bullets、enemies、pickups、statsが変化しない。
  - `upgradeSelect` 中の `pausePressed` はstatusを変えない。
  - gameOver中はXP/levelが変化しない。
- `phaser/tests/e2e/arena.spec.ts`
  - `window.__ARENA_DEBUG__.forceLevelUp()` または `forceXp()` で `upgradeSelect` へ遷移する。
  - Debug Snapshotでlevel、XP、次XPを読める。

検証コマンド:

```bash
cd phaser
npm run test
npm run typecheck
npm run build
npm run test:e2e
```

visual snapshotを意図的に更新する場合:

```bash
cd phaser
npm run test:e2e -- tests/e2e/arena-visual.spec.ts --update-snapshots=changed
```

### サブエージェントへの依頼文テンプレート

```text
作業場所: /home/garchomp-game/workspace/create-game

PH-GAME-302 Level Systemを実装してください。

前提:
- PH-GAME-301 Pickup Modelは統合済みです。

参照:
- docs/13-phaser-production-implementation-plan.md
- docs/17-phaser-phase4-agent-task-briefs.md の PH-GAME-302
- phaser/src/domain/types.ts
- phaser/src/config/gameConfig.ts
- phaser/src/config/configSchema.ts
- phaser/src/simulation/createWorld.ts
- phaser/src/simulation/stepWorld.ts
- phaser/src/simulation/systems/pickupSystem.ts
- phaser/src/simulation/stepWorld.test.ts
- phaser/src/adapters/phaser/ArenaScene.ts
- phaser/src/vite-env.d.ts
- phaser/tests/e2e/arena.spec.ts

要件:
- GameStatusに upgradeSelect を追加する。
- level、XP、次level必要XPをWorldState/GameStateで管理する。
- pickup回収XPが閾値に達したらlevel upする。
- level up時に player.level_up eventを出し、upgradeSelectへ遷移する。
- upgradeSelect中は通常simulation更新を止める。
- Debug Hookから強制level upまたは強制XP付与でき、E2Eで確認できる。

禁止/注意:
- Upgrade定義、upgrade効果、upgrade UIは実装しない。
- 敵AI、敵弾、武器挙動、difficultyを変更しない。
- upgradeSelect中にpauseへ切り替えない。
- Phaser importをdomain/simulationへ入れない。
- docsは明示指示がない限り変更しない。

検証:
- cd phaser
- npm run test
- npm run typecheck
- npm run build
- npm run test:e2e

完了時:
- 変更ファイル
- 採用したlevel/XP threshold仕様
- upgradeSelect中に停止させる対象
- Debug Hookの追加内容
- 実行した検証コマンドと結果
- 残リスク
を報告してください。
```

## 6. PH-GAME-303 Upgrade Definitions

### 目的

攻撃速度、弾速、最大HP、移動速度、追加弾、貫通追加のupgrade定義をデータ駆動で追加し、選択したupgradeが次の戦闘へ反映されるようにする。

このチケットではupgrade定義、候補生成、選択適用、runtime modifier、upgrade選択統計を作る。見た目の3択UI、キーボード/クリック操作の完成は304で扱う。

### 前提/依存

- `PH-GAME-301 Pickup Model` が統合済みであること。
- `PH-GAME-302 Level System` が統合済みであること。
- level up時に `upgradeSelect` 状態へ遷移できること。
- `world.state.weaponType` と `SimulationConfig.weapons` があること。
- `WeaponSimulationConfig` は `interval`, `speed`, `projectileCount`, `pierceCount` を持つこと。
- `RunStats.upgradesChosen` は存在するが、まだイベントから更新されていないこと。
- 304のUIは未実装であるため、303ではUnit/Simulation testまたはDebug Hookから選択適用を確認できればよい。

### 想定編集ファイル

- `phaser/src/domain/types.ts`
  - `UpgradeId` と `UPGRADE_IDS` を追加する。
  - `UpgradeDefinition` とupgrade効果型を追加する。
  - `SimulationConfig` に `upgrades` とupgrade selection configを追加する。
  - `WorldState` にupgrade runtime stateを追加する。
    - 推奨: `upgradeChoices`, `upgradeRanks`, `modifiers`
  - `GameEvent` に `upgrade.offered` と `upgrade.selected` を追加する。
  - `InputSnapshot` へ選択indexを追加するかは304で扱ってもよい。
- `phaser/src/config/gameConfig.ts`
  - upgrade定義を追加する。
  - 必須upgrade例:
    - 攻撃速度上昇
    - 弾速上昇
    - 最大HP上昇
    - 移動速度上昇
    - 追加弾
    - 貫通追加
- `phaser/src/config/configSchema.ts`
  - upgrade configをZodで検証する。
  - 効果量、最大rank、候補数、重みを検証する。
- `phaser/src/config/configSchema.test.ts`
  - default config受け入れと不正upgrade config拒否を追加する。
- `phaser/src/simulation/createWorld.ts`
  - upgrade runtime stateを初期化する。
  - 最大HPupgradeのために `maxHp` をruntimeで持つ場合は初期化する。
- `phaser/src/simulation/systems/upgradeSystem.ts`
  - 新規追加する。
  - level up時に候補を3つ生成する。
  - upgradeを選択して効果を適用する。
  - 選択後に `playing` へ戻す。
  - `upgrade.selected` eventをemitする。
- `phaser/src/simulation/systems/levelSystem.ts`
  - level up時にupgrade候補生成を呼ぶか、`stepWorld` からlevel up後に `upgradeSystem` を呼ぶ形へ追従する。
- `phaser/src/simulation/stepWorld.ts`
  - `upgradeSelect` 中に選択処理を呼べるようにする。
  - 303でDebug/API経由だけにする場合は、通常入力処理は304へ残してよい。
- `phaser/src/simulation/systems/statsSystem.ts`
  - `upgrade.selected` eventで `world.stats.upgradesChosen` を増やす。
- `phaser/src/simulation/systems/shootingSystem.ts`
  - 攻撃速度、弾速、追加弾、貫通追加のruntime modifierを反映する。
  - `SimulationConfig.weapons` を直接変更しない。
- `phaser/src/simulation/systems/playerSystem.ts`
  - 移動速度upgradeのruntime modifierを反映する。
- `phaser/src/simulation/systems/combatSystem.ts`
  - 最大HPupgradeの実装に応じて、HP上限管理が必要なら追従する。
- `phaser/src/simulation/stepWorld.test.ts`
  - 候補生成、選択、各upgrade効果、stats、status復帰を検証する。
- `phaser/src/adapters/phaser/ArenaScene.ts`
  - Debug Snapshotにupgrade候補、rank、modifierを出す場合のみ更新する。
  - Debug APIに `selectUpgrade(index)` または `chooseUpgrade(upgradeId)` を追加する場合のみ更新する。
- `phaser/src/vite-env.d.ts`
  - Debug Snapshot/API型を更新した場合に追従する。

### 編集禁止/注意ファイル

- `docs/13-phaser-production-implementation-plan.md`, `docs/16-phaser-phase3-agent-task-briefs.md`, `docs/17-phaser-phase4-agent-task-briefs.md`
  - PMから明示依頼がない限り変更しない。
- `phaser/src/adapters/phaser/PhaserArenaRenderer.ts`, `phaser/src/adapters/phaser/PhaserInputAdapter.ts`
  - 303では本格UIや入力を実装しない。必要なDebug表示に留める。
- `phaser/src/simulation/difficulty.ts`
  - upgrade導入で敵出現難易度を変えない。
- `phaser/src/config/gameConfig.ts`
  - 既存weapon/enemy値をupgrade効果のために直接弱体化しない。balance調整は別タスクで扱う。
- `phaser/src/simulation/systems/statsSystem.ts`
  - statsは `upgrade.selected` eventから更新し、upgradeSystem内で直接 `upgradesChosen` を増やさない。
- `SimulationConfig`
  - 実行時に直接mutateしない。効果はWorldState側のmodifierで持つ。

### 実装手順

1. 302のlevel upと `upgradeSelect` 状態を確認する。
2. `UpgradeId`, `UpgradeDefinition`, upgrade effect型を定義する。
3. upgrade定義を `gameConfig.ts` に追加する。
4. schemaとschema testを更新する。
5. `WorldState` にupgrade stateを追加する。
   - 推奨フィールド:
     - `upgradeChoices: UpgradeId[]`
     - `upgradeRanks: Record<UpgradeId, number>`
     - `modifiers.playerSpeedMultiplier`
     - `modifiers.maxHpBonus`
     - `modifiers.weaponIntervalMultiplier`
     - `modifiers.projectileSpeedMultiplier`
     - `modifiers.projectileCountBonus`
     - `modifiers.pierceCountBonus`
6. `createWorld` でupgrade stateを初期化する。
7. `upgradeSystem.ts` を追加する。
8. 候補生成関数を実装する。
   - 候補数は3をconfig化する。
   - max rankに達したupgradeは候補から除外する。
   - 同じ候補を重複表示しない。
   - 既存 `RandomSource` で再現可能にする。
9. level up時に候補生成し、`world.upgradeChoices` へ保存する。
10. 候補生成時に `upgrade.offered` eventをemitするか判断する。
    - E2E/Debugで候補を確認したい場合はemitする。
11. 選択適用関数を実装する。
    - `selectUpgrade(world, index, config, events)` または `applyUpgrade(world, upgradeId, config, events)` の形にする。
12. 選択したupgradeのrankを増やす。
13. 効果をruntime modifierへ反映する。
14. `upgrade.selected` eventをemitする。
    - payload推奨: `upgradeId`, `rank`, `level`, `effects`
15. 選択後、`world.state.status = "playing"` へ戻す。
16. 選択後に残XPが次閾値を満たしている場合の扱いを決める。
    - 推奨: 次の `stepWorld` で改めてlevel判定し、連続level upでも1選択ずつ処理する。
17. `statsSystem` で `upgrade.selected` eventから `upgradesChosen` を増やす。
18. `shootingSystem` に攻撃速度、弾速、追加弾、貫通追加を反映する。
19. `playerSystem` に移動速度を反映する。
20. 最大HPupgradeは、最大HPだけ増やすか現在HPも回復するかを定義する。
    - 推奨: max HP増加時に現在HPも同量増やし、即時効果を体感できるようにする。
21. Unit/Simulation testで各効果を検証する。

### 受け入れ条件

- upgrade定義がconfig化され、Zod schemaで検証される。
- 攻撃速度上昇、弾速上昇、最大HP上昇、移動速度上昇、追加弾、貫通追加の定義がある。
- level up時に3つのupgrade候補が生成される。
- 候補に重複がない。
- max rankに達したupgradeは候補から除外される。
- fixed seedで候補生成が再現可能である。
- upgrade選択でrankが増える。
- upgrade選択で `upgrade.selected` eventが出る。
- `world.stats.upgradesChosen` が `upgrade.selected` eventから増える。
- 選択後にstatusが `playing` へ戻る。
- 攻撃速度upgradeが次回射撃の `shotTimer` またはfire intervalへ反映される。
- 弾速upgradeが次回生成弾のvelocityへ反映される。
- 最大HPupgradeがHP上限へ反映される。
- 移動速度upgradeが次回移動量へ反映される。
- 追加弾upgradeが次回射撃の `projectileCount` と `shot.fired.projectileCount` へ反映される。
- 貫通追加upgradeが次回生成弾の `pierceRemaining` へ反映される。
- `SimulationConfig` を実行時にmutateしていない。
- Phaser importがdomain/simulation/math/formatへ入っていない。

### 推奨テスト

- `phaser/src/config/configSchema.test.ts`
  - default configを受け入れる。
  - required upgrade定義欠落を拒否する。
  - `maxRank < 1`, `weight <= 0`, 不正な効果量を拒否する。
  - 候補数が1未満の場合を拒否する。
- `phaser/src/simulation/stepWorld.test.ts`
  - level up時にupgrade候補が3つ生成される。
  - fixed seedで候補順が再現できる。
  - 候補が重複しない。
  - max rank到達済みupgradeが候補に出ない。
  - upgrade選択後にstatusが `playing` へ戻る。
  - `upgrade.selected` eventが出る。
  - `stats.upgradesChosen` が1増える。
  - 攻撃速度upgrade後、次回射撃のcooldownが短くなる。
  - 弾速upgrade後、次回弾velocityが増える。
  - 最大HPupgrade後、max HPと現在HPが採用仕様どおり増える。
  - 移動速度upgrade後、同じ入力/dtで移動量が増える。
  - 追加弾upgrade後、`shot.fired.projectileCount` と `weaponMetrics.projectilesFired` が増える。
  - 貫通追加upgrade後、生成弾の `pierceRemaining` が増える。
  - upgrade効果がpause中に勝手に適用されない。

検証コマンド:

```bash
cd phaser
npm run test
npm run typecheck
npm run build
```

Debug Hook、Renderer、E2Eを変えた場合:

```bash
cd phaser
npm run test:e2e
```

### サブエージェントへの依頼文テンプレート

```text
作業場所: /home/garchomp-game/workspace/create-game

PH-GAME-303 Upgrade Definitionsを実装してください。

前提:
- PH-GAME-301 Pickup Modelは統合済みです。
- PH-GAME-302 Level Systemは統合済みです。

参照:
- docs/13-phaser-production-implementation-plan.md
- docs/17-phaser-phase4-agent-task-briefs.md の PH-GAME-303
- phaser/src/domain/types.ts
- phaser/src/config/gameConfig.ts
- phaser/src/config/configSchema.ts
- phaser/src/simulation/createWorld.ts
- phaser/src/simulation/stepWorld.ts
- phaser/src/simulation/systems/levelSystem.ts
- phaser/src/simulation/systems/shootingSystem.ts
- phaser/src/simulation/systems/playerSystem.ts
- phaser/src/simulation/systems/statsSystem.ts
- phaser/src/simulation/stepWorld.test.ts

要件:
- 攻撃速度、弾速、最大HP、移動速度、追加弾、貫通追加のupgrade定義をconfigへ追加する。
- Zod schemaでupgrade configを検証する。
- level up時に3つの候補を固定seedで再現可能に生成する。
- upgrade選択でrankとruntime modifierを更新する。
- SimulationConfigを実行時にmutateせず、WorldState側のmodifierで効果を反映する。
- upgrade.selected eventからstats.upgradesChosenを更新する。
- 選択後はplayingへ戻す。

禁止/注意:
- 3択UI、クリック、キーボード選択表示はPH-GAME-304で扱うため実装しない。
- 敵AI、敵弾、difficulty、既存weapon/enemy基本値を変更しない。
- statsをupgradeSystem内で直接加算しない。
- Phaser importをdomain/simulationへ入れない。
- docsは明示指示がない限り変更しない。

検証:
- cd phaser
- npm run test
- npm run typecheck
- npm run build
- Debug Hook/Renderer/E2Eを変えた場合は npm run test:e2e

完了時:
- 変更ファイル
- 採用したupgrade定義と効果モデル
- 候補生成ロジック
- 各upgrade効果の反映先
- 実行した検証コマンドと結果
- 残リスク
を報告してください。
```

## 7. PH-GAME-304 Upgrade UI

### 目的

`upgradeSelect` 状態で3択upgrade UIを表示し、キーボードまたはクリックでupgradeを選択できるようにする。

このチケットでは、adapter層の表示・入力・E2E・visual regressionを完成させる。upgrade候補生成と効果適用のゲームルールは303のAPIを使い、SceneやRendererへ重複実装しない。

### 前提/依存

- `PH-GAME-301 Pickup Model` が統合済みであること。
- `PH-GAME-302 Level System` が統合済みであること。
- `PH-GAME-303 Upgrade Definitions` が統合済みであること。
- `world.state.status === "upgradeSelect"` のとき、upgrade候補が `WorldState` またはDebug Snapshotから取得できること。
- upgrade選択関数または `stepWorld` 経由の選択処理が存在すること。
- Debug Hookでlevel up状態を作れること。

### 想定編集ファイル

- `phaser/src/domain/types.ts`
  - `InputSnapshot` に `upgradeChoiceIndex: number | null` を追加する場合は更新する。
  - Debug Snapshotでupgrade候補を型付きで出すための型を必要に応じて整理する。
- `phaser/src/adapters/phaser/PhaserInputAdapter.ts`
  - `1`, `2`, `3` キー、または `Digit1`, `Digit2`, `Digit3` 相当を読み取る。
  - クリック選択をInputSnapshotで扱う場合は、pointer位置からchoice indexを決める仕組みを追加する。
- `phaser/src/adapters/phaser/PhaserArenaRenderer.ts`
  - `upgradeSelect` 中の3択UIを描画する。
  - 候補名、効果概要、rank情報を表示する。
  - UI要素がHUDやpause/gameOver表示と重ならないようにする。
  - Canvas/Phaser objectsで描く場合は、クリック領域をScene/InputAdapterと共有できる形にする。
- `phaser/src/adapters/phaser/ArenaScene.ts`
  - Renderer/InputAdapter/stepWorldまたはupgrade selection APIを接続する。
  - Debug Snapshotにupgrade候補、選択可能状態、level/XPを含める。
  - Debug APIに `selectUpgrade(index)` を公開する場合は型も更新する。
- `phaser/src/vite-env.d.ts`
  - `ArenaDebugSnapshot` と `ArenaDebugApi` を更新する。
- `phaser/src/simulation/stepWorld.ts`
  - `upgradeSelect` 中に `input.upgradeChoiceIndex` がある場合だけupgrade選択を処理し、その他のsimulationは進めない。
- `phaser/src/simulation/stepWorld.test.ts`
  - 入力経由のupgrade選択、無効index、選択後復帰を検証する。
- `phaser/tests/e2e/arena.spec.ts`
  - Debug Hookでlevel upを作り、キーボードでupgrade選択できることを確認する。
  - クリック選択も実装した場合はクリック経路を確認する。
- `phaser/tests/e2e/arena-visual.spec.ts`
  - `arena-upgrade-select.png` などのvisual snapshotを追加する。
- `phaser/playwright.config.*`
  - 原則変更不要。snapshot更新だけで済ませる。

### 編集禁止/注意ファイル

- `docs/13-phaser-production-implementation-plan.md`, `docs/16-phaser-phase3-agent-task-briefs.md`, `docs/17-phaser-phase4-agent-task-briefs.md`
  - PMから明示依頼がない限り変更しない。
- `phaser/src/simulation/systems/upgradeSystem.ts`
  - UI都合でupgrade効果や候補生成ロジックを変更しない。必要なAPI不足だけ最小修正する。
- `phaser/src/config/gameConfig.ts`
  - UI文言調整のためにbalance値やupgrade効果量を変えない。
- `phaser/src/simulation/systems/shootingSystem.ts`, `phaser/src/simulation/systems/playerSystem.ts`
  - UI実装でupgrade効果の計算を変更しない。
- `phaser/src/simulation/difficulty.ts`
  - UI実装で難易度を変更しない。
- 外部UIフレームワーク
  - React/Vue等は導入しない。
- DOMを使う場合
  - DOM要素の状態はadapter層に閉じ、simulationへDOM参照を渡さない。

### 実装手順

1. 303のupgrade候補保存場所と選択APIを確認する。
2. UI方式を決める。
   - 推奨: 既存 `PhaserArenaRenderer` にCanvas/Phaser Textベースの3択表示を追加する。
   - DOMを使う場合もadapter層だけに閉じる。
3. `InputSnapshot` へ `upgradeChoiceIndex: number | null` を追加するか、ArenaSceneから直接選択APIを呼ぶか決める。
   - 推奨: keyboard選択はInputSnapshotへ入れ、`stepWorld` で処理する。
   - click選択はRendererが返すchoice boundsをInputAdapterまたはArenaSceneが参照する。
4. `PhaserInputAdapter` に `1`, `2`, `3` のJustDown判定を追加する。
5. `upgradeSelect` 中だけchoice inputを有効にする。
6. `stepWorld` で `upgradeSelect` 中の選択処理を追加する。
   - 有効indexならupgradeを適用して `playing` へ戻す。
   - 無効indexなら状態を変えない。
   - 選択処理以外のworld更新は進めない。
7. Rendererでupgrade overlayを描く。
   - 背景は既存pause/gameOver overlayと同系統でよい。
   - 3候補を横並びまたは縦並びにする。
   - 各候補には番号、名前、短い効果説明、rankを表示する。
   - テキストは固定幅内に収め、重なりを避ける。
8. HUDとupgrade overlayが重ならないようにする。
9. click選択を実装する場合は、各候補のhit areaを安定した矩形で定義する。
10. Debug Snapshotにupgrade候補を出す。
11. Debug APIに `selectUpgrade(index)` を追加する場合は、E2Eで使えるようにする。
12. E2EでDebug Hookからlevel up状態を作る。
13. E2Eで `1` キー、可能ならクリックでupgradeを選び、statusが `playing` に戻ることを確認する。
14. E2Eで選択後に `stats.upgradesChosen` が増えることを確認する。
15. Visual regressionにupgrade select画面を追加する。

### 受け入れ条件

- `upgradeSelect` 状態で3択upgrade UIが表示される。
- UIに各候補の番号、名前、効果概要、rankが表示される。
- キーボードで1から3の候補を選択できる。
- クリック選択も実装されている、またはクリック未対応の場合は理由と後続タスクが報告されている。
- 選択したupgrade効果が303のselection API経由で適用される。
- 選択後にstatusが `playing` へ戻る。
- 選択後に `stats.upgradesChosen` が増える。
- `upgradeSelect` 中、選択以外ではelapsed、敵、弾、pickup、spawn、damage cooldownが進まない。
- 無効な選択indexでは状態が変わらない。
- E2Eでupgrade選択できる。
- visual regressionにupgrade select画面が追加される。
- HUD、upgrade UI、debug overlay、pause/gameOver overlayが破綻して重ならない。
- Phaser importがdomain/simulation/math/formatへ入っていない。

### 推奨テスト

- `phaser/src/simulation/stepWorld.test.ts`
  - `upgradeSelect` 中に `upgradeChoiceIndex: 0` でupgradeが選択される。
  - 選択後にstatusが `playing` へ戻る。
  - `upgrade.selected` eventが出る。
  - `stats.upgradesChosen` が1増える。
  - `upgradeChoiceIndex` が範囲外ならstatusと候補が維持される。
  - `upgradeChoiceIndex` がnullならworld更新が止まる。
- `phaser/tests/e2e/arena.spec.ts`
  - Debug Hookでlevel upを強制し、statusが `upgradeSelect` になる。
  - `Digit1` または `Key1` で候補1を選択できる。
  - 選択後にstatusが `playing` へ戻る。
  - `stats.upgradesChosen` が1になる。
  - 可能なら候補2または候補3をクリックで選択できる。
- `phaser/tests/e2e/arena-visual.spec.ts`
  - Debug Hookでupgrade select状態を作り、`arena-upgrade-select.png` を撮る。
  - snapshotはfixed seed、debug pause/fixed stepで安定させる。

検証コマンド:

```bash
cd phaser
npm run test
npm run typecheck
npm run build
npm run test:e2e
```

visual snapshotを意図的に更新する場合:

```bash
cd phaser
npm run test:e2e -- tests/e2e/arena-visual.spec.ts --update-snapshots=changed
```

### サブエージェントへの依頼文テンプレート

```text
作業場所: /home/garchomp-game/workspace/create-game

PH-GAME-304 Upgrade UIを実装してください。

前提:
- PH-GAME-301 Pickup Modelは統合済みです。
- PH-GAME-302 Level Systemは統合済みです。
- PH-GAME-303 Upgrade Definitionsは統合済みです。

参照:
- docs/13-phaser-production-implementation-plan.md
- docs/17-phaser-phase4-agent-task-briefs.md の PH-GAME-304
- phaser/src/domain/types.ts
- phaser/src/simulation/stepWorld.ts
- phaser/src/simulation/systems/upgradeSystem.ts
- phaser/src/adapters/phaser/ArenaScene.ts
- phaser/src/adapters/phaser/PhaserArenaRenderer.ts
- phaser/src/adapters/phaser/PhaserInputAdapter.ts
- phaser/src/vite-env.d.ts
- phaser/tests/e2e/arena.spec.ts
- phaser/tests/e2e/arena-visual.spec.ts

要件:
- upgradeSelect状態で3択upgrade UIを表示する。
- 各候補に番号、名前、効果概要、rankを表示する。
- 1/2/3キーで選択できる。
- クリック選択も可能なら実装する。未対応なら理由と後続タスクを報告する。
- 選択は303のselection APIを使い、Scene/Rendererに効果ロジックを重複実装しない。
- 選択後にplayingへ戻り、stats.upgradesChosenが増える。
- E2Eとvisual regressionを追加/更新する。

禁止/注意:
- upgrade効果、候補生成、balance値をUI都合で変更しない。
- React/Vue等のUIフレームワークを導入しない。
- Phaser importをdomain/simulationへ入れない。
- UI状態やDOM参照をsimulationへ渡さない。
- docsは明示指示がない限り変更しない。

検証:
- cd phaser
- npm run test
- npm run typecheck
- npm run build
- npm run test:e2e
- visual snapshotを更新した場合は、更新理由と対象snapshotを報告する。

完了時:
- 変更ファイル
- 採用したUI方式
- キーボード/クリックの対応状況
- 追加/更新したE2Eとvisual snapshot
- 実行した検証コマンドと結果
- 残リスク
を報告してください。
```

## 8. Phase 4 完了時レビュー観点

- `upgradeSelect` と `paused` の停止処理が混ざっていないか。
- `upgradeSelect` 中に通常入力、spawn、combat、pickup、statsが進んでいないか。
- pickup回収、level up、upgrade選択のstatsが二重加算されていないか。
- upgrade効果が `SimulationConfig` のruntime mutateではなく、WorldState側の状態で表現されているか。
- Debug HookがE2Eを安定させるために十分で、productionに不要な挙動を漏らしていないか。
- UI表示がHUD、debug overlay、pause/gameOver overlayと重なって破綻していないか。
- E2E/visual snapshotがfixed seedとdebug pause/fixed stepを使い、flakyになりにくいか。
- Phaser importがdomain/simulation/math/formatへ漏れていないか。

## 9. 共通検証コマンド

通常の変更:

```bash
cd phaser
npm run test
npm run typecheck
npm run build
```

UI/描画/入力/状態遷移/Debug Hookを変更した場合:

```bash
cd phaser
npm run test:e2e
```

visual regressionを意図的に更新する場合:

```bash
cd phaser
npm run test:e2e -- tests/e2e/arena-visual.spec.ts --update-snapshots=changed
```
