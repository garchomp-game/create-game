---
title: Obstacles and Projectiles
description: PH-V04-005の障害物配置と弾の壁interaction方針。
---

## Ticket

`PH-V04-005 Obstacle Layout and Projectile Interaction Review`

## 目的

障害物が「判断を増やす地形」ではなく「操作ミスと射線切れを増やす摩擦」になっている箇所を減らします。

v0.4では、itemやactive skillを足す前にarenaの基本体験を整えます。

## 今回の判断

実装したもの:

- 中央の小ブロック `block-e` を削除。
- player bulletに `ricochetCount` のdata modelを追加。
- ricochet処理をsimulationに実装。
- 通常武器の初期 `ricochetCount` は `0` に据え置き。
- enemy projectileは引き続き障害物で消える。

## 理由

中央ブロックは初期位置付近の移動と射線を塞ぎやすく、現状では攻撃にも防御にも使いにくい状態でした。

一方で、通常武器へricochetを即時付与すると、balanceProbe上の `kiteCollect` survival p50が大きく伸びました。ricochetは有望ですが、基礎武器の常時性能として入れるには強すぎる可能性があります。

そのため、v0.4の初手では以下に分けます。

- 即時採用: arena中央の圧迫感を下げる。
- 土台のみ採用: ricochetをconfigとsimulationで扱えるようにする。
- 後続候補: ricochet upgrade、stage modifier、challenge stageで使う。

## Current Rule

player bullet:

- `ricochetRemaining > 0` の場合、障害物で反射する。
- 反射時に `ricochetRemaining` を1減らす。
- 反射後の残り寿命は短く制限する。
- `ricochetRemaining === 0` で障害物へ当たると消える。

enemy projectile:

- 障害物へ当たると消える。

## Balance Baseline

v0.4の障害物配置変更後、`kiteCollect` の主なbaselineは次の通りです。

| Metric | v0.4 |
| --- | ---: |
| Survival p50 | 161.77 |
| First Damage p50 | 101.57 |
| First Upgrade p50 | 7.13 |
| Wave Reached p50 | 90 |
| HP Recovered p50 | 74 |
| Heal Pickups p50 | 29 |
| Effective Heal Pickups p50 | 8 |

解釈:

- 中央障害物削除により、生存時間と初被弾時刻が伸びた。
- kills / score / max bulletsは既存許容内。
- heal pickup取得数は生存時間の伸びに伴って増えた。

## Follow-Up

次に扱う候補:

- ricochetをupgradeとして入れるか、stage modifierとして入れるかを決める。
- 障害物が少なすぎる場合は、中央ではなく外周寄りに小さい地形を再配置する。
- manual playtestで、死因が地形詰まりから敵圧・判断ミスへ移っているか確認する。
