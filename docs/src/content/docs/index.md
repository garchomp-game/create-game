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
| 現在の基盤 | Story初期作戦、Endless、最終遠征、Practice、固有スキル、共通visual、PC専用gateをmainへ統合済み |
| 製品コンセプト | 「包囲は、反撃の設計図になる」を2026-07-31の次フェーズ軸として採用 |
| 公開先 | [arena-core.garchomp-game.workers.dev](https://arena-core.garchomp-game.workers.dev/) |
| 次の作業 | [#138](https://github.com/garchomp-game/create-game/issues/138)で、初回タイトルの主CTAとモード階層を決める |
| その次 | Story進行、用語、タイトル視覚、画面横断UI、最大密度、人間検証を一件ずつ進める |

最新状況は [現在地](game/current-state/)、実行順は
[課題解決キュー](project-management/issue-resolution-queue/) を参照してください。

## 目的別の読み方

| 知りたいこと | 読むページ |
| --- | --- |
| 今何が動き、次に何をするか | [現在地](game/current-state/) / [課題解決キュー](project-management/issue-resolution-queue/) / [直近フェーズ](project-management/next-phase-plan/) |
| どんなゲームを目指すか | [プロダクトコンセプト](product/game-concept/) / [ゲーム方針](product/game-direction/) / [拡張設計の全体像](design/gameplay-expansion-blueprint/) |
| 外部助言とv0.8設計契約 | [外部ゲームデザイン助言メモ](design/external-game-design-advice/) / [Work提出スナップショット](playtest/v08-work-design-review-request/) / [批判的レビューの採用判断](design/v08-critical-review-adoption/) / [v0.8 面白さの核の検証](design/core-promise-validation/) / [危険反転の実装前比較](design/hazard-reversal-preflight/) / [武器教義の実装前比較](design/weapon-doctrine-preflight/) / [最大密度の可読性・警告音 事前監査](design/maximum-density-readability-preflight/) / [v0.8観測境界](engineering/v08-observability-preflight/) |
| v0.8で追加した責務 | [Story導線](engineering/story-onboarding-adr/) / [敗因・再挑戦](design/run-outcome-insights-phase-b/) / [記録軸](engineering/run-record-axis-contract-adr/) |
| 実装上の境界と品質基準 | [アーキテクチャ](engineering/architecture/) / [品質戦略](engineering/quality-strategy/) |
| UI、グラフィック、比較草案 | [UI・グラフィック再設計計画](project-management/ui-visual-redesign-plan/) / [選択UI候補プレイテスト](playtest/v08-ui-candidate-playtest/) / [UI/UXとフィードバック](design/ui-ux/) |
| バージョンごとの作業内容 | [ロードマップ](project-management/roadmap/) / [チケット一覧](project-management/tickets/) / [v0.5チケット詳細](project-management/v05-tickets/) / [v0.6チケット詳細](project-management/v06-tickets/) |
| 判断の経緯と残リスク | [意思決定記録](project-management/decision-log/) / [リスク一覧](project-management/risk-log/) |
| Codexへ自律作業を渡す方法 | [Codex PM・サブエージェント運用](project-management/codex-autonomous-operation/) / [Ultra自律開発運用](project-management/ultra-workflow/) |
| 実際のプレイ結果と次回手順 | [手動プレイ記録](playtest/playtest-notes/) / [RC6現行QA](playtest/v07-rc6-integration-report/) / [Training T1候補](playtest/v08-training-t1-candidate/) / [EX C2最新main統合](playtest/v08-ex-c2-main-integration-report/) / [v0.8 構造化プレイテスト記録票](playtest/v08-structured-playtest-template/) |

## 正本の使い分け

似た内容を扱うページは、役割を次のように分けます。

- [現在地](game/current-state/): 実装済み機能と最新判断。
- [プロダクトコンセプト](product/game-concept/): 製品の北極星、一戦内成長、モード役割、未検証仮説。
- [課題解決キュー](project-management/issue-resolution-queue/): 現在の単一Next Issue、依存順、旧Issueの終了理由。
- [拡張設計の全体像](design/gameplay-expansion-blueprint/): 面白さを作る原則とシステム全体像。
- [直近フェーズ](project-management/next-phase-plan/): 今から着手する範囲と順序。
- [v0.8 実行計画](project-management/v08-execution-plan/): v0.8の依存、candidate分離、統合・採否ゲート。
- [v0.5作業計画](project-management/endless-polish-plan/): v0.5の要件、実装結果、完了根拠。
- [v0.5チケット詳細](project-management/v05-tickets/): v0.5各チケットの依存、受け入れ条件、検証方法。
- [v0.6チケット詳細](project-management/v06-tickets/): v0.6各チケットの依存、受け入れ条件、検証方法。
- [UI・グラフィック再設計計画](project-management/ui-visual-redesign-plan/): 表示責務、比較草案、ライブラリ採否、実装Wave。
- [中長期作業計画](project-management/gameplay-expansion-plan/): v0.6からv1.0までの詳細要件。
- [ロードマップ](project-management/roadmap/): 各バージョンの要約。
- [チケット一覧](project-management/tickets/): チケット番号と状態の索引。

製品コンセプトは同名ページを優先します。実装事実は「現在地」、現在の一件の
実行契約と進捗はGitHub Issue、全体順序は「課題解決キュー」を優先します。
それ以外の内容が競合した場合は、実装を始めず、より対象範囲が狭く更新日の新しい
採用判断を確認して正本を同期します。

## 表記方針

- 読者向けの見出し、説明文、チケット名は日本語で記述します。
- クラス名、型名、フィールド名、URLパラメータなど実装上の識別子は、`RunRecord` や `rulesetVersion` のように原文を保ちます。
- Phaser、Vite、Playwrightなどの製品名は翻訳しません。
- `run`、`stage`、`upgrade` など一般的なゲーム用語は、本文ではラン、ステージ、強化と表記します。

旧Markdown資料は履歴保全のため原文のまま残し、[旧資料一覧](archive/legacy-index/) から参照できます。
