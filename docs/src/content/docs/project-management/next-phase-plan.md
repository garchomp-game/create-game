---
title: 直近フェーズ
description: v0.7 RC6の安定化、v0.8の面白さ検証、Stage 1 / 5 / 10の3作戦検証へ進む現在の計画。
---

最終整理日: 2026-07-23

## 現在の判断

v0.6.8 productionはcommit `ff686f992a65`、Cloudflare Version `e86f90b8-ea15-4d1d-b01b-59e4f9fea78e`のまま維持します。

v0.7 RC6は、Encounter Directorの時計、Commander期限、Expedition記録scope、難度時計、ボス終端を固定し、全自動ゲートと通常UI欠陥特化ランを完了しました。2400 HP有限回復候補は0/6勝利で棄却し、`repairBudget: null`のcontrolを採用します。

通常UIではPulseが1敗1勝、Spreadが1勝し、両武器でboss phase 2と3攻撃種へ到達しました。勝利ランの回復相殺率は99.96%と98.21%でしたが、中央周回へ固定せず、範囲攻撃、外周退避、遮蔽、通常敵撃破、回復経路の判断変更が必要でした。RC6のゲームルール採否を完了し、PR #82をmerge commit `0e07347424a8`としてmainへ統合しました。

RC5は棄却して消すのではなく、技術回帰と欠陥分類の基準証跡として保持します。選択画面の改善はRC6と同じrulesetを使う別UI candidateとして扱い、ゲームルールPRへ混ぜません。

v0.8のWork再レビューは受領し、Issue #83で採否を完了しました。production統合順では、次のruntime変更をCharger衝突妨害による危険反転[#76](https://github.com/garchomp-game/create-game/issues/76)だけに限定し、その前にcandidate非依存の観測、記録、fixture、division契約をWave 0として固定します。

別経路として、2026-07-23にownerからEX Protocolの実装handoffを受領しました。`feat/v08-ex-protocols-c1`でCore完成後の固定3択、E1 / E2、Mastery、既存Limit Break、6体系、24 route、RunRecord v3、probe / soakを比較可能なcandidateへしています。これはproduction順の変更ではなく、feature OFF、専用ruleset、外部pushなしのisolated implementationです。

## 実装基点

- RC5 UI変更前の統合基点: `d16655a`
- RC5 app / ruleset: `0.7.0` / `phaser-v0.7.0-final-expedition-rc5`
- RC6採用ruleset: `phaser-v0.7.0-final-expedition-rc6`
- RC6 main基準: `0e07347424a8` / merged PR [#82](https://github.com/garchomp-game/create-game/pull/82)
- RC6 UI candidate: `1fdaca2adcd4` / Draft PR [#84](https://github.com/garchomp-game/create-game/pull/84) / [UI統合Preview](https://v07-rc6-ui-playtest-arena-core.garchomp-game.workers.dev)
- RC5 Preview: `https://v07-final-expedition-arena-core.garchomp-game.workers.dev`
- production: v0.6.8 Versionを100%維持

`d16655a`はUI境界、比較prototype、選択画面の変更前にあるRC5基点です。RC6のゲームルールはここから独立branchで実装し、採否後にmainへ統合しました。既存UIの採用範囲はRC6基点のPR #84へ移し、production trafficは配布SHA固定まで変更しません。

横断QAのGitHub ActionsはPR #87でmainへ追加し、PR #96でGitHub-hosted UbuntuのFirefox WebGL実行を安定化しました。[#86](https://github.com/garchomp-game/create-game/issues/86)は、PR #96とmain `8635ca0`の3 job greenを取得して完了しています。型、unit、配布build、Starlight、短いrelease smokeをPR statusにし、probe、全画像、実GPU耐久、人間採否は変更内容に応じた手動ゲートとして残します。

RC6採用を止めなかった共通APIのLowリスクは[#88](https://github.com/garchomp-game/create-game/issues/88)で独立処理しました。debug相当の時刻ジャンプで期限切れspawnを出さず、fallback geometryが予告方向を増やさないことをfixture化し、Encounter数値と難度は変更していません。全unit、配布build、release smoke、normal probeとPR #89の3 job greenを取得し、mainへ統合して完了しています。

## RC6の実行順

### Wave 1: Encounter時計

Issue: [PH-V07-010 #73](https://github.com/garchomp-game/create-game/issues/73)

状態: 完了。2秒間隔、10秒配置期限、spawn後120秒、timeout撤退を実装し、unit / simulation 373件と既存6構成probeを通過しました。

- `runElapsed`、`actElapsed`、`activeElapsed`の所有者を分ける。
- Commander cardがAct時計を止める。
- 120秒はspawn成功後から数える。
- spawn deferを決定論的に再試行し、期限で必ず解放する。

### Wave 2: 記録とruleset

Issue: [PH-V07-011 #74](https://github.com/garchomp-game/create-game/issues/74)

状態: 完了。保存fixture、全unit / simulation、production build、最終遠征ブラウザフロー、リザルト画像を確認しました。

- 勝利ランの総クリア時間をExpeditionの主記録にする。
- 敗北が勝利PBを上書きしないようにする。
- `overall | weapon`の比較scopeを同じ履歴から導出する。
- fixed seed実値とRC6 rulesetで記録を分ける。
- 速攻成果は戦術点から外し、時間メダルへ移す。

### Wave 3: 有限回復候補

Issue: [PH-V07-012 #75](https://github.com/garchomp-game/create-game/issues/75)

状態: 完了。2400 HP・補充なしのcandidate Aは0/6勝利となり棄却しました。Wave 2のRC6基礎版をcontrolとして維持します。

- Wave 1 / 2を通したRC6基礎版をcontrolにする。
- 同じ3 seed x 2武器で有限repair budget候補をペア比較する。
- 回復相殺率を`ボス中の実HP回復量 / ボス中の総被ダメージ`で統一する。
- 回復全体、Endless、武器数値を同時に変えない。
- control 3/6勝利に対してcandidate Aは0/6勝利だったため、結果を見て値を変更せず不採用とする。
- 比較結果は[RC6 有限回復予算 比較結果](../../playtest/v07-rc6-repair-budget-report/)を正本にする。

### Wave 4: 統合QAと採否

Issue: [PH-V07-008 #59](https://github.com/garchomp-game/create-game/issues/59)

状態: 自動ゲートと通常UI採否を完了し、RC6 controlを採用しました。提出物再レビューの追補はcode commit `c908450a7101`で完了し、65 files・420 passed / 2 skipped、normal / repair各`1 passed / 1 skipped`、Playwright 73 passed / 1 skipped、production buildと配布検査を通過しました。Pulse 2本・Spread 1本の手動結果と最終Version Preview、Draft PRのSHA付き証跡は[#59](https://github.com/garchomp-game/create-game/issues/59)へ集約します。

- 全6のCommander撃破、Act 5、全攻撃種と、専用fixtureのboss phase 2を機構到達性としてassertする。
- 自然runはPulse / Spread各1本以上のboss phase 2到達を要求する。
- 自然勝利3/6以上、Pulse / Spread各1勝以上を戦闘退行ゲートにする。
- CommanderのAct境界越えは専用fixture、spawn deferと終了状態は全入力replayでassertする。
- run exportへ総時間と`difficultyElapsed`を別々に残す。
- 全回帰後、Pulse / Spread各1本以上で中央周回を手動再試行する。
- 新しいVersion Previewで実URLsmoke後にproduction判断を記録する。

技術契約は[最終遠征RC6の時計と記録規則](../../engineering/expedition-rc6-clock-and-ranking-adr/)、検証手順は[RC6 QA・採否計画](../../playtest/v07-rc6-qa-plan/)を正本とします。

## RC6後のv0.8

v0.8はコンテンツ量を増やす前に、Arena Coreの面白さの核を単独candidateで検証します。

| Wave | Issue | 検証するもの |
| --- | --- | --- |
| 0A | [#83](https://github.com/garchomp-game/create-game/issues/83) | 採否済みの緊張・緩和、near-miss、難易度支援、公平性を正本文書へ同期 |
| 0B | [#66](https://github.com/garchomp-game/create-game/issues/66) | 世界観、視覚言語、素材と音の境界 |
| T1 | [#97](https://github.com/garchomp-game/create-game/issues/97) | 現行visualのTrainingで説明不足だけを切り分ける |
| T2 | [#98](https://github.com/garchomp-game/create-game/issues/98) | T1後も誤認が残る場合だけ戦闘オブジェクト視覚を比較する |
| 0C | [#77](https://github.com/garchomp-game/create-game/issues/77) | candidate非依存のsimulation facts、純粋ledger集計、Presenter境界 |
| 0D | [#93](https://github.com/garchomp-game/create-game/issues/93) | ボス攻撃文法、回復窓、反撃窓の観測契約 |
| 0E | [#94](https://github.com/garchomp-game/create-game/issues/94) | 主敗因、実測near-miss、同条件再挑戦の事実契約 |
| 0F | [#95](https://github.com/garchomp-game/create-game/issues/95) | Standard / Assist / Practice / OverloadとPB分離、旧記録migration |
| 0G | [#80](https://github.com/garchomp-game/create-game/issues/80) | candidate非依存の最大密度fixture骨格。色・音・意味は後続 |
| 0H | [#78](https://github.com/garchomp-game/create-game/issues/78) | 二時計と責務境界。runtimeは#70採否後 |
| 1 | [#76](https://github.com/garchomp-game/create-game/issues/76) | Charger衝突妨害による危険反転だけをpaired比較 |
| 2以降 | [#81](https://github.com/garchomp-game/create-game/issues/81) | RC6、各単独candidate、統合候補へ再利用する構造化playtest |
| 3候補 | [#93](https://github.com/garchomp-game/create-game/issues/93) | #76採否後にボス攻撃文法のruntime候補を単独比較 |
| 後続 | [#92](https://github.com/garchomp-game/create-game/issues/92) / [#79](https://github.com/garchomp-game/create-game/issues/79) | 通常強化の基礎保証と武器教義を別candidateとして検証 |
| 独立X | `PH-V08-027` | EX Protocol 6体系を実装可能な比較物にし、自動契約と人間gateを分ける |

[#77](https://github.com/garchomp-game/create-game/issues/77)は[#76](https://github.com/garchomp-game/create-game/issues/76)固有の意味や閾値を持たず、既存eventと将来candidateの事実を同じledgerへ入力できる共通基盤にします。[#80](https://github.com/garchomp-game/create-game/issues/80)はfixture骨格を先行し、candidate固有の色・音・判定は意味確定後に足します。[#81](https://github.com/garchomp-game/create-game/issues/81)は最終QAへ限定せず、RC6 baselineと各candidateを別セル・raw countで繰り返し評価します。

ゲームルールを同時に複数変更しません。#76を最初のruntime candidateとし、#93、#94、#95、#92、#79は責務と観測を先に固定しても、production挙動へは一括投入しません。

EX Protocol branchはこの原則の例外としてproductionへ統合するものではありません。handoffの大きいscopeを一つの専用branchへ閉じ、candidate OFF parity、専用記録、rollbackを先に完成させます。production採用を検討する場合は、#79との追跡関係、20 seed release結果、実GPU、人間6体系gateを改めて判断します。

UI境界[#68](https://github.com/garchomp-game/create-game/issues/68)、比較prototype[#67](https://github.com/garchomp-game/create-game/issues/67)、選択画面縦切り[#70](https://github.com/garchomp-game/create-game/issues/70)の採用範囲はRC6基点のDraft PR #84へ集約しました。旧RC5基点のPR #72はsupersededとして閉じ、外部可読性確認が終わるまでIssueを開いたまま維持します。

体験仮説と採否順は[v0.8 面白さの核の検証](../../design/core-promise-validation/)、作業と統合のゲートは[v0.8 実行計画](../v08-execution-plan/)、外部助言は[外部ゲームデザイン助言メモ](../../design/external-game-design-advice/)を正本とします。[v0.8 Work再レビュー依頼](../../playtest/v08-work-design-review-request/)は受領時点の提出スナップショットとして保持し、現在の採否はIssue #83と前記正本を優先します。

## キャンペーン再スコープ

10ステージを一括で実装する計画は、2026-07-19にStage 1 / 5 / 10の3作戦検証へ変更しました。旧計画は履歴として残し、Stage 2から4、6から9を3本の採否後へ延期します。

- [PH-V09-001 #62](https://github.com/garchomp-game/create-game/issues/62): 仮StageDefinitionで完了可能な3作戦の進行と選択基盤。
- [PH-V09-002 #64](https://github.com/garchomp-game/create-game/issues/64): #62へ載せるStage 1 基礎迎撃。
- [PH-V09-003 #65](https://github.com/garchomp-game/create-game/issues/65): #62と#64の後に載せるStage 5 四方包囲。
- Stage 10: 現行`final-expedition`をRC6で安定化。

この3本で、初回学習、中間の複合判断、高難度最終試験がつながるかを確認します。つながらない状態で残り7本を量産しません。

詳細は[エクスペディション3作戦検証](../../design/expedition-campaign/)を参照してください。

## 着手条件

翌日の実装開始前に、各Issueで次を満たします。

- プレイヤー体験として解く問題が一文で説明できる。
- 所有者、依存方向、対象外が決まっている。
- fixed fixtureまたはseedで再現できる。
- ruleset、保存schema、比較scopeへの影響が明記されている。
- 自動保証と手動採否を分けている。
- 不採用時に戻せる境界がある。

要件と判断はStarlight、進捗・依存・PRはGitHub Issues / Projectを正本とします。Linearや別の独自管理ツールは追加しません。

## production昇格条件

- #73と#74が完了し、#75の比較とcandidate A棄却判断が完了している。新候補を採用する場合だけ全ゲートを再実行する。
- RC6の全6構成が全ボス攻撃へ到達し、phase 2 fixture、3/6以上かつ各武器1勝以上の自然勝利と全入力replayが通る。
- 敗北、fixed seed、overall / weapon PB、旧ruleset分離がfixtureで保証される。
- Pulse / Spread各1本以上の通常UIランで中央周回を再試行している。
- 不可視攻撃、予告なし即死、操作不能、データ損失、重大性能劣化がない。
- 新しいVersion Previewの実URLsmokeと採否記録がある。

RC6はこの条件を満たしてmainへ統合済みです。#86の品質ゲート、#88のEncounter境界追補、PR #90 / #91の比較手順と正本同期もmainへ入り、基準`b561aa6aeca5`のfresh CIを取得しました。#97のTraining T1は接触課題を含む9課題runtime `78b79da9c5aa`へ更新し、owner gate、PR #99の3 CI job、Cloudflare Version `7eaaf10f-fd82-4032-b363-5d4b44db8293`の実URLsmokeを完了してmain採用を決定しました。直近は#81の人間転移確認で、誤認が残る場合だけ#98の視覚T2へ進みます。日程待ちと並行できるのは#76の値・seed・raw-count閾値・停止条件の事前登録までです。PR #84のUI採否と#76のruntime candidateは同じ比較buildへ混ぜません。production trafficの切替は、採用するUIと配布SHAを固定してから別途行います。

EX Protocol candidateの直近作業は、正本文書とCI契約の同期、全体回帰、release規模のbalance / soak、実GPU耐久、人間6体系gateです。前半3件までは自律実行でき、実GPUと人間評価は別ゲートとして残します。詳細は[EX Protocol候補](../../design/ex-protocols/)を参照してください。
