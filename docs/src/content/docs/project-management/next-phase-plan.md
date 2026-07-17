---
title: 直近フェーズ
description: v0.7最終遠征RC3を検証し、10ステージ展開へ進む条件を判断する現在の計画。
---

最終整理日: 2026-07-17

## 現在の判断

v0.6.8公開ベータはcommit `ff686f992a65`、Cloudflare Version ID `e86f90b8-ea15-4d1d-b01b-59e4f9fea78e`としてproductionへ固定しています。v0.7では責務分離、Stage / Encounter基盤、構造化出現、Commander、Charger、5 ActのExpedition、2攻撃・2段階の指揮艦ボスまで実装しました。

RC1とRC2の手動所感から、道中に対してボスが易しい難度逆転と、初心者向け学習ステージとしては道中が難しすぎることが分かりました。現行縦切りを第10ステージへ再分類し、候補版を`0.7.0` / `phaser-v0.7.0-final-expedition-rc3`へ更新しています。

RC3は敵を`赤 -> 大型黄 -> 小型黄緑 -> 紫`の順で解禁し、大型黄をHP 8、CommanderをHP 500にします。最終ボスはプレイヤーを追跡し、通常ウェーブを止めず、広域射撃と挟撃増援を続けます。全回帰とVersion Preview更新は完了し、次の作業はPulse / Spread各3本の手動採否です。

- 体験要件: [v0.7 最終遠征プロトタイプ](../../design/v07-first-expedition/)
- 実装順と受け入れ条件: [v0.7 実行計画](../v07-execution-plan/)
- 中長期の範囲: [中長期作業計画](../gameplay-expansion-plan/)
- 現在の実装: [現在地](../../game/current-state/)
- QA結果と手動項目: [v0.7 統合QAレポート](../../playtest/v07-qa-report/)
- 複数ステージへの展開: [エクスペディション10ステージ設計](../../design/expedition-campaign/)

## 現在の移行点

productionはv0.6.8のまま維持します。v0.7はCloudflare Version Previewだけへ公開し、手動採否が終わるまで`wrangler deploy`やtraffic昇格を行いません。保存比較は新しいルール版へ分かれるため、旧履歴を残してもランキングへ混ざりません。

- RC3 Preview: `https://v07-final-expedition-arena-core.garchomp-game.workers.dev`
- commit: `7fc7a67953b7`
- Cloudflare Version: `0a4ebb54-f788-485c-96ee-3828377be5aa`
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
7. 完了: 最終遠征RC3の敵順、Commander、ボス追跡、増援継続、広域射撃を再検証し、Version Previewへ公開。
8. 残り: RC3 Version PreviewでPulse / Spread各3本の手動採否。
9. 次段: 端末内進行、ステージ選択、第1から第4の学習ステージを依存順に実装。

## production昇格判定

Version Previewからproductionへ進める条件です。

- Pulse / Spread各3本をデバッグhookと観戦AIなしで完了する。
- 両武器がボスへ到達し、少なくとも一方で勝利する。
- 不可視、即死、操作不能、データ損失、再現する重大性能劣化がない。
- 予告、難度曲線、武器役割、再挑戦理由を所感とRunRecordの両方で説明できる。
- 必要な調整が出た場合は新しい候補commitとルール版で自動ゲートを再実行する。

手動ゲートを通過するまで、v0.8のチャレンジ、熟練度、アカウント要件へ実装着手しません。
