---
title: v0.7 RC6 QA・採否計画
description: 最終遠征RC6の時計、spawn defer、記録、有限回復実験を段階的に検証する実行前QA計画。
---

最終更新日: 2026-07-19

## 目的

RC5をそのままproductionへ昇格せず、Encounterの時計とExpeditionの記録規則を先に安定化します。その後、ボス戦の有限回復予算を独立したA/B候補として評価し、中央周回が最適解へ戻らないことを確認します。

実装契約は[最終遠征RC6の時計と記録規則](../../engineering/expedition-rc6-clock-and-ranking-adr/)を正本とします。この文書は実装順、fixture、probe、手動採否を定義します。

## 基準とブランチ

- RC5アプリ基準: `155d4986ffe1`
- RC5 UI変更前の統合基点: `d16655a`
- RC5 ruleset: `phaser-v0.7.0-final-expedition-rc5`
- RC6 ruleset: `phaser-v0.7.0-final-expedition-rc6`
- production: v0.6.8を維持し、RC6採否までtrafficを変更しない。
- UI境界・prototype・選択画面の既存ブランチは維持し、RC6のゲームルール変更を混ぜない。

RC5の6勝、決定論、72件のE2E、Preview smokeは基準証跡です。RC6の合格証拠として読み替えず、変更後に必要なゲートを再実行します。

## 作業単位

### A. Encounter時計とspawn defer

対象Issue: `PH-V07-010`

状態: 実装済み。再試行間隔2秒、配置期限10秒、Commander cooldown 600秒で固定しました。マイクロfixture、全unit / simulation、既存6構成probeの決定論を確認済みです。EndlessのRC5固定入力hashはevent `0e5c664a`、world `47a80192`で基点`d16655a`と一致します。Wave 1時点のprobeは6構成すべて最終Actへ到達し、Pulse 1勝 / 2敗、Spread 2勝 / 1敗でした。

- `runElapsed`と`actElapsed`の所有者を分ける。
- HUDはDirectorの現在Actだけを表示する。
- Commander cardでAct時計を停止する。
- Expeditionの通常戦闘難度をAct時計へ同期し、Commander中の先行成長を止める。
- spawn成功後から120秒を数える。
- deferを決定論的に再試行し、配置期限切れで必ず解放する。
- 完了、timeout、deployment timeoutの理由をRunRecordとeventへ残す。

### B. Expedition記録とruleset

対象Issue: `PH-V07-011`

状態: 実装済み。勝利時間優先、戦術点、Stage 10の金9分・銀10分・銅12分、overall / weapon、fixed実seed、RC5 / RC6の比較境界をfixtureで保証しました。旧profile、破損復旧、一回保存、個別削除、Endless順位を含む全unit / simulationは387件成功、2件skipです。production build、最終遠征ブラウザフロー、960 x 540リザルト画像を確認しました。

Wave 2時点の同じ3 seed x 2武器probeは決定論を維持し、Pulse 1勝 / 2敗、Spread 2勝 / 1敗でした。勝利3本は速攻加点0で総得点が戦術点と完遂15,000点の和になり、総時間に応じて銀または銅になりました。

- 勝利ランの総クリア時間を主記録にする。
- 敗北は履歴へ残すが勝利PBを上書きしない。
- `overall | weapon`の比較scopeを同じ履歴から導出する。
- fixed seedは実値ごと、random runはrandom同士で比較する。
- 速攻点を戦術点から外し、時間メダルへ移す。
- RC6 rulesetをRC5以前から分離する。

### C. ボス有限回復予算

対象Issue: `PH-V07-012`

状態: 比較完了、candidate Aは棄却。RC6基礎版をcontrolとし、2400 HP・補充なしの有限回復候補を同じseed、武器、入力で比較しました。controlは3/6勝利、candidate Aは0/6勝利でした。相殺率は下がりましたが、controlで勝利した3構成がすべて敗北へ反転したため、既定値は`repairBudget: null`を維持します。詳細は[RC6 有限回復予算 比較結果](../v07-rc6-repair-budget-report/)を参照してください。

観測項目:

- ボス中の総被ダメージ。
- ボス中の実HP回復量。
- 回復相殺率。
- drop生成、抑制、取得、満HP取得。
- ボス戦時間、通常敵撃破、中央滞在時間、外周または遮蔽への移動回数。
- Pulse / Spread別の勝敗と戦術差。

初期合格条件は、回復相殺率だけを一律に下げることではありません。中央周回と雑魚撃破だけで被害をほぼ全量相殺できず、回復を取りに行く経路判断が残り、両武器が到達不能にならないことを要求します。

## マイクロfixture

実時間probeより先に、次の小さい決定論fixtureを追加します。

| ID | 条件 | 必須結果 |
| --- | --- | --- |
| `act-clock-block` | Commander active中にAct境界へ達する | 完了。Actは変わらず、解決後の次stepで1回だけ遷移 |
| `commander-spawn-start` | 予告後にspawn成功 | 完了。120秒の起点がspawn eventと一致 |
| `commander-defer-retry` | 初回配置不可、後続で配置可能 | 完了。同じ時刻、候補順、spawn IDで成功 |
| `commander-defer-timeout` | 期限まで配置不可 | 完了。`deployment-timeout`で終了しAct時計を解放 |
| `commander-active-timeout` | spawn後120秒未撃破 | 完了。`timeout`、撤退、重複終了なし |
| `victory-pb-protection` | 勝利PB後に速い敗北を保存 | 完了。勝利PBは不変、敗北は履歴へ残る |
| `ranking-scope` | 2武器、複数勝利を保存 | 完了。overallとweapon PBが同時に正しい |
| `fixed-seed-partition` | 同rulesetで異なるfixed seed | 完了。seedごとのPBが混ざらない |
| `ruleset-partition` | RC5とRC6を保存 | 完了。RC6順位にRC5が混ざらない |
| `tactical-score-time-free` | 同戦術成果、異なる時間 | 完了。戦術点は不変、時間メダルだけが変わる |

境界値として、spawn直前、期限と同時、119.999秒、120秒、Act境界と同一stepも含めます。

## 固定probe

3 fixed seed x 2武器の6構成を、同じシード集合と上限で実行します。RC6では仕組みの到達性と観戦AIの自然勝敗を別ゲートにします。

probeは次を集計ではなくassertします。

1. 全6構成がCommanderを撃破し、Act 5と3攻撃種へ到達する。
2. ボス出現時の難度時計が390秒から400秒で、threat tier 0、pressure step 0である。
3. 自然勝利がRC6修正前の3/6以上で、Pulse / Spreadが各1勝以上ある。
4. boss phase 2の遷移と固有挙動を専用fixture、自然runの両武器各1本以上で保証する。
5. 専用fixtureでCommanderがAct境界を越えても解決前に遷移せず、解決後に1回だけ進む。
6. 強制spawn defer fixtureの再試行結果がreplayで一致する。
7. 敗北保存後も勝利PBが保持される。
8. fixed seed実値ごとの順位が分離する。
9. overall PBと各weapon PBが両立する。

加えて、event hash、world hash、保存hash、最大密度を既存RC5基準と比較します。全6勝は要求しません。観戦AIの戦闘性能を合格条件へ合わせてゲーム数値やAIを変更せず、機構fixtureと3/6以上の自然勝利を別々に保証します。

Wave 4候補は3/6勝（Pulse 1、Spread 2）でした。全6がCommander撃破、Act 5、3攻撃種へ到達し、5/6がboss phase 2へ到達しています。ボス出現時の難度時計は392.533秒から394.167秒です。実値は[RC6 統合QAレポート](../v07-rc6-integration-report/)へ残します。

## 回帰マトリクス

- TypeScriptと依存方向。
- unit / simulation全件。
- `probe:v07`と同一入力replay。
- Endlessのスコア優先順位、fixed seed区分、履歴。
- Expeditionのoverall / weapon PB、敗北履歴、メダル。
- desktop 960 x 540、portrait 390 x 844のAct、Commander、リザルト。
- ChromeとFirefoxのキーボード、pointer、再試行、タイトル復帰。
- production buildと公開物検査。
- Starlight buildと内部リンク。

## 手動採否

自動ゲート通過後に、debug hookと観戦AIなしで行います。

1. Pulse / Spreadを各1本以上プレイする。
2. Commander中に次Actの敵や表示へ先行しないことを確認する。
3. 従来の中央寄せ・近距離周回を少なくとも1本で意図的に試す。
4. 制圧衝撃波を距離または遮蔽物で処理できることを確認する。
5. 回復を拾う判断と通常敵を減らす判断が残り、無期限の安定循環にならないことを確認する。
6. 勝利時に総クリア時間、時間メダル、戦術点を別の意味として理解できることを確認する。
7. 総合PBと使用武器PB、fixed seed記録が意図したscopeへ表示されることを確認する。

高難度最終面なので手動全勝は要求しません。不可視攻撃、予告なし即死、操作不能、記録損失、再現する重大性能劣化は即時停止条件です。

## 採否順

1. `PH-V07-010`の時計とspawn deferを実装し、マイクロfixtureを通す。
2. `PH-V07-011`の記録規則とRC6 rulesetを実装し、保存fixtureを通す。
3. 6構成の機構到達、戦闘非劣性、全入力replayと全回帰でRC6基礎版を固定する。
4. `PH-V07-012`の有限回復候補をcontrolと比較する。
5. 採用候補だけで全回帰と通常UIの欠陥特化ランを行う。
6. `PH-V07-008`でproduction昇格、再調整、棄却のいずれかを記録する。

Stage 1 / 5 / 10、危険反転、技能shadow ledger、武器教義、最終ビジュアルはRC6のproduction採否と分けます。
