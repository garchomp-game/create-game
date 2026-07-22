---
title: v0.8 構造化プレイテスト記録票
description: 初心者と経験者の行動変化、失敗理解、再挑戦理由を同じ手順で記録するテンプレート。
---

最終更新日: 2026-07-22

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

| Cell | Build | 目的 | 混ぜないもの |
| --- | --- | --- | --- |
| T0 | RC6 baseline、Trainingなし | 初心者の敵弾・回収理解baseline | 事前fixture、動画、最小説明 |
| T1 | #97 Training後、同一gameplay | TrainingからEndlessへのtransfer | T2 visual、#76、事前fixture、動画 |
| RC6 | RC6 baseline | 現行の理解、失敗、再挑戦理由 | 全candidate |
| #76-control | RC6 Charger | 予告前撃破と突進機会の成立 | HP、spawn、武器数値、反転効果 |
| #76 | Charger危険反転だけ | 基本回避、意図的誘導、反転後の行動 | HP、spawn、Boss、Doctrine、offer変更 |
| #93 | Boss runtime candidateだけ | attack理解、学習、Punish利用 | #76、回復以外の同時調整 |
| #94 | 結果・再挑戦UX | 敗因、factual near-miss、同条件復元 | Assist gameplay |
| #95 | division / 記録契約preview | division理解、比較eligibility、保存先 | Assist gameplay、複数modifier |
| #92 | 通常offer candidateだけ | 候補偏りと選択判断 | Doctrine、武器数値 |
| #79 | Doctrine candidateだけ | 武器固有の行動変化 | offer規則変更 |
| Integrated | 採用済み要素だけ | 要素間の整合 | 棄却・未採用candidate |
| UI | RC6 UI candidate | 選択肢の可読性と再開操作 | 上記cellの人数、ゲームルール評価 |

Cellごとにbuild SHA、ruleset、seed、weapon、record policy、run順を固定します。同じ参加者が複数cellへ参加した場合は経験済みとして扱い、初心者の初回データへ戻しません。T0とT1は同じ初心者へ連続実施せず、参加者間で割り当てます。UI比較は別手順で行い、#81の参加人数へ二重計上しません。

## 実施前

### セッション情報

```text
sessionId:
participantId:
cohort: novice | experienced
cell: T0 | T1 | RC6 | #76-control | #76 | #93 | #94 | #95 | #92 | #79 | Integrated | UI
date:
facilitator:
buildCommit:
appVersion:
rulesetVersion:
seedMode: random | fixed
seed:
mode:
recordPolicy:
modifiers:
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

### 条件と武器順序

通常のRun 1とRun 2は同じseed、weapon、ruleset、mode、record policy、modifierを復元します。奇数IDはPulse、偶数IDはSpreadから始め、同条件再挑戦後にもう一方の武器を別runで最低1回確認します。再挑戦効果と武器変更効果を同じRun 2へ混ぜません。

T0 / T1はtransfer比較を優先するため、desktop landscape、同じ自動射撃設定、Pulse、fixed seedを固定します。T0はTrainingを行わず、T1はTraining完了後に同じEndless probeへ進みます。

## 実施手順

### T0 / T1: Training transfer

初心者をT0またはT1へ一度だけ割り当てます。T1はTrainingを完了し、完了直後に同じPulseでEndlessへ進みます。T0はTrainingを見せず、直接同じEndlessへ進みます。

transfer probeは**死亡または90秒**まで続けます。30秒で終了しません。Rangedは60秒から始まるため、次を別々に記録します。

```text
assignedCell: T0 | T1
trainingCompleted: yes | no | not-applicable
endlessStartedAt:
reached30s: yes | no
reached60s: yes | no
reached90s: yes | no
rangedReach: not-reached | reached-no-ranged | ranged-no-shot | exposed
firstRangedShotAt:
projectileResponse: avoid | attack | chase | no-response | not-observed
projectileResponseChanged: position | aim | target | none | not-observed
xpIntent: observed | not-observed | not-reached
repairIntent: observed | not-observed | not-reached
result: alive-at-90s | defeat | quit | blocked
assistance:
```

T0 / T1ではtransfer probeが終わるまで、固定fixture、静止画、動画、30秒の最小説明を見せません。敵弾へ未到達の参加者を理解失敗へ数えず、`not-reached`のまま残します。probe後に初めて認識質問と必要な説明を行います。

### 認識preflight

本ラン前に、対象cellの固定fixtureから1秒静止画と5秒clipを見せます。

T0 / T1だけはこのpreflightをtransfer probe後へ回します。事前教材でTrainingの効果を汚染しないためです。

1. player、差し迫る危険、優先標的、安全方向を指してもらう。
2. 次に起きることと、取る行動を説明してもらう。

攻略の正解は教えず、`identified / misidentified / not-observed`で記録します。

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

### Run 1直後の未誘導回答

操作や攻略を説明する前に、後述の質問1、2、3、8をこの順で聞き、原文のまま記録します。ここで得た目標理解、敗因、次の行動、再挑戦意欲を、最小説明後の回答で上書きしません。

### 最小説明

Run 1の自由回答を先に取得した後、必要だった操作だけを30秒程度で説明します。

- WASDまたは矢印で移動する。
- マウスで照準し、自動射撃できる。
- XPを集めると強化を選べる。
- 予告は危険範囲または侵入方向を示す。
- 目的は生存、または作戦完遂である。

攻略法、推奨build、ボス攻撃の答え、武器の強弱は説明しません。

### Run 2: 同条件再挑戦

Run 1と同じseed、weapon、ruleset、mode、record policy、modifierを復元します。参加者へ「前回と変える行動があれば、試してください」とだけ伝え、意図的な行動変化を観察します。観察項目はRun 1と同じです。

### 武器比較run

Run 1 / 2と異なる開始武器を最低1回使います。これは同条件再挑戦とは別に集計し、武器変更による結果差をRun 2の学習効果へ数えません。追加runは必須2ランの結果と分けて記録します。

### 必須run後の5分自由選択

必須runと直後質問が終わった後、「残り5分は自由に遊ぶか、ここで終了できます」とだけ伝えます。modeやweaponを勧めず、menuから本人が選ぶまで待ちます。

```text
freeChoiceStartedAt:
firstChoiceAt:
selectedAction: same-mode-same-weapon | same-mode-other-weapon | other-mode | training | quit | no-choice
selectedMode:
selectedWeapon:
runActuallyStarted: yes | no
statedReason:
observedReason:
```

自己申告の「もう一度遊びたい」だけで継続性を判定せず、実際の選択と開始を対にします。Endless / Expeditionの役割比較では順序を参加者ごとに入れ替え、最初に提示したmodeの効果を分けます。

### #76-control: Charger viability

反転candidateを見せる前に、経験者の現行Chargerを観察します。各Chargerについて次をeventと画面観察から記録します。

```text
chargerSpawned:
killedBeforeTelegraph:
telegraphed:
charged:
obstacleInterrupted:
boundaryInterrupted:
recovered:
killedByWeapon:
```

最初の経験者3名中2名が予告前に撃破した場合、または熟練runの大半でchargeが発生しない場合は#76のruntime候補を停止します。この段階でCharger HP、spawn頻度、初回待機、武器数値を変えません。

## 行動観察

各項目は`observed | not-observed | not-reached | failure`で記録し、推測を事実欄へ書きません。機会があったのに行わなかった`not-observed`、場面へ未到達の`not-reached`、試したが失敗した`failure`を混ぜません。

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
| 反転 | #76で意図的誘導と偶発衝突を区別し、反転後に反撃・回収・位置改善を行った |
| ボス | #93でWarn、React、被弾、Punish利用をexposure別に記録した |
| 結果 | #94で主敗因とnear-missの事実一致、同条件復元を確認した |
| 記録条件 | #95でmode、modifier、比較eligible / ineligibleを説明できた |

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
9. 結果画面の主敗因や「あと少し」は、実際のランと一致していましたか。
10. 表示されたmode / modifierと、この記録がどこへ保存されるかをどう理解しましたか。

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
cell:
weaponOrder:

understoodWithoutHelp:
blockedOrMisread:
run2BehaviorChange:
failureExplanation:
pulseMentalModel:
spreadMentalModel:
hazardMentalModel:
primaryCauseMatch:
nearMissFactMatch:
recordPolicyUnderstanding:
freeChoice:
freeChoiceReason:
retryReason:
stopReason:

severity: P0 | P1 | tuning | preference | none
evidence:
candidateAction: adopt | revise | reject | insufficient-data
followUpIssue:
```

`P0`は開始不能、操作不能、soft lock、記録損失、Standardへの記録混入、ログと一致しないnear-missです。`P1`は主要情報を一貫して読めず、通常操作で繰り返し不利になる問題です。単独の好みや一度の低得点をP0 / P1へ上げません。

## 中止条件

- 体調不良、不快感、参加中止の希望。
- 操作不能、soft lock、重大な点滅・音響問題。
- build、ruleset、入力条件が記録できず比較不能。
- 進行役が攻略を教えてしまい、説明なし条件を維持できない。
- 無予告または視界外と認識される必須攻撃が再現する。
- false near-miss、mode / modifier / eligibility誤記録、Practice / AssistのStandard PB混入が1件でも起きる。

中止ランも削除せず、理由を残して比較対象外にします。

## 集計

最低条件は初心者2名、経験者2名、各2ランです。人数を満たせない場合は探索的所感として残し、v0.8全体の採否を確定しません。

最低条件では割合による一般化を行いません。candidate固有の項目は必ず`該当人数 / 到達人数`で示し、人数不足、未到達、未観測を0件として扱いません。最終閾値は募集前・結果閲覧前に対象Issueへ事前登録します。

集計では次を分けます。

- cohort別、Run 1 / 2別、武器順序別。
- T0 / T1別の30 / 60 / 90秒到達と、Rangedへの`exposed / not-reached`。
- 必須run後の自由選択と、実際に次runを開始したか。
- `not-observed`と`not-reached`。
- `failure`と、そもそも機会がなかった状態。
- UI問題、ゲームルール問題、説明不足、単なる好み。
- 自己申告とRunRecord・観察事実の一致、不一致。

結果は[#81](https://github.com/garchomp-game/create-game/issues/81)とdecision logへ要約し、生の個人情報や録画をStarlightへ公開しません。
