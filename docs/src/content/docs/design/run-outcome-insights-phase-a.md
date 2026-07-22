---
title: 敗因・進捗・再挑戦 Phase A
description: Run Fact Kernelから主敗因、事実進捗、次の一手、同条件再挑戦contextを導出する純粋ViewModel契約。
---

最終更新日: 2026-07-22

## 目的

[#94 敗因説明・実測near-miss・即時再挑戦](https://github.com/garchomp-game/create-game/issues/94)のPhase Aとして、結果画面へ接続する前に「何を事実として表示できるか」を固定します。

この段階ではsimulation、乱数、RunRecord保存、PB、ランキング、画面を変更しません。入力は[#77](https://github.com/garchomp-game/create-game/issues/77)の`RunFactReadModel`と同じrunの`ObservedGameEvent`、出力は純粋な`RunOutcomeInsightViewModel`です。

## モジュール境界

| モジュール | 責務 |
| --- | --- |
| `runOutcomeInsights.ts` | 入力状態を検査し、各純粋計算を1つのViewModelへ合成 |
| `runOutcomeCause.ts` | 終了前5秒のdamage寄与、主敗因、次の一手 |
| `runOutcomeProgress.ts` | Boss HP / phase、Commander / 護衛、崩壊、near-miss用事実 |
| `runOutcomeComparison.ts` | 同条件scope、前回差分、再挑戦context |
| `runOutcomeInsights.ts`（domain） | 表示へ渡せる型と4状態 |

Presenter、Phaser、storageをこれらへimportしません。

## 主敗因

終了時刻から5秒以内の`player.damaged`を、次の安定したcause IDへまとめます。

- `boss:<attackId>`
- `contact:<enemyType>`
- `projectile`
- `collapse`
- `unknown`

合計damageが最大のcauseを選び、同値なら最後に発生した時刻、sequence、cause IDの順で決めます。最後の一撃は`isFinalHit`として残しますが、選択規則にはしません。このため最終hitが同じでも、その前のdamage構成が違えば主敗因は変わります。

次の一手は主敗因と終了時の既知圧力から1件だけ導出します。Boss攻撃、崩壊、Commander、護衛、接触、通常敵弾の順に具体的な行動へ対応させ、該当事実がない場合は終盤5秒の見直しへ戻します。

## 進捗とnear-miss

Boss進捗はspawn時の最大HP、Bossへの`enemy.hit`、phase変更、撃破eventから再計算します。終了時に生存していたCommander、護衛、最後のBoss攻撃、崩壊段階もevent列から導出します。

near-missはまだ分類しません。

| 状態 | 意味 |
| --- | --- |
| `not-reached` | Bossへ未到達 |
| `not-applicable` | 作戦完遂済み |
| `evidence-only` | 残HP、最大HP、比率、phaseを算出できるが閾値未登録 |

`evidence-only`を「惜しかった」という文言へ変換することは禁止します。人間runの結果を見る前に#94へ閾値を事前登録し、fixtureを追加した後でのみ分類を増やします。

## 前回差分

比較keyはprofile、mode、stage、difficulty、weapon、ruleset、seed category / value、正規化したmodifierです。異なる条件は`comparisonScopeMismatch`とし、前回差を作りません。

同条件では次の順に1件だけ返します。

1. 前回未完遂から完遂。
2. Boss phaseの変化。
3. Boss残HPの差。
4. 主敗因の変化。
5. centisecond単位の生存時間差。
6. 主要差なし。

再挑戦contextは同じ比較条件を複製します。Phase Aは実際のrun開始、focus、wall-clockの`retryLatencyMs`を所有しません。

## Phase Bへ進む条件

- 同一入力から常に同じViewModelが生成される。
- 同じ最終hitでも直前damageに応じて主敗因が変わる。
- 入力順を変えても結果が変わらず、入力自体を変更しない。
- 未終端runを`not-reached`、不正factを`invalid`として扱う。
- 閾値未登録のnear-miss文言が0件である。
- runtimeへ接続する前に、結果画面のdesktop / portrait fixtureと#81の質問を固定する。

Assist / Practice導線は記録軸の契約が完成するまで接続しません。
