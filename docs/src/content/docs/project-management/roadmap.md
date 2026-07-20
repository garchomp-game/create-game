---
title: ロードマップ
description: v0.4からv1.0までの目的と主要チケット。
---

## v0.4 操作性とアリーナ基盤

状態: 2026-07-10終了判断済み。

目的:

- 操作負荷、障害物、弾と壁の関係を整える。
- 次フェーズへ進む前に、入力の役割とラン振り返りの土台を閉じる。

主要チケット:

- `PH-V04-001` マウス照準時の自動射撃試作。
- `PH-V04-002` 防御ダッシュのキー配置試作。
- `PH-V04-003` 右クリック固有スキルの入力分離。
- `PH-V04-004` Spaceキーの防御行動設計。
- `PH-V04-005` 障害物配置と弾の壁接触見直し。
- `PH-V04-006` リザルトとラン振り返り。
- `PH-V04-007` v0.4手動プレイ記録。
- `PH-V04-008` ランシードのランダム化と持久圧力。

## v0.5 エンドレスの磨き込みとラン記録

状態: 2026-07-11完了。機能実装、自動検証、15分耐久、手動3ラン、音響所感の反映を完了した。

目的:

- 現在のアリーナを主モードとして磨く。
- リザルト、ローカルランキング、履歴、タイトルの土台を作る。
- ステージやアカウント同期へ進む前に、ラン記録とプロフィール保存の境界を作る。

主要チケット:

- `PH-V05-001` ラン記録スキーマと保存ポート。
- `PH-V05-002` リザルト振り返りUI。
- `PH-V05-003` ローカルランキングとラン履歴。
- `PH-V05-004` タイトルとモード選択の更新。
- `PH-V05-005` プレイ中HUDの視認性改善。
- `PH-V05-006` 演出フィードバック改善。
- `PH-V05-007` 音響素材の導入基盤。
- `PH-V05-008` 計測とログの整理。
- `PH-V05-009` ローカルプロフィール境界。
- `PH-V05-010` 設定とアクセシビリティ境界。
- `PH-V05-011` v0.5安定化と手動プレイ判定。

終了条件:

- 通常ラン、固定シード、デバッグ、自動テストを区分して保存できる。
- 自己記録差、シード、ビルド、死因をリザルトで確認できる。
- ローカルランキング、履歴、設定が再読込後も残る。
- 3本以上の手動ランと15分以上の長時間確認を完了する。
- 未解決P0がなく、v0.6の比較基盤として利用できる。

## v0.6 ビルドの個性とエンドレス後半

状態: 2026-07-14完了。v0.6.4のPulse手動採否、v0.6.5の反射成果・性能計装、統合QAまで完了した。

目的:

- PulseとSpreadの開始武器選択からリザルト比較までを縦に接続する。
- 同じアリーナでも開始武器と強化方針で狙い方、位置取り、標的優先を変える。
- 指数的なXP必要量による後半の選択停滞を解消する。
- 既存敵を使った予兆付き危険イベントと、危険・報酬の選択を試す。
- 通常ビルド完成後にも成長判断を残し、熟練者でも有限時間で終了する後半構造を作る。

主要チケット:

- `PH-V06-001` XP曲線と強化選択間隔の再設計。
- `PH-V06-002` 開始武器選択の縦切り基盤。
- `PH-V06-003` 強化分類と効果合成。
- `PH-V06-004` 最初の武器最終強化試作。
- `PH-V06-005` 強化選択UIとビルド要約。
- `PH-V06-006` 予兆付き危険イベントと契約試作。
- `PH-V06-007` 用途別乱数列の分離。
- `PH-V06-008` ビルド多様性の計測と比較。
- [`PH-V06-009` #12](https://github.com/garchomp-game/create-game/issues/12) Phaser画面とデバッグ責務の分割。
- `PH-V06-010` 弾・貫通・無敵時間ルールの監査。
- `PH-V06-011` v0.6統合プレイテストと採否判定。
- `PH-V06-012` EX進行と無制限脅威の実装。
- `PH-V06-013` v0.6.4長時間プレイ判定。
- `PH-V06-014` 障害物対応の敵ナビゲーション。
- `PH-V06-015` 循環型EXアップグレード。
- `PH-V06-016` 武器固有成長と対称最終強化。
- `PH-V06-017` 高解像度選択UI。
- `PH-V06-018` 敵役割別耐久と武器バランス。
- `PH-V06-019` Pulse高速弾と外周反射。
- `PH-V06-020` 反響回路の成果帰属と実測性能ログ。

## 公開ベータ候補 エンドレス

状態: v0.6.8をCloudflareへ公開済み。外周反射、ルール版、公開情報、ブラウザ互換、production smokeを基準commit `ff686f992a65`で固定。

目的:

- 現行エンドレスをゲスト / ローカル保存の範囲で外部プレイ可能にする。
- v0.7のルール変更前に、実ブラウザ、長時間ラン、反射利用、操作不能、保存失敗の報告を集める。
- アカウント、オンラインランキング、ステージ進捗同期を先に抱え込まない。

主要チケット:

- [`PH-BETA-001` #32](https://github.com/garchomp-game/create-game/issues/32) エンドレス公開ベータ準備。
- [`PH-BETA-002` #37](https://github.com/garchomp-game/create-game/issues/37) 長時間HUDの可変桁・重なり改善。
- [`PH-BETA-003` #52](https://github.com/garchomp-game/create-game/issues/52) 公開ルールと外周反射の採否固定。
- [`PH-P4-001` #38](https://github.com/garchomp-game/create-game/issues/38) Phaser 4互換監査と移行設計。
- [`PH-P4-002` #39](https://github.com/garchomp-game/create-game/issues/39) Phaser 4.2.1依存置換とWebGL移行。
- [`PH-P4-003` #40](https://github.com/garchomp-game/create-game/issues/40) Phaser 4 WebGL長時間耐久と公開ベータ再認証。

停止条件:

- データ損失、通常操作での進行不能、再現性のある重大なフレーム劣化、公開物のライセンス不備がある。
- 武器間の小さな勝率差や600秒以降の追加所感だけでは、公開準備とv0.7設計を停止しない。

## v0.7 最終遠征プロトタイプ

状態: RC5の実装、全回帰、Version Preview公開まで完了。RC5は基準証跡として保持し、RC6でEncounter時計、記録scope、ruleset、有限回復候補を安定化してからproduction採否を行います。

目的:

- 高難度の勝利型ランへ、四方警戒、重装襲来、反撃、包囲突破、最終決戦の起伏を作る。
- 構造化した出現、HP 500の優先標的、予兆付き敵、追跡する最終ボスを1本のエクスペディションへ接続する。
- 敵を`赤 -> 大型黄 -> 小型黄緑 -> 紫`の順で導入し、後続の学習ステージ設計へ基準を残す。
- 既存EndlessとPulse / Spreadの役割を回帰させず、失敗理由を記録から説明できる状態にする。

主要チケット:

- [`PH-ARCH-005` #54](https://github.com/garchomp-game/create-game/issues/54) SessionとRun Lifecycleの抽出。
- [`PH-ARCH-006` #55](https://github.com/garchomp-game/create-game/issues/55) Debug / AI / Performanceの分離。
- [`PH-ARCH-007` #42](https://github.com/garchomp-game/create-game/issues/42) グラフィック拡張の縦切り。
- [`PH-V07-001` #43](https://github.com/garchomp-game/create-game/issues/43) ステージ定義とコンテンツ登録。
- [`PH-V07-002` #56](https://github.com/garchomp-game/create-game/issues/56) 戦闘展開カードと制御基盤。
- [`PH-V07-003` #57](https://github.com/garchomp-game/create-game/issues/57) 構造化出現と安全規則。
- [`PH-V07-004` #53](https://github.com/garchomp-game/create-game/issues/53) 指揮艦エリートと特性1件。
- [`PH-V07-005` #50](https://github.com/garchomp-game/create-game/issues/50) 予兆付き突進敵。
- [`PH-V07-006` #48](https://github.com/garchomp-game/create-game/issues/48) エクスペディション縦切り。
- [`PH-V07-007` #58](https://github.com/garchomp-game/create-game/issues/58) 指揮艦ボス戦。
- [`PH-V07-008` #59](https://github.com/garchomp-game/create-game/issues/59) 統合QAと採否判定。
- [`PH-V07-009` #63](https://github.com/garchomp-game/create-game/issues/63) 最終遠征RC5ボス終盤調整。完了しRC6へ継承。
- [`PH-V07-010` #73](https://github.com/garchomp-game/create-game/issues/73) Encounter時計とCommanderライフサイクル。
- [`PH-V07-011` #74](https://github.com/garchomp-game/create-game/issues/74) Expedition記録scopeとRC6 ruleset分離。
- [`PH-V07-012` #75](https://github.com/garchomp-game/create-game/issues/75) 最終決戦の有限回復予算を比較検証。

## v0.8 Core Promise Validation

目的:

- 危険を避けるだけでなく攻撃機会へ反転する、Arena Core固有の短い攻防を試す。
- スコアだけで見えない上達と武器固有の行動を記録し、次ランの目標へつなげる。
- 選択停止、最大密度の可読性、警告音を計測し、演出追加前の品質基準を作る。
- 初心者と経験者を分けた構造化プレイテストで採否する。

主要チケット:

- [`PH-V08-010` #66](https://github.com/garchomp-game/create-game/issues/66) 世界観と視覚テーマの決定。
- [`PH-V08-011` #68](https://github.com/garchomp-game/create-game/issues/68) UIプレゼンテーション境界とデザイントークン。
- [`PH-V08-012` #67](https://github.com/garchomp-game/create-game/issues/67) 比較可能なUI草案とライブラリ採否。
- [`PH-V08-013` #70](https://github.com/garchomp-game/create-game/issues/70) 採用UI縦切り: 選択画面。
- [`PH-V08-014` #76](https://github.com/garchomp-game/create-game/issues/76) 危険反転イベントの縦切り。
- [`PH-V08-015` #77](https://github.com/garchomp-game/create-game/issues/77) 技能shadow ledgerと成果フィードバック。
- [`PH-V08-016` #78](https://github.com/garchomp-game/create-game/issues/78) 強化選択の停止時間と頻度を計測する。
- [`PH-V08-017` #79](https://github.com/garchomp-game/create-game/issues/79) Pulse / Spreadの武器教義ブランチ。
- [`PH-V08-018` #80](https://github.com/garchomp-game/create-game/issues/80) 最大密度の視覚fixtureと警告音分離。
- [`PH-V08-019` #81](https://github.com/garchomp-game/create-game/issues/81) 初心者・経験者の構造化プレイテスト。
- [`PH-V08-020` #83](https://github.com/garchomp-game/create-game/issues/83) 緊張・緩和と難易度支援の設計契約。

## v0.9 3作戦キャンペーン検証

目的:

- Stage 1 / 5 / 10で、初回学習、複合判断、高難度最終試験を接続する。
- 欠番を許容する進行と選択基盤を作り、未実装stageを表示しない。
- 3本の採否と制作実績から、残り7本を実装する価値と見積もりを判断する。

主要チケット:

- [`PH-V09-001` #62](https://github.com/garchomp-game/create-game/issues/62) Stage 1 / 5 / 10進行と選択基盤。
- [`PH-V09-002` #64](https://github.com/garchomp-game/create-game/issues/64) Stage 1 基礎迎撃の学習縦切り。
- [`PH-V09-003` #65](https://github.com/garchomp-game/create-game/issues/65) Stage 5 四方包囲の複合判断縦切り。

旧10ステージ案のStage 2から4、6から9はdeferredです。3作戦の採否後に再計画します。

## v1.0 最初のローカル完成版

目的:

- エンドレス、エクスペディション、チャレンジ、ローカル進行を1つのゲームとして完結させる。
- 30分のプレイで複数のビルドやモードを試す理由を作る。

## 詳細資料

- [直近フェーズ](../next-phase-plan/)
- [v0.5作業計画](../endless-polish-plan/)
- [v0.5チケット詳細](../v05-tickets/)
- [v0.6チケット詳細](../v06-tickets/)
- [v0.7 最終遠征プロトタイプ](../../design/v07-first-expedition/)
- [v0.7 実行計画](../v07-execution-plan/)
- [v0.8 面白さの核の検証](../../design/core-promise-validation/)
- [v0.8 実行計画](../v08-execution-plan/)
- [UI・グラフィック再設計計画](../ui-visual-redesign-plan/)
- [中長期作業計画](../gameplay-expansion-plan/)
- [ゲームプレイ拡張設計](../../design/gameplay-expansion-blueprint/)
