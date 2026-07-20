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
| 1 | [#86](https://github.com/garchomp-game/create-game/issues/86) / PR #87 / #96 | workflowとFirefox WebGL修正をmainへ統合済み。後続main `df61f14`まで3 jobがgreen | 完了。required check化は安定運用後に別判断 |
| 2 | [#88](https://github.com/garchomp-game/create-game/issues/88) / PR #89 | main `c7ec724`へ統合済み。ローカル回帰、normal probe、PR / main CIがgreen | 完了 |
| 3 | PR #90 | UI比較手順をmain `df61f14`へ統合し、PR / main CIがgreen | 完了 |
| 4 | Draft PR #91 | 圧力カーブ、計装、保守性、#83の設計判断、#97 / #98レーンを同期 | fresh docs CI後にmainへ統合 |
| 別経路 | Draft PR #84 | RC6 UI candidateとPreviewを公開済み | 人間比較で採用、再調整、棄却を決めるまでDraft維持 |

2026-07-20のGitHub Actions障害は同日04:44 UTCに解消しました。障害中の`startup_failure`はコード失敗にもgreen証跡にも含めません。復旧後のPR #91でheadless FirefoxのWebGL context生成失敗を検出し、PR #96でFirefoxだけをheaded + Xvfb + software GLへ切り替えました。検査をskipせず、PR #96のrun `29731009204`とmain `8635ca0`のrun `29731165320`はいずれも3 jobがgreenです。

## 実行Wave

| Wave | Issue | 変更する仮説 | 開始条件 | 完了時の判断 |
| ---: | --- | --- | --- | --- |
| 0A | [#83](https://github.com/garchomp-game/create-game/issues/83) | 緊張・緩和、near-miss、攻略メタ、公平性の契約 | Work回答と現行カーブ棚卸し | 判断済み。PR #91とdecision logへ責務表を同期 |
| 0B | [#66](https://github.com/garchomp-game/create-game/issues/66) | 世界観、視覚言語、素材境界 | gameplay数値を変えない比較案 | 背景、敵、警告へ展開できる1方向を選ぶ |
| UI | [#68](https://github.com/garchomp-game/create-game/issues/68) / [#67](https://github.com/garchomp-game/create-game/issues/67) / [#70](https://github.com/garchomp-game/create-game/issues/70) | 選択画面の可読性と再開操作 | PR #84と比較手順 | candidateを採用、再調整、棄却のいずれかに固定 |
| T1 | [#97](https://github.com/garchomp-game/create-game/issues/97) | 現行visualのTrainingで説明不足を切り分ける | latest main green。recordなしの独立build | 無提示transferの分類と完了可否をraw countで判断 |
| T2 | [#98](https://github.com/garchomp-game/create-game/issues/98) | 撃つ・避ける・取るの視覚意味を変える必要があるか | Phase A fixtureは先行可。runtimeはT1で誤認が残る場合だけ | 変更不要、採用、再設計、延期、棄却を固定 |
| 0C | [#77](https://github.com/garchomp-game/create-game/issues/77) | candidate非依存のfact、episode、純粋ledger | #83判断済み。既存event棚卸し済み | simulationを変えず共通schemaとinvalid-stateを固定 |
| 0D | [#93](https://github.com/garchomp-game/create-game/issues/93) | Boss Attack Cardと回復・反撃窓の観測 | RC6 control。runtime候補は入れない | 3攻撃の文法、chain、shadow指標を定義 |
| 0E | [#94](https://github.com/garchomp-game/create-game/issues/94) | 主敗因、factual near-miss、同条件再挑戦 | #77の共通fact境界 | 純粋集約fixtureとViewModelを固定 |
| 0F | [#95](https://github.com/garchomp-game/create-game/issues/95) | Standard / Assist / Practice / Overloadの記録契約 | RC6の記録比較契約 | division、eligibility、migrationを先に保証 |
| 0G | [#80](https://github.com/garchomp-game/create-game/issues/80) | 最大密度fixtureの基盤 | RC6 baseline | viewport、layer、audio channel、snapshot harnessを先行固定 |
| 0H | [#78](https://github.com/garchomp-game/create-game/issues/78) | 選択停止時間と再開事故の時計境界 | 責務設計は先行可。runtime接続は#70採否後 | wall-clockとsimulation timeを混ぜず計測 |
| 1 | [#76](https://github.com/garchomp-game/create-game/issues/76) | Charger衝突妨害で危険を反撃機会へ変えられるか | #89統合、main green、#77最小schema、#80最低fixture、定数事前登録 | RC6と別buildで回避と熟練反転をpaired比較 |
| 2 | [#81](https://github.com/garchomp-game/create-game/issues/81) | candidateを理解し行動へ変えられるか | RC6 baseline手順と#76単独build | 初心者・経験者を分け、raw countで採否 |
| 3 | [#93](https://github.com/garchomp-game/create-game/issues/93) | Bossの回復または反撃窓1件 | #76の判断記録後。必要な場合だけ | #76と別buildでcontrolと比較 |
| 4 | [#95](https://github.com/garchomp-game/create-game/issues/95) / [#94](https://github.com/garchomp-game/create-game/issues/94) | 記録分離後の結果・再挑戦UX | division / eligibility / migration完了 | Standardを守ったまま結果導線を接続 |
| Later | [#92](https://github.com/garchomp-game/create-game/issues/92) / [#79](https://github.com/garchomp-game/create-game/issues/79) | 通常強化offer / 武器教義 | 前段candidateの観察後。互いに別build | 候補運と教義効果を混ぜず個別採否 |

Wave 0はsimulation非介入の契約と観測です。並行可能でも1 Issue・1 branch・1 Draft PRを守ります。Training T1は#76のgameplay candidateと分離し、視覚T2はT1の誤認証拠がある場合だけ開始します。#81は最後だけのQAではなく、baseline、Training、単独candidate、統合buildで同じ手順を再利用する検証レーンです。

## 依存関係

```text
RC6 baseline
  |-- #83 design contract -----> #77 common ledger -----> #76 Charger candidate -----> #81 lane
  |                                  |                     |
  |                                  |                     +---- decision ----> #93 runtime candidate (optional)
  |                                  +---- #93 Phase A / #94 Phase A
  |                                  +---- #95 division contract ----> #94 result / retry UI
  |
  |-- #80 baseline fixture skeleton ---- candidate semantics ----> visual / audio finalization
  |
  |-- #97 Training T1 ----> #81 transfer ----> #98 visual T2 (only if confusion remains) ----> #80
  |
  |-- #84 UI adoption ---------> #78 choice telemetry
  |
  +-- #66 visual direction

#92 offer fairness ---- separate later build ---- #79 doctrine
```

#77はcandidate固有の合格値を所有せず、Simulation factsを純粋集約する共通基盤です。#80はviewport、layer、audio channel、snapshot harnessを先行でき、candidate固有の色・形・音だけを意味論確定後に固定します。#76と#93のruntime候補、#92と#79はそれぞれ同じbuildへ混ぜません。

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

## 設計判断後も固定しない値

#83の設計契約と責務順は決まりました。ただし次の値は、対象Issueへbaseline、seed、観察window、stop conditionとともに事前登録するまで固定しません。

- #76の`effectRadius`、`durationMs`、`maxTargets`、対象enemy kind。
- #93の回復または反撃窓candidateと値。
- #94の表示条件、時間窓、次の一手選択規則。
- Assist / Practiceの数値と提案trigger。
- 通常強化のカテゴリ最低保証、bag方式、最大未提示gap。
- 武器教義の最終強化値。
- 回復、敵密度、XP曲線の再調整。
- Stage 1 / 5 / 10のproduction実装。

## 作業再開チェック

1. **完了**: main `df61f14`のCIがfresh greenで、#86の証拠がSHAへ結び付いている。
2. **進行中**: #88 / PR #90は統合済み。PR #91を最新mainへ更新している。
3. **進行中**: #83の判断、#93から#95、#97 / #98の責務、#81の再利用レーンをStarlightへ同期している。
4. #77の最小fact / episode / invalid-state schemaを利用できる。
5. #80のwarning / impact最低fixtureと#81のbaseline手順を固定している。
6. #76で変更する仮説、値、seed、raw-count基準、stop condition、rollbackを事前登録している。
7. production v0.6.8を変更しないことを再確認している。

この7項目が揃うまで、#76のruntime実装を開始しません。
