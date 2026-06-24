# Phaser版リファクタリング基本設計

## 1. 設計方針

Phaser版は、以下の層に分ける。

```text
Browser / DOM
  |
Phaser Adapter Layer
  |
Application Layer
  |
Domain Simulation Layer
  |
Pure Utilities / Config
```

依存方向は上から下のみとする。

ドメイン層からPhaser、DOM、外部監視サービスを参照しない。

## 2. 目標ディレクトリ構成

段階的に以下へ近づける。

```text
phaser/
  index.html
  package.json
  tsconfig.json
  vite.config.ts
  src/
    main.ts
    config/
      gameConfig.ts
      configSchema.ts
    domain/
      types.ts
      events.ts
      metrics.ts
    math/
      geometry.ts
      vector.ts
      random.ts
    simulation/
      createWorld.ts
      stepWorld.ts
      difficulty.ts
      systems/
        playerSystem.ts
        aimingSystem.ts
        shootingSystem.ts
        bulletSystem.ts
        spawnSystem.ts
        enemySystem.ts
        combatSystem.ts
        gameOverSystem.ts
    ports/
      InputPort.ts
      LoggerPort.ts
      MetricsPort.ts
      EventBusPort.ts
    adapters/
      phaser/
        createPhaserGame.ts
        ArenaScene.ts
        PhaserInputAdapter.ts
        PhaserArenaRenderer.ts
        PhaserHud.ts
        PhaserDebugOverlay.ts
      telemetry/
        ConsoleLogger.ts
        InMemoryMetrics.ts
        MittEventBus.ts
    test-support/
      fixtures.ts
      simulationHarness.ts
```

初回で全ファイルへ分割する必要はない。先に `types`, `config`, `math`, `simulation`, `adapters/phaser` だけでもよい。

## 3. レイヤー責務

### 3.1 Domain Simulation Layer

ゲームルールを担当する。

責務:

- World初期化
- 固定seed乱数
- 難易度計算
- プレイヤー移動
- 射撃
- 弾の移動と消滅
- 敵スポーン
- 敵追跡
- 衝突解決
- HP、スコア、ゲームオーバー
- ドメインイベント生成
- メトリクス候補生成

禁止:

- Phaserのimport
- DOMアクセス
- `console.log` の直接呼び出し
- `performance.now()` の直接呼び出し
- 描画処理

### 3.2 Application Layer

1フレームの進行を組み立てる。

責務:

- `InputSnapshot` を受け取る
- `stepWorld` を呼ぶ
- 返されたイベントをEventBusへ流す
- メトリクスをMetricsPortへ流す
- ログ対象イベントだけLoggerPortへ渡す

小規模なうちは `ArenaScene` がApplication Layerを兼ねてもよい。ただし、肥大化したら `ArenaGameController` を追加する。

### 3.3 Phaser Adapter Layer

Phaserとドメイン層の接続を担当する。

責務:

- Scene生成
- キー入力、ポインタ入力の読み取り
- `InputSnapshot` 生成
- `WorldState` の描画
- HUD表示
- Debug Overlay表示
- Phaserスケール設定
- GameObjectやGraphicsのライフサイクル

### 3.4 Telemetry Adapter Layer

ログ、メトリクス、イベント通知を担当する。

責務:

- Console出力
- メモリ内メトリクス集計
- 将来のSentry連携
- Debug HUDへの集計値提供

## 4. 中心データモデル

### 4.1 Vec2

```ts
export type Vec2 = {
  x: number;
  y: number;
};
```

### 4.2 Entity

```ts
export type EntityId = string;

export type CircleBody = {
  position: Vec2;
  radius: number;
};

export type Player = CircleBody & {
  id: EntityId;
};

export type Bullet = CircleBody & {
  id: EntityId;
  velocity: Vec2;
  lifetime: number;
  damage: number;
};

export type Enemy = CircleBody & {
  id: EntityId;
  hp: number;
  speed: number;
  enteredArena: boolean;
};
```

現状コードは `x`, `y`, `vx`, `vy` の平坦構造である。移行時は、最初に型だけを合わせるより、テスト追加後に `position` へ寄せる方が安全である。

### 4.3 WorldState

```ts
export type GameStatus = "playing" | "gameOver";

export type GameClock = {
  elapsed: number;
  spawnTimer: number;
  shotTimer: number;
  damageCooldown: number;
};

export type GameStats = {
  score: number;
  hp: number;
};

export type WorldState = {
  status: GameStatus;
  clock: GameClock;
  stats: GameStats;
  lastAim: Vec2;
  player: Player;
  bullets: Bullet[];
  enemies: Enemy[];
  obstacles: Obstacle[];
};
```

`state`, `player`, `bullets`, `enemies` が別々にSceneへ置かれている現状から、単一の `WorldState` へまとめる。

### 4.4 InputSnapshot

```ts
export type InputSnapshot = {
  move: Vec2;
  aimWorld: Vec2 | null;
  shootHeld: boolean;
  restartPressed: boolean;
};
```

この型ができると、キーボードやマウスがなくてもシミュレーションテストを実行できる。

## 5. 1フレーム更新設計

中心APIは以下とする。

```ts
export type StepWorldOptions = {
  dt: number;
  input: InputSnapshot;
  random: RandomSource;
  config: SimulationConfig;
};

export type StepWorldOutput = {
  events: GameEvent[];
  metrics: GameMetric[];
};

export function stepWorld(world: WorldState, options: StepWorldOptions): StepWorldOutput;
```

現在の実装では、呼び出し側の変更量を抑えるために以下のシグネチャを採用している。

```ts
export function stepWorld(
  world: WorldState,
  input: InputSnapshot,
  deltaSeconds: number,
  random: RandomSource,
  config: SimulationConfig,
): StepWorldResult;
```

`GameConfig` は `SimulationConfig` と `ViewConfig` に分離済みであり、ドメインシミュレーション層は描画色やPhaser表示設定を参照しない。

`world` は初期段階では破壊的更新でよい。

理由:

- Phaserの更新ループと相性が良い
- GC負荷を抑えられる
- 現状実装からの移行量が少ない

ただし、テストでは `createWorld()` で毎回新しいWorldを作る。

## 6. 更新順序

`stepWorld` 内の更新順序は以下へ固定する。

1. `dt` を上限付きで正規化する
2. `gameOver` 中ならリスタートだけ処理する
3. 時計を進める
4. クールダウンを進める
5. 照準を更新する
6. プレイヤー移動を処理する
7. 射撃を処理する
8. 弾を移動し、寿命と障害物衝突を処理する
9. 敵をスポーンする
10. 敵を移動する
11. 弾と敵の衝突を処理する
12. 敵とプレイヤーの接触ダメージを処理する
13. HPが0以下ならゲームオーバーにする
14. イベントとメトリクスを返す

この順序をテストで固定する。

## 7. イベント設計

ゲーム内で意味のある出来事を `GameEvent` として扱う。

候補:

```ts
export type GameEvent =
  | { type: "game.started" }
  | { type: "game.restarted" }
  | { type: "game.over"; score: number; elapsed: number }
  | { type: "shot.fired"; bulletId: EntityId; position: Vec2; direction: Vec2 }
  | { type: "enemy.spawned"; enemyId: EntityId; position: Vec2 }
  | { type: "enemy.killed"; enemyId: EntityId; scoreAwarded: number }
  | { type: "player.damaged"; damage: number; hpAfter: number };
```

用途:

- 効果音
- パーティクル
- 画面揺れ
- ログ
- メトリクス
- チュートリアル進行
- 実績

イベントはゲームルールから発生させるが、効果音や描画演出はPhaser側で購読する。

## 8. ロギング設計

### 8.1 LoggerPort

```ts
export type LoggerPort = {
  debug(event: string, fields?: Record<string, unknown>): void;
  info(event: string, fields?: Record<string, unknown>): void;
  warn(event: string, fields?: Record<string, unknown>): void;
  error(event: string, fields?: Record<string, unknown>): void;
};
```

### 8.2 ログ対象

デフォルトで出す:

- game started
- game restarted
- game over
- config validation failed
- asset load failed
- unexpected state

デバッグ時だけ出す:

- enemy spawned
- shot fired
- player damaged
- performance sample

出さない:

- 毎フレームの位置
- 毎フレームの入力
- 毎フレームの衝突チェック

### 8.3 実装候補

初期:

- 独自 `ConsoleLogger`

将来:

- `@sentry/browser` adapter
- `pino` browser adapter

ブラウザゲームでは、per-frameログがすぐに性能問題になる。最初から高機能ロガーを入れるより、`LoggerPort` を先に置く方が安全である。

## 9. メトリクス設計

### 9.1 MetricsPort

```ts
export type MetricSample =
  | { type: "counter"; name: string; value: number; tags?: Record<string, string> }
  | { type: "gauge"; name: string; value: number; tags?: Record<string, string> }
  | { type: "timing"; name: string; valueMs: number; tags?: Record<string, string> };

export type MetricsPort = {
  record(sample: MetricSample): void;
  flush?(): void;
};
```

### 9.2 収集対象

毎フレーム:

- `frame.dt_ms`
- `world.enemies`
- `world.bullets`

イベント発生時:

- `enemy.spawned`
- `enemy.killed`
- `shot.fired`
- `player.damaged`
- `game.over`

一定間隔:

- 平均FPS
- 最大dt
- p95 dt
- 弾数最大値
- 敵数最大値

### 9.3 表示

初期はDebug Overlayで十分。

候補:

- 画面左下にFPS、敵数、弾数、p95 dtを表示
- `F3` で表示切り替え
- 本番ビルドでは非表示または無効化

## 10. 外部ライブラリ設計

### 10.1 導入優先度 高

| ライブラリ | 用途 | 導入理由 | 結合方針 |
| --- | --- | --- | --- |
| TypeScript | 型安全 | 大規模化の前提 | 全体 |
| Vitest | ユニットテスト | Vite構成と相性が良い | テストのみ |
| Playwright | E2E/UI確認 | Canvas表示と操作を実ブラウザで確認 | テストのみ |
| Zod | 設定検証 | JSON化した設定やステージの安全な読み込み | config境界のみ |

### 10.2 導入優先度 中

| ライブラリ | 用途 | 導入条件 | 結合方針 |
| --- | --- | --- | --- |
| mitt | Event Bus | 効果音、演出、UI通知が増えた時 | `EventBusPort` の実装 |
| Phaser Events | Phaser内部イベント | Scene、GameObject、Phaser Systems内だけで閉じる通知 | Phaser adapter内 |
| stats.js | 開発用FPS表示 | Debug Overlayを自前実装しない場合 | dev-only adapter |
| fast-check | 性質ベーステスト | 衝突、clamp、スポーン、不変条件を大量入力で検証したい時 | テストのみ |
| XState | 状態機械 | タイトル、ポーズ、会話、ステージ遷移が複雑化した時 | ゲーム進行層のみ |
| EasyStar.js | グリッド経路探索 | タイルマップ化して敵AIが障害物を回避する必要が出た時 | AI/pathfinding moduleのみ |

### 10.3 導入優先度 低

| ライブラリ | 用途 | 今すぐ避ける理由 |
| --- | --- | --- |
| ECS系 | 大量エンティティ管理 | 現状規模では設計変更が大きい |
| React/Vue/Svelte | UI | Canvas HUDで足りる。DOM UIを増やす段階で再検討 |
| Redux/Zustand | 状態管理 | PhaserゲームループとWorldStateで足りる |
| Rapier/Matter外部導入 | 物理 | 現状の円/矩形衝突なら過剰 |
| Sentry | 本番監視 | 先にLoggerPortとMetricsPortを作る |
| OpenTelemetry JS | 標準テレメトリ | 送信先やバックエンド連携が未定なら重い |
| web-vitals | ページ体験計測 | Canvas内ゲーム性能よりLCP/INP/CLSを見たい段階で検討 |
| axe-core | アクセシビリティ検査 | DOMメニュー、設定画面、ランキング等が増えてから有効 |

### 10.4 Event Busの判断

Phaser内だけの通信なら、まずPhaser標準のEventsを使う。

例:

- Scene内の一時的な通知
- GameObjectとSceneの通信
- Phaser lifecycleイベント

一方で、ドメイン層やDOM UI、外部監視、効果音管理など、Phaserの外側も含む通知が増えたら `EventBusPort` を定義する。

`mitt` は、そのPortの実装候補であり、ドメイン層が直接 `mitt` をimportする形にはしない。

## 11. Phaser物理の扱い

現状は手動衝突で十分である。

Phaser公式のArcade Physicsは、矩形と円を扱う軽量物理で、トップダウンや平台、パズル向けの用途に合う。一方で、今回のゲームは円と矩形の単純衝突で成立しており、手動処理の方がテストしやすい。

判断基準:

- 今のアリーナサバイバルを拡張するだけなら手動衝突を維持
- タイルマップ衝突、スプライトBody、overlap callbackを多用するならArcade Physicsへ移行
- 複合形状、制約、反発、摩擦がゲーム性になるならMatterを検討

ArcadeとMatterを主物理として混ぜる設計は避ける。

## 12. 参照した一次情報

- Phaser Arcade Physics: https://docs.phaser.io/phaser/concepts/physics/arcade
- Phaser TypeScript tutorial: https://phaser.io/tutorials/how-to-use-phaser-with-typescript
- Phaser Vite TypeScript template: https://github.com/phaserjs/template-vite-ts
- Phaser Events: https://docs.phaser.io/phaser/concepts/events
- Vitest Browser Mode: https://vitest.dev/guide/browser/
- Playwright visual comparisons: https://playwright.dev/docs/test-snapshots
- Playwright Trace Viewer: https://playwright.dev/docs/trace-viewer
- fast-check: https://fast-check.dev/
- Zod documentation: https://zod.dev/
- XState documentation: https://stately.ai/docs/xstate
- mitt repository: https://github.com/developit/mitt
- EasyStar.js repository: https://github.com/prettymuchbryce/easystarjs
- stats.js repository: https://github.com/mrdoob/stats.js/
- Sentry Session Replay privacy: https://docs.sentry.io/platforms/javascript/session-replay/privacy/
