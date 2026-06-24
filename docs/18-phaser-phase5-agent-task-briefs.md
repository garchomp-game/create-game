# Phaser Phase 5 Agent Task Briefs

## 1. 対象

Phase 5: Wave Director and Balance

- `PH-GAME-401 Wave Config`
- `PH-GAME-402 Spawn Budget`
- `PH-GAME-403 Balance Simulation Tests`

## 2. 目的

時間経過に応じて敵構成、spawn頻度、敵速度、同時敵数を変化させる。

Phase 5の重要点は、難易度と出現制御を `config.waves` に集約し、調整しやすいデータ駆動の構造にすることである。

## 3. 実装済み状態

2026-06-20時点でPhase 5は実装済みである。

- `WaveBand` を追加した。
- `config.waves` を追加した。
- `waveDirector.ts` を追加した。
- `spawnSystem` は現在waveからspawn interval、max enemies、spawn budget、enemy weightsを参照する。
- 敵定義からspawn weightとunlock timingを外し、敵側は静的性能値とspawn costだけを持つ。
- `difficulty.ts` は `getWaveDifficulty()` の互換ラッパーになった。
- Zod schemaはwave ordering、first wave start、空weight、budget不整合を検証する。
- 60秒balance simulation testはlate wave到達を確認する。
- Debug snapshotとmetricsは現在wave情報を持つ。

## 4. PH-GAME-401 Wave Config

### Scope

- `phaser/src/domain/types.ts`
- `phaser/src/config/gameConfig.ts`
- `phaser/src/config/configSchema.ts`
- `phaser/src/simulation/waveDirector.ts`
- `phaser/src/simulation/difficulty.ts`
- `phaser/src/simulation/waveDirector.test.ts`
- `phaser/src/config/configSchema.test.ts`

### Requirements

- `WaveBand` は `start`, `spawnInterval`, `speedMultiplier`, `maxEnemies`, `spawnBudget`, `enemyWeights` を持つ。
- `waves[0].start` は必ず0である。
- wave startは昇順である。
- `enemyWeights` は空ではない。
- 難易度値は `config.waves` を唯一の情報源にする。
- 旧 `difficulty.ts` は値を二重管理しない。

### Acceptance Criteria

- `getWaveBand(config, 29.999)` はearly waveを返す。
- `getWaveBand(config, 30)` はmiddle waveを返す。
- `getWaveBand(config, 60)` はlate waveを返す。
- 不正なwave orderingはschemaで拒否される。
- first wave startが0でないconfigはschemaで拒否される。

## 5. PH-GAME-402 Spawn Budget

### Scope

- `phaser/src/config/gameConfig.ts`
- `phaser/src/config/configSchema.ts`
- `phaser/src/simulation/waveDirector.ts`
- `phaser/src/simulation/systems/spawnSystem.ts`
- `phaser/src/simulation/stepWorld.test.ts`
- `phaser/src/simulation/waveDirector.test.ts`

### Requirements

- 各enemy definitionは `spawnCost` を持つ。
- 1 spawn tickごとに現在waveの `spawnBudget` を使う。
- budget内で敵を複数spawnしてよい。
- budgetに収まらない敵はそのtickの候補から除外する。
- weightが設定されている敵は、そのwave budget内でspawn可能でなければならない。

### Acceptance Criteria

- early waveはchaserのみ出る。
- middle waveでは実budgetでbruteが選択可能である。
- budget 1ではbrute/rangedなど高cost enemyが選ばれない。
- max enemiesを超えてspawnしない。
- budget不整合はschemaで拒否される。

## 6. PH-GAME-403 Balance Simulation Tests

### Scope

- `phaser/src/simulation/balance.test.ts`
- `phaser/src/simulation/stepWorld.ts`
- `phaser/src/adapters/phaser/ArenaScene.ts`
- `phaser/src/vite-env.d.ts`

### Requirements

- 固定seedと固定入力で60秒以上simulationを進める。
- late wave到達を明示的に検証する。
- 敵数、弾数、spawn数が上限内であることを検証する。
- Debug snapshotまたはmetricsで現在waveを確認できる。

### Acceptance Criteria

- `world.state.elapsed >= 60` を満たす。
- `maxEnemyCount <= 60` を満たす。
- projectile数が設定した上限を超えない。
- spawn event数が設定した上限を超えない。
- `npm run test` が安定して通る。

## 7. Review Checklist

- `spawnWeight` や `minElapsed` が敵定義に残っていない。
- `difficulty.ts` にhard-coded difficulty値が残っていない。
- wave weightにある敵がbudget不足で永遠に出ない設定になっていない。
- balance testが59.999秒付近で止まっていない。
- UI/演出のためにsimulationへ表示専用stateを追加していない。

## 8. Verification

2026-06-20時点の検証結果:

- `npm run test`: 10 files, 54 tests passed
- `npm run typecheck`: passed
- `npm run build`: passed, with existing Phaser bundle-size warning
- `npm run test:e2e`: 10 Playwright tests passed
