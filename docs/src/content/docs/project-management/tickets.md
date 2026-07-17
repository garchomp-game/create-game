---
title: チケット一覧
description: バージョン別のチケット番号、表示名、状態。
---

詳細な目的と完了条件は各バージョンの作業計画、担当と進捗はGitHub Issueを正本とします。

- v0.5の計画: [v0.5作業計画](../endless-polish-plan/)
- v0.5の詳細: [v0.5チケット詳細](../v05-tickets/)
- v0.5の進捗: [GitHubマイルストーン](https://github.com/garchomp-game/create-game/milestone/1)
- v0.6の計画: [直近フェーズ](../next-phase-plan/)
- v0.6の詳細: [v0.6チケット詳細](../v06-tickets/)
- v0.6の進捗: [GitHubマイルストーン](https://github.com/garchomp-game/create-game/milestone/2)
- 観戦AI実験の詳細: [観戦AIチケット詳細](../auto-pilot-tickets/)
- 観戦AI実験の進捗: [GitHubマイルストーン](https://github.com/garchomp-game/create-game/milestone/4)
- Phaser 4の計画: [Phaser 4移行計画](../phaser4-migration-plan/)
- 公開ベータ候補: [GitHubマイルストーン](https://github.com/garchomp-game/create-game/milestone/3)
- v0.7の体験要件: [v0.7 最初のエクスペディション](../../design/v07-first-expedition/)
- v0.7の実装計画: [v0.7 実行計画](../v07-execution-plan/)
- v0.7の進捗: [GitHubマイルストーン](https://github.com/garchomp-game/create-game/milestone/5)
- 横断管理: [Arena Core Roadmap](https://github.com/users/garchomp-game/projects/1)

## Phaserプレゼンテーション再設計

詳細な責務、依存方向、受け入れ条件は[Phaserプレゼンテーション再設計](../../engineering/phaser-presentation-architecture/)を参照してください。

| ID | チケット | 状態 |
| --- | --- | --- |
| `PH-ARCH-001` | 基準固定と依存監査 | 完了 |
| `PH-ARCH-002` | 純粋Presenterの抽出 | 完了 |
| `PH-ARCH-003` | RendererのComposite View化 | 完了 |
| `PH-ARCH-004` | Menu Controllerの抽出 | 完了 |
| `PH-ARCH-005` | [#54](https://github.com/garchomp-game/create-game/issues/54) SessionとRun Lifecycleの抽出 | 完了 |
| `PH-ARCH-006` | [#55](https://github.com/garchomp-game/create-game/issues/55) Debug / AI / Performanceの分離 | 完了 |
| `PH-ARCH-007` | [#42](https://github.com/garchomp-game/create-game/issues/42) グラフィック拡張の縦切り | 要件確定・未着手 |

## v0.3

| ID | チケット | 状態 |
| --- | --- | --- |
| `PH-V03-001` | 回復ピックアップ基盤 | 完了 |
| `PH-V03-002` | v0.3プレイテストとバランス確認 | 記録済み |
| `PH-V03-003` | 回復ピックアップ調整 | 追加調整なし |
| `PH-V03-004` | アイテム要件とデータモデル | 設計済み |
| `PH-V03-005` | 一時強化アイテム試作 | 後回し |
| `PH-V03-006` | ピックアップ演出とフィードバック | 後回し |
| `PH-V03-007` | バランス回帰テストへのアイテム指標追加 | 後回し |
| `PH-V03-009` | バンドルサイズ警告調査 | 後回し |
| `PH-V03-010` | v0.3安定版候補 | 候補準備済み |
| `PH-V03-011` | 画面外敵方向表示 | 完了 |

## v0.4

v0.4は2026-07-10に終了判断を行いました。延期した操作案はv0.5の未完了作業として数えません。

| ID | チケット | 状態 |
| --- | --- | --- |
| `PH-V04-001` | マウス照準時の自動射撃試作 | 完了。v0.5の既定操作として暫定採用 |
| `PH-V04-002` | 防御ダッシュのキー配置試作 | v0.6以降へ延期 |
| `PH-V04-003` | 右クリック固有スキルの入力分離 | アクティブスキル設計まで延期 |
| `PH-V04-004` | Spaceキーの防御行動設計 | v0.6以降へ延期。v0.5では手動射撃を維持 |
| `PH-V04-005` | 障害物配置と弾の壁接触見直し | 完了。中央障害物削除と跳弾基盤を追加 |
| `PH-V04-006` | リザルトとラン振り返り | 基礎完了。製品向け画面は`PH-V05-002`へ継続 |
| `PH-V04-007` | v0.4手動プレイ記録 | 完了。短時間、通常、長時間ランを記録 |
| `PH-V04-008` | ランシードのランダム化と持久圧力 | 完了 |

## v0.5

| ID | GitHub | チケット | 優先度 | 状態 |
| --- | --- | --- | --- | --- |
| `PH-V05-001` | [#1](https://github.com/garchomp-game/create-game/issues/1) | ラン記録スキーマと保存ポート | P0 | 完了 |
| `PH-V05-002` | [#2](https://github.com/garchomp-game/create-game/issues/2) | リザルト振り返りUI | P0 | 完了 |
| `PH-V05-003` | [#3](https://github.com/garchomp-game/create-game/issues/3) | ローカルランキングとラン履歴 | P0 | 完了 |
| `PH-V05-004` | [#4](https://github.com/garchomp-game/create-game/issues/4) | タイトルとモード選択の更新 | P1 | 完了 |
| `PH-V05-005` | [#5](https://github.com/garchomp-game/create-game/issues/5) | プレイ中HUDの視認性改善 | P1 | 完了 |
| `PH-V05-006` | [#6](https://github.com/garchomp-game/create-game/issues/6) | 演出フィードバック改善 | P1 | 完了 |
| `PH-V05-007` | [#7](https://github.com/garchomp-game/create-game/issues/7) | 音響素材の導入基盤 | P1 | 完了 |
| `PH-V05-008` | [#8](https://github.com/garchomp-game/create-game/issues/8) | 計測とログの整理 | P0 | 完了 |
| `PH-V05-009` | [#9](https://github.com/garchomp-game/create-game/issues/9) | ローカルプロフィール境界 | P0 | 完了 |
| `PH-V05-010` | [#10](https://github.com/garchomp-game/create-game/issues/10) | 設定とアクセシビリティ境界 | P0 | 完了 |
| `PH-V05-011` | [#11](https://github.com/garchomp-game/create-game/issues/11) | v0.5安定化と手動プレイ判定 | P0 | 完了 |

## v0.6 ビルドの個性とエンドレス後半

詳細な依存、対象外、受け入れ条件は[v0.6チケット詳細](../v06-tickets/)を参照してください。

| ID | GitHub | チケット | 優先度 | 状態 |
| --- | --- | --- | --- | --- |
| `PH-V06-001` | [#13](https://github.com/garchomp-game/create-game/issues/13) | XP曲線と強化選択間隔の再設計 | P0 | 実装・自動検証済み |
| `PH-V06-002` | [#14](https://github.com/garchomp-game/create-game/issues/14) | 開始武器選択の縦切り基盤 | P0 | 実装・自動検証済み |
| `PH-V06-003` | [#15](https://github.com/garchomp-game/create-game/issues/15) | 強化分類と効果合成 | P0 | 実装・自動検証済み |
| `PH-V06-004` | [#16](https://github.com/garchomp-game/create-game/issues/16) | 最初の武器最終強化試作 | P0 | 完了 |
| `PH-V06-005` | [#17](https://github.com/garchomp-game/create-game/issues/17) | 強化選択UIとビルド要約 | P1 | 実装・画面確認済み |
| `PH-V06-006` | [#18](https://github.com/garchomp-game/create-game/issues/18) | 予兆付き危険イベントと契約試作 | P1 | 完了 |
| `PH-V06-007` | [#19](https://github.com/garchomp-game/create-game/issues/19) | 用途別乱数列の分離 | P0 | 実装・自動検証済み |
| `PH-V06-008` | [#20](https://github.com/garchomp-game/create-game/issues/20) | ビルド多様性の計測と比較 | P0 | 完了 |
| `PH-V06-009` | [#12](https://github.com/garchomp-game/create-game/issues/12) | Phaser画面とデバッグ責務の分割 | P0 | 実装・回帰確認済み |
| `PH-V06-010` | [#21](https://github.com/garchomp-game/create-game/issues/21) | 弾・貫通・無敵時間ルールの監査 | P0 | 監査・固定配置試験済み |
| `PH-V06-011` | [#22](https://github.com/garchomp-game/create-game/issues/22) | v0.6統合プレイテストと採否判定 | P0 | 完了 |
| `PH-V06-012` | [#23](https://github.com/garchomp-game/create-game/issues/23) | EX進行と無制限脅威の実装 | P0 | 実装・自動検証済み |
| `PH-V06-013` | [#24](https://github.com/garchomp-game/create-game/issues/24) | v0.6.4長時間プレイ判定 | P0 | 完了。600秒観測はベータへ移管 |
| `PH-V06-014` | [#25](https://github.com/garchomp-game/create-game/issues/25) | 障害物対応の敵ナビゲーション | P0 | 実装・自動検証済み |
| `PH-V06-015` | [#26](https://github.com/garchomp-game/create-game/issues/26) | 循環型EXアップグレード | P0 | 実装・自動検証済み |
| `PH-V06-016` | [#27](https://github.com/garchomp-game/create-game/issues/27) | 武器固有成長と対称最終強化 | P0 | 実装・自動検証済み |
| `PH-V06-017` | [#28](https://github.com/garchomp-game/create-game/issues/28) | 高解像度選択UI | P1 | 実装・自動検証済み |
| `PH-V06-018` | [#29](https://github.com/garchomp-game/create-game/issues/29) | 敵役割別耐久と武器バランス | P0 | 実装・自動検証済み |
| `PH-V06-019` | [#30](https://github.com/garchomp-game/create-game/issues/30) | Pulse高速弾と外周反射 | P0 | 完了 |
| `PH-V06-020` | [#31](https://github.com/garchomp-game/create-game/issues/31) | 反響回路の成果帰属と実測性能ログ | P1 | 完了 |
| `PH-V06-021` | [#41](https://github.com/garchomp-game/create-game/issues/41) | Pulse精密射撃の長時間調整 | P0 | 完了。92728点手動ランで採用 |

## 観戦AI実験

`PH-AUTO-*`は`experiment/auto-pilot-observer`上の検証入力モデルです。v0.6を再オープンせず、公開ベータとv0.7の完了条件にも含めません。

| ID | GitHub | チケット | 優先度 | 状態 |
| --- | --- | --- | --- | --- |
| `PH-AUTO-001` | [#33](https://github.com/garchomp-game/create-game/issues/33) | 巡回モデル・比較スイッチ・基準計測 | P1 | 完了 |
| `PH-AUTO-002` | [#34](https://github.com/garchomp-game/create-game/issues/34) | 訪問履歴巡回のopt-in統合 | P1 | 完了・opt-in |
| `PH-AUTO-003` | [#35](https://github.com/garchomp-game/create-game/issues/35) | 凍結比較と採否判定 | P1 | 完了・既定採用見送り |

## 公開ベータ候補

| ID | GitHub | チケット | 優先度 | 状態 |
| --- | --- | --- | --- | --- |
| `PH-BETA-001` | [#32](https://github.com/garchomp-game/create-game/issues/32) | エンドレス公開ベータ準備 | P0 | 完了。v0.6.8公開済み |
| `PH-BETA-002` | [#37](https://github.com/garchomp-game/create-game/issues/37) | 長時間HUDの可変桁・重なり改善 | P1 | 完了 |
| `PH-BETA-003` | [#52](https://github.com/garchomp-game/create-game/issues/52) | 公開ルールと外周反射の採否固定 | P0 | 完了。外周反射を有効採用 |

## Phaser 4移行

| ID | GitHub | チケット | 優先度 | 状態 |
| --- | --- | --- | --- | --- |
| `PH-P4-001` | [#38](https://github.com/garchomp-game/create-game/issues/38) | Phaser 4互換監査と移行設計 | P0 | 完了 |
| `PH-P4-002` | [#39](https://github.com/garchomp-game/create-game/issues/39) | Phaser 4.2.1依存置換とWebGL移行 | P0 | 完了 |
| `PH-P4-003` | [#40](https://github.com/garchomp-game/create-game/issues/40) | Phaser 4 WebGL長時間耐久と公開ベータ再認証 | P1 | 完了 |

## v0.7 戦闘展開とステージ試作

詳細な対象外、依存順、検証方法は[v0.7 実行計画](../v07-execution-plan/)を参照してください。

| ID | GitHub | チケット | 優先度 | 状態 |
| --- | --- | --- | --- | --- |
| `PH-V07-001` | [#43](https://github.com/garchomp-game/create-game/issues/43) | ステージ定義とコンテンツ登録 | P0 | 完了 |
| `PH-V07-002` | [#56](https://github.com/garchomp-game/create-game/issues/56) | 戦闘展開カードと制御基盤 | P0 | 要件確定・未着手 |
| `PH-V07-003` | [#57](https://github.com/garchomp-game/create-game/issues/57) | 構造化出現と安全規則 | P0 | 要件確定・未着手 |
| `PH-V07-004` | [#53](https://github.com/garchomp-game/create-game/issues/53) | 指揮艦エリートと特性1件 | P1 | 要件確定・未着手 |
| `PH-V07-005` | [#50](https://github.com/garchomp-game/create-game/issues/50) | 予兆付き突進敵 | P1 | 要件確定・未着手 |
| `PH-V07-006` | [#48](https://github.com/garchomp-game/create-game/issues/48) | 最初のエクスペディション | P0 | 要件確定・未着手 |
| `PH-V07-007` | [#58](https://github.com/garchomp-game/create-game/issues/58) | 最初のボス戦 | P0 | 要件確定・未着手 |
| `PH-V07-008` | [#59](https://github.com/garchomp-game/create-game/issues/59) | 統合QAと採否判定 | P0 | 要件確定・未着手 |

## v0.8 チャレンジと熟練度

| ID | チケット |
| --- | --- |
| `PH-V08-001` | バージョン付きローカル保存と移行 |
| `PH-V08-002` | 解放条件の評価基盤 |
| `PH-V08-003` | チャレンジ定義と固定ルールセット |
| `PH-V08-004` | 武器熟練度と評価 |
| `PH-V08-005` | プロフィール統計と収集画面 |
| `PH-V08-006` | アカウント同期の要件判断 |

## v0.9 コンテンツ完成とリリース準備

| ID | チケット |
| --- | --- |
| `PH-V09-001` | 最小コンテンツ構成の完成 |
| `PH-V09-002` | 武器最終強化と強化候補の完成 |
| `PH-V09-003` | 第2ステージと戦闘展開デッキ |
| `PH-V09-004` | 危険度契約とチャレンジ一式 |
| `PH-V09-005` | 音響、演出、フィードバックの最終調整 |
| `PH-V09-006` | アクセシビリティと設定の最終調整 |
| `PH-V09-007` | 性能、バンドル、長時間動作確認 |
| `PH-V09-008` | 複数セッションのプレイテストとバランス確認 |

v0.5の全体計画は [v0.5作業計画](../endless-polish-plan/)、v0.6の個別要件は[v0.6チケット詳細](../v06-tickets/)、v0.7は[v0.7 実行計画](../v07-execution-plan/)、その先は [中長期作業計画](../gameplay-expansion-plan/) を参照してください。
