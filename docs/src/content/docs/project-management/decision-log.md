---
title: Decision Log
description: 主要なPM判断と理由。
---

## 2026-06-29: v0.3 Candidate

Decision: `v0.3 candidate ready`

理由:

- final verificationが通った。
- healing pickupはゲームを壊していない。
- offscreen enemy indicatorはkeepでよい。
- heal tuningは追加しない。
- 残リスクはv0.4以降へ送る。

## 2026-06-29: 初回Itemはhaste候補

Decision: item systemの初回実装候補は `haste`

理由:

- 開始、継続、終了が明確。
- statsとdebug exportで観測しやすい。
- 攻撃力を直接上げない。
- healと役割が重なりにくい。

## 2026-06-29: 長期やりこみの順序

Decision: v0.4操作性、v0.5 stage、v0.6 equipment、v0.7 meta progressionの順に進める。

理由:

- 操作感が不安定なまま装備やmeta progressionを入れると調整原因が分からなくなる。
- stageは障害物、wave、敵構成を束ねるため、装備より先に土台化する価値が高い。
- equipmentとunlockはsaveが絡むため、最初から大量実装しない。
