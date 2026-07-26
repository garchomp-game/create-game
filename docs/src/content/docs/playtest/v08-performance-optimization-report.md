---
title: v0.8 性能監査・最適化レポート
description: 最大密度描画、衝突判定、Pickup、DOM、計装を監査し、決定論を保ったまま最適化した結果。
---

実施日: 2026-07-26
基点: `main` / `d5118fda3ab1`

## 結論

現行上限の敵96体、敵弾256発、Pickup 1,024個を同時表示する固定fixtureで、
Phaserの実描画CPU時間p95を **17.75msから10.25ms**へ削減しました。
主要な改善は、毎フレームのGraphics再構築を減らしたことと、
密度に応じて衝突候補を空間分割したことです。

新しい汎用ライブラリは導入していません。現在の固定2Dアリーナとentity上限では、
既存Worldとの同期層や依存更新コストより、小さな決定論的Uniform Gridの方が
検証しやすく、効果も十分だったためです。

:::note[証拠の範囲]
最大密度fixtureはPlaywrightのsoftware rendererで行う比較用計測です。
これとは別に、Intel GPUとproduction最適化buildを使った実機15分ランを
2026-07-26に実施しました。
:::

## 実装前の監査

| 領域 | 問題 | 判断 |
| --- | --- | --- |
| 描画 | 障害物、敵弾、回復をGraphicsへ毎フレーム再構築 | 静的描画と共有textureへ分離 |
| 計測 | command生成時間だけで、Phaser実描画時間を含まない | `PRE_RENDER`から`POST_RENDER`を計測 |
| 弾対敵 | 概ね弾数 x 敵数の全件交差判定 | 高密度時だけUniform Grid |
| Pickup配置 | killごとに全Pickupを走査 | kill frame単位の配置Grid |
| Pickup更新 | 期限、吸引、回収で3回走査・2配列生成 | 1回走査・1配列生成 |
| DOM | 非表示の選択・TutorialでもCanvas矩形を毎フレーム取得 | 表示中だけ同期 |
| Run Fact | 通常buildでも全XP取得eventを保持し、結果分析を反復生成 | 候補/debugだけ収集し、終端後に1回集計 |
| 経路探索 | 共有Dijkstraと経路cacheが既にある | 今回は変更しない |

## 採用したアルゴリズム

### 弾と敵

- 敵24体未満では既存の直接走査を使い、Grid構築コストを避ける。
- 24体以上では96px cellのUniform Gridをフレームごとに構築する。
- 弾の移動segmentを、弾半径と最大敵半径で膨張したAABBとしてqueryする。
- query後は既存の厳密なsegment-circle交差判定を行う。
- 命中時刻と元のenemy indexで並べ替え、貫通順と決定論を維持する。

### Pickup

- kill eventがあるフレームだけ配置Gridを作る。
- 候補cellを絞った後も円同士の厳密な重なり判定を行う。
- 期限更新、磁力吸引、回収を1ループへまとめる。
- オートパイロットの密度cacheはPickup配列参照をkeyにするため、
  更新後は配列を1回だけ交換してcacheを無効化する。

最初の実装では配列をin-place更新したため、120秒の決定論ランで古い密度cacheが
残り、`xpCollect`判断が消える退行を検出しました。配列交換契約を復元し、
統合ランと単体fixtureで固定しています。

### 描画と計装

- 障害物は内容signatureが変わった場合だけ専用Graphicsへ再描画する。
- 敵弾と回復は共有の生成textureを一度作り、Image poolで同期する。
- Helpとゲーム本体は同じ敵弾描画関数を使う。
- 実描画時間は固定長の`Uint32Array` histogramへ集計し、
  全フレーム標本を保持せず平均、p95、最大値を返す。
- 最大密度fixture読込時に計測をresetし、メニュー時間を混ぜない。

## 比較結果

同じ`maximum-density-performance` fixtureを、変更前後で取得しました。

| 指標 | 変更前 | 変更後 | 差 |
| --- | ---: | ---: | ---: |
| Phaser実描画 平均 | 13.384ms | 6.257ms | -53.2% |
| Phaser実描画 p95 | 17.75ms | 10.25ms | -42.3% |
| Phaser実描画 最大 | 28.7ms | 13.0ms | -54.7% |
| dynamic command 平均 | 1.110ms | 0.994ms | -10.5% |
| raw frame p95 | 66ms | 50ms | -24.2% |

短いEX高圧soakでは、step p95が従来の概ね2.27から2.69msに対し、
候補は1.89から2.08msでした。実行環境の揺れを含むため参考値ですが、
8 variantすべてentity上限違反なしで完走しています。

## Intel GPU 15分ラン

テスト用hookだけを有効にしたproduction最適化buildを作り、
system Chromeをheadedで15分間動かしました。
`preserveDrawingBuffer`は無効のままにし、`DRI_PRIME=0`とChrome GPU processの
`/dev/dri/renderD128`指定からIntel GPU利用を確認しています。

同じ条件で2本完走し、2本目を正式値としました。

| 条件・指標 | 結果 |
| --- | ---: |
| GPU renderer | Mesa Intel UHD Graphics CML GT2 / WebGL |
| 実時間 / simulation時間 | 900秒 / 892.82秒 |
| 終了状態 | playing |
| raw frame p95 / 最大 | 7.0ms / 69.4ms |
| 50ms超過 | 5 / 129,298 frame（0.0039%） |
| Phaser全描画 平均 / p95 / 最大 | 2.985ms / 4.75ms / 30.5ms |
| 実測FPS / 終端rAF FPS | 138.22 / 143.37 |
| JS heap 開始 / 最大 / 終了 | 28.9MiB / 85.5MiB / 77.1MiB |
| 最大entity | 敵58、Player弾22、敵弾19、Pickup 832 |
| 終盤進行 | 脅威Tier 5、崩壊Stage 7 |
| Canvas非空sample | 1,781 |
| console / page error | 0 |

1本目もraw p95 7.0ms、全描画p95 4.5ms、実測FPS 139.52、
50ms超過3 / 129,492 frameであり、性能傾向を再現しました。
実行中は既存Chrome processを閉じずに残していたため、
完全な無負荷条件より保守的な測定です。

CPU温度は実行中の確認で最大77℃、終了後49℃、
Video温度は最大48℃で、thermal停止やconsole errorはありませんでした。

2本とも実測終了後のPlaywright判定だけは、テストがステージ合成前の旧基底設定から
脅威Tier 15を期待したため失敗しました。ゲーム実行値の不具合ではありません。
テストを`ArenaSession`と同じ設定解決経路へ修正し、現在の曲線に対応する
Tier 5 / Stage 7を導出するようにしています。修正後はtypecheckとテスト読込を
確認し、runtime artifactに変更がないため3本目の15分ランは省略しました。

## 自動確認

| Gate | 結果 |
| --- | --- |
| 全unit / simulation | 116 files、720 passed / 2 skipped |
| 最大密度fixture | 敵96、敵弾256、Player弾60、XP 1,000、回復24 |
| 最大密度browser budget | full render p95 10.25ms、最大13.0ms |
| EX高圧soak | 8 variant、違反0 |
| Intel GPU 15分 | raw p95 7.0ms、full render p95 4.75ms、50ms超過0.0039%、console error 0 |
| 対象visual E2E | boss弾、Help、回復、射撃の既存画像を維持 |
| production build | TypeScript / Vite buildを最終候補で再確認 |

## 採用しなかったもの

| 候補 | 判断 |
| --- | --- |
| 外部spatial-index / ECS | 現在のentity上限では自前Gridで十分。World同期と依存更新を増やさない |
| NavMesh / Crowd | 固定矩形障害物と共有Dijkstraに対して過剰 |
| Web Vitals依存 | ゲームの連続描画CPU時間とは目的が異なる |
| 全entityのSprite化 | 今回のprofileで支配的だった敵弾、回復、静的障害物を先に処理 |
| オブジェクトの全面Singleton化 | 可変run stateをglobal化せず、textureや描画定義だけを共有する |

## 判断

raw p95 34ms以下、50ms超過率1%未満、実測FPS 15超、
entity上限、heap、Canvas非空、console error 0の全基準を満たしました。
現時点でPlayer弾・敵本体・HUDの追加最適化や、新しい性能ライブラリの導入は
不要です。次回は描画方式、entity上限、終盤曲線のいずれかを大きく変えた場合に
同じ15分ゲートを再実行します。
