---
title: "Legacy: Phaser v0.3 Playtest Report"
description: "Migrated from docs/30-phaser-v03-playtest-report.md."
---

> Source: `docs/30-phaser-v03-playtest-report.md`

# Phaser v0.3 Playtest Report

作成日: 2026-06-28

## 1. 目的

`PH-V03-002 v0.3 Playtest and Balance Review` の記録用ドキュメントである。

目的は、回復pickupが「低HP時の立て直し導線」として機能しているか、かつゲームを簡単にしすぎていないかを判断すること。

この記録が揃うまで、`PH-V03-003 Heal Pickup Tuning Pass` には進まない。

## 2. 記録手順

1. Phaser dev serverを起動する。

```bash
cd phaser
npm run dev
```

2. 1 runをプレイする。
3. Game Over、Pause、または検証停止時点でブラウザdevtoolsから以下を実行する。

```js
window.__ARENA_DEBUG__?.getRunExportJson()
```

4. 返ってきたJSONを該当runの `Run Export JSON` に貼る。
5. 感触メモは、時刻、状況、原因仮説、見るべきKPIをセットで残す。

注意:

- 手動プレイ1 runだけで調整判断しない。
- 最低3 runs、可能なら5 runs見る。
- balanceProbeは回帰検知用であり、人間プレイの快適性判定ではない。
- heal tuningは、このreportの比較後に判断する。
- dev buildは未コミット変更を含む可能性があるため、`Manual Build Commit` とdirty-worktree statusを必ず残す。
- debug fixtureは使わず、通常プレイで記録する。

## 2.1 Current Test Baseline

| Field | Value |
| --- | --- |
| Date | 2026-06-28 |
| Manual Build Commit | `6e56261` |
| Config Version | `phaser-v0.3-healing-pickup-foundation` |
| Dev Server | `http://localhost:5174/` |
| `npm run typecheck` | passed |
| `npm test -- --run` | 11 files, 78 tests passed |
| `npm run test:e2e` | 22 tests passed, includes offscreen enemy indicator visual fixture |
| `npm run build` | passed, existing Phaser/Vite chunk size warningのみ |

## 2.2 BalanceProbe Automatic Baseline

`runBalanceProbe` は固定seedとAI入力モデルによる回帰検知であり、人間プレイの快適性判定ではない。

確認日: 2026-06-28

| Field | Value |
| --- | --- |
| Seeds | `20260619`, `20260620`, `20260621`, `20260622`, `20260623` |
| Duration | 180 seconds |
| Frame Rate | 30 fps |
| Violations | `[]` |

| Input Model | Survival p50 | First Damage p50 | First Upgrade p50 | Wave Reached p50 | Kills/min p50 | Score/min p50 | HP Recovered p50 | Heal Pickups p50 | Effective Heal Pickups p50 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| `noInput` | 6.77 | 4.63 |  | 0 | 0 | 0 | 0 | 0 | 0 |
| `fixedAimShoot` | 6.77 | 4.63 |  | 0 | 0 | 0 | 0 | 0 | 0 |
| `kiteCollect` | 119.3 | 84.23 | 7.13 | 90 | 165.47 | 2269.74 | 88 | 22 | 8 |

Interpretation:

- 自動baseline上は、heal pickup実装後の主要KPIに既知の回帰はない。
- `kiteCollect` はpickup回収をかなり強く行うAI入力モデルなので、heal magnetの快適性や人間の低HP判断はこの値だけでは決めない。
- manual runsで早死にが続く場合も、probe値が正常だから問題なしとは扱わない。

## 2.3 Product Hypotheses To Observe

今回のmanual playtestでは、heal tuningだけでなく、次phaseに送るべき設計論点も観察する。

| Topic | Hypothesis | What to Observe | Decision |
| --- | --- | --- | --- |
| XP / leveling | 経験値改修はrun tempo全体に効くため、v0.3 heal tuningとは分離した方がよい | level up頻度、XP回収の気持ちよさ、upgrade選択が忙しすぎる/遅すぎる時刻帯 | Keep / separate v0.4 ticket / urgent |
| Heal magnet | XPと同じmagnet範囲だとhealが安全に拾えすぎる可能性がある | 低HP時に危険な位置へ取りに行く判断が残ったか、勝手に吸われて救われた感が強いか | Keep / narrower heal magnet / needs more runs |
| Right-click skill | active skillがあるとプレイヤーの意思決定が増える可能性がある | 死亡直前やWave 3/4で「能動的な切り返し手段」が欲しい場面があるか | No need yet / design candidate / high priority |
| Control difficulty | `WASD + mouse aim + shoot` の同時処理が早死にの主因かもしれない | aim while movingが管理できたか、shoot維持が負荷か、死因が入力負荷か敵圧か | Keep skill-based / add defensive action / test auto-fire |
| Space role | `Space` とmouse shootの役割が重複している | `Space` がdash/panic actionなら助かった場面があるか | Keep shoot / rebind later / design skill |
| Dash key | dashはPCゲームでは `Ctrl` / `Shift` が多いが、本作はjumpがないので `Space` も候補 | `Ctrl` / `Shift` / `Space` のどれが自然そうか、左手負荷が増えすぎないか | Ctrl/Shift / Space / no dash yet |
| Number skills | `1`, `2`, `3` のskill slotはPCゲームらしさを出せるが、upgrade choiceと衝突する | active skillが複数欲しいほど戦闘判断に余地があるか | Not yet / future skill slots |
| Offscreen enemy indicator | 画面外から来る敵の方向が分かると、理不尽な早死に感が減る可能性がある | 矢印で接近方向が読めたか、HUD/敵弾/pickupと混同しないか | Keep / adjust visual / remove |

## 2.4 Session Playtest Notes

確認日: 2026-06-29

これは正式な3 run exportではなく、セッション中の手動所感メモである。

所感:

- v0.3 healing pickupとoffscreen enemy indicatorの方向性は一旦問題なさそう。
- 回復pickupは現時点でゲームを壊しているとは感じない。
- offscreen enemy indicatorは、画面外から来る敵の方向把握に役立つためkeepでよい。
- 操作は依然としてskill-heavyだが、v0.3では変更しない。
- 壁/障害物の位置と、弾が跳ね返らないことによる難しさは次phaseで扱う。
- `splitShot` 後の弾は、完全に重ならないよう小さな放射spreadを追加した。

PH-V03-003判断:

- `No tuning`
- heal pickup数値はv0.3 candidateでは据え置く。
- heal magnet分離、right-click skill、dash、auto-fire、obstacle/projectile interactionはv0.4候補へ送る。

## 3. Run Comparison

| Run | Seed | Survival | HP at Stop | Score/min | Kills/min | Level | Hits | Contact Dmg | Projectile Dmg | HP Recovered | Heals effective/collected | Heal Effective Rate | Low-HP Heal Route? | Heal Visibility | Wave Start | Last Cause | Main Note |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- | --- | ---: | --- | --- |
| A |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |
| B |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |
| C |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |

Decision:

- Keep:
- Change:
- Re-test:

## 4. Heal-Specific Judgment

| Question | Run A | Run B | Run C | Judgment |
| --- | --- | --- | --- | --- |
| Did low HP create a decision to route toward heal? |  |  |  |  |
| Were heal pickups visible during combat? |  |  |  |  |
| Were heal pickups confused with XP, enemy, bullet, or projectile? |  |  |  |  |
| Did heal pickup lifetime feel too short? |  |  |  |  |
| Did heal pickup lifetime feel too long or noisy? |  |  |  |  |
| Did full-HP heal collection feel natural? |  |  |  |  |
| Did Wave 3/Wave 4 keep pressure after healing was introduced? |  |  |  |  |
| Did healing remove too much death tension? |  |  |  |  |
| Did healing feel too rare to matter? |  |  |  |  |
| Did heal magnet feel too generous? |  |  |  |  |
| Did XP / leveling pace feel like the bigger issue? |  |  |  |  |
| Did combat create moments where a right-click skill felt desirable? |  |  |  |  |
| Did early death feel caused by input overload? |  |  |  |  |
| Did `Space` feel redundant as shoot? |  |  |  |  |
| Did `Space` feel like it should be a dash/panic action? |  |  |  |  |
| Would `Ctrl` or `Shift` feel more natural than `Space` for dash? |  |  |  |  |
| Would auto-fire reduce frustration or remove too much agency? |  |  |  |  |
| Did offscreen enemy arrows improve death readability? |  |  |  |  |
| Did offscreen enemy arrows add too much edge noise? |  |  |  |  |

## 5. Tuning Hypotheses

候補は0-3個に絞る。

| Hypothesis | Evidence | Parameter | Proposed Direction | Risk |
| --- | --- | --- | --- | --- |
|  |  |  |  |  |
|  |  |  |  |  |
|  |  |  |  |  |

調整候補parameter:

- `healDropChance`
- `healDropPityThreshold`
- `healDropPityBonus`
- `healDropMaxChance`
- `healRatio`
- `healLifetime`

## 6. Run A

### Metadata

| Field | Value |
| --- | --- |
| Report ID | PH-V03-002-A |
| Date |  |
| Player |  |
| Game | arena-core-phaser |
| App Version | 0.3 |
| Config Version |  |
| Build Commit |  |
| Manual Build Commit |  |
| Seed |  |
| Browser / OS |  |
| Input Device | keyboard + mouse |
| Dirty Worktree? |  |
| Test Purpose | v0.3 healing pickup balance review |

### Result Snapshot

| KPI | Value |
| --- | ---: |
| Status |  |
| Survival Time |  |
| HP at Stop |  |
| Score |  |
| Score / min |  |
| Kills |  |
| Kills / min |  |
| Level |  |
| XP Collected |  |
| Pickups Collected |  |
| HP Recovered |  |
| Heal Pickups Collected |  |
| Effective Heal Pickups Collected |  |
| Heal Effective Rate |  |
| Upgrades Chosen |  |
| Hits Taken |  |
| Damage Taken |  |
| Contact Damage |  |
| Projectile Damage |  |
| Last Damage Source |  |
| Wave Start Reached |  |
| Enemy Count at Stop |  |
| Enemy Projectile Count at Stop |  |
| Pickup Count at Stop |  |
| Player Obstacle Contacts at Stop |  |
| Recent Heal Events |  |

### Timeline Notes

| Time | Observation | Suspected Cause | Data to Check |
| --- | --- | --- | --- |
| 0-30s |  |  |  |
| 30-60s |  |  |  |
| 60-90s |  |  |  |
| 90-150s |  |  |  |
| 150s+ |  |  |  |

### Friction Notes

| Topic | Rating 1-5 | Notes |
| --- | ---: | --- |
| HP readability |  |  |
| XP readability |  |  |
| Heal readability |  |  |
| Heal pickup routing value |  |  |
| Heal pickup lifetime |  |  |
| Movement + mouse aim comfort |  |  |
| Shooting input comfort |  |  |
| Space key role clarity |  |  |
| Offscreen enemy arrow readability |  |  |
| Enemy type readability |  |  |
| Enemy projectile readability |  |  |
| Cursor / aim readability |  |  |
| Obstacle fairness |  |  |
| Upgrade choice clarity |  |  |
| Death understandability |  |  |

### Balance Judgment

| Question | Answer |
| --- | --- |
| Did difficulty increase for a clear reason? |  |
| Was the first damage understandable? |  |
| Was the death avoidable in hindsight? |  |
| Did heal pickups create meaningful routing decisions? |  |
| Did low HP create a heal routing decision? |  |
| Was heal pickup risk appropriate? |  |
| Did healing feel too strong, too weak, hard to see, or unnecessary? |  |
| Did early deaths feel fair, or mostly caused by control overload? |  |
| Did the current controls feel worth mastering? |  |
| Would a right-click or Space defensive skill improve the run? |  |
| Did offscreen arrows help explain incoming pressure? |  |
| What would improve the next run most? |  |

### Run Export JSON

```json
{}
```

## 7. Run B

Run Aと同じ構成を使う。

### Metadata

| Field | Value |
| --- | --- |
| Report ID | PH-V03-002-B |
| Date |  |
| Player |  |
| Game | arena-core-phaser |
| App Version | 0.3 |
| Config Version |  |
| Build Commit |  |
| Manual Build Commit |  |
| Seed |  |
| Browser / OS |  |
| Input Device | keyboard + mouse |
| Dirty Worktree? |  |
| Test Purpose | v0.3 healing pickup balance review |

### Result Snapshot

| KPI | Value |
| --- | ---: |
| Status |  |
| Survival Time |  |
| HP at Stop |  |
| Score |  |
| Score / min |  |
| Kills |  |
| Kills / min |  |
| Level |  |
| XP Collected |  |
| Pickups Collected |  |
| HP Recovered |  |
| Heal Pickups Collected |  |
| Effective Heal Pickups Collected |  |
| Heal Effective Rate |  |
| Upgrades Chosen |  |
| Hits Taken |  |
| Damage Taken |  |
| Contact Damage |  |
| Projectile Damage |  |
| Last Damage Source |  |
| Wave Start Reached |  |
| Enemy Count at Stop |  |
| Enemy Projectile Count at Stop |  |
| Pickup Count at Stop |  |
| Player Obstacle Contacts at Stop |  |
| Recent Heal Events |  |

### Timeline Notes

| Time | Observation | Suspected Cause | Data to Check |
| --- | --- | --- | --- |
| 0-30s |  |  |  |
| 30-60s |  |  |  |
| 60-90s |  |  |  |
| 90-150s |  |  |  |
| 150s+ |  |  |  |

### Friction Notes

| Topic | Rating 1-5 | Notes |
| --- | ---: | --- |
| HP readability |  |  |
| XP readability |  |  |
| Heal readability |  |  |
| Heal pickup routing value |  |  |
| Heal pickup lifetime |  |  |
| Movement + mouse aim comfort |  |  |
| Shooting input comfort |  |  |
| Space key role clarity |  |  |
| Offscreen enemy arrow readability |  |  |
| Enemy type readability |  |  |
| Enemy projectile readability |  |  |
| Cursor / aim readability |  |  |
| Obstacle fairness |  |  |
| Upgrade choice clarity |  |  |
| Death understandability |  |  |

### Balance Judgment

| Question | Answer |
| --- | --- |
| Did difficulty increase for a clear reason? |  |
| Was the first damage understandable? |  |
| Was the death avoidable in hindsight? |  |
| Did heal pickups create meaningful routing decisions? |  |
| Did low HP create a heal routing decision? |  |
| Was heal pickup risk appropriate? |  |
| Did healing feel too strong, too weak, hard to see, or unnecessary? |  |
| Did early deaths feel fair, or mostly caused by control overload? |  |
| Did the current controls feel worth mastering? |  |
| Would a right-click or Space defensive skill improve the run? |  |
| Did offscreen arrows help explain incoming pressure? |  |
| What would improve the next run most? |  |

### Run Export JSON

```json
{}
```

## 8. Run C

Run Aと同じ構成を使う。

### Metadata

| Field | Value |
| --- | --- |
| Report ID | PH-V03-002-C |
| Date |  |
| Player |  |
| Game | arena-core-phaser |
| App Version | 0.3 |
| Config Version |  |
| Build Commit |  |
| Manual Build Commit |  |
| Seed |  |
| Browser / OS |  |
| Input Device | keyboard + mouse |
| Dirty Worktree? |  |
| Test Purpose | v0.3 healing pickup balance review |

### Result Snapshot

| KPI | Value |
| --- | ---: |
| Status |  |
| Survival Time |  |
| HP at Stop |  |
| Score |  |
| Score / min |  |
| Kills |  |
| Kills / min |  |
| Level |  |
| XP Collected |  |
| Pickups Collected |  |
| HP Recovered |  |
| Heal Pickups Collected |  |
| Effective Heal Pickups Collected |  |
| Heal Effective Rate |  |
| Upgrades Chosen |  |
| Hits Taken |  |
| Damage Taken |  |
| Contact Damage |  |
| Projectile Damage |  |
| Last Damage Source |  |
| Wave Start Reached |  |
| Enemy Count at Stop |  |
| Enemy Projectile Count at Stop |  |
| Pickup Count at Stop |  |
| Player Obstacle Contacts at Stop |  |
| Recent Heal Events |  |

### Timeline Notes

| Time | Observation | Suspected Cause | Data to Check |
| --- | --- | --- | --- |
| 0-30s |  |  |  |
| 30-60s |  |  |  |
| 60-90s |  |  |  |
| 90-150s |  |  |  |
| 150s+ |  |  |  |

### Friction Notes

| Topic | Rating 1-5 | Notes |
| --- | ---: | --- |
| HP readability |  |  |
| XP readability |  |  |
| Heal readability |  |  |
| Heal pickup routing value |  |  |
| Heal pickup lifetime |  |  |
| Movement + mouse aim comfort |  |  |
| Shooting input comfort |  |  |
| Space key role clarity |  |  |
| Offscreen enemy arrow readability |  |  |
| Enemy type readability |  |  |
| Enemy projectile readability |  |  |
| Cursor / aim readability |  |  |
| Obstacle fairness |  |  |
| Upgrade choice clarity |  |  |
| Death understandability |  |  |

### Balance Judgment

| Question | Answer |
| --- | --- |
| Did difficulty increase for a clear reason? |  |
| Was the first damage understandable? |  |
| Was the death avoidable in hindsight? |  |
| Did heal pickups create meaningful routing decisions? |  |
| Did low HP create a heal routing decision? |  |
| Was heal pickup risk appropriate? |  |
| Did healing feel too strong, too weak, hard to see, or unnecessary? |  |
| Did early deaths feel fair, or mostly caused by control overload? |  |
| Did the current controls feel worth mastering? |  |
| Would a right-click or Space defensive skill improve the run? |  |
| Did offscreen arrows help explain incoming pressure? |  |
| What would improve the next run most? |  |

### Run Export JSON

```json
{}
```

## 9. Debug Export Field Map

| Export Field | Use |
| --- | --- |
| `configVersion` | 数値設定の版確認 |
| `buildCommit` | CI/dev環境でcommitが注入される場合の再現情報 |
| `seed` | 再現用seed |
| `status` | stop時の状態 |
| `elapsed` | survival time |
| `wave.start` | 到達wave帯 |
| `resultSummary.score` | score |
| `resultSummary.hp` | stop時のHP |
| `resultSummary.enemiesKilled` | kills |
| `resultSummary.hpRecovered` | 実回復量 |
| `resultSummary.healPickupsCollected` | 回収したheal数 |
| `resultSummary.effectiveHealPickupsCollected` | 実回復が発生したheal数 |
| `stats.damageTakenBySource.contact` | 接触被弾 |
| `stats.damageTakenBySource.projectile` | 敵弾被弾 |
| `stats.lastDamageSource` | 最後の被弾原因 |
| `counts.enemyTypes` | stop時の敵種圧 |
| `counts.enemyProjectiles` | stop時の敵弾圧 |
| `counts.pickups` | stop時のpickup残数 |
| `counts.obstacleContacts.player` | 地形詰まり疑い |
| `lastEvents` | 直近イベント、pickup取得、死亡原因の補助確認 |
