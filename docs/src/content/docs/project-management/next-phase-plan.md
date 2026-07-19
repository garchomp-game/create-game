---
title: 直近フェーズ
description: v0.7 RC6の安定化、v0.8の面白さ検証、Stage 1 / 5 / 10の3作戦検証へ進む現在の計画。
---

最終整理日: 2026-07-19

## 現在の判断

v0.6.8 productionはcommit `ff686f992a65`、Cloudflare Version `e86f90b8-ea15-4d1d-b01b-59e4f9fea78e`のまま維持します。

v0.7 RC5は、5 Act、構造化出現、HP 500のCommander、Charger、追跡ボス、制圧衝撃波、ボス中回復drop制限、勝利リザルトまで統合しました。3 fixed seed x 2武器の6勝、決定論、72件のE2E、Version Preview smokeも完了しています。

ただし、RC5をそのままproductionへ昇格しません。外部レビューと現行設計の再確認から、次の3点をRC6で直してから採否する方針へ変更しました。

1. HUD表示だけでなく、Encounter DirectorがAct遷移を所有する。
2. Expeditionの総クリア時間、戦術点、総合PB、武器別PB、fixed seedを分離する。
3. 中央周回と回復循環は、有限回復予算を独立候補として比較する。

RC5は棄却して消すのではなく、技術回帰と欠陥分類の基準証跡として保持します。

## 実装基点

- RC5 UI変更前の統合基点: `d16655a`
- RC5 app / ruleset: `0.7.0` / `phaser-v0.7.0-final-expedition-rc5`
- RC6予定ruleset: `phaser-v0.7.0-final-expedition-rc6`
- RC5 Preview: `https://v07-final-expedition-arena-core.garchomp-game.workers.dev`
- production: v0.6.8 Versionを100%維持

`d16655a`はUI境界、比較prototype、選択画面の変更前にあるRC5基点です。RC6のゲームルールはここから独立branchで進め、既存のUI branchを維持します。RC6採否前にproduction trafficを変更しません。

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

状態: 実装、ローカル自動検証、Version Previewの実URLsmokeは完了。Commander停止中も`runElapsed`で通常敵圧力が先行する不整合とAct時計のstep丸め依存を修正しました。候補は3/6勝（Pulse 1、Spread 2）、全6で全攻撃、5/6でphase 2へ到達し、全入力replayと全回帰を通過しました。通常UI採否だけを残しています。

- 全6のCommander撃破、Act 5、全攻撃種と、専用fixtureのboss phase 2を機構到達性としてassertする。
- 自然runはPulse / Spread各1本以上のboss phase 2到達を要求する。
- 自然勝利3/6以上、Pulse / Spread各1勝以上を戦闘退行ゲートにする。
- CommanderのAct境界越えは専用fixture、spawn deferと終了状態は全入力replayでassertする。
- run exportへ総時間と`difficultyElapsed`を別々に残す。
- 全回帰後、Pulse / Spread各1本以上で中央周回を手動再試行する。
- 新しいVersion Previewで実URLsmoke後にproduction判断を記録する。

技術契約は[最終遠征RC6の時計と記録規則](../../engineering/expedition-rc6-clock-and-ranking-adr/)、検証手順は[RC6 QA・採否計画](../../playtest/v07-rc6-qa-plan/)を正本とします。

## RC6後のv0.8

v0.8はコンテンツ量を増やす前に、Arena Coreの面白さの核を縦切りで検証します。

| 順序 | Issue | 検証するもの |
| --- | --- | --- |
| 0 | [#66](https://github.com/garchomp-game/create-game/issues/66) | 世界観、視覚言語、素材と音の境界 |
| 1 | [#76](https://github.com/garchomp-game/create-game/issues/76) | 危険を敵へ返す危険反転event |
| 1 | [#78](https://github.com/garchomp-game/create-game/issues/78) | 選択停止時間、頻度、再開硬直の計測 |
| 2 | [#77](https://github.com/garchomp-game/create-game/issues/77) | 技能shadow ledgerと次ランの目標 |
| 3 | [#79](https://github.com/garchomp-game/create-game/issues/79) | Pulse / Spreadの武器教義branch |
| 4 | [#80](https://github.com/garchomp-game/create-game/issues/80) | 最大密度の視覚fixtureと警告音分離 |
| 6 | [#81](https://github.com/garchomp-game/create-game/issues/81) | 初心者・経験者の構造化プレイテスト |

UI境界[#68](https://github.com/garchomp-game/create-game/issues/68)、比較prototype[#67](https://github.com/garchomp-game/create-game/issues/67)、選択画面縦切り[#70](https://github.com/garchomp-game/create-game/issues/70)は既存branchに実装済みです。統合前のためIssueは開いたまま維持し、v0.8 Milestoneで追跡します。

体験仮説と採否順は[v0.8 面白さの核の検証](../../design/core-promise-validation/)を正本とします。

## キャンペーン再スコープ

10ステージを一括で実装する計画は、2026-07-19にStage 1 / 5 / 10の3作戦検証へ変更しました。旧計画は履歴として残し、Stage 2から4、6から9を3本の採否後へ延期します。

- [PH-V09-001 #62](https://github.com/garchomp-game/create-game/issues/62): 3作戦の進行と選択基盤。
- [PH-V09-002 #64](https://github.com/garchomp-game/create-game/issues/64): Stage 1 基礎迎撃。
- [PH-V09-003 #65](https://github.com/garchomp-game/create-game/issues/65): Stage 5 四方包囲。
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

- #73、#74、採用する#75候補が完了している。
- RC6の全6構成が全ボス攻撃へ到達し、phase 2 fixture、3/6以上かつ各武器1勝以上の自然勝利と全入力replayが通る。
- 敗北、fixed seed、overall / weapon PB、旧ruleset分離がfixtureで保証される。
- Pulse / Spread各1本以上の通常UIランで中央周回を再試行している。
- 不可視攻撃、予告なし即死、操作不能、データ損失、重大性能劣化がない。
- 新しいVersion Previewの実URLsmokeと採否記録がある。

RC6がこの条件を満たすまで、v0.8のゲームルール実装とStage 1 / 5の実装は開始しません。文書、UI branch、fixture設計は並行可能です。
