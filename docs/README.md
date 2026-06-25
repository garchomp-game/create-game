# Arena Core 比較実験ドキュメント

## 目的

ブラウザで動作するゲームライブラリ及びゲームエンジンを、同一テーマの小規模ゲーム実装を通して比較する。

比較対象は、単なる機能一覧ではなく、AIが実際に実装する時の作りやすさ、迷いやすさ、修正しやすさ、完成形の安定性を評価する。

## 共通テーマ

テーマは `Arena Core` とする。

`Arena Core` は、1画面の見下ろし型アリーナ・サバイバルゲームである。プレイヤーはアリーナ内を移動し、接近してくる敵を射撃で倒しながら、できるだけ長く生存する。

このテーマを選ぶ理由は以下の通り。

- 2Dライブラリでも3Dエンジンでも同じゲーム構造に寄せやすい
- 入力、ゲームループ、当たり判定、スポーン、UI、状態管理を一通り比較できる
- アセット依存が低く、図形描画だけでも成立する
- 実装規模が大きすぎず、各ライブラリの使い勝手の差が出やすい

## 対象プロジェクト

1つのエージェントが、以下のプロジェクトフォルダを順番に実装する。

単一エージェントで連続実装することで、前の実装から得た知見を次へ持ち越しつつ、ライブラリごとの差分を同じ文脈で比較する。

| 順番 | フォルダ | 想定ライブラリ/エンジン | 位置づけ |
| ---: | --- | --- | --- |
| 1 | `phaser` | Phaser | 2Dゲームフレームワーク代表 |
| 2 | `excalibur` | Excalibur.js | TypeScript 2Dゲームエンジン |
| 3 | `kaplay` | KAPLAY | 軽量JS/TSゲームライブラリ |
| 4 | `kontra` | Kontra.js | 軽量Canvasゲームライブラリ |
| 5 | `melonjs` | melonJS | HTML5 2Dゲームエンジン |
| 6 | `pixijs-matter` | PixiJS + Matter.js | 2D描画ライブラリ + 2D物理 |
| 7 | `threejs-rapier` | Three.js + Rapier | 3D描画ライブラリ + 物理 |
| 8 | `babylonjs` | Babylon.js | 3Dゲームエンジン |
| 9 | `playcanvas` | PlayCanvas | Web向け3Dエンジン |

## ドキュメント構成

| ファイル | 内容 |
| --- | --- |
| `01-requirements.md` | 要件定義。ゲーム内容、制約、受け入れ条件 |
| `02-basic-design.md` | 基本設計。画面、状態、エンティティ、ゲームフロー |
| `03-detailed-design.md` | 詳細設計。数値、当たり判定、スポーン、UI、データ定義 |
| `04-agent-implementation-contract.md` | 単一エージェント向けの実装プロトコルと完了条件 |
| `05-comparison-rubric.md` | 比較観点、評価方法、連続実装ログの記録テンプレート |
| `06-sequential-implementation-plan.md` | 実装順序、進行手順、学習効果の扱い |
| `07-implementation-summary.md` | 実装結果、検証結果、残リスクの一覧 |
| `08-phaser-refactor-requirements.md` | Phaser版を本格化するためのリファクタリング要件 |
| `09-phaser-refactor-architecture.md` | Phaser + TypeScript化後の責務分離と粗結合設計 |
| `10-phaser-quality-strategy.md` | ロギング、メトリクス、テスト、UI確認、サブエージェント活用方針 |
| `11-phaser-refactor-tickets.md` | Phaser版リファクタリングの実行チケットと検証チェック |
| `12-phaser-readiness-audit.md` | Phaser版が本実装へ進める状態かの監査結果 |
| `13-phaser-production-implementation-plan.md` | Phaser版を本格ゲーム化するための実装計画とチケット |
| `14-phaser-agent-task-briefs.md` | Phaser Phase 1チケットをサブエージェントへ渡すための作業票 |
| `15-phaser-phase2-agent-task-briefs.md` | Phaser Phase 2 Enemy Varietyチケットをサブエージェントへ渡すための作業票 |
| `16-phaser-phase3-agent-task-briefs.md` | Phaser Phase 3 Weapons and Combatチケットをサブエージェントへ渡すための作業票 |
| `17-phaser-phase4-agent-task-briefs.md` | Phaser Phase 4 Pickups and Upgradesチケットをサブエージェントへ渡すための作業票 |
| `18-phaser-phase5-agent-task-briefs.md` | Phaser Phase 5 Wave Director and Balanceチケットをサブエージェントへ渡すための作業票 |
| `19-phaser-phase6-agent-task-briefs.md` | Phaser Phase 6 Presentation and UXチケットをサブエージェントへ渡すための作業票 |
| `20-phaser-phase7-agent-task-briefs.md` | Phaser Phase 7 Screens and Release Shapeチケットをサブエージェントへ渡すための作業票 |
| `21-phaser-v02-backlog.md` | Phaser v0.2 Playtest & Balance FoundationのPMバックログ、工数ガント、実行順 |
| `22-phaser-v02-playtest-template.md` | Phaser v0.2の手動プレイ記録、debug export、3ラン比較テンプレート |
| `23-phaser-v02-wave-curve-review.md` | Phaser v0.2のwave曲線見直し、bench差分、wave境界被弾レビュー |
| `24-phaser-v02-obstacle-friction-audit.md` | Phaser v0.2の障害物摩擦監査、壁沿い移動テスト、debug接触カウント |
| `25-phaser-v02-stabilization-report.md` | Phaser v0.2 core完了後の検証結果、candidate判定、残リスク |
| `26-phaser-v03-healing-pickup-design.md` | Phaser v0.3 Healing Pickup Foundationのチケット、設計、受け入れ条件 |
| `27-phaser-v03-next-actions-backlog.md` | Phaser v0.3以降のネクストアクション、チケット、実行順 |

## 実装方針

各実装は、同じゲーム体験を目指す。ただし、各ライブラリの自然な書き方を優先してよい。

重要なのは、全プロジェクトで同じプレイヤー操作、同じ勝敗条件、同じ敵挙動、同じ難易度曲線を満たすことである。内部構造やファイル分割はライブラリに合わせてよい。

各プロジェクトが完了した直後に、`IMPLEMENTATION_NOTES.md` へ実装所感と前実装からの持ち込みを記録する。最終比較では、ライブラリ固有の作りやすさと、連続実装による学習効果を分けて評価する。

## 実装しないもの

今回の共通仕様では、以下を必須にしない。

- オンラインランキング
- セーブデータ
- ステージ選択
- 複雑なスプライトアニメーション
- BGMや効果音
- モバイルタッチ操作
- 外部アセットの利用

必要であれば、各実装の余力で任意追加してよい。ただし比較評価では、まず共通必須仕様を満たしているかを優先する。
