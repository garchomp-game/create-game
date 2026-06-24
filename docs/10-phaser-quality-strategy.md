# Phaser版品質戦略と実行計画

## 1. 目的

Phaser版を本格化する前に、品質を支える仕組みを段階的に入れる。

対象:

- ロギング
- メトリクス
- ユニットテスト
- シミュレーションテスト
- ブラウザUI動作確認
- 視覚回帰確認
- サブエージェントによるレビュー、監査、アイデア出し

## 2. ロギング戦略

### 2.1 原則

ログはゲームループの外側で扱う。

ドメイン層は `GameEvent` を返すだけにし、ログとして出すかどうかはApplication LayerまたはAdapter Layerで判断する。

### 2.2 ログレベル

| レベル | 用途 |
| --- | --- |
| `debug` | 開発時の詳細確認。shot、spawn、damageなど |
| `info` | セッション開始、リスタート、ゲームオーバー |
| `warn` | 想定外だが復旧可能な状態 |
| `error` | 起動不能、設定不正、アセット読み込み失敗 |

### 2.3 ログイベント

初期ログ対象:

| イベント | レベル | フィールド |
| --- | --- | --- |
| `game.started` | `info` | seed, configVersion |
| `game.restarted` | `info` | elapsedBeforeRestart, scoreBeforeRestart |
| `game.over` | `info` | score, elapsed, enemies, bullets |
| `config.invalid` | `error` | issues |
| `world.invalid_state` | `warn` | reason |
| `performance.frame_spike` | `warn` | dtMs, enemies, bullets |

デバッグ時のみ:

| イベント | レベル | フィールド |
| --- | --- | --- |
| `enemy.spawned` | `debug` | enemyId, x, y |
| `enemy.killed` | `debug` | enemyId, scoreAwarded |
| `shot.fired` | `debug` | bulletId, x, y, dx, dy |
| `player.damaged` | `debug` | damage, hpAfter |

### 2.4 実装案

初期実装:

```text
LoggerPort
  ConsoleLogger
  NullLogger
```

将来実装:

```text
LoggerPort
  LoglevelLogger
  SentryLogger
  BufferedLogger
```

本格運用前にSentryを入れる場合でも、ドメイン層からSentryを直接呼ばない。

`loglevel` のような軽量ロガーは、開発時にログレベルを実行時変更したい場合だけ検討する。単に `console` を包むだけで足りる段階では、自前 `ConsoleLogger` の方が依存を増やさずに済む。

Sentry Session Replayを使う場合は、導入前に必ずプライバシー設定を検証する。Canvasゲームでも、DOM、入力、周辺UI、エラーメタデータにユーザー情報が含まれる可能性がある。

## 3. メトリクス戦略

### 3.1 目的

ゲームの面白さ以前に、以下を測れるようにする。

- フレーム落ちがいつ起きるか
- 敵数と弾数の増加でどこから重くなるか
- スポーン、ヒット、接触ダメージが想定通り起きているか
- ゲームオーバーまでの平均時間が短すぎないか

### 3.2 メトリクス分類

| 種類 | 例 |
| --- | --- |
| Counter | shot count, enemy spawned, enemy killed, damage taken |
| Gauge | current enemies, current bullets, current hp |
| Timing | frame dt, simulation step time, render time |
| Summary | average fps, p95 dt, max enemies, max bullets |

### 3.3 実装ステップ

1. `InMemoryMetrics` を作る
2. `record()` でCounter/Gauge/Timingを受ける
3. 1秒ごとに集計する
4. Debug Overlayへ表示する
5. 閾値超過時だけLoggerへwarnを出す

### 3.4 初期閾値

| 指標 | 閾値 | 反応 |
| --- | ---: | --- |
| `dt` | `50 ms` 超過 | `performance.frame_spike` |
| 敵数 | `60` 超過 | 原則発生しない。発生したらwarn |
| 弾数 | `150` 超過 | 調整検討 |
| シミュレーション時間 | `8 ms` 超過 | 最適化候補 |

## 4. テスト戦略

### 4.1 テスト階層

```text
Unit Tests
  Pure math/config/domain functions

Property-Based Tests
  Domain invariants with generated inputs

Simulation Tests
  WorldState + InputSnapshot + fixed dt + fixed seed

Adapter Smoke Tests
  Phaser Scene boots in browser

E2E/UI Tests
  Playwright controls browser and inspects canvas/screenshot

Manual Play Checks
  Human verifies game feel and balance
```

### 4.2 Unit Tests

ツール:

- Vitest

対象:

- `normalize`
- `clamp`
- `circleCircle`
- `circleRect`
- `formatTime`
- `getDifficulty`
- `createRandom`

代表ケース:

- `normalize(0, 0)` は `{ x: 0, y: 0 }`
- 斜め入力は長さ1になる
- `getDifficulty(29.999)` と `getDifficulty(30)` の境界
- `formatTime(65)` は `01:05`
- 円同士が接する境界で当たる
- 円と矩形が角で接する境界で当たる

### 4.3 Simulation Tests

Phaserを起動せず、Worldだけを進める。

代表ケース:

- 固定seedでスポーン位置が再現される
- `maxEnemies` を超えてスポーンしない
- 1フレームで最大2体までしかスポーンしない
- `shotTimer` 中は弾が増えない
- 弾が敵に当たると敵が消え、スコアが増える
- 接触ダメージはクールダウン中に連続発生しない
- HPが0になると `game.over` イベントが出る
- `restartPressed` でWorldが初期化される

### 4.4 Property-Based Tests

代表ケースのUnit Testが揃ってから、`fast-check` を検討する。

向いている対象:

- `normalize` の出力長が0または1に近い
- `clamp` の出力が常に範囲内になる
- 移動後のプレイヤーがアリーナ境界内に残る
- `maxEnemies` を超えない
- HPが0未満になっても最終表示値は0に丸められる
- 弾寿命が0以下になった弾は残らない

向いていない対象:

- ゲームの面白さ
- 視覚的な気持ちよさ
- 時間依存のアニメーション
- Phaser rendererの細かい挙動

### 4.5 Browser Smoke Tests

ツール:

- Playwright

確認項目:

- ページが起動する
- Canvasが存在する
- スクリーンショットが背景単色ではない
- `W` を押すと描画が変わる
- `Space` またはクリックで描画が変わる
- Game Over状態に遷移できるテストフックがある
- `R` でリスタートできる
- console errorとpage errorがない

失敗時の調査用に、Playwright traceを保存できる設定にする。traceはCI上の失敗を後から再生しやすくするため、常時保存ではなく失敗時保存を基本にする。

### 4.6 Visual Regression Tests

Playwrightのスクリーンショット比較を使う。

最初から厳密なピクセル一致を狙わない。

推奨:

- `debugSeed` を固定する
- `fixedDt` モードを用意する
- 初期画面、射撃後、Game Overの3枚から始める
- 差分許容量を広めにする

Canvasは環境差が出やすいため、最初は「完全一致」より「大きな崩れ検出」を目的にする。

### 4.7 DOM UI Accessibility Tests

現状の主要UIはCanvas内のため、アクセシビリティ自動検査の効果は限定的である。

以下を追加した段階で `@axe-core/playwright` を検討する。

- タイトル画面
- 設定画面
- ポーズメニュー
- ランキング
- 装備選択
- キーコンフィグ

## 5. UI動作確認戦略

### 5.1 テストフック

E2Eを安定させるため、開発時だけ以下を公開する。

```ts
window.__ARENA_DEBUG__ = {
  getSnapshot(): DebugSnapshot;
  forceDamage(amount: number): void;
  forceGameOver(): void;
  restart(): void;
  setPaused(paused: boolean): void;
  step(input?: Partial<InputSnapshot>, deltaSeconds?: number): void;
};
```

本番ビルドでは無効にする。

### 5.2 DebugSnapshot

```ts
type DebugSnapshot = {
  status: GameStatus;
  elapsed: number;
  hp: number;
  score: number;
  player: Vec2;
  lastAim: Vec2;
  bulletCount: number;
  enemyCount: number;
  lastEvents: GameEvent[];
};
```

Canvasのピクセルだけでは内部状態を読みにくいため、テスト用スナップショットを用意する。

### 5.3 手動確認チェックリスト

各リファクタリング段階で確認する。

- 起動直後にプレイできる
- WASDと矢印キーの両方で移動できる
- 斜め移動が速すぎない
- マウス方向へ照準が向く
- 左クリックとSpaceで連射できる
- 弾が障害物に当たると消える
- 敵が障害物に引っかかってもゲームが止まらない
- 敵接触でHPが減る
- HP 0でGame Overが出る
- `R` で再開できる
- ブラウザリサイズでCanvasが中央に収まる

## 6. サブエージェント活用方針

### 6.1 使うべき場面

サブエージェントは、以下で効果が出る。

- 現状コードの監査
- ライブラリ候補の調査
- テスト観点の洗い出し
- リファクタリング後のレビュー
- 特定モジュールだけの実装
- E2Eテストだけの実装

### 6.2 使わない方がよい場面

以下は単一エージェントで進める方が安全である。

- 全体アーキテクチャの最終判断
- `ArenaScene` の大規模分割
- TypeScript移行と複数モジュール抽出の同時実施
- 同じファイルを複数エージェントで編集する作業

### 6.3 安全な分担単位

| 担当 | 書き込み範囲 | 内容 |
| --- | --- | --- |
| 型・設定担当 | `src/domain`, `src/config` | 型と設定の抽出 |
| math担当 | `src/math`, `src/**/*.test.ts` | 純粋関数とUnit Test |
| simulation担当 | `src/simulation` | World更新の抽出 |
| Phaser adapter担当 | `src/adapters/phaser` | Scene、入力、描画 |
| quality担当 | `tests`, `playwright.config.ts` | E2Eと視覚確認 |
| review担当 | 書き込みなし | 差分レビュー |

### 6.4 サブエージェントへの依頼テンプレート

```text
対象は phaser プロジェクトです。
あなたは <担当名> です。
書き込み範囲は <範囲> のみです。
他のファイルは読んでよいですが、編集しないでください。
他の作業者の変更を巻き戻さないでください。
目的は <目的> です。
完了時に、変更ファイル、確認コマンド、残リスクを報告してください。
```

## 7. 段階的実行計画

### Phase 0: ベースライン固定

目的:

- 現状挙動を壊さないための基準を作る

作業:

- 現在の `npm run build` を確認
- Playwright smoke testを保存
- 初期画面のスクリーンショットを保存
- `IMPLEMENTATION_NOTES.md` に現状を追記

完了条件:

- 既存JS実装が動く
- ブラウザスモークテストがある

### Phase 1: TypeScript化

目的:

- 型の足場を作る

作業:

- `typescript` を追加
- `tsconfig.json` を追加
- `main.js` を `main.ts` へ変更
- Vite設定を必要最小限で整える
- Phaser起動を `main.ts` に限定する

完了条件:

- `npm run build`
- `npm run dev`
- 現状と同じゲームが動く

### Phase 2: 純粋関数抽出

目的:

- 最初のテスト可能単位を作る

作業:

- `math/geometry.ts`
- `math/vector.ts`
- `simulation/difficulty.ts`
- `math/random.ts`
- `format/time.ts` または `domain/format.ts`
- Vitest導入
- Unit Test追加

完了条件:

- `npm run test`
- `npm run build`

### Phase 3: WorldState抽出

目的:

- Sceneからゲーム状態を分離する

作業:

- `domain/types.ts`
- `config/gameConfig.ts`
- `simulation/createWorld.ts`
- `simulation/stepWorld.ts`
- `InputSnapshot` 導入

完了条件:

- Sceneは `input -> stepWorld -> render` の形に近づく
- 固定入力列のSimulation Testがある

### Phase 4: Systems分割

目的:

- 更新処理を責務別に切る

作業:

- `playerSystem`
- `aimingSystem`
- `shootingSystem`
- `bulletSystem`
- `spawnSystem`
- `enemySystem`
- `combatSystem`
- `gameOverSystem`

完了条件:

- 各systemに最低1つ以上のテストがある
- 既存挙動が維持される

### Phase 5: Adapter分離

目的:

- Phaser依存を閉じ込める

作業:

- `PhaserInputAdapter`
- `PhaserArenaRenderer`
- `PhaserHud`
- `PhaserDebugOverlay`
- `createPhaserGame`

完了条件:

- `ArenaScene` が薄くなる
- `ArenaScene` はPhaser lifecycleと接続だけを担当する

### Phase 6: Telemetry導入

目的:

- ログとメトリクスを粗結合で入れる

作業:

- `LoggerPort`
- `ConsoleLogger`
- `MetricsPort`
- `InMemoryMetrics`
- Debug Overlay
- `F3` 表示切り替え

完了条件:

- per-frameログなし
- Debug OverlayでFPS、敵数、弾数が見える
- frame spikeがwarnとして出せる

### Phase 7: UI/E2E確認強化

目的:

- リファクタリング後の破壊を検出する

作業:

- Playwright導入
- smoke test
- trace on failure
- debug snapshot hook
- Game Over/restart test
- 主要画面のスクリーンショット比較

完了条件:

- `npm run test:e2e`
- console errorなし
- canvas nonblank
- restart確認済み

### Phase 8: ライブラリ追加の判断

目的:

- 必要なものだけ入れる

判断:

- JSON設定やステージを読むならZod
- イベント購読先が複数になったらmitt
- Phaser内だけのイベントならPhaser Events
- 衝突や境界の不変条件を広く検証したいならfast-check
- タイルマップ化するならEasyStar.jsまたはPhaser Tilemap
- 状態遷移が複雑化したらXState
- DOM UIが増えたらaxe-core
- ページ体験も見るならweb-vitals
- 本番公開するならSentry。ただしSession Replayはプライバシー設定を先に検証する
- バックエンドや社内基盤がOpenTelemetry前提ならOpenTelemetry JS

## 8. リスクと対策

| リスク | 内容 | 対策 |
| --- | --- | --- |
| 挙動が変わる | リファクタでゲーム感が変わる | 固定seed、固定dt、スナップショットテスト |
| 型移行が膨らむ | 一気にstrict化して詰まる | 段階的にstrict化 |
| Scene分割で壊れる | Phaser lifecycleを壊す | 起動点とAdapterは最後に薄く切る |
| ログ過多 | per-frameログで重くなる | event-driven loggingのみ |
| E2Eが不安定 | Canvasと時間依存で揺れる | fixed seed、debug hook、許容差あり |
| 外部ライブラリ過多 | 本体より接着コードが増える | Portを先に作り、必要時だけ実装を差し替える |
| 監視のプライバシー事故 | Replayや外部送信で意図しない情報が残る | Sentry等はmasking、sampling、送信内容を確認してから有効化 |
| 画面差分のflaky化 | フォント、GPU、時間で差分が揺れる | 代表画面だけ、固定seed、広めの許容差、trace保存 |

## 9. 最初に実装するなら

次の実装フェーズで最初に行うべき最小セットは以下である。

1. TypeScript化
2. `main.ts` と `ArenaScene.ts` の分離
3. `config/gameConfig.ts` の抽出
4. `math/geometry.ts` の抽出
5. Vitest導入
6. geometry/difficulty/timeのUnit Test追加
7. `npm run build` と `npm run test`

ここまでなら挙動変更のリスクが低く、以降の大きな分割の足場になる。
