---
title: v0.8 Training H1 / H2 無進展ガイド候補
description: 総経過時間ではなく課題ごとのmeaningful progressで発火する二段階ガイド候補。
---

最終整理日: 2026-07-24

:::note[比較baseline]
この資料は、H0では短いinstructionと対象ringだけを表示し、H1で初めて
WASD / mouse記号を出す候補を記録している。ownerの追加観測を受け、
開始前とactive直後から方向付きglyphを出す別候補を
[Training H0 即時操作ガイド候補](../v08-training-immediate-guidance-candidate/)
として分離した。本資料を黙って書き換えず、比較baselineとして残す。
:::

## 仮説

T1.2-Cの短い説明だけでは操作を始めない初心者に対し、最初から文章を
増やすのではなく、停止したときだけ入力と対象を強調した方が開始を助けられる。
総経過時間ではなく課題に関係する進展で時計を戻すことで、操作中の参加者を
不要なヒントで遮らない。

## Candidate

| 段階 | 発火 | 表示 |
|---|---|---|
| H0 | 課題開始 | T1.2-Cの短いinstructionと静的な対象ring |
| H1 | 5秒間meaningful progressなし | WASDまたはmouse記号、対象pulse。文章は追加しない |
| H2 | さらに5秒間meaningful progressなし | H1に加え、短い具体文と対象までのguide |

H2後も自動成功、自動skip、timeout進行は行わない。

## Meaningful progress

- `move`、`navigate`: 自機が0.5px以上実移動した。
- `aimAndKill`: pointer照準が更新された、または対象へhitした。
- `collectXp`、`collectRepair`: 自機と対象の距離が0.5px以上縮んだ。
- `dodgeProjectile`: 自機が0.5px以上実移動した、または敵弾が非衝突で通過した。
- 無関係な射撃入力、停止したままのキー入力、Worldの総経過だけではresetしない。
- Pause、briefing、upgrade選択中は無進展時計を進めない。

`contactDamage`は観察課題、`chooseUpgrade`は既存choice UIが入力表示を所有し、
`transferDrill`は案内なしの転移確認であるため、このcandidateの段階hint対象外とする。

## 観測

`TutorialSnapshot.noProgressSeconds`と
`tutorial.hint.shown(stepId, hintLevel, noProgressSeconds)`を追加する。
Trainingは引き続き`recordPolicy: none`であり、RunRecord、Profile、PB、
ランキングへ書き込まない。StudyLogへ取り込む場合もローカル検証用の別契約とする。

## 固定するもの

- T1.2-Cのcopy、9課題の順序、briefing / active状態機械。
- 座標、敵、敵弾、Pickup、障害物、成功guard、retry checkpoint。
- simulation、RNG、score、ruleset、Profile、RunRecord。
- 戦闘object visual、O1入口、production traffic。

## 自動受け入れ

- 5秒未満はH0、5秒でH1、10秒でH2になる。
- meaningful progressでH0へ戻り、無関係な入力では戻らない。
- Pauseと経過停止中は時計が進まない。
- retryは同じ課題の時計を保持し、次課題でresetする。
- H1のlandscape / portrait、H2のnavigation guideをvisual fixtureで確認する。
- unit、typecheck、公開入力Training E2E、production buildがgreenである。

## 人間採否

T1.2-Cと別SHAで比較し、次をraw countで残す。

- 課題ごとのH1 / H2到達者数。
- H1後に最初の正しい入力へ移った人数と秒数。
- H2到達後も停止した人数。
- ヒントなしで操作していたのにH1が出た誤発火。
- Training後のEndless 30秒probeと意味説明。

H1が停止解除へ寄与せず視界だけを増やす、または正しく操作中の参加者へ頻繁に
出る場合は採用しない。閾値を同じ比較結果の後付けで変更せず、次candidateとして
事前登録する。
