---
title: 強化選択テンポ計測
description: 強化・EX・契約の実表示時間と、選択後1秒の戦闘復帰をsimulationから分離して測る契約。
---

最終更新日: 2026-07-22

## 目的

[#78 強化選択の停止時間と頻度](https://github.com/garchomp-game/create-game/issues/78)を、UI候補の採用前後で同じ定義により比較します。選択画面がゲームを止めること自体を問題と決めつけず、停止頻度、実思考時間、再開後の操作と被弾を先に観測します。

この計装は開発用run exportだけへ追加します。`GameEvent`、simulation hash、乱数、`RunRecord`、PB、ランキングeligibilityは変更しません。

## 二つの時計

| 対象 | 時計 | 出力 |
| --- | --- | --- |
| 選択画面の実表示時間 | 注入可能な単調増加時計 | `visibleDurationMs` |
| 候補間隔とラン段階 | simulation時刻 | `openedAtSimulationSeconds`、`intervalSincePreviousChoiceSeconds` |
| 選択後の戦闘復帰 | simulation時刻 | 1秒windowの操作・実績差分 |

選択中はsimulation時刻が停止するため、`upgrade.offered`と`upgrade.selected`の差を思考時間に使いません。生のwall-clock時刻は残さず、表示durationだけをexportします。

## 責務

| 層 | 責務 |
| --- | --- |
| DOM adapter | pointer / keyboardの入力元を選択入力へ付ける |
| Phaser input adapter | canvas経由の数字キー・pointer入力元を付ける |
| Scene | 選択前counter、解決済み入力、step後counterをmonitorへ渡す |
| Application monitor | session、1秒window、集計、fake clock test |
| Telemetry adapter | reportを開発用run exportとdebug snapshotへ複製 |

SceneはKPIや採否を判定しません。入力元が欠落したdebug操作は人間操作として推測せず、通常のサンプルへ混ぜません。

## サンプル契約

通常強化、EX、契約ごとに次を保持します。

- 候補IDと候補数。
- 選択ID、index、`keyboard | pointer`。
- simulation上の提示・選択時刻と前回提示からの間隔。
- wall-clock表示時間。
- 選択後1秒の移動入力frame、照準入力frame、射撃入力frame。
- 同windowの実移動距離、実射撃数、被damage。

run要約では、種類別件数、入力元別件数、simulation 1分あたりの選択数、総停止時間比率、完了window数、hard stall数を返します。hard stallは1秒windowが完了し、移動入力・射撃入力・実射撃がすべて0だった場合だけです。未完了windowをstallへ数えません。

## 集計の分離

開発exportには既存の`runOrigin`、rank eligibilityと、このreportの`autoPilotObserved`が同居します。通常の人間runを集計するときは、少なくとも`runOrigin=manual`かつ`autoPilotObserved=false`を使い、debug / test / auto runを分離します。

## 採否前の確認

1. 現行UIとcandidate UIで同じ固定seed・武器・viewportを使う。
2. keyboard / pointerを最低1回ずつ含める。
3. 種類別表示時間、停止比率、選択頻度の分布を比較する。
4. 選択後1秒のhard stallを0件にする。
5. 被damageだけでUIを断定せず、移動・照準・射撃の復帰と対で読む。

候補数、XP曲線、無敵時間、武器数値、UIレイアウトは、この計装と同時には変更しません。
