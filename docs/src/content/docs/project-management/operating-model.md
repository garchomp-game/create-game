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

## ドキュメント更新

- 実装済みの事実は [現在地](../../game/current-state/) へ記録する。
- 短期作業は [直近フェーズ](../next-phase-plan/) へ記録する。
- バージョン全体は [ロードマップ](../roadmap/) へ記録する。
- 詳細要件は対象バージョンの作業計画へ記録する。
- 判断変更は [意思決定記録](../decision-log/) へ残す。
- 未解決の危険は [リスク一覧](../risk-log/) へ残す。

## チケットとGitHubの役割

- Starlightの作業計画とチケット詳細を、目的、対象範囲、受け入れ条件の正本とする。
- GitHub Issueを、担当、進捗、実装中の議論、関連PRの正本とする。
- GitHubのタイトルには `PH-V05-001` のような文書側IDを含める。
- [チケット一覧](../tickets/)から対応するIssueへリンクする。
- 要件を変更した場合は、Issueだけで完結させず、対象バージョンの詳細資料と意思決定記録を更新する。
- 完了時は、自動テストと手動確認の証跡をIssueへ残してから閉じる。

GitHub Projectsは横断的な実行順の正本として使います。

現在のProjectは[Arena Core Roadmap](https://github.com/users/garchomp-game/projects/1)です。

- `Status`: Todo、In Progress、Done。
- `Priority`: P0、P1、P2。
- `Phase`: Public Beta、v0.7、Later。
- `Area`: Release、Architecture、Gameplay、Presentation、QA。
- `Size`: S、M、L。時間見積もりではなく変更範囲と検証量の目安にする。
- `Wave`: 0 Baselineから6 QA。依存関係を満たす実装順として使う。
- Milestoneはリリース単位、Projectは複数Milestoneをまたぐ依存順、Issueは実装単位を表す。

自律作業では、`Status=Todo`だけを着手可能とはみなしません。[v0.7 実行計画](../v07-execution-plan/)のDefinition of Readyを満たし、入口ゲートを越えたIssueから進めます。

このリポジトリのGitHub操作は `garchomp-game/create-game` を対象とし、別アカウントの資格情報を暗黙に使いません。

書き込み前には表示上のアカウント名だけでなく、次を確認します。

```bash
gh api user --jq .login
gh api repos/garchomp-game/create-game --jq .permissions
```

APIの実ユーザーが`garchomp-game`で、対象リポジトリに`push`または`admin`権限がある場合だけ、Project、Milestone、Issueを変更します。
