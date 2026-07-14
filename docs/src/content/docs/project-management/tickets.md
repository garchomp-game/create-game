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
- 公開ベータ候補: [GitHubマイルストーン](https://github.com/garchomp-game/create-game/milestone/3)

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

## 公開ベータ候補

| ID | GitHub | チケット | 優先度 | 状態 |
| --- | --- | --- | --- | --- |
| `PH-BETA-001` | [#32](https://github.com/garchomp-game/create-game/issues/32) | エンドレス公開ベータ準備 | P0 | 着手可能 |

## v0.7 戦闘展開とステージ試作

| ID | チケット |
| --- | --- |
| `PH-V07-001` | ステージ定義とコンテンツ登録 |
| `PH-V07-002` | 戦闘展開カードと制御基盤 |
| `PH-V07-003` | 構造化出現と安全規則 |
| `PH-V07-004` | エリート特性試作 |
| `PH-V07-005` | 予兆付き突進敵試作 |
| `PH-V07-006` | 最初のエクスペディション |
| `PH-V07-007` | 最初のボス戦試作 |
| `PH-V07-008` | 戦闘展開とステージの品質確認 |

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

v0.5の全体計画は [v0.5作業計画](../endless-polish-plan/)、v0.6の個別要件は[v0.6チケット詳細](../v06-tickets/)、v0.6以降のつながりは [中長期作業計画](../gameplay-expansion-plan/) を参照してください。
