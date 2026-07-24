---
title: v0.8 Onboarding T1.1 Readiness
description: Onboarding Readiness Packの再照合結果と、9課題Trainingの測定ノイズ修正。
---

最終整理日: 2026-07-24

## 結論

`Arena-Core-Onboarding-UX-Flow-Readiness-Pack-20260724.zip`を検証し、
最新`main`へ再マッピングした。最小の未ブロックwaveはT1.1であり、
次の二点だけを修正した。

1. 総合演習の固定`8/8`を廃止し、`TutorialSnapshot.stepNumber /
   stepCount`から`9/9`を表示する。
2. 総合演習checklistを全dynamic world entityの背面へ置く。

copy、hint、課題順、敵・Pickup座標、成功条件、simulation、RNG、
score、ranking、RunRecordは変更しない。O1入口、戦闘object visual、
context prompt、キャラクター案内役はこのcandidateへ含めない。

## W0 再照合

観測時刻は`2026-07-24T13:34:19+09:00`。統合先は`main`で、
基準SHAは`5ce96bbd8acdfd90bfda97088b8455693b89fc30`だった。
`develop`は正式な統合先として存在せず、観測時のopen PRは0件だった。

| Capability | Canonical source | 状態 |
| --- | --- | --- |
| 9課題Training | PR #99 / merge `565d401` | main統合済み |
| T1.1 count / layer | branch `agent/v08-onboarding-t11-baseline` / runtime `dc174ec` | candidate |
| Choice UI | PR #84 / merge `6a09c55` | main統合済み |
| Control observation | PR #113 / merge `669a635` | main統合済み |
| Mobile gate | PR #114 / merge `5ce96bb` | main統合済み |
| O1 | 該当sourceなし | 未実装 |
| StudyLog | 該当sourceなし | 未実装 |
| Onboarding Profile fields | Profile schema v1には存在しない | 未実装 |
| v0.8 EX Protocol C1 / C2 UI | local worktree `3c44968` / `50c8fc3` | main未統合・本作業から除外 |

元worktree
`/home/garchompgame/workspace/create-game`は
`agent/v08-training-guided-flow`と未追跡レビュー資料を保持している。
本作業では変更せず、最新`main`から専用worktreeを作成した。stashは0件。

PC制限は`main.ts`でPhaserのdynamic importより先に判定される。
狭いdesktopとtouch laptopを単一signalだけではblockせず、mobile /
tabletは理由付き画面へ送る。WebGL failure専用fallbackの有無は
ENV0の別contractとして継続確認し、T1.1へ混ぜない。

## 9課題inventory

terminalの`complete`は課題数へ含めない。

| # | Step ID | 成功guard |
| ---: | --- | --- |
| 1 | `move` | 累積移動64px |
| 2 | `navigate` | 指定zoneへ到達 |
| 3 | `contactDamage` | 指定敵から接触damageを受ける |
| 4 | `aimAndKill` | 指定敵を撃破 |
| 5 | `collectXp` | 指定XPを取得 |
| 6 | `chooseUpgrade` | 既存強化を1件選択 |
| 7 | `dodgeProjectile` | 指定敵弾を2回回避 |
| 8 | `collectRepair` | 指定REPAIRで実HPを回復 |
| 9 | `transferDrill` | 初期敵3体全滅かつ生成Pickupを全回収 |

## W1 契約境界

- TrainingはGameContentの`recordPolicy: none`を使用する。
- `ArenaScene`はTrainingでRun lifecycleのbegin / finalize / exportを行わない。
- Standardは`recordPolicy: standard`を維持する。
- Profile、settings、履歴、PB、rankingのschemaは変更しない。
- StudyLogはまだ存在しない。RunRecordやStandard eventへ計測を追加しない。
- T1.1の表示値は既存Presenterのdata-derived `eyebrow`を唯一の正本にする。
- dynamic worldはdepth `0`、checklist background / textは`-2 / -1`、
  通常Training overlayは`12 / 13`とする。
- retry noticeは通常overlayへ残し、敵の背面へ移さない。

## T1.1受け入れ

| ID | 結果 | 証拠 |
| --- | --- | --- |
| AC-T1-001 | pass | 総合演習Presenterが`BASIC TRAINING  9/9` |
| AC-T1-002 | pass | `complete` snapshotも`stepCount: 9` |
| AC-T1-003 | pass | depth契約unitとtransfer landscape / portrait画像 |
| AC-T1-004 | pass | runtime diffはcount表示とchecklist layerのみ |
| AC-NFR-001 | pass | 全unit内のStandard固定seed digest |
| AC-NFR-002 | pass | gameplay / record fileの変更なし |

## 自動証拠

runtime候補は`dc174ec`。

| Gate | 結果 |
| --- | --- |
| Pack validation | 52 traceability、26 build cell、41 acceptance、18 flow row、Study contract pass |
| TypeScript | pass |
| 対象unit | 4 files / 25 passed |
| 全unit | 78 files / 520 passed / 2 skipped |
| Production build | 225 modules / pass。既存のchunk size警告のみ |
| Transfer visual | landscape / portrait pass。Ranged silhouetteがchecklistより前面 |
| Training public-input E2E | 全課題完走1件pass、pause / restart / title / reload 1件pass |
| Release smoke | Chrome landscape / portrait、Firefoxの9件pass |
| Starlight | 112 pages / pass |

公開入力E2Eは最初の二回、変更箇所より前の`navigate`でkey holdが
進まないflaky failureを再現し、同一SHAの再実行で完走した。
製品不具合として再現していないが、T1.1の人間結果へ混ぜず、
E2E安定性の残存riskとして記録する。

## main統合と固定Preview

PR #115をmainへ統合し、merge commit
`59cffbf7cddf115c893566c2b288295c13bfc75d`から通常配布buildを作成した。
production trafficへ配分せず、次のCloudflare Version Previewを
T1.1の人間gateに使う。

| 項目 | 値 |
| --- | --- |
| Preview URL | `https://191dd49a-arena-core.garchomp-game.workers.dev` |
| Cloudflare Version ID | `191dd49a-5b08-4edc-bfa1-0b7cc0cf0260` |
| app / ruleset | `0.7.0` / `phaser-v0.7.0-final-expedition-rc6` |
| build commit | `59cffbf7cddf` |
| Endless run ruleset | `phaser-v0.6.8-pulse-boundary-ricochet` |
| 実URL確認日 | 2026-07-24 |

通常配布smokeで版情報、タイトル、設定、ランキング、履歴、武器選択、
自然終了、RunRecord、再挑戦、Pause、beta情報を確認し、
console、page、request、HTTP errorは0件だった。

## 人間gate

[#81](https://github.com/garchomp-game/create-game/issues/81)は
初心者・経験者raw count未取得のためopenを維持する。
旧Preview `v08-training-t1-contact-2247bd9`は9課題実装の履歴証拠だが、
固定`8/8`とchecklist遮蔽を含むため、新しい初心者T1の母数へ使わない。

新しい初心者T1は上記固定Previewだけを使い、事前教材なしで
介助なし完了、敵本体・敵弾・XP・REPAIR分類、強化説明、
Endlessへの転移を観測する。参加者結果が出るまで次を開始しない。

- #98 runtime visual candidate
- O1-A / O1-Bの製品default採用
- context promptの一括投入
- キャラクター本asset制作

待機中に進められるのは、runtimeを変えないPhase A fixture、
schema、観察票、flow inventory、WebGL fallbackのread-only ENV0である。
