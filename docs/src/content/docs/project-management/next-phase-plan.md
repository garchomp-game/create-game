---
title: 直近フェーズ
description: 公開ベータを固定し、v0.7最初のエクスペディションへ進むための現在の判断。
---

最終整理日: 2026-07-17

## 現在の判断

v0.6.8公開ベータはPhaser 4.2.1 WebGL移行、可変桁HUD、production 15分耐久、外周反射の公開採否、版情報、ベータ情報、Cloudflare配信まで完了しています。公開基準はcommit `ff686f992a65`、Cloudflare Version ID `e86f90b8-ea15-4d1d-b01b-59e4f9fea78e`です。ゲームプレイ側ではPulseとSpread、通常25ランク、循環EX、3種の危険イベント、240秒の契約、600秒以降のアリーナ崩壊まで成立しました。

次の製品ゴールは、同じエンドレスへ数値や敵を増やすことではありません。構造化した出現、優先標的、予兆付き敵、ボスを接続し、開始から勝利までのドラマを持つ最初のエクスペディションを1本完成させます。

- 体験要件: [v0.7 最初のエクスペディション](../../design/v07-first-expedition/)
- 実装順と受け入れ条件: [v0.7 実行計画](../v07-execution-plan/)
- 中長期の範囲: [中長期作業計画](../gameplay-expansion-plan/)
- 現在の実装: [現在地](../../game/current-state/)

## 現在の移行点

公開ベータの実装、基準commit、production build、Cloudflare公開URL、通常UIスモークは固定済みです。ここからは公開ベータへの軽微な修正とv0.7のルール変更を同じブランチ・ルール版へ混ぜません。

最初に`PH-ARCH-005`と`006`で、v0.7が実際に触る所有権だけを分離します。その後、StageとEncounterのデータ境界から実装を始めます。

## 入口ゲート

### 1. 公開ルール固定

状態: 2026-07-17完了。

- 外周反射をPulse固有の地形判断として有効採用する。
- `RULESET_VERSION`を`phaser-v0.6.8-pulse-boundary-ricochet`へ更新する。
- 過去ランキングと比較不能な記録を混ぜない。
- production build、公開URL、保存、ライセンス、プライバシー、フィードバック導線を確認する。
- 基準コミットとCloudflare Version IDを記録する。

### 2. 責務分離

- `PH-ARCH-005`でSessionとRun LifecycleをSceneから分ける。
- `PH-ARCH-006`でDebug、AI、PerformanceをSceneから分ける。
- 同一seed / inputのworldとresult hash、保存結果、既存E2Eを維持する。

`PH-ARCH-005`はmode、stage、clear resultの所有者を固定するため、v0.7統合前に必要です。全面リファクタリングは行いません。

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

1. `PH-ARCH-005`、`006`でv0.7が触る所有権を分ける。
2. `PH-V07-001`から`003`でStage、Encounter、出現安全を作る。
3. `PH-V07-004`、`005`で優先標的と予兆回避を試す。
4. `PH-V07-006`でボス前までのExpeditionを縦に通す。
5. `PH-ARCH-007`で視覚縦切りを載せる。
6. `PH-V07-007`でボスと勝利条件を接続する。
7. `PH-V07-008`で両武器の手動採否、回帰、性能を確認する。

## 着手可能判定

次のIssueに対し、自律的な実装へ進める状態とみなす条件です。

- GitHub Project、v0.7 Milestone、Issue、優先度、依存順が作成済み。
- 各Issueに目的、対象外、受け入れ条件、固定再現、計測、回帰範囲がある。
- Starlightの体験要件とGitHub Issueが同じチケットIDで対応する。
- 公開ベータ基準commit `ff686f992a65`から分岐し、v0.7のルール変更を公開版へ直接積まない。
- 現在の未コミット変更をユーザー確認なしで破棄しない。

Wave 0は完了しました。次の実装候補は[`PH-ARCH-005` #54](https://github.com/garchomp-game/create-game/issues/54)です。SessionとRun Lifecycleの抽出後、[`PH-ARCH-006` #55](https://github.com/garchomp-game/create-game/issues/55)とStage / Encounter基盤へ進みます。
