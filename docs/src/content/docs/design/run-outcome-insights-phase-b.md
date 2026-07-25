---
title: 敗因フィードバック Phase B候補
description: Standard結果へ主敗因、次の一手、同一seed再挑戦を接続する最小candidateの事前登録。
---

最終更新日: 2026-07-25

## 目的

[#94](https://github.com/garchomp-game/create-game/issues/94)のPhase Aで確定した事実を、敗北後の次の判断へつなげます。候補IDは`standard-outcome-feedback-b1`とし、`main` `4942da2`をbaselineにします。

このcandidateは結果表示と再挑戦導線だけを変更します。simulation、敵、武器、難易度、乱数消費、score、XP、PB比較関数は変更しません。

## 表示契約

敗北時だけ、結果画面中央へ次を表示します。

1. `主な敗因`: 終了前5秒の合計damageが最大だった原因1件。
2. `根拠`: damage量とhit回数。
3. `次の一手`: Phase Aが返す具体行動1件。
4. Bossへ到達していた場合だけ、Phaseと残HPを事実として表示する。

最後の一撃と主な敗因が異なる場合は主な敗因を優先します。Phase Aが`invalid`または`not-reached`の場合だけ、既存の最終damage表示へfallbackします。

次は表示しません。

- 閾値未登録の「惜しかった」「あと少し」。
- 作戦完遂後の敗因または次の一手。
- Practice、Trainingの結果分析。
- 2件以上の助言。
- 難易度を下げる提案。

## 画面構成

960 x 540の結果画面を3列として使います。

| 左 | 中央 | 右 |
| --- | --- | --- |
| score、時間、level、PB | 主な敗因、根拠、次の一手、Boss事実 | mode、build、seed、記録契約 |

中央は新しいカードにせず、既存overlay上の非装飾テキストと区切り線にします。再挑戦buttonは従来どおり先頭に置き、keyboard focusも先頭です。文言は`同じシードで再挑戦`とします。

## 再挑戦と記録公平性

再挑戦は同じmode、stage、difficulty、weapon、ruleset、seedを使います。ただし、元runがrandom seedでも再挑戦runは既存の`fixed` seed categoryへ送ります。

これにより、同じ有利seedを反復したscoreをrandom PBへ混ぜません。fixed boardではseed値ごとに比較されます。再挑戦前の結果詳細へ「再挑戦は固定シード記録」と表示します。

設定、武器、rulesetが再挑戦前に一致しない場合はexact retryを作らず、従来のrestartへfallbackします。今回、新しいranking schemaやineligibility reasonは追加しません。

## feature境界

- `VITE_ARENA_OUTCOME_FEEDBACK_CANDIDATE=1`のときだけ表示とexact retryを有効にする。
- flag OFFでは既存Presenter出力、restart seed、RunRecordを変えない。
- production trafficは採否前に変更しない。
- candidate専用のgameplay rulesetは作らない。

## 実装状況

2026-07-25に`agent/v08-outcome-feedback-phase-b`、code commit `7f0abf04def1`でB1を実装しました。

- `RunLifecycleController`が保持する同一runのfactから、結果表示と再挑戦planを生成する。
- 結果画面を左の成績、中央の振り返り、右の記録契約の3列にした。
- 最後の一撃ではなく終了前5秒の最大damage寄与を表示し、助言は1件に限定した。
- random runの同一seed再挑戦は`fixed`へ移し、random PBへ混ぜない。
- 勝利、Practice、Training、flag OFFでは候補表示とexact retryを出さない。

自動証拠はunit `105 files / 663 passed / 2 skipped`、候補E2E `1 passed`、flag OFF全E2E `108 passed / 15 skipped`です。960 x 540 fixtureでは3列と4ボタンの非重複を目視確認しました。これは候補完成の証拠であり、採用判断ではありません。

Cloudflare Version `b148a6ca-1826-40df-8d2c-cc94f895e4fc`を[固定Preview](https://v08-outcome-feedback-b1-arena-core.garchomp-game.workers.dev/)へ公開しました。通常UIだけの実URLsmokeでは5.83秒で自然敗北し、主敗因`追跡敵との接触`、根拠`100ダメージ（9回）`、次の一手`退路を一方向残す`を表示しました。履歴、同一seed再挑戦、最終遠征開始まで通過し、console error、page error、失敗request、HTTP 4xx / 5xxは0件です。production trafficは変更していません。

## 自動受け入れ

- 同じ最終hitでも直前5秒のdamage構成に応じて表示する主因が変わる。
- 敗因、根拠、次の一手が各1件に限定される。
- 勝利、Practice、未終端、invalidではcandidate表示を出さない。
- near-missが`evidence-only`の間は「惜しい」文言が0件。
- restart後のseed、weapon、mode、stage、rulesetが一致する。
- random runのrestartは`fixed`となりrandom rankingへ混ざらない。
- flag OFF時のPresenter、run context、event hashを維持する。
- 960 x 540の結果fixtureで3列とbuttonが重ならない。
- unit、candidate E2E、production E2E、build、Starlight buildがgreen。

## 人間採否

[#81](https://github.com/garchomp-game/create-game/issues/81)で表示前の自由回答を先に取り、表示後に次を記録します。

- `causeMatch`: 本人の認識と主な敗因の一致。
- `nextActionFormation`: 次runで変える行動を説明できたか。
- `retryLatencyMs`: 結果確定から再挑戦開始まで。
- 誤帰属、理解不能、助言が実行不能だった件数。

自動greenは表示と記録の整合性を保証するだけです。採用には、結果画面を見た参加者が次の一手を説明でき、誤帰属が増えないことを必要とします。

次はVersion PreviewでEndless / Final Expeditionの敗北を各1本以上確認し、表示を見る前の自由回答と`causeMatch`、表示後の`nextActionFormation`を[#81](https://github.com/garchomp-game/create-game/issues/81)へ記録します。near-missの肯定表現とAssist / Practice導線は引き続き対象外です。
