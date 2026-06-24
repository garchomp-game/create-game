# Phaser版 Phase 3 サブエージェント作業票

## 1. 目的

`docs/13-phaser-production-implementation-plan.md` の Phase 3: Weapons and Combat Growth を、サブエージェントへそのまま渡せる粒度に分解する。

対象チケット:

- `PH-GAME-201 Weapon Type Model`
- `PH-GAME-202 Spread Weapon`
- `PH-GAME-203 Piercing Projectile`
- `PH-GAME-204 Weapon Metrics`

この文書は作業票であり、ここでは実装しない。

## 1.1 実装後ステータス

この文書はPhase 3実装前に、サブエージェントへ渡せる粒度へ分解する目的で作成した。

2026-06-20時点で、メインエージェントが以下を実装済みである。

1. `PH-GAME-201 Weapon Type Model`
2. `PH-GAME-202 Spread Weapon`
3. `PH-GAME-203 Piercing Projectile`
4. `PH-GAME-204 Weapon Metrics`

実装後の採用方針:

- `WeaponTypeId` は `"pulse" | "spread" | "pierce"`。
- `SimulationConfig` は `defaultWeapon` と `weapons: Record<WeaponTypeId, WeaponSimulationConfig>` を持つ。
- `pulse` は既存射撃の同値移行、`spread` は `projectileCount: 3` と `spreadAngle`、`pierce` は `pierceCount: 3` を持つ。
- `Bullet` は `weaponType`, `pierceRemaining`, `hitEnemyIds` を持つ。
- Spreadは `shootingSystem` の複数方向生成、Pierceは `combatSystem` の命中後残存処理として分離した。
- `GameEvent` は `shot.fired`, `enemy.hit`, `enemy.killed` に `weaponType` を含む。
- `RunStats.weaponMetrics` で武器別 `shotsFired`, `hits`, `kills` を保持する。
- 敵弾は引き続き `WorldState.enemyProjectiles` で分離しており、Phase 3では統合していない。

以降の「前提ステータス」は作業票作成時点のスナップショットとして読む。

## 1.1 前提ステータス

Phase 2は実装済みとして扱う。

2026-06-20時点の `phaser/src` では、以下が反映済みである。

- `GameStatus` は `playing | paused | gameOver`。
- `WorldState.stats` と `RunResultSummary` があり、統計更新は `statsSystem` が `GameEvent[]` を読む後処理方式である。
- `EnemyTypeId` は `"chaser" | "brute" | "fast" | "ranged"`。
- `SimulationConfig` は `enemies: Record<EnemyTypeId, EnemySimulationConfig>` を持つ。
- `WorldState.enemyProjectiles` と `enemyProjectileSystem` があり、敵弾はプレイヤー弾とは別配列で扱われている。
- Debug Snapshotは `enemyTypeCounts` と `enemyProjectileCount` を返す。

一方、Phase 3着手前の武器・プレイヤー弾は、まだ単一モデルである。

- `SimulationConfig.bullet` が `radius`, `speed`, `lifetime`, `interval`, `damage` を持つ。
- `WorldState.state.shotTimer` は単一の射撃クールダウンである。
- `Bullet` は `id`, `position`, `velocity`, `radius`, `lifetime`, `damage` を持つ。
- `shootingSystem` は `world.state.lastAim` と `config.bullet` から1発だけ生成する。
- `combatSystem` は弾が敵に1回命中したら弾を消す。
- `shot.fired` eventは `weaponType` や複数 `bulletIds` を持たない。
- `RunStats` は全体の `shotsFired` と `enemiesKilled` を持つが、武器別集計はない。
- `MetricsSnapshot` とDebug Overlayは `dt`, `p95 dt`, `enemies`, `bullets` を中心に表示している。

## 2. 共通ルール

- Phaser依存は `phaser/src/adapters/phaser` に閉じる。
- `phaser/src/domain`, `phaser/src/simulation`, `phaser/src/math`, `phaser/src/format` にPhaser importを入れない。
- 武器定義、弾挙動、命中処理、武器別統計はsimulation/domain/configで扱い、Sceneへゲームルールを置かない。
- Phase 2の敵タイプ、敵弾、Debug Snapshotを壊さない。
- 敵弾はPhase 2時点で `WorldState.enemyProjectiles` に分離されている。Phase 3ではプレイヤー弾の拡張を主対象とし、敵弾との統合は明示的な追加タスクがない限り行わない。
- pause中は射撃、弾移動、貫通カウント、武器別統計が進まない状態を維持する。
- gameOver/restart/result summaryの既存挙動を維持する。
- per-frame console logは増やさない。
- `statsSystem` の後処理方式を維持し、射撃や撃破のたびに複数箇所で `world.stats` を直接増やさない。
- XP、pickup、level up、upgrade選択UIはPhase 4の範囲である。Phase 3では将来のupgradeが参照しやすい型や定義に留める。
- 画面に影響する変更はE2Eまたはvisual regressionの必要性を判断し、変更理由と検証範囲を報告する。

推奨統合順:

1. `PH-GAME-201 Weapon Type Model`
2. `PH-GAME-202 Spread Weapon`
3. `PH-GAME-203 Piercing Projectile`
4. `PH-GAME-204 Weapon Metrics`

`PH-GAME-201` が `WeaponTypeId`, weapon config, player bullet event payloadの基盤を作るため、202以降を先に実装しない。

複数サブエージェントへ並行依頼する場合も、201の統合後に202/203/204を順番にrebaseして進める。特に以下は競合しやすい。

- `phaser/src/domain/types.ts`
- `phaser/src/config/gameConfig.ts`
- `phaser/src/config/configSchema.ts`
- `phaser/src/simulation/systems/shootingSystem.ts`
- `phaser/src/simulation/systems/combatSystem.ts`
- `phaser/src/simulation/systems/statsSystem.ts`
- `phaser/src/simulation/stepWorld.test.ts`
- `phaser/src/vite-env.d.ts`
- `phaser/src/adapters/phaser/ArenaScene.ts`

## 3. 推奨モデル

実装時の設計目安であり、サブエージェントは既存コードに合わせて最小変更で実装する。

- `WeaponTypeId` は段階的に拡張する。
  - 201: `"pulse"`
  - 202: `"pulse" | "spread"`
  - 203: `"pulse" | "spread" | "pierce"`
- `WEAPON_TYPE_IDS` を `ENEMY_TYPE_IDS` と同じ形式で `domain/types.ts` に置く。
- `SimulationConfig.bullet` は `SimulationConfig.weapons` へ移行する。
  - 推奨: `weapons: Record<WeaponTypeId, WeaponSimulationConfig>`
  - 既存 `bullet.radius/speed/lifetime/interval/damage` は `weapons.pulse` へ同値で移す。
- 現在の武器は `GameState.activeWeapon: WeaponTypeId` で持つ。
  - `createWorld` は `"pulse"` で初期化する。
  - Phase 4のupgrade選択まで、通常プレイで武器を切り替えるUIは不要。
  - テストでは `world.state.activeWeapon = "spread"` などで対象武器を指定できるようにする。
- `Bullet` は `weaponType: WeaponTypeId` を持つ。
- `Bullet` は `pierceRemaining` を持てる形にする。
  - 201時点では `0` 固定または任意プロパティでよい。
  - 203で必須値にする場合は、既存テストの手作りBulletも更新する。
- `shot.fired` eventは `weaponType`, `bulletIds`, `position`, `direction` を持つ形が望ましい。
  - 201では1発だけなので `bulletIds: [bullet.id]` になる。
  - 既存の `bulletId` 単数を残す場合も、202の複数弾で破綻しないpayloadへ移行する。
- 武器定義は最低限以下を持つ。
  - `projectileRadius`
  - `projectileSpeed`
  - `projectileLifetime`
  - `fireInterval`
  - `damage`
  - `projectileCount`
  - `spreadAngle`
  - `pierce`
- `pulse` は `projectileCount: 1`, `spreadAngle: 0`, `pierce: 0` とし、既存射撃挙動を維持する。
- `spread` は `projectileCount` を3以上、`spreadAngle` を正の値にする。
- `pierce` は `pierce` を1以上にする。貫通回数は「追加で命中できる敵数」として扱うとテストしやすい。
- 武器別統計は `WorldState` に `weaponStats` を追加するか、`RunStats` の配下に追加する。
  - 推奨: `weaponStats: Record<WeaponTypeId, WeaponRunStats>`
  - `WeaponRunStats` は `shotsFired`, `projectilesFired`, `hits`, `kills` を持つ。
  - 既存 `RunStats.shotsFired` と `RunStats.enemiesKilled` はResult Summary互換のため維持する。

## 4. PH-GAME-201 Weapon Type Model

### 目的

プレイヤー武器をデータ駆動で扱う基盤を作る。

既存の単一射撃は `pulse` として移行し、移行後も発射間隔、弾速、弾寿命、弾半径、ダメージ、Aim方向、pause/gameOver/restart挙動を維持する。

### 前提/依存

- Phase 2の敵タイプと敵弾が統合済みであること。
- `WorldState.enemyProjectiles` はそのまま維持すること。
- `PH-GAME-202 Spread Weapon`, `PH-GAME-203 Piercing Projectile`, `PH-GAME-204 Weapon Metrics` は、このチケットの型とevent payloadに依存する。
- Phase 4のupgrade選択UIや武器選択UIは未実装であり、このチケットでは実装しないこと。

### 想定編集ファイル

- `phaser/src/domain/types.ts`
  - `WEAPON_TYPE_IDS` と `WeaponTypeId` を追加する。
  - `WeaponSimulationConfig` または同等の型を追加する。
  - `SimulationConfig.bullet` を `weapons: Record<WeaponTypeId, WeaponSimulationConfig>` へ移行する。
  - `GameState.activeWeapon` を追加する。
  - `Bullet.weaponType` と、将来用の `pierceRemaining` を追加する。
  - `GameEvent.shot.fired` に `weaponType` と複数弾に対応できる `bulletIds` を追加する。
- `phaser/src/config/gameConfig.ts`
  - 既存 `bullet` の値を `weapons.pulse` に同値で移す。
  - `pulse` の `projectileCount` は1、`spreadAngle` は0、`pierce` は0にする。
- `phaser/src/config/configSchema.ts`
  - weapon configをZodで検証する。
  - `WEAPON_TYPE_IDS` に沿って必須weapon定義を検証する。
  - 数値は `positive` と `nonnegative` を使い分ける。
- `phaser/src/config/configSchema.test.ts`
  - default config受け入れに加え、required weapon欠落、無効な射撃間隔、無効な弾数などを拒否するテストを追加する。
- `phaser/src/simulation/createWorld.ts`
  - `state.activeWeapon` を `"pulse"` で初期化する。
- `phaser/src/simulation/systems/shootingSystem.ts`
  - `config.weapons[world.state.activeWeapon]` を参照して弾を生成する。
  - `shotTimer` はactive weaponの `fireInterval` を使う。
  - `shot.fired` eventへ `weaponType` と `bulletIds` を含める。
- `phaser/src/simulation/systems/bulletSystem.ts`
  - `Bullet.weaponType` の追加に追従する。移動・寿命・障害物処理の挙動は変えない。
- `phaser/src/simulation/systems/combatSystem.ts`
  - `Bullet.weaponType` の追加に追従する。201では命中時に弾が消える既存挙動を維持する。
- `phaser/src/simulation/systems/statsSystem.ts`
  - `shot.fired` event payload変更に追従し、既存 `world.stats.shotsFired` が1射撃につき1増える状態を維持する。
- `phaser/src/simulation/stepWorld.test.ts`
  - 既存テストの `GAME_CONFIG.bullet` 参照を `GAME_CONFIG.weapons.pulse` へ移す。
  - 手作りBulletに `weaponType: "pulse"` と `pierceRemaining` を追加する。
- `phaser/src/vite-env.d.ts`
  - Debug Snapshotでactive weaponを出す場合は型を更新する。
- `phaser/src/adapters/phaser/ArenaScene.ts`
  - Debug Snapshotへ `activeWeapon` を追加する場合のみ更新する。
- `phaser/src/adapters/phaser/PhaserArenaRenderer.ts`
  - 201単独では描画変更は不要。HUDに武器名を出す場合はvisual影響を報告する。

### 編集禁止/注意ファイル

- `docs/13-phaser-production-implementation-plan.md`, `docs/15-phaser-phase2-agent-task-briefs.md`, `docs/16-phaser-phase3-agent-task-briefs.md`
  - PMから明示依頼がない限り変更しない。
- `phaser/src/simulation/systems/enemySystem.ts`
  - ranged enemyと敵弾発射ロジックを変更しない。
- `phaser/src/simulation/systems/enemyProjectileSystem.ts`
  - 201では敵弾とプレイヤー弾を統合しない。
- `phaser/src/simulation/difficulty.ts`
  - 武器モデル移行で難易度カーブを変えない。
- `phaser/tests/e2e/*`
  - 201で画面挙動を変えないなら原則変更不要。Debug Snapshotの型変更で必要な場合だけ最小変更する。
- `phaser/IMPLEMENTATION_NOTES.md`
  - サブエージェント運用で記録が必要な場合のみ追記する。PM指示でdocs編集を禁じられている場合は変更しない。

### 実装手順

1. `config.bullet` の参照箇所を洗い出す。
2. `WeaponTypeId` と `WeaponSimulationConfig` を追加する。
3. `SimulationConfig` を `bullet` から `weapons` へ移行する。
4. `gameConfig.ts` の既存値を `weapons.pulse` に同値で移す。
   - 既存値: `radius: 4`, `speed: 520`, `lifetime: 1.1`, `interval: 0.16`, `damage: 1`
   - 新名にする場合は `projectileRadius`, `projectileSpeed`, `projectileLifetime`, `fireInterval` へ対応させる。
5. `configSchema.ts` を新構造へ合わせる。
6. `createWorld` で `activeWeapon: "pulse"` を初期化する。
7. `shootingSystem` をactive weapon参照へ変更する。
8. `Bullet` 生成時に `weaponType: "pulse"` と `pierceRemaining: 0` を設定する。
9. `shot.fired` eventを複数弾に対応できるpayloadへ変更する。
10. `statsSystem` と既存テストをpayload変更に追従する。
11. Debug Snapshotにactive weaponを追加するか判断する。
   - 追加する場合は `ArenaScene` と `vite-env.d.ts` を更新する。
   - 追加しない場合も、201の受け入れ条件はUnit/Simulation testで満たせる。
12. `pulse` の既存挙動が変わっていないことをテストで確認する。

### 受け入れ条件

- `WeaponTypeId` が導入され、既存射撃は `pulse` として表現される。
- default configがZod schemaを通る。
- 不正なweapon configがZod schemaで拒否される。
- `createWorld` 後のactive weaponが `"pulse"` である。
- `shootingSystem` が `weapons.pulse` の値から弾を生成する。
- `pulse` の発射間隔、弾速、弾寿命、弾半径、ダメージが既存値と一致する。
- `shot.fired` eventに `weaponType: "pulse"` と発射された弾IDが含まれる。
- `world.stats.shotsFired` は1射撃につき1増える。
- 既存の撃破、接触ダメージ、敵弾ダメージ、pause、gameOver、restart挙動が維持される。
- Phaser importがdomain/simulationへ入っていない。

### 推奨テスト

- `phaser/src/config/configSchema.test.ts`
  - default simulation configを受け入れる。
  - `pulse` 定義欠落を拒否する。
  - `fireInterval <= 0`, `projectileSpeed <= 0`, `projectileLifetime <= 0`, `damage <= 0` を拒否する。
  - `projectileCount < 1`, `spreadAngle < 0`, `pierce < 0` を拒否する。
- `phaser/src/simulation/stepWorld.test.ts`
  - 初期active weaponが `"pulse"`。
  - shooting heldで `pulse` 弾が1発生成される。
  - `shotTimer` が `weapons.pulse.fireInterval` になる。
  - `shot.fired` eventが `weaponType: "pulse"` と `bulletIds` を含む。
  - aimWorldがnullの場合でも既存どおり右方向へ撃つ。
  - pause中にshotTimer、弾数、statsが進まない。

検証コマンド:

```bash
cd phaser
npm run test
npm run typecheck
npm run build
```

Debug Snapshot、Renderer、E2Eを変更した場合:

```bash
cd phaser
npm run test:e2e
```

### サブエージェントへの依頼文テンプレート

```text
作業場所: /home/garchomp-game/workspace/create-game

PH-GAME-201 Weapon Type Modelを実装してください。

参照:
- docs/13-phaser-production-implementation-plan.md
- docs/16-phaser-phase3-agent-task-briefs.md の PH-GAME-201
- phaser/src/domain/types.ts
- phaser/src/config/gameConfig.ts
- phaser/src/config/configSchema.ts
- phaser/src/simulation/createWorld.ts
- phaser/src/simulation/systems/shootingSystem.ts
- phaser/src/simulation/systems/combatSystem.ts
- phaser/src/simulation/systems/statsSystem.ts
- phaser/src/simulation/stepWorld.test.ts
- phaser/src/config/configSchema.test.ts

要件:
- WeaponTypeIdを追加し、既存射撃を pulse として移行する。
- config.bulletを weapons.pulse へ移し、既存バランス値を維持する。
- WorldStateのactive weaponを pulse で初期化する。
- Bulletとshot.fired eventにweapon情報を持たせる。
- Zod schemaでweapon configを検証する。
- 既存のpause/gameOver/restart/敵弾/敵タイプ挙動を壊さない。

禁止/注意:
- 敵弾をプレイヤー弾へ統合しない。
- Sceneへ武器ルールを置かない。
- Upgrade、pickup、level up、武器選択UIは実装しない。
- docsは明示指示がない限り変更しない。

検証:
- cd phaser
- npm run test
- npm run typecheck
- npm run build
- Renderer/E2E/Debug Snapshotを変えた場合は npm run test:e2e

完了時:
- 変更ファイル
- 採用したweapon config構造
- 既存pulse挙動の維持確認
- 実行した検証コマンドと結果
- 残リスク
を報告してください。
```

## 5. PH-GAME-202 Spread Weapon

### 目的

複数方向へ弾を撃つ `spread` 武器を追加し、近距離向けの武器挙動を作る。

1回の射撃入力で複数のプレイヤー弾を生成し、それぞれがactive aim方向を中心に扇状へ飛ぶようにする。

### 前提/依存

- `PH-GAME-201 Weapon Type Model` が統合済みであること。
- `WeaponTypeId` と `SimulationConfig.weapons` があること。
- `Bullet.weaponType` と複数弾に対応した `shot.fired` eventがあること。
- 通常プレイで武器を切り替えるUIはまだ不要。テストでは `world.state.activeWeapon = "spread"` で検証できればよい。
- `pierce` は203の範囲であり、spread弾の `pierceRemaining` は0でよい。

### 想定編集ファイル

- `phaser/src/domain/types.ts`
  - `WeaponTypeId` に `"spread"` を追加する。
  - `WEAPON_TYPE_IDS` を更新する。
  - weapon configに `projectileCount` と `spreadAngle` が未追加なら追加する。
- `phaser/src/config/gameConfig.ts`
  - `weapons.spread` を追加する。
  - 例: 3発、広めの角度、短め射程または低め単発火力など、`pulse` と役割が分かれる値にする。
- `phaser/src/config/configSchema.ts`
  - `spread` 追加に伴う必須weapon定義検証へ追従する。
  - `projectileCount` は正の整数、`spreadAngle` は0以上の有限数として検証する。
- `phaser/src/config/configSchema.test.ts`
  - `spread` 定義欠落や不正な弾数/角度を拒否するテストを追加する。
- `phaser/src/math/vector.ts`
  - 既存の `normalize` に加え、必要ならベクトル回転helperを追加する。
  - 追加した場合は `vector.test.ts` も更新する。
- `phaser/src/simulation/systems/shootingSystem.ts`
  - `projectileCount` と `spreadAngle` から複数弾を生成する。
  - 奇数弾では中心弾がaim方向になるようにする。
  - 偶数弾を許す場合は中心方向を挟んで左右対称にする。
  - `shot.fired` eventの `bulletIds` に全弾IDを含める。
- `phaser/src/simulation/stepWorld.test.ts`
  - active weaponを `spread` にしたとき、1回の射撃で複数弾が生成されることを確認する。
  - 弾角度が左右対称で期待範囲に入ることを確認する。
- `phaser/src/adapters/phaser/PhaserArenaRenderer.ts`
  - 既存弾と同色でよければ変更不要。
  - weapon別色を入れる場合は `ViewConfig` とvisual test影響まで扱う。
- `phaser/tests/e2e/arena-visual.spec.ts`
  - `spread` の見た目を固定したい場合のみ追加する。Unit/Simulationで十分なら不要。

### 編集禁止/注意ファイル

- `docs/13-phaser-production-implementation-plan.md`, `docs/15-phaser-phase2-agent-task-briefs.md`, `docs/16-phaser-phase3-agent-task-briefs.md`
  - PMから明示依頼がない限り変更しない。
- `phaser/src/simulation/systems/combatSystem.ts`
  - spread追加だけなら命中処理変更は不要。203の貫通仕様を先取りしない。
- `phaser/src/simulation/systems/enemySystem.ts`, `phaser/src/simulation/systems/enemyProjectileSystem.ts`
  - 敵側の射撃挙動を変更しない。
- `phaser/src/adapters/phaser/PhaserInputAdapter.ts`
  - 202では武器切替入力を追加しない。
- `phaser/src/simulation/difficulty.ts`
  - spread追加で難易度カーブを変えない。

### 実装手順

1. 201のweapon modelが統合されていることを確認する。
2. `WEAPON_TYPE_IDS` と `WeaponTypeId` に `"spread"` を追加する。
3. `gameConfig.ts` に `weapons.spread` を追加する。
   - `pulse` と同じ弾速でもよいが、役割が分かるように発射間隔、寿命、ダメージ、弾数、角度を調整する。
   - 初期バランス例: `projectileCount: 3`, `spreadAngle: Math.PI / 6`, `pierce: 0`。
4. schemaとschema testを更新する。
5. 弾方向を算出するhelperを実装する。
   - `projectileCount === 1` ならaim方向そのまま。
   - `projectileCount > 1` なら `-spreadAngle / 2` から `+spreadAngle / 2` まで等間隔に配置する。
   - `spreadAngle` はラジアンで扱うと `Math.sin/cos` と整合しやすい。採用単位はconfigコメントまたは型名で明確にする。
6. `shootingSystem` で全弾を生成し、各弾に一意なIDと `weaponType: "spread"` を設定する。
7. 弾の初期位置は各方向ごとに `player.radius + projectileRadius + 2` のoffsetを使う。
8. `shotTimer` は1射撃につき1回だけactive weaponの `fireInterval` に設定する。
9. `shot.fired` eventは1回だけemitし、全弾IDを `bulletIds` に含める。
10. `statsSystem` の既存 `shotsFired` は1射撃につき1増える状態を維持する。
11. Unit/Simulation testで弾数と角度を検証する。

### 受け入れ条件

- `WeaponTypeId` に `"spread"` が追加されている。
- default configが `weapons.spread` を持ち、Zod schemaを通る。
- active weaponが `"spread"` のとき、1回の射撃で複数弾が生成される。
- 生成された全弾の `weaponType` が `"spread"` である。
- 弾方向がaim方向を中心に左右対称または設定どおりの扇状になる。
- `shot.fired` eventが1回だけemitされ、複数の `bulletIds` を含む。
- `world.stats.shotsFired` は複数弾でも1射撃につき1増える。
- `pulse` の既存挙動が変わっていない。
- pause中にspread射撃が発生しない。
- Phaser importがdomain/simulationへ入っていない。

### 推奨テスト

- `phaser/src/config/configSchema.test.ts`
  - default configを受け入れる。
  - `spread` 定義欠落を拒否する。
  - `projectileCount: 0` や小数の弾数を拒否する。
  - `spreadAngle < 0` を拒否する。
- `phaser/src/math/vector.test.ts`
  - 回転helperを追加した場合、90度回転や0度回転を検証する。
- `phaser/src/simulation/stepWorld.test.ts`
  - active weaponを `"spread"` にしてshooting heldで3発以上生成される。
  - `shot.fired` eventの `weaponType` が `"spread"`。
  - `bulletIds` の長さが生成弾数と一致する。
  - 中心弾または平均方向がaim方向と一致する。
  - 左右端の弾角度が `spreadAngle / 2` の範囲に入る。
  - `stats.shotsFired` は1だけ増える。
  - `pulse` は引き続き1発だけ生成される。

検証コマンド:

```bash
cd phaser
npm run test
npm run typecheck
npm run build
```

Renderer、E2E、visual snapshotを変えた場合:

```bash
cd phaser
npm run test:e2e
```

### サブエージェントへの依頼文テンプレート

```text
作業場所: /home/garchomp-game/workspace/create-game

PH-GAME-202 Spread Weaponを実装してください。

前提:
- PH-GAME-201 Weapon Type Modelは統合済みです。

参照:
- docs/13-phaser-production-implementation-plan.md
- docs/16-phaser-phase3-agent-task-briefs.md の PH-GAME-202
- phaser/src/domain/types.ts
- phaser/src/config/gameConfig.ts
- phaser/src/config/configSchema.ts
- phaser/src/simulation/systems/shootingSystem.ts
- phaser/src/simulation/stepWorld.test.ts
- 必要なら phaser/src/math/vector.ts

要件:
- WeaponTypeIdに spread を追加する。
- weapons.spread を追加し、Zod schemaで検証する。
- activeWeaponが spread のとき、1回の射撃で複数弾を扇状に生成する。
- shot.fired eventは1回だけemitし、全bulletIdsを含める。
- stats.shotsFiredは複数弾でも1射撃につき1だけ増やす。
- pulseの既存挙動を維持する。

禁止/注意:
- 武器切替UIやupgrade UIは実装しない。
- 敵弾、敵AI、difficultyを変更しない。
- 貫通仕様はPH-GAME-203で扱うため先取りしない。
- docsは明示指示がない限り変更しない。

検証:
- cd phaser
- npm run test
- npm run typecheck
- npm run build
- Renderer/E2E/visualを変えた場合は npm run test:e2e

完了時:
- 変更ファイル
- spreadのconfig値
- 弾角度の計算方法
- 実行した検証コマンドと結果
- 残リスク
を報告してください。
```

## 6. PH-GAME-203 Piercing Projectile

### 目的

一定回数まで敵を貫通するプレイヤー弾を実装する。

`pierce` 武器または `pierceRemaining` を持つ弾が、複数の敵へ命中できるようにし、貫通回数が尽きたら弾を消す。

### 前提/依存

- `PH-GAME-201 Weapon Type Model` が統合済みであること。
- 202が先に統合されている場合は、spread弾の `pierceRemaining` は0のまま維持する。
- `Bullet.weaponType` と `Bullet.pierceRemaining` を扱えること。
- 敵弾は対象外。`EnemyProjectile` にpierceを追加しない。
- 命中処理は `combatSystem` に閉じ、Sceneへ置かない。

### 想定編集ファイル

- `phaser/src/domain/types.ts`
  - `WeaponTypeId` に `"pierce"` を追加する。
  - `WEAPON_TYPE_IDS` を更新する。
  - `Bullet.pierceRemaining` が未追加なら追加する。
  - 必要なら `Bullet.hitEnemyIds` など、同じ弾が同じ敵へ連続hitしないための状態を追加する。
  - `GameEvent` に `shot.hit` などを追加する場合は、weapon metricsで使いやすいpayloadにする。
- `phaser/src/config/gameConfig.ts`
  - `weapons.pierce` を追加する。
  - `pierce` を1以上にし、弾数や発射間隔は `pulse` と差別化する。
- `phaser/src/config/configSchema.ts`
  - `pierce` weapon定義を必須化する。
  - `pierce` は0以上の整数として検証する。
- `phaser/src/config/configSchema.test.ts`
  - `pierce` 定義欠落や不正な `pierce` を拒否するテストを追加する。
- `phaser/src/simulation/systems/shootingSystem.ts`
  - `weapons.pierce.pierce` から `Bullet.pierceRemaining` を設定する。
- `phaser/src/simulation/systems/combatSystem.ts`
  - 命中後、`pierceRemaining > 0` の弾は消さずに残す。
  - 命中ごとに `pierceRemaining` を1減らす。
  - 同じ弾が同じ敵へ同一フレームまたは連続フレームで多重hitしないようにする。
- `phaser/src/simulation/stepWorld.test.ts`
  - 複数敵に命中できること、貫通回数が0で消えること、score/kills/statsが正しく増えることを検証する。
- `phaser/src/simulation/systems/statsSystem.ts`
  - `shot.hit` eventを追加する場合は追従する。203単独では既存global statsを壊さない。
- `phaser/src/adapters/phaser/PhaserArenaRenderer.ts`
  - 既存弾と同色でよければ変更不要。pierce弾を見分ける描画を入れる場合はViewConfig/schema/visual影響を扱う。

### 編集禁止/注意ファイル

- `docs/13-phaser-production-implementation-plan.md`, `docs/15-phaser-phase2-agent-task-briefs.md`, `docs/16-phaser-phase3-agent-task-briefs.md`
  - PMから明示依頼がない限り変更しない。
- `phaser/src/simulation/systems/enemyProjectileSystem.ts`
  - 敵弾に貫通を追加しない。
- `phaser/src/simulation/systems/enemySystem.ts`
  - ranged enemyの発射ロジックを変更しない。
- `phaser/src/adapters/phaser/PhaserInputAdapter.ts`
  - 203では武器切替入力を追加しない。
- `phaser/src/simulation/difficulty.ts`
  - pierce追加で敵出現難易度を変えない。

### 実装手順

1. 201の `Bullet.weaponType` とweapon config構造を確認する。
2. `WEAPON_TYPE_IDS` と `WeaponTypeId` に `"pierce"` を追加する。
3. `gameConfig.ts` に `weapons.pierce` を追加する。
   - 初期バランス例: 1発、やや遅いfire interval、`pierce: 2`。
4. schemaとschema testを更新する。
5. `shootingSystem` で弾生成時に `pierceRemaining` をweapon定義から設定する。
6. `combatSystem` のプレイヤー弾対敵のループを見直す。
   - 弾ごとに複数敵へ命中できるよう、命中後すぐ `break` しない。
   - 敵が死亡した場合も同じフレーム内の次敵判定へ進める。
   - `pierceRemaining` が0未満にならないようにする。
7. 同じ弾が同じ敵へ何度も当たり続けない対策を入れる。
   - 推奨: `Bullet.hitEnemyIds: string[]` または `Set` 相当を配列で持つ。
   - JSON/debug snapshotへ直接出さないなら配列で十分。
   - 命中済み敵は同じ弾の以後の判定でskipする。
8. 弾の残存条件を定義する。
   - `pierceRemaining > 0` で命中した場合は残す。
   - 命中後に `pierceRemaining === 0` になった弾は、その命中処理を終えた後に消す。
   - `pierce: 0` の弾は既存どおり1命中で消す。
9. 命中eventを追加するか判断する。
   - 204の武器別hit metricsを見据えるなら `shot.hit` eventを追加するとよい。
   - 追加する場合は `weaponType`, `bulletId`, `enemyId`, `damage`, `killed`, `pierceRemaining` を含める。
10. score、enemy.killed event、statsが二重加算されないことを確認する。
11. 複数敵配置のSimulation testで貫通挙動を検証する。

### 受け入れ条件

- `WeaponTypeId` に `"pierce"` が追加されている。
- default configが `weapons.pierce` を持ち、Zod schemaを通る。
- active weaponが `"pierce"` のとき、生成弾に `pierceRemaining` が設定される。
- 貫通弾が複数敵に命中できる。
- 命中ごとに `pierceRemaining` が減る。
- 貫通回数が0になった弾は消える。
- `pierce: 0` の `pulse` と `spread` は既存どおり1命中で消える。
- 同じ弾が同じ敵へ多重hitしない。
- 複数敵を倒した場合、score、`enemy.killed` event、`stats.enemiesKilled` が倒した数だけ正しく増える。
- 敵弾の挙動が変わっていない。
- Phaser importがdomain/simulationへ入っていない。

### 推奨テスト

- `phaser/src/config/configSchema.test.ts`
  - default configを受け入れる。
  - `pierce` 定義欠落を拒否する。
  - `pierce < 0` や小数を拒否する。
- `phaser/src/simulation/stepWorld.test.ts`
  - active weaponを `"pierce"` にして生成弾の `pierceRemaining` がconfig値になる。
  - 直線上に2体以上の敵を置き、1発で複数hitできる。
  - 2体倒した場合、scoreが2体分増える。
  - `enemy.killed` eventが倒した敵ごとに出る。
  - `stats.enemiesKilled` が倒した数だけ増える。
  - `pierceRemaining` が残っている間は弾が残る。
  - `pierceRemaining` が0になったら弾が消える。
  - 同じ敵に対して同じ弾が次フレームで再hitしない。
  - `pulse` は1体命中で消える。

検証コマンド:

```bash
cd phaser
npm run test
npm run typecheck
npm run build
```

Renderer、E2E、visual snapshotを変えた場合:

```bash
cd phaser
npm run test:e2e
```

### サブエージェントへの依頼文テンプレート

```text
作業場所: /home/garchomp-game/workspace/create-game

PH-GAME-203 Piercing Projectileを実装してください。

前提:
- PH-GAME-201 Weapon Type Modelは統合済みです。
- PH-GAME-202 Spread Weaponが統合済みなら、その挙動を維持してください。

参照:
- docs/13-phaser-production-implementation-plan.md
- docs/16-phaser-phase3-agent-task-briefs.md の PH-GAME-203
- phaser/src/domain/types.ts
- phaser/src/config/gameConfig.ts
- phaser/src/config/configSchema.ts
- phaser/src/simulation/systems/shootingSystem.ts
- phaser/src/simulation/systems/combatSystem.ts
- phaser/src/simulation/stepWorld.test.ts

要件:
- WeaponTypeIdに pierce を追加する。
- weapons.pierce を追加し、Zod schemaで検証する。
- pierce弾に pierceRemaining を設定する。
- 貫通弾が複数敵に命中し、命中ごとにpierceRemainingが減るようにする。
- pierceRemainingが0になった弾は消す。
- 同じ弾が同じ敵へ多重hitしないようにする。
- pulse/spreadの既存挙動と敵弾挙動を維持する。

禁止/注意:
- 敵弾に貫通を追加しない。
- 武器切替UIやupgrade UIは実装しない。
- Sceneへ命中ルールを置かない。
- docsは明示指示がない限り変更しない。

検証:
- cd phaser
- npm run test
- npm run typecheck
- npm run build
- Renderer/E2E/visualを変えた場合は npm run test:e2e

完了時:
- 変更ファイル
- pierceのconfig値
- 同じ敵への多重hitを防いだ方法
- 実行した検証コマンドと結果
- 残リスク
を報告してください。
```

## 7. PH-GAME-204 Weapon Metrics

### 目的

武器ごとの発射数、生成弾数、命中数、撃破数を確認できるようにする。

Debug SnapshotまたはMetricsから武器別の状況を取得できるようにし、今後のupgrade調整やバランス調整の土台を作る。

### 前提/依存

- `PH-GAME-201 Weapon Type Model` が統合済みであること。
- 202/203が統合済みなら、`spread` と `pierce` も集計対象にする。
- `shot.fired` eventが `weaponType` と `bulletIds` を持つこと。
- 203で `shot.hit` eventを追加済みなら、それを利用する。
- `enemy.killed` eventだけでは撃破に使った武器を特定できない可能性があるため、必要ならcombat側event payloadを補う。

### 想定編集ファイル

- `phaser/src/domain/types.ts`
  - `WeaponRunStats` を追加する。
  - `WorldState.weaponStats` または `RunStats.weapon` を追加する。
  - `GameEvent` に `shot.hit` を追加済みでなければ追加を検討する。
  - `enemy.killed` eventに `weaponType` を含めるか、`shot.hit` の `killed` で撃破武器を判定できるようにする。
  - `GameMetric` に武器別counter/gaugeを追加する場合は型を拡張する。
- `phaser/src/simulation/createWorld.ts`
  - 全 `WeaponTypeId` の武器別statsを0で初期化する。
- `phaser/src/simulation/systems/statsSystem.ts`
  - `shot.fired` で武器別 `shotsFired` と `projectilesFired` を更新する。
  - `shot.hit` または命中eventで武器別 `hits` を更新する。
  - kill eventまたはhit eventで武器別 `kills` を更新する。
  - 既存global statsを維持する。
- `phaser/src/simulation/systems/combatSystem.ts`
  - 命中数と撃破武器を特定できるeventが不足していれば追加する。
  - `shot.hit` をemitする場合は、非貫通、spread、pierceの全てでemitする。
- `phaser/src/simulation/stepWorld.ts`
  - `GameMetric` として武器別カウンタを出す場合は `collectResult` に追加する。
  - Debug Snapshotだけで満たす場合は変更不要。
- `phaser/src/ports/MetricsPort.ts`
  - Metrics Snapshotに武器別値を出す場合のみ更新する。
- `phaser/src/adapters/telemetry/InMemoryMetrics.ts`
  - `GameMetric` 拡張に合わせる場合のみ更新する。
- `phaser/src/adapters/phaser/PhaserDebugOverlay.ts`
  - Overlayへ武器別値を表示する場合のみ更新する。表示行が増えすぎる場合はDebug Snapshot優先でよい。
- `phaser/src/adapters/phaser/ArenaScene.ts`
  - Debug Snapshotへ `activeWeapon` と `weaponStats` を追加する。
- `phaser/src/vite-env.d.ts`
  - Debug Snapshot型を更新する。
- `phaser/src/simulation/resultSummary.ts`
  - Result Summaryに武器別statsを出す場合のみ更新する。204では必須ではない。
- `phaser/src/simulation/stepWorld.test.ts`
  - weapon stats更新をSimulation testで検証する。
- `phaser/tests/e2e/arena.spec.ts`
  - Debug Snapshotでweapon statsを取得する確認を追加する場合のみ更新する。

### 編集禁止/注意ファイル

- `docs/13-phaser-production-implementation-plan.md`, `docs/15-phaser-phase2-agent-task-briefs.md`, `docs/16-phaser-phase3-agent-task-briefs.md`
  - PMから明示依頼がない限り変更しない。
- `phaser/src/adapters/telemetry/FrameSpikeReporter.ts`
  - frame spike logに武器別statsを混ぜない。per-frameログ肥大化を避ける。
- `phaser/src/adapters/phaser/PhaserArenaRenderer.ts`
  - 204ではゲーム画面HUDを大きく変えない。必要ならDebug OverlayかDebug Snapshotを優先する。
- `phaser/src/simulation/difficulty.ts`
  - metrics追加でゲームバランスを変えない。
- `phaser/src/simulation/systems/enemySystem.ts`, `phaser/src/simulation/systems/enemyProjectileSystem.ts`
  - 武器metricsのために敵AIや敵弾挙動を変えない。

### 実装手順

1. 201から203までのevent payloadを確認する。
2. 集計表面を決める。
   - 最小推奨: `WorldState.weaponStats` とDebug Snapshot。
   - 追加案: `GameMetric` と `InMemoryMetrics` に武器別counterを追加し、Debug Overlayへ概要だけ出す。
3. `WeaponRunStats` を定義する。
   - 推奨項目: `shotsFired`, `projectilesFired`, `hits`, `kills`。
4. `createWorld` で `WEAPON_TYPE_IDS` 全てを0初期化する。
5. `statsSystem` をevent駆動で拡張する。
   - `shot.fired`: `shotsFired += 1`, `projectilesFired += bulletIds.length`。
   - `shot.hit`: `hits += 1`。
   - `shot.hit.killed === true` または `enemy.killed.weaponType`: `kills += 1`。
6. `combatSystem` のeventが不足している場合は `shot.hit` を追加する。
   - payload推奨: `weaponType`, `bulletId`, `enemyId`, `damage`, `hpAfter`, `killed`, `pierceRemaining`。
   - `enemy.killed` を残し、既存global kill statsとResult Summary互換を維持する。
7. Debug Snapshotへ `activeWeapon` と `weaponStats` を追加する。
8. `vite-env.d.ts` をDebug Snapshot型に合わせる。
9. MetricsPortまで拡張する場合は、counter/gauge名を増やしすぎない。
   - 例: `weapon.<type>.shots`, `weapon.<type>.hits`, `weapon.<type>.kills` のような文字列unionは型が肥大化しやすい。
   - まずDebug Snapshotで十分ならMetricsPort拡張は見送ってよい。
10. Unit/Simulation testで発射、命中、撃破の武器別statsを検証する。
11. E2EでDebug Snapshotの取得を確認するか判断する。

### 受け入れ条件

- 武器別statsが0初期化される。
- `pulse`, `spread`, `pierce` のうち実装済みの全武器が集計対象になる。
- 1射撃ごとに該当武器の `shotsFired` が1増える。
- `spread` のように複数弾を出す武器では、`projectilesFired` が弾数分増える。
- 敵へ命中したとき、該当武器の `hits` が増える。
- 敵を撃破したとき、該当武器の `kills` が増える。
- 既存global statsの `shotsFired` と `enemiesKilled` は従来どおり更新される。
- Debug SnapshotまたはMetricsから武器別statsを確認できる。
- per-frame console logを増やしていない。
- Debug Overlayを更新した場合、表示が読み取れる範囲に収まる。
- Phaser importがdomain/simulationへ入っていない。

### 推奨テスト

- `phaser/src/simulation/stepWorld.test.ts`
  - `createWorld` 後、全武器のstatsが0である。
  - `pulse` で1回射撃すると `pulse.shotsFired === 1`, `pulse.projectilesFired === 1`。
  - `spread` が実装済みなら、1回射撃で `spread.shotsFired === 1`, `spread.projectilesFired === projectileCount`。
  - 敵に命中すると該当武器の `hits` が増える。
  - 敵を倒すと該当武器の `kills` が増える。
  - 貫通弾で2体倒した場合、`pierce.hits` と `pierce.kills` が2増える。
  - global `stats.shotsFired` と `stats.enemiesKilled` も既存どおり増える。
  - pause中にweapon statsが増えない。
- `phaser/tests/e2e/arena.spec.ts`
  - Debug Snapshotへ `weaponStats` を追加した場合、射撃後に該当値が増えることを確認する。
- `phaser/src/adapters/telemetry/InMemoryMetrics` 周辺
  - MetricsPortを拡張した場合は、record/getSnapshotのUnit test追加を検討する。

検証コマンド:

```bash
cd phaser
npm run test
npm run typecheck
npm run build
```

Debug Snapshot、Debug Overlay、E2Eを変更した場合:

```bash
cd phaser
npm run test:e2e
```

### サブエージェントへの依頼文テンプレート

```text
作業場所: /home/garchomp-game/workspace/create-game

PH-GAME-204 Weapon Metricsを実装してください。

前提:
- PH-GAME-201 Weapon Type Modelは統合済みです。
- PH-GAME-202/203が統合済みなら、spread/pierceも集計対象にしてください。

参照:
- docs/13-phaser-production-implementation-plan.md
- docs/16-phaser-phase3-agent-task-briefs.md の PH-GAME-204
- phaser/src/domain/types.ts
- phaser/src/simulation/createWorld.ts
- phaser/src/simulation/systems/statsSystem.ts
- phaser/src/simulation/systems/combatSystem.ts
- phaser/src/simulation/stepWorld.ts
- phaser/src/adapters/phaser/ArenaScene.ts
- phaser/src/vite-env.d.ts
- 必要なら phaser/src/ports/MetricsPort.ts
- 必要なら phaser/src/adapters/telemetry/InMemoryMetrics.ts
- phaser/src/simulation/stepWorld.test.ts

要件:
- 武器別の shotsFired, projectilesFired, hits, kills を集計する。
- 既存global statsを維持する。
- Debug SnapshotまたはMetricsから武器別statsを確認できるようにする。
- 命中/撃破武器を特定できない場合はcombat event payloadを補う。
- per-frame console logを増やさない。

禁止/注意:
- game balance、difficulty、敵AI、敵弾挙動を変更しない。
- Result SummaryやHUDを大きく変えない。必要ならDebug Snapshotを優先する。
- FrameSpikeReporterのログを武器別statsで肥大化させない。
- docsは明示指示がない限り変更しない。

検証:
- cd phaser
- npm run test
- npm run typecheck
- npm run build
- Debug Snapshot/E2E/Overlayを変えた場合は npm run test:e2e

完了時:
- 変更ファイル
- 集計対象とした武器
- Debug SnapshotまたはMetricsの確認方法
- 実行した検証コマンドと結果
- 残リスク
を報告してください。
```
