---
title: 直近フェーズ
description: v0.8の初回導線、用語、視覚、最大密度、人間検証を一件ずつ完了する計画。
---

最終整理日: 2026-07-31

## 結論

v0.8の次工程は新しいゲームルールの追加ではなく、初回プレイヤーが
「どこから始めるか」「画面上のものをどう扱うか」「次に何を試すか」を
短時間で理解できる状態へ仕上げることです。

実行順の正本は[課題解決キュー](../issue-resolution-queue/)です。
同時に`status:next`を付けるIssueは一件だけにし、現在は
[#138 初回タイトルの行動導線](https://github.com/garchomp-game/create-game/issues/138)
を扱います。

## 採用した軸

製品全体は[ゲームコンセプト](../../product/game-concept/)の三段を正本とします。

> **コンセプト:** 包囲は、反撃の設計図になる。
>
> **ゲーム構造:** 一戦でCOREは完成する。次の一戦で強くなっているのは、あなた。
>
> **第1キャンペーン:** 誰も知らない11分目へ。

v0.8は入口、用語、視覚、人間検証を整えるフェーズであり、未実装の
「包囲反転」や「11分目」を実装済みとして見せません。現行キューの後に、
既存Commanderで体験核を実証し、Story構造を決め、11分目を一作戦だけ
縦切りします。

## 現在のopen Issue

| 区分 | Issue | 状態 |
| --- | --- | --- |
| 親 | [#135 UI視覚刷新](https://github.com/garchomp-game/create-game/issues/135) | 7件の子Issueを束ねるepic |
| Next | [#138 初回タイトル導線](https://github.com/garchomp-game/create-game/issues/138) | 最初に意思決定・実装する |
| Queue | [#139 Story階層・進行](https://github.com/garchomp-game/create-game/issues/139) | #138後 |
| Queue | [#140 用語と説明文](https://github.com/garchomp-game/create-game/issues/140) | #139後 |
| Queue | [#141 タイトル / Story視覚](https://github.com/garchomp-game/create-game/issues/141) | 構造と用語の確定後 |
| Queue | [#142 選択UI / HUD / リザルト](https://github.com/garchomp-game/create-game/issues/142) | #141の視覚文法を継承 |
| Gate | [#80 最大密度・警告](https://github.com/garchomp-game/create-game/issues/80) | 統合候補の品質ゲート |
| Gate | [#81 構造化プレイテスト](https://github.com/garchomp-game/create-game/issues/81) | v0.8最後の人間採否 |
| Later | [#144 Commander反撃窓](https://github.com/garchomp-game/create-game/issues/144) | v0.8完了後に既存挙動を実証 |
| Later | [#143 一戦完結Story構造](https://github.com/garchomp-game/create-game/issues/143) | #144の採否後に構造を決定 |
| Later | [#145 11分目Story縦切り](https://github.com/garchomp-game/create-game/issues/145) | #143の採用後に一作戦を実装 |

## 既に成立している基盤

- Phaser 4.2.1 / WebGL。
- Endless、最終遠征、Story初期作戦、Practice。
- Pulse / Spread、通常強化、固有スキル、循環EX。
- ローカル履歴、ランキング、設定、同条件再挑戦。
- PC専用起動gateとWebGL失敗案内。
- Story内3任務10課題の初期作戦。
- 段階的なEndless敵導入、XP曲線、危険イベント、10分のアリーナ崩壊。
- 共通entity visual、Kenney素材台帳、戦術背景、回復・XP・敵弾の意味分離。
- 共通選択UI、Practice設定、Help、compact tactical HUD。
- UI状態catalog、型付き遷移manifest、対象fixture。
- 高密度runtimeの主要なperformance最適化。

これらを別Issueで再実装しません。欠陥が再現した場合だけ、現在Issueから
独立したbugとして扱います。

## 各Issueで守る範囲

### #138 タイトル

初回向け主CTA、副導線、管理導線を決めます。Story内部の保存や最終アートは
混ぜません。

### #139 Story

初期作戦と最終遠征の強さを分け、初期作戦完了を端末内保存します。
中間作戦や難易度別モードは実装しません。

### #140 用語

表示語を一般語、説明付き固有名、製品非表示へ分類します。内部IDや保存schemaを
一括renameしません。

### #141 タイトル / Story視覚

第一画面から自機、戦場、回収拠点を示します。全画面を同時に刷新せず、
軌道回収プラットフォーム案を一つの縦切りで採否します。

### #142 選択UI / HUD / リザルト

採用した視覚文法を既存Presenter / ViewModel境界で展開します。武器、敵、
XP、難易度の数値は変えません。

### #80 / #81

#80で最大密度、警告、音、実GPUを確認し、#81で初見と経験者の実行動を確認します。
この二件へ入る前に候補SHAを固定し、結果を見て複数仕様を同時変更しません。

## QA方針

順序1から5:

- TypeScript。
- 変更対象のunit。
- 変更したUI catalog fixture。
- 一つのdesktop browser smoke。

順序6:

- 最大密度fixture。
- 対象画像。
- frame p95とWebGL非空。
- 警告音のrouting。
- 必要な全unit / E2E / deploy build。

順序7:

- 固定Version Preview。
- 初心者 / 経験者のraw count。
- 自由回答と実際の行動。
- 採用、再設計、延期、棄却の記録。

途中で毎回15分soak、全seed probe、全viewport、全画像を回しません。
simulation、保存、乱数、共通入力へ触れた場合だけ対象gateを拡張します。

## 旧Issueの整理

2026-07-27に、#76、#77、#79、#93、#62、#64、#65を閉じました。

- 完了した基盤を広い未完了Issueとして残さない。
- controlで成立しなかったcandidateを保留のまま維持しない。
- EX固有スキルやStory初期作戦に置き換わった旧案を二重管理しない。
- 旧Stage番号を前提にせず、将来構造は#143で改めて決める。

判断理由と後継は[課題解決キュー](../issue-resolution-queue/)に記録しています。
旧Issue自体は削除せず、比較結果とコメントを履歴として保持します。

## v0.9へ進む条件と順序

最初に[#144](https://github.com/garchomp-game/create-game/issues/144)を
`status:next`へ変更できる条件は次の通りです。

1. #138から#142の採否が完了している。
2. #80の高密度gateが完了している。
3. #81で初期作戦から最終遠征までの理解と難度差を観測している。
4. 同時に着手中のIssueがない。

その後は次の順序を固定します。

1. [#144](https://github.com/garchomp-game/create-game/issues/144):
   現行Commander撃破後の増援停止が、説明可能な反撃・回収・位置改善になるか実証する。
2. [#143](https://github.com/garchomp-game/create-game/issues/143):
   中間作戦、難易度別、ハイブリッドを一戦完結・戦闘力非持越しの制約で比較する。
3. [#145](https://github.com/garchomp-game/create-game/issues/145):
   Story専用の10:00から11:00を一作戦だけ縦切りする。

先に10本やStage 1 / 5 / 10を製品要件へ戻しません。現行Endlessの
600秒以降、PB、ランキングも11分目の都合で変更しません。
