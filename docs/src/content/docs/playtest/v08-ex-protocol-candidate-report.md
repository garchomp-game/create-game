---
title: EX Protocol candidate 自動QA
description: 6体系・24 route候補の回帰、20 seed比較、90秒soak、Final Expedition露出の実測結果。
---

実施日: 2026-07-23

:::caution[採用判定ではない]
このレポートはcandidateの自動QAです。production既定はOFFで、外部push、PR、main統合、production traffic配分は行っていません。Cloudflare Version Previewは確認用であり、実GPU耐久と人間による操作・可読性・選択品質は未実施です。
:::

## 対象

- branch: `feat/v08-ex-protocols-c1`
- runtime implementation: `03805713cf83`
- base: `565d401a92f6`
- candidate Endless ruleset: `phaser-v0.8-ex-protocols-c1`
- candidate Final ruleset: `phaser-v0.8-final-expedition-ex-protocols-c1`
- catalog: `ex-protocols-v1`

## 自動gate

| Gate | 結果 |
| --- | --- |
| TypeScript | PASS |
| 全unit | 87 files / 559 passed / 2 skipped |
| 24 route | 25 passed |
| 型付きreplay / 決定論 | 9 passed |
| RunRecord v3 / legacy migration | 18 passed |
| 短いbalance probe | 6 passed |
| 90秒headless release soak | PASS |
| 配布build / artifact検査 | PASS、231 modules、31 files、2.82 MiB |
| release browser smoke | Chrome横・縦、Firefoxの9 passed |
| EX candidate browser | 13 passed。版表示、選択、入力、Training無効化、保存、6体系代表戦闘 |
| EX有効buildのTraining | 2 passed。9課題完走、記録非介入、中断・再開 |
| Starlight | 104 pages PASS |
| RC6 normal parity | 3/6勝、Pulse 1 / Spread 2、決定論維持 |
| RC6 repair parity | candidate gate `false / true / true / true`、2400 HP候補を棄却維持 |
| Final exposure | 20 seed x 2武器の40 run gate PASS |

## 20 seed paired balance

300秒時点から75秒、各武器でbaselineと互換Protocol 3件を同じ20 seedで比較しました。各Protocolの4 branch routeは5回ずつ割り当てています。

| Protocol | score中央値差 | kill中央値差 | survival中央値差 | opportunity / effect | damage share中央値 | 判定 |
| --- | ---: | ---: | ---: | ---: | ---: | --- |
| Resonance Relay | 0.00% | 0.00% | 0.00% | 0 / 0 | 0.00% | fair AIで機会不足 |
| Rebound Overdrive | 0.00% | 0.00% | 0.00% | 196 / 192 | 0.00% | 発動成立、damage帰属は5%未満 |
| Redline Core | -0.68% | -0.28% | +0.60% | 0 / 0 | 0.00% | fair AIで最大集束機会不足 |
| Full-span Tidal Sweep | 0.00% | 0.00% | 0.00% | 87 / 87 | 1.05% | 発動成立、damage帰属は5%未満 |
| Breakwater Fan | -1.20% | -0.47% | -2.62% | 30 / 26 | 0.78% | 小さい生存低下を人間確認 |
| Aegis Fan | -1.96% | -0.83% | +4.26% | 11,930 / 932 | 0.05% | 防御効果をdamage shareだけで判定しない |

自動の一強・一弱条件へ該当しませんでした。Breakwaterのsurvival 95% CIは`-8.79% .. -0.12%`で負側ですが、20%劣位条件には届きません。HP costと離脱判断が人間操作で成立するかを確認します。

Relay / Redlineは`effect=0`ではなく、fair AIで`opportunity=0`です。candidateを弱いと即断せず、固定micro fixtureと人間操作を使います。Rebound、Tidal、Breakwater、Aegisのdamage share 5%未満もreview triggerです。防御、容量再装填、位置変更の価値をdamageだけへ還元しません。

## 90秒headless soak

540秒相当の高圧状態から、武器baseline 2件と6 Protocolを30fpsで90秒pair実行しました。

| 指標 | 最大 |
| --- | ---: |
| 敵 | 76 / 96 |
| player弾 | 39 / 60 |
| 全projectile | 61 / 300 |
| Tidal tracker | 5 / 16 |
| drain後のstale tracker | 0 |
| Aegis collision候補 | 129 / 4096 |
| Aegis interception候補 | 29 / 4096 |
| collision resolved | 35 / 2048 |
| 50ms超過率 | 0% |

step p95はPulse baseline 1.879ms、Spread baseline 1.736msでした。最大はAegis 2.529ms、次がTidal 2.090msで、absolute / paired budgetを満たしました。これはheadless CPU計測であり、実ブラウザGPU耐久の代替ではありません。

## Final Expedition露出

20 seed x Pulse / Spreadの40 runを自然進行で実行しました。

| 指標 | 結果 |
| --- | ---: |
| Core完成 / Protocol選択 | 40 / 40 |
| 60秒以上のProtocol露出 | 100% |
| 露出中央値 | 389.13秒 |
| Evolution I到達 | 100% |
| Evolution II + Mastery到達 | 100% |
| 最初のLimit Break到達 | 100% |

release gateの60秒以上露出率90%以上、露出中央値120秒以上を満たしました。これは到達可能性であり、Final Expeditionの勝率やProtocolの面白さを保証しません。

## 残るgate

### Hardware

- 非SwiftShaderの実GPUで15分。
- Aegis / Tidalの高密度表示。
- p95 raw dt 34ms以下、50ms超過率1%未満、実測FPS 15超。
- heap 512 MiB未満、console error 0。

### Human

- 6 Protocolすべてで選択後の行動変化を説明できる。
- Activeをcooldownごとに押すだけのDPS buttonとして使わない。
- Pulseの横展開への弱さ、Spreadの単体集中への弱さが残る。
- Redlineの予約HP、BreakwaterのHP cost、Aegisの外側火力低下を理解できる。
- 最大密度でProtocol状態、敵弾、危険予告、回復を読み分けられる。
- E1 / E2を状況で選び分けられる。

## 現在の判断

利用可能な自動gateはgreenです。scalar変更を行う根拠はまだありません。[固定Preview](https://v08-ex-protocols-c1-0380571-arena-core.garchomp-game.workers.dev/)は人間gate用の比較物であり、candidate acceptedとproduction ONはhardwareとhuman gateの後に別判断します。

仕様は[EX Protocol候補](../../design/ex-protocols/)、実行契約は[品質戦略](../../engineering/quality-strategy/)を参照してください。
