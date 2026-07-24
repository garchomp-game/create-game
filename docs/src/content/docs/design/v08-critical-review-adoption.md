---
title: v0.8 批判的レビューの採用判断
description: 2026年7月22日の外部レビューを、現行コア、検証仮説、停止条件、実行順へ変換した判断記録。
---

最終更新日: 2026-07-22

## 結論

外部レビューの判定`revise roadmap`を採用します。Arena Coreの操作と圧力設計を作り直すのではなく、未検証の仮説を現行の強みとして扱わず、比較可能な小さい検証へ分けます。

現在成立しているコアは次です。

> 四方から迫る圧力の中で、移動と照準を分離し、敵役割・障害物・回収経路を組み替えながら、倒し続けて生き延びる。

「危険を反撃機会へ変える」は、このコアを拡張できるか調べるv0.8の仮説です。Chargerの現行挙動が学習可能な機会を作れていると確認するまで、製品の約束や実装済みの強みとして扱いません。

## 事実監査

レビュー指摘を現行実装と照合し、次を確認しました。

| 指摘 | 確認結果 | 判断 |
| --- | --- | --- |
| Training後のEndless 30秒ではRanged敵弾を観測できない | Rangedの開始は60秒 | T0 / T1は死亡または90秒まで観測し、30 / 60 / 90秒到達を分ける |
| Chargerが反転候補を学ぶ前に倒される可能性がある | 現行HPはFast基準の約3、初回chargeまで待機と予告がある | 現行controlの生存機会を先に計測し、HPと反転効果を同時に変えない |
| 強化選択の停止量が未計測 | #78がwall-clock計測を所有するがruntime未接続 | UI採否より前にshadow計測を入れる |
| 強化がbuild identityを作っているという断定が強い | 通常強化は最終的に全取得し、EXも数値循環が中心 | 現状を「取得順によるラン内の判断差」と表現する |
| event後のreliefが実際の緩和とは限らない | 通常waveは継続する | event後5秒の圧力をshadow計測してから設計を変える |
| Bossが回復供給へ依存している可能性がある | RC6の有限回復candidateは棄却済み | #93で事実を取り、回復nerfと新攻撃を同時に行わない |

## 採用する判断

1. **T0 / T1 transferを90秒へ延長する。** 30秒生存は中間指標として残し、Ranged到達、発射、被曝、反応を別々に記録します。事前画像、動画、最小説明はtransfer後へ回します。
2. **Charger control viabilityを先に確認する。** `spawned / killed-before-telegraph / telegraph / charge / obstacle / boundary / recovery`を個別に数えます。最初の経験者3名中2名が予告前撃破、または熟練runの大半でcharge未発生なら、反転candidateを開始しません。
3. **選択停止をwall-clockで測る。** simulation timeへ混ぜず、種類別表示時間、1分あたり回数、停止比率、再開後1秒の操作と被弾を#78で所有します。
4. **モード固有の再挑戦理由を測る。** 必須run後に5分だけ自由選択を置き、同じmode、別mode、別weapon、終了のどれを自発的に選ぶか記録します。
5. **スコア契約を一文で表示する。** Endlessは撃破点を主、同点時は生存時間、Expeditionは完遂後の総クリア時間を主、同タイム時は撃破点とします。内部互換の`tacticalScore`は維持し、表示だけを「撃破点」へ改めます。
6. **モード、modifier、記録方針を別軸にする。** Practice、Assist、Overloadを単一の強さ順`division`として扱いません。比較可否は正規化した条件と記録scopeから導出します。
7. **終了後の助言は事実だけから作る。** #94 Phase Aは主敗因、進捗、再挑戦contextの純粋ViewModelまでとし、閾値未登録のnear-missを表示しません。

## 三つの比較だけを先に行う

### 1. T0とT1のtransfer

- T0: Trainingなし。
- T1: 現行visualのTrainingを完了。
- 共通: 同じdesktop landscape、自動射撃設定、Pulse、fixed seed。
- 観測: 死亡または90秒、30 / 60 / 90秒到達、Ranged発射への反応、XP / REPAIR理解。
- 禁止: transfer前のfixture、動画、攻略説明。

### 2. EndlessとExpeditionの再挑戦理由

- 経験者は順序を入れ替えて両modeを遊ぶ。
- 必須run終了後、説明なしで5分間の自由選択を許可する。
- 選択、選択までの時間、理由、実際に開始したかを記録する。
- 「遊びたい」という回答だけで継続性を採用判定しない。

### 3. Charger controlと反転candidate

最初はcontrolだけを観測します。control viabilityを通過した場合に限り、HP、spawn、武器数値を固定したまま衝突妨害だけを加えたcandidateを別rulesetで比較します。

## 停止条件

- T0 / T1でRangedへ未到達の参加者を敵弾理解の失敗へ数えない。
- 最初の経験者3名中2名がChargerを予告前に倒した場合、#76のruntime実装を停止する。
- 熟練runの大半でchargeが発生しない場合、反転効果ではなくcontrolの提示機会を再設計する。
- #78の停止時間分布を得る前に、選択回数、XP曲線、UI配置を同時変更しない。
- #93の回復相殺と攻撃文法を得る前に、回復nerf、新Boss攻撃、敵密度変更を行わない。
- near-miss閾値を結果閲覧後に決めない。

## 保留・不採用

現段階では、世界観の本実装、Stage 1 / 5 / 10量産、3つ目の武器、大規模build tree、汎用Practice gameplay、アカウント、オンラインランキング、新Boss攻撃を進めません。

また、Practice / Assist / Overloadを一つの`division`序列へ押し込む設計は不採用です。互換用の既存識別子を直ちに壊さず、mode、modifier、記録eligibilityの責務へ段階的に分けます。

## 実行順

1. 本判断をCore Promise、実行計画、プレイテスト票へ同期する。
2. T0 / T1の90秒transferと5分自由選択を#81で実施可能にする。
3. #78の選択wall-clock計測、#93のBoss / recovery shadow、Charger control viabilityをsimulation非介入で整える。
4. #94 Phase Aの純粋ViewModelを実装する。
5. control viability通過後だけ#76の反転candidateを事前登録する。
6. 採用済みの核だけをUI、視覚、Stage展開へ接続する。

詳細手順は[v0.8 実行計画](../../project-management/v08-execution-plan/)、記録票は[v0.8 構造化プレイテスト](../../playtest/v08-structured-playtest-template/)を正本とします。
