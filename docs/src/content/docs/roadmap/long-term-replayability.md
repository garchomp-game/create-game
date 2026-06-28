---
title: Long-Term Replayability
description: v0.5以降のやりこみ、ステージ、装備、ランダム性の要件。
---

## 方針

やりこみは、課金導線ではなくプレイ継続、上達、選択肢の解放で作ります。

基本原則:

- 1 runの実力要素を残す。
- 毎回同じにならない変化を持たせる。
- 恒久強化だけで難易度を潰さない。
- stage / equipment / random modifierをデータ化できる土台を先に作る。

## Replayability Pillars

### Run Variety

- upgrade抽選とsynergy
- pickup / itemの出現差
- stageごとのwave curve、障害物、敵構成
- run modifierによる小さなルール変化
- seed共有やdebug exportによる再現性

### Stage Structure

- Stage 1: 標準arena
- Stage 2: 障害物が少なく操作練習に向くarena
- Stage 3: 障害物や敵弾を活用するarena
- Challenge stage: 固定seed、固定装備、特殊modifierつきの短い挑戦

### Equipment

- Weapon: 初期武器または射撃方式
- Core: HP、移動、pickup、skill cooldownなどの方向性
- Module: 小さな補助効果

最初は1 slotだけで十分です。

### Meta Progression

- stage clearによるstage unlock
- achievementによるequipment unlock
- challenge clearによるcosmetic / title / rule unlock
- profile statsとcollection

最初はlocalStorage保存でよいです。

## 推奨順

1. v0.4で操作性と障害物体験を固める。
2. v0.5でstage data modelとstage selectを作る。
3. v0.5後半でrun seed / modifierを整理する。
4. v0.6でequipmentを1 slotだけ導入する。
5. v0.7でlocal saveとunlockを入れる。
6. その後にcontent量を増やす。
