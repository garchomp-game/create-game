# Arena Core - Phaser v0.5

Phaser + TypeScriptで実装した、見下ろし型エンドレスアリーナです。

## 起動

```bash
npm install
npm run dev
```

## 品質確認

```bash
npm run typecheck
npm test
npm run test:e2e
npm run build
```

Playwrightには機能E2Eと18状態のCanvas画面比較が含まれます。既定では固定シードと`test`起点を使い、通常ランキングや手動ログへ混ぜません。

実時間15分の任意ブラウザ耐久試験:

```bash
ARENA_LONG_SOAK=1 npx playwright test tests/e2e/arena-soak.spec.ts --workers=1
```

通常の`npm run test:e2e`では長時間試験をスキップします。

## 操作

| 操作 | 入力 |
| --- | --- |
| 移動 | `WASD` / 矢印キー |
| 照準 | マウス |
| 射撃 | 自動射撃、左クリック、`Space` |
| 一時停止 | `P` / `Esc` |
| 強化選択 | `1` / `2` / `3`、左クリック |
| メニュー移動 | `W` / `S`、上下キー、マウス |
| 決定 | `Enter`、左クリック |
| 戻る | `Esc` |
| デバッグ表示 | 開発時のみ`F3` |

自動射撃は設定から無効にできます。右クリックはv0.5では操作を割り当てていません。

## v0.5の主な機能

- スコア、時間、死因、ビルド、シード、自己記録差を表示するリザルト。
- 直近50件のラン履歴と、比較キー別上位10件のローカルランキング。
- 手動、デバッグ、自動テストの起点区分とランキング対象外理由。
- ゲストプロフィールと、BGM、効果音、画面揺れ、点滅、自動射撃の設定。
- タイトル、履歴、ランキング、設定を含むキーボード / ポインターメニュー。
- 4区間・32秒のBGM1曲と、主要効果音8種・15ファイル。高頻度SEは音色とピッチを循環させる。素材情報は`public/audio/README.md`を参照。
- 手動、デバッグ、テストを分離した開発用ランログ。

## 保存

ブラウザの`localStorage`:

- `arena-core.run-records.v2`: ラン履歴とランキング。
- `arena-core.profile.v1`: ゲストプロフィール。
- `arena-core.settings.v1`: 音、演出、自動射撃の設定。

開発用の詳細JSON:

- `logs/runs`: 手動ラン、最新200件。
- `logs/debug`: デバッグラン、最新100件。
- `logs/tests`: 明示的な自動テスト、最新20件。

プレイヤー向け履歴は開発JSONを参照しません。保存破損や容量超過が起きても、ゲーム起動とリザルト表示を継続します。

## 構成

| パス | 責務 |
| --- | --- |
| `src/simulation` | Phaser非依存のワールド更新とシステム |
| `src/domain` | ゲーム状態、イベント、記録、プロフィールの型 |
| `src/application` | ラン記録生成、順位計算、終了処理 |
| `src/ports` | 保存、ログ、メトリクスの境界 |
| `src/adapters/storage` | 版付きブラウザ保存と破損復旧 |
| `src/adapters/phaser` | Scene、入力、描画、HUD、音、演出 |
| `src/config` | ゲーム設定、アプリ版、ルールセット版 |
| `scripts/generate-audio.mjs` | BGMとSEの決定的な波形生成、Vorbisエンコード |
| `tests/e2e` | 機能E2Eと画面比較 |

ゲームルールは`phaser-v0.4-endless-pressure`を維持し、v0.5では記録、画面、設定、音響を更新しています。

## 既知事項

- Phaserを含む本番JavaScriptは約1.37MBで、Viteの500KB警告が出ます。
- `ArenaScene`と`PhaserArenaRenderer`には画面調停とデバッグfixtureが集まっており、v0.6の画面追加前に追加分割を再評価します。
- 外部ログイン、オンラインランキング、クラウド同期は対象外です。
