---
title: Current State
description: Arena Core Phaser版の現在地。
---

## 現在のゲーム状態

Phaser版は、ゲームとして成立している状態です。

実装済みの主な体験:

- WASD / arrow移動
- mouse aim
- left click / Space shooting
- XP pickupとmagnet
- upgrade selection
- waves
- enemies / projectiles / obstacles
- result screen
- debug overlay / debug export
- healing pickup foundation
- offscreen enemy direction indicator

## v0.3 Candidate

v0.3 candidateに含めるもの:

- `PH-V03-001 Healing Pickup Foundation`
- `PH-V03-004 Item System Requirements and Data Model`
- `PH-V03-011 Offscreen Enemy Direction Indicator`
- UI textのlang分割と日本語化
- `splitShot` 後の `pulse` projectile small spread
- v0.3 PM docs / playtest template / handoff docs

v0.3 candidateに含めないもの:

- `PH-V03-005 Temporary Buff Item Prototype`
- `PH-V03-006 Pickup Presentation and Feedback Pass`
- `PH-V03-007 BalanceProbe Item KPI Extension`
- `PH-V03-009 Bundle Size / Build Warning Triage`
- dash / right-click skill / auto-fire / number key skill
- obstacle layout / projectile bounce / wall interaction redesign

## 次の焦点

v0.4では、item追加より先にプレイ体験の土台を整えます。

優先順:

1. `PH-V04-005 Obstacle Layout and Projectile Interaction Review`
2. `PH-V04-001 Auto-Fire With Mouse Aim Prototype`
3. `PH-V04-002 Defensive Dash Binding Spike`
4. `PH-V04-003 Right-Click Active Skill Input Split`
5. `PH-V03-005 Temporary Buff Item Prototype`
