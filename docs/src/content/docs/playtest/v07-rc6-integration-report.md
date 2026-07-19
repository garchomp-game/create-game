---
title: RC6 統合QAレポート
description: Expedition難度時計、6構成probe、全回帰、Version Preview、手動採否の証跡。
---

最終更新日: 2026-07-19

## 状態

ローカル自動統合QAは完了しました。RC6のproduction昇格は未採用で、v0.6.8 production trafficを維持しています。Version Previewの実URLsmokeと通常UIの手動採否を残しています。

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
| TypeScript / unit / simulation | 398 passed / 2 skipped |
| RC6 6構成と全入力replay | 2 probe tests passed。6組すべてinput / event / world hash一致 |
| Endless固定入力 | event `0e5c664a` / world `47a80192`を維持 |
| Playwright | 72 passed / 1 skipped。Chrome、Firefox、390 x 844、画像fixtureを含む |
| production build / 配布検査 | 成功。27 files、2.64 MiB、最大JS 1.68 MiB |
| Starlight | 90ページをbuild |
| 依存監査 | High / Critical 0。Windows開発server限定Low 1件 |

15分の実時間soakは今回の通常マトリクスでは再実行していません。RC5で既に通過済みであり、RC6差分はsimulation時計と記録に限定され、通常runとE2Eで新しいフレーム性能退行は確認していません。

## 残作業

- production配分を変更しないRC6 Version Previewと実URLsmoke。
- Pulse / Spread各1本の通常UI欠陥特化ラン。

実装契約は[RC6の時計と記録規則](../../engineering/expedition-rc6-clock-and-ranking-adr/)、実行手順は[RC6 QA・採否計画](../v07-rc6-qa-plan/)を正本とします。
