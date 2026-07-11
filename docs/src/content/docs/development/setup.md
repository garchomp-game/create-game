---
title: 開発環境
description: Phaser版とStarlightドキュメントの起動、検証、ディレクトリ構成。
---

## ゲーム実装

作業ディレクトリ:

```bash
cd phaser
```

依存関係の導入:

```bash
npm install
```

開発サーバー:

```bash
npm run dev
```

品質確認:

```bash
npm run typecheck
npm test -- --run
npm run test:e2e
npm run build
```

任意の実時間15分ブラウザ耐久試験:

```bash
ARENA_LONG_SOAK=1 npx playwright test tests/e2e/arena-soak.spec.ts --workers=1
```

`npm run build` ではPhaser / Viteのバンドルサイズ警告が出ることがあります。ビルド自体が成功していれば、現時点では既知警告として扱います。

## ドキュメント

```bash
cd docs
npm install
npm run dev
npm run build
```

## トップレベル構成

- `phaser`: ゲーム実装。
- `docs`: Starlightによる設計、計画、プレイテスト資料。

## Phaser側の主な構成

| パス | 責務 |
| --- | --- |
| `src/adapters/phaser` | Scene、入力、描画、音、デバッグ表示 |
| `src/simulation` | ワールド更新とゲームルール |
| `src/domain` | 型定義 |
| `src/config` | ゲーム設定と検証スキーマ |
| `src/math`, `src/format` | Phaser非依存の純粋関数 |
| `src/ports` | 外部機能との境界 |
| `src/adapters/telemetry` | ログと計測の実装 |
| `src/application` | ラン記録生成、順位、終了処理 |
| `src/adapters/storage` | プロフィール、設定、履歴、ランキングのブラウザ保存 |
| `public/audio` | BGM、効果音、資産台帳 |
| `logs/runs` | 手動ランの開発用JSON |
| `logs/debug` | デバッグランと旧0秒ログ |
| `logs/tests` | 明示的な自動テスト出力 |

責務分離の詳細は [アーキテクチャ](../../engineering/architecture/) を参照してください。

## ローカル保存とログ

プレイヤー向け履歴、ランキング、プロフィール、設定はブラウザの`localStorage`へ保存します。開発用の詳細ランJSONはVite開発サーバーだけが`phaser/logs`へ保存し、本番ビルドにはファイル書込エンドポイントを含めません。

ログ整理:

```bash
du -sh logs
find logs -maxdepth 2 -type f -name '*.json' -printf '%p %s bytes\n'
```

各ディレクトリの保持上限と用途は`phaser/logs/README.md`を参照してください。
