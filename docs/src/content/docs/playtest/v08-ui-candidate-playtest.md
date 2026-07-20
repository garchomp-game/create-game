---
title: v0.8 選択UI候補 プレイテスト手順
description: RC6 baselineと選択UI candidateを同じゲームルールで比較し、可読性、戦場認識、操作再開を採否する短時間手順。
---

最終更新日: 2026-07-20

## 目的

Draft PR [#84](https://github.com/garchomp-game/create-game/pull/84)の選択UI candidateを、同じRC6ゲームルールのbaselineと比較します。見た目の好みだけでなく、次の3点を確認します。

1. 通常強化の名前、現在値、取得後の変化を短時間で読めるか。
2. 選択中も停止した戦場、敵、弾、回復の位置を把握できるか。
3. 選択直後に移動、照準、自動射撃が意図どおり再開するか。

スコア、武器火力、敵密度、ボス難度はこの比較の採否材料にしません。両URLは`phaser-v0.7.0-final-expedition-rc6`を使い、UI以外の差を持ち込まない前提です。

## 比較URL

| 版 | URL | 識別 |
| --- | --- | --- |
| RC6 baseline | [最終遠征RC6 Preview](https://v07-final-expedition-rc6-arena-core.garchomp-game.workers.dev/) | build `faeb3f5e8c5e` |
| UI candidate | [RC6 UI Preview](https://v07-rc6-ui-playtest-arena-core.garchomp-game.workers.dev/) | build `1fdaca2adcd4` |

production v0.6.8はゲームルールが異なるため、このUI比較には使いません。版情報が表と一致しない場合は、そのランを採否対象から外します。

## 最小手順

所要時間は1版あたり5分から10分です。2版を試す場合は、先に触る版をテスターごとに入れ替えます。

1. 同じ端末、ブラウザ、viewport、武器で両版を開始する。
2. 通常強化を最低3回選ぶ。少なくとも1回は数字キー、1回はpointerを使う。
3. 選択肢が出た瞬間に、敵、敵弾、回復の位置を一度確認する。
4. 選択直後の1秒で、移動、照準、自動射撃が再開したか確認する。
5. 可能ならEX強化または契約選択を1回確認する。到達できなくても有効なテストとする。
6. 読めなかった文言、押し間違い、再開直後の意図しない被弾があれば、その場面だけを記録する。

キーボードとpointerを無理に同時操作しません。通常の遊び方で、どちらを選びたくなるかも観測対象です。

## 記録項目

個人名やアカウントは収集せず、任意の匿名IDで記録します。

```text
匿名ID:
端末 / OS / ブラウザ:
viewportまたは画面サイズ:
先に試した版: baseline / candidate
武器: Pulse / Spread
確認できた選択: 通常 / EX / 契約

1. 強化名と取得後の変化を選択前に理解できた: はい / いいえ
2. 選択中も敵・弾・回復の位置を把握できた: はい / いいえ
3. 選択直後に移動・照準・射撃が再開した: はい / いいえ
4. 意図しない選択や再開直後1秒の事故があった: なし / あり
5. 文字のぼやけ、欠け、重なりがあった: なし / あり
6. 通常強化で使いやすい版: baseline / candidate / 同程度
7. 理由または再現手順:
```

動画やRunRecordは必須にしません。再現するhard stall、選択不能、overflow、画面を覆って状況が読めない問題だけは、可能ならスクリーンショットとviewportを残します。

## 採否基準

少人数テストを統計的な優劣判定には使いません。次の順に判断します。

1. 選択不能、hard stall、再開不能、操作結果不一致が1件でも再現した場合は修正する。
2. 文字欠け、重なり、focus消失が同じ条件で再現した場合は修正する。
3. 少なくとも3人または3つの独立環境で有効回答を得る。満たせない場合は探索的所感として扱う。
4. candidateで背景認識または通常強化の理解がbaselineより一貫して悪化する場合は再調整する。
5. blockerがなく、candidateが同等以上で、改善理由を具体的に説明できる場合に採用する。

候補数、XP曲線、強化効果、戦闘中の無敵時間はこの採否で変更しません。停止時間比率と選択後1秒の被弾は[#78](https://github.com/garchomp-game/create-game/issues/78)で別に計装し、UI配置との因果を混ぜません。

## 結果の反映先

- 実装とPR判断: [PH-V08-013 #70](https://github.com/garchomp-game/create-game/issues/70)
- UI責務と採用範囲: [UI・グラフィック再設計計画](../../project-management/ui-visual-redesign-plan/)
- 停止時間と再開事故: [PH-V08-016 #78](https://github.com/garchomp-game/create-game/issues/78)
- 最終採否: [意思決定記録](../../project-management/decision-log/)

結果を受け取った後は、指摘ごとに`採用`、`再現待ち`、`#78で計測`、`対象外`へ分類します。複数の変更をまとめて入れず、必要な修正だけをPR #84へ追加して再確認します。
