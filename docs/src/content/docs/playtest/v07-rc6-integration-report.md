---
title: RC6 統合QAレポート
description: Expedition難度時計、6構成probe、全回帰、Version Preview、手動採否の証跡。
---

最終更新日: 2026-07-20

## 状態

code commit `c908450a7101`で提出物再レビューの追補を完了し、normal / repair probeと全自動回帰を再取得しました。最終HEAD `faeb3f5e8c5e`、Draft PR [#82](https://github.com/garchomp-game/create-game/pull/82)、Version Previewを同じ証拠へ結び付けています。

2026-07-19に同じPreviewからPulse 2本、Spread 1本の通常UI欠陥特化ランを取得しました。両武器でboss phase 2と3攻撃種へ到達し、中央誘導後も位置、標的、回復経路の変更なしには生存できないことを確認しました。有限回復candidate Aは棄却したまま、`repairBudget: null`のRC6 controlをproduction候補として採用します。production trafficはリポジトリ統合とUI候補の採否までv0.6.8を維持します。

## フォローアップ監査対応

2026-07-19の独立レビューを`revise before adoption`として受理し、ゲーム数値や新しいゲームルールを足さずに次を修正しました。

- signal完了とtimeoutを分離し、Commanderだけをspawn後120秒、最終ボスを無期限signal待ちとした。
- Directorへラン終端APIを追加し、勝利時はボスcardを同stepで完了、敗北時は全実行phaseを1回だけ中断する。相打ちは敗北を優先する。
- 390秒のAct境界を比較時ミリ秒丸めへ統一し、30 / 60 / 120 / 144 Hzの累積deltaで同じevent列になるfixtureを追加した。
- 配置期限と同時のspawn成功を拒否し、fallbackは予告方向を維持する。特殊先頭個体は中心座標を変えず、実半径で進入経路と衝突を検査する。
- PB比較へprofile境界、0.01秒精度、総合 / 武器scopeを追加した。ランキング消去後の復活を止め、保存groupを最大16件へ制限した。
- ランキング画面からmode、scope、固定seed実値、rulesetを巡回できるようにし、遠征敗北を「遠征未完遂」と表示する。Endlessはv0.6.8 rulesetを維持する。
- normal / repair probeの未実行側を`skip`として明示し、repairの勝敗、相殺率、通常敵撃破、移動条件を別々に判定する。

## 提出物再レビュー追補

同日の提出物再レビューを再び`revise before adoption`として受理し、ゲーム数値を変更せず次を追補しました。

- repair release matrixの期待値を`false / true / true / true`として直接assertし、候補0勝だけによるfalse greenを防いだ。
- Expeditionの保存、比較、時間メダル、精密表示、PB差分を整数centisecondへ統一した。`0.295`秒と`500.005 -> 500.004`の境界fixtureを追加し、Endless v0.6.8の順位規則は維持した。
- Commander撃破、active timeout、deployment timeout後に固有objectiveを消し、現在Actの通常objectiveへ戻した。
- Expedition敗北の履歴へ`PB対象外: 遠征未完遂`を表示し、詳細表示と理由を統一した。

この追補で自動release contractは閉じました。debug時刻ジャンプと将来fallbackの共通API edge、厳密な永続LRU、GitHub Actions新設は今回のproduction blockerへ含めず、後続の着手条件として残します。

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
| 対象code | `c908450a7101` |
| TypeScript / unit / simulation | 型検査成功。65 files、420 passed / 2 skipped |
| RC6 normal 6構成と全入力replay | `1 passed / 1 skipped`。3/6勝、両武器勝利・phase 2到達、6組すべてinput / event / world hash一致 |
| RC6 repair比較 | `1 passed / 1 skipped`。control 3/6対candidate 0/6、candidate replay hash一致。候補は棄却を維持 |
| Endless固定入力 | event `0e5c664a` / world `47a80192`を維持 |
| Playwright | 73 passed / 1 skipped。Chrome、Firefox、390 x 844、画像fixture、2武器 x 2 fixed seed x 2 rulesetのランキング巡回を含む |
| production build / 配布検査 | 成功。27 files、2.65 MiB、最大JS 1.69 MiB |
| Starlight | 90ページをbuild |
| 依存監査 | High / Critical 0。Windows開発server限定Low 1件 |

15分の実時間soakは今回の通常マトリクスでは再実行していません。RC5で既に通過済みであり、RC6差分はsimulation時計と記録に限定され、通常runとE2Eで新しいフレーム性能退行は確認していません。

## 通常UI欠陥特化ラン

対象はapp `0.7.0`、ruleset `phaser-v0.7.0-final-expedition-rc6`、build `faeb3f5e8c5e`です。debug hookと観戦AIを使用していません。

| 武器 | 結果 | 総時間 | スコア | 到達phase | ボス時間 | ボス被ダメージ / 実回復 | 相殺率 | 最終HP |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Pulse | 敗北 | 430.66秒 | 44,574 | 1 | 14.48秒 | 277 / 81 | 29.24% | 0 |
| Pulse | 勝利 | 578.93秒 | 107,011 | 2 | 148.62秒 | 2,630 / 2,629 | 99.96% | 203 |
| Spread | 勝利 | 584.49秒 | 108,891 | 2 | 155.36秒 | 2,908 / 2,856 | 98.21% | 160 |

Pulse勝利は`targeted-salvo` 25回、`escort-pincer` 24回、`command-pulse` 24回、Spread勝利は順に26回、26回、25回を実行しました。ボス中の通常敵撃破は1,810体と1,873体です。実回復の相殺率は高いものの、単純な近距離周回では拡散弾と周期攻撃を受け続けます。範囲攻撃を外し、外周または障害物へ退避し、通常敵を減らして回復を作り、再びボスへ火力を出す判断が必要でした。

採否判断:

- Pulse / Spread双方でphase 2と3攻撃種を確認した。
- `command-pulse`は範囲外退避で処理でき、予告なし即死ではなかった。
- 中央寄せを120秒以上試した勝利ランでも、位置、標的、回復経路を変えない無期限循環には固定されなかった。
- 回復をさらに減らすと避け切れない終盤密度に対して過度に厳しくなるため、有限repair budgetを再採用しない。
- 道中はEndlessの1万点台から2万点台相当で、気を抜くと敗北するが最終面として理不尽ではないという所感だった。
- Pulse勝利はactual FPS 134.37、Spread勝利は143.31で、p95 raw deltaは双方7ms、50ms超過は0件だった。
- 不可視攻撃、操作不能、soft lock、記録損失、再現するP0 / P1不具合は報告されなかった。

PB scope、fixed seed、ruleset、敗北理由の保存と再表示はunit / E2Eで固定済みです。人間の難度と回復循環は上記通常UIラン、自動化可能な記録契約はfixtureへ責務を分けて採用します。

## 最終Version Preview

| 項目 | 値 |
| --- | --- |
| Git commit | `faeb3f5e8c5e` |
| Cloudflare Version ID | `fd444a58-b131-4397-b366-5099badcb6a2` |
| Immutable URL | `https://fd444a58-arena-core.garchomp-game.workers.dev` |
| Version Preview | `https://v07-final-expedition-rc6-arena-core.garchomp-game.workers.dev` |
| app / ruleset | `0.7.0` / `phaser-v0.7.0-final-expedition-rc6` |

固有URLとaliasの双方で、HTTP 200、RC6版meta、WebGL canvas、設定、ランキング、履歴、Pulse開始と自然終了、RunRecord保存、リトライ、一時停止、最終遠征の武器選択とSpread開始、ベータ情報、第三者ライセンスを確認しました。ページmetaはRC6、開始したEndlessのRunRecordは互換性を維持するv0.6.8 rulesetとして保存されます。console error、page error、失敗request、HTTP 4xx / 5xx、`window.__ARENA_DEBUG__`公開は0件です。

upload後もproduction deploymentはVersion `e86f90b8-ea15-4d1d-b01b-59e4f9fea78e`が100%で、公開URLのmetaは`0.6.8` / `phaser-v0.6.8-pulse-boundary-ricochet` / `ff686f992a65`のままです。

## 採用後の残作業

- Draft PR #82をmainへ統合する。
- 選択UI仮統合を別PRと外部プレイテストで採否する。
- 採用するv0.7配布SHAを固定してからproduction build、smoke、rollback確認を再実行する。

RC6のゲームルール採否は完了しています。新しい危険、武器教義、難度支援、Stage 1 / 5はこのrulesetへ追加せず、v0.8以降の別candidateで比較します。

実装契約は[RC6の時計と記録規則](../../engineering/expedition-rc6-clock-and-ranking-adr/)、実行手順は[RC6 QA・採否計画](../v07-rc6-qa-plan/)を正本とします。
