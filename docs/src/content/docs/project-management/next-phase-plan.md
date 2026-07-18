---
title: 直近フェーズ
description: v0.7最終遠征RC5を手動採否し、10ステージ展開とUI・グラフィック再設計へ進む現在の計画。
---

最終整理日: 2026-07-18

## 現在の判断

v0.6.8公開ベータはcommit `ff686f992a65`、Cloudflare Version ID `e86f90b8-ea15-4d1d-b01b-59e4f9fea78e`としてproductionへ固定しています。v0.7では責務分離、Stage / Encounter基盤、構造化出現、Commander、Charger、5 ActのExpedition、2攻撃・2段階の指揮艦ボスまで実装しました。

RC1とRC2の手動所感から、道中に対してボスが易しい難度逆転と、初心者向け学習ステージとしては道中が難しすぎることが分かりました。現行縦切りを第10ステージへ再分類し、RC3で最終遠征の戦闘値を固定しました。RC4でEndless C5到達性を分離調整しましたが、手動5勝から中央周回、貫通雑魚処理、回復供給、長時間稼ぎが循環する欠陥が判明しました。

現在の候補は`0.7.0` / `phaser-v0.7.0-final-expedition-rc5`です。RC5は範囲外か遮蔽物で避ける制圧衝撃波、ボス戦中の回復drop毎秒1個制限、完遂・速攻ボーナス、3列リザルトを追加しました。両武器3 seedの6勝、決定論、72件のE2E、実URLsmokeは完了しています。次の作業はPulse / Spread各1本以上の欠陥特化手動採否です。

- 体験要件: [v0.7 最終遠征プロトタイプ](../../design/v07-first-expedition/)
- 実装順と受け入れ条件: [v0.7 実行計画](../v07-execution-plan/)
- 中長期の範囲: [中長期作業計画](../gameplay-expansion-plan/)
- 現在の実装: [現在地](../../game/current-state/)
- QA結果と手動項目: [v0.7 統合QAレポート](../../playtest/v07-qa-report/)
- 複数ステージへの展開: [エクスペディション10ステージ設計](../../design/expedition-campaign/)
- UIと視覚設計: [UI・グラフィック再設計計画](../ui-visual-redesign-plan/)

## 現在の移行点

productionはv0.6.8のまま維持します。v0.7はCloudflare Version Previewだけへ公開し、手動採否が終わるまで`wrangler deploy`やtraffic昇格を行いません。保存比較は新しいルール版へ分かれるため、旧履歴を残してもランキングへ混ざりません。

- RC5 Preview: `https://v07-final-expedition-arena-core.garchomp-game.workers.dev`
- commit: `155d4986ffe1`
- Cloudflare Version: `ef6324fd-1cf6-450f-8026-fbcf0f579842`
- production: Version `e86f90b8-ea15-4d1d-b01b-59e4f9fea78e` 100%を維持

## 入口ゲート

### 1. 公開ルール固定

状態: 2026-07-17完了。

- 外周反射をPulse固有の地形判断として有効採用する。
- `RULESET_VERSION`を`phaser-v0.6.8-pulse-boundary-ricochet`へ更新する。
- 過去ランキングと比較不能な記録を混ぜない。
- production build、公開URL、保存、ライセンス、プライバシー、フィードバック導線を確認する。
- 基準コミットとCloudflare Version IDを記録する。

### 2. 責務分離

状態: 2026-07-17完了。

- `PH-ARCH-005`でSessionとRun LifecycleをSceneから分ける。
- `PH-ARCH-006`でDebug、AI、PerformanceをSceneから分ける。
- 同一seed / inputのworldとresult hash、保存結果、既存E2Eを維持する。

Session、Run Lifecycle、Debug、AI、Performanceを単一所有者へ分け、`ArenaScene`は649行の調停中心になりました。全面的なフォルダー移動やDDD化は行っていません。

## v0.7の最小成果

- 第10ステージ相当の高難度Expedition 1本。
- 既存アリーナをデータ化したStage 1件。
- Encounter Card 3枚以上と構造化出現3形状。
- 指揮艦エリート1種、予兆付き突進敵1種。
- 2攻撃以上と段階変化を持つボス1体。
- Act、目的、ボスHP、勝敗を伝えるUI。
- 背景1、敵またはボス1、危険イベント1の視覚縦切り。
- mode / stage / encounter / boss / 勝敗を追えるラン記録。

第1から第9ステージ、ステージ選択、アカウント、オンラインランキング、恒久強化、3つ目の武器、長編ストーリーはRC3対象外です。

## 実行順

1. 完了: `PH-ARCH-005`、`006`で所有権を分離。
2. 完了: `PH-V07-001`から`003`でStage、Encounter、出現安全を実装。
3. 完了: `PH-V07-004`、`005`で優先標的と予兆回避を実装。
4. 完了: `PH-V07-006`、`PH-ARCH-007`でExpeditionと視覚縦切りを統合。
5. 完了: `PH-V07-007`でボスと勝利条件を接続。
6. 完了: RC2までの`PH-V07-008`自動回帰、到達性、性能、preview準備。
7. 完了: 最終遠征RC3の敵順、Commander、ボス追跡、増援継続、広域射撃を再検証。
8. 完了: RC4の周回・回復・長時間稼ぎ欠陥を手動5ランから分類し、RC5の局所対策と自動回帰を実装。
9. 完了: RC5をproduction trafficなしでVersion Previewへ公開し、実URLsmokeを通過。
10. 残り: RC5 PreviewでPulse / Spread各1本以上を使い、制圧衝撃波、回復制御、速攻得点を手動採否。
11. 完了: `PH-V08-011`でResult / Secondary Menu / Choice Presenter、Passive DOM View、共有theme tokenを実装し、既存画像を維持。
12. 完了: `PH-V08-012`でproduction外の3案×5画面を比較し、A「戦術管制」を基礎採用、Tailwindをprototype限定、Lucideを将来のDOMコマンド限定候補とした。
13. 次段: `PH-V08-010`の世界観・素材判断と、`PH-V08-013`でPresenter境界を使う選択画面のproduction縦切りを進める。
14. その後: 端末内進行、ステージ選択、第1から第4の学習ステージを依存順に実装。

## production昇格判定

Version Previewからproductionへ進める条件です。

- Pulse / Spread各1本以上をデバッグhookと観戦AIなしで行い、両武器でボス第2段階へ到達する。
- 従来の中央周回を試し、回復供給だけで無期限に安定しないことを確認する。
- 制圧衝撃波を範囲外か遮蔽物で回避でき、完遂・速攻得点をリザルトで理解できる。
- 不可視、即死、操作不能、データ損失、再現する重大性能劣化がない。
- 予告、難度曲線、武器役割、再挑戦理由を所感とRunRecordの両方で説明できる。
- 必要な調整が出た場合は新しい候補commitとルール版で自動ゲートを再実行する。

手動ゲートを通過するまで、v0.8のゲームルールとproduction UIは変更しません。ゲームルールから独立した責務整理、theme token設計、比較prototypeは進められます。要件・判断はStarlight、作業状態はGitHub Issues / Projectsへ一本化し、Linearや独自管理ツールは追加しません。
