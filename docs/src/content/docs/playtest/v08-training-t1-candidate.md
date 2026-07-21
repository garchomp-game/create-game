---
title: v0.8 Training T1 候補
description: 選択式基本訓練の実装契約、自動証拠、人間採否ゲート。
---

最終整理日: 2026-07-21

## 判定

[#97](https://github.com/garchomp-game/create-game/issues/97)の**実装候補と人間検証前の自動ゲートは完成、採用判断は未実施**です。T1は現行の敵、敵弾、XP、REPAIR、強化UIを変えず、説明不足だけを切り分ける比較セルです。production traffic、Endless / Expeditionの数値、ruleset、RunRecord schemaは変更しません。

| 項目 | 値 |
| --- | --- |
| T0基準 | `b561aa6aeca511a03144b5593b85ecd875f47582` |
| T1初版 | `2c0348133f02` |
| T1検証ゲート追補 | `f594206` |
| branch | `agent/v08-training-mvp` |
| mode / stage | `training` / `basic-training` |
| 武器 / seed | Pulse / `20260720` |
| 記録 | `recordPolicy: none` |
| 状態 | Draft PR [#99](https://github.com/garchomp-game/create-game/pull/99)で自動証拠を更新し、[#81](https://github.com/garchomp-game/create-game/issues/81)の人間T1待ち。最終candidate SHAとimmutable Preview VersionはPR / Issueコメントを正本とする |

## 実装した契約

- タイトルの主導線をEndless、Final Expedition、Trainingの3件、副導線を2列2行へ分けた。
- 移動、壁迂回、指定敵撃破、XP回収、敵弾2回回避、REPAIR、固定3択強化、無提示transferの8課題を決定論的に進める。
- ヒントは課題開始から8秒、20秒で段階表示し、Pauseと強化選択中は課題時計を止める。
- 敵弾被弾または死亡時は現在課題のWorld checkpointへ戻す。transfer死亡はtransferだけを再開始する。
- transferは説明、矢印、対象ringを消し、20秒生存、敵2体撃破、Pickup 1個取得をすべて要求する。
- 完了後はEndless出撃またはタイトル復帰だけを表示し、PB、報酬、ランキング結果を表示しない。
- `recordPolicy`をGameContentから解決し、TrainingではRun Lifecycleのbegin、observe、finalize、exportを行わない。
- 説明パネルを戦場下部へ退避し、移動地点、敵、XP、REPAIR、4障害物を隠さない。
- Standardの既定waveはconfig schema、stage上書きwaveはcatalog invariantで`maxEnemies > 0`を要求し、`recordPolicy: none`のTrainingだけ0を許可する。
- checkpointはWorldだけを復元しRandomStreamsを巻き戻さない。Training課題とretryは全streamを消費しない。
- 通常モードの同一seed / input hashは既存値を維持する。

## 責務境界

```text
GameContent(recordPolicy)
  -> ArenaSession
    -> TutorialController -> World / GameEvent / TutorialSnapshot
      -> ArenaTutorialPresenter -> PhaserTutorialLayer

ArenaScene
  -> recordPolicy standard: Run Lifecycle
  -> recordPolicy none: discard
```

`TutorialController`はPhaser、DOM、保存、wall clockを参照しません。表示文と表示可否はPresenter、戦場座標のringと段階ヒントはWebGL layer、通常の強化カードは既存DOM overlayが所有します。

## 自動証拠

| 検査 | 結果 |
| --- | --- |
| 型検査 | pass |
| unit / simulation | 67 files、441 passed / 2 skipped |
| Standard固定hash | event `0e5c664a`、world `47a80192`を維持 |
| production build | 205 modules、pass。既存の500KB chunk警告のみ |
| release smoke | Chrome landscape / portrait、Firefoxで基本出撃、公開情報、Training開始・1 step・退出の9件pass |
| Training公開入力E2E | pointer開始、WASD、mouse / Space、数字キーで全8課題を完了 |
| 非介入E2E | 非空の履歴 / PB / ランキングをfixture化し、完了、中断、restart、title、reload前後で記録、profile、settingsが完全一致 |
| visual | move / navigate / aim / XP / REPAIRを960 x 540と390 x 844で固定。課題対象と4障害物を説明パネルが隠さない |
| 全Playwright | 3 shard合計83 passed / 1 skipped。skipは明示opt-inの15分soak |
| Starlight build | 101 pages、pass |
| Version Preview smoke | meta、debug hook非公開、設定、ランキング、履歴、自然終了記録、リトライ、Pause、Expedition選択、公開情報を確認。console / page / request / HTTP error 0 |
| GitHub Actions | 最終candidate SHAに紐づくPhaser quality、Starlight build、Browser release smokeをPR #99で確認する |

初回全件実行で見つけたfocus順の旧期待値と、並列時の壁時計timeoutは修正しました。2026-07-21の追補では、Workレビューで見つかった説明パネル遮蔽、Firefox Training導線、非空記録、Standard catalog、checkpoint乱数契約をそれぞれ独立fixtureで固定しています。

## 人間T1

自動試験は「操作可能」と「記録非介入」を保証できますが、意味の理解と知識転移は保証できません。初回候補は5名程度を目安に、割合だけでなく分母を残します。

| 観測 | 結果 |
| --- | --- |
| 介助なし完了 | `未実施 / 到達者0` |
| transferで敵本体を撃てた | `未実施 / 到達者0` |
| 敵弾を回避対象と分類した | `未実施 / 到達者0` |
| XPとREPAIRを取得対象と分類した | `未実施 / 到達者0` |
| 選んだ強化と変化を説明できた | `未実施 / 到達者0` |
| deadlock / 進捗破損 / 記録混入 | `未実施` |

`not-reached`、`not-observed`、失敗を成功や失敗の母数へ混ぜません。4/5以上の理解目標は事前仮説であり、結果を見て同じcandidateの合格値を動かしません。

## 既知制約

- 初版はデスクトップ操作だけを対象とし、touch / gamepad専用UIを持たない。
- 完了badgeや初回起動誘導を保存しない。Trainingは毎回同じ固定課題を再実行できる。
- transferの20秒はsimulation timeであり、高負荷のheadless E2Eでは壁時計が長くなる。
- checkpoint retryは乱数generatorを巻き戻さないため、今後もTraining stepへRandomStreams消費を追加しない。
- 説明パネル以外の戦闘オブジェクトvisualは変更していない。Training後も敵弾とPickupの誤認が残るかがT1の観測対象である。
- 外部telemetryと開発run exportを作らない。T1所感とraw countは#81へ手動記録する。

## rollbackと次の判断

追補だけを戻す場合は`f594206`、Training候補全体を不採用にする場合は`2c0348133f02`以降を戻すか、GameContentのTraining modeとタイトル導線を外します。通常モードは`recordPolicy: standard`を明示しており、保存済みRunRecordのmigrationやruleset変更は不要です。

次はT1 Previewを固定し、#81で人間観察を行います。誤認が解消した場合は[#98](https://github.com/garchomp-game/create-game/issues/98)のruntime視覚変更へ進みません。誤認が残った場合だけ、T2の単一visual candidateを別branch、別buildで比較します。
