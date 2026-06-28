---
title: Risk Log
description: 現在の主要リスクと扱い。
---

## P1

### Obstacle Layout and Projectile Interaction

壁や障害物が扱いにくく、弾が跳ね返らないため、障害物が攻撃にも防御にも使いにくい。

対応:

- `PH-V04-005` で単独ticketとして扱う。

### Control Load

`WASD + mouse aim + shoot` の同時操作負荷が高い。

対応:

- `PH-V04-001` auto-fire prototype
- `PH-V04-002` dash binding spike
- `PH-V04-003` right-click skill input split
- `PH-V04-004` Space defensive action design

## P2

### Bundle Size Warning

Phaser / Viteのbundle size warningが出る。

対応:

- build成功なら既知警告として扱う。
- `PH-V03-009` は後回し。

### Pickup Feedback

pickup取得feedbackは現時点で必須blockerではない。

対応:

- 必要になった時だけ `PH-V03-006` で最小対応する。

## Later

### Item System Expansion

item追加は有力だが、操作性と障害物体験が固まってから評価した方がよい。

対応:

- 初回itemは `haste` 候補。
- `PH-V03-005` はv0.4主要課題の後に扱う。
