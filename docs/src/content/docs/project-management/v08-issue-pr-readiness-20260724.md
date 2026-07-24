---
title: v0.8 Issue・PR readiness
description: 2026-07-24時点のGitHub再監査、EX C2・UI source保全、#113修復、統合順と停止条件。
---

最終整理日: 2026-07-24

## 判定

次の実装へ進む前に、Draft PR #113を最新`main`上で修復し、control観測基盤をcanonicalにする方針は妥当です。即時merge対象はありません。production trafficも変更しません。

現在は、GitHub状態とPreview artifactの再取得、EX Protocol C2とUI sourceの回収、#113既知blockerのローカル修復まで完了しています。外部変更は[GitHub mutation dry-run台帳](../github-mutation-ledger-20260724/)の承認後だけ実行します。

## 再取得した現在地

| 項目 | 2026-07-24の確認値 |
| --- | --- |
| repository | `garchomp-game/create-game` |
| default branch | `main` |
| `origin/main` | `565d401a92f661cff9a4936cee2ebf2c9420d5c3` |
| active GitHub account | `garchomp-game` |
| Open Issue | 20件 |
| Open PR | 10件、すべてDraft |
| PR #113 | base `main`、head `agent/v08-observation-control-integration`、競合あり |
| 即時merge | 0件 |

`develop`は存在しません。統合先は`main`です。元のdirty worktreeと未追跡レビュー資料には触れず、専用worktree `/home/garchompgame/workspace/create-game-observation-repair`で作業しています。

## Source保全

### EX Protocol C2

| 項目 | 値 |
| --- | --- |
| branch | `feat/v08-ex-protocols-c1` |
| worktree | `/home/garchompgame/workspace/create-game-ex-protocol` |
| HEAD | `3c449688` |
| mainとの差 | 28 commits ahead |
| 状態 | clean |

### C2 Choice UI

| 項目 | 値 |
| --- | --- |
| branch | `feat/v08-ex-protocols-c2-ui` |
| worktree | `/home/garchompgame/workspace/create-game-ex-protocol-ui` |
| HEAD | `50c8fc3` |
| runtime UI commit | `685a659` |
| 配布build source | `b453d82636c7c9fcf9b47b4a173d51a8dbe7c008` |
| 状態 | clean、local only |

UI Preview `https://v08-ex-protocols-c2-ui-b453d82-arena-core.garchomp-game.workers.dev/`は、app `0.8.0-candidate.2`、ruleset `phaser-v0.8-ex-protocols-c2`、marker `b453d82636c7`を返します。

| artifact | SHA-256 |
| --- | --- |
| HTML | `727045a58cfd509b94c559491536d7e1f93dbd451ab348b0b7fa9e1cf5f91020` |
| JavaScript | `6a399a48796e9dd837d7012857f2fa4440c16cfca7ea1109d7ba866f40293002` |
| CSS | `93a33f85fd9b66ba879aae22b7f50db2ddc49177e02e9c267373263b576b4793` |

C2から配布buildまでのUI差分はadapter、presentation、CSS、テストへ閉じています。simulation、RNG、damage、drop、`RunRecord`、rankingの変更はありません。

## #113修復

修復branchは`agent/v08-observation-control-repair`です。旧#113 branchを最新`main`へmergeし、9課題Trainingを保持した上で次を直しました。

| 受入条件 | 修復内容 | 現在の証拠 |
| --- | --- | --- |
| 最新main追従 | `565d401a92f6`へ統合し、Trainingとcontrol計装を共存 | conflict解消済み |
| 連続choice | 単一`pendingResume`をepisode queueへ変更 | 連続2選択のunit追加 |
| Run Outcome | standard runの必要eventを保持し、`runOutcomeInsight`をsnapshot / JSONへ接続 | controller / export unit追加 |
| Preview JSON | `downloadRunExport()`と`build:observation`を追加 | browser download E2E追加 |
| 記録境界 | Trainingの`recordPolicy: none`ではevent列とoutcomeを作らない | lifecycle unit |
| 仕様同期 | 9課題、90秒transfer、最新main、旧QA非流用へ更新 | Starlight更新 |

ゲーム数値、ruleset、RNG、damage、drop、`RunRecord` schema、ranking、productionは変更していません。

## QA状態

現在の中間gate:

| gate | 結果 |
| --- | --- |
| 全unit | 74 files / 506 passed / 2 skipped |
| TypeScript | pass |
| `git diff --check` | pass |
| production build / 配布検査 | pass / 27 files |
| 観測用build | pass |
| 対象E2E / WebGL | Run Outcome exportとJSON downloadの2件pass |
| Starlight build | 111 pages pass |
| 全E2E / release smoke | SHA freeze後のT3で実行 |
| GitHub Actions | #113 head更新後に実行 |
| 人間control観測 | 未実施 |

旧#113の477 unit、77 E2E、CI greenは履歴証拠であり、修復候補の合格証拠には使いません。

## 統合順

1. #113修復候補のT2を完了し、runtime SHAをfreezeする。
2. 同じsourceから観測用Version Previewを作り、JSON downloadを含むT3 / T4を行う。
3. RunbookどおりEndlessと最終遠征を両武器で人間観測する。
4. 承認後、既存#113 head branchへfast-forwardでpushし、本文とCIを更新する。
5. #113だけをmainへmergeする。
6. #105、#106、#107、#108、#109、#111をsupersededとして整理する。
7. post-#113 main上でEX C2本体を独立PR化する。
8. C2をbaseに、`b453d82636c7`由来のChoice UIをstacked Draft PR化する。
9. 初心者T1、combat visual、UI、gameplay candidateは別buildのまま進める。

## Issue / PR分類

- canonical repair: #113。
- 個別mergeしない: #105、#106、#107、#108、#109、#111。
- #113採用後にclose判断: Issue #110、#112。
- C2後に置換: PR #84。
- historical evidenceとして整理: PR #69、#71。
- activeのまま: #66、#70、#76、#78、#80、#81、#93、#94、#95、#98。
- C2との重複を確認: #79、#92。
- v0.9まで延期: #62、#64、#65。
- owner判断: #100のrelease trainとproduction昇格。

## 停止条件

- 9課題Training、90秒transfer、記録非介入が変わる。
- choice episodeが上書き、欠落、別選択へ誤帰属する。
- exportされない情報を観測可能と説明している。
- UI整理へsimulation、RNG、damage、drop、記録、ranking変更が混ざる。
- exact Git SHA、build marker、Cloudflare Version ID、artifact digestを対応付けられない。
- 最新base統合後のP0 / P1、未解決review、必須CI失敗が残る。
- 必須の人間playtestを自動greenで代替しようとしている。

このいずれかが成立した場合、そのwaveを止めて証拠と選択肢を提示します。
