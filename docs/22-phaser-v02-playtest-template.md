# Phaser v0.2 Playtest Report Template

## 1. 目的

v0.2以降の調整では、手動プレイの感触を単独で判断材料にしない。

このテンプレートは、1ランの感想を `debug run export` のKPIと同じ単位で残し、調整前後の比較をできるようにするためのもの。

## 2. 記録手順

1. Phaser版をdev serverで起動する。
2. 1ランをプレイする。
3. Game Over、Pause、または任意の検証停止時点で、ブラウザのdevtoolsから以下を実行する。

```js
window.__ARENA_DEBUG__?.getRunExportJson()
```

4. 返ってきたJSONを、このテンプレートの `Run Export JSON` 欄に残す。
5. 感触メモは、必ず詰まった時刻、原因仮説、次に見るべきKPIとセットで書く。

注意:

- `getRunExportJson()` はdev build専用。
- `buildCommit` が `"unknown"` の場合は、手元で `git rev-parse --short HEAD` を確認して `Manual Build Commit` に記録する。
- 手動プレイ1回だけでバランス判断しない。最低3ラン、可能なら同じ目的で5ラン見る。
- `balanceProbe` の結果はAI入力モデルの結果であり、人間プレイの正解ではない。手動プレイ差分の補助として使う。

## 3. 単ラン記録テンプレート

### Metadata

| Field | Value |
| --- | --- |
| Report ID |  |
| Date |  |
| Player |  |
| Game | arena-core-phaser |
| App Version | 0.2 |
| Config Version |  |
| Build Commit |  |
| Manual Build Commit |  |
| Seed |  |
| Browser / OS |  |
| Input Device | keyboard + mouse |
| Test Purpose |  |

### Result Snapshot

| KPI | Value |
| --- | ---: |
| Status |  |
| Survival Time |  |
| Score |  |
| Score / min |  |
| Kills |  |
| Kills / min |  |
| Level |  |
| XP Collected |  |
| Pickups Collected |  |
| Upgrades Chosen |  |
| Hits Taken |  |
| Damage Taken |  |
| Contact Damage |  |
| Projectile Damage |  |
| Last Damage Source |  |
| Wave Start Reached |  |
| Max/Observed Enemy Pressure |  |
| Enemy Projectile Count at Stop |  |

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
| Did pickups feel worth routing toward? |  |
| Did upgrades feel meaningful? |  |
| What would improve the next run most? |  |

### Run Export JSON

```json
{}
```

## 4. 3ラン比較テンプレート

| Run | Seed | Survival | Score/min | Kills/min | Level | Hits | Contact Dmg | Projectile Dmg | Last Cause | Main Note |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- | --- |
| A |  |  |  |  |  |  |  |  |  |  |
| B |  |  |  |  |  |  |  |  |  |  |
| C |  |  |  |  |  |  |  |  |  |  |

Decision:

- Keep:
- Change:
- Re-test:

## 5. 調整判断の基準

即調整してよい:

- 視認性が原因で死因を説明できない。
- UIがプレイ領域や敵弾を隠している。
- 障害物で操作不能に近い詰まり方をする。
- 3ラン以上で同じ時刻帯、同じ原因で理不尽に崩れる。

保留して追加データを見る:

- 1回だけ極端な結果が出た。
- 慣れで改善する可能性が高い。
- `balanceProbe` では大きく動いていないが手動感触だけ悪い。
- 逆に手動感触はよいがKPIが20%以上動いた。

## 6. Debug Run Export Field Map

| Export Field | 用途 |
| --- | --- |
| `configVersion` | 数値・wave・視認性設定の版管理 |
| `buildCommit` | CI/dev環境で注入できる場合のcommit |
| `seed` | 再現用seed |
| `status` | 停止時の状態 |
| `elapsed` | 停止時刻 |
| `wave.start` | 到達wave帯 |
| `resultSummary` | ラン結果KPI |
| `stats.damageTakenBySource` | 被弾原因の分解 |
| `stats.lastDamageSource` | 最後の被弾原因 |
| `counts.enemyTypes` | 停止時の敵種圧 |
| `counts.enemyProjectiles` | 停止時の敵弾圧 |
| `counts.obstacleContacts` | 障害物への重なり数。地形詰まり疑いの確認 |
| `lastEvents` | 直近イベント確認 |
