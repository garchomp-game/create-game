---
title: 性能調整とultra運用の引き継ぎ
description: 2026-07-26終了時点の実装、検証済み範囲、翌日に決める開発運用を整理する。
---

最終更新日: 2026-07-26

## 本日の終了点

Endlessの初心者向け成長・難度カーブは、Draft PR
[#129](https://github.com/garchomp-game/create-game/pull/129)のcommit `04e489c`へ
中間固定しました。採用候補はC8です。

- 通常XPは30開始、1.03倍、上限60。通常25強化の累計は1,081 XP。
- 初回強化は観戦AIで約40秒。時刻だけを待たせる隠れたcadenceは使わない。
- 30秒は追跡体の小さな密度変化だけにし、重装体60秒、高速体120秒、
  射撃体300秒へ分ける。
- 420秒から通常密度を連続強化し、600秒から敵能力強化とアリーナ崩壊を開始する。
- 最初の危険イベントは900秒から930秒へ移す。
- 初期damageをさらに下げたC9は、AIの行動変化により生存が悪化したため棄却した。
- Final Expedition、Story、Training、Practiceの進行値は変更しない。

3 fixed seedの`ceiling`観戦では、Pulseがp50 866.45秒・最大1,000.05秒、
Spreadがp50 452.50秒・最大876.25秒でした。Pulseは15分を超え、Spreadも1本は
崩壊stage 7まで到達しました。Spreadの短命runは接触と敵弾回避が主因であり、
ゲーム全体をさらに弱める材料にはしません。

## 本日確認した範囲

- TypeScript検査。
- stage設定、XP、wave予告、AutoPilot安全境界の対象unit。
- 2 seed・90秒の序盤probe。
- 3 seed x 2武器・最大1,000秒の長時間screening。
- 同一seedの決定論replay。
- EX候補を有効にしたdevサーバー。

長時間screeningは調整用の比較であり、手動プレイの代替ではありません。C8の
手動10分到達と体感は、人間受け入れ結果として別に記録します。

## 翌日に決めること

### 1. ultra時の作業単位

- 1サイクルで扱うIssue数と、同時に変更してよいscalar数。
- 中間commitを作る間隔。
- UI、ゲーム数値、計装、性能調整を同じサイクルへ混ぜる条件。
- 長時間自律作業で停止する条件と、人間判断へ戻す条件。

### 2. QAの段階

案として次の三段階を比較し、正式運用を決めます。

| 段階 | 実行候補 | 用途 |
| --- | --- | --- |
| 編集中 | 型検査、対象unit、短い決定論probe | 局所退行を早く検出 |
| 候補固定 | 全unit、対象E2E、短いbuild、関連docs | PRへ載せる候補を確認 |
| 採用前 | 全E2E、release probe、soak、配布build、公開smoke | SHAを固定して一度だけ実行 |

共有simulation、保存形式、ruleset、描画基盤を変更した場合は、編集途中でもゲートを
一段広げます。文言、fixture、限定UIの変更だけで毎回長時間probeを繰り返しません。

### 3. 性能調整

- ブラウザ実機とCPU加速runのどちらを性能合格判定に使うか。
- 平均値ではなくp95、50ms超frame、敵・弾・Pickup数をどの時点で採るか。
- dev buildを下限確認、production buildを採用確認として分けるか。
- AutoPilot判断時間とsimulation stepを別々に計測するか。
- 性能改善を始める閾値を先に固定し、数値が問題ない段階で予防的最適化を行わない。

## 翌日へ残すゲート

本日は次を実行しません。

- 1,500秒の有限終了release probe。
- 12 seedの成長release probe。
- 全unit、全Playwright、配布build、公開smoke。
- C8採用後のapp / ruleset更新。
- `current-state`、難度設計、risk / decision logの採用値への同期。
- PR #129のReady化とmainへのmerge。

これらは性能調整とultra運用を決めた後、採用候補SHAを固定してまとめて実行します。
Draft PRのCI結果は補助証拠として扱い、ローカルの最終ゲートと混同しません。

## 再開手順

1. C8の手動所感と保存ログを確認する。
2. 性能調整とultra運用を決め、このページを決定内容へ更新する。
3. C8を採用または保留し、採用時だけapp / rulesetを更新する。
4. 上記の採用前ゲートを一度実行する。
5. 正本文書、Issue #128、PR #129を同じcommit SHAへ同期する。

