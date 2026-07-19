---
title: RC6 有限回復予算 比較結果
description: 最終決戦のcontrolと2400 HP有限repair budgetを、同一seed・武器・入力で比較したWave 3の採否記録。
---

最終更新日: 2026-07-19

## 結論

`PH-V07-012`のcandidate Aは**不採用**です。最終決戦だけに2400 HPの有限repair budgetを設定すると、回復相殺率は下がりますが、RC6 controlで勝利した3構成がすべて敗北へ反転しました。既定値は`repairBudget: null`のまま維持し、production trafficもv0.6.8から変更しません。

有限予算のruntime契約、計測、比較probeは残します。別候補を検討する場合も、今回の2400 HPを結果に合わせて変更せず、phase遷移や攻撃回避による補充を独立した候補として事前登録します。

## 固定した候補

2026-07-19にIssue #75へ、実装前に次を記録しました。

- control: 1秒のdrop間隔だけを持ち、供給総量は無制限。
- candidate A: ボスspawn時に2400 HPを供給し、補充しない。
- pickup生成時に`min(通常healValue, remainingBudget)`を供給し、その値を即時消費する。
- 満HP取得、期限切れ、未回収でも供給済みbudgetを返却しない。
- 道中、Endless、武器、ボス攻撃、drop間隔は変更しない。

## 比較方法

3 fixed seed x 2武器を30 HzのCPU早送りで実行しました。各controlで生成した入力をcandidateへ再生し、candidate側でも観戦AIの内部状態更新を行いました。candidateが先に終了した場合は、そのフレームまでの入力hashがcontrolのprefixと一致することをassertしています。

回復相殺率は次で統一しました。

```text
ボス中の実HP回復量 / ボス中の総被ダメージ
```

総被ダメージには、ボス固有攻撃だけでなく、通常敵接触と通常敵弾を含みます。総被ダメージ0の場合は算出しません。

## 結果

| 武器 | seed | control | control相殺率 | candidate A | candidate相殺率 | candidate残ボスHP |
|---|---:|---|---:|---|---:|---:|
| Pulse | 20260717 | 敗北 | 0.871 | 敗北 | 0.866 | 377 |
| Pulse | 20260718 | 敗北 | 0.260 | 敗北・同値 | 0.260 | 3038 |
| Pulse | 20260719 | 勝利 | 1.000 | 敗北 | 0.814 | 288 |
| Spread | 20260717 | 敗北 | 0.848 | 敗北 | 0.839 | 395 |
| Spread | 20260718 | 勝利 | 0.937 | 敗北 | 0.782 | 925 |
| Spread | 20260719 | 勝利 | 0.963 | 敗北 | 0.788 | 824 |

controlは3/6勝利、candidate Aは0/6勝利でした。controlの勝利はPulse / seed 20260719とSpread / seed 20260718、20260719で、candidateでは3本とも2400を使い切り、ボスを288から925 HP残して敗北しました。Pulse / seed 20260718だけは短時間で敗北して253しか供給せず、入力と戦闘結果がcontrolと同値です。残るcontrol敗北2本も候補では2400を使い切り、勝利への反転はありませんでした。

候補側でもボス中に通常敵を114から1564体撃破し、全6構成で外周進入と遮蔽物付近への進入が残りました。回復相殺率90%未満、通常敵撃破、アリーナ移動の3条件は満たしましたが、勝利条件だけを満たしません。したがって回収経路を単純に消した結果ではなく、戦闘非劣性を失う候補として棄却します。

code commit `c908450a7101`で`npm run probe:v07:repair`を再取得しました。結果は`1 passed / 1 skipped`で、通常probeがskip、repair比較だけが実行されています。release matrixでは`allVictories: false`、`repairOffsetControlled: true`、`regularEnemiesRequired: true`、`arenaMovementRequired: true`を個別にassertしています。6ペアの入力prefix一致に加え、最初のcandidateを再実行してinput / event / world hash一致も確認しました。

## 中央周回の扱い

ボス出現後に中央半径120へ強制移動する自動近似も1ペア実行しましたが、controlとcandidateが同一入力で8.5秒後に敗北しました。手動で成立した「ボスを中央へ誘導してから周回する」操作を再現できていないため、中央周回への対策証拠には使いません。

2026-07-19に通常UIでPulse 2本とSpread 1本をプレイし、中央誘導、回復経路、通常敵撃破、制圧衝撃波を確認しました。勝利ランの実回復相殺率は99.96%と98.21%でしたが、位置、標的、回復経路を変えない安定循環にはならず、有限候補を再採用する必要はないと判断しました。自動近似だけでなく、通常UIの欠陥特化ランを採否根拠へ加えています。

## 追加した観測

- ボス中の総被ダメージ、供給healValue、実HP回復量、回復相殺率。
- cooldownとbudget枯渇を分けたdrop抑制数。
- 回復生成、取得、満HP取得、期限切れ。
- repair budgetの初期値、消費量、残量。
- 中央、外周、遮蔽物付近のframe数と進入回数、移動距離。
- ボス中の通常敵撃破、入力hash、event hash、world hash。

## 次の判断

1. candidate Aは棄却し、RC6 controlを維持する。
2. `PH-V07-008`でCommander中の通常敵圧力先行とAct時計のstep丸めを修正し、3/6自然勝利を高難度Stageの退行下限として維持する。
3. 機構到達は専用fixtureと自然勝敗から分離し、6/6へ合わせるためにゲーム数値や観戦AIを変更しない。
4. Pulse / Spreadの通常UI欠陥特化ランを完了し、controlをproduction候補として採用する。
