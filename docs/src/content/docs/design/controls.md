---
title: Controls
description: 操作性、active skill、dash、auto-fireの検討。
---

## 現状

現在の操作:

- Move: `WASD` or arrow keys
- Aim: mouse
- Shoot: left click or `Space`
- Restart: `R`
- Debug overlay: `F3`

## 課題

`WASD + mouse aim + shoot` はかなり難しく、実力差が出ます。

特に、Spaceとmouse shootの役割が重複しているため、Spaceを別の役割へ移す余地があります。

## v0.4候補

- `PH-V04-001 Auto-Fire With Mouse Aim Prototype`
- `PH-V04-002 Defensive Dash Binding Spike`
- `PH-V04-003 Right-Click Active Skill Input Split`
- `PH-V04-004 Space Defensive Action Design`

## 方針

最初から完成形を決めず、prototypeで比較します。

見る観点:

- 早死にが減るか。
- skill ceilingが残るか。
- 右クリック、Space、Shift、Ctrlの役割が自然か。
- upgradeやitemと競合しないか。
- result/debug exportで操作モデルを追跡できるか。
