---
title: "Legacy: Session Restart Guide"
description: "Migrated from docs/28-session-restart-guide.md."
---

> Source: `docs/28-session-restart-guide.md`

# Session Restart Guide

作成日: 2026-06-25

## 1. 目的

このドキュメントは、新しいCodex/Claude系セッションで `create-game` のゲーム開発へ戻るための入口である。

直近で `ikiiki-project` の実務対応が同じ会話に混ざったため、次回以降はこのファイルを読んでゲーム開発の文脈に戻す。

## 2. 正しい作業ディレクトリ

ゲーム開発用:

```bash
cd /home/garchomp-game/workspace/create-game
codex
```

ikiiki-project用:

```bash
cd /home/garchomp-game/workspace/available/projects/ikiiki-project
codex
```

この2つを混ぜない。

## 3. 現在のプロジェクト状態

リポジトリ:

- `create-game`
- browser game library comparison workspace
- ゲーム名: `Arena Core`

現在の主戦場:

- `phaser`

ブランチ状態の目安:

- `main` は `origin/main` より進んでいる可能性がある。
- `v0.1` tag は公開済みbaseline。
- Phaser v0.2/v0.3相当の変更がローカルmainにある。

最新付近の重要コミット:

- `6e56261 fix(phaser): keep result screen text within bounds`
- `e5330ff docs(phaser): organize v0.3 next actions`
- `65fc71f test(phaser): stabilize debug e2e input state`
- `64d2e6b feat(phaser): add healing pickup foundation`
- `bd33c49 tag: v0.1`

セッション開始時は必ず確認する:

```bash
git status -sb
git log --oneline --decorate -12
```

## 4. これまでの流れ

当初は、Phaser、Excalibur、KAPLAY、Kontra、melonJS、PixiJS+Matter、Three.js+Rapier、Babylon.js、PlayCanvasを同一テーマで比較する目的だった。

実装比較の結果、Phaserが最も作りやすく、以後はPhaser版を本格化する方向へ移行した。

Phaser版では以下を進めた。

- TypeScript化
- simulation/domain/adapters分離
- logging / metrics / debug overlay
- Playwright E2E
- result summary
- wave / obstacle / pickup / upgrade / HUD改善
- title/menu不透明化
- pause後クリック選択修正
- custom cursor / aim guide
- XP magnet
- healing pickup foundation

## 5. 現在のゲーム状態

Phaser版はゲームとして成立している。

現状の体験:

- 見下ろし型アリーナサバイバル
- WASD/arrow移動
- mouse aim
- left click / Space shoot
- XP pickupとmagnet
- upgrade selection
- waves
- enemies / projectiles / obstacles
- result screen
- debug overlay / debug export
- healing pickup foundation

重要な残課題:

- v0.3 healing pickupの手動プレイ評価が未完了
- heal pickupの数値調整はplaytest結果待ち
- item systemはまだ設計段階
- Starlightドキュメントはまだ作っていない

## 6. 次に読むべき資料

順番:

1. `docs/27-phaser-v03-next-actions-backlog.md`
2. `docs/26-phaser-v03-healing-pickup-design.md`
3. `docs/25-phaser-v02-stabilization-report.md`
4. `docs/22-phaser-v02-playtest-template.md`
5. `phaser/README.md`

長期設計を見直す場合:

- `docs/08-phaser-refactor-requirements.md`
- `docs/09-phaser-refactor-architecture.md`
- `docs/10-phaser-quality-strategy.md`
- `docs/13-phaser-production-implementation-plan.md`

## 7. 次にやること

最優先:

1. `PH-V03-002 v0.3 Playtest and Balance Review`
2. `PH-V03-004 Item System Requirements and Data Model`
3. `PH-V03-006 Pickup Presentation and Feedback Pass`

推奨順:

```text
PH-V03-002 Playtest Review
PH-V03-004 Item Requirements
PH-V03-006 Presentation Pass
PH-V03-003 Heal Tuning
PH-V03-007 Item KPI Extension
PH-V03-005 Buff Item Prototype
PH-V03-008 Playtest Report
PH-V03-010 Stabilization Candidate
```

注意:

- heal tuningはplaytest後に行う。
- itemは最初から複数追加しない。
- 初回item候補は `haste` が有力。

## 8. 検証コマンド

Phaser:

```bash
cd phaser
npm run typecheck
npm test -- --run
npm run test:e2e
npm run build
```

開発サーバ:

```bash
cd phaser
npm run dev
```

既知:

- `npm run build` はPhaser bundle size warningを出す可能性がある。
- warningのみでbuild成功なら既知リスクとして扱う。

## 9. Starlightドキュメント化の準備

まだ作らない。

作る場合の候補:

```text
docs-site/
```

または別ディレクトリ:

```text
/home/garchomp-game/workspace/create-game-starlight
```

想定構成:

- Overview
  - Arena Coreとは
  - ライブラリ比較の目的
  - Phaserへ寄せた理由
- Architecture
  - Phaser adapter
  - simulation
  - domain
  - config/schema
  - telemetry/debug
- Playtest
  - v0.2 baseline
  - v0.3 healing pickup
  - balanceProbeの位置づけ
- Backlog
  - v0.3 tickets
  - item system roadmap
- Development
  - commands
  - tests
  - E2E screenshots
  - known warnings

作る前に決めること:

- このrepo内に置くか、別repo/別ディレクトリにするか。
- 自分用の開発ノートにするか、公開可能な比較教材にするか。
- screenshotsやdebug exportをどこまで含めるか。

## 10. 新セッションへの初回依頼文

次のように依頼すると戻りやすい。

```text
/home/garchomp-game/workspace/create-game でゲーム開発を再開してください。
まず AGENTS.md と docs/28-session-restart-guide.md を読んで、Phaser v0.3 の残チケットを確認してください。
実装には入らず、PH-V03-002 の手動プレイ検証計画と必要な準備を整理してください。
```

実装まで進める場合:

```text
/home/garchomp-game/workspace/create-game でゲーム開発を再開してください。
AGENTS.md と docs/28-session-restart-guide.md を読んだうえで、PH-V03-002 から順番に進めてください。
検証結果を docs に残し、必要なら heal pickup tuning の最小変更案まで出してください。
```
