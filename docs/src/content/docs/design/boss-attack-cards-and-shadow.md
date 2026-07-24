---
title: Boss攻撃文法とShadow計測
description: Final Expedition Bossの3攻撃をAttack Cardとして固定し、回避・反撃・回復をruntime変更前に観測する契約。
---

最終更新日: 2026-07-22

## 判断

[#93 ボス攻撃文法と回復・反撃窓](https://github.com/garchomp-game/create-game/issues/93)のPhase Aでは、RC6 controlを変更しません。新攻撃、回復削減、敵密度、Boss HP、武器数値を動かす前に、現行3攻撃のepisodeと10秒ごとのdamage / healを開発用run exportへshadow出力します。

## Attack Card

数値はPhase 1 / Phase 2です。

| 攻撃 | Warn | React | Active | Recovery | Punish |
| --- | --- | --- | --- | --- | --- |
| `targeted-salvo` | 1.20 / 0.85秒。現在位置への照準方向と扇形予告 | 照準線から横へ外れ、弾列が残る方向へ戻らない | 13 / 21発、damage 8 / 10、弾速320 / 390 | 0.80 / 0.55秒 | 射線を外した後にBossへ射撃を戻す |
| `escort-pincer` | 1.35 / 1.00秒。侵入方向を予告 | 挟撃軸を外し、護衛かBossかの優先標的を選ぶ | 護衛5 / 7体と抑制弾9 / 15発、damage 7 / 9 | 0.95 / 0.65秒 | 護衛を減らすか、開いた射線からBossへdamageを通す |
| `command-pulse` | 1.35 / 1.05秒。半径175 / 220を表示 | 範囲外へ出るか障害物で遮蔽する | damage 22 / 34の単発解決 | 0.90 / 0.68秒 | 遮蔽解除または外周からBossへ攻撃を戻す |

Phase 2は新しいルールを追加せず、同じ3文法を短い予告、高い弾密度・速度・damageで再試験します。

## Chain

通常のlegal chainは次の固定循環です。

```text
targeted-salvo -> escort-pincer -> command-pulse -> targeted-salvo
```

許可する例外はHP 50%到達時のPhase移行だけです。移行は現在actionを1.1秒のrecoveryへ置き換え、その後に既存循環へ戻ります。

禁止事項は次のとおりです。

- 同じ攻撃の即時連続。
- 複数telegraphの同時提示。
- recovery中の次攻撃開始。
- Phase 2だけに存在する未提示ルール。
- 新攻撃と回復量変更の同時比較。

## Episode

`bossId:attackId:exposureIndex`を安定IDとし、telegraph、execute、recovery、次telegraphまたは終端までを結びます。Boss弾はprojectile ID、護衛はenemy IDにより発生episodeへ帰属します。

`warningResponse`は次の事実だけから作ります。

- `command-pulse`: `blocked | outside`はhandled、`hit`はhit、`invulnerable`は除外。
- 他2攻撃: execute済みでresponse区間の帰属damageが0ならhandled、1以上ならhit。
- 未execute、response区間未完了はincompleteで分母へ入れない。

これは「予告を認識した」という心理測定ではなく、**帰属damageを受けずに処理した割合**です。人間videoと照合せず、認識率という言葉へ置き換えません。

最初のexposureと2回目以降を分け、攻撃ごとにeligible、handled、hit数、damageを集計します。

## 反撃窓

`boss.attack.recovery.started`から`recoveryEndsAt`までを反撃窓とします。

- `bossDamageDuringRecovery > 0`だけを`punishConverted`とする。
- 反撃窓が最後まで観測されていない0 damage episodeは分母へ入れない。
- recovery開始・終了時のplayerとBossの距離は事実として残す。
- 距離変化を「位置改善」と分類する閾値はまだ登録しない。

damageと位置改善を合成した採否指標は、人間runを見る前に閾値とfixtureを事前登録した場合だけ追加します。

## 回復と中央周回

Boss spawnから10秒binで次を集計します。

- 全sourceのplayer damage。
- 実HP回復量。
- REPAIR取得数と満HP取得数。
- Boss以外の敵撃破数。
- `hpRecovered / playerDamage`。damage 0のbinはnull。

中央周回の初期観測半径は220です。これはPhase 2 `command-pulse`の実半径であり、任意の調整値ではありません。Boss生存中のsimulation時間をsampleし、playerとBossの距離が220以下だった時間割合を`centralOrbit.share`として出します。高い割合だけで欠陥とは判定せず、攻撃対応、反撃変換、回復相殺と対で読みます。

## データ境界

`BossEncounterShadowMonitor`はSceneがstep後のworldとeventを渡すApplication観測器です。reportはdebug snapshotと開発用run exportだけへ複製します。

変更しないもの:

- `GameEvent`とsimulation hash。
- 乱数消費と入力。
- `RunRecord`、PB、ランキング。
- Boss攻撃順、HP、damage、回復供給。

## Runtime候補へ進む条件

Pulse / Spreadの人間runでPhase 2まで観測し、少なくとも次を説明できるまでcontrolを維持します。

1. 同じ攻撃の2回目以降にhandled率が改善するか。
2. 正しい処理後にBoss damageへ変換できるか。
3. 10秒binでdamageとhealがどの程度相殺されるか。
4. 中央220以内へ固定されても判断変更が必要か。

候補が必要な場合も、phase budget、escort reward、skill rewardから1案だけを別ruleset / SHAで比較します。
