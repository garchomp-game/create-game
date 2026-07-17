---
title: 直近フェーズ
description: v0.7技術previewを手動採否し、production昇格とv0.8着手を判断する現在の計画。
---

最終整理日: 2026-07-17

## 現在の判断

v0.6.8公開ベータはcommit `ff686f992a65`、Cloudflare Version ID `e86f90b8-ea15-4d1d-b01b-59e4f9fea78e`としてproductionへ固定しています。v0.7では責務分離、Stage / Encounter基盤、構造化出現、Commander、Charger、5 ActのExpedition、2攻撃・2段階の指揮艦ボスまで実装しました。

候補版`0.7.0` / `phaser-v0.7.0-first-expedition`は自動QAを通過し、技術previewとして採用しました。次の作業は新機能ではなく、Version PreviewでPulse / Spread各3本を人間がプレイし、production昇格とv0.8着手を判断することです。

- 体験要件: [v0.7 最初のエクスペディション](../../design/v07-first-expedition/)
- 実装順と受け入れ条件: [v0.7 実行計画](../v07-execution-plan/)
- 中長期の範囲: [中長期作業計画](../gameplay-expansion-plan/)
- 現在の実装: [現在地](../../game/current-state/)
- QA結果と手動項目: [v0.7 統合QAレポート](../../playtest/v07-qa-report/)

## 現在の移行点

productionはv0.6.8のまま維持します。v0.7はCloudflare Version Previewだけへ公開し、手動採否が終わるまで`wrangler deploy`やtraffic昇格を行いません。保存比較は新しいルール版へ分かれるため、旧履歴を残してもランキングへ混ざりません。

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

- 8分から10分のExpedition 1本。
- 既存アリーナをデータ化したStage 1件。
- Encounter Card 3枚以上と構造化出現3形状。
- 指揮艦エリート1種、予兆付き突進敵1種。
- 2攻撃以上と段階変化を持つボス1体。
- Act、目的、ボスHP、勝敗を伝えるUI。
- 背景1、敵またはボス1、危険イベント1の視覚縦切り。
- mode / stage / encounter / boss / 勝敗を追えるラン記録。

第2ステージ、アカウント、オンラインランキング、恒久強化、3つ目の武器、長編ストーリーは対象外です。

## 実行順

1. 完了: `PH-ARCH-005`、`006`で所有権を分離。
2. 完了: `PH-V07-001`から`003`でStage、Encounter、出現安全を実装。
3. 完了: `PH-V07-004`、`005`で優先標的と予兆回避を実装。
4. 完了: `PH-V07-006`、`PH-ARCH-007`でExpeditionと視覚縦切りを統合。
5. 完了: `PH-V07-007`でボスと勝利条件を接続。
6. 完了: `PH-V07-008`の自動回帰、到達性、性能、preview準備。
7. 残り: Pulse / Spread各3本の手動採否とproduction昇格判断。

## production昇格判定

Version Previewからproductionへ進める条件です。

- Pulse / Spread各3本をデバッグhookと観戦AIなしで完了する。
- 両武器がボスへ到達し、少なくとも一方で勝利する。
- 不可視、即死、操作不能、データ損失、再現する重大性能劣化がない。
- 予告、難度曲線、武器役割、再挑戦理由を所感とRunRecordの両方で説明できる。
- 必要な調整が出た場合は新しい候補commitとルール版で自動ゲートを再実行する。

手動ゲートを通過するまで、v0.8のチャレンジ、熟練度、アカウント要件へ実装着手しません。
