# 単一エージェント実装プロトコル

## 1. 前提

この比較実験では、1つのエージェントが全プロジェクトを順番に実装する。

目的は、各ライブラリを独立に点数化するだけではなく、同じエージェントが連続して作った時に感じる差分を詳細に記録することである。

単一エージェント方式では、前の実装で得た知見が次の実装へ持ち越される。この学習効果は欠点ではなく、比較対象として明示的に扱う。

## 2. 実装対象

| フォルダ | 実装対象 | 分類 |
| --- | --- | --- |
| `phaser` | Phaser版 | 2Dゲームフレームワーク |
| `excalibur` | Excalibur.js版 | TypeScript 2Dゲームエンジン |
| `kaplay` | KAPLAY版 | 軽量JS/TSゲームライブラリ |
| `kontra` | Kontra.js版 | 軽量Canvasゲームライブラリ |
| `melonjs` | melonJS版 | HTML5 2Dゲームエンジン |
| `pixijs-matter` | PixiJS + Matter.js版 | 2D描画 + 2D物理 |
| `threejs-rapier` | Three.js + Rapier版 | 3D描画 + 物理 |
| `babylonjs` | Babylon.js版 | 3Dゲームエンジン |
| `playcanvas` | PlayCanvas版 | Web向け3Dエンジン |

## 3. 共通入力

実装開始前に、最低限以下を読む。

- `docs/01-requirements.md`
- `docs/02-basic-design.md`
- `docs/03-detailed-design.md`
- `docs/04-agent-implementation-contract.md`
- `docs/05-comparison-rubric.md`
- `docs/06-sequential-implementation-plan.md`

各プロジェクトを始める直前にも、該当ライブラリの方針と前回までの記録を確認する。

## 4. 基本方針

### 4.1 1プロジェクトずつ完了させる

複数プロジェクトを同時に実装しない。

1つのプロジェクトで以下を完了してから次へ進む。

- 実装
- 起動確認
- 主要動作の手動確認
- `README.md` の記入
- `IMPLEMENTATION_NOTES.md` の記入
- 比較観察の記録

### 4.2 共通仕様を維持する

ゲーム仕様は `03-detailed-design.md` の数値に合わせる。

ライブラリ都合で差分が出る場合は、必ず `IMPLEMENTATION_NOTES.md` に記録する。

### 4.3 ライブラリの自然な書き方を優先する

同じエージェントが作るため、共通の手癖が強く出やすい。

ただし、比較目的上、無理に同じ内部設計へ寄せない。各ライブラリの自然な構造、API、推奨パターンを優先する。

### 4.4 学習効果を隠さない

後続実装で前の実装を参考にした場合は、それを記録する。

例:

- Phaserで作ったスポーン設計を流用した
- Kontraでは手動衝突判定を前回コードから概念的に再利用した
- Three.jsでは2D座標系から3D座標系への変換で新しい負担が出た

## 5. 成果物

各プロジェクトフォルダには、原則として以下を作成する。

```text
<project>/
  README.md
  IMPLEMENTATION_NOTES.md
  package.json
  index.html
  src/
    ...
```

ライブラリによって標準構成が異なる場合、自然な構成に変更してよい。

ただし、以下は必須とする。

- 起動方法が分かる `README.md`
- 実装メモとしての `IMPLEMENTATION_NOTES.md`
- ブラウザで実行できるゲーム本体

## 6. 起動コマンド

可能な限り、以下のコマンドに揃える。

```bash
npm install
npm run dev
```

ビルド確認が可能なら以下も用意する。

```bash
npm run build
```

別コマンドが必要な場合は、`README.md` に明記する。

## 7. 実装ルール

### 7.1 編集範囲

実装中は、現在対象のプロジェクトフォルダだけを編集する。

比較記録や計画更新が必要な場合のみ、`docs` を編集してよい。

### 7.2 共通仕様

変更が必要な場合は、以下を `IMPLEMENTATION_NOTES.md` に書く。

- 変更した項目
- 変更前の仕様
- 変更後の仕様
- 変更理由
- プレイ感への影響

### 7.3 ライブラリ選定

対象フォルダ名に対応するライブラリを使う。

補助ライブラリは必要に応じて使ってよい。

例:

- Vite
- TypeScript
- tiny helper libraries
- physics helpers

ただし、ゲーム本体の比較が崩れるような別ゲームエンジンの追加は避ける。

### 7.4 外部アセット

画像、音声、フォントなどの外部アセットは必須にしない。

使う場合は、ライセンス、取得元、用途を `IMPLEMENTATION_NOTES.md` に書く。

### 7.5 UI

HUDはゲームキャンバス内でもHTML DOMでもよい。

ただし、ゲーム画面に自然に統合され、プレイを邪魔しないこと。

### 7.6 3D実装

3D実装では、ゲームルールを変えない。

以下の対応を守る。

```text
2D x -> 3D x
2D y -> 3D z
3D y -> 高さ
```

カメラは上から見下ろす。完全なトップビューでも、少し斜めでもよい。

### 7.7 物理エンジンの扱い

物理エンジンを使うプロジェクトでも、ゲーム性が変わりすぎないようにする。

例えば、敵やプレイヤーが強い慣性で滑り続ける挙動は避ける。

`Arena Core` はアクションサバイバルであり、物理シミュレーションゲームではない。

## 8. 実装メモのテンプレート

各プロジェクトの `IMPLEMENTATION_NOTES.md` には、以下を含める。

```md
# Implementation Notes

## Target

- Folder:
- Library/Engine:
- Language:
- Build tool:
- Implementation order:

## Setup

- Install:
- Run:
- Build:

## What Works

- Player movement:
- Aiming:
- Shooting:
- Enemy spawning:
- Enemy chasing:
- Bullet/enemy collision:
- Enemy/player damage:
- Obstacles:
- HUD:
- Game over/restart:

## Deviations From Shared Spec

| Spec | Expected | Actual | Reason |
| --- | --- | --- | --- |

## Carryover From Previous Implementations

- Reused concepts:
- Reused constants:
- Reused code patterns:
- Things deliberately not reused:

## Library Fit

### Easy

### Hard

### Surprising

## AI Implementation Notes

- Setup friction:
- API friction:
- Collision/physics friction:
- Debugging friction:
- Code organization:
- Risk of outdated knowledge:

## Known Issues

## Verification

- Browser:
- Manual test duration:
- Console errors:
```

## 9. 完了チェックリスト

各プロジェクト完了時に以下を確認する。

- `npm install` が通る
- `npm run dev` でローカル起動できる
- ゲーム画面が表示される
- キーボード移動ができる
- 照準または射撃方向が分かる
- 射撃できる
- 敵が出現する
- 敵がプレイヤーを追う
- 弾で敵を倒せる
- スコアが増える
- 敵接触でHPが減る
- HPが0でゲームオーバーになる
- `R` でリスタートできる
- 障害物が機能する
- 実装名が表示される
- 1分程度の手動プレイで致命的なエラーが出ない
- `README.md` が埋まっている
- `IMPLEMENTATION_NOTES.md` が埋まっている

## 10. 比較時に残す観察

実装中に感じたことは、些細でも記録する。

特に重要なのは以下である。

- セットアップが直感的だったか
- ドキュメントや型定義からAPIを推測しやすかったか
- ゲームループの書き方に迷ったか
- 衝突判定の責務が明確だったか
- UIの重ね方に迷ったか
- リスタート時の破棄/再生成が自然だったか
- 3D実装で2Dゲーム仕様に寄せるのが難しかったか
- 前回実装からの流用が効いたか
- 流用が逆に邪魔になったか
- AIが間違えやすそうなAPIがあったか

## 11. 禁止事項

以下は禁止する。

- 現在対象外のプロジェクトフォルダを同時に実装すること
- 共通仕様を無断で大きく変更すること
- 実行に外部サービスを必須にすること
- ブラウザ上で動かない実装にすること
- 完成していない機能を実装済みとして記録すること
- 実装直後の所感を書かずに次のプロジェクトへ進むこと

## 12. 許容される妥協

以下は許容する。

- 細かい見た目の差
- 物理挙動の微差
- HUDの配置差
- TypeScript/JavaScriptの選択差
- 内部ファイル構成の差
- 一部ライブラリの都合による衝突処理の近似

ただし、プレイヤーが遊んだ時に「同じゲーム」と判断できる範囲に収める。

