---
title: アーキテクチャ
description: Phaser版の責務分離、保存境界、コンテンツ拡張方針。
---

## 基本方針

Phaserは入出力の外周へ置き、ゲームルールはPhaserに依存しないTypeScriptモジュールへ寄せます。

## 現在の構成

| パス | 責務 |
| --- | --- |
| `src/adapters/phaser` | Scene、入力、描画、音、デバッグ表示 |
| `src/simulation` | ワールド更新と各システム |
| `src/domain` | ゲーム状態とイベントの型 |
| `src/config` | 設定値とZod検証 |
| `src/math` | 衝突、ベクトル、乱数 |
| `src/format` | 表示用の純粋関数 |
| `src/ports` | ログ、計測、保存などの境界 |
| `src/adapters/telemetry` | ログと計測の実装 |
| `src/application` | ラン記録生成、順位計算、終了処理の調停 |
| `src/adapters/storage` | ブラウザ保存、版検証、破損復旧 |

## 守ること

- `simulation`、`domain`、`config`、`math`、`format` へPhaser依存を入れない。
- 新しいゲームルールは、まずシミュレーション側でテスト可能にする。
- UIや視認性の変更はPlaywrightまたは画面画像比較で確認する。
- ゲームプレイ変更と同時に、ラン出力とリザルト指標を更新する。
- Sceneへモード、ステージ、プロフィールの条件分岐を集約しない。

## v0.5の保存境界

リザルト、ランキング、履歴、ローカルプロフィールを追加しても、シミュレーションへ保存処理や画面都合を入れていません。

実装済み:

- `src/domain/runRecords.ts`: ラン記録、比較キー、対象判定の型とZodスキーマ。
- `src/domain/profile.ts`: ゲストプロフィールと設定の型とZodスキーマ。
- `RunRecordStorePort`: ラン記録の保存、取得、履歴 / ランキング初期化。
- `ProfileStorePort`: ゲストプロフィール、表示名、設定。
- `src/application/runRecords.ts`: ラン記録生成、順位計算、件数制限。
- `RunRecordCoordinator`: ゲームオーバー1回につき1件だけ保存する終了処理。
- `src/adapters/storage`: `localStorage`実装、構造検証、旧形式移行、破損退避。
- `PhaserMusicController`: BGMループ、画面状態、ミュート、音量。
- `PhaserFeedbackLayer`: 戦闘フィードバック、上限管理、自己記録更新演出。

`ArenaScene`はラン開始、終了、画面間の調停を担当します。タイトル、リザルト、履歴、設定の描画は現在`PhaserArenaRenderer`内にあり、v0.6の画面追加前に専用コンポーネントへ分ける余地があります。デバッグフィクスチャと`window.__ARENA_DEBUG__`も将来の`ArenaDebugBridge`候補です。

外部ログインやオンラインランキングは、これらのポートをローカル実装で検証してから判断します。

保存処理では、ゲームオーバー1回につきラン記録を1件だけ確定します。再描画、タイトル遷移、再挑戦から保存を再実行せず、保存失敗もゲーム進行とリザルト表示を停止させません。

## v0.6以降のコンテンツ境界

コンテンツが増える時点で、必要な定義だけを `gameConfig.ts` から分けます。空の階層を先に量産しません。

追加候補:

- `src/content/weapons`: 開始武器と武器固有強化。
- `src/content/upgrades`: 強化タグ、最終強化、効果定義。
- `src/content/encounters`: 戦闘展開カードと出現形状。
- `src/content/stages`: ステージ、戦闘展開デッキ、ボス、クリア条件。
- `src/application/runSetup.ts`: モード、ステージ、武器、特殊ルールからラン設定を組み立てる。
- `src/application/unlocks.ts`: プロフィールイベントから解放条件を評価する。

## 乱数列

単一の `RandomSource` をすべてのシステムで共有し続けません。ルートシードから用途別乱数列を派生します。

- `spawn`
- `upgrade`
- `drop`
- `encounter`
- `stageVariant`

新しいドロップ抽選を足しても、同じシードの強化候補が変わらないことをテストします。

## ルールセットと記録

アプリの版とゲームルールの版を分けます。

- `appVersion`: アプリ全体の版。
- `rulesetVersion`: 数値、コンテンツプール、スコア規則の版。
- `runOrigin`: 手動、テスト、デバッグの区分。
- `rankEligibility`: 通常ランキングへ登録可能かどうか。

比較できないランを同じランキングへ混ぜず、デバッグ操作や自動テストの記録を通常ランキングから除外します。
