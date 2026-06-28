---
title: Core Loop
description: Arena Coreの基本ループと拡張ポイント。
---

## Run Loop

1. stageと装備を選ぶ。
2. arenaに入る。
3. 敵を倒す。
4. XPやpickupを拾う。
5. level upでupgradeを選ぶ。
6. waveが進み、敵構成と密度が変わる。
7. HPが0になるか、stage条件を満たしてrunが終わる。
8. resultでstatsを確認する。

現在はstage / equipment選択は未実装です。v0.5以降の土台として扱います。

## 体験上の重要点

- 移動、照準、射撃が同時に必要なため、操作負荷が高い。
- 障害物は面白さにもストレスにもなりやすい。
- 回復pickupは低HP時の立て直し判断を作る。
- upgradeはrun中の変化とビルド感を作る。

## 拡張ポイント

- stageごとのarena / obstacles / wave curve
- equipmentによる初期プレイスタイル差
- itemによるrun中の一時的な判断
- run modifierによる小さなルール変化
- meta progressionによるunlockとcollection
