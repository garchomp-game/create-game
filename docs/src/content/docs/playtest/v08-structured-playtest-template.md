---
title: v0.8 構造化プレイテスト記録票
description: 初心者と経験者の行動変化、失敗理解、再挑戦理由を同じ手順で記録するテンプレート。
---

最終更新日: 2026-07-20

## 目的

[#81 初心者・経験者の構造化プレイテスト](https://github.com/garchomp-game/create-game/issues/81)で、最高得点や好みだけに寄らず、次を同じ形式で記録します。

- 説明なしで理解できた操作と、止まった箇所。
- 失敗理由を本人が説明できるか。
- 次のランで意図的に変えた行動。
- Pulse / Spreadが要求する判断の違い。
- 危険、強化選択、最大密度を読み取れたか。
- もう一度試す理由、止める理由。

これは小人数の探索的テストです。統計的有意差を主張せず、自動AIの勝敗を人間の理解度へ混ぜません。

## プライバシー

- 氏名、メール、Discord名、顔、音声などの個人情報を記録しない。
- 参加者は`N01`、`N02`、`E01`のような匿名IDで扱う。
- 画面録画を使う場合は事前に同意を得て、公開時は匿名化する。
- Run JSONと観察メモは匿名ID、build、ruleset、run番号だけで対応させる。
- 同意を得られない場合も、手動時刻メモだけで参加できる。

## 比較単位

| Phase | Build | 目的 | 混ぜないもの |
| --- | --- | --- | --- |
| A | RC6 baseline | 現行の理解、失敗、再挑戦理由 | 危険反転、技能ledger、武器教義 |
| UI | RC6 UI candidate | 選択肢の可読性と再開操作 | #81の人数要件、ゲームルール評価 |
| B | 危険反転単独candidate | 回避と反転成功の理解 | 武器教義、統合演出 |
| C | v0.8統合候補 | 採用した要素同士の整合 | 不採用candidate |

Phaseごとにbuildとrulesetを固定します。同じ参加者が複数Phaseへ参加した場合は経験済みとして扱い、初心者の初回データへ戻しません。

## 実施前

### セッション情報

```text
sessionId:
participantId:
cohort: novice | experienced
phase: A | UI | B | C
date:
facilitator:
buildCommit:
appVersion:
rulesetVersion:
previewUrl:
browser:
viewport:
inputDevice:
recordingConsent: yes | no
notes:
```

### cohortの定義

- `novice`: Arena Coreを未経験、または過去に1ラン以下。
- `experienced`: Endlessか最終遠征を複数回プレイし、強化と危険eventを経験済み。
- 境界が曖昧な場合は自己申告した経験回数をメモし、都合よく分類し直さない。

### 武器順序

最低2ランでPulseとSpreadを1回ずつ使います。奇数IDはPulseから、偶数IDはSpreadから開始し、説明効果と武器順序が常に一致しないようにします。

## 実施手順

### Run 1: 説明なし

「画面を見て、遊べるところまで進めてください」とだけ伝えます。操作、目的、強化、危険の意味を先に説明しません。参加者が明示的に助けを求めても、操作不能でない限りラン終了まで回答を保留します。

観察者は発言を誘導せず、次の時刻と事実を記録します。

```text
runId:
weapon:
startedAt:
firstMovementAt:
firstAimOrShotAt:
firstPickupAt:
firstChoiceAt:
firstHazardReactionAt:
endedAt:
result: victory | defeat | quit | blocked
score:
elapsed:
reachedActOrTier:
bossPhase:
intervention:
```

### 最小説明

Run 1後に、必要だった項目だけを30秒程度で説明します。

- WASDまたは矢印で移動する。
- マウスで照準し、自動射撃できる。
- XPを集めると強化を選べる。
- 予告は危険範囲または侵入方向を示す。
- 目的は生存、または作戦完遂である。

攻略法、推奨build、ボス攻撃の答え、武器の強弱は説明しません。

### Run 2: 別武器

Run 1と異なる開始武器を使います。参加者へ「前回と変える行動があれば、試してください」とだけ伝えます。観察項目はRun 1と同じです。

時間が許す場合のRun 3は自由選択としますが、必須2ランの結果と分けて記録します。

## 行動観察

各項目は`observed | not-observed | not-reached`で記録し、推測を事実欄へ書きません。

| 領域 | 観察する事実 |
| --- | --- |
| 開始 | mode、stage、weaponを自力で選び、30秒以内に移動または照準した |
| 回収 | XPと回復を区別し、必要なときに経路を変えた |
| 選択 | 候補を読み、keyboardかpointerで選び、1秒以内に移動・照準・射撃へ戻った |
| 危険 | 予告に反応して位置、射線、標的のいずれかを変えた |
| Pulse | 集束、列、反射、優先標的のいずれかを意図して使った |
| Spread | 扇形、複数標的、近距離群れ処理のいずれかを意図して使った |
| 立て直し | 被弾後に距離、遮蔽、回復経路、標的を変えた |
| 敗北 | 終了後に原因と次に変える行動を本人の言葉で説明した |

## ラン直後の質問

質問文は候補の答えを含めず、順番も固定します。

1. 何を目標に遊んでいましたか。
2. 一番危なかった、または失敗した原因は何だと思いますか。
3. 次に同じ場面へ来たら、何を変えますか。
4. 今の武器は、どんな狙い方や位置取りが得意だと思いますか。
5. 画面上で意味が分からなかったものはありましたか。
6. 強化を選んだ直後、操作へ戻りにくい場面はありましたか。
7. 危険予告を見たとき、逃げる以外にできそうなことはありましたか。
8. もう1回遊びたいですか。そう思う、または思わない理由は何ですか。

自由回答を先に記録し、その後だけ1から5の補助評価を取ります。

```text
goalClarity: 1..5
failureClarity: 1..5
weaponClarity: 1..5
warningClarity: 1..5
choiceReadability: 1..5
retryIntent: 1..5
```

小標本の平均だけで採否せず、自由回答と実際の行動が一致するかを優先します。

## セッション要約

```text
participantId:
cohort:
phase:
weaponOrder:

understoodWithoutHelp:
blockedOrMisread:
run2BehaviorChange:
failureExplanation:
pulseMentalModel:
spreadMentalModel:
hazardMentalModel:
retryReason:
stopReason:

severity: P0 | P1 | tuning | preference | none
evidence:
candidateAction: adopt | revise | reject | insufficient-data
followUpIssue:
```

`P0`は開始不能、操作不能、soft lock、記録損失です。`P1`は主要情報を一貫して読めず、通常操作で繰り返し不利になる問題です。単独の好みや一度の低得点をP0 / P1へ上げません。

## 中止条件

- 体調不良、不快感、参加中止の希望。
- 操作不能、soft lock、重大な点滅・音響問題。
- build、ruleset、入力条件が記録できず比較不能。
- 進行役が攻略を教えてしまい、説明なし条件を維持できない。

中止ランも削除せず、理由を残して比較対象外にします。

## 集計

最低条件は初心者2名、経験者2名、各2ランです。人数を満たせない場合は探索的所感として残し、v0.8全体の採否を確定しません。

集計では次を分けます。

- cohort別、Run 1 / 2別、武器順序別。
- `not-observed`と`not-reached`。
- UI問題、ゲームルール問題、説明不足、単なる好み。
- 自己申告とRunRecord・観察事実の一致、不一致。

結果は[#81](https://github.com/garchomp-game/create-game/issues/81)とdecision logへ要約し、生の個人情報や録画をStarlightへ公開しません。
