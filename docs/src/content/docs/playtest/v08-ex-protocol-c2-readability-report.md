---
title: EX Protocol C2 可読性・成立条件レポート
description: 過負荷契約の廃止と6体系の発動条件・表示改訂を、人間確認へ渡す前の短い自動証拠。
---

初回実施日: 2026-07-23 / Preview更新日: 2026-07-24

:::caution[採用判定ではない]
C2はownerのC1フィードバックを反映した比較候補です。production traffic、main、既存C1 Previewは変更していません。20 seed、90秒soak、Final Expedition 40本は、人間確認後に候補を固定する場合だけ再実行します。
:::

## 対象

- branch: `feat/v08-ex-protocols-c1`
- C2 gameplay commit: `9b886a641cbf`
- current Preview runtime: `f1bd1dd75758`
- app / Endless ruleset: `0.8.0-candidate.2 / phaser-v0.8-ex-protocols-c2`
- fixed Preview: [EX Protocol C2](https://v08-ex-protocols-c2-9b886a6-arena-core.garchomp-game.workers.dev/)
- Cloudflare Version ID: `5c526482-f5d0-4b20-bed4-61335a188ef3`
- production既定: EX OFF。C1とlegacy recordは読取可能

2026-07-24のPreview更新はProtocolの数値や成立条件を変えていません。Expedition勝利時に最後の被弾を原因として表示しないことと、敗北時の撃墜原因を具体的な文へ直した結果UI追補です。同一aliasを新Versionへ付け替え、版情報、canvas、candidate run開始、console / page / request error 0件を再確認しました。

## 変更した判断

| 対象 | C1 | C2 |
| --- | --- | --- |
| 240秒契約 | Standard / Overloadを表示 | 表示しない。通常Endlessの有限終了へ一本化 |
| 交差導線 | 生存中の集束MAX敵を0.9秒記録 | 撃破地点を含め1.5秒記録 |
| 反跳過給 | 次弾受付1.25秒 | 次弾受付2秒 |
| 赤熱炉心 | 集束MAX到達後の次の命中 | 集束MAXへ到達する命中から発動 |
| 全幅潮汐掃討 | 5体かつ左右端弾が別対象 | 同一通常volleyで別々の3体 |
| 防波扇 | 160px以内の3体 | 190px以内の2体 |
| 護壁扇 | 数値と内部用語中心の説明 | 数値は維持し、自動迎撃と防げない弾を明記 |
| 選択カード | `TRIGGER / EFFECT / COST` | `自動 / 手動`と`発動条件 / 効果 / 制約` |

damage、cooldown、Redline最大HP、Breakwater HP cost、Aegis外縁damage低下は変更していません。一律buffではなく、成立しない・読めない箇所だけを修正しています。

## 自動証拠

| Gate | 結果 |
| --- | --- |
| Protocol micro fixture | Relay撃破地点、Redline MAX到達弾、Tidal 3体、Breakwater 2体、Rebound 2秒境界をPASS |
| 全unit | 87 files / 564 passed / 2 skipped |
| TypeScript | PASS |
| 短いpaired probe | 2 seed、30秒、6 tests PASS、同一seed replay一致 |
| Candidate browser | Chrome 13 passed |
| 選択画面 | 960 x 540と390 x 844で文字切れ・矩形逸脱なし。基準画像更新 |
| 配布build | 231 modules、31 files、2.83 MiB、artifact検査PASS |
| Starlight | 104 pages PASS |
| 実URL短縮smoke | HTTP 200、版情報一致、canvas起動、candidate run開始、console / request error 0 |

既存の自然死亡まで待つ実URLsmokeは、30秒台でheadless Chromeのpageが閉じ、assert前にharnessが中断しました。候補のpage errorやHTTP errorは記録されていませんが、これはPASSへ数えません。長時間の実GPU確認は未実施です。

## 短いprobeの読み方

30秒窓の`opportunity / effect`は、Rebound `14 / 13`、Tidal `69 / 69`、Breakwater `5 / 4`、Aegis `792 / 47`でした。TidalのProtocol damage share中央値は約8.54%、Breakwaterは約1.55%です。

Relay / Redlineはこの短いfair AI窓でも`0 / 0`でした。micro fixtureでは新条件を再現できているため、実装不成立ではなく、fair AIの標的維持と30秒露出では機会を作れていない状態です。C2をさらに自動buffせず、人間が次を確認します。

- Relayは通常操作で集束MAXの記録と別対象への連鎖を認識できるか。
- Redlineは最大HP低下に見合う発動頻度と手応えがあるか。
- TidalはCHARGEが簡単すぎてRMB / E連打にならないか。
- Breakwaterは2体条件でも、HPを払う緊急離脱として選ぶ理由があるか。
- Aegisは操作不要と、防げないボス弾・背後弾を誤認しないか。
- 240秒前後で過負荷選択が出ず、EX選択と戦闘テンポが途切れないか。

## 次の判定

C2は人間可読性gateへ進めます。Pulse / Spread各3体系を最低1回選び、発動条件をカードだけで説明できるか、実際に一度成立させられるかを確認します。そこで条件または数値を変える場合はC3へ分け、C2のrulesetと記録を上書きしません。

人間確認で候補を維持する場合だけ、20 seed paired balance、90秒soak、Final Expedition露出、実GPU 15分を最終設定からまとめて再取得します。
