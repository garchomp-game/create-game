---
title: Charger control機械screening
description: 危険反転candidateの前に、現行Chargerが予告と突進へ到達するかを固定CPUランで確認した結果。
---

最終更新日: 2026-07-25

## 結論

[#76](https://github.com/garchomp-game/create-game/issues/76)のCharger衝突妨害candidateは、現時点でruntime実装へ進めません。機械screeningは`warning`で、12本すべてにChargerが出現した一方、chargeへ到達したのはSpreadの1本だけでした。

Pulseでは6本中5本が予告前撃破、chargeは0本です。熟練入力ほどChargerを先に倒す現行ループと、「倒さず壁へ誘導する」熟練成功が競合しています。妨害半径や持続時間を調整しても、反転機会そのものが現れない問題は解決しません。

## 固定条件

結果を見る前に[危険反転の実装前比較](../../design/hazard-reversal-preflight/)へ次を登録し、commit `27d3619`で固定しました。

| 項目 | 値 |
| --- | --- |
| runtime baseline | `main` `5e1950f` |
| probe commit | `27d3619` |
| seed | `20260717`から`20260722` |
| 武器 | Pulse / Spread |
| 入力 | `ceiling` observer / `visit-history-v1` |
| run数 | 6 seed x 2武器 = 12 |
| command | `npm run probe:v08:charger-control` |
| runtime変更 | なし |

各武器でCharger到達runが3件未満なら`insufficient-data`、到達runの過半数でcharge 0、または50%以上で予告前撃破なら`warning`としました。このscreeningは人間control gateを代替しません。

## 集計

| 対象 | 到達run | chargeあり | 予告前撃破あり | spawn | telegraph | charge | 障害物停止 | 外周停止 | player hit |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 全体 | 12 / 12 | 1 / 12 | 7 / 12 | 12 | 5 | 1 | 1 | 0 | 0 |
| Pulse | 6 / 6 | 0 / 6 | 5 / 6 | 6 | 1 | 0 | 0 | 0 | 0 |
| Spread | 6 / 6 | 1 / 6 | 2 / 6 | 6 | 4 | 1 | 1 | 0 | 0 |

### seed別

| 武器 | seed | outcome | telegraph | charge | 予告前撃破 | 停止理由 |
| --- | ---: | --- | ---: | ---: | ---: | --- |
| Pulse | 20260717 | defeat | 0 | 0 | 1 | なし |
| Pulse | 20260718 | defeat | 0 | 0 | 1 | なし |
| Pulse | 20260719 | victory | 0 | 0 | 1 | なし |
| Pulse | 20260720 | victory | 0 | 0 | 1 | なし |
| Pulse | 20260721 | victory | 0 | 0 | 1 | なし |
| Pulse | 20260722 | defeat | 1 | 0 | 0 | なし |
| Spread | 20260717 | defeat | 1 | 0 | 0 | なし |
| Spread | 20260718 | victory | 0 | 0 | 1 | なし |
| Spread | 20260719 | victory | 0 | 0 | 1 | なし |
| Spread | 20260720 | victory | 1 | 1 | 0 | obstacle |
| Spread | 20260721 | victory | 1 | 0 | 0 | なし |
| Spread | 20260722 | victory | 1 | 0 | 0 | なし |

`telegraph > 0`かつ`charge = 0`の4本について、保存済み集計だけでは予告中撃破、準備中撃破、経路条件不成立を完全には分けられません。runtime候補を作る前に追加の人間runまたはattempt timelineで確認する余地はありますが、現時点で衝突妨害を足す根拠にはしません。

## 判断

- `Charger Impact Disruption`は`revise-before-candidate`とする。
- `effectRadius`、`durationMs`、`maxTargets`は登録しない。
- Charger HP、spawn頻度、初回待機、武器damageを同時変更しない。
- 人間controlを取る場合も、最初の経験者3名と到達熟練run 3件を既存gateへ入力する。
- 人間でも予告前撃破またはcharge 0が多い場合、衝突妨害candidateを棄却する。

再設計する場合は、壁衝突だけでなく「予告中の意図的な迎撃」を熟練成功へ含める案を別仮説として扱えます。ただしPulse有利、早期撃破の常態化、通常回避の価値低下を招くため、現candidateへ黙って追加しません。

