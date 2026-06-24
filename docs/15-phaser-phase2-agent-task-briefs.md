# Phaser版 Phase 2 サブエージェント作業票

## 1. 目的

`docs/13-phaser-production-implementation-plan.md` の Phase 2: Enemy Variety を、サブエージェントへそのまま渡せる粒度に分解する。

対象チケット:

- `PH-GAME-101 Enemy Type Model`
- `PH-GAME-102 Brute Enemy`
- `PH-GAME-103 Fast Enemy`
- `PH-GAME-104 Ranged Enemy`

この文書は作業票であり、ここでは実装しない。

## 1.1 実装後ステータス

この文書はPhase 2実装前に、サブエージェントへ渡せる粒度へ分解する目的で作成した。

2026-06-20時点で、メインエージェントが以下を実装済みである。

1. `PH-GAME-101 Enemy Type Model`
2. `PH-GAME-102 Brute Enemy`
3. `PH-GAME-103 Fast Enemy`
4. `PH-GAME-104 Ranged Enemy`

実装後の採用方針:

- `EnemyTypeId` は `"chaser" | "brute" | "fast" | "ranged"`。
- `SimulationConfig` は `enemies: Record<EnemyTypeId, EnemySimulationConfig>` を持つ。
- Phase 2実装時点では各敵タイプが `spawnWeight` と `minElapsed` も持っていた。
- Phase 5実装後は、敵定義は静的性能値と `spawnCost` だけを持ち、出現重みと時間帯は `config.waves` / `waveDirector.ts` に集約している。
- `ranged` は追加で `preferredRange`, `attackInterval`, `projectileRadius`, `projectileSpeed`, `projectileLifetime`, `projectileDamage` を持つ。
- 敵instanceは生成時点の `typeId`, `damage`, `score`, `behavior`, `attackTimer` を持つ。
- 敵弾は `WorldState.enemyProjectiles` と `enemyProjectileSystem` で扱う。
- `enemy.spawned`, `enemy.killed`, `enemy.projectile.fired` eventsは敵タイプを含む。
- Debug Snapshotは `enemyTypeCounts` と `enemyProjectileCount` を返す。

以降の「現状整理」は作業票作成時点のスナップショットとして読む。

## 2. 現状整理

2026-06-20時点の `phaser/src` は、Phase 1 初期バッチ実装後の状態である。

- `GameStatus` は `playing | paused | gameOver`。
- `WorldState` は `stats` と `RunResultSummary` 導出の前提を持つ。
- `WorldState.enemies` は単一の `Enemy` 配列で、敵タイプ情報はまだない。
- `SimulationConfig.enemy` は単一敵の `radius`, `hp`, `damage`, `speed`, `score` を持つ。
- `updateSpawner` は `getDifficulty(elapsed)` の `spawnInterval`, `speedMultiplier`, `maxEnemies` を使い、単一敵だけを生成する。
- `updateEnemies` は全敵をプレイヤーへ直進させる。
- `resolveCombat` は敵撃破スコアと接触ダメージを `config.enemy` から読む。
- `GameEvent.enemy.spawned` と `GameEvent.enemy.killed` は敵タイプを含まない。
- `PhaserArenaRenderer` は敵を単一色で描画する。
- Debug Snapshot は `enemyCount` を返すが、敵タイプ別数や敵弾数は返さない。

## 3. 共通ルール

- Phaser依存は `phaser/src/adapters/phaser` に閉じる。
- `phaser/src/domain`, `phaser/src/simulation`, `phaser/src/math`, `phaser/src/format` にPhaser importを入れない。
- 敵タイプ、敵弾、出現重みはsimulation/domain/configで扱い、Sceneへゲームルールを置かない。
- 既存の `debugPaused` とゲーム内 `paused` の分離を維持する。
- Stats更新は `statsSystem` が `GameEvent[]` を読む後処理方式である。敵追加時に直接 `world.stats` を増やして二重加算しない。
- Result Summaryは `createRunResultSummary(world)` で導出する。敵追加でResult生成ロジックをSceneへ移さない。
- per-frame console logは増やさない。
- 画面に影響する変更はE2Eまたはvisual regressionの必要性を判断し、変更理由を報告する。
- XP/upgrade/pickup本体はPhase 4の範囲である。Phase 2では敵定義に `xpValue` など将来用の値を持たせてもよいが、XPゲージやpickup回収は実装しない。
- Phase 5のWave Directorを先取りしすぎない。Phase 2では軽量な出現条件や重みで十分に留める。

推奨統合順:

1. `PH-GAME-101 Enemy Type Model`
2. `PH-GAME-102 Brute Enemy`
3. `PH-GAME-103 Fast Enemy`
4. `PH-GAME-104 Ranged Enemy`

`PH-GAME-101` が `EnemyTypeId`, config schema, spawn/combat参照の基盤を作るため、102以降を先に実装しない。
複数サブエージェントへ並行依頼する場合も、101の統合後に102/103/104を順番にrebaseして進める。

競合しやすいファイル:

- `phaser/src/domain/types.ts`
- `phaser/src/config/gameConfig.ts`
- `phaser/src/config/configSchema.ts`
- `phaser/src/simulation/systems/spawnSystem.ts`
- `phaser/src/simulation/systems/enemySystem.ts`
- `phaser/src/simulation/systems/combatSystem.ts`
- `phaser/src/simulation/stepWorld.test.ts`

## 4. 推奨モデル

実装時の設計目安であり、サブエージェントは既存コードに合わせて最小変更で実装する。

- `EnemyTypeId` は段階的に拡張する。
  - 101: `"chaser"`
  - 102: `"chaser" | "brute"`
  - 103: `"chaser" | "brute" | "fast"`
  - 104: `"chaser" | "brute" | "fast" | "ranged"`
- `Enemy` は `typeId: EnemyTypeId` を持つ。
- 敵の `radius`, `hp`, `damage`, `speed`, `score`, `xpValue` は敵タイプ定義から生成時に参照する。
- 速度は現行どおりdifficultyの `speedMultiplier` を生成時に反映してよい。
- スコア、接触ダメージ、XP値は、撃破または接触時に `enemy.typeId` から敵タイプ定義を引いて使う。
- `GameEvent.enemy.spawned` と `GameEvent.enemy.killed` は `typeId` を含める。
- `enemy.killed` は将来のXP/pickup接続のため `xpAwarded` を含めるとよい。ただしPhase 2ではXP状態を増やさない。
- 出現制御は最初は `SimulationConfig.enemy.spawnRules` のような軽量な定義でよい。
  - 例: `{ typeId: "chaser", weight: 1, minElapsed: 0 }`
  - `PH-GAME-103` で `fast` の `minElapsed` を使い、中盤以降に出す。
- タイプ別色は必須ではない。見分けやすさのために入れる場合は `ViewConfig` とZod schemaまで整合させる。

## 5. PH-GAME-101 Enemy Type Model

### 目的

敵タイプをデータ駆動で扱う基盤を作る。

既存の単一敵は `chaser` として移行し、移行後もプレイヤーへ直進する既存挙動、スコア、接触ダメージ、スポーン上限、pause/gameOver/restart挙動を維持する。

### 前提/依存

- Phase 1の `Pause State`, `Game Stats`, `Result Summary` が統合済みであること。
- `WorldState.stats` は `GameEvent` 後処理で更新されていること。
- XPやpickup本体は未実装であり、このチケットでは実装しないこと。
- 102以降の敵タイプ追加は、このチケットの型とconfig構造に依存する。

### 想定編集ファイル

- `phaser/src/domain/types.ts`
  - `EnemyTypeId` を追加する。101時点では `"chaser"` のみでよい。
  - `EnemyTypeDefinition` または同等の型を追加する。
  - `EnemySimulationConfig` を単一値から敵タイプ定義群へ拡張する。
  - `Enemy` に `typeId` を追加する。
  - `GameEvent.enemy.spawned` と `enemy.killed` に `typeId` を追加する。
  - `enemy.killed` に `xpAwarded` を追加する場合は、この時点でイベント型へ含める。
- `phaser/src/config/gameConfig.ts`
  - 既存 `enemy` 値を `chaser` 定義として移行する。
  - 既存バランス値を維持する。
- `phaser/src/config/configSchema.ts`
  - enemy type configをZodで検証する。
  - `defaultType`, `types`, `spawnRules` など採用した構造を `.strict()` で検証する。
- `phaser/src/config/configSchema.test.ts`
  - default config受け入れに加え、invalid enemy type configを拒否するテストを追加する。
- `phaser/src/simulation/systems/spawnSystem.ts`
  - `chaser` をタイプ定義から生成する。
  - `enemy.spawned` eventへ `typeId` を含める。
- `phaser/src/simulation/systems/combatSystem.ts`
  - score/damageを `enemy.typeId` の定義から読む。
  - `enemy.killed` eventへ `typeId` と、採用する場合は `xpAwarded` を含める。
- `phaser/src/simulation/systems/enemySystem.ts`
  - 既存 `chaser` 挙動を維持する。
  - まだタイプ分岐が不要なら、`typeId` を見ない実装でもよい。
- `phaser/src/simulation/stepWorld.test.ts`
  - 既存テストの `world.enemies.push` に `typeId: "chaser"` を追加する。
  - spawn/kill/contact damageが移行後も既存値で動くことを確認する。
- `phaser/IMPLEMENTATION_NOTES.md`
  - 実装時は要点と検証結果を追記する。PM指示でdocs編集を禁じられている場合は変更しない。

### 編集禁止/注意ファイル

- `docs/13-phaser-production-implementation-plan.md`, `docs/14-phaser-agent-task-briefs.md`, `docs/15-phaser-phase2-agent-task-briefs.md`
  - PMから明示依頼がない限り変更しない。
- `phaser/src/adapters/phaser/ArenaScene.ts`
  - 101単独ではDebug Snapshot拡張は任意。Sceneへ敵選択やスコア計算を置かない。
- `phaser/src/adapters/phaser/PhaserArenaRenderer.ts`
  - 101単独では描画変更は不要。タイプ別色を入れるならViewConfig/schema/visual影響まで扱う。
- `phaser/src/simulation/systems/statsSystem.ts`
  - `enemy.killed` eventの形を変えた場合のみ追従する。statsの直接加算方式へ戻さない。
- `phaser/src/simulation/difficulty.ts`
  - spawn intervalやmax enemiesの既存挙動を変えない。
- `phaser/src/math/*`, `phaser/src/format/*`
  - 敵タイプモデルでは通常変更不要。

### 実装手順

1. 現行の `EnemySimulationConfig` 利用箇所を洗い出す。
2. `EnemyTypeId` と敵タイプ定義型を追加する。
3. `SimulationConfig.enemy` を、単一敵値ではなく敵タイプ定義を持つ構造へ移行する。
   - 推奨構造例: `defaultType`, `types`, `spawnRules`。
   - 101時点の `types` は `chaser` のみでよい。
4. `gameConfig.ts` の既存値を `chaser` 定義へそのまま移す。
   - `radius: 14`, `hp: 1`, `damage: 12`, `speed: 85`, `score: 10` を維持する。
   - `xpValue` を追加する場合は小さな値にし、XP状態は増やさない。
5. `configSchema.ts` を新構造へ合わせる。
6. 敵タイプ定義を取得する小さなhelperを追加する。
   - 例: `getEnemyTypeDefinition(config, enemy.typeId)`。
   - 不正なtypeIdがruntimeで出ない設計にする。テスト用に例外を出す場合はmessageを明確にする。
7. `spawnSystem` で `chaser` を選択し、`Enemy.typeId` を設定して生成する。
8. `combatSystem` のscore/damage参照を `config.enemy.score` からタイプ定義参照へ移す。
9. `GameEvent.enemy.spawned` と `enemy.killed` のpayloadを更新する。
10. 既存テストを新型へ追従し、挙動が変わらないことを確認する。
11. schema testに、存在しない `defaultType` や負数weightなどを拒否するケースを追加する。

### 受け入れ条件

- `EnemyTypeId` が導入され、既存敵は `chaser` として表現される。
- `Enemy` が `typeId: "chaser"` を持つ。
- default configがZod schemaを通る。
- 不正な敵タイプ定義、存在しないdefault type、負数または0以下の不正weightがZod schemaで拒否される。
- `spawnSystem` が `chaser` を生成し、`enemy.spawned` eventに `typeId` が含まれる。
- `combatSystem` が `chaser` 定義からscoreとdamageを取得する。
- `enemy.killed` eventに `typeId` が含まれる。
- 既存の射撃、撃破、接触ダメージ、pause、gameOver、restart挙動が維持される。
- Phaser importがdomain/simulationへ入っていない。

### 推奨テスト

- `phaser/src/config/configSchema.test.ts`
  - default simulation configを受け入れる。
  - `defaultType` が `types` に存在しないconfigを拒否する。
  - `spawnRules` の `typeId` が `types` に存在しないconfigを拒否する。
  - `weight <= 0` や `minElapsed < 0` を拒否する。
- `phaser/src/simulation/stepWorld.test.ts`
  - spawnされた敵の `typeId` が `"chaser"`。
  - `enemy.spawned` eventに `typeId: "chaser"` が含まれる。
  - chaserを撃破すると既存どおりscoreが10増える。
  - `enemy.killed` eventに `typeId: "chaser"` が含まれる。
  - chaser接触ダメージが既存どおり12で、statsの `hitsTaken` と `damageTaken` が増える。
  - pause中に敵タイプ関連の状態が進まない。

検証コマンド:

```bash
cd phaser
npm run test
npm run typecheck
npm run build
```

E2EやRendererを変更した場合:

```bash
cd phaser
npm run test:e2e
```

### サブエージェントへの依頼文テンプレート

```text
作業場所: /home/garchomp-game/workspace/create-game

PH-GAME-101 Enemy Type Modelを実装してください。

参照:
- docs/13-phaser-production-implementation-plan.md
- docs/15-phaser-phase2-agent-task-briefs.md の PH-GAME-101
- phaser/src/domain/types.ts
- phaser/src/config/gameConfig.ts
- phaser/src/config/configSchema.ts
- phaser/src/simulation/systems/spawnSystem.ts
- phaser/src/simulation/systems/combatSystem.ts
- phaser/src/simulation/systems/enemySystem.ts
- phaser/src/simulation/stepWorld.test.ts
- phaser/src/config/configSchema.test.ts

要件:
- EnemyTypeIdを追加し、既存敵を chaser として移行する。
- enemy configを単一値から敵タイプ定義へ拡張する。
- spawn/kill eventに typeId を含める。
- score/damageは enemy.typeId の定義から読む。
- Zod schemaでenemy type configを検証する。
- 既存のchaser挙動とバランスを維持する。

禁止/注意:
- XP/pickup/upgrade本体は実装しない。
- Sceneへ敵選択、score計算、damage計算を置かない。
- Phaser importをdomain/simulation/math/formatへ入れない。
- statsSystemのGameEvent後処理方針を壊さない。
- docsはPMから明示依頼がない限り変更しない。

完了前に以下を実行し、結果を報告してください。
- cd phaser && npm run test
- cd phaser && npm run typecheck
- cd phaser && npm run build
- E2EまたはRendererを変更した場合は cd phaser && npm run test:e2e
```

## 6. PH-GAME-102 Brute Enemy

### 目的

HPが高く、移動が遅い `brute` 敵を追加する。

`brute` は通常の `chaser` より倒すのに時間がかかり、撃破時のscoreと将来用XP値が高い敵として扱う。

### 前提/依存

- `PH-GAME-101 Enemy Type Model` が統合済みであること。
- `EnemyTypeId`, 敵タイプ定義, `Enemy.typeId`, type別score/damage参照が存在すること。
- XP本体は未実装のため、XPは `xpValue` または `enemy.killed.xpAwarded` として検証する。`WorldState.xp` やpickupは増やさない。
- Wave Directorやspawn budgetはPhase 5の範囲であり、このチケットでは簡易な出現重みに留める。

### 想定編集ファイル

- `phaser/src/domain/types.ts`
  - `EnemyTypeId` に `"brute"` を追加する。
  - 敵タイプ定義やevent payloadが `brute` を扱えることを確認する。
- `phaser/src/config/gameConfig.ts`
  - `brute` 定義を追加する。
  - 推奨値: chaserより大きいradius、高いhp、遅いspeed、高いscore、高いxpValue。
  - spawn ruleを追加する場合は、低めのweightまたは少し遅い `minElapsed` にする。
- `phaser/src/config/configSchema.ts`
  - `EnemyTypeId` enumまたは同等の検証を更新する。
- `phaser/src/config/configSchema.test.ts`
  - `brute` を含むdefault configを検証する。
- `phaser/src/simulation/systems/spawnSystem.ts`
  - 101でspawn ruleが汎用化済みなら、設定追加だけで動くことを確認する。
  - まだchaser固定なら、type weight選択をここで汎用化する。
- `phaser/src/simulation/systems/combatSystem.ts`
  - type別score/xp eventを確認する。101で完了済みなら変更不要の可能性がある。
- `phaser/src/simulation/stepWorld.test.ts`
  - bruteの耐久、score、xpAwardedを確認する。
- `phaser/IMPLEMENTATION_NOTES.md`
  - 実装時は要点と検証結果を追記する。PM指示でdocs編集を禁じられている場合は変更しない。

### 編集禁止/注意ファイル

- `phaser/src/simulation/systems/statsSystem.ts`
  - `enemiesKilled` は敵タイプにかかわらずkill数として1増えるだけでよい。
  - XP未実装のためstatsにXP値を追加しない。
- `phaser/src/adapters/phaser/PhaserArenaRenderer.ts`
  - bruteを見分けやすくするための色変更は任意。radius差だけで十分なら触らない。
  - 色を追加する場合はViewConfig/schema/visual影響をセットで扱う。
- `phaser/src/simulation/difficulty.ts`
  - difficultyの既存数値を大きく変えない。
- `phaser/src/simulation/systems/enemySystem.ts`
  - bruteはchaserと同じ追跡挙動で、速度とHPだけで差を出す。新しいAI分岐は不要。
- `phaser/src/adapters/phaser/ArenaScene.ts`
  - Sceneへbrute専用ロジックを置かない。

### 実装手順

1. `EnemyTypeId` を `"chaser" | "brute"` へ拡張する。
2. `gameConfig.ts` に `brute` 定義を追加する。
   - 例: `hp` は2以上、`speed` はchaser未満、`score` と `xpValue` はchaser超。
   - 接触 `damage` はchaserと同等または少し高い程度に抑える。
3. `spawnRules` を採用している場合は、`brute` のruleを追加する。
   - 序盤を壊さないよう、低weightまたは `minElapsed` を設定する。
4. Zod schemaのtype id検証を更新する。
5. spawn選択がtype weightに対応していない場合は、汎用選択を実装する。
   - weight合計からrandomで1つ選ぶ。
   - 101のchaser-only挙動を壊さない。
6. bruteを手動配置するsimulation testを追加する。
7. bruteが1発では倒れず、2発以上で倒れることを確認する。
8. brute撃破時にbrute定義のscoreが加算されることを確認する。
9. `enemy.killed` eventの `typeId` と `xpAwarded` がbrute値であることを確認する。

### 受け入れ条件

- `EnemyTypeId` に `"brute"` が追加されている。
- default configに `brute` 定義があり、Zod schemaを通る。
- bruteはchaserよりHPが高く、移動速度が遅い。
- bruteは1発では倒れず、2発以上で倒れることがsimulation testで確認されている。
- brute撃破時のscoreはbrute定義の値で加算される。
- `enemy.killed` eventに `typeId: "brute"` が含まれる。
- `xpAwarded` または同等の将来用XP値がbrute定義から取得できる。
- XP/pickup本体、level up、upgrade UIは追加されていない。
- 既存chaserの挙動とテストが維持されている。

### 推奨テスト

- `phaser/src/config/configSchema.test.ts`
  - default configの `brute` 定義を受け入れる。
  - bruteの `hp <= 0`, `speed <= 0`, `score < 0`, `xpValue < 0` を拒否する。
- `phaser/src/simulation/stepWorld.test.ts`
  - bruteを手動配置し、bullet 1発命中後も生存する。
  - 必要弾数ぶん命中させるとbruteが撃破される。
  - brute撃破時にscoreがbrute定義値だけ増える。
  - `enemy.killed` eventに `typeId: "brute"` とbrute用 `xpAwarded` が含まれる。
  - `stats.enemiesKilled` はbrute撃破でも1だけ増える。
  - fixed randomでbrute spawn ruleが選ばれるケースを1つ確認する。random制御が脆い場合はspawn選択helperのunit testに切り出す。

検証コマンド:

```bash
cd phaser
npm run test
npm run typecheck
npm run build
```

RendererやE2Eを変更した場合:

```bash
cd phaser
npm run test:e2e
```

### サブエージェントへの依頼文テンプレート

```text
作業場所: /home/garchomp-game/workspace/create-game

PH-GAME-102 Brute Enemyを実装してください。

参照:
- docs/13-phaser-production-implementation-plan.md
- docs/15-phaser-phase2-agent-task-briefs.md の PH-GAME-102
- phaser/src/domain/types.ts
- phaser/src/config/gameConfig.ts
- phaser/src/config/configSchema.ts
- phaser/src/simulation/systems/spawnSystem.ts
- phaser/src/simulation/systems/combatSystem.ts
- phaser/src/simulation/stepWorld.test.ts

前提:
- PH-GAME-101 Enemy Type Modelが統合済みであること。

要件:
- EnemyTypeIdに brute を追加する。
- bruteはchaserより高HP、低速、高score、高xpValueにする。
- bruteは2発以上で倒れることをsimulation testで確認する。
- brute撃破時のscoreとxpAwardedはbrute定義から取る。
- spawn ruleを追加する場合は低weightまたはminElapsedで序盤を壊さない。

禁止/注意:
- XP/pickup/level up/upgrade本体は実装しない。
- brute専用ロジックをArenaSceneへ置かない。
- statsを直接加算しない。GameEvent後処理方針を維持する。
- Wave Directorやspawn budgetを本格実装しない。
- docsはPMから明示依頼がない限り変更しない。

完了前に以下を実行し、結果を報告してください。
- cd phaser && npm run test
- cd phaser && npm run typecheck
- cd phaser && npm run build
- RendererやE2Eを変更した場合は cd phaser && npm run test:e2e
```

## 7. PH-GAME-103 Fast Enemy

### 目的

HPは低いが移動が速い `fast` 敵を追加し、中盤以降に出現する敵としてゲームプレイに圧力を作る。

`fast` はchaser/bruteとは異なり、到達速度で脅威を作る。攻撃方法は接触ダメージのみでよい。

### 前提/依存

- `PH-GAME-101 Enemy Type Model` が統合済みであること。
- `PH-GAME-102 Brute Enemy` が統合済み、または同じブランチに取り込まれていること。
- spawn ruleまたは同等の出現選択ロジックが存在すること。
- Phase 5のWave Directorは未実装であるため、時間条件は軽量な `minElapsed` などで表現する。

### 想定編集ファイル

- `phaser/src/domain/types.ts`
  - `EnemyTypeId` に `"fast"` を追加する。
- `phaser/src/config/gameConfig.ts`
  - `fast` 定義を追加する。
  - `fast` のspawn ruleを中盤以降に設定する。
- `phaser/src/config/configSchema.ts`
  - type id検証とspawn rule検証を更新する。
- `phaser/src/config/configSchema.test.ts`
  - `fast` と中盤出現条件を含むdefault configを検証する。
- `phaser/src/simulation/systems/spawnSystem.ts`
  - `minElapsed` などの出現条件で候補を絞る。
  - weightに基づく選択が固定seedでテストしやすい形になっていることを確認する。
- `phaser/src/simulation/systems/enemySystem.ts`
  - fastは既存chase挙動を使う。タイプ分岐は不要の可能性がある。
- `phaser/src/simulation/stepWorld.test.ts`
  - fastの速度、出現条件、分布または候補選択を確認する。
- `phaser/IMPLEMENTATION_NOTES.md`
  - 実装時は要点と検証結果を追記する。PM指示でdocs編集を禁じられている場合は変更しない。

### 編集禁止/注意ファイル

- `phaser/src/simulation/difficulty.ts`
  - 必要以上にdifficultyの全体バランスを変更しない。
  - fast出現条件はspawn rule側に置くのを基本にする。
- `phaser/src/simulation/systems/combatSystem.ts`
  - 101でtype別score/damageができていれば、fast追加だけでは大きな変更は不要。
- `phaser/src/adapters/phaser/PhaserArenaRenderer.ts`
  - fastを色で区別する変更は任意。入れる場合はViewConfig/schema/visual影響を確認する。
- `phaser/src/adapters/phaser/ArenaScene.ts`
  - Sceneへ出現条件や敵選択を置かない。
- `phaser/src/simulation/systems/statsSystem.ts`
  - fast撃破でもkill数の扱いは既存と同じ。

### 実装手順

1. `EnemyTypeId` を `"chaser" | "brute" | "fast"` へ拡張する。
2. `gameConfig.ts` に `fast` 定義を追加する。
   - 推奨: `hp` は1、`speed` はchaserより高い、`radius` は同等または少し小さい。
   - `score` と `xpValue` はchaser以上にする。
3. `fast` のspawn ruleを中盤以降に設定する。
   - 目安: `minElapsed: 30`。
   - 序盤では候補に入らないことを明確にする。
4. spawn candidate選択を、現在時刻 `world.state.elapsed` でfilterする。
5. 候補が空の場合は `defaultType` または `chaser` にfallbackする。
6. fixed randomに依存しすぎるテストが不安定なら、spawn候補抽出またはtype選択をpure helperとして切り出す。
7. fastを手動配置し、同じdtでchaserより長く移動することをsimulation testで確認する。
8. elapsedが中盤前のときfastがspawn候補に入らず、中盤以降に入ることをテストする。
9. 既存chaser/bruteのspawn/kill/contact damageテストを維持する。

### 受け入れ条件

- `EnemyTypeId` に `"fast"` が追加されている。
- default configに `fast` 定義があり、Zod schemaを通る。
- fastはchaserより移動速度が速い。
- fastは中盤以降にのみ出現候補へ入る。
- 序盤のspawn候補にfastが入らないことがテストされている。
- 中盤以降にfastが出現しうることがsimulationまたはspawn helper testで確認されている。
- fast撃破時のscoreとxpAwardedはfast定義から取得される。
- fastは接触ダメージ以外の攻撃を持たない。
- Wave Director本体、spawn budget、upgrade、pickupは実装されていない。

### 推奨テスト

- `phaser/src/config/configSchema.test.ts`
  - default configの `fast` 定義とspawn ruleを受け入れる。
  - `fast` の `minElapsed < 0` や `weight <= 0` を拒否する。
- `phaser/src/simulation/stepWorld.test.ts`
  - fastを手動配置し、同じ初期位置とdtでchaserより移動量が大きい。
  - `world.state.elapsed < fast.minElapsed` ではfastがspawn候補に入らない。
  - `world.state.elapsed >= fast.minElapsed` ではfastがspawn候補に入る。
  - fixed randomまたはhelper testでfastが実際に選ばれるケースを確認する。
  - fast撃破時の `enemy.killed` eventに `typeId: "fast"` とfast用 `xpAwarded` が含まれる。

検証コマンド:

```bash
cd phaser
npm run test
npm run typecheck
npm run build
```

RendererやE2Eを変更した場合:

```bash
cd phaser
npm run test:e2e
```

### サブエージェントへの依頼文テンプレート

```text
作業場所: /home/garchomp-game/workspace/create-game

PH-GAME-103 Fast Enemyを実装してください。

参照:
- docs/13-phaser-production-implementation-plan.md
- docs/15-phaser-phase2-agent-task-briefs.md の PH-GAME-103
- phaser/src/domain/types.ts
- phaser/src/config/gameConfig.ts
- phaser/src/config/configSchema.ts
- phaser/src/simulation/systems/spawnSystem.ts
- phaser/src/simulation/systems/enemySystem.ts
- phaser/src/simulation/stepWorld.test.ts

前提:
- PH-GAME-101 Enemy Type Modelが統合済みであること。
- PH-GAME-102 Brute Enemyが統合済み、または同じブランチに取り込まれていること。

要件:
- EnemyTypeIdに fast を追加する。
- fastは低HP、高速の接触型敵にする。
- fastは中盤以降にのみ出現候補へ入れる。
- 序盤ではfastが出ないこと、中盤以降に出うることをsimulationまたはhelper testで確認する。
- fast撃破時のscore/xpAwardedはfast定義から取る。

禁止/注意:
- Wave Directorやspawn budgetを本格実装しない。
- fast専用ロジックをArenaSceneへ置かない。
- ranged攻撃や敵弾はこのチケットで実装しない。
- XP/pickup/level up/upgrade本体は実装しない。
- docsはPMから明示依頼がない限り変更しない。

完了前に以下を実行し、結果を報告してください。
- cd phaser && npm run test
- cd phaser && npm run typecheck
- cd phaser && npm run build
- RendererやE2Eを変更した場合は cd phaser && npm run test:e2e
```

## 8. PH-GAME-104 Ranged Enemy

### 目的

一定距離で停止または減速し、プレイヤー方向へ敵弾を撃つ `ranged` 敵を追加する。

`ranged` は接触だけでなく遠距離からプレイヤーへ圧力をかける敵であり、敵弾の移動、寿命、障害物衝突、プレイヤー衝突をsimulationでテストできる形にする。

### 前提/依存

- `PH-GAME-101 Enemy Type Model` が統合済みであること。
- `PH-GAME-102 Brute Enemy` と `PH-GAME-103 Fast Enemy` が統合済み、または同じブランチに取り込まれていること。
- `EnemyTypeId` は `"chaser" | "brute" | "fast"` まで拡張済みであること。
- `world.bullets` は現時点ではプレイヤー弾である。敵弾を混ぜる場合はowner判定を明示する。
- 推奨は、Phase 3のweapon/projectile modelを先取りしすぎないため、`enemyProjectiles` を別配列として追加すること。

### 想定編集ファイル

- `phaser/src/domain/types.ts`
  - `EnemyTypeId` に `"ranged"` を追加する。
  - ranged用設定型を追加する。
  - `Enemy` に攻撃cooldownまたは `shotTimer` を追加するか、ranged専用状態を持たせる。
  - `EnemyProjectile` 型を追加する場合は、`WorldState.enemyProjectiles` と `nextEnemyProjectileId` を追加する。
  - `GameEvent` に `enemy.projectile.fired` などを追加する場合は、payloadを定義する。
- `phaser/src/config/gameConfig.ts`
  - `ranged` 定義と敵弾設定を追加する。
  - 推奨値: `preferredRange`, `stopRange` または `slowRange`, `fireInterval`, `projectileSpeed`, `projectileRadius`, `projectileLifetime`, `projectileDamage`。
- `phaser/src/config/configSchema.ts`
  - ranged設定と敵弾設定を検証する。
- `phaser/src/config/configSchema.test.ts`
  - ranged設定の正常/異常ケースを追加する。
- `phaser/src/simulation/createWorld.ts`
  - `enemyProjectiles` と `nextEnemyProjectileId` を追加する場合は初期化する。
- `phaser/src/simulation/stepWorld.ts`
  - ranged攻撃更新と敵弾更新をsystem呼び出し順に追加する。
  - pause/gameOver中に敵弾が進まないことを維持する。
- `phaser/src/simulation/systems/enemySystem.ts`
  - rangedの距離制御を追加する。
  - chaser/brute/fastは既存の追跡挙動を維持する。
- `phaser/src/simulation/systems/enemyProjectileSystem.ts`
  - 新規追加する場合、敵弾の生成、移動、寿命、障害物/境界消滅を扱う。
  - 既存 `bulletSystem` と重複が大きい場合は小さな共通helperを検討する。
- `phaser/src/simulation/systems/combatSystem.ts`
  - 敵弾とプレイヤーの衝突を処理する。
  - `player.damaged` eventを既存statsSystemが拾える形で出す。
- `phaser/src/adapters/phaser/PhaserArenaRenderer.ts`
  - 敵弾をCanvasに描画する。
  - ranged敵を見分けやすくする場合はViewConfig/schemaも更新する。
- `phaser/src/adapters/phaser/ArenaScene.ts`
  - Debug Snapshotに `enemyProjectileCount` を追加する場合のみ更新する。
- `phaser/src/vite-env.d.ts`
  - Debug Snapshotを拡張する場合のみ更新する。
- `phaser/src/simulation/stepWorld.test.ts`
  - rangedの距離制御、射撃、敵弾衝突、寿命/障害物消滅を追加する。
- `phaser/tests/e2e/arena.spec.ts`
  - Debug Snapshot拡張や敵弾描画をE2Eで確認する場合に更新する。
- `phaser/tests/e2e/arena-visual.spec.ts`
  - visual regressionが必要な描画変更を固定stepで確認する場合に更新する。
- `phaser/IMPLEMENTATION_NOTES.md`
  - 実装時は要点と検証結果を追記する。PM指示でdocs編集を禁じられている場合は変更しない。

### 編集禁止/注意ファイル

- `phaser/src/simulation/systems/shootingSystem.ts`
  - プレイヤー射撃の `stats.shotsFired` と `shot.fired` eventを敵弾に流用しない。
  - 敵弾発射で `shotsFired` が増えないようにする。
- `phaser/src/simulation/systems/bulletSystem.ts`
  - `world.bullets` をプレイヤー弾として維持するなら変更不要。
  - owner付きprojectileへ統合する場合は、player bulletの既存挙動とtestsを慎重に更新する。
- `phaser/src/simulation/systems/statsSystem.ts`
  - 敵弾被弾も `player.damaged` eventなら既存stats更新で足りる。新しいdamage eventを増やしてstats漏れを作らない。
- `phaser/src/adapters/phaser/ArenaScene.ts`
  - ranged AI、敵弾生成、衝突判定をSceneへ置かない。
- `phaser/src/simulation/difficulty.ts`
  - ranged追加のために全体difficultyを大きく変えない。
- Phase 3のWeapon Type Model
  - 敵弾のために武器タイプ、貫通、spreadなどを先取りしない。
- Phase 4のPickup/XP/Upgrade
  - ranged撃破のXP値設定まではよいが、pickupやlevel upは実装しない。

### 実装手順

1. `EnemyTypeId` を `"chaser" | "brute" | "fast" | "ranged"` へ拡張する。
2. `ranged` の敵タイプ定義をconfigへ追加する。
   - HPは低から中程度、speedはchaser以下、score/xpValueはchaser以上を目安にする。
3. ranged用の攻撃設定を追加する。
   - `preferredRange` または `stopRange`。
   - `fireInterval`。
   - `projectileRadius`, `projectileSpeed`, `projectileLifetime`, `projectileDamage`。
4. Zod schemaでranged設定を検証する。
5. `Enemy` に攻撃timerを持たせる。
   - 生成時に `shotTimer` または `attackCooldown` を初期化する。
   - 全敵へ持たせる場合はchaser/brute/fastでは使わないだけにする。
6. ranged移動を実装する。
   - プレイヤーから遠い場合は近づく。
   - `preferredRange` 以内では停止、または大きく減速する。
   - 障害物移動とarena clampは既存敵と同じ規則を守る。
7. ranged射撃を実装する。
   - cooldownが0以下で、プレイヤー方向へ敵弾を生成する。
   - 方向は正規化し、ゼロ距離の場合は直近方向またはfallback方向を使う。
   - `enemy.projectile.fired` eventを出す場合は `enemyId`, `projectileId`, `position`, `direction` を含める。
8. 敵弾更新systemを追加する。
   - 位置更新。
   - lifetime減少。
   - arena外、lifetime切れ、障害物衝突で削除。
9. `combatSystem` で敵弾とプレイヤーの衝突を処理する。
   - 衝突時は敵弾を削除する。
   - player HPを実ダメージ量だけ減らす。
   - 既存 `player.damaged` eventを出し、statsSystemが拾えるようにする。
   - 接触ダメージのcooldownと敵弾ダメージcooldownを共有するかは明確に決める。推奨は既存 `damageCooldown` を共有し、連続被弾を抑える。
10. `stepWorld` の呼び出し順を調整する。
    - player/aim/shooting/player bullet/spawn/enemy movement/ranged attack/enemy projectile/combat/gameOver/stats のように、既存挙動を壊さない順にする。
    - pause/gameOver中は新systemを呼ばない。
11. Rendererで敵弾を描画する。
12. 必要なら Debug Snapshotに `enemyProjectileCount` を追加する。
13. simulation testを追加し、E2E/visualが必要なら固定stepで安定化する。

### 受け入れ条件

- `EnemyTypeId` に `"ranged"` が追加されている。
- default configに `ranged` と敵弾設定があり、Zod schemaを通る。
- rangedは一定距離で停止または減速する。
- rangedはcooldownに従ってプレイヤー方向へ敵弾を撃つ。
- 敵弾は寿命切れ、arena外、障害物衝突で消える。
- 敵弾がプレイヤーに当たるとHPが減り、`player.damaged` eventが出る。
- 敵弾被弾で `stats.hitsTaken` と `stats.damageTaken` が更新される。
- 敵弾発射で `stats.shotsFired` は増えない。
- pause中はranged移動、ranged射撃、敵弾移動、敵弾衝突が進まない。
- gameOver中は敵弾が進まない。
- player bullet、chaser、brute、fastの既存挙動が維持されている。
- Phase 3の武器タイプモデルやPhase 4のpickup/upgrade本体を先取りしていない。

### 推奨テスト

- `phaser/src/config/configSchema.test.ts`
  - default configの `ranged` と敵弾設定を受け入れる。
  - `fireInterval <= 0`, `projectileSpeed <= 0`, `projectileLifetime <= 0`, `preferredRange <= 0` を拒否する。
- `phaser/src/simulation/stepWorld.test.ts`
  - rangedが遠距離ではプレイヤーへ近づく。
  - rangedが `preferredRange` 付近では停止または移動量が小さくなる。
  - cooldownがreadyのrangedが敵弾を1つ生成する。
  - cooldown中は追加敵弾を生成しない。
  - 敵弾のvelocityがプレイヤー方向を向く。
  - 敵弾がlifetime切れで消える。
  - 敵弾が障害物に当たると消える。
  - 敵弾がプレイヤーに当たるとHPが減り、敵弾が消える。
  - 敵弾被弾で `player.damaged` eventが出て、statsが更新される。
  - 敵弾発射では `stats.shotsFired` が増えない。
  - pause中にranged射撃と敵弾移動が進まない。
- `phaser/tests/e2e/arena.spec.ts`
  - Debug Snapshotに `enemyProjectileCount` を追加した場合、固定stepで敵弾数を確認する。
- `phaser/tests/e2e/arena-visual.spec.ts`
  - 敵弾描画をvisual対象にする場合、Debug Hookの固定stepでrangedと敵弾を安定して表示する。

検証コマンド:

```bash
cd phaser
npm run test
npm run typecheck
npm run build
```

Renderer、Debug Snapshot、E2Eを変更した場合:

```bash
cd phaser
npm run test:e2e
```

visual snapshot更新が必要な場合:

```bash
cd phaser
npm run test:e2e -- tests/e2e/arena-visual.spec.ts --update-snapshots=changed
```

### サブエージェントへの依頼文テンプレート

```text
作業場所: /home/garchomp-game/workspace/create-game

PH-GAME-104 Ranged Enemyを実装してください。

参照:
- docs/13-phaser-production-implementation-plan.md
- docs/15-phaser-phase2-agent-task-briefs.md の PH-GAME-104
- phaser/src/domain/types.ts
- phaser/src/config/gameConfig.ts
- phaser/src/config/configSchema.ts
- phaser/src/simulation/createWorld.ts
- phaser/src/simulation/stepWorld.ts
- phaser/src/simulation/systems/enemySystem.ts
- phaser/src/simulation/systems/combatSystem.ts
- phaser/src/simulation/stepWorld.test.ts
- phaser/src/adapters/phaser/PhaserArenaRenderer.ts
- phaser/src/adapters/phaser/ArenaScene.ts
- phaser/src/vite-env.d.ts

前提:
- PH-GAME-101 Enemy Type Modelが統合済みであること。
- PH-GAME-102 Brute EnemyとPH-GAME-103 Fast Enemyが統合済み、または同じブランチに取り込まれていること。

要件:
- EnemyTypeIdに ranged を追加する。
- rangedは一定距離で停止または減速し、プレイヤー方向へ敵弾を撃つ。
- 敵弾は寿命、arena外、障害物衝突で消える。
- 敵弾がプレイヤーに当たると既存のplayer.damaged eventを出し、statsに反映される。
- 敵弾発射でstats.shotsFiredを増やさない。
- pause/gameOver中はranged射撃と敵弾更新を進めない。
- 敵弾はCanvas上で確認できるように描画する。

禁止/注意:
- weapon type model、spread、pierceなどPhase 3機能を先取りしない。
- XP/pickup/level up/upgrade本体は実装しない。
- ranged AIや敵弾衝突をArenaSceneへ置かない。
- player bulletの既存挙動を壊さない。
- statsを直接加算しない。GameEvent後処理方針を維持する。
- docsはPMから明示依頼がない限り変更しない。

完了前に以下を実行し、結果を報告してください。
- cd phaser && npm run test
- cd phaser && npm run typecheck
- cd phaser && npm run build
- Renderer、Debug Snapshot、E2Eを変更した場合は cd phaser && npm run test:e2e
```

## 9. 競合回避メモ

同時に複数エージェントへ依頼する場合の分担目安:

- `PH-GAME-101` は必ず先に単独統合する。
- `PH-GAME-102` と `PH-GAME-103` はどちらも `EnemyTypeId`, `gameConfig`, `spawnRules`, testsを触るため、同時作業する場合も片方を先に統合してからもう片方を追従させる。
- `PH-GAME-104` は `WorldState`, `createWorld`, `stepWorld`, renderer, debug型まで触る可能性が高く、最後に統合する。

避けたい並行作業:

- 102/103/104が別々に `EnemyTypeId` unionを編集して競合する。
- 102/103がspawn選択helperを別々の形で実装する。
- 104が敵弾をplayer bulletへ混ぜ、同時にPhase 3側がweapon/projectile modelを設計する。
- Rendererのタイプ別色対応とViewConfig/schema対応が別々の作業になる。
- Debug Snapshotの型変更とE2E更新が別々の作業になる。

PM側で並行依頼する場合は、101完了後に102、103、104の順で短いバッチとして統合する。

## 10. Definition of Done

Phase 2の各チケットは以下を満たす。

- 実装が設計レイヤーに沿っている。
- Phaser importがsimulation/domain/math/formatへ漏れていない。
- Zod schemaとTypeScript型が乖離していない。
- 新しい敵タイプはdefault configに含まれ、schema testを通る。
- 敵タイプごとのscore/damage/xpValueがconfig由来である。
- Unit/Simulation testが追加または更新されている。
- UI/描画/Debug Snapshotに影響する場合はE2Eまたはvisual regressionが追加/更新されている。
- pause/gameOver/restartの既存挙動が壊れていない。
- Statsの二重加算がない。
- `npm run test` が通る。
- `npm run typecheck` が通る。
- `npm run build` が通る。
- E2E対象を変更した場合は `npm run test:e2e` が通る。

## 11. 品質ゲート

通常の変更:

```bash
cd phaser
npm run test
npm run typecheck
npm run build
```

UI/描画/入力/Debug Snapshot/状態遷移を変更した場合:

```bash
cd phaser
npm run test:e2e
```

visual regressionを意図的に更新する場合:

```bash
cd phaser
npm run test:e2e -- tests/e2e/arena-visual.spec.ts --update-snapshots=changed
```
