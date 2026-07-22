---
title: 危険イベント後5秒の立て直し観測
description: 現行Endlessのrecoveryが緩和として機能しているかを、ゲーム数値を変えずに測るshadow契約。
---

最終更新日: 2026-07-22

## 判断

現行Endlessの`recovery`は、イベント専用の出現上書きを外して通常waveへ戻す区間です。既にいる敵と敵弾は消えず、通常spawnも止まりません。そのため、区間名だけを根拠に「危険を処理した報酬として立て直せる」とは判断しません。

[#110](https://github.com/garchomp-game/create-game/issues/110)では、出現間隔、敵密度、drop、回復量、イベント時間を変えず、`encounter.recovery.started`から5秒間の事実を開発用run exportへ追加します。

## 観測窓

イベント種と発生回数から`encounterId:occurrence`をepisode IDにします。同じイベントが再度発生しても、前回の窓へ混ぜません。

| 時点 | 保存する盤面 |
| --- | --- |
| recovery開始 | HP、残敵、敵弾、地上XP個数・総量、地上REPAIR個数・総量 |
| 5秒後 | 同じ盤面値と開始時からの差分 |
| 次の警告開始 | 同じ盤面値、recovery開始からの経過秒 |

5秒窓では次も加算します。

- 回収XP。
- 被ダメージ。
- 実回復量、REPAIR取得数、満HP取得数。
- 通常敵撃破数。

5秒前にrunが終わった場合は`partial`とし、0件や失敗へ変換しません。通常フレームでは最初に5秒を越えた観測時点を終了盤面として保存し、`targetEndsAt`と実際の`observedUntil`を併記します。

## 出力

開発サーバーまたはtest hook付きbuildでは、次から取得できます。

```js
window.__ARENA_DEBUG__.getSnapshot().encounterRelief
window.__ARENA_DEBUG__.getRunExport().encounterRelief
```

`state: not-reached`はrecovery未到達、`state: available`は1件以上のepisodeを観測済みという意味です。`repairOffsetRate`は実回復量を被ダメージで割った記述値であり、単独の合否判定ではありません。

このshadowは`GameEvent`、`RunStats`、`RunRecord`、ランキング、rulesetへ追加せず、乱数も消費しません。

## 人間観測との結合

run中は「イベント後が休憩時間」と事前に教えません。最初のイベント後に、誘導せず次を記録します。

1. 5秒間に回収、距離確保、標的変更のどれを行ったか。
2. 次の警告までに「立て直せた」と本人が説明したか。
3. 説明した場合、HP、盤面整理、XP回収、位置取りのどれを根拠にしたか。

自動値と口頭回答をepisode単位で照合します。XP回収量が多い、回復相殺率が高い、残敵が減った、のいずれか1件だけでearned relief成立とは判定しません。

## 次の判断

- 現行区間で複数人が立て直しを説明できる場合、数値変更を行わず現行controlを維持します。
- 立て直しを説明できず、5秒窓でも残敵・敵弾・被ダメージが継続する場合だけ、spawn抑制または回収時間を単一candidateとして事前登録します。
- candidateを作る場合も、Charger危険反転、選択UI、ボス調整と同じbuildへ混ぜません。
