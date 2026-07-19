---
title: RC6 統合QAレポート
description: Expedition難度時計、6構成probe、全回帰、Version Preview、手動採否の証跡。
---

最終更新日: 2026-07-19

## 状態

フォローアップ監査の安定化修正、normal / repair probe、全自動回帰の再取得は完了しました。RC6のproduction昇格は未採用で、v0.6.8 production trafficを維持しています。更新版Version Previewと通常UIの欠陥特化ランを採用前ゲートとして残しています。

## フォローアップ監査対応

2026-07-19の独立レビューを`revise before adoption`として受理し、ゲーム数値や新しいゲームルールを足さずに次を修正しました。

- signal完了とtimeoutを分離し、Commanderだけをspawn後120秒、最終ボスを無期限signal待ちとした。
- Directorへラン終端APIを追加し、勝利時はボスcardを同stepで完了、敗北時は全実行phaseを1回だけ中断する。相打ちは敗北を優先する。
- 390秒のAct境界を比較時ミリ秒丸めへ統一し、30 / 60 / 120 / 144 Hzの累積deltaで同じevent列になるfixtureを追加した。
- 配置期限と同時のspawn成功を拒否し、fallbackは予告方向を維持する。特殊先頭個体は中心座標を変えず、実半径で進入経路と衝突を検査する。
- PB比較へprofile境界、0.01秒精度、総合 / 武器scopeを追加した。ランキング消去後の復活を止め、保存groupを最大16件へ制限した。
- ランキング画面からmode、scope、固定seed実値、rulesetを巡回できるようにし、遠征敗北を「遠征未完遂」と表示する。Endlessはv0.6.8 rulesetを維持する。
- normal / repair probeの未実行側を`skip`として明示し、repairの勝敗、相殺率、通常敵撃破、移動条件を別々に判定する。

## 発見した不整合

`PH-V07-010`でCommander cardが`actElapsed`を停止するようになった一方、通常wave、通常敵のHP・damage、遠距離攻撃、heal drop減衰は`runElapsed`で進み続けていました。このためCommanderを解決した時間が総クリア時間へ加わるだけでなく、後続Actの通常戦闘圧力にも先行加算されていました。

RC6修正前のボス出現はrun時間430.03秒から467.27秒で、難度も同じ時間を参照していました。修正後はrun時間がCommander撃破速度に応じて424.37秒から469.47秒のまま変動しますが、ボス出現時の`difficultyElapsed`は392.533秒から394.167秒へ収まります。

初回候補では`actElapsed`をstepごとにミリ秒へ丸めており、30 / 60 / 120 / 144fpsで390秒境界へ到達するrun時刻が変わる問題も見つかりました。累積値は丸めず、比較と出力時だけ一度丸めるよう修正し、4フレームレートで同じAct境界になるfixtureを追加しました。

## 時計の分離

- `runElapsed`: 総クリア時間、Commander期限、ボス固有攻撃、履歴。
- `actElapsed`: ActとEncounter進行。Commander中は停止。
- `difficultyElapsed`: Expeditionの通常waveと通常敵成長。Act時計から導出。
- Endless: `difficultyElapsed`は従来どおり`runElapsed`と同値。

run exportには`elapsed`と`difficultyElapsed`を別々に出力します。ゲーム数値、武器、観戦AI、ボス回復controlは変更していません。

## 6構成probe

固定seedは`20260717`、`20260718`、`20260719`です。30fps相当、ceiling観戦AI、最大15分で比較しました。

| 武器 | seed | 結果 | 終了秒 | ボス出現run秒 | ボス出現難度秒 | ボス残HP |
| --- | ---: | --- | ---: | ---: | ---: | ---: |
| Pulse | 20260717 | 敗北 | 548.77 | 426.40 | 394.067 | 332.62 |
| Pulse | 20260718 | 敗北 | 437.20 | 424.37 | 392.533 | 3037.74 |
| Pulse | 20260719 | 勝利 | 571.40 | 430.77 | 394.167 | 0 |
| Spread | 20260717 | 敗北 | 577.37 | 453.17 | 394.067 | 319.88 |
| Spread | 20260718 | 勝利 | 624.60 | 466.47 | 392.533 | 0 |
| Spread | 20260719 | 勝利 | 622.23 | 469.47 | 394.167 | 0 |

結果は3/6勝、Pulse 1勝、Spread 2勝です。修正前controlの3/6勝を下回らず、両武器に自然勝利があります。全6構成でCommanderを1回出現・撃破し、Act 5と`targeted-salvo`、`escort-pincer`、`command-pulse`へ到達しました。自然runのboss phase 2到達は5/6で、両武器に到達例があります。Pulse / seed 20260718はボス開始12.83秒後に接触で敗北しました。最大敵数は46から61で、既存上限96以内です。

5/6は今回の観測値であり、固定seedへ過適合するhard gateにはしません。phase 2は専用fixtureで機構を固定し、自然runでは武器ごとに1本以上の到達を退行ゲートにします。

## ゲート再定義

RC5の6/6勝は回帰基準として保持しますが、RC6の機構到達性を観戦AIの全勝と同義にしません。Stage 10は高難度最終面であり、AIを人間難度や武器バランスの判定器として使わないためです。

必須の機構ゲート:

- 全6でCommander撃破、Act 5、3攻撃種へ到達。
- boss phase 2の遷移と固有挙動は専用fixture、自然runは両武器で1本以上の到達を保証。
- ボス出現難度時計390秒から400秒。
- Commander Act境界とspawn deferは専用fixtureで強制。
- 全6の同一seed・同一入力でevent / world hash一致。

戦闘退行ゲート:

- 自然勝利3/6以上。
- Pulse / Spread各1勝以上。
- 人間向け難度、中央周回、回復循環は通常UI各1本で採否。

## 自動QA実績

| ゲート | 結果 |
| --- | --- |
| TypeScript / unit / simulation | 型検査成功。65 files、417 passed / 2 skipped |
| RC6 normal 6構成と全入力replay | `1 passed / 1 skipped`。3/6勝、両武器勝利・phase 2到達、6組すべてinput / event / world hash一致 |
| RC6 repair比較 | `1 passed / 1 skipped`。control 3/6対candidate 0/6、candidate replay hash一致。候補は棄却を維持 |
| Endless固定入力 | event `0e5c664a` / world `47a80192`を維持 |
| Playwright | 73 passed / 1 skipped。Chrome、Firefox、390 x 844、画像fixture、2武器 x 2 fixed seed x 2 rulesetのランキング巡回を含む |
| production build / 配布検査 | 成功。27 files、2.65 MiB、最大JS 1.69 MiB |
| Starlight | 90ページをbuild |
| 依存監査 | High / Critical 0。Windows開発server限定Low 1件 |

15分の実時間soakは今回の通常マトリクスでは再実行していません。RC5で既に通過済みであり、RC6差分はsimulation時計と記録に限定され、通常runとE2Eで新しいフレーム性能退行は確認していません。

## Version Preview

| 項目 | 値 |
| --- | --- |
| Git commit | `f06c9b585cc4` |
| Cloudflare Version ID | `a9522576-e9ff-4fce-92df-35c9c732849c` |
| Version Preview | `https://v07-final-expedition-rc6-arena-core.garchomp-game.workers.dev` |
| app / ruleset | `0.7.0` / `phaser-v0.7.0-final-expedition-rc6` |

実URLの通常UIで、HTTP 200、版meta、WebGL canvas、設定、ランキング、履歴、Pulse開始と自然終了、RunRecord保存、リトライ、一時停止、ベータ情報、第三者ライセンス、最終遠征選択、Spread開始を確認しました。console error、page error、失敗request、HTTP 4xx / 5xx、`window.__ARENA_DEBUG__`公開は0件です。

upload後もproduction deploymentはVersion `e86f90b8-ea15-4d1d-b01b-59e4f9fea78e`が100%で、公開URLのmetaは`0.6.8` / `phaser-v0.6.8-pulse-boundary-ricochet` / `ff686f992a65`のままです。

## 残作業

- Pulse / Spread各1本の通常UI欠陥特化ラン。

実装契約は[RC6の時計と記録規則](../../engineering/expedition-rc6-clock-and-ranking-adr/)、実行手順は[RC6 QA・採否計画](../v07-rc6-qa-plan/)を正本とします。
