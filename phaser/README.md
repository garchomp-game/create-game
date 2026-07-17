# Arena Core - Phaser v0.6.8

Phaser 4 + TypeScriptで実装した、見下ろし型エンドレスアリーナです。公開ベータはゲスト利用、端末内履歴、端末内ランキングを対象とします。

- ゲーム: https://arena-core.garchomp-game.workers.dev/
- ベータ情報: https://arena-core.garchomp-game.workers.dev/beta-info.html
- ルール版: `phaser-v0.6.8-pulse-boundary-ricochet`

## 起動

```bash
npm ci
npm run dev
```

Vite開発サーバーだけが、明示的な開発操作による詳細ランJSONを`logs`へ保存できます。公開ビルドは詳細JSONや操作情報を外部送信しません。

## 品質確認

```bash
npm run typecheck
npm test
npm run test:e2e
npm run build:deploy
npm audit --audit-level=high
```

`test:e2e`は機能・画像回帰に加え、Chromeの960 x 540 / 390 x 844とFirefoxの960 x 540で公開経路を確認します。公開経路だけを再実行する場合:

```bash
npm run test:e2e:release -- --workers=1
```

実時間15分のブラウザ耐久は通常実行から除外しています。

```bash
ARENA_LONG_SOAK=1 npx playwright test tests/e2e/arena-soak.spec.ts --workers=1
```

## Cloudflare

Cloudflare Workers Static Assets向けの本番ビルドとdry-run:

```bash
npm run deploy:cloudflare:dry-run
```

デプロイ:

```bash
npx wrangler whoami
npm run deploy:cloudflare
```

`verify:deploy`は公開ファイル、版情報、容量制限、ソースマップ、ログ、レビュー資料、debug hook、fixture、開発ログAPIを検査します。認証、ロールバック、ヘッダーの詳細はStarlightの「Cloudflareデプロイ」を参照してください。

## 操作

| 操作 | 入力 |
| --- | --- |
| 移動 | `WASD` / 矢印キー |
| 照準 | マウス |
| 射撃 | 自動射撃、左クリック、`Space` |
| 一時停止 | `P` / `Esc` |
| 強化選択 | `1` / `2` / `3`、Tab / Enter、左クリック |
| メニュー移動 | `W` / `S`、上下キー、マウス |
| 決定 | `Enter`、左クリック |
| 戻る | `Esc` |
| デバッグ表示 | 開発時のみ`F3` |

自動射撃は設定から無効にできます。公開ベータはデスクトップのキーボードとマウスを主対象とし、タッチ専用操作はまだありません。

## ゲームルール

- Pulse: 単線、高速弾、継続照準、貫通順、障害物・外周反射を使う技能型。
- Spread: 広角、複数標的、分裂射撃、掃射循環で群れを安定処理する制圧型。
- 通常25ランク完成後は、循環型EX強化へ移行する。
- 3種の危険イベント、240秒の後半契約、600秒からのアリーナ崩壊で有限終了を作る。
- ランキングはモード、ステージ、難易度、ルール版、シード区分が同じ記録だけを比較する。

## 保存と公開情報

ブラウザの`localStorage`:

- `arena-core.run-records.v2`: ラン履歴とランキング。
- `arena-core.profile.v1`: ゲストプロフィール。
- `arena-core.settings.v1`: 音、演出、自動射撃の設定。

タイトルの「ベータ情報」から、全Arena Coreデータを二段階確認で削除できます。同ページにはアプリ版、ルール版、build commit、既知制約、フィードバック用テンプレート、第三者ライセンスも表示します。

開発用ログ:

- `logs/runs`: 手動ラン、最新200件。
- `logs/debug`: デバッグラン、最新100件。
- `logs/tests`: 明示的な自動テスト、最新20件。

## 構成

| パス | 責務 |
| --- | --- |
| `src/simulation` | Phaser非依存のワールド更新、戦闘、進行、観戦AI |
| `src/domain` | ゲーム状態、イベント、記録、プロフィールの型 |
| `src/application` | ラン記録、順位、メニュー、終了処理 |
| `src/presentation` | Phaser非依存の画面ViewModel |
| `src/ports` | 保存、ログ、メトリクスの境界 |
| `src/adapters/storage` | 版付きブラウザ保存と破損復旧 |
| `src/adapters/phaser` | Scene、入力、描画、HUD、音、演出 |
| `src/config` | ゲーム設定、アプリ版、ルール版 |
| `tests/e2e` | 機能、画像、ブラウザ互換、耐久試験 |

## 素材と既知事項

- BGMとSEは本リポジトリで決定的に波形生成しています。第三者の楽曲、録音、サンプルは含みません。
- Phaser、rot.js、Zodの配布条件は`public/third-party-notices.txt`へ収録しています。
- Phaserを含む本番JSは約1.69MBで、Viteの500KB警告が残ります。gzip後は約458KBです。
- 外部ログイン、オンラインランキング、クラウド同期、途中保存は対象外です。
- `npm audit`はWindows開発サーバー限定のLow 1件を報告します。High / Criticalは0件です。
