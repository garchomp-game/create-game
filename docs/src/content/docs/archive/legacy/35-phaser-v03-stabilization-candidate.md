---
title: "Legacy: PH-V03-010 v0.3 Stabilization Candidate"
description: "Migrated from docs/35-phaser-v03-stabilization-candidate.md."
---

> Source: `docs/35-phaser-v03-stabilization-candidate.md`

# PH-V03-010 v0.3 Stabilization Candidate

作成日: 2026-06-29

## 1. Ticket

Ticket ID: `PH-V03-010`
Title: v0.3 Stabilization Candidate
Priority: P0
Status: Candidate ready
Owner type: main
Dependencies:

- `PH-V03-002 v0.3 Playtest and Balance Review`
- `PH-V03-003 Heal Pickup Tuning Pass`

## 2. Candidate Scope

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

## 3. PH-V03-002 Playtest Decision

正式な3 run exportは未入力だが、2026-06-29のセッション所感として以下を確認した。

- v0.3の方向性は一旦問題なさそう。
- healing pickupはゲームを壊しているとは感じない。
- offscreen enemy indicatorはkeepでよい。
- 操作は難しいが、v0.3では変更しない。
- 壁/障害物と弾の壁interactionは次phaseへ送る。

判断:

- v0.3 candidateへ進める。
- 追加のheal tuningは行わない。

## 4. PH-V03-003 Tuning Decision

Decision: `No tuning`

理由:

- healing pickupは立て直し導線として成立している。
- 現時点で強すぎる/弱すぎるという明確な判断材料はない。
- 数値変更より、次phaseでは障害物、操作負荷、active skill候補の方が体験に効く。
- balanceProbeは固定seedで `violations: []`。

据え置くparameter:

- `healDropChance`
- `healDropPityThreshold`
- `healDropPityBonus`
- `healDropMaxChance`
- `healRatio`
- `healLifetime`
- pickup magnet behavior

## 5. Verification

最終確認日: 2026-06-29

| Check | Result |
| --- | --- |
| `npm run typecheck` | passed |
| `npm test -- --run` | 11 files, 80 tests passed |
| `npm run test:e2e` | 23 tests passed |
| `npm run build` | passed, existing Phaser/Vite chunk size warningのみ |
| `git diff --check` | passed |

既知:

- `npm run build` はPhaser/Vite bundle size warningを出す。build成功なら既知警告として扱う。
- repositoryにはセッション再開系docsと未コミットのv0.3関連変更が含まれている。

## 6. Open Risks

P1:

- `PH-V04-005 Obstacle Layout and Projectile Interaction Review`
  - 壁/障害物配置が扱いにくい。
  - player bulletが壁で跳ね返らないため、壁が攻撃にも防御にも使いにくい。
- `PH-V04-001 Auto-Fire With Mouse Aim Prototype`
  - `WASD + mouse aim + shoot` の同時操作負荷が高い。
- `PH-V04-002 Defensive Dash Binding Spike`
  - `Space` / `Shift` / `Ctrl` dash候補を比較する。
- `PH-V04-003 Right-Click Active Skill Input Split`
  - right click skillの入力分離とcooldown/UI設計が必要。

P2:

- `PH-V03-009 Bundle Size / Build Warning Triage`
  - Phaser bundle size warningは既知。
- `PH-V03-006 Pickup Presentation and Feedback Pass`
  - pickup取得feedbackは必要になった時だけ最小対応する。

Later:

- `PH-V03-005 Temporary Buff Item Prototype`
  - 初回itemは `haste` が有力。
  - ただし、障害物/操作感の方向性が固まってからの方が評価しやすい。
- `PH-V03-007 BalanceProbe Item KPI Extension`
  - item実装後に対応する。

## 7. Candidate Decision

Decision: `v0.3 candidate ready`

条件:

- final verificationが通った。
- build warningは既知警告として扱うこと。
- 残リスクはv0.4以降へ送ること。

次に進む推奨順:

1. `PH-V04-005 Obstacle Layout and Projectile Interaction Review`
2. `PH-V04-001 Auto-Fire With Mouse Aim Prototype`
3. `PH-V04-002 Defensive Dash Binding Spike`
4. `PH-V04-003 Right-Click Active Skill Input Split`
5. `PH-V03-005 Temporary Buff Item Prototype`
