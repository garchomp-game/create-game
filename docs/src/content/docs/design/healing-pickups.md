---
title: Healing Pickups
description: v0.3 Healing Pickup Foundationの要点。
---

## 目的

回復pickupは、戦闘中の立て直し導線です。

安全な救済ではなく、危険な位置へ拾いに行く価値のあるリソースとして設計します。

## 基本仕様

- `Pickup.kind` は `"xp" | "heal"` を扱う。
- heal pickupは敵撃破時に低確率で出る。
- 回復量は最大HPに対する割合を基本にする。
- 最大HPを超えて回復しない。
- full HP時も回収できるが、実回復量は0。
- heal pickupには寿命がある。
- HP 0になったframeでの同時蘇生は許可しない。

## v0.3判断

2026-06-29時点の判断:

- healing pickupはゲームを壊していない。
- 低HP時の立て直し導線として成立している。
- 追加tuningは必須ではなさそう。
- heal magnetが強すぎる場合は、v0.4以降でpickup kind別magnetとして扱う。

## 関連チケット

- `PH-V03-001 Healing Pickup Foundation`
- `PH-V03-002 v0.3 Playtest and Balance Review`
- `PH-V03-003 Heal Pickup Tuning Pass`
