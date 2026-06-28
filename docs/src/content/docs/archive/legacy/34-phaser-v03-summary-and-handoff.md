---
title: "Legacy: Phaser v0.3 Summary and Handoff"
description: "Migrated from docs/34-phaser-v03-summary-and-handoff.md."
---

> Source: `docs/34-phaser-v03-summary-and-handoff.md`

# Phaser v0.3 Summary and Handoff

作成日: 2026-06-29

## 1. Summary

Phaser v0.3は、回復pickupを中心に、サバイバル中の立て直し導線と死因の読みやすさを改善したバージョンである。

主な成果:

- `PH-V03-001 Healing Pickup Foundation` を実装した。
- `PH-V03-011 Offscreen Enemy Direction Indicator` を追加した。
- `splitShot` 後の `pulse` 弾が完全に重ならないよう、小さな放射spreadを追加した。
- v0.3以降のPM実行計画、playtest template、item system設計、controls discoveryを整備した。
- 自動検証ではtypecheck、unit、E2E、buildが通っている。
- 2026-06-29時点の手動所感では、v0.3の方向性は一旦問題なさそう。

注意:

- `PH-V03-002` の正式な3 run表はまだ埋まっていない。
- ただし、会話上のplaytest所感としては「上手いこと行った」「一旦こんなところ」と判断している。
- 正式なcandidate化では、最低限のplaytest noteまたはrun exportを残す。

## 2. Implemented Scope

### 2.1 Healing Pickup Foundation

実装対象:

- enemy kill時のheal pickup drop
- pityを含むdrop chance
- HP回復処理
- full HP時のcollectionとeffective recoveryの区別
- heal pickup stats
- debug export / result metrics
- heal pickup visual fixture
- unit / E2E / visual tests

PM判断:

- 回復pickupはv0.3の主機能として成立している。
- 現時点では、手動プレイ前提で大きな数値変更はしない。
- heal magnetは少し強い可能性があるため、必要ならv0.4以降でpickup kind別magnetとして扱う。

### 2.2 Offscreen Enemy Direction Indicator

実装対象:

- 画面外の敵方向をarena edgeの小さな矢印で表示
- 最大8体まで表示
- HUD重なりを避ける配置
- enemy type colorを使った可読性
- debug fixture
- visual snapshot

PM判断:

- これは難易度数値ではなく、死因理解と接近方向の可読性改善として扱う。
- 現時点ではkeepでよい。
- 表示ノイズが気になる場合だけpresentation passで調整する。

### 2.3 Planning / Discovery

追加した計画資料:

- `docs/29-phaser-v03-pm-execution-plan.md`
- `docs/30-phaser-v03-playtest-report.md`
- `docs/31-phaser-v03-item-system-requirements.md`
- `docs/32-phaser-controls-and-active-skill-discovery.md`
- `docs/33-phaser-v03-offscreen-enemy-indicator.md`

設計判断:

- 初回itemは `haste` が最有力。
- `Pickup.kind` は `"xp" | "heal" | "item"` に広げ、item本体は `itemId` と `ItemDefinition` に寄せる。
- 操作系はv0.3では変えない。
- `Space`、right click、dash、auto-fire、number key skillはv0.4候補へ送る。

## 3. Verification Baseline

最終確認済み:

| Check | Result |
| --- | --- |
| `npm run typecheck` | passed |
| `npm test -- --run` | 11 files, 78 tests passed |
| `npm run test:e2e` | 22 tests passed |
| `npm run build` | passed, existing Phaser/Vite chunk size warningのみ |
| `git diff --check` | passed |

BalanceProbe baseline:

| Input Model | Survival p50 | First Damage p50 | First Upgrade p50 | Wave Reached p50 | HP Recovered p50 | Heal Pickups p50 | Effective Heal Pickups p50 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| `noInput` | 6.77 | 4.63 |  | 0 | 0 | 0 | 0 |
| `fixedAimShoot` | 6.77 | 4.63 |  | 0 | 0 | 0 | 0 |
| `kiteCollect` | 119.3 | 84.23 | 7.13 | 90 | 88 | 22 | 8 |

Interpretation:

- 自動baseline上の明確な回帰はない。
- `kiteCollect` は人間プレイの快適性を表すものではない。
- 操作負荷、壁配置、回復の拾い心地はmanual noteで判断する。

## 4. Product Findings

### 4.1 Healing

現時点の判断:

- 回復pickupはゲームを壊していない。
- 低HP時の立て直し導線として期待できる。
- 追加tuningは必須ではなさそう。

残す観察:

- heal pickupの吸い寄せ範囲が広すぎないか。
- HP満タン時のcollectionが自然か。
- Wave 3 / Wave 4の緊張感が残るか。

### 4.2 Controls

現時点の判断:

- `WASD + mouse aim + shoot` は難しいが、skill ceilingはある。
- `Space` とmouse shootは役割が重複している。
- 右クリックskill、dash、auto-fireは有力だが、v0.3では入れない。
- 弾数増加は、完全な同一直線ではなく、少し放射状に広がる方が強化として理解しやすい。`pulse` は `splitShot` 後に小さく扇状へ分かれるようにした。

v0.4候補:

- `PH-V04-001 Auto-Fire With Mouse Aim Prototype`
- `PH-V04-002 Defensive Dash Binding Spike`
- `PH-V04-003 Right-Click Active Skill Input Split`
- `PH-V04-004 Space Defensive Action Design`

### 4.3 Obstacles / Walls

現時点の判断:

- 壁や障害物の位置は、現状だとかなり扱いにくい場面がある。
- 弾が壁で跳ね返らないため、壁が防御にも攻撃にも使いにくく、難しさが強く出ている。
- 既存のobstacle friction auditにより、壁沿い移動や接触countの技術的な土台はある。

v0.4候補:

- `PH-V04-005 Obstacle Layout and Projectile Interaction Review`

見ること:

- 障害物配置を減らす、ずらす、または形を変えるべきか。
- player bulletを壁で消す、貫通させる、跳ね返す、またはupgradeで変えるべきか。
- enemy projectileも同じ扱いにするか、敵弾だけ壁で消すか。
- 障害物がrouting判断を増やしているのか、単に操作ミスを誘っているのか。

## 5. Ticket State

v0.3として完了扱いに近いもの:

- `PH-V03-001 Healing Pickup Foundation`
- `PH-V03-004 Item System Requirements and Data Model`
- `PH-V03-011 Offscreen Enemy Direction Indicator`

v0.3 candidate前に最低限確認するもの:

- `PH-V03-002 v0.3 Playtest and Balance Review`
- `PH-V03-003 Heal Pickup Tuning Pass`
- `PH-V03-010 v0.3 Stabilization Candidate`

後回しでよいもの:

- `PH-V03-005 Temporary Buff Item Prototype`
- `PH-V03-006 Pickup Presentation and Feedback Pass`
- `PH-V03-007 BalanceProbe Item KPI Extension`
- `PH-V03-009 Bundle Size / Build Warning Triage`

## 6. Recommended Closeout

v0.3を閉じる最短手順:

1. `docs/30-phaser-v03-playtest-report.md` に簡易playtest noteを残す。
2. `PH-V03-003` は `No tuning` 判断として閉じる。
3. `npm run typecheck`
4. `npm test -- --run`
5. `npm run test:e2e`
6. `npm run build`
7. `PH-V03-010` としてv0.3 candidate判定を残す。

次に進む場合の推奨順:

1. `PH-V04-005 Obstacle Layout and Projectile Interaction Review`
2. `PH-V04-001 Auto-Fire With Mouse Aim Prototype`
3. `PH-V04-002 Defensive Dash Binding Spike`
4. `PH-V03-005 Temporary Buff Item Prototype`

理由:

- 今回の最新所感では、item追加より先に壁/障害物と操作負荷の方がプレイ体験へ強く効いている。
- `haste` itemは設計済みだが、障害物と移動体験が固まってから入れた方が評価しやすい。
- 弾の跳ね返りや壁interactionを入れる場合、weapon balanceと敵弾ルールにも影響するため、単独ticketで扱う。
