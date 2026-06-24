# Phaser版リファクタリング実行チケット

## 1. 方針

`phaser` プロジェクトだけを対象に、段階的に導入、検証、リファクタリングを進める。

各チケットは、以下を満たしてから次へ進む。

- `npm run build`
- 追加したテストがある場合は `npm run test`
- ブラウザ挙動に関わる場合はスモーク確認
- `IMPLEMENTATION_NOTES.md` への追記

## 2. チケット一覧

| ID | 状態 | 内容 | 受け入れ条件 |
| --- | --- | --- | --- |
| PH-RF-001 | Done | TypeScript導入と起動点分離 | `src/main.ts` と `src/adapters/phaser/ArenaScene.ts` が分かれ、ビルドが通る |
| PH-RF-002 | Done | 設定値、型、純粋関数の抽出 | config/math/simulation基礎がPhaser非依存になり、Unit Testが通る |
| PH-RF-003 | Done | Vitest導入 | `npm run test` でgeometry/difficulty/random/timeのテストが通る |
| PH-RF-004 | Done | WorldStateとInputSnapshotの導入 | Sceneの状態が `WorldState` にまとまり、入力がSnapshot化される |
| PH-RF-005 | Done | stepWorldへの更新処理集約 | Sceneが `input -> stepWorld -> render` に近づく |
| PH-RF-006 | Done | system分割 | player/shooting/bullet/spawn/enemy/combatが責務別になる |
| PH-RF-007 | Done | ログ/イベント/メトリクスPort導入 | per-frame consoleなしでイベントとメトリクスを収集できる |
| PH-RF-008 | Done | Playwright E2E導入 | Canvas非空、移動、射撃、リスタートを自動確認できる |
| PH-RF-009 | Done | Debug Snapshot Hook | E2Eから状態を安定して観測できる |
| PH-RF-010 | Done | 画面差分テスト | 固定seedとdebug modeで代表画面を比較できる |
| PH-RF-011 | Done | Zodによる設定検証 | 外部JSON化した設定を安全に読める |
| PH-RF-012 | Backlog | Sentry等の本番監視 | LoggerPort経由で本番エラー監視へ接続できる |
| PH-RF-013 | Done | simulation/view config分離 | ドメイン層が描画色を持たず、Rendererへview設定を注入する |
| PH-RF-014 | Done | frame spike warning | `frame.dt_ms` の閾値超過をLoggerPortへ流す |

## 3. 今回の実行スコープ

まず以下を自律的に進める。

1. PH-RF-001
2. PH-RF-002
3. PH-RF-003
4. PH-RF-004
5. PH-RF-005 の一部

PH-RF-009までは完了した。

PH-RF-014までは完了した。

次に進む場合は、PH-RF-012の本番監視設計、または設定JSON化、visual regressionの対象拡張を検討する。

## 4. 実施ログ

### 2026-06-19

実施:

- TypeScript導入
- Vitest導入
- 起動点分離
- Phaser Scene分離
- 入力Adapter分離
- Renderer分離
- WorldState導入
- InputSnapshot導入
- stepWorld導入
- systems分割
- LoggerPort/MetricsPort導入
- InMemoryMetrics導入
- F3 Debug Overlay導入
- Playwright E2E導入
- Debug Snapshot Hook導入
- 初期照準が未操作ポインタで上書きされる問題を修正
- restart intentを`stepWorld`の`game.restart.requested`イベントへ接続
- simulation/view config分離
- Zod設定検証導入
- frame spike warning導入
- Playwright画面差分テスト導入
- Debug Hookへpause/fixed stepを追加

検証:

- `npm run test`: passed, 25 tests
- `npm run typecheck`: passed
- `npm run build`: passed
- `npm run test:e2e`: passed, 5 tests
- Chrome headless smoke: passed

残:

- Sentry等の本番監視は未導入
- 設定はZod検証済みだが、外部JSON化は未実施
- 画面差分テストは初期、射撃、Game Overの3画面のみ

## 5. 検証コマンド

```bash
cd phaser
npm run test
npm run build
```

ブラウザ確認が必要な段階では、開発サーバーを起動してChrome headlessでスモーク確認する。

```bash
cd phaser
npm run dev
```

## 6. サブエージェント利用

大きな変更後に、レビュー担当のサブエージェントを1本起動する。

依頼内容:

- 責務分離が設計文書と一致しているか
- Phaser依存がドメイン層へ漏れていないか
- テスト不足がないか
- 変更によって既存挙動が崩れそうな箇所がないか
