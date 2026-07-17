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
