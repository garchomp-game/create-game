---
title: Arena Core 開発ドキュメント
description: ゲーム設計、実装方針、開発計画、プレイテスト記録の入口。
---

`Arena Core` は、ブラウザで動く見下ろし型アリーナサバイバルゲームです。

このサイトには、現在の実装状況、ゲームデザイン、技術設計、作業計画、プレイテスト結果を集約しています。

## 現在の開発段階

| 項目 | 状態 |
| --- | --- |
| 主実装 | Phaser版 |
| 現在の基盤 | v0.6.8公開ベータ。Phaser 4 WebGL、Pulse外周反射、端末内記録、有限終了 |
| 公開先 | [arena-core.garchomp-game.workers.dev](https://arena-core.garchomp-game.workers.dev/) |
| 次の作業 | v0.7へ向けたSession / Run LifecycleとDebug / AI / Performanceの責務分離 |
| その次 | v0.7の構造化出現、ステージ、エリート、ボス試作 |

最新状況は [現在地](game/current-state/) を参照してください。

## 目的別の読み方

| 知りたいこと | 読むページ |
| --- | --- |
| 今何が動き、次に何をするか | [現在地](game/current-state/) / [直近フェーズ](project-management/next-phase-plan/) |
| どんなゲームを目指すか | [ゲーム方針](product/game-direction/) / [拡張設計の全体像](design/gameplay-expansion-blueprint/) |
| 実装上の境界と品質基準 | [アーキテクチャ](engineering/architecture/) / [品質戦略](engineering/quality-strategy/) |
| バージョンごとの作業内容 | [ロードマップ](project-management/roadmap/) / [チケット一覧](project-management/tickets/) / [v0.5チケット詳細](project-management/v05-tickets/) / [v0.6チケット詳細](project-management/v06-tickets/) |
| 判断の経緯と残リスク | [意思決定記録](project-management/decision-log/) / [リスク一覧](project-management/risk-log/) |
| 実際のプレイ結果 | [手動プレイ記録](playtest/playtest-notes/) / [バランス回帰テスト](playtest/balance-probe/) |

## 正本の使い分け

似た内容を扱うページは、役割を次のように分けます。

- [現在地](game/current-state/): 実装済み機能と最新判断。
- [拡張設計の全体像](design/gameplay-expansion-blueprint/): 面白さを作る原則とシステム全体像。
- [直近フェーズ](project-management/next-phase-plan/): 今から着手する範囲と順序。
- [v0.5作業計画](project-management/endless-polish-plan/): v0.5の要件、実装結果、完了根拠。
- [v0.5チケット詳細](project-management/v05-tickets/): v0.5各チケットの依存、受け入れ条件、検証方法。
- [v0.6チケット詳細](project-management/v06-tickets/): v0.6各チケットの依存、受け入れ条件、検証方法。
- [中長期作業計画](project-management/gameplay-expansion-plan/): v0.6からv1.0までの詳細要件。
- [ロードマップ](project-management/roadmap/): 各バージョンの要約。
- [チケット一覧](project-management/tickets/): チケット番号と状態の索引。

内容が競合した場合は、より対象範囲が狭く、更新日の新しいページを優先します。

## 表記方針

- 読者向けの見出し、説明文、チケット名は日本語で記述します。
- クラス名、型名、フィールド名、URLパラメータなど実装上の識別子は、`RunRecord` や `rulesetVersion` のように原文を保ちます。
- Phaser、Vite、Playwrightなどの製品名は翻訳しません。
- `run`、`stage`、`upgrade` など一般的なゲーム用語は、本文ではラン、ステージ、強化と表記します。

旧Markdown資料は履歴保全のため原文のまま残し、[旧資料一覧](archive/legacy-index/) から参照できます。
