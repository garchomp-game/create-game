---
title: Development Setup
description: Phaser版の起動、検証、開発コマンド。
---

## 作業ディレクトリ

```bash
cd phaser
```

## セットアップ

```bash
npm install
```

## 開発サーバ

```bash
npm run dev
```

## 品質チェック

```bash
npm run typecheck
npm test -- --run
npm run test:e2e
npm run build
```

## 既知の注意点

`npm run build` はPhaser / Viteのbundle size warningを出すことがあります。buildが成功していれば既知警告として扱います。

## Repo Layout

トップレベルは次の2つに整理します。

- `phaser`: ゲーム実装
- `docs`: Starlightドキュメント、設計、PM管理

Phaser側の責務:

- `src/adapters/phaser`: Phaser Scene、入力、描画、debug overlay
- `src/simulation`: World更新とsystems
- `src/domain`: 型定義
- `src/config`: ゲーム設定
- `src/math`, `src/format`: Phaser非依存の純粋関数
- `src/ports`, `src/adapters/telemetry`: ログとメトリクスの境界
