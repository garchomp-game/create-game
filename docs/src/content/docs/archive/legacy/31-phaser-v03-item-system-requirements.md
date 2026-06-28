---
title: "Legacy: PH-V03-004 Item System Requirements and Data Model"
description: "Migrated from docs/31-phaser-v03-item-system-requirements.md."
---

> Source: `docs/31-phaser-v03-item-system-requirements.md`

# PH-V03-004 Item System Requirements and Data Model

作成日: 2026-06-28

## 1. Ticket

Ticket ID: `PH-V03-004`  
Title: Item System Requirements and Data Model  
Priority: P0  
Effort: 3 EP  
Status: Design ready  
Owner type: main / review sub-agent  
Dependencies:

- `PH-V03-001 Healing Pickup Foundation`
- `PH-V03-002 v0.3 Playtest and Balance Review` before item implementation

## 2. 目的

今後のitem追加を、pickup処理の場当たり拡張にしない。

初回実装では `haste` 1種類だけを扱い、item systemの境界、stats、debug export、test strategyを先に決める。

このドキュメントは実装指示ではなく、`PH-V03-005 Temporary Buff Item Prototype` へ進む前の設計固定である。

## 3. Non Goals

この設計段階では以下を行わない。

- itemを複数同時に実装する。
- heal pickupをgeneric itemへ移行する。
- rarity/drop tableを作る。
- 汎用effect DSLやECS風の大きな仕組みを作る。
- `magnetPulse` や `barrier` を実装する。
- heal pickupの数値を調整する。

## 4. First Item Decision

初回itemは `haste` とする。

理由:

- 開始、継続、終了が明確。
- statsとdebug exportで観測しやすい。
- 回復、被弾、死亡判定へ直接干渉しない。
- 攻撃力を直接上げない。
- 既存upgradeの `swiftStep` と比較しやすい。

保留:

- `magnetPulse`: XP回収、heal回収、level up速度をまとめて変えるため、heal評価が完了するまで待つ。
- `barrier`: 被弾、死亡判定、damage source、fatal frame ruleへ踏み込むため、初回itemとしては重い。

## 5. Minimal Data Model

推奨モデル:

```ts
type PickupKind = "xp" | "heal" | "item";
type ItemId = "haste";

type Pickup = CircleBody & {
  id: string;
  kind: PickupKind;
  xpValue: number;
  healValue: number;
  itemId: ItemId | null;
  lifetime: number | null;
};

type ItemDefinition = {
  id: ItemId;
  title: string;
  effect: {
    type: "moveSpeedMultiplier";
    multiplier: number;
    duration: number;
    stacking: "refresh";
  };
  pickup: {
    radius: number;
    lifetime: number;
  };
};

type ActiveTemporaryEffect = {
  itemId: ItemId;
  type: "moveSpeedMultiplier";
  multiplier: number;
  remaining: number;
  duration: number;
};
```

判断:

- `Pickup.kind: "haste"` のようにitem種類ごとへ増やさない。
- `Pickup.kind` は物理pickupの大分類だけを表す。
- itemの種類は `itemId` で表す。
- item効果は `ItemDefinition` と `activeTemporaryEffects` に分離する。

## 6. Ownership Boundaries

### 6.1 Pickup

責務:

- 画面上に存在する拾得可能オブジェクトを表す。
- `xp`, `heal`, `item` の大分類を持つ。
- 位置、半径、寿命、取得時に参照する値を持つ。

禁止:

- item効果の実行中状態を持たせない。
- `kind` にitem固有名を増やさない。

### 6.2 ItemDefinition

責務:

- config/schema配下の静的定義。
- title、effect type、duration、multiplier、stacking policy、pickup radius/lifetimeを持つ。

禁止:

- Phaser表示情報を持たない。
- 現在のremaining timeを持たない。

### 6.3 ActiveTemporaryEffects

責務:

- `WorldState` 内の実行中効果を表す。
- `remaining` を持つ。
- `playing` 中だけtimerが進む。

`haste` の再取得:

- multiplierは重ねない。
- `remaining` をdurationへ戻す。
- stacking policyは `"refresh"` とする。

### 6.4 RuntimeModifiers

既存の `runtime.playerSpeedMultiplier` はupgrade由来の恒久値として扱う。

避ける設計:

- haste開始時に `runtime.playerSpeedMultiplier` を掛ける。
- haste終了時に割り戻す。

推奨:

- `getEffectivePlayerSpeedMultiplier(world)` のようなsimulation helperで、恒久upgrade値とactive temporary effectを合成する。
- 解除漏れを起こさない構造にする。

### 6.5 Stats / Result / Debug Export

最小stats:

- `itemsCollected`
- `itemCollectionsById`
- `firstItemCollectedAt`
- `itemEffectUptimeById`

debug export:

- `activeTemporaryEffects`
- `itemsCollected`
- `itemCollectionsById`
- `firstItemCollectedAt`
- `itemEffectUptimeById`

注意:

- stats、result summary、debug export、balanceProbeで意味を揃える。
- item KPIを場所ごとに別定義しない。

## 7. Test Strategy

Unit / simulation tests:

- config schemaがduration > 0、multiplier > 0を要求する。
- config schemaが未知itemを拒否する。
- `ItemDefinition.id` とrecord keyが一致する。
- XP/Heal pickupは `itemId: null`。
- item pickupは `xpValue: 0`, `healValue: 0`, `itemId` 必須。
- item回収で `pickup.collected` とeffect start eventが出る。
- haste中は次frameから移動速度が上がる。
- duration後にupgrade-only速度へ戻る。
- haste再取得でmultiplierは重ならず、remainingだけrefreshされる。
- `swiftStep` 取得済みでもhaste終了後に恒久速度だけ残る。
- pause / upgradeSelect中はeffect timerが進まない。
- game over / title / restartでactive effectが残らない。
- HP 0 frameではitemも回収/発動しない。
- 同一frameでXP/Heal/Itemを回収してもstatsとevent順が壊れない。

E2E / debug tests:

- debug fixtureでhaste pickupを出せる。
- haste pickup回収後、debug snapshot/exportでactive effectが見える。
- duration後にactive effectが消える。
- restart後にactive effectが残らない。
- visual fixtureでXP、heal、hasteが混同しない。

BalanceProbe:

- `itemsCollected`
- `firstItemCollectedAt`
- `activeEffectUptimeSecondsByKind`
- `activeEffectUptimeRatioByKind`

初回 `haste` では以下だけでもよい。

- `hasteCollected`
- `firstHasteAt`
- `hasteUptimeSeconds`
- `hasteUptimeRatio`
- `hasteRefreshCount`

## 8. Risks

過剰設計リスク:

- heal pickupを今すぐgeneric itemへ移す。
- 複数item用のrarity/drop table/pity/stackingを先に作る。
- 汎用effect DSLを作る。
- Phaser表示設計をdomain/configの静的item定義へ混ぜる。

過小設計リスク:

- `runtime.playerSpeedMultiplier` を直接書き換え、解除漏れを起こす。
- 再取得時の挙動を未定義にする。
- debug exportにactive effectを出さない。
- item KPIをstats/result/debug/balanceProbeで別々に数える。
- item固有分岐をpickupSystemへ増やしすぎる。

## 9. PH-V03-005 Entry Criteria

`PH-V03-005 Temporary Buff Item Prototype` へ進む条件:

- `PH-V03-002` のmanual playtestが完了している。
- heal tuningの要否が決まっている。
- `haste` を初回itemにするPM判断が維持されている。
- このdata modelに対する追加blocking issueがない。
- 実装範囲が1 itemに限定されている。
