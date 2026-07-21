---
title: v0.8 作業開始前レビュー
description: Training、視覚意味、敗因説明、危険反転、UI、RC6公開を混同せずに進めるための開始条件、依存、停止条件。
---

最終整理日: 2026-07-21

## このページの役割

このページは、Arena Core v0.8の各作業を開始する直前に読む実行正本です。個別Issueの詳細仕様を置き換えるのではなく、次を横断して固定します。

- どの仮説を先に検証するか。
- 同じbuildへ何を混ぜないか。
- 実装前に必要な証拠と定数は何か。
- 自動ゲートと人間ゲートをどこで分けるか。
- Codexが自律判断できる範囲と、maintainer判断で止まる範囲。
- v0.7 RC6のproduction昇格とv0.8実験を分離する方法。

個別の実装契約はGitHub Issue、現在の全体像は[現在地](../../game/current-state/)、既存のWaveは[v0.8 実行計画](../v08-execution-plan/)を正本とします。内容が競合する場合は、対象範囲が狭く、更新日の新しい記録を優先します。

## エグゼクティブ判定

判定は**進行可。ただし順序変更**です。

維持する原則は「1 candidate / 1 primary hypothesis / 1 build」です。Training、戦闘オブジェクトの視覚意味、敗因表示、Charger、選択UI、Boss、武器教義を一つの統合buildで同時に採否しません。

順序を変える主な理由は次の通りです。

1. Draft PR #99のTraining候補は自動ゲートがgreenだが、人間T1の前に直す表示遮蔽がある。
2. 外部初見で実際に「なぜ負けたか分からない」が観測されており、#94 Phase Aは未観測のruntime候補より先に測る価値がある。
3. #77、#80、#95は全面実装するとcandidateより基盤が先に大きくなる。最初の利用者に必要な最小sliceへ縮める。
4. #98のruntime変更はTraining後も誤認が残る場合だけ必要であり、`変更なし`も正式な判断である。
5. 採用済みRC6の公開はv0.8全体の採否を待つ必要がなく、独立したrelease readinessで扱える。

## 2026-07-21の検証snapshot

| 項目 | 確認値 | 意味 |
| --- | --- | --- |
| main | `b561aa6aeca511a03144b5593b85ecd875f47582` | v0.8候補の共通baseline |
| Draft PR #99 | `agent/v08-training-mvp` / `c3c5292a043512a025fb2cea9efececf1f3ae31f` | 構造レビュー時点のTraining候補 |
| PR #99 CI | Phaser quality / Starlight build / Browser release smokeがgreen | 自動実装証拠。人間採用の代替ではない |
| PR #99 review | 2026-07-21に作業開始前Reviewを提出 | 表示遮蔽P1とReady化前P2を記録 |
| Draft PR #84 | HEAD `1fdaca2…` | 現mainより10 commit遅く、外部採否前に再認証が必要 |
| production | GitHub正本ではv0.6.8 | live画面の独立確認はこの監査の対象外 |
| RC6 release | [#100](https://github.com/garchomp-game/create-game/issues/100) | v0.8と分離したproduction昇格レーン |

このsnapshotは作業開始時に再取得します。SHA、PR状態、CI、Issue状態が変わっている場合は、このページの結論を機械的に適用せず差分を先に評価します。

## Training T1の作業開始前レビュー

### 良い点

PR #99は、Trainingを製品Stageやdebug runへ混ぜず、再プレイ可能な独立モードとして切り出しています。

- `recordPolicy: none`をGameContentからSessionへ解決する。
- Run Lifecycleのbegin、observe、finalize、exportを一貫して行わない。
- `TutorialController`はPhaser、DOM、保存、wall clockを参照しない。
- 表示文と表示可否はPresenter、戦場座標のringとguideはWebGL layerが所有する。
- Standard固定hashを維持し、ゲーム数値、ruleset、保存schema、production trafficを変更しない。
- task timeはsimulation timeで進み、Pauseと選択中の時間を混ぜない。

この境界は維持します。Trainingを理由にRunRecordへ特例分岐を増やしたり、tutorial専用の色・当たり判定・自動成功へ置き換えません。

### T1前に直すP1

`PhaserTutorialLayer`の説明パネルは次の矩形をalpha `0.9`で覆います。

```text
panel: x=130..830 / y=104..182
```

Trainingは現行stageの障害物を再利用し、課題対象は次の位置にあります。

```text
上側左障害物:  x=220..340 / y=150..182
上側右障害物:  x=620..740 / y=150..182
navigate target: (280, 110)
aim / XP target: (480, 100)
```

このため、壁を迂回する課題、誘導地点、敵・XPの識別対象を説明UI自体が隠します。現在のvisual E2Eは`move` stepだけを固定しており、後続stepの遮蔽を検出しません。

人間T1へ渡す前に、次を完了します。

1. 説明パネルを課題対象から退避する最小修正を行う。
2. `navigate`、`aim`、`XP`、`repair`のdesktop / portrait visual fixtureを追加する。
3. 修正後HEADで3 CI jobを取り直す。
4. exact SHAとimmutable Preview Versionを固定する。
5. T1実施中はcandidate HEADを変更しない。

パネル修正と同時に、敵性能、学習条件、対象位置、ヒント時間、#98視覚候補を変更しません。配置変更が必要な場合は、障害物・hitboxとの重なりを直す範囲だけを許可し、新candidateとしてSHAを分けます。

### Ready化までのP2

次はT1の開始blockerではありませんが、PRをReadyにする前に解消します。

- FirefoxでTraining開始、少なくとも1 step、退出を通す最小smoke。
- 履歴、PB、ランキングが非空のfixtureで、完了・中断後の完全不変を確認。
- Standard stageでは`maxEnemies > 0`を要求するcatalog invariant。
- checkpointはWorldだけを復元しRandomStreamsを巻き戻さないため、Trainingへ乱数消費を追加しない契約を文書化・試験化。

## 固定する製品原則

### 学習と視覚を分ける

Training T1は現行visualのまま、説明不足だけを切り分けます。戦闘オブジェクトの形、色、motion、音を変えるT2は別buildです。

- T1で誤認が解消した: #98 runtimeは`変更なし`。
- T1で誤認が残った: 誤認対象1件だけを#98 T2で比較。
- 低密度で採用されたsemantic: #80の最大密度fixtureへ引き渡す。

### 納得できる敗北を壊さない

外部初見では、立ち回り次第で挽回できそうな敗北と、もう1run遊びたい感情が同時に観測されています。#94はこの主体感を残しながら敗因理解を改善します。

- 表示前に本人の自由回答を取得する。
- 最終hitだけでなく直前3〜5秒のdamage aggregationと照合する。
- `あと少し`を作るための隠れた難度補正や強制敗北を入れない。
- Standardの結果表示とPractice / Assistを同時実装しない。

### 支援は明示的なdivisionで扱う

Standard、Assist、Practice、Overloadは記録上のdivisionを分けます。履歴依存の隠れたDDAをStandard、fixed seed、ランキング対象へ入れません。

Training初版はdivisionではなく`recordPolicy: none`です。Practice表示への将来統合は可能ですが、初版のblockerにしません。

### Bossの強さをHPだけで作らない

Boss候補はHP、回復、攻撃密度、反撃窓を同時変更しません。まずRC6 controlから3攻撃のAttack Card、予告、legal / forbidden chain、回復・反撃窓の観測契約を作ります。runtime候補は#76判断後に必要な1件だけ比較します。

### Stage量産を約束しない

v0.9はStage 1、5、現行FinalのStage 10相当で「学習、複合、総合試験」が成立するかを確かめます。10 Stage量産とStage 2〜4、6〜9の制作は、その判断後です。

## Issue責務と現在の開始状態

`prepare only`は仕様、fixture、純粋試験までです。runtime、ゲーム数値、保存schema、production trafficを変更しません。

| Issue | 所有する責務 | 現在の状態 | 開始条件 | 最初の完了条件 |
| --- | --- | --- | --- | --- |
| [#97](https://github.com/garchomp-game/create-game/issues/97) | 任意・記録なしTraining | P1修正後に人間証拠待ち | パネル遮蔽修正、step別fixture、new HEAD CI、Preview固定 | #81でadopt / revise / defer / reject |
| [#81](https://github.com/garchomp-game/create-game/issues/81) | 再利用可能な人間検証レーン | do now | immutable candidate、匿名票、cohort定義 | 分母付きraw countと判断 |
| [#98](https://github.com/garchomp-game/create-game/issues/98) | 低密度の撃つ / 避ける / 取る | Phase A prepare only | fixture仕様は即時可。runtimeはT1誤認時のみ | 変更なしを含むT2判断 |
| [#77](https://github.com/garchomp-game/create-game/issues/77) | candidate非依存fact kernel | scope縮小してdo now | 既存event棚卸し済み | episode、invalid-state、pure fixture |
| [#94](https://github.com/garchomp-game/create-game/issues/94) | 主敗因、near-miss、同条件再挑戦 | Phase A do now | #77最小fact境界 | baseline cause match。未達時だけStandard候補 |
| [#80](https://github.com/garchomp-game/create-game/issues/80) | 共通capture harnessと最大密度ゲート | skeleton prepare only | RC6 baseline | viewport / layer / timing / audio観測骨格 |
| [#76](https://github.com/garchomp-game/create-game/issues/76) | Charger衝突妨害candidate | prepare only | #77最小slice、定数・seed・window事前登録 | RC6とpaired比較、#80密度ゲート |
| [#93](https://github.com/garchomp-game/create-game/issues/93) | Boss Attack Cardと任意runtime候補 | Phase A prepare only | RC6 control | 3攻撃文法、chain、shadow指標 |
| [#95](https://github.com/garchomp-game/create-game/issues/95) | divisionと記録公平性 | ADR / pure typeだけprepare | RC6記録契約 | division、eligibility、比較scope |
| [#66](https://github.com/garchomp-game/create-game/issues/66) | 世界観と視覚テーマ | semantic制約prepare | low-fidelity比較 | shape / contrast / warningを壊さない方向選択 |
| [#68](https://github.com/garchomp-game/create-game/issues/68) | UI表示境界とtoken | P1 / 必要箇所だけ | 具体的な責務衝突 | 現mainからの最小抽出 |
| [#67](https://github.com/garchomp-game/create-game/issues/67) | UI prototypeとlibrary採否 | completed | 完了 | ADRと#70へ引き渡し済み |
| [#70](https://github.com/garchomp-game/create-game/issues/70) | 選択UI候補 | 再認証後に人間証拠待ち | PR #84をmain追従、fresh CI、new Preview | adopt / revise / reject |
| [#78](https://github.com/garchomp-game/create-game/issues/78) | 選択停止時間と入力復帰 | later | #70採用または具体的事故 | simulation非介入の計測 |
| [#92](https://github.com/garchomp-game/create-game/issues/92) | 通常offer偏り | baselineだけ、runtime later | 分布取得は可 | 教義と分離した判断 |
| [#79](https://github.com/garchomp-game/create-game/issues/79) | Pulse / Spread教義 | prepare only | #76判断完了、#77、#92固定 | 1武器1candidateずつ比較 |
| [#62](https://github.com/garchomp-game/create-game/issues/62) | Stage 1 / 5 / 10基盤 | v0.9 | v0.8判断完了 | 3作戦data契約 |
| [#64](https://github.com/garchomp-game/create-game/issues/64) | Stage 1学習縦切り | v0.9 P0 | #62、Training / visual判断 | 通常勝利と2run目行動変化 |
| [#65](https://github.com/garchomp-game/create-game/issues/65) | Stage 5複合判断 | v0.9 | #64採否 | Stage 1より難しくFinalより易しい |
| [#100](https://github.com/garchomp-game/create-game/issues/100) | RC6 production昇格・rollback | release lane P0 | 採用済みmain | exact artifact、smoke、保存互換、rollback、承認 |

## 推奨依存関係

```text
release lane: v0.8実験と独立
  adopted RC6 main
    -> #100 exact artifact / smoke / save compatibility / rollback
      -> maintainer production approval

learning / readability lane
  PR #99 P1 fix + step fixtures
    -> final HEAD freeze / immutable Preview
      -> #81 T1
        +-> confusion resolved -> #98 runtime no change
        `-> confusion remains  -> #98 low-density T2 -> #80 density gate

feedback / gameplay lane
  #77 Phase 0 fact kernel --------------------------+
     |                                              |
     +-> #94 Phase A + pre-display free response    |
     |      +-> baseline adequate -> no UI change   |
     |      `-> baseline mismatch -> Standard B -> #81
     |                                              |
     `-> #76 constants preregistration -> candidate-+
                                  -> #80 density gate
                                    -> #81 decision

parallel preparation
  #80 common capture skeleton
  #66 semantic constraints only
  #93 Attack Card docs only
  #95 division ADR / pure eligibility only

separate UI lane
  PR #84 update to current main -> fresh CI / Preview
    -> #70 paired human comparison
      -> #78 only if measurement remains necessary

after v0.8 decisions
  optional #93 runtime
  #92 and #79 as separate builds
  -> #62 -> #64 Stage 1 -> #65 Stage 5 -> current Final check
```

## 次の3作業セッション

人間T1の日程待ちがあっても、同一branchでWIPを増やしません。Session 2と3は別Issue・別branchで進めます。

### Session 1: PR #99 T1 evidence freeze

目的は、表示遮蔽を直したTraining candidateを再現可能な人間T1へ渡すことです。

変更してよいもの:

- 説明パネルの位置、高さ、透過、step別退避の最小変更。
- `navigate`、`aim`、`XP`、`repair` visual fixture。
- Firefox Training smoke、非空記録fixture、catalog invariant。
- 新HEADのcandidate情報、rollback、Preview、Issue証拠同期。

変更しないもの:

- 課題の成功条件、敵性能、hint時刻、対象semantic。
- #84、#98、#94、#76。
- ruleset、RunRecord schema、production traffic。

自動ゲート:

- typecheck、unit、production build、全主要E2E。
- Phaser quality、Starlight build、Browser release smoke。
- Standard event / world hash。
- desktop / portraitの全対象可読性。
- 非空の履歴、PB、ランキング、profile、settings、exportが不変。

人間ゲート:

- 初心者は介助なし完了と無提示transfer。
- 経験者は摩擦、退屈、誤学習、悪用可能性。
- `not-reached`、`not-observed`、`failure`を分離。
- 4/5は製品一般化ではなく次candidateへ進むheuristic。

### Session 2: #77 Phase 0 fact kernel

目的は、#94 Phase Aと#76が使える最小の事実境界を作ることです。

含めるもの:

- episode ID、scope、invalid / not-reached / unavailable。
- 既存eventだけを入力する純粋集約fixture。
- weapon / mode / stage / seed / rulesetを保持するread model。

含めないもの:

- RunRecord永続化。
- 最大3成果 + 1目標の表示。
- candidate固有閾値、score、自由文評価。
- 詳細eventの無制限保存。

完了ゲートは、同じevent列から同じfactを得て、Standardのevent / world hash、score、drop、記録比較を変えないことです。

### Session 3: #80 common fixture skeleton

目的は、#98、#76、#93が共用できるcapture基盤を意味や最終assetより先に作ることです。

含めるもの:

- 既存debug fixture / visual specを使うscenario loader。
- desktop、portrait、横長のcapture matrix。
- layer visibility、frame timing、audio requested / played / suppressed。
- RC6 controlのbaseline fixture 1件。

含めないもの:

- 最終色、最終音色、新asset。
- density、damage、hitbox、magnet、drop、score。
- #98 / #76 / #93の成功意味。

## #94と#76の順序

#94 Phase Aはruntime変更をせず、実際に観測済みの課題を測るため早期に実施します。

1. 結果表示前に本人の敗因自由回答を取得する。
2. #77のfactから直前3〜5秒の主因を集約する。
3. 本人認識とログの一致を`causeMatch`として記録する。
4. baselineが事前heuristicを満たすなら、表示変更なしを採用する。
5. 未達ならStandardだけの結果候補を別buildで比較する。

v0.8でruntime candidateを1件しか扱えない場合は、観測済みの#94 Standard候補を、仮説段階の#76より先に採否します。両方を実装できる場合も同じbuildへ混ぜません。#76比較時に#94が採用済みなら、controlとcandidate双方へ同じ結果表示を固定します。

## #77、#80、#98、#76の所有境界

| 領域 | 所有Issue | 所有しないもの |
| --- | --- | --- |
| eventから導出するcandidate非依存fact | #77 | 合格閾値、色、文言、候補意味 |
| capture、viewport、layer、性能、audio route | #80 | 低密度scenarioの意味、Charger成功条件 |
| 撃つ / 避ける / 取るの低密度scenario | #98 | 共通driver、最大密度、gameplay数値 |
| Charger event、outcome、定数、固有fixture | #76 | 共通harness、最終theme、Boss候補 |

#80の全最大密度表現は#76実装開始の前提ではなく、#76採用前のゲートです。

## #95と#94の所有境界

#95のMilestone 6 scopeは、division、eligibility、比較scope、ADR、pure testまでです。persisted schema変更、旧記録migration、4 division runtimeは後続です。

- #94 Phase A: #95を待たない。
- #94 Standard Phase B: #95全体を待たない。
- #94 Practice / Assist Phase C: #95へ依存する。
- Training: `recordPolicy: none`でdivision外。

初版の同条件再挑戦は、現行Standardのmode、stage、seed、weapon、rulesetだけで成立させます。

## 意思決定の所有者

### Codexが自律判断できるもの

- 作業開始時のmain、branch、PR、Issue、CI再取得。
- Issue本文・コメントとStarlightの事実同期。
- #77 Phase 0、#80 skeleton、#98 Phase A fixture。
- candidate-off回帰、固定fixture、rollback記録。
- 1 Issue / 1 branch / 1 Draft PR。
- PR #84の現main追従、fresh CI、Preview作成という技術作業。
- historical PRへdo not mergeを明記し、判断履歴を正本へ移す作業。

### maintainerが判断するもの

- RC6 production trafficの切替。
- T1、#84、#94、#76、#93のadopt / revise / defer / reject。
- #66の世界観方向。
- v0.8に含める採用要素とversion / ruleset命名。
- rollback実行と公開継続判断。

### 外部プレイヤーの証拠が必要なもの

- Trainingを介助なしで完了できるか。
- 無提示transferへ対象分類を移せるか。
- UI候補で停止戦場と選択後入力を理解できるか。
- 本人の敗因理解がログと一致するか。
- Chargerの基本回避と意図的反転を区別できるか。

### 追加調査を依頼する条件

広いブレストは行いません。次の具体的証拠が出た場合だけ、限定した追加調査を行います。

- T1誤認clipから、説明不足かsemantic不足かを分類できない。
- #94の自由回答とdamage aggregationが具体runで矛盾する。
- #76で意図的誘導と偶発衝突をログから区別できない。
- release artifactと保存migrationに差が見つかる。

## v0.8の完了条件

### 必須

1. #97をadopt / revise / defer / rejectへ決め、PR #99を未判断Draftとして放置しない。
2. #70 / PR #84を現mainで再認証し、採否を記録する。
3. #77 Phase 0 fact kernelを完成させ、simulation非介入を保証する。
4. #94 Phase Aでbaseline敗因一致を測り、Phase B要否を決める。
5. #76を単独buildで比較し、判断を記録する。
6. #80共通capture骨格と、採用候補に必要な最大密度ゲートを用意する。
7. #81へSHA、ruleset、seed、weapon、raw count、未到達、自由回答要約を残す。
8. 採用要素だけの統合PreviewでChrome / Firefox、主要E2E、記録非退行を通す。
9. 配布候補のSHA、appVersion、rulesetVersion、rollbackを固定する。

### 条件付き

- #98 runtime T2: T1後も対象誤認が残る場合だけ。
- #94 Standard Phase B: baseline cause matchが事前heuristic未達の場合だけ。
- #80の新しい色・形・音: 現行semanticまたは採用候補が最大密度で破綻する場合だけ。
- #93 runtime: RC6 Attack Card観察で文法欠陥があり、#76判断後に必要な場合だけ。
- Training初回提示: 内容採用後に発見性を別candidateで比較する。

### v0.9以降

- Stage 1 / 5 / 10 runtimeと10 Stage量産判断。
- #92 offer runtime変更。
- #79 Doctrine runtime変更。
- #95の4 division gameplayとpersisted migration。
- #66の最終asset、全敵sprite、stage別BGM。
- 全面的なPresenter / World View再分割。
- chunk警告だけを理由にしたbundle最適化。

## RC6 release lane

[#100](https://github.com/garchomp-game/create-game/issues/100)はv0.8実験と独立します。

含めるもの:

- 採用済みRC6 main。
- Encounter境界修正。
- GitHub Actions品質ゲート。
- Firefox WebGL smoke。

含めないもの:

- Training PR #99。
- UI PR #84。
- Charger、敗因表示、visual、Boss、Doctrine候補。

release条件は時間経過ではなく、exact SHA、artifact hash、両browser smoke、両武器fresh run、保存互換、rollback smoke、maintainer承認です。

## 作業開始時のCodexチェックリスト

各Issueへ着手する前に次を実行します。

1. `main` HEAD、対象branch、open / merged / closed / Draft PRを再取得する。
2. Issue本文と最新コメント、Starlight正本の差分を確認する。
3. 対象candidateのprimary hypothesisを1文で書く。
4. 変更するものと固定するものを列挙する。
5. baseline SHA、candidate-off hash、seed、weapon、viewportを固定する。
6. 人間結果を見る前に定数、window、合格heuristicを記録する。
7. rollback方法と不採用時に外す境界を決める。
8. 既存branchへstackせず、最新mainから専用branchを作る。
9. Draft PR本文へ自動証拠、人間ゲート、対象外を記載する。
10. production traffic、採用、世界観選択で停止する。

## 停止条件

Codexは次の場合に自律実装を止め、Issueへ事実を記録してmaintainer判断を求めます。

- primary hypothesisを1件に限定できない。
- baselineとcandidateでruleset、seed、weapon、記録scopeがそろわない。
- candidate-offでStandard hashまたは保存意味論が変わる。
- 人間結果を見た後に合格値を変更する必要が生じる。
- production traffic、保存migration、既存PBの扱いを変更する。
- 外部assetのlicenseまたは再配布条件が不明。
- P0 / P1を「既知だが後で直す」としたまま人間採否へ進もうとしている。
- 複数のDraft PRが同じ責務を別実装している。

## candidate証拠テンプレート

```md
## Candidate preflight

- Issue:
- primary hypothesis:
- baseline SHA:
- candidate SHA:
- branch / Draft PR:
- mode / stage / weapon / seed:
- appVersion / rulesetVersion:
- Preview Version ID:

### Changes
- changed:
- fixed:
- explicitly out of scope:

### Preregistered
- constants:
- time windows:
- automated thresholds:
- human heuristic:
- invalid / not-reached handling:

### Automated evidence
- typecheck / unit / build:
- Chrome / Firefox:
- fixed hashes:
- visual / density / performance:
- save and record isolation:

### Human evidence
- cohort / denominator:
- reached:
- raw counts:
- free responses:
- observed regressions:

### Decision
- adopt / revise / defer / reject:
- reason:
- rollback:
- next allowed work:
```

## 2026-07-21に実施したIssue整理

- [#100](https://github.com/garchomp-game/create-game/issues/100)をRC6 release readinessとして起票。
- #97の状態を「候補完成 / T1前blocker修正待ち」へ更新。
- #81へT1のHEAD凍結、cohort、raw count規則を追記。
- #77をPhase 0 fact kernelへ縮小。
- #80へ共通harnessとcandidate固有fixtureの所有境界を追記。
- #94 Phase A / Standard Phase Bが#95全体を待たない順序へ更新。
- #95のMilestone 6 scopeをADR / type / eligibilityへ縮小。
- #68をP0からP1へ変更し、旧PRの全面統合ではなく必要箇所抽出へ変更。
- #67をprototype判断完了としてclose。
- #70へPR #84のmain追従、fresh CI、new Preview条件を追記。
- #64のP0はMilestone 7内の優先度であり、v0.8即時着手ではないと明記。
- #79の依存を「#76採用後」ではなく「#76判断完了後」と明記。
- PR #99へ作業開始前Reviewを提出。

## 既知の不確実性

- PR #99のP1修正後HEAD、CI、immutable Previewは未作成。
- T1の初心者・経験者raw countは未取得。
- PR #84は現main追従後のHEAD、CI、Previewが未作成。
- #94 baseline cause matchの実測値は未取得。
- #76の半径、持続、対象上限、seed、window、採否基準は未登録。
- #80の最大密度同時countと性能閾値は未固定。
- #100のrelease SHA、artifact hash、production approvalは未確定。
- GitHub正本上のproduction情報とlive画面のversion表示を、この監査では独立照合していない。

## このsnapshotから断定しないこと

- 初心者5名の4/5を母集団の成功率とみなさない。
- 手動3runで支配戦略が存在しないと一般化しない。
- 15分soakを初期load性能の保証としない。
- mergeableをreview済み、adopt済み、release可能と読み替えない。
- T1完了をStage 1の学習成立と読み替えない。
- CI greenを視認性、意味理解、楽しさの採用証拠と読み替えない。

## 最終的な実行順

1. PR #99の説明パネル遮蔽P1を直し、step別fixtureで固定する。
2. 新HEADを凍結し、immutable Previewで#81 T1を行う。
3. 待ち時間に#77 Phase 0と#80 skeletonを別branchで進める。
4. T1で誤認が残る場合だけ#98 runtime T2を作る。
5. #94 Phase Aで敗因理解を測り、未達ならStandard候補を先に採否する。
6. #76 Chargerを単独比較する。
7. PR #84を現mainへ更新し、別レーンで#70採否を行う。
8. 必要時だけ#93 runtime、#92、#79をそれぞれ別buildで比較する。
9. 採用済み要素だけを統合してv0.8を閉じる。
10. #62、#64、#65の3作戦検証へ進む。

並行して、採用済みRC6は#100でv0.7 production候補として扱います。これにより、公開準備とv0.8の学習・可読性・gameplay実験を相互にblockさせません。
