---
title: Cloudflareデプロイ
description: Arena CoreをCloudflare Workers Static Assetsへ安全に公開・確認・更新する手順。
---

## 採用構成

ゲーム本体はCloudflare Pagesではなく、Assets-onlyのCloudflare Workerとして配信します。

```text
arena-core Worker
└─ Static Assets
   └─ phaser/dist
```

現在の公開先:

- `https://arena-core.garchomp-game.workers.dev`
- Worker名: `arena-core`
- Workersサブドメイン: `garchomp-game.workers.dev`
- 設定: `phaser/wrangler.jsonc`

現在の公開基準:

| 項目 | 値 |
| --- | --- |
| アプリ版 | `0.6.8` |
| ルール版 | `phaser-v0.6.8-pulse-boundary-ricochet` |
| Git commit | `ff686f992a65` |
| Cloudflare Version ID | `e86f90b8-ea15-4d1d-b01b-59e4f9fea78e` |
| 公開確認日 | 2026-07-17 |

v0.7 RC6はproductionへ配分せず、次のVersion Previewで確認します。

| 項目 | 値 |
| --- | --- |
| Preview URL | `https://v07-final-expedition-rc6-arena-core.garchomp-game.workers.dev` |
| アプリ / ルール版 | `0.7.0` / `phaser-v0.7.0-final-expedition-rc6` |
| Git commit | `f06c9b585cc4` |
| Cloudflare Version ID | `a9522576-e9ff-4fce-92df-35c9c732849c` |
| 実URL確認日 | 2026-07-19 |

v0.8 Training T1もproductionへ配分せず、9課題版を次の固定Previewで確認します。旧8課題版`v08-training-t1-e872505`はsupersededです。

| 項目 | 値 |
| --- | --- |
| Preview URL | `https://v08-training-t1-contact-2247bd9-arena-core.garchomp-game.workers.dev` |
| runtime / build | `78b79da9c5aa` / `2247bd9cd16a` |
| Cloudflare Version ID | `7eaaf10f-fd82-4032-b363-5d4b44db8293` |
| 実URL確認日 | 2026-07-23 |

静的ファイルの取得ではWorkerスクリプトを実行しません。ランキング、共有履歴、アカウントAPIは公開ベータ後に`/api/*`として追加し、それまではプロフィール、履歴、ローカルランキングをブラウザの`localStorage`へ保存します。

## 初回認証

作業ディレクトリ:

```bash
cd phaser
```

WranglerのOAuth認証:

```bash
npx wrangler login
npx wrangler whoami
```

手動デプロイではOAuthを使うため、Cloudflare Global API Keyは作成しません。資格情報はユーザーのホームディレクトリに保存され、リポジトリへは入りません。`.wrangler`、`.dev.vars`もGit管理対象外です。

## 公開前確認

依存関係をロックファイルどおりに導入します。

```bash
npm ci
```

本番ビルド、公開物検査、Wranglerのdry-runをまとめて実行します。

```bash
npm run deploy:cloudflare:dry-run
```

`verify:deploy`は次を検査します。

- `index.html`、`beta-info.html`、`third-party-notices.txt`、`_headers`、ViteのJavaScript entryが存在する。
- Cloudflare Freeの20,000ファイル、単一ファイル25MiB以内である。
- `.env`、`logs`、レビュー資料、ソースマップが公開物へ混入していない。
- `appVersion`、`rulesetVersion`、`buildCommit`が両HTMLで一致し、commitが`unknown`ではない。
- E2E用の`window.__ARENA_DEBUG__`、fixture、テスト機能フラグ、開発ログAPIが含まれない。

Cloudflareと同じローカルランタイムで確認する場合:

```bash
npm run preview:cloudflare
```

既定URLは`http://localhost:8787`です。タイトル、音、WebGL描画、メニュー操作、ブラウザ保存を確認します。

## 本番デプロイ

```bash
npm run deploy:cloudflare
```

成功時はWorkerのVersion IDと公開URLが表示されます。デプロイ後は最低限次を確認します。

1. ルートがHTTP 200で開く。
2. タイトル画面とWebGL canvasが表示される。
3. BGMと効果音を取得できる。
4. ブラウザコンソールにエラーがない。
5. `window.__ARENA_DEBUG__`が公開されていない。
6. `/assets/*`が長期キャッシュ、HTMLが再検証設定になっている。
7. `/beta-info.html`から保存、全削除、既知制約、フィードバック、第三者ライセンスを確認できる。

公開版のHTMLから版情報だけを確認する場合:

```bash
curl -fsSL https://arena-core.garchomp-game.workers.dev/ \
  | rg 'arena-(app-version|ruleset-version|build-commit)'
```

公開UIを実ブラウザで一巡する場合:

```bash
npm run smoke:production
```

このスモークはデバッグhookを使わず、タイトル、設定保存、ランキング、履歴、武器選択、自然終了、RunRecord、リトライ、一時停止、ベータ情報、ライセンスを確認します。2026-07-17の基準ではコンソールエラー、ページ例外、失敗リクエスト、HTTP 4xx / 5xxは0件でした。ルートHTMLは`no-cache`、ハッシュ付きゲームJSは`max-age=31536000, immutable`、CSPとPermissions Policyも配信されています。

## GitHub連携

手動公開を確認した後、Cloudflare DashboardのWorkers Buildsから`garchomp-game/create-game`を接続します。

| 設定 | 値 |
| --- | --- |
| Root directory | `/phaser` |
| Production branch | `main` |
| Build command | `npm run build:deploy` |
| Deploy command | `npx wrangler deploy` |
| Build watch path | `phaser/**` |

プレビューブランチは`npx wrangler versions upload`でVersion URLだけを作り、本番へ昇格しません。Cloudflare GitHub Appを使う場合、GitHub SecretsへAPIトークンを保存する必要はありません。

v0.7候補はこのVersion Preview方式を使います。最終commitから`npm run build:deploy`を実行した後、次で新Versionを作ります。

```bash
npx wrangler versions upload
```

表示されたVersion URLへ対して`ARENA_PUBLIC_URL`、候補の版情報、commitを明示して`scripts/smoke-production.mjs`を実行します。`wrangler deploy`やtraffic昇格は手動採否が終わるまで実行しません。

GitHub Actionsから直接デプロイする方式へ変更する場合だけ、CloudflareのScoped API TokenとAccount IDをSecretsへ追加します。Global API Keyは使いません。

## ヘッダーとキャッシュ

`phaser/public/_headers`をViteが`dist/_headers`へコピーします。

- CSPは同一オリジンのJavaScript、CSS、音源、将来の同一オリジンAPIだけを許可する。
- hashed assetは1年間`immutable`とする。
- HTMLは`no-cache`で再検証する。
- ファイル名を固定している音源は1日キャッシュする。

外部認証、外部分析、CDN外のAPIを導入するときは、先にCSPの`connect-src`などを明示的に更新します。

## ランログ

`/__arena/run-export`はVite開発サーバー専用です。本番Workerはローカルファイルへ書き込まず、詳細JSONも自動送信しません。

公開ベータでサーバー集計を始める場合は、次を別チケットで実装します。

- D1: 正規化したラン要約、プロフィール、ルール版別ランキング。
- R2: 調査が必要な詳細JSONだけを期限付きで保存。
- Worker API: 入力検証、レート制限、匿名セッションまたは認証。
- 不正対策: クライアント申告スコアを未検証として分離し、後からリプレイ検証へ接続。

## ロールバック

Cloudflare DashboardのWorker `arena-core`からDeploymentsを開き、正常だったVersionを選んでRollbackします。ロールバック後もGitの正本を戻し、次の自動デプロイで不具合版が再公開されないようにします。

## 公式資料

- [Workers Static Assets](https://developers.cloudflare.com/workers/static-assets/)
- [Static Assetsの料金と制限](https://developers.cloudflare.com/workers/static-assets/billing-and-limitations/)
- [Workers BuildsのGitHub連携](https://developers.cloudflare.com/workers/ci-cd/builds/git-integration/github-integration/)
- [PagesからWorkersへの移行](https://developers.cloudflare.com/workers/static-assets/migration-guides/migrate-from-pages/)
