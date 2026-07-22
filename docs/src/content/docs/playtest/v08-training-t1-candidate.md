---
title: v0.8 Training T1 候補
description: 選択式基本訓練の実装契約、自動証拠、人間採否ゲート。
---

最終整理日: 2026-07-22

## 判定

[#97](https://github.com/garchomp-game/create-game/issues/97)の**T1前レビューは`revise`、必須修正とローカル自動ゲートは完了、採用判断は未実施**です。T1は現行の敵、敵弾、XP、REPAIR、強化UIを変えず、説明不足だけを切り分ける比較セルです。production traffic、Endless / Expeditionの数値、ruleset、RunRecord schemaは変更しません。

| 項目 | 値 |
| --- | --- |
| T0基準 | `b561aa6aeca511a03144b5593b85ecd875f47582` |
| T1初版 | `2c0348133f02` |
| T1検証ゲート追補 | `f594206` |
| ガイド付きフロー追補 | `agent/v08-training-guided-flow`（2026-07-22 Work再レビューを反映） |
| 基点branch | `agent/v08-training-mvp` |
| mode / stage | `training` / `basic-training` |
| 武器 / seed | Pulse / `20260720` |
| 記録 | `recordPolicy: none` |
| 状態 | T1測定ノイズを除く追補はローカルQAとowner再確認を完了。Draft PR [#99](https://github.com/garchomp-game/create-game/pull/99)へ反映し、[#81](https://github.com/garchomp-game/create-game/issues/81)の初心者T1前に最終candidate SHAとPreviewを更新する |

## 実装した契約

- タイトルの主導線をEndless、Final Expedition、Trainingの3件、副導線を2列2行へ分けた。
- 移動、壁迂回、指定敵撃破、XP回収、固定3択強化、敵弾2回回避、REPAIR、総合演習の8課題を決定論的に進める。`撃破 -> XP -> LEVEL UP -> 強化`を一続きにし、その後で回避と修復へ移る。
- 各課題を`briefing`と`active`へ分ける。`briefing`ではsimulation time、移動、射撃、敵、弾、Pickupを停止し、DOMの実ボタンかEnter / Spaceの新規押下後だけ実践を始める。
- ヒントは課題開始から8秒、20秒で段階表示し、Pauseと強化選択中は課題時計を止める。同じ課題のretryでは時計を累積し、短時間の反復被弾でもヒントへ到達できる。
- 敵弾被弾または死亡時は現在課題のWorld checkpointへ戻す。retry回数は課題ごとにリセットし、理由と再開地点を1.8秒表示する。transfer死亡はtransferだけを再開始する。
- 壁迂回は固定開始点から直進不能な目標へ進み、20秒後だけ障害物外側を通る折れ線を表示する。
- 回避は1秒のREADY後に敵弾を発射する。修復課題へ入る直前だけHPを60%へ下げ、REPAIR取得の因果を明確にする。
- 総合演習は開始前に役割と完了条件を説明する。実践中は上部中央の小型チェックリストだけを残し、対象ring、誘導線、正解表示を消す。中央から開始し、初期敵3体を全滅させ、演習中に生成されたXPとREPAIRをすべて回収した時点で即時完了する。
- Trainingの強化選択中もEscape / Pで中断でき、強化選択へ戻る、訓練をやり直す、タイトルへ戻るを選べる。
- 完了後は「チュートリアルは以上です」と明記し、Endlessで実践するかタイトルへ戻るかを明示操作で選ぶ。PB、報酬、ランキング結果は表示しない。
- `recordPolicy`をGameContentから解決し、TrainingではRun Lifecycleのbegin、observe、finalize、exportを行わない。
- 課題前の説明は高解像度DOM dialog、実践中の目標ringと進捗はWebGL layerへ分ける。DOM dialogは本文を`aria-describedby`へ関連付け、開始ボタンへfocusし、終了後に以前のfocusへ戻す。戦場HUDは移動地点、敵、XP、REPAIR、4障害物を隠さない。
- Standardの既定waveはconfig schema、stage上書きwaveはcatalog invariantで`maxEnemies > 0`を要求し、`recordPolicy: none`のTrainingだけ0を許可する。
- checkpointはWorldだけを復元しRandomStreamsを巻き戻さない。Training課題とretryは全streamを消費しない。
- 通常モードの同一seed / input hashは既存値を維持する。

## 責務境界

```text
GameContent(recordPolicy)
  -> ArenaSession
    -> TutorialController -> World / GameEvent / TutorialSnapshot
      -> ArenaTutorialPresenter -> ArenaTutorialDialog / PhaserTutorialLayer

ArenaScene
  -> recordPolicy standard: Run Lifecycle
  -> recordPolicy none: discard
```

`TutorialController`はPhaser、DOM、保存、wall clockを参照しません。表示文と表示可否はPresenter、課題前の確認はDOM dialog、戦場座標のringと段階ヒントはWebGL layer、通常の強化カードは既存DOM overlayが所有します。

## 2026-07-21 owner確認と追補判断

実装者以外の初心者比較へ進む前に、ownerプレイで次を確認しました。

- 課題が表示と同時に始まり、説明を読む時間と操作時間が分離されていなかった。
- 最後のtransferで案内が突然消え、「続きがあるのか」「自由時間なのか」が判別しづらかった。
- 完了後の退出は存在したが、総合演習へ入る前の意味付けが弱く、全体として粗く見えた。

この所感は難度や戦闘ルールではなく、状態遷移と情報提示の欠陥として扱います。各課題の確認操作、総合演習の事前説明と進捗、明示的な完了文言をT1へ追加します。完了ボスは総合演習と役割が重なり、敵仕様とバランスをT1へ混ぜるため採用しません。導入ムービーは有効候補ですが、戦闘オブジェクトの視覚言語がT2で変わり得るため、今回は差し替え可能なDOM dialog境界までを実装し、映像制作はvisual確定後に再判断します。

## 2026-07-22 Work再レビューと修正判断

提出候補は全面再設計ではなく`revise`と判定されました。主因は、総合演習REPAIRのHUD遮蔽、障害物を横切る救済線、無言retry、強化選択中の中断不能、T1前の事前教材による測定汚染です。これらは初心者の理解力ではなく候補側の測定ノイズとして扱い、T1募集前の必須修正にしました。

- 総合演習を下部大型HUDから上部中央チェックリストへ変更し、プレイヤーを中央へ戻したうえで、固定REPAIRを磁力圏外の`(480, 420)`へ移した。座標非交差のE2Eとlandscape / portrait画像を追加した。
- 壁迂回を固定開始点、直進を遮る既存障害物、2 waypointの救済折れ線へ変更した。目標ringと左HUDの非交差、直線経路の遮断、折れ線の通行可能性をfixture化した。
- retry理由、課題別回数、累積ヒント時計、1秒READYをSnapshotとHUDへ追加した。
- XP直後に既存強化UIを開き、選択した強化名と数値効果を次のbriefingへbridge表示する順序へ変更した。
- T1ではTraining前に静止画、動画、30秒説明を見せず、総合演習とPulse Endless 30秒probeの後に分類質問と認識preflightを行う。

完了ボス、導入ムービー、複数失敗後のゴースト、総合演習micro-waveは今回へ混ぜません。T1結果で同じ進行不能が残る場合に、別の仮説として再検討します。

## 2026-07-22 owner最終確認

Work再レビュー追補後の一連の課題、強化選択、回避、修復、総合演習、明示退出をownerが実操作し、Training候補として問題ないことを確認しました。総合演習で確認された「開始直後にREPAIRを取得できる」「早く敵を倒すと待ち時間だけが残る」という2点は、中央開始、磁力圏外REPAIR、敵3体全滅と全Pickup回収による即時完了へ修正し、再確認を通過しています。

これは初心者が説明なしで意味を理解し、通常戦へ転移できることの証明ではありません。owner gateを完了扱いとし、次は同じcandidateを変更せずに#81の初心者T1へ渡します。

## 自動証拠

| 検査 | 結果 |
| --- | --- |
| 型検査 | pass |
| unit / simulation | 67 files、450 passed / 2 skipped |
| Standard固定hash | event `0e5c664a`、world `47a80192`を維持 |
| production build | 206 modules、pass。既存の500KB chunk警告のみ |
| release smoke | Chrome landscape / portrait、Firefoxで基本出撃、公開情報、Training開始・1 step・退出の9件pass |
| Training公開入力E2E | 2件pass。pointer開始、WASD、mouse / Space、数字キーで全8課題を完了し、強化選択中のPause / 復帰も確認 |
| 非介入E2E | 非空の履歴 / PB / ランキングをfixture化し、完了、中断、restart、title、reload前後で記録、profile、settingsが完全一致 |
| visual | move / navigate / aim / XP / REPAIR / transferを960 x 540と390 x 844で固定。課題対象、4障害物、総合演習REPAIRをパネルが隠さない |
| 全Playwright | WebGL並列負荷を抑えた2 worker実行で84 passed / 1 skipped。skipは明示opt-inの15分soak |
| Starlight build | 101 pages、pass |
| Version Preview smoke | 2026-07-21候補はpass。2026-07-22追補を含む最終candidate SHAでは再取得待ち |
| GitHub Actions | 最終candidate SHAに紐づくPhaser quality、Starlight build、Browser release smokeをPR #99で確認する |

2026-07-22 Work再レビュー追補では対象unit 86件、全unit 450件、公開入力E2E 2件、Training visual 6件、全Playwright 84件、release smoke 9件、production build、Starlight 101ページを再取得しました。続く総合演習終了条件の追補では、全unit 450件、公開入力E2E 2件、transfer visual 1件、production build、Starlight 101ページを再取得しています。6 workerでWebGLテストを同時実行すると壁時計timeoutが発生した履歴があるため、全Playwrightは2 workerで取得しています。

## 人間T1

自動試験は「操作可能」と「記録非介入」を保証できますが、意味の理解と知識転移は保証できません。初回候補は5名程度を目安に、割合だけでなく分母を残します。

| 観測 | 結果 |
| --- | --- |
| 介助なし完了 | `未実施 / 到達者0` |
| transferで敵本体を撃てた | `未実施 / 到達者0` |
| 敵弾を回避対象と分類した | `未実施 / 到達者0` |
| XPとREPAIRを取得対象と分類した | `未実施 / 到達者0` |
| 選んだ強化と変化を説明できた | `未実施 / 到達者0` |
| Training後のPulse Endlessで30秒生存 | `未実施 / 到達者0` |
| deadlock / 進捗破損 / 記録混入 | `未実施` |

`not-reached`、`not-observed`、失敗を成功や失敗の母数へ混ぜません。4/5以上の理解目標は事前仮説であり、結果を見て同じcandidateの合格値を動かしません。

## 既知制約

- 初版はデスクトップ操作だけを対象とし、touch / gamepad専用UIを持たない。
- 完了badgeや初回起動誘導を保存しない。Trainingは毎回同じ固定課題を再実行できる。
- 導入ムービーは未実装。追加時はスキップ可能、再視聴可能、実ゲーム表示と一致することを採用条件とする。
- 総合演習は固定時間で終了させず、初期敵3体の全滅と、演習中に生成された全Pickupの回収で即時完了する。継続的な生存確認は完了後のPulse Endless 30秒probeが所有する。
- checkpoint retryは乱数generatorを巻き戻さないため、今後もTraining stepへRandomStreams消費を追加しない。
- 説明パネル以外の戦闘オブジェクトvisualは変更していない。Training後も敵弾とPickupの誤認が残るかがT1の観測対象である。
- T1前にfixture、clip、30秒説明を見せない。既に見た参加者は経験済みとして扱い、初心者T1の初回母数へ戻さない。
- 外部telemetryと開発run exportを作らない。T1所感とraw countは#81へ手動記録する。

## rollbackと次の判断

2026-07-22追補だけを戻す場合は最終candidate commitを単独で戻し、Training候補全体を不採用にする場合は`2c0348133f02`以降を戻すか、GameContentのTraining modeとタイトル導線を外します。通常モードは`recordPolicy: standard`を明示しており、保存済みRunRecordのmigrationやruleset変更は不要です。

次はPR #99へ追補を反映し、CI、最終candidate SHA、Version Previewを固定します。その後#81で初心者観察を行い、誤認が解消した場合は[#98](https://github.com/garchomp-game/create-game/issues/98)のruntime視覚変更へ進みません。誤認が残った場合だけ、T2の単一visual candidateを別branch、別buildで比較します。
