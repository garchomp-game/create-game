---
title: v0.8 面白さの核の検証
description: 危険反転、技能の見える化、武器教義、選択テンポ、最大密度を量産前に検証する設計。
---

最終更新日: 2026-07-20

## 目的

Arena Coreの現在の強みは、WASD移動とマウス照準が滑らかで、四方からの圧力を避けながら狙い続ける技能がスコアと生存へ反映されることです。Endlessでは上限のない生存、Expeditionでは有限の戦況突破として、同じ操作から別の再挑戦理由を作れます。

一方、敵、stage、演出を増やすだけでは、次の問題を解決できません。

- 危険イベントが「避ける時間」だけになり、攻撃判断が止まる。
- 上達してもスコア以外に何が良くなったか分かりにくい。
- Pulse / Spreadの差が開始時の弾形状と数値へ戻りやすい。
- 強化選択が増えるほど、停止時間と再開事故が試合の流れを切る。
- 終盤の派手さを増やすほど、敵弾、予告、回復が読みにくくなる。
- 開発者本人と観戦AIの高得点だけでは、初回学習を判断できない。

v0.8ではコンテンツ量より先に、これらを小さい縦切りで検証します。

## 製品上の約束

**避け、狙い、戦況を読み替える技能が、次の瞬間と次のランの両方へ返ってくるゲーム**を目指します。

この約束を次の8本柱へ分けます。

1. 危険は、読めば攻撃機会へ変えられる。
2. 武器は、火力差ではなく異なる判断を要求する。
3. 上達は、結果だけでなく行動の変化として見える。
4. 選択は、戦闘の文脈を失わず短く行える。
5. ボスは、予告、対応、反撃窓を学習できる文法で強くなる。
6. 敗北は、事実に基づく敗因と次の一手へ変えられる。
7. 支援と高難度は明示し、Standardの記録と公平性を守る。
8. 高密度でも、失敗理由を視覚と音から説明できる。

## 0. 緊張・緩和と公平性の設計契約

Issue: [PH-V08-020 #83](https://github.com/garchomp-game/create-game/issues/83)

ゲーム業界経験者から得た助言とWork再レビューを、個別機能を増やす前の設計契約へ変換しました。EndlessとExpeditionの強度曲線、ボスのHP以外の強さ、攻略メタ、near-miss、再挑戦導線、明示的支援をIssueへ分離しています。

短い体験単位は`Preview → Establish → Pair → Priority Shift → Peak → Earned Relief`でレビューします。通常の主要hard demandは2つ、短いPeakでも3つまでを初期上限とし、成功後のreliefは盤面整理、反撃、回収、次予告の確認へ実際に使える区間にします。15〜30秒は観察の初期目安であり、固定timerではありません。

競技公平性は次で固定します。

- Endless、fixed seed、ランキング対象ランへ、履歴に応じた隠れた難度補正を入れない。
- simulationを変える支援はAssistとして明示し、division、modifier、rulesetを記録する。
- Assist、Practice、OverloadをStandard PBへ混ぜない。
- 色覚、字幕、音量、キー割当などsimulation-neutralな設定はStandardのままとする。
- 惜敗や有能感は結果を偽装せず、残HP、到達phase、成功行動、次に変えられる判断から伝える。

助言原文とArena Coreへの一次解釈は[外部ゲームデザイン助言メモ](../external-game-design-advice/)へ残します。[v0.8 Work再レビュー依頼](../../playtest/v08-work-design-review-request/)は提出時点の履歴であり、採用判断の正本は[#83](https://github.com/garchomp-game/create-game/issues/83)と本ページです。

## 学習と視覚意味の切り分け

Issue: [PH-V08-025 #97](https://github.com/garchomp-game/create-game/issues/97) / [PH-V08-026 #98](https://github.com/garchomp-game/create-game/issues/98)

初見プレイでは再挑戦意欲と立ち回りの手応えが観測された一方、敗因と「撃つ・避ける・取る」の分類に理解負債が残りました。これを難度や敵密度の問題と即断せず、現行visualのまま学ぶ選択式TrainingをT1、Training後も誤認が残る場合だけ戦闘オブジェクトの視覚candidateをT2として分けます。

- Trainingは強制導線にせず、RunRecord、PB、ランキング、報酬を更新しない。
- T1は現行の当たり判定、敵弾、Pickup、強化UIを再利用し、説明不足だけを検証する。
- T2は敵本体、敵弾、自機弾、XP、回復の意味だけを扱い、simulation、magnet、damage、dropを変えない。
- #76のgameplay candidate、#84の選択UI、#94の敗因UIをT1 / T2へ混ぜない。
- #81で`該当人数 / 到達人数`と`not-observed / not-reached / failure`を残す。
- T1の初心者には事前のfixture、clip、30秒説明を見せない。Training、案内なし総合演習、同武器Endless 30秒probeを終えた後に分類質問を行う。
- 同じ課題で3回retryまたは60秒進展なしを`assisted`とし、介助なし完了へ数えない。最初の3名中2名が同じ箇所で止まった場合は募集を止めて候補を修正する。

## 1. 危険反転

Issue: [PH-V08-014 #76](https://github.com/garchomp-game/create-game/issues/76)

最初の縦切りでは、既存hazardを全面置換せず、敵にも作用する危険を1件だけ試します。

既存eventと副作用の比較、およびCharger衝突妨害の第一候補は[危険反転の実装前比較](../hazard-reversal-preflight/)へ整理しています。candidateの種類は決定済みですが、半径、持続、対象上限はbaseline観測後、コード変更前に#76へ事前登録します。

プレイヤーには二つの成功段階を用意します。

- 基本成功: 予告を読んで回避する。
- 熟練成功: 敵を範囲や射線へ誘導し、脅威減少または戦術成果を得る。

危険反転は必須正解にしません。初見では避けるだけで生存でき、理解した後に攻撃機会へ変えられる構造にします。予告なし即死、色だけの判別、特定武器だけの成功条件は不採用です。

観測するもの:

- 予告認識から回避までの時間。
- 回避だけ、反転成功、被弾の回数。
- 反転へ巻き込んだ敵数と減った脅威。
- 成功前後の被弾、撃破、位置変更。
- Pulse / Spread別の活用方法。

## 2. 技能shadow ledger

Issue: [PH-V08-015 #77](https://github.com/garchomp-game/create-game/issues/77)

恒久能力値を上げず、simulationが確定した事実から「今回できたこと」を導出します。これはランキング点や実績解除の先行実装ではなく、各candidateから独立した共通観測層です。

責務は`Simulation facts → pure ledger aggregation → Presenter`で固定します。#77はepisode ID、invalid-state、集約scope、最大3成果と1目標の入力境界を所有し、#76、#93、#94、#78、#79の意味と合格値は各Issueが所有します。

共通候補:

- 予告を見て避けた回数。
- 被弾後に一定時間生存し、HPを立て直した回数。
- 危険を増やさずXPまたは回復を回収した割合。
- 危険反転の成功と失敗理由。

Pulse候補:

- 集束を維持した時間。
- 実到達可能な貫通列。
- 反射後命中と、その後の撃破。

Spread候補:

- 1斉射で命中した異なる敵数。
- 扇形全体の有効利用。
- 掃射循環を実際の群れ処理へ変換した割合。

リザルトへ出すのは最大3件の成果と1件の次回目標です。詳細eventを履歴へ無制限保存せず、debug / auto runを人間の熟練履歴へ混ぜません。

## 3. 選択テンポ

Issue: [PH-V08-016 #78](https://github.com/garchomp-game/create-game/issues/78)

選択画面は戦場を透過し、数字キー、pointer、直前照準を保持する状態まで改善しました。次は見た目ではなく、試合時間に対する停止量と再開事故を測ります。

主な指標:

- choice種類別の表示時間。
- 1分あたりの選択回数。
- ラン全体に占める停止時間の割合。
- 選択後1秒の移動、照準、射撃再開。
- 選択後1秒の被弾とhard stall。

計測で問題が出た場合も、候補数、XP曲線、UI配置を同時に変えません。原因を分けるため、1変更単位で比較します。選択中の無敵時間は追加しません。

## 4. ボス攻撃文法と反撃窓

Issue: [PH-V08-022 #93](https://github.com/garchomp-game/create-game/issues/93)

ボスの強さをHPだけで作らず、各攻撃を`Warn → React → Active → Recovery → Punish → Chain`で記述します。Phase 1では新攻撃を一つずつ提示し、Phase 2では既知のhard demandを最大2つまで組み合わせ、最終20%で未提示ルールを追加しません。

最初はRC6 controlを変えず、3攻撃のAttack Card、許可・禁止chain、予告対応率、正しい回避後の反撃・位置改善、回復相殺、中央周回をshadow計測します。2400 HP有限回復候補は0/6勝で棄却済みであり、既定の次候補には戻しません。runtime候補が必要な場合も、phase budget、escort reward、skill rewardから1件だけを#76とは別buildで比較します。

## 5. 敗因、factual near-miss、再挑戦

Issue: [PH-V08-023 #94](https://github.com/garchomp-game/create-game/issues/94)

敗北後は、実測ログから`主敗因1件 / 前回との差1件 / 次の一手1件`を決定論的に導出します。最後の一撃だけを主敗因とせず、直前3〜5秒の被damage寄与、残っていた優先標的、危険状態、同時要求を集約します。

near-missはBoss残HP、timeout差、前回未到達phaseなど再計算可能な事実だけから生成し、事実と異なる「惜しかった」を表示しません。同じseed、weapon、ruleset、divisionへの再挑戦を既定導線にし、wall-clockの再挑戦時間をsimulation timeへ混ぜません。

## 6. 明示的divisionと記録公平性

Issue: [PH-V08-024 #95](https://github.com/garchomp-game/create-game/issues/95)

`Standard | Assist | Practice | Overload`を明示的なdivisionとして分けます。v0.8では4種類のgameplayを一括実装せず、division型、modifierの正規化、比較eligibility、旧記録migration、開始・結果表示の契約を先に保証します。

- Standardは固定ルールで、従来のStandard PB対象。
- Assistは同じmodifier条件内だけで比較する。
- Practiceは比較記録と報酬を更新しない。
- Overloadは同じOverload条件内だけで比較する。
- simulation-neutralなアクセシビリティ設定はStandardのままとする。

Assist / Practiceの最初のruntime候補は#95完了後に別Issueへ事前登録し、本人の明示選択で次ランから有効化します。

## 7. 通常強化の候補偏り

Issue: [PH-V08-021 #92](https://github.com/garchomp-game/create-game/issues/92)

通常強化は最大済み候補を除外し、重み付き抽選で3択を作ります。一方、EXのような一巡保証はないため、連射や移動など基礎操作へ効く候補が長く出ないランを許容しています。

比較する候補:

1. 現行の独立重み付き抽選を維持する。
2. 攻撃、移動、生存のカテゴリへ最小提示保証を置く。
3. 通常強化にも一巡bagを導入する。

見るのは平均取得rankだけではありません。強化ごとの最大未提示gap、最初の基礎操作強化までのlevel数、完成通常ビルドまでの時間、選択の迷い、武器別生存分布を同じseedで比較します。カテゴリ保証とbagを同時に入れず、候補分布を変える実験へ武器数値やXP曲線を混ぜません。

## 8. 武器教義

Issue: [PH-V08-017 #79](https://github.com/garchomp-game/create-game/issues/79)

武器差を「強いか弱いか」だけでなく、「何を見るか、どこへ立つか、何を先に狙うか」で定義します。

Pulseの教義:

- 精密な中心命中と集束維持。
- 貫通列と反射経路の構築。
- 高速弾で優先標的を先に落とす。

Spreadの教義:

- 扇形全体で異なる敵を処理する。
- 群れの形と距離から掃射機会を選ぶ。
- 近距離圧力を火力へ転換し、退路を作る。

最初から各武器2 branchを完成させません。1武器1 branchの最小縦切りで、取得前後に狙い方か位置取りが変わることを確認します。PulseへSpreadと同じ分裂形状を戻さず、Spreadを数値だけでナーフしません。

最初の比較候補と必要な計装は[武器教義の実装前比較](../weapon-doctrine-preflight/)へ整理しています。通常強化の提示分布とは別candidateとして扱い、完成通常ビルドfixtureで候補運を固定してから比較します。

## 9. 最大密度の可読性

Issue: [PH-V08-018 #80](https://github.com/garchomp-game/create-game/issues/80)

通常終盤、危険event、Commander、ボス第2段階の固定fixtureを作り、見た目と音の変更を同じ最大密度条件で比較します。

現行fixture、描画順、音声routeの保証範囲と不足は[最大密度の可読性・警告音 事前監査](../maximum-density-readability-preflight/)へ整理しています。

優先順位:

1. プレイヤーの位置と移動可能領域。
2. 差し迫る敵弾と危険予告。
3. ボスまたは優先標的。
4. 回復と退路。
5. XP、通常敵、成果演出。

音も同じ優先順位を持ちます。同時発音時は危険開始と攻撃直前を残し、通常射撃、撃破、回収の重複を抑制します。色だけで区別せず、輪郭、形、点滅、位置、音を組み合わせます。

## 構造化プレイテスト

Issue: [PH-V08-019 #81](https://github.com/garchomp-game/create-game/issues/81)

これは最後に一度だけ行う統合QAではなく、RC6 baselineと各単独candidateへ同じ手順を再利用する検証レーンです。初心者と経験者を分けて行います。

- 初心者: 説明なしの初回ランと、最小説明後の2回目を比較する。
- 経験者: 現行Endlessまたは最終遠征を複数回経験した状態で比較する。
- RC6、#97 T1、#98 T2、#76、#93、#94、#95、#92、#79、統合buildを別cellとして扱う。
- `not-observed`、`not-reached`、`failure`を分け、割合ではなく`該当人数 / 到達人数`を残す。
- 両層でPulse / Spread、危険反転、敗因、再挑戦理由を確認する。
- RunRecordと所感を匿名IDで対応させ、個人情報は保存しない。

見るのは単一高得点ではありません。

- 2回目に意図的に変えた行動。
- 失敗理由を本人が説明できるか。
- 武器差を行動として説明できるか。
- 危険を回避だけでなく機会として認識したか。
- もう1回試したい理由、止めたい理由。

同じ質問、武器順序、匿名記録を使う実施票は[v0.8 構造化プレイテスト記録票](../../playtest/v08-structured-playtest-template/)を正本とします。

## 実装順

1. v0.7 RC6をmainへ統合し、ゲームルール基準を固定する。
2. #83の採用判断を正本へ同期し、#77、#93 Phase A、#94 Phase A、#95、#80 fixture骨格をsimulation非介入で分けて進める。
3. #97のT1を現行visualで独立実装し、#81でTraining後の正解提示なし総合演習を観察する。誤認が残る場合だけ#98のT2へ進む。
4. #66の世界観とPR #84のUI採否はgameplay candidateと別経路で進める。
5. #89統合とmain green後、#76のCharger衝突妨害だけを別ruleset / SHAで試す。
6. #81の同一手順でRC6と#76を別cellとして人間評価し、判断を記録する。
7. 必要な場合だけ#93のBoss runtime候補を#76と別buildで比較する。
8. #95の記録分離後に#94の結果・再挑戦UXを接続する。
9. #92通常強化と#79武器教義を別buildで個別評価する。
10. #80で採用済み要素の最大密度表現を固定し、#81で統合buildを確認する。
11. 人間検証を通った核だけをStage 1 / 5 / 10へ展開する。

## 対象外

- 新しいruntime AIライブラリ。
- 3つ目の開始武器。
- 10ステージ分の敵、背景、BGM一括制作。
- 恒久ステータス強化。
- アカウント、クラウド同期、オンラインランキング。
- 4 divisionのgameplay一括実装と、履歴依存の隠れた難度変更。
- 長編会話、カットシーン、ボイス。

これらは面白さの核と3作戦の進行契約が固まってから再評価します。

## v0.8完了条件

- 危険反転が基本回避と熟練成功の両方を持つ。
- ボス攻撃を予告、対応、反撃窓、chainとして説明できる。
- 主敗因とnear-missをログから再計算でき、同条件へ再挑戦できる。
- Standardと支援divisionの記録が混ざらない。
- Pulse / Spreadの違いを狙い方、位置取り、標的優先で説明できる。
- 選択後のhard stallが0件で、停止時間比率を説明できる。
- 通常強化の最大未提示gapと、採用した提示規則の理由を説明できる。
- 最大密度でもプレイヤー、敵弾、危険予告、回復を識別できる。
- 初心者と経験者の双方で、失敗理由と次に試す行動を記録できる。
- 不採用要素をdataまたは表示境界から外し、RC6基準へ戻せる。

次のコンテンツ展開は[エクスペディション3作戦検証](../expedition-campaign/)を正本とします。
