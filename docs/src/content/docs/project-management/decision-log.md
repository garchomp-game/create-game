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

## 2026-06-29: v0.4 Obstacle First Pass

Decision: 中央障害物を削除し、ricochetは通常武器へはまだ付与しない。

理由:

- 中央ブロックは初期位置付近の移動と射線を塞ぎやすい。
- 通常武器へricochetを付けるとbalanceProbe上の生存時間が大きく伸びた。
- ricochet自体は有望なので、config/data modelとsimulation処理は残す。
- 後続でupgrade、stage modifier、challenge stageとして評価する。

## 2026-06-29: v0.4 Auto-Fire Prototype

Decision: playing中にmouse aimが確立されたら、Phaser入力アダプタでauto-fireする。

理由:

- `WASD + mouse aim + hold shoot` の同時操作負荷が高い。
- simulationの入力境界を変えず、adapter-level prototypeとして小さく試せる。
- Spaceを将来のdash / defensive action候補へ移す準備になる。

制約:

- メニュー操作中のmouse movementはauto-fire照準として保持しない。
- left click / Space shootは互換のため残す。
- balanceProbeはadapter-levelの操作改善を直接評価しない。
