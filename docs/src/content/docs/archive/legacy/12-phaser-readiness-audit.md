---
title: "Legacy: Phaser版 本実装前Readiness監査"
description: "Migrated from docs/12-phaser-readiness-audit.md."
---

> Source: `docs/12-phaser-readiness-audit.md`

# Phaser版 本実装前Readiness監査

## 1. 監査日

2026-06-20

## 2. 結論

Phaser版は、本格的な追加実装へ進められる状態である。

理由は以下である。

- Phaser依存が `src/adapters/phaser` に閉じている
- ゲームルールが `src/simulation` と `src/simulation/systems` に分離されている
- 設定が `SimulationConfig` と `ViewConfig` に分かれている
- Zodによる設定検証がある
- `WorldState` と `InputSnapshot` によりPhaserなしでシミュレーションをテストできる
- Vitest、TypeScript typecheck、Vite build、Playwright E2E、Playwright visual regression が揃っている
- Debug HookでE2Eから状態取得、強制Game Over、一時停止、固定stepができる
- frame spike warningをLoggerPort経由で出せる

## 3. 現在の品質ゲート

本実装前後で最低限通すコマンドは以下とする。

```bash
cd phaser
npm run test
npm run typecheck
npm run build
npm run test:e2e
```

現時点の検証状況:

- `npm run test`: 7 files / 25 tests
- `npm run typecheck`: TypeScript strict mode
- `npm run build`: Vite production build
- `npm run test:e2e`: 5 Playwright tests
- Visual regression: initial, shooting, game-over の3画面

## 4. 設計書との照合

| 観点 | 状態 | コメント |
| --- | --- | --- |
| TypeScript化 | 完了 | `src/main.ts` 起点 |
| 起動点分離 | 完了 | `createPhaserGame` と `ArenaScene` に分離 |
| Phaser外周化 | 完了 | Phaser importはadapter層に限定 |
| 純粋ロジック分離 | 完了 | math/format/simulationはPhaser非依存 |
| WorldState | 完了 | Scene内部状態から分離済み |
| InputSnapshot | 完了 | 入力はadapterでsnapshot化 |
| system分割 | 完了 | player/shooting/bullet/spawn/enemy/combat等に分離 |
| ログ境界 | 完了 | `LoggerPort` と `ConsoleLogger` |
| メトリクス境界 | 完了 | `MetricsPort` と `InMemoryMetrics` |
| frame spike warning | 完了 | `FrameSpikeReporter` |
| E2E | 完了 | Playwright導入済み |
| 視覚回帰 | 完了 | 3画面のsnapshot比較 |
| 設定検証 | 完了 | Zod schema導入済み |
| 本番監視 | 未導入 | Sentry等は公開方針決定後でよい |
| 外部JSON設定 | 未導入 | 現時点ではTS定数 + Zod検証で十分 |

## 5. ヌケモレ確認

本実装へ進む上でのブロッカーはない。

ただし、以下は「今後の機能規模に応じて追加する」項目である。

- `ArenaGameController` の追加: Sceneがさらに肥大化した段階で検討する
- `EventBusPort`: 効果音、パーティクル、実績、DOM UIなど購読先が増えたら導入する
- `InputPort`: キーコンフィグ、ゲームパッド、タッチ操作を入れる段階で導入する
- `PhaserHud` 分離: HUDが複雑化したらRendererから切る
- `fast-check`: 衝突や境界条件の不変条件が増えたら導入する
- `@axe-core/playwright`: DOMメニュー、設定画面、ランキング等が増えたら導入する
- Sentry等の本番監視: 外部公開、リリース管理、プライバシー方針が決まったら導入する
- 設定JSON化: バランス調整やステージ追加を非エンジニア作業にしたくなったら導入する

## 6. 本実装で守るべきルール

今後の機能追加では、以下を守る。

- Phaser APIを `src/simulation`, `src/domain`, `src/math`, `src/format` に入れない
- 新しいゲームルールはまず `WorldState`、`GameEvent`、`SimulationConfig` のどれに属するか決める
- UIや演出はPhaser adapter側で扱う
- 設定値を足したらZod schemaとテストも更新する
- 新しい挙動を入れたらVitestでシミュレーションテストを追加する
- 画面に影響する変更はPlaywright E2Eまたはvisual regressionを追加/更新する
- Debug Hookはdev専用を維持し、本番ビルドへ依存させない

## 7. 推奨する次の本実装順

次にゲーム機能を足すなら、以下の順が安全である。

1. ポーズ機能
2. 敵タイプ追加
3. 武器/弾種追加
4. アイテムまたは経験値ドロップ
5. ステージ/ウェーブ設定
6. タイトル/リザルト/設定画面

理由:

- ポーズは状態遷移とE2Eの基準を強化できる
- 敵タイプと武器は `systems` 分割の有効性を確認しやすい
- ドロップやステージ設定はZod設定検証の価値が出る
- DOM UIが増える段階でアクセシビリティとEventBus導入判断ができる
