---
title: v0.8 Training T1.2-C 短文化候補
description: T1.1のゲーム進行を固定し、課題開始時の説明量だけを減らす比較候補。
---

最終整理日: 2026-07-24

## 仮説

T1.1は全9課題を操作できるが、課題開始時の説明が長く、
経験者と文章を読まない初心者へ不要な停止を作る可能性がある。
一つの行動を1～2行で示せば、成功条件を変えずに最初の入力までの時間と
説明を閉じるだけの操作を減らせる。

## 変更するもの

- 9課題の`instruction`、`briefing`、開始button文言。
- 各briefingを最大2行、40文字以内にする自動契約。
- 体験前は「移動する、狙う、避ける、取る、選ぶ」を先に表示する。
- XPとREPAIRは現行visualに合わせ、色だけでなく丸・十字を併記する。

## 固定するもの

- 課題ID、順序、`briefing / active`状態機械。
- 全9回の確認操作とEscapeによる中断。
- 敵、敵弾、Pickup、障害物の座標と見た目。
- 成功guard、retry、8秒 / 20秒の現行hint。
- simulation、RNG、score、ruleset、Profile、RunRecord。

長い説明を4章へ統合する変更と、無操作時のkey強調はこのcandidateへ
含めない。前者は表示頻度、後者はhint発火規則の別仮説として扱う。

## 自動受け入れ

- 全briefingが2行・40文字以内。
- Presenter、9課題公開入力E2E、landscape / portrait visualが通る。
- Training完了・中断・restart・reloadでローカル記録が変わらない。
- Standard固定simulationとrelease smokeが回帰しない。

## 人間採否

T1.1と同じ手順を使い、別参加者か経験済みcohortとして分ける。

- briefing表示から最初の正しい入力までの時間。
- briefingを読み返した、またはHelpを必要とした人数。
- 課題ごとの誤操作、retry、介助。
- 敵本体、敵弾、XP、REPAIR、強化の説明。
- 短文化によって意味理解が下がった箇所。

理解を落とさず開始摩擦が減る場合だけ採用する。意味理解が下がる場合は、
文章を一括で戻さず該当課題だけを次candidateとして修正する。
