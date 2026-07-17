---
title: v0.7 実行計画
description: 公開ベータの基準固定から最初のエクスペディション採否までの依存順とチケット詳細。
---

最終整理日: 2026-07-17

## ゴール

v0.7のゴールは、既存Endlessを壊さず、構造化した戦闘展開、指揮艦エリート、予兆付き敵、ボスを接続した8分から10分のエクスペディションを1本完成させることです。

体験要件は[v0.7 最初のエクスペディション](../../design/v07-first-expedition/)を正本とします。このページは実装順、技術境界、検証ゲートを定義します。

GitHub上の進捗は[Arena Core Roadmap](https://github.com/users/garchomp-game/projects/1)と[v0.7 Milestone](https://github.com/garchomp-game/create-game/milestone/5)を参照してください。

## 現在地

- v0.6.8公開ベータ、Phaser 4.2.1 WebGL、Cloudflare Workers Static Assetsでproduction配信まで完了しています。
- `PH-BETA-003`は外周反射の有効採用、ルール版分離、公開情報、production証跡まで完了しました。
- ルール版は`phaser-v0.6.8-pulse-boundary-ricochet`で、旧ランキング比較条件と分離します。
- 公開基準はcommit `ff686f992a65`、Cloudflare Version ID `e86f90b8-ea15-4d1d-b01b-59e4f9fea78e`です。
- `PhaserArenaRenderer`の分割とMenu Controller抽出は完了しています。
- `PH-ARCH-005`と`006`は完了しました。run config、seed、乱数列、world、記録、debug、AI、performanceを単一所有者へ移し、`ArenaScene`は629行の調停中心となりました。
- 公開基準は`experiment/auto-pilot-observer`へcommit・push済みです。v0.7実装はレビュー可能な別ブランチへ分け、既存の検証資料を破棄しません。

## 入口ゲート

### Gate 0: 公開ルールを固定する

状態: 2026-07-17完了。

v0.7のルール変更と公開ベータの記録を混ぜないため、次を完了しました。

- 外周反射はPulse固有の地形判断として有効採用する。
- 設定、説明、`RULESET_VERSION`、ランキング比較条件を一致させる。
- production buildをCloudflareへ配信し、公開URLでsmoke testする。
- `appVersion`、`rulesetVersion`、`buildCommit`を確認可能にする。
- 保存、履歴消去、ライセンス、プライバシー、フィードバック手順を確認する。
- 基準コミットとデプロイVersion IDを記録し、`PH-BETA-001`を閉じる。

データ損失、通常操作での進行不能、重大な性能劣化、ライセンス不備があればv0.7実装を止めます。小さな武器差や600秒以降の追加所感は停止条件にしません。

### Gate 1: 実装ブランチを分ける

- 公開ベータ基準を`main`または明示したrelease branchへ置く。
- 観戦AIのopt-in実験とv0.7の製品変更を同じ比較結果へ混ぜない。
- v0.7は公開ベータ基準から新しい作業ブランチを作る。
- 1 Issueを独立してレビュー、テスト、差し戻しできる変更量へ保つ。

## 技術方針

### 境界

- `simulation`: Act、Encounter Director、出現安全、敵・ボス状態を純粋ロジックとして所有する。
- `content`: Mode、Stage、Encounter Card、Enemy、Bossの定義と登録を所有する。
- `application`: session開始・終了、ラン記録確定、メニュー操作を調停する。
- `presentation`: worldとUI状態からAct、目的、警告、ボス表示のViewModelを作る。
- `adapters/phaser`: 入力、描画、音響、DOM overlay、debug bridgeを接続する。

Stage ID、Encounter ID、Boss IDごとの分岐を`ArenaScene`へ増やしません。コンテンツ定義からPhaserへ依存せず、描画から戦闘ルールを変更しません。

### 先行リファクタリング

全面的なDDD化やフォルダー移動は行いません。v0.7で実際に変更する所有権だけを先に分離します。

| ID | 目的 | v0.7との関係 |
| --- | --- | --- |
| `PH-ARCH-005` | SessionとRun LifecycleをSceneから抽出 | mode / stage / clear結果の所有者を先に固定する |
| `PH-ARCH-006` | Debug / AI / PerformanceをSceneから抽出 | 新fixtureと計測をSceneへ積み増さない |
| `PH-ARCH-007` | 背景1、敵1、イベント1の視覚縦切り | ルール変更と見た目変更を分離して性能を測る |

`PH-ARCH-005`はStageとExpedition統合の前提です。`PH-ARCH-006`はデータ定義の作成と並行可能ですが、統合QA前に完了させます。

## チケット構成

### [PH-BETA-003: 公開ルールと外周反射の採否固定](https://github.com/garchomp-game/create-game/issues/52)

成果物:

- 外周反射あり / なしの最小比較と手動採否。
- 採用値と表示、ルール版、ランキング比較キーの一致。
- 公開ベータ基準コミットの候補。

完了条件:

- 同じ公開ビルド内で設定とルール版が矛盾しない。
- 過去記録と新記録を比較不能な条件で混ぜない。
- 採否理由を武器役割と手動所感から一文で説明できる。

### [PH-ARCH-005: SessionとRun Lifecycleの抽出](https://github.com/garchomp-game/create-game/issues/54)

状態: 2026-07-17完了。

成果物:

- `ArenaSession`と`RunLifecycleController`。
- run config、seed、random streams、world、記録確定の単一所有者。
- 同一シード・入力列の終了snapshot契約試験。

完了条件:

- `RULESET_VERSION`、乱数消費順、スコア、保存結果を変更しない。
- Sceneにsessionのmirror stateを残さない。
- ゲームオーバー1回につき記録確定が1回だけ行われる。

### [PH-ARCH-006: Debug / AI / Performanceの分離](https://github.com/garchomp-game/create-game/issues/55)

状態: 2026-07-17完了。

成果物:

- `ArenaDebugController`、`AutoPilotController`、`PerformanceMonitor`。
- debug hook、soak protection、入力合成、raw frame計測の委譲。

完了条件:

- 公開ビルドへdebug hookとfixtureを含めない。
- 既存のAI、debug fixture、15分耐久契約を維持する。
- Sceneはlifecycle、入力収集、調停、描画呼び出しを中心とする。

### [PH-V07-001: ステージ定義とコンテンツ登録](https://github.com/garchomp-game/create-game/issues/43)

状態: 2026-07-17完了。

成果物:

- Phaser非依存のMode / Stage定義とregistry。
- `arena-default`のデータ移行。
- 設定検証と不正参照テスト。

完了条件:

- Endlessがregistry経由で同じ挙動を再現する。
- mode、stage、seed、rulesetをラン記録で識別できる。
- Sceneにstage ID分岐を追加しない。

### [PH-V07-002: 戦闘展開カードとDirector](https://github.com/garchomp-game/create-game/issues/56)

成果物:

- Encounter Card定義、Act進行、Director状態。
- 予告、実行、回復、成功、失敗、中断のライフサイクル。
- 決定論的な抽選と重複抑制。

完了条件:

- 同じseedと状態から同じカード列を得る。
- 表示、音、ログが乱数を消費しない。
- Endlessの現行イベント列を回帰させないか、明示した互換adapterで維持する。

### [PH-V07-003: 構造化出現と安全規則](https://github.com/garchomp-game/create-game/issues/57)

成果物:

- 弧、挟撃、護衛編成のうち3形状。
- 出現候補生成、安全判定、fallback、延期。
- 侵入方向の予告データ。

完了条件:

- 障害物内、到達不能領域、最低距離違反へ出現しない。
- 不可避包囲を固定fixtureで作らない。
- 最大密度でも既存個体上限を超えない。

### [PH-V07-004: 指揮艦エリートと特性1件](https://github.com/garchomp-game/create-game/issues/53)

成果物:

- 優先撃破対象となる指揮艦エリート。
- 増援、周辺防御、射撃支援から1特性。
- 出現、支援、撃破、圧力低下の表示と計測。

完了条件:

- 単なるHP増加ではなく、先に倒す理由がある。
- 撃破前後の圧力差を固定fixtureとラン指標で確認できる。
- PulseとSpreadに異なる処理方法があるが、片方を封じない。

### [PH-V07-005: 予兆付き突進敵](https://github.com/garchomp-game/create-game/issues/50)

成果物:

- 予告、準備、突進、回復の状態機械。
- 障害物、画面外、複数同時発生の安全規則。
- 攻撃別被弾と回避の計測。

完了条件:

- 色と線または音の2系統以上で進路を予告する。
- 固定fixtureで両武器が無被弾回避できる。
- 外した後に短い反撃機会がある。

### [PH-V07-006: 最初のエクスペディション](https://github.com/garchomp-game/create-game/issues/48)

成果物:

- `expedition`の選択、Act進行、目的、勝利 / 敗北。
- mode / stage別の履歴、リザルト、比較条件。
- 3枚以上のカードを使う最初の時系列。

完了条件:

- タイトルから開始、プレイ、勝利または敗北、再挑戦まで通る。
- 既存Endlessを2操作以内で開始できる。
- 意味のある局面の最長空白が120秒を超えない。
- 勝敗、到達Act、クリア時間を記録できる。

### [PH-ARCH-007: グラフィック拡張の縦切り](https://github.com/garchomp-game/create-game/issues/42)

成果物:

- 艦隊防衛シミュレーション候補に沿う背景1種。
- 指揮艦または突進敵1種の輪郭・コア表現。
- 戦闘展開1種の予告とAct変化演出。

完了条件:

- 弾、敵弾、XP、危険予告の識別を損なわない。
- 静的背景、動的world、feedbackの負荷を分けて計測する。
- 960 x 540と縦viewportでHUDや警告が重ならない。

### [PH-V07-007: 最初のボス戦](https://github.com/garchomp-game/create-game/issues/58)

成果物:

- 2種以上の攻撃、段階変化、回復時間を持つ指揮艦ボス。
- ボスHP、攻撃予告、段階変化、撃破演出。
- 攻撃別の被弾、撃破、残HP計測。

完了条件:

- 両武器で全攻撃を回避可能な固定fixtureがある。
- Pulseの優先射線とSpreadの複数処理の両方に役割がある。
- ボス撃破でExpeditionが一度だけ完了する。
- 画面外の不可視攻撃と長時間の無敵待ちがない。

### [PH-V07-008: 統合QAと採否判定](https://github.com/garchomp-game/create-game/issues/59)

成果物:

- 単体、simulation、E2E、画像比較、production build、耐久確認。
- Pulse / Spread各3本以上の手動ラン記録。
- 採用、調整、削除、v0.8へ進む判断。

完了条件:

- 重大 / 高の既知不具合がない。
- 両武器でボスへ到達し、少なくとも一方でクリアできる。
- 同一seed / input hash、保存移行、Endless回帰、WebGL非空を確認する。
- 最長展開空白、カード別被弾、ボス攻撃別被弾、フレーム性能を記録する。

## 依存順

```text
PH-BETA-003 -> PH-BETA-001完了 -> 公開ベータ基準コミット
                                      |
                                      v
                              PH-ARCH-005
                               /         \
                              v           v
                       PH-V07-001    PH-V07-002 -> PH-V07-003
                              \           |          /     \
                               \          v         v       v
                                +---- PH-V07-006  004     005
                                          |          \     /
                                          v           v   v
                                      PH-ARCH-007  PH-V07-007
                                             \       /
                                              v     v
                                            PH-V07-008

PH-ARCH-006: PH-ARCH-005後に開始し、PH-V07-008前までに完了
```

## 実行Wave

| Wave | 内容 | 終了判定 |
| --- | --- | --- |
| 0 | 公開ルール、基準コミット、公開ベータ | 完了。比較可能なproduction URLと証跡を固定 |
| 1 | `PH-ARCH-005`、`006` | Endlessの同一hashと全回帰が通る |
| 2 | `PH-V07-001`、`002` | data-driven stageと決定論的card列が純粋試験で成立 |
| 3 | `PH-V07-003`、`004`、`005` | 構造化出現、優先標的、予兆回避をfixtureで確認 |
| 4 | `PH-V07-006`、`PH-ARCH-007` | ボス前までのExpeditionを開始からリザルトまで通す |
| 5 | `PH-V07-007` | 両武器で可避なボスと勝利条件が成立 |
| 6 | `PH-V07-008` | 自動回帰、手動採否、性能、文書更新を完了 |

同じWave内でも、共有ファイルを大きく触るIssueは同時実装しません。`ArenaScene`、`domain/types.ts`、`RunRecord` schemaを触る変更は順番に統合します。

## Definition of Ready

実装Issueへ着手する前に、次がIssue本文へ揃っていることを確認します。

- プレイヤー体験として解く問題。
- 対象範囲と対象外。
- 変更する所有者と依存方向。
- 固定fixtureまたはseedによる再現方法。
- ラン記録へ追加する指標。
- 自動受け入れ条件と手動採否条件。
- 既存Endlessへ対する回帰範囲。
- 失敗時に機能を無効化または差し戻す境界。

これらが不足するIssueは`Todo`へ入れても実装開始しません。

## Definition of Done

- 要件と対象外を満たし、Issue本文のチェック項目が閉じている。
- `npm test`、`npm run build`、対象E2E、画像比較が通る。
- ゲームルール変更時は`RULESET_VERSION`と比較キーを更新する。
- schema変更時は旧記録の読込と破損時fallbackを確認する。
- 新しいイベントは固定fixture、ログ、ラン要約から再現できる。
- UI変更は960 x 540、横長、縦viewportで重なりを確認する。
- 採否に必要な手動ランを記録する。
- Starlightの現在地、チケット、意思決定、リスクを更新する。

## 検証マトリクス

| 変更 | Unit / simulation | E2E | 画像 | 手動 | 耐久 |
| --- | --- | --- | --- | --- | --- |
| architecture | 同一hash、所有権、保存一回性 | 全主要フロー | 既存全基準 | smoke | 必要 |
| stage / card | schema、抽選、状態遷移 | 開始からAct遷移 | 警告、Act | seed比較 | 短時間 |
| spawn / enemy | 安全候補、TTC、状態機械 | fixture | 最大密度 | 回避所感 | 高密度 |
| expedition | 勝敗、記録、比較キー | end-to-end | HUD、result | 各武器 | 10分 |
| boss | 攻撃、段階、完了一回性 | 全攻撃fixture | HP、予告、撃破 | 各武器 | ボス密度 |
| graphics | ルールhash不変 | WebGL非空 | desktop / portrait | 視認性 | p95比較 |

## 停止条件

- Endlessの同一seed / input hashまたは保存互換が説明なく変わる。
- 予告を見ても回避不能な出現またはボス攻撃が再現する。
- Sceneへmode / stage / encounterごとの分岐が増え続ける。
- 同一seedのカード列や出現位置が実行ごとに変わる。
- 新UIがHP、XP、強化選択、危険予告を隠す。
- 高密度時のAIを除くゲームフレーム性能が現行基準から大きく悪化する。
- 片方の武器だけが構造上ボスへ到達または攻撃できない。

停止条件に触れた場合はコンテンツを増やさず、原因となるWaveへ戻します。

## v0.8へ送るもの

- 第2ステージと追加ボス。
- チャレンジ、熟練度、解放条件、収集画面。
- 技量ボーナスをランキングへ入れる判断。
- アカウント、クラウド同期、オンラインランキングの要件判断。
- 装備、アイテム、3つ目の武器。
- 人物、会話、ランをまたぐ物語。
