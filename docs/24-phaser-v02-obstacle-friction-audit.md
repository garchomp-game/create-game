# Phaser v0.2 Obstacle Friction Audit

## 1. 目的

`PH-V02-007` では、障害物まわりの引っかかり、逃げ道の理不尽さ、敵や弾の詰まりを監査する。

今回の主対象は、プレイヤーが障害物の辺に接している状態で、壁沿いに移動しようとしても止まる可能性。

## 2. 発見

旧 `circleRect` は、円と矩形が接線で触れているだけでも衝突として扱っていた。

これは弾や敵の重なり判定としては直感的に見えるが、プレイヤー移動では以下の問題を起こしやすい。

- 障害物の側面に触れた状態で、縦方向へ滑る移動まで止まり得る。
- 角付近で入力方向と押し戻しが競合し、操作不能に近い感触になる。
- 死因が敵圧なのか、地形の摩擦なのか分かりにくくなる。

## 3. 対応

接線は衝突扱いしない。

`circleRect` は、距離二乗が半径二乗未満のときだけ衝突とする。

これにより:

- ぴったり触れているだけなら壁沿い移動できる。
- 1pxでも食い込めば衝突として止まる。
- 手動collisionの構造は維持し、Arcade PhysicsやMatterへは移行しない。

## 4. 追加した回帰テスト

Simulation:

- `circleRect` は接線を非衝突として扱う。
- `circleRect` は辺を越えて重なった場合は衝突として扱う。
- プレイヤーは障害物側面に接した状態で縦方向へ滑れる。
- プレイヤーは斜め入力で壁に押し込みながらも、壁沿い成分では動ける。

E2E:

- dev-only `setObstacleFrictionFixture()` でプレイヤーを障害物側面に接した状態へ配置する。
- debug `step({ move: { x: 1, y: 1 } })` 後、xは維持され、yは進む。
- debug snapshot/exportの `obstacleContacts.player` は0のまま。

## 5. Debug Export

`getSnapshot()` と `getRunExport()` に `obstacleContacts` を追加した。

| Field | 意味 |
| --- | --- |
| `obstacleContacts.player` | プレイヤーが障害物へ重なっている数 |
| `obstacleContacts.enemies` | 敵が障害物へ重なっている数 |
| `obstacleContacts.bullets` | player bulletが障害物へ重なっている数 |
| `obstacleContacts.enemyProjectiles` | 敵弾が障害物へ重なっている数 |
| `obstacleContacts.pickups` | pickupが障害物へ重なっている数 |

接線は非衝突なので、壁沿いに触れているだけなら0になる。

## 6. 残リスク

- 敵の群れが障害物に沿って詰まるかは、まだ定量化していない。
- 障害物配置そのものが逃げ道を狭めすぎるかは、手動プレイで確認が必要。
- 角での滑りは改善したが、敵圧が高いWave4では地形死に感じる可能性がある。

次に見るなら:

- 90秒以降の手動プレイ3ランで、死因メモに障害物詰まりが出るか確認する。
- 敵の障害物接触数をdebug exportで見ながら、敵密集の停滞が起きていないか確認する。
