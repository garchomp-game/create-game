---
title: Item System
description: Item systemの最小data modelと初回item方針。
---

## 目的

今後のitem追加を、pickup処理の場当たり拡張にしないため、item定義と効果適用の境界を先に決めます。

## 初回Item

初回itemは `haste` を候補にします。

理由:

- 開始、継続、終了が明確。
- statsとdebug exportで観測しやすい。
- 回復、被弾、死亡判定へ直接干渉しない。
- 攻撃力を直接上げない。
- 既存upgradeの `swiftStep` と比較しやすい。

## Data Model方針

- `Pickup.kind` は `"xp" | "heal" | "item"` にする。
- item種類は `itemId` で表す。
- item効果は `ItemDefinition` と `activeTemporaryEffects` に分離する。
- `runtime.playerSpeedMultiplier` を直接書き換えず、effective valueをhelperで合成する。

## 最小Stats

- `itemsCollected`
- `itemCollectionsById`
- `firstItemCollectedAt`
- `itemEffectUptimeById`

## 関連チケット

- `PH-V03-004 Item System Requirements and Data Model`
- `PH-V03-005 Temporary Buff Item Prototype`
- `PH-V03-007 BalanceProbe Item KPI Extension`
