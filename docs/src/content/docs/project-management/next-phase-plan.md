---
title: 直近フェーズ
description: 公開ベータを固定し、v0.7最初のエクスペディションへ進むための現在の判断。
---

最終整理日: 2026-07-17

## 現在の判断

v0.6.8候補はPhaser 4.2.1 WebGL移行、可変桁HUD、production 15分耐久、外周反射の公開採否、版情報、ベータ情報まで完了しています。ゲームプレイ側ではPulseとSpread、通常25ランク、循環EX、3種の危険イベント、240秒の契約、600秒以降のアリーナ崩壊まで成立しました。

次の製品ゴールは、同じエンドレスへ数値や敵を増やすことではありません。構造化した出現、優先標的、予兆付き敵、ボスを接続し、開始から勝利までのドラマを持つ最初のエクスペディションを1本完成させます。

- 体験要件: [v0.7 最初のエクスペディション](../../design/v07-first-expedition/)
- 実装順と受け入れ条件: [v0.7 実行計画](../v07-execution-plan/)
- 中長期の範囲: [中長期作業計画](../gameplay-expansion-plan/)
- 現在の実装: [現在地](../../game/current-state/)

## 今すぐ実装へ入らない理由

公開ベータの残作業は、次の2点です。

1. v0.6.8候補をcommitし、そのSHAでproduction buildとCloudflare公開URLを検証します。
2. 現在の作業ブランチ`experiment/auto-pilot-observer`の既存変更を破棄せず、公開ベータ基準とv0.7作業ブランチを分けます。

この2点を曖昧にしたままステージやボスを追加すると、どのルールで得た記録か、どの変更が回帰原因かを追えなくなります。

## 入口ゲート

### 1. 公開ルール固定

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

1. `PH-BETA-003`で公開ルールと外周反射を固定する。
2. `PH-BETA-001`をproduction smokeと文書確認で閉じる。
3. `PH-ARCH-005`、`006`でv0.7が触る所有権を分ける。
4. `PH-V07-001`から`003`でStage、Encounter、出現安全を作る。
5. `PH-V07-004`、`005`で優先標的と予兆回避を試す。
6. `PH-V07-006`でボス前までのExpeditionを縦に通す。
7. `PH-ARCH-007`で視覚縦切りを載せる。
8. `PH-V07-007`でボスと勝利条件を接続する。
9. `PH-V07-008`で両武器の手動採否、回帰、性能を確認する。

## 着手可能判定

次のIssueに対し、自律的な実装へ進める状態とみなす条件です。

- GitHub Project、v0.7 Milestone、Issue、優先度、依存順が作成済み。
- 各Issueに目的、対象外、受け入れ条件、固定再現、計測、回帰範囲がある。
- Starlightの体験要件とGitHub Issueが同じチケットIDで対応する。
- 公開ベータ基準コミットが固定されるまで、v0.7のルール変更を開始しない。
- 現在の未コミット変更をユーザー確認なしで破棄しない。

前準備完了後の最初の実装候補は[`PH-BETA-003` #52](https://github.com/garchomp-game/create-game/issues/52)です。外周反射が既に採否済みなら、その記録を残して[`PH-BETA-001` #32](https://github.com/garchomp-game/create-game/issues/32)の完了確認へ進みます。
