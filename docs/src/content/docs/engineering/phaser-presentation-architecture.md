---
title: Phaserプレゼンテーション再設計
description: ArenaSceneとPhaserArenaRendererを段階的に分割する責務、依存関係、検証計画。
---

最終整理日: 2026-07-17

:::note[状態]
2026-07-17に`PH-ARCH-001`から`005`までを実装し、単体試験、production build、Playwright機能・画像回帰を通過しました。次は`PH-ARCH-006`でdebug / AI / performanceを分離します。
:::

## 実装結果

最初の移行ではゲームルールと描画結果を変えず、表示判断、描画、メニュー操作を分離しました。

| 対象 | 監査時 | 実装後 | 現在の責務 |
| --- | ---: | ---: | --- |
| `ArenaScene.ts` | 1274行 | 1093行 | Phaser lifecycle、入力、debug、AI、各Controllerの調停 |
| `ArenaSession.ts` | なし | 75行 | run config、seed、乱数列、world、`stepWorld`呼び出し |
| `RunLifecycleController.ts` | なし | 138行 | run context、イベント、記録確定、自己ベスト、履歴表示用状態 |
| `PhaserArenaRenderer.ts` | 935行 | 51行 | World、Screen、HUDを同じ描画順で呼ぶ互換facade |
| `PhaserArenaWorldView.ts` | なし | 491行 | アリーナ、entity、照準、カーソルの描画 |
| `PhaserArenaScreenView.ts` | なし | 240行 | タイトル、停止、リザルト、履歴、ランキング、設定の描画 |
| `ArenaScreenPresenter.ts` | なし | 371行 | Phaser非依存の表示文、画面種別、メニューラベル生成 |
| `ArenaMenuController.ts` | なし | 312行 | ページ、フィルター、確認、設定保存、画面コマンド |

`ArenaScene`はまだ1000行を超えています。`PH-ARCH-005`でSceneが保持していたrun config、seed、乱数列、world、履歴、ランキング、直近イベントを単一所有者へ移しました。残りの主因はdebug API、fixture操作、AI、性能計測であり、表示やメニューを再びSceneへ戻さず`PH-ARCH-006`で分けます。

実装時の回帰結果:

- `npm test`: 51ファイル、292件成功、2件skip。
- `npm run build`: TypeScript検査とproduction build成功。
- `npm run test:e2e`: 64件成功。15分耐久1件のみ通常実行ではskip。
- 固定画像比較: タイトル、設定、履歴、ランキング、プレイ、反射、リザルト、停止、選択画面を含め差分なし。
- `docs`のproduction build: 81ページ生成成功。

## 結論

全面的なDDD化やフレームワーク置換は不要です。現在のコードは、ゲームルールをPhaserから分離し、保存と計測をポート越しに扱うPorts & Adaptersの基礎を既に持っています。

問題は内側のドメインではなく、外側のPhaserアダプターにあります。

- `ArenaScene`がPhaserのライフサイクルに加え、ラン実行、保存、メニュー、設定、AI、デバッグ、耐久試験を調停している。
- `PhaserArenaRenderer`がワールド描画に加え、タイトル、停止、リザルト、履歴、ランキング、設定と表示文の組み立てを担当している。
- グラフィック、ストーリー表示、ステージ、ボスを追加すると、両ファイルを同時に変更する頻度が上がる。

既存の依存方向を保ちつつ、次を組み合わせます。

1. Phaser Sceneをライフサイクルアダプターと手動DIの構成点へ縮める。
2. ラン実行、メニュー、記録、デバッグをフレームワーク非依存のコントローラーへ分ける。
3. 表示判断をPresentation Modelへ移し、Phaser ViewをPassive Viewにする。
4. 描画を背景、ワールド、戦闘演出、HUD、画面へ合成する。
5. 段階ごとに既存E2Eと画像を維持し、ゲームルール変更を混ぜない。

## 現状監査

2026-07-17時点の規模です。

| ファイル | 行数 | 主な責務 |
| --- | ---: | --- |
| `ArenaScene.ts` | 1274 | Phaser lifecycle、依存生成、フレーム進行、ラン開始・終了、保存、設定、メニュー、AI、デバッグ、耐久、ログ |
| `PhaserArenaRenderer.ts` | 935 | ワールド、敵、弾、背景、照準、全Canvas画面、メニュー、履歴、ランキング、リザルト整形 |
| `ArenaChoiceOverlay.ts` | 392 | DOM選択UI、入力、レイアウト同期 |
| `PhaserInputAdapter.ts` | 318 | キーボード、ポインター、メニュー入力、カーソル |
| `PhaserHud.ts` | 277 | プレイ中HUD |
| `PhaserFeedbackLayer.ts` | 190 | 戦闘演出と自己記録演出 |

`ArenaScene`のおおまかな変更理由は次へ分かれます。

| 範囲 | 変更理由 |
| --- | --- |
| `preload` / `create` | アセット、依存構築、Phaser lifecycle |
| `update` / `resetGame` | 入力、セッション進行、画面遷移 |
| `recordResult` / `finalizeRunRecord` | イベント、副作用、保存、ランキング |
| debug fixture / hook | E2E、耐久、手動デバッグ |
| export / performance | ログ出力と性能計測 |
| `handleMenuAction` | 履歴、ランキング、設定、プロフィール |
| auto pilot | 観戦AIの開始、切替、入力解決 |

`PhaserArenaRenderer`も、動的ワールド描画、画面別表示、文字列整形、メニュー部品という異なる変更理由を持ちます。行数そのものより、変更理由が同居していることを分割根拠にします。

## 維持する境界

現在の構造で有効な部分は維持します。

- `domain`、`simulation`、`config`、`math`、`format`はPhaserを参照しない。
- `stepWorld`は入力、時間、乱数、設定からワールドを更新し、イベントと計測を返す。
- `RunRecordStorePort`と`ProfileStorePort`を保存境界として使う。
- `RunRecordCoordinator`はゲームオーバーごとの一回保存を保証する。
- `ArenaChoiceOverlay`はDOMのイベントをフレーム入力へ変換し、シミュレーションを参照しない。
- `GameEvent[]`を音、演出、記録の共通事実として使う。
- 自動試験はPhaserなしでもシミュレーションを駆動できる。

[Ports & Adaptersの原典](https://alistair.cockburn.us/hexagonal-architecture/)が重視する、UIや保存装置なしでもアプリケーションを駆動できる状態は既に成立しています。新しい層を増やすこと自体を目的にしません。

## 採用するパターン

### Thin Scene / Composition Root

Phaser公式のSceneは`preload`、`create`、`update`などのライフサイクルを提供します。Sceneをドメインオブジェクトにせず、フレームクロック、Phaserオブジェクトの生成と破棄、アダプターの接続へ限定します。[Phaser Scene lifecycle](https://docs.phaser.io/phaser/concepts/scenes)

依存はDIコンテナを追加せず、`create()`で明示的に生成して渡します。依存関係がコード上で追える規模だからです。

### Presentation Model

リザルト文、履歴ページ、ランキング、ボタン状態、表示可否をPhaserの`Text`や`Graphics`から外し、純粋な表示モデルへ変換します。

[Presentation Model](https://martinfowler.com/eaaDev/PresentationModel.html)はGUI部品から表示状態と表示判断を抜き出し、UIフレームワークなしでテストできる形にします。現行の`createPhaserUiState`はこの方向の小さな先行例です。

### Passive View

Phaser Viewは渡されたモデルを描き、入力イベントを外へ返すだけにします。リザルト順位、設定値の切替、画面遷移をView内で判断しません。[Passive View](https://martinfowler.com/eaaDev/PassiveScreen.html)

### Component / Composite View

継承階層を増やさず、Sceneが小さな表示部品を所有する構成にします。[Component pattern](https://gameprogrammingpatterns.com/component.html)の意図に合わせ、背景、ワールド、戦闘演出、HUD、画面を互いに直接参照させません。

### 明示的な状態遷移

タイトル、武器選択、プレイ、一時停止、リザルトと、履歴、ランキング、設定の組み合わせをBooleanの追加で表さず、判別可能Unionと純粋な遷移関数で扱います。状態数はまだ少ないため、外部のstate machineライブラリは追加しません。[State pattern](https://gameprogrammingpatterns.com/state.html)

## 採用しないもの

| 候補 | 判断 | 理由 |
| --- | --- | --- |
| 全面的なDDD tactical patterns | 不採用 | 描画や入力へAggregate、Repository、Domain Serviceを当てはめても語彙とクラスが増える。境界とドメイン用語だけ活用する |
| ECSへの置換 | 不採用 | シミュレーションは既にデータ指向のWorldとSystemへ分かれており、今回の肥大化はPhaser調停と画面側にある |
| 複数Phaser Sceneへの即時分割 | 保留 | Phaserは複数Sceneをサポートするが、DOM overlay、音、保存、同一ワールドの同期が増える。ステージ間ロードが必要になるまで1 Sceneを維持する |
| DIコンテナ | 不採用 | 手動構築で依存が追える。実行時登録と抽象化の追加価値が小さい |
| グローバルイベントバス | 不採用 | 現在のフレーム単位`GameEvent[]`で順序と所有者が明確。大域バスはデバッグと決定論を弱める |
| 先に全描画をSprite化 | 不採用 | 責務分離と見た目変更を同時にすると画像差の原因を特定しにくい |

イベントキューは単一ドメイン内で有効な場合がありますが、大域化には結合を隠す副作用があります。[Event Queue pattern](https://gameprogrammingpatterns.com/event-queue.html)の注意に合わせ、現行イベント配列を明示的に配る形を維持します。

## 目標依存関係

```text
domain / config / math / simulation
                ^
                |
application session / run lifecycle / menu controller
                ^
                |
presentation models / presenters
                ^
                |
Phaser, DOM, storage, audio, telemetry, debug adapters
                ^
                |
ArenaScene: lifecycle and composition only
```

依存は下から上へ逆流させません。

- `simulation`は`application`、`presentation`、`adapters`を参照しない。
- `application`はPhaser、DOM、`localStorage`を参照しない。
- `presentation`の純粋モデルはPhaser GameObjectを参照しない。
- Phaser Viewは内側の型と表示モデルを参照してよい。
- `ArenaScene`だけがPhaser lifecycleと各アダプターを接続する。

## 候補コンポーネント

名称は実装時に調整しますが、所有責務は固定します。

| 候補 | 所有するもの | 所有しないもの |
| --- | --- | --- |
| `ArenaSession` | `WorldState`、乱数列、run config、開始武器、`stepWorld`呼び出し | Phaser GameObject、DOM、保存UI |
| `RunLifecycleController` | run context、開始、イベント記録、終了確定、自己ベスト | 描画、入力座標 |
| `ArenaMenuController` | secondary screen、ページ、フィルター、消去確認、設定操作 | Phaser Text、ボタン座標 |
| `AutoPilotController` | agent、切替、判断スナップショット | 手動入力デバイス、ランキング描画 |
| `PerformanceMonitor` | raw delta、分位、最終性能値 | ゲームルール |
| `ArenaDebugController` | debug command、fixture適用、snapshot、soak protection | `window`への登録 |
| `ArenaFramePresenter` | worldとUI状態から画面別ViewModelを作る | Phaser GameObjectの生成 |
| `ArenaPresentation` | Viewの生成、描画順、破棄、表示切替 | スコア計算、保存、画面遷移 |

`ArenaDebugBridge`は`window`との接続だけを担当し、API本体は`ArenaDebugController`から受け取ります。debug fixtureのルールは現在どおり純粋関数へ残します。

## 描画コンポーネント

`ArenaPresentation`は次を合成します。

| View | 描画内容 | 更新頻度 |
| --- | --- | --- |
| `ArenaBackgroundView` | 床、グリッド、境界、脅威段階の背景 | フェーズ変化時を基本 |
| `ArenaWorldView` | 障害物、XP、回復、弾、敵、プレイヤー | 毎フレーム |
| `ArenaCombatFxView` | 命中、撃破、反射、取得、記録更新 | イベント発生時と短時間更新 |
| `ArenaHudView` | HP、XP、スコア、時間、危険度 | 毎フレーム |
| `ArenaScreenView` | タイトル、一時停止、リザルト、履歴、ランキング、設定 | 画面状態変化時を基本 |
| `ArenaChoiceOverlay` | 武器、通常 / EX強化、契約 | DOMイベントと選択状態変化時 |

最初の分割では現在の`Graphics`描画をそのまま移し、画像差を出しません。責務分離が完了した後、静的背景をRenderTextureやTileSpriteへ、動的演出をプールしたSpriteへ移します。

## 目標フレーム処理

```text
1. PhaserInputAdapterとArenaChoiceOverlayが入力を読む
2. ArenaMenuControllerが画面操作を処理する
3. ArenaSessionが必要な場合だけ1フレーム進める
4. RunLifecycleControllerとPerformanceMonitorが結果を記録する
5. audio / feedback adaptersへ同じGameEvent[]を明示的に渡す
6. ArenaFramePresenterが表示モデルを作る
7. ArenaPresentationが各Viewを描画する
```

`ArenaScene.update()`はこの順序を呼び出すだけにし、敵、記録、設定ごとの分岐を置きません。

## 状態の所有者

| 状態 | 所有者 |
| --- | --- |
| HP、XP、敵、弾、進行、危険イベント | `WorldState` / `ArenaSession` |
| シード、乱数列、開始武器 | `ArenaSession` |
| ラン開始・確定・ランキング対象 | `RunLifecycleController` |
| 履歴ページ、武器フィルター、消去確認 | `ArenaMenuController` |
| プロフィールと設定の永続化 | 既存Store Portとadapter |
| AIのモード、対象、risk | `AutoPilotController` |
| raw frame metrics | `PerformanceMonitor` |
| Phaser Text、Graphics、Sprite | 各View |
| DOM button | `ArenaChoiceOverlay` |
| debug window hook | `ArenaDebugBridge` |

同じ意味の状態をSceneとControllerへ二重保持しません。Viewは表示キャッシュ以外のゲーム状態を所有しません。

## 段階的な移行

### PH-ARCH-001: 基準固定と依存監査（完了）

- 現行の型検査、単体試験、機能E2E、画像、production buildを基準にする。
- 主要ファイルの責務、依存、公開APIを記録する。
- ルール版、保存schema、乱数列を変更しない。
- 必要になった時点で`dependency-cruiser`をdev-onlyで導入し、循環と禁止依存をCIで検査する。

### PH-ARCH-002: 純粋Presenterの抽出（完了）

- リザルト、履歴、ランキング、設定ラベルをPhaserから独立させる。
- 表示モデルの単体試験を追加する。
- 文字、改行、座標、スクリーンショットを変えない。

### PH-ARCH-003: RendererのComposite View化（完了）

- `ArenaWorldView`、`ArenaScreenView`、既存HUDを`ArenaPresentation`から合成する。
- 初回は同じ描画命令と描画順を維持する。
- `PhaserArenaRenderer`を51行の互換facadeとして残し、呼び出し側の契約を維持する。

### PH-ARCH-004: Menu Controllerの抽出（完了）

- `handleMenuAction`、ページ、フィルター、消去確認、設定変更をSceneから分ける。
- 純粋な状態遷移とStore失敗を単体試験する。
- `MenuAction`と既存InputAdapterの契約は維持する。

### PH-ARCH-005: SessionとRun Lifecycleの抽出（完了）

- `resetGame`、シード、乱数、run config、world進行を`ArenaSession`へ移す。
- 記録確定、自己ベスト、イベント記録を`RunLifecycleController`へ移す。
- 同じシードと入力列で終了スナップショットが一致する契約試験を追加する。
- Sceneから同じ状態を表すmirror fieldを削除し、通常・debug双方のフレーム進行を`ArenaSession.step()`へ統一した。
- 実装直前の`ArenaScene` 1140行から1093行へ47行削減した。抽出後の責務はPhaser lifecycleとadapter間の調停として残る。

### PH-ARCH-006: Debug / AI / Performanceの分離（未着手）

- debug API構築とsoak protectionを`ArenaDebugController`へ移す。
- auto pilot状態と入力解決を`AutoPilotController`へ移す。
- raw frame計測を`PerformanceMonitor`へ移す。
- `ArenaScene`をlifecycle、入力収集、調停呼び出し、描画呼び出しへ限定する。

### [PH-ARCH-007: グラフィック拡張の開始](https://github.com/garchomp-game/create-game/issues/42)（要件確定・未着手）

- [世界観と試合内ドラマ草案](../../design/narrative-and-match-drama/)から背景1種、敵1種、イベント1種を縦切りする。
- 静的背景、動的ワールド、演出の負荷を別々に計測する。
- 見た目変更として画像を更新し、ルール変更は別チケットにする。

各段階は独立してマージ可能にし、全ファイルを一度に移動するブランチを作りません。

## 機械的な境界検査

TypeScriptの型検査だけでは、正しい依存方向を保証できません。対象フォルダーができた段階で、[dependency-cruiser](https://github.com/sverweij/dependency-cruiser)を候補にします。循環依存と禁止したimportを同じ設定でCI失敗にできるためです。

最初の規則候補:

- `domain|simulation|config|math|format`から`application|presentation|adapters`へのimportを禁止する。
- `application`から`phaser|adapters/dom|adapters/storage`へのimportを禁止する。
- `presentation`から`phaser`へのimportを禁止する。
- `src`内の循環依存を禁止する。
- testと型専用importは規則上区別する。

まだ存在しない理想フォルダーへ合わせて先に設定を増やさず、`PH-ARCH-001`または`002`で実際の移行単位と同時に導入を判断します。

## 受け入れ条件

構造変更の完了は行数だけで判定しません。

- `RULESET_VERSION`、敵、武器、XP、スコア、乱数消費順を変えない。
- 同一シードと入力列のworld / result summary hashが一致する。
- `RunRecord` schema、履歴、ランキング、設定の保存結果が一致する。
- 通常E2E、画像比較、WebGL非空判定を通す。
- 公開ビルドへdebug hookとfixtureを含めない。
- 15分耐久のp95、50ms超過率、個体上限を現行基準内に保つ。
- Sceneからストレージ、表示文整形、fixture詳細、敵ごとの描画判断がなくなる。
- Viewから保存、スコア計算、ランク判定、画面遷移がなくなる。
- 新しいruntime依存を追加しない。

目安として、最終的な`ArenaScene`は300行前後、合成Viewは150行前後、個別ViewとControllerは原則300行以下を狙います。ただし、責務が一つで変更理由も一つなら、行数だけを理由に再分割しません。

## 主なリスク

| リスク | 対応 |
| --- | --- |
| 小クラスを増やしすぎる | 実際に独立した変更理由とテスト境界がある単位だけ抽出する |
| ViewModel生成で毎フレームallocationが増える | entity配列のdeep cloneを避け、読み取り専用参照と小さな派生値を使う |
| 描画順変更で画像が変わる | 最初は同じGraphicsと命令順を共有し、layer分離を別変更にする |
| SceneとSessionで状態が二重化する | 状態所有表を契約にし、Sceneへmirror fieldを残さない |
| debug APIが壊れる | 既存debug bridge E2Eを各段階で維持し、controllerへ委譲する |
| 大規模移動で競合する | Presenter、View、Menu、Session、Debugの順に小さく移す |

## 着手判断

グラフィック、ストーリー表示、ステージ、ボスは、RendererとSceneの変更頻度をさらに上げます。したがって`PH-ARCH-002`から`004`までは、次の大きな描画追加より先に行う価値があります。

Sessionとdebugの完全抽出は描画試作の必須条件ではありません。まず表示責務とメニュー責務を分け、グラフィック縦切りを安全に置ける場所を作ることを短期ゴールとします。
