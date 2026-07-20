---
title: v0.8 実行計画
description: RC6を固定したまま、設計契約、単独candidate、統合採否を依存順に進める作業計画。
---

最終整理日: 2026-07-20

## 目的

v0.8では機能量を増やす前に、Arena Coreの面白さの核を小さいcandidateで検証します。このページは、各Issueの詳細を繰り返すのではなく、**何を同時に変えず、どの証拠が揃ったら次へ進むか**を管理する実行表です。

体験仮説は[v0.8 面白さの核の検証](../../design/core-promise-validation/)、現行実装値は[現行の緊張・緩和カーブ棚卸し](../../design/current-pressure-curve-inventory/)、計装境界は[v0.8 観測可能性の事前監査](../../engineering/v08-observability-preflight/)を正本とします。

## 固定する基準

- ゲームルール基準はmainへ統合済みのRC6、`phaser-v0.7.0-final-expedition-rc6`とする。
- productionは配布候補のSHAと採否が揃うまでv0.6.8を100%維持する。
- UI候補はDraft PR #84で評価し、ゲームルールcandidateへ混ぜない。
- Endless、fixed seed、ランキング対象へ履歴依存の隠れた難度補正を入れない。
- 1つのcandidateで変える主要仮説は1件に限定する。
- 観戦AIの勝敗、開発者の最高得点、単一seedだけで人間向け採否を決めない。
- 不採用candidateは設定またはdata境界から外し、RC6へ戻せるようにする。

## 統合待ちの基盤

| 順序 | 対象 | 現在地 | 次のゲート |
| ---: | --- | --- | --- |
| 1 | [#86](https://github.com/garchomp-game/create-game/issues/86) / PR #87 | workflowはmainへ統合済み | GitHub Actions公式障害復旧後、main SHAで3 jobのgreenを取得 |
| 2 | [#88](https://github.com/garchomp-game/create-game/issues/88) / Draft PR #89 | ローカル全回帰とnormal probeがgreen | CI green後にmainへ統合 |
| 3 | Draft PR #90 | UI比較手順を文書化済み | #89後へ更新し、docs CI green後に統合 |
| 4 | Draft PR #91 | 圧力カーブ、計装、保守性を監査済み | #89後へ更新し、docs CI green後に統合 |
| 別経路 | Draft PR #84 | RC6 UI candidateとPreviewを公開済み | 人間比較で採用、再調整、棄却を決めるまでDraft維持 |

公式障害によるworkflow未起動はコード失敗として扱いません。障害中にrequired checkを迂回してゲームルールPRを統合せず、ローカル証拠と外部サービス状態を分けて記録します。

## 実行Wave

| Wave | Issue | 変更する仮説 | 開始条件 | 完了時の判断 |
| ---: | --- | --- | --- | --- |
| 0A | [#83](https://github.com/garchomp-game/create-game/issues/83) | 緊張・緩和、near-miss、攻略メタ、公平性の契約 | Work回答と現行カーブ棚卸し | 採用、再設計、延期、棄却をdecision logへ記録 |
| 0B | [#66](https://github.com/garchomp-game/create-game/issues/66) | 世界観、視覚言語、素材境界 | gameplay数値を変えない比較案 | 背景、敵、警告へ展開できる1方向を選ぶ |
| UI | [#68](https://github.com/garchomp-game/create-game/issues/68) / [#67](https://github.com/garchomp-game/create-game/issues/67) / [#70](https://github.com/garchomp-game/create-game/issues/70) | 選択画面の可読性と再開操作 | PR #84と比較手順 | candidateを採用、再調整、棄却のいずれかに固定 |
| 1A | [#76](https://github.com/garchomp-game/create-game/issues/76) | 危険1件を攻撃機会へ反転できるか | #83完了。Charger衝突妨害を第一候補として監査済み | 回避だけと熟練反転の両方が成立するかpaired比較 |
| 1B | [#78](https://github.com/garchomp-game/create-game/issues/78) | 選択停止時間と再開事故を測れるか | #70のUI境界採否 | 計装がsimulation hashを変えず、原因別KPIを出せるか確認 |
| 2 | [#77](https://github.com/garchomp-game/create-game/issues/77) | 技能成果と次ラン目標が理解を助けるか | #83、#76。既存event棚卸し済み | 3成果と1目標を、スコア加点なしで説明可能にする |
| 2B | [#92](https://github.com/garchomp-game/create-game/issues/92) | 通常強化の候補運をどこまで保証するか | #83、#78。現行抽選の一巡保証なしを監査済み | control、カテゴリ最低保証、通常bagから1判断へ固定 |
| 3 | [#79](https://github.com/garchomp-game/create-game/issues/79) | 武器ごとに違う判断を1 branchで作れるか | #77で観測指標を固定。Core Lock / Sweep Chainを第一候補として監査済み | 取得前後の照準、位置、標的優先の変化で採否 |
| 4 | [#80](https://github.com/garchomp-game/create-game/issues/80) | 最大密度でも重要情報を読めるか | #66、#76。既存fixtureとaudio routeを監査済み | 固定fixture、画像、警告音優先度、実GPU性能で採否 |
| 6 | [#81](https://github.com/garchomp-game/create-game/issues/81) | 初心者と経験者に学習・再挑戦が生まれるか | 各単独candidateの採否後 | RC6、単独candidate、統合候補を混ぜず最終判断 |

Wave番号はGitHub Projectの依存順と合わせます。1Aと1Bは別branch、別rulesetまたは計測設定で進め、同時に実装できても同じ比較へ混ぜません。

## 依存関係

```text
RC6 baseline
  |-- #83 design contract -----> #76 hazard reversal -----> #77 skill ledger -----> #79 doctrine
  |                                  |                           |
  |                                  +---------------------------+-----> #81 playtest
  |
  |-- #84 UI adoption ---------> #78 choice telemetry -----> #92 offer fairness
  |                                                           |
  |                                                           +-----> #79 production path
  |
  +-- #66 visual direction ----> #80 density readability -------+
```

#80は危険予告の見た目を固定するため#76を待ちます。#77は危険反転の結果eventを読む側であり、危険処理を所有しません。#79はledgerで測れない教義を先に追加しません。

## candidateごとの証拠

各candidateはPR本文と対応Issueへ次を残します。

1. baseline SHA、candidate SHA、app / ruleset / profile。
2. 変更した仮説1件と、意図的に固定した項目。
3. unit、型検査、production build、release smoke。
4. 適用範囲に応じたfixed fixture、paired seed、画像、実GPU確認。
5. 人間テストが必要な項目と、自動試験で代替できない理由。
6. 採用、再調整、棄却、延期の基準と実結果。
7. rollback方法と、旧記録を分離する`rulesetVersion`要否。

ゲームルールを変えるcandidateは新しいrulesetへ分けます。表示・開発計装だけでsimulation、乱数、保存、順位が不変なら、rulesetを不要に更新せずhash不変で証明します。

## #83回答前に進めてよい作業

- 既存event、現在の時系列、ファイル責務、fixture候補の棚卸し。
- RC6追補とCIの統合、UI比較手順の整備。
- #66の参照収集、ライセンス候補、色・形・音の制約整理。
- [#81の匿名質問票、実施手順、記録テンプレート](../../playtest/v08-structured-playtest-template/)の整備。

次は回答と採否前に固定しません。

- 危険反転のdamage、半径、頻度、得点。
- near-miss、立て直し、安全回収の閾値。
- Campaign Assistの数値と解禁条件。
- 通常強化のカテゴリ最低保証、bag方式、最大未提示gap。
- 武器教義の最終強化値。
- 回復、敵密度、XP曲線の再調整。
- Stage 1 / 5 / 10のproduction実装。

## 作業再開チェック

1. mainのCIがgreenで、#86の証拠がSHAへ結び付いている。
2. #88を統合し、PR #90 / #91を最新mainへ更新している。
3. Work回答を事実、提案、推測に分けて#83へ転記している。
4. UI candidateの外部所感を#70へ記録している。
5. 次のcandidateで変える仮説と棄却条件をIssueへ事前登録している。
6. production v0.6.8を変更しないことを再確認している。

この6項目が揃うまで、#76以降のゲームルール実装を開始しません。
