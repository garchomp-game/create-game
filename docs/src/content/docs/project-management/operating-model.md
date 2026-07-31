---
title: 運用方針
description: 要件整理、チケット分割、実装、検証、記録の進め方。
---

## 基本方針

方向性の判断、要件整理、実装、検証を小さく分けます。

チケットやサブエージェントへ作業を渡す前に、次を揃えます。

- チケットID。
- 目的。
- 対象範囲。
- 対象外。
- 依存関係。
- 完了条件。
- テスト方針。
- 既知リスク。

## 進め方

1. ゲーム方針と優先順位を決める。
2. 要件整理チケットで責務とデータ境界を決める。
3. 1つの仮説を検証する小さな試作へ分ける。
4. 単体テスト、E2E、画面比較、手動プレイを変更規模に応じて行う。
5. 採用、調整、削除を判断する。
6. 結果を現在地、ロードマップ、意思決定記録、リスク一覧へ反映する。

## 原則

- 複数の新システムを同時に増やさない。
- バランス回帰テストを人間のプレイテストの代替にしない。
- ゲームプレイ変更ではラン出力とリザルト指標も更新する。
- 基盤だけを作り続けず、各バージョンへプレイヤーが体験できる変化を含める。
- 完了条件を満たさない試作は、維持する前に削除も選択肢にする。
- コンテンツ量産は、組み合わせの面白さを確認してから行う。

Ultraを使う長時間の自律作業では、ゴールの粒度、反復上限、QAの昇格条件、
計装と文書同期の扱いを[Ultra自律開発運用](../ultra-workflow/)に従って決めます。
メインエージェントをPM兼ゲームディレクターとし、調査・実装・独立監査を
委譲する場合は[Codex PM・サブエージェント運用](../codex-autonomous-operation/)を
実行契約にします。

## ソロ開発のGit運用

2026-07-26以降は`main`を唯一の常用branchとします。

- 通常作業は`main`へ直接、小さな意味単位でcommitする。
- taskごとの長期branch、stacked PR、常設worktreeは作らない。
- push前は変更対象のunit、型検査、必要な対象E2Eを実行する。
- push後は`main`のGitHub Actionsを共有証跡とする。
- `main` CIが失敗した場合は、新機能へ進まず次commitで修復する。
- 実験候補は長期branchではなく、feature flag、開発専用entry、固定fixtureで隔離する。
- rollbackはrelease tag、Cloudflare Version、git commit SHAで行う。

PRを使うのは、外部レビューを明示的に依頼する場合、破壊的migration、公開API変更、
または複数人開発へ移行した場合に限定します。一時branchを作った場合も、採否完了後すぐ
`main`へ統合または破棄し、branchとworktreeを残しません。

## 実装中の検証 cadence

各小変更で同じ重い証拠を取り直しません。検証は次の3段階へ分けます。

| 段階 | 実行するもの | 実行時点 |
| --- | --- | --- |
| Checkpoint | 型検査、変更箇所のunit、短いCPU fixture、対象画面smoke | 小さなcommitごと |
| Slice | 全unitまたは関連E2E、対象画像、production artifact非混入 | 関心事単位の縦切り完了時 |
| Adoption | 全E2E、seed matrix、長時間probe、配布build、必要な実GPU・人間確認 | 候補SHAと設定を固定した最後 |

保存migration、RNG、共有simulation、入力境界、ruleset、配布identityへ触れた場合は、
影響する統合gateをAdoptionまで待たずに実行します。失敗や想定外の差分がなければ、
全ブラウザ、全画像、soakをcommitごとに繰り返しません。

外部サービスが不安定な場合も、ローカル変更の粒度は変えません。commitとpushを小さくし、
GitHubのIssue URL、remote SHA、CI statusを読み直してから次の書き込みへ進みます。
APIのtimeout後は作成済みかを確認し、同じIssueやコメントを即時再送しません。

## ドキュメント更新

- 実装済みの事実は [現在地](../../game/current-state/) へ記録する。
- 短期作業は [直近フェーズ](../next-phase-plan/) へ記録する。
- バージョン全体は [ロードマップ](../roadmap/) へ記録する。
- 詳細要件は対象バージョンの作業計画へ記録する。
- 判断変更は [意思決定記録](../decision-log/) へ残す。
- 未解決の危険は [リスク一覧](../risk-log/) へ残す。

## チケットとGitHubの役割

- Starlightを、製品コンセプト、永続する設計判断、実装済み事実、全体順序の正本とする。
- 現在着手するGitHub Issueを、その一件のGoal Contract、対象範囲、受け入れ条件、
  進捗、実装中の議論の正本とする。
- 両者が競合する場合は着手せず、PMが最新の採用判断を確認して両方を同期する。
- GitHubのタイトルには `PH-V05-001` のような文書側IDを含める。
- [チケット一覧](../tickets/)から対応するIssueへリンクする。
- 要件を変更した場合は、Issueだけで完結させず、対象バージョンの詳細資料と意思決定記録を更新する。
- 実装と自動受け入れが完了したIssueは閉じ、横断的な人間確認だけが残る場合は
  構造化プレイテストIssueへ集約する。
- 重複、現仕様で無効、後続Issueへ包含されたIssueは理由と移行先を残して閉じる。
- Issueのハード削除は、誤作成、機密情報、内容が空のものに限る。通常は履歴を残して閉じる。
- 具体的な着手条件がないアイデアはopen Issueにせず、Starlightのbacklogへ置く。

open Issueの上限は原則12件、`priority:P0`は2件、同時着手は1件までとします。
新しいIssueを追加するときは、既存Issueの完了、統合、延期を同時に確認します。

GitHub Projectsは一覧表示の補助として任意利用し、実行順の必須正本にはしません。
直近の順序は[課題解決キュー](../issue-resolution-queue/)、実行対象と現在の
契約はopen Issueで管理します。

現在のProjectは[Arena Core Roadmap](https://github.com/users/garchomp-game/projects/1)です。

- `Status`: Todo、In Progress、Done。
- `Priority`: P0、P1、P2。
- `Phase`: Public Beta、v0.7、Later。
- `Area`: Release、Architecture、Gameplay、Presentation、QA。
- `Size`: S、M、L。時間見積もりではなく変更範囲と検証量の目安にする。
- `Wave`: 0 Baselineから6 QA。依存関係を満たす実装順として使う。
- Milestoneはリリース単位、Issueは実装単位を表します。Project fieldの同期は必須にしません。

自律作業では、`Status=Todo`だけを着手可能とはみなしません。[v0.7 実行計画](../v07-execution-plan/)のDefinition of Readyを満たし、入口ゲートを越えたIssueから進めます。

このリポジトリのGitHub操作は `garchomp-game/create-game` を対象とし、別アカウントの資格情報を暗黙に使いません。

書き込み前には表示上のアカウント名だけでなく、次を確認します。

```bash
gh api user --jq .login
gh api repos/garchomp-game/create-game --jq .permissions
```

APIの実ユーザーが`garchomp-game`で、対象リポジトリに`push`または`admin`権限がある場合だけ、Project、Milestone、Issueを変更します。

この権限確認は、現在の依頼における外部書込の許可を代替しません。Goal Contractで
`local-only`、`commit`、`push-main`、`GitHub Issue / Project`の許可範囲を分け、
依頼に含まれない変更は資格情報が利用可能でも実行しません。
