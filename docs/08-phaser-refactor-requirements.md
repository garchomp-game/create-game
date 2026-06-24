# Phaser版リファクタリング要件

## 1. 目的

現在の `phaser` 実装を、比較用プロトタイプから本格的なゲーム開発の土台へ移行する。

今回のフェーズでは、ゲーム内容を増やすことよりも、以下を優先する。

- Phaser依存のコードとゲームルールを分離する
- TypeScriptでデータ構造と境界を明確にする
- テスト可能な純粋ロジックを増やす
- ログ、メトリクス、UI動作確認を後から差し込める形にする
- 外部ライブラリを導入する場合でも、ゲーム本体が密結合にならないようにする
- 将来の追加機能、アセット化、敵種類追加、武器追加、ステージ追加に耐える構造へ寄せる

## 2. 現状認識

対象は当初 `phaser/src/main.js` だった。現在はTypeScript化済みで、起動点は `phaser/src/main.ts`、Phaser Sceneは `phaser/src/adapters/phaser/ArenaScene.ts` に分離済みである。

現状は、小規模プロトタイプとしては読みやすい。一方で、本格化するには以下の責務が1ファイルに集中している。

- 定数定義
- 乱数生成
- 難易度計算
- 数学ユーティリティ
- 当たり判定
- Phaser Sceneのライフサイクル
- キーボード、ポインタ入力
- プレイヤー更新
- 射撃更新
- 弾更新
- 敵スポーン
- 敵移動
- 戦闘解決
- 障害物衝突
- HUD更新
- 描画
- Phaserゲーム起動

この形のまま機能を足すと、次の問題が起きやすい。

- Phaserを起動しないとゲームロジックを検証しにくい
- Sceneが肥大化し、変更の影響範囲が読みにくくなる
- 敵、武器、アイテム、ステージなどの追加で分岐が増える
- ログやメトリクスが各処理へ直接混ざり、削除や差し替えが難しくなる
- UI確認やE2Eテストで内部状態を観測しにくい
- TypeScript化する時に、実装上の暗黙フィールドを見落としやすい

特に、`new Phaser.Game(config)` が同一ファイル末尾にあるため、将来このファイルからユーティリティをimportするとゲーム起動の副作用が発生する。最初に起動点とロジックを分ける必要がある。

## 3. 基本方針

### 3.1 Phaserは外周に置く

Phaserは以下を担当する。

- Canvas作成
- Sceneライフサイクル
- キーボード、ポインタ入力の読み取り
- Graphics/Textによる描画
- スケール管理
- 将来のアセット読み込み

ゲームルールはPhaserに依存しないTypeScriptモジュールへ寄せる。

### 3.2 挙動維持を優先する

リファクタリングの初期段階では、以下を変えない。

- プレイヤー速度
- 弾速、弾寿命、射撃間隔
- 敵HP、速度、接触ダメージ
- スポーン間隔、最大敵数
- 障害物配置
- スコア計算
- ゲームオーバー条件
- 操作方法

追加機能は、分離とテストが終わってから扱う。

### 3.3 テストを書ける単位から切る

最初に切るべきものは、Phaserなしで動く処理である。

- `clamp`
- `normalize`
- `circleCircle`
- `circleRect`
- `formatTime`
- `getDifficulty`
- seeded random

次に、入力スナップショットとWorld状態を与えれば更新できるシミュレーション処理を切り出す。

### 3.4 外部ライブラリは境界の内側へ入れない

外部ライブラリを使う場合でも、直接ゲーム全体へ染み込ませない。

例:

- Zodは設定ファイル読み込み時の検証に使い、ゲームループ内では検証済み型を使う
- mittなどのEvent Busはイベント配信の実装として使い、ゲーム側は `GameEventBus` interface に依存する
- Sentryは `LoggerPort` または `TelemetryPort` の実装として使い、ドメイン層から直接呼ばない
- PlaywrightはE2E検証に使い、ゲーム本体へ依存させない

## 4. リファクタリング要件

### RR-001 TypeScript化

`phaser` プロジェクトをTypeScript化する。

必須:

- `src/main.js` を `src/main.ts` へ移行する
- `tsconfig.json` を追加する
- Viteでビルドできる
- Phaser型を利用できる
- `npm run build` が成功する

推奨:

- `strict: true` を目標にする
- 初回移行で詰まる場合は段階的に厳格化する
- `noImplicitAny` は早期に有効化する

### RR-002 起動点の分離

Phaserの起動だけを行うファイルを作る。

例:

- `src/main.ts`
- `src/adapters/phaser/createGame.ts`
- `src/adapters/phaser/ArenaScene.ts`

`main.ts` は `new Phaser.Game(...)` を呼ぶだけに近い形にする。

### RR-003 型定義の整備

最低限、以下の型を定義する。

```ts
type Vec2 = {
  x: number;
  y: number;
};

type GameStatus = "playing" | "gameOver";

type CircleBody = {
  position: Vec2;
  radius: number;
};

type RectBody = {
  x: number;
  y: number;
  width: number;
  height: number;
};
```

ドメイン型として以下を用意する。

- `GameState`
- `WorldState`
- `Player`
- `Bullet`
- `Enemy`
- `Obstacle`
- `Difficulty`
- `InputSnapshot`
- `RandomSource`
- `GameEvent`
- `GameMetric`

現状実装には `Enemy.enteredArena` があるため、設計上も明示する。

### RR-004 設定値の一元化

現在の `ARENA`, `PLAYER`, `BULLET`, `ENEMY`, `OBSTACLES` を `config` として分離する。

将来的には、以下の順で拡張できるようにする。

1. TypeScript定数
2. JSON設定
3. ZodによるJSON検証
4. ステージ別設定
5. 難易度別設定

初期段階では、TypeScript定数のままでよい。

### RR-005 純粋ロジックの分離

以下の処理はPhaserに依存しないモジュールへ移動する。

- 数学ユーティリティ
- 形状衝突
- 難易度計算
- 乱数
- フォーマット
- 移動量計算
- 射撃可能判定
- 弾の寿命処理
- 敵スポーン地点計算
- 戦闘解決

Phaserの `Scene` や `Graphics` をimportしないことを受け入れ条件にする。

### RR-006 World更新API

ゲームループから呼び出す中心APIを定義する。

候補:

```ts
type StepWorldInput = {
  world: WorldState;
  input: InputSnapshot;
  dt: number;
  random: RandomSource;
};

type StepWorldResult = {
  world: WorldState;
  events: GameEvent[];
  metrics: GameMetric[];
};
```

初期実装では破壊的更新でもよい。ただし、テストしやすいように入力と出力の境界を明確にする。

### RR-007 入力のスナップショット化

Phaserのキーやポインタをゲームロジックへ直接渡さない。

Scene側で以下のような `InputSnapshot` を作る。

```ts
type InputSnapshot = {
  move: Vec2;
  aimWorld: Vec2 | null;
  shootHeld: boolean;
  restartPressed: boolean;
};
```

これにより、テストではPhaserなしで入力を再現できる。

### RR-008 描画の分離

描画は当面Phaser Graphics/Textでよい。

ただし、Scene内に描画詳細を残し続けない。

候補:

- `PhaserArenaRenderer`
- `PhaserHud`
- `PhaserDebugOverlay`

描画アダプタは `WorldState` を受け取り、表示だけを行う。

### RR-009 ロギング境界

ゲームロジックから `console.log` を直接呼ばない。

代わりに `LoggerPort` を定義する。

```ts
type LogLevel = "debug" | "info" | "warn" | "error";

type LoggerPort = {
  log(level: LogLevel, event: string, fields?: Record<string, unknown>): void;
};
```

初期実装は `ConsoleLogger` でよい。

### RR-010 メトリクス境界

フレーム時間、敵数、弾数、スポーン数、ヒット数などを測れるようにする。

ゲームロジックは `MetricsPort` へイベントを渡すだけにする。

初期実装はメモリ上の集計でよい。

### RR-011 テスト導入

最初に導入するテストはVitestのユニットテストとする。

対象:

- 数学ユーティリティ
- 難易度境界
- フォーマット
- スポーン
- 射撃
- 戦闘
- 固定dtのシミュレーション

ブラウザ動作確認はPlaywrightで行う。

### RR-012 UI動作確認

CanvasゲームではDOMのアクセシビリティテストだけでは足りないため、以下を確認する。

- Canvasが存在する
- Canvasのスクリーンショットが非空である
- HUDテキストが更新される
- `WASD` または矢印キーでプレイヤーが移動する
- 左クリックまたは `Space` で弾が出る
- HP 0でGame Over表示になる
- `R` で再スタートできる
- リサイズ時にCanvasが破綻しない

## 5. 非機能要件

### NFR-001 開発速度

`npm run dev` の起動とHMRを維持する。

### NFR-002 ビルド

`npm run build` が成功する。

ビルド後の成果物はブラウザで起動できる。

### NFR-003 性能

初期目標:

- 敵60体、弾100発程度で60fps付近を維持する
- メトリクス計測を有効にしても明確な体感劣化を起こさない
- per-frameログはデフォルト無効にする

### NFR-004 決定性

固定seed、固定dt、固定入力列では同じ結果になることを目指す。

完全な描画の決定性までは要求しない。

### NFR-005 粗結合

ドメイン層は以下に依存しない。

- Phaser
- DOM
- `window`
- `document`
- Playwright
- Sentry
- stats.js

## 6. 対象外

このリファクタリング初期フェーズでは、以下を対象外とする。

- 新しい敵タイプ
- 武器アップグレード
- アセット制作
- BGM、効果音
- セーブデータ
- オンラインランキング
- マルチプレイ
- モバイルUI
- React等のUIフレームワーク導入
- ECS全面導入

## 7. 受け入れ条件

リファクタリングの初期完了条件は以下とする。

- TypeScriptでビルドできる
- Phaser起動点とゲームロジックが分離されている
- Phaser非依存のユニットテストが存在する
- `npm run test` が成功する
- `npm run build` が成功する
- Playwrightによるブラウザスモークテストが存在する
- 既存の操作とゲームルールが維持されている
- `IMPLEMENTATION_NOTES.md` に変更点と設計判断が追記されている
