---
title: 課題解決キュー
description: 現行v0.8と次フェーズのIssueを、単一active・依存順で判断する正本。
---

最終更新日: 2026-10-05（進捗同期。採用順は2026-07-31から変更なし）

:::note[2026-10-05の未採用移行候補]
[有限作戦UXへの移行候補](../finite-operation-ux-migration-candidate/)を別ページに整理しました。
D01は[#146](https://github.com/garchomp-game/create-game/issues/146)としてP1 / queuedで起票済みです。
#138 / #135の進捗と既存候補のpushを同期しましたが、D01の採用順変更は行っていません。
以下の現行キューは、正式な判断と同期が済むまで維持します。
:::

## 2026-10-05の残タスクとNEXT

既存候補は`65c62e2`までmainへpush済みです。GitHub openは12件、P0は#138 / #81の2件、
`status:next`は#138だけです。push、CI成功、Issue起票を人間採用やproduction反映と混同しません。

| 対象 | 残タスク | NEXT / 着手条件 |
| --- | --- | --- |
| [#138 タイトル候補](https://github.com/garchomp-game/create-game/issues/138) | 追加対象E2E、初見1秒理解・実操作、人間採否 | 既存CI 4 jobは成功。追加15件をCIへ接続して結果を取得後、初見人間gateへ。未完のままclose / #139昇格をしない |
| [#146 D01](https://github.com/garchomp-game/create-game/issues/146) | 有限作戦を第一検証にするか、未提供参照の扱い、正本・Issue依存同期 | queuedの判断候補。採用 / 修正 / 保留 / 棄却を明示するまで現行順序を維持 |
| [#135内のB01残件](https://github.com/garchomp-game/create-game/issues/135) | 静止照準で停滞ヒントが抑止される再現済み不具合の修正・QA | 未起票。単一writerとopen上限の下で限定契約を作り、次の導入を使う初心者観察より前に解消。D01採否には依存しない |
| #139 → #140 | 導入完了保存・階層、状態に沿う用語 | #138採否後、正式契約に沿って一件ずつ進める。D01の新文言は未適用 |
| #141 → #142 → #80 → #81 | 視覚縦切り、画面横断統一、密度確認、人間統合採否 | 現行キューの依存を維持。D01採用時だけ再同期する |
| #144 → #143 → #145 / 未起票S01 | Commander観察、Story仕様、選択した縦切り | 現行はv0.9 deferred。D01は#144 / #143前倒しを提案するだけ。S01は#143で選ばれ、仕様確定した場合だけ起票。#145へ自動移行する案ではない |

D01の提案順、S01の人間観察・受け渡し・最終close条件は
[未採用移行候補](../finite-operation-ux-migration-candidate/)に分離します。
枠確保だけの早期closeや、複数Issueの同時active化は行いません。

## このページの役割

このページは、Arena Coreの残課題を一度に実装せず、ユーザーと一件ずつ
要件・採否・実装結果を確認するための正本です。

- 製品コンセプト、永続する設計判断、全体順序はStarlightを正本にします。
- 現在着手する一件の実行契約、受け入れ条件、進捗はGitHub Issueを正本にします。
- GitHub IssueとStarlightが競合する場合は実装を止め、先にPMが矛盾を解消します。
- 同時に`status:next`を付けるIssueは一件だけにします。
- 完了後に次の`status:queued`を`status:next`へ昇格します。
- 実装前に判断が必要なIssueは`type:decision`を付けます。
- 将来案は`status:deferred`と再開条件を持たせます。

## 現在の実行順

| 順序 | Issue | 状態 | 今回決めること |
| ---: | --- | --- | --- |
| 親 | [#135 UI視覚刷新](https://github.com/garchomp-game/create-game/issues/135) | `tracking:epic` | 子Issueの進捗だけを追跡する |
| 1 | [#138 初回タイトルの行動導線](https://github.com/garchomp-game/create-game/issues/138) | `status:next` | 初回向け主CTAと副導線の階層 |
| 2 | [#139 Storyの階層・進行](https://github.com/garchomp-game/create-game/issues/139) | `status:queued` | 初期作戦完了保存、最終遠征のlockまたは警告 |
| 3 | [#140 用語と説明文](https://github.com/garchomp-game/create-game/issues/140) | `status:queued` | 一般語、初出説明付き固有名、非表示の区分 |
| 4 | [#141 タイトル / Story視覚縦切り](https://github.com/garchomp-game/create-game/issues/141) | `status:queued` | 軌道回収案と第一画面のグラフィカル表現 |
| 5 | [#142 選択UI / HUD / リザルト](https://github.com/garchomp-game/create-game/issues/142) | `status:queued` | 採用した視覚文法の画面横断統一 |
| 6 | [#80 最大密度・警告ゲート](https://github.com/garchomp-game/create-game/issues/80) | `status:queued` | 高密度でも自機、危険、回復、目的を読めるか |
| 7 | [#81 構造化プレイテスト](https://github.com/garchomp-game/create-game/issues/81) | `status:queued` | 初心者と経験者の実行動でv0.8を採否する |

順序1から5では対象unit、対象fixture、短いbrowser smokeを基本にします。
全unit、全E2E、全画像、配布build、実GPU確認は、順序6へ渡す統合候補で
まとめて実行します。

## v0.9準備キュー

v0.8の順序7まで完了した後、次の一件だけを`status:next`へ昇格します。

| 順序 | Issue | 現在 | 今回決めること |
| ---: | --- | --- | --- |
| 8 | [#144 Commander反撃窓](https://github.com/garchomp-game/create-game/issues/144) | `status:deferred` | 既存Commander制圧が説明可能な反撃・回収・位置改善になるか |
| 9 | [#143 一戦完結Story構造](https://github.com/garchomp-game/create-game/issues/143) | `status:deferred` | 中間作戦、難易度別、ハイブリッドと最初の縦切り |
| 10 | [#145 11分目Story縦切り](https://github.com/garchomp-game/create-game/issues/145) | `status:deferred` | Story専用の10:00〜11:00が第1キャンペーンとして成立するか |

順序は **#144 → #143 → #145** です。#144は現行挙動で成立すれば
runtimeを変えずに閉じます。#145は現行Endlessの崩壊、PB、ランキングと
別のStory専用ruleset / 記録scopeにします。

## 外部指摘との対応

| 指摘 | 現在の解決度 | 残るIssue |
| --- | --- | --- |
| 文字中心で導入離脱しやすい | 戦闘object、背景、入力promptは改善。タイトルとStoryは文字中心 | #141、#142 |
| 専門用語が多い | `REPAIR`を回復キット、`Protocol`を固有スキルへ変更済み。一部固有語と英語見出しが残る | #140 |
| タイトルの選択肢が多く最初が不明 | 主CTA候補を実装・push済み。対象E2E・初見人間gate待ちで、未採用 | #138 |
| 初回難度と成長が急 | Story初期作戦、段階的な敵導入、XP曲線、強化提示間隔を実装済み | #81で人間確認 |
| チュートリアルが分かりにくい | Story内3任務10課題、即時key prompt、接触・回避・回復・強化を実装済み | #139、#81 |
| PC専用だと分からない | mobile / touch-onlyを起動前に止め、PC・キーボード・マウスを案内済み | 完了 |
| ゲーム画面が仮デザインに見える | 共通sprite、XP、回復、敵弾、戦術背景、設定、選択UIを改善済み | #141、#142、#80 |

## 一件ごとの進め方

1. `status:next`のIssue本文と関連Starlightだけを読む。
2. Issue内の未決定事項をユーザーと確定する。
3. 採用案、非スコープ、rollbackをIssueへ記録する。
4. 一つの変更理由だけを実装する。
5. 対象テストと画面確認を行う。
6. 採用、修正、棄却の判断をIssueとdecision logへ残す。
7. Issueを閉じ、次の一件だけを`status:next`へ変更する。

途中で別の改善案が出た場合、現在Issueの完了条件へ不可欠でなければ、
新規Issueまたは既存親Issueへ記録して現在作業へ混ぜません。

## 2026-07-27に終了した旧Issue

| Issue | 終了理由 | 後継 |
| --- | --- | --- |
| [#76 Charger衝突妨害](https://github.com/garchomp-game/create-game/issues/76) | charge 1/12、Pulse 0/6で候補の成立条件が現行の強い行動と競合 | 新しい仮説が出た場合だけ再起票 |
| [#77 技能shadow ledger](https://github.com/garchomp-game/create-game/issues/77) | Phase 0 fact kernelは完了。利用者不在の汎用Presenterを先行しない | 必要な画面側で小さく起票 |
| [#79 武器教義](https://github.com/garchomp-game/create-game/issues/79) | EX Protocol C2の6固有スキルへ具体化済み | #81、#140、#142 |
| [#93 Boss攻撃文法](https://github.com/garchomp-game/create-game/issues/93) | Attack Cardとshadow観測は完了。runtime欠陥は未確定 | #81または#143後に必要時起票 |
| [#62 3作戦進行](https://github.com/garchomp-game/create-game/issues/62) | 現行Storyが初期作戦 + 最終遠征へ変化 | #143 |
| [#64 Stage 1](https://github.com/garchomp-game/create-game/issues/64) | 学習目的を現行`story-intro`で実装済み | #139、#81 |
| [#65 Stage 5](https://github.com/garchomp-game/create-game/issues/65) | 中間作戦を採るか自体が未決定 | #143 |

Issueは削除していません。本文、コメント、比較結果を履歴として保持し、
後継Issueから参照できる状態でcloseしています。

## 正本の使い分け

- 製品コンセプト: [ゲームコンセプト](../../product/game-concept/)。
- 現在の一件と全体順序: 本ページ。
- 現在動く機能: [現在地](../../game/current-state/)。
- 直近の作業方針: [直近フェーズ](../next-phase-plan/)。
- Codexの担当分けと完了条件: [Codex PM・サブエージェント運用](../codex-autonomous-operation/)。
- UI境界と比較方法: [UI・グラフィック再設計計画](../ui-visual-redesign-plan/)。
- タイトルとStoryの既存判断: [タイトル導線とストーリー初期作戦](../../engineering/story-onboarding-adr/)。
- 採否履歴: [意思決定記録](../decision-log/)。
- GitHub上の進捗: [Arena Core Roadmap](https://github.com/users/garchomp-game/projects/1)。
