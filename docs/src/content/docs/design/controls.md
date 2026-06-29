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

## Auto-Fire Prototype

v0.4 first passでは、Phaser入力アダプタ上でauto-fireを有効化します。

現在の仕様:

- playing中にmouse aimが確立されたら、自動で射撃する。
- title、pause、upgrade select、game over中のmouse movementはauto-fire照準として保持しない。
- left click / Space shootは従来通り残す。
- simulationの `InputSnapshot.shootHeld` 境界は維持する。

意図:

- `WASD + mouse aim + hold shoot` の同時操作負荷を下げる。
- mouseはaim専用に近づける。
- Spaceを将来のdash / defensive action候補へ空ける。

注意:

- balanceProbeはsimulation入力モデルであり、adapter-level auto-fireの人間操作改善を直接表さない。
- manual playtestで早死に、射撃過多、upgrade選択中の誤射がないか確認する。

## 方針

最初から完成形を決めず、prototypeで比較します。

見る観点:

- 早死にが減るか。
- skill ceilingが残るか。
- 右クリック、Space、Shift、Ctrlの役割が自然か。
- upgradeやitemと競合しないか。
- result/debug exportで操作モデルを追跡できるか。
